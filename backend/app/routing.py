"""
WebSocket URL routing for Django Channels.

This module defines the WebSocket URL patterns for the application.
"""

from django.urls import re_path

from app.consumers import ChatConsumer

websocket_urlpatterns = [
    # Chat WebSocket endpoint
    # URL: ws://host/ws/chat/<group_id>/?token=<jwt_token>
    re_path(r"ws/chat/(?P<group_id>\d+)/$", ChatConsumer.as_asgi()),
]
