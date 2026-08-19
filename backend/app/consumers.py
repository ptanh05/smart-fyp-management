"""
WebSocket consumers for real-time chat functionality.

This module provides WebSocket consumers for:
- ChatConsumer: Handles real-time chat messages between students and supervisors
"""

import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser

from app.models import (
    ChatRoom,
    Student,
    Supervisor,
    SupervisorOfStudentGroup,
)
from app.validators import validate_chat_message, MAX_CHAT_MESSAGE_LENGTH


class ChatConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for real-time chat in student-supervisor groups.
    
    Features:
    - Real-time message broadcasting
    - JWT authentication
    - Group membership validation
    - Message persistence to database
    - Connection status notifications
    """
    
    async def connect(self):
        """Handle WebSocket connection."""
        self.group_id = self.scope["url_route"]["kwargs"]["group_id"]
        self.room_group_name = f"chat_{self.group_id}"
        self.user = self.scope.get("user", AnonymousUser())
        self.message_history = []
        
        # Check if user is authenticated
        if not self.user or isinstance(self.user, AnonymousUser) or not getattr(self.user, "is_authenticated", False):
            await self.close(code=4001)  # Unauthorized
            return
        
        # Verify ticket group binding if ticket was used
        ticket_group_id = self.scope.get("ticket_group_id")
        if ticket_group_id is not None and str(ticket_group_id) != str(self.group_id):
            await self.close(code=4003)  # Forbidden - ticket bound to different group
            return

        # Verify user is a member of this group
        is_member = await self.is_group_member()
        if not is_member:
            await self.close(code=4003)  # Forbidden
            return
        
        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        
        await self.accept()
        
        # Send connection success message
        await self.send(text_data=json.dumps({
            "type": "connection_established",
            "message": "Connected to chat",
            "group_id": self.group_id,
            "user_type": getattr(self.user, "user_type", ""),
        }))
        
        # Notify others that user joined
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "user_join",
                "username": getattr(self.user, "username", ""),
                "user_type": getattr(self.user, "user_type", ""),
            }
        )

    async def disconnect(self, code):
        """Handle WebSocket disconnect."""
        # Leave room group
        if hasattr(self, "room_group_name"):
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )
            
            # Notify others that user left if authenticated
            if hasattr(self, "user") and self.user and getattr(self.user, "is_authenticated", False):
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        "type": "user_leave",
                        "username": getattr(self.user, "username", ""),
                        "user_type": getattr(self.user, "user_type", ""),
                    }
                )

    async def check_rate_limit(self):
        """Frame-level rate limit: max 10 messages per 5 seconds."""
        import time
        now = time.time()
        self.message_history = [t for t in self.message_history if now - t < 5.0]
        if len(self.message_history) >= 10:
            return False
        self.message_history.append(now)
        return True

    async def receive(self, text_data=None, bytes_data=None):
        """Handle incoming WebSocket messages."""
        if not text_data:
            return

        if not await self.check_rate_limit():
            await self.send(text_data=json.dumps({
                "type": "error",
                "message": "Rate limit exceeded. Please wait a few seconds before sending more messages."
            }))
            return

        try:
            data = json.loads(text_data)
            message_type = data.get("type", "chat_message")
            
            if message_type == "chat_message":
                await self.handle_chat_message(data)
            elif message_type == "typing":
                await self.handle_typing(data)
            elif message_type == "ping":
                await self.send(text_data=json.dumps({"type": "pong"}))
            else:
                await self.send(text_data=json.dumps({
                    "type": "error",
                    "message": f"Unknown message type: {message_type}"
                }))
        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({
                "type": "error",
                "message": "Invalid JSON format"
            }))
        except Exception as e:
            await self.send(text_data=json.dumps({
                "type": "error",
                "message": str(e)
            }))
    
    async def handle_chat_message(self, data):
        """Process and broadcast a chat message."""
        message = data.get("message", "").strip()
        
        # Validate message
        if not message:
            await self.send(text_data=json.dumps({
                "type": "error",
                "message": "Message cannot be empty"
            }))
            return
        
        if len(message) > MAX_CHAT_MESSAGE_LENGTH:
            await self.send(text_data=json.dumps({
                "type": "error",
                "message": f"Message too long. Maximum {MAX_CHAT_MESSAGE_LENGTH} characters allowed."
            }))
            return
        
        # Save message to database
        saved_message = await self.save_message(message)
        
        if saved_message:
            # Broadcast message to room group
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "chat_message",
                    "message": saved_message["message"],
                    "message_id": saved_message["id"],
                    "sent_by": saved_message["sent_by"],
                    "sender_username": saved_message["sender_username"],
                    "sender_id": saved_message["sender_id"],
                    "created_at": saved_message["created_at"],
                }
            )
        else:
            await self.send(text_data=json.dumps({
                "type": "error",
                "message": "Failed to save message"
            }))
    
    async def handle_typing(self, data):
        """Broadcast typing indicator to other users in the group."""
        is_typing = data.get("is_typing", False)
        
        username = getattr(self.user, "username", "") if self.user else ""
        user_type = getattr(self.user, "user_type", "") if self.user else ""
        
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "typing_indicator",
                "username": username,
                "user_type": user_type,
                "is_typing": is_typing,
            }
        )
    
    # Event handlers for group messages
    
    async def chat_message(self, event):
        """Send chat message to WebSocket."""
        await self.send(text_data=json.dumps({
            "type": "chat_message",
            "message": event["message"],
            "message_id": event["message_id"],
            "sent_by": event["sent_by"],
            "sender_username": event["sender_username"],
            "sender_id": event["sender_id"],
            "created_at": event["created_at"],
        }))
    
    async def typing_indicator(self, event):
        """Send typing indicator to WebSocket."""
        # Don't send typing indicator to the user who is typing
        current_username = getattr(self.user, "username", None) if self.user else None
        if event.get("username") != current_username:
            await self.send(text_data=json.dumps({
                "type": "typing",
                "username": event["username"],
                "user_type": event["user_type"],
                "is_typing": event["is_typing"],
            }))
    
    async def user_join(self, event):
        """Send user join notification to WebSocket."""
        current_username = getattr(self.user, "username", None) if self.user else None
        if event.get("username") != current_username:
            await self.send(text_data=json.dumps({
                "type": "user_join",
                "username": event["username"],
                "user_type": event["user_type"],
            }))
    
    async def user_leave(self, event):
        """Send user leave notification to WebSocket."""
        current_username = getattr(self.user, "username", None) if self.user else None
        if event.get("username") != current_username:
            await self.send(text_data=json.dumps({
                "type": "user_leave",
                "username": event["username"],
                "user_type": event["user_type"],
            }))
    
    # Database operations
    
    @database_sync_to_async
    def is_group_member(self):
        """Check if the current user is a member of the chat group."""
        if not self.user or not getattr(self.user, "is_authenticated", False):
            return False

        user_type = getattr(self.user, "user_type", None)
        if not user_type:
            return False

        try:
            group = SupervisorOfStudentGroup.objects.get(id=self.group_id)
            
            # Check if user is a student in the group
            if user_type == "student":
                try:
                    student = Student.objects.get(user=self.user)
                    return (
                        group.group.student_1 == student or 
                        group.group.student_2 == student
                    )
                except Student.DoesNotExist:
                    return False
            
            # Check if user is the supervisor of the group
            elif user_type == "supervisor":
                try:
                    supervisor = Supervisor.objects.get(user=self.user)
                    return group.supervisor == supervisor
                except Supervisor.DoesNotExist:
                    return False
            
            return False
        except SupervisorOfStudentGroup.DoesNotExist:
            return False
    
    @database_sync_to_async
    def save_message(self, message):
        """Save a chat message to the database."""
        if not self.user or not getattr(self.user, "is_authenticated", False):
            return None

        user_type = getattr(self.user, "user_type", None)
        if not user_type:
            return None

        try:
            group = SupervisorOfStudentGroup.objects.get(id=self.group_id)
            
            student = None
            supervisor = None
            sent_by = None
            sender_username = getattr(self.user, "username", "")
            sender_id = None
            
            if user_type == "student":
                student = Student.objects.get(user=self.user)
                sent_by = "student"
                sender_id = student.id
            elif user_type == "supervisor":
                supervisor = Supervisor.objects.get(user=self.user)
                sent_by = "supervisor"
                sender_id = supervisor.id
            
            chat_message = ChatRoom.objects.create(
                group=group,
                student=student,
                supervisor=supervisor,
                message=message,
                sent_by=sent_by,
            )
            
            return {
                "id": chat_message.id,
                "message": chat_message.message,
                "sent_by": chat_message.sent_by,
                "sender_username": sender_username,
                "sender_id": sender_id,
                "created_at": chat_message.created_at.isoformat(),
            }
        except Exception as e:
            print(f"Error saving message: {e}")
            return None
