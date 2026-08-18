"""
WebSocket authentication middleware for Django Channels.

This middleware handles JWT authentication for WebSocket connections.
"""

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from urllib.parse import parse_qs

from app.models import CustomUser


@database_sync_to_async
def get_user_from_token(token_str):
    """
    Validate JWT token and return the associated user.
    Returns AnonymousUser if token is invalid.
    """
    try:
        # Validate the token
        access_token = AccessToken(token_str)
        user_id = access_token["user_id"]
        
        # Get the user from database
        user = CustomUser.objects.get(id=user_id)
        return user
    except (InvalidToken, TokenError, CustomUser.DoesNotExist, KeyError):
        return AnonymousUser()


@database_sync_to_async
def get_user_from_ticket(ticket_str):
    """
    Validate one-time WebSocket ticket from cache, consume it (single-use),
    and return the associated user and bound group_id.
    """
    from django.core.cache import cache
    ticket_key = f"ws_ticket_{ticket_str}"
    ticket_data = cache.get(ticket_key)
    if not ticket_data:
        return AnonymousUser(), None
    
    # Single-use enforcement: immediately consume and delete ticket
    cache.delete(ticket_key)
    user_id = ticket_data.get("user_id")
    group_id = ticket_data.get("group_id")
    try:
        user = CustomUser.objects.get(id=user_id)
        return user, group_id
    except CustomUser.DoesNotExist:
        return AnonymousUser(), None


class JWTAuthMiddleware(BaseMiddleware):
    """
    Custom middleware that authenticates WebSocket connections using short-lived 
    one-time tickets or JWT tokens.
    """
    
    async def __call__(self, scope, receive, send):
        # Get query string parameters
        query_string = scope.get("query_string", b"").decode()
        query_params = parse_qs(query_string)
        
        ticket_list = query_params.get("ticket", [])
        ticket = ticket_list[0] if ticket_list else None
        
        token_list = query_params.get("token", [])
        token = token_list[0] if token_list else None
        
        if ticket:
            user, ticket_group_id = await get_user_from_ticket(ticket)
            scope["user"] = user
            scope["ticket_group_id"] = ticket_group_id
        elif token:
            scope["user"] = await get_user_from_token(token)
        else:
            scope["user"] = AnonymousUser()
        
        return await super().__call__(scope, receive, send)


class QueryAuthMiddleware(BaseMiddleware):
    """
    Alternative middleware that only checks for authentication without blocking.
    Useful if you want to allow anonymous connections with limited functionality.
    """
    
    async def __call__(self, scope, receive, send):
        query_string = scope.get("query_string", b"").decode()
        query_params = parse_qs(query_string)
        
        token_list = query_params.get("token", [])
        token = token_list[0] if token_list else None
        
        # Set user (authenticated or anonymous)
        scope["user"] = await get_user_from_token(token) if token else AnonymousUser()
        
        # Add authentication status to scope
        scope["is_authenticated"] = not isinstance(scope["user"], AnonymousUser)
        
        return await super().__call__(scope, receive, send)
