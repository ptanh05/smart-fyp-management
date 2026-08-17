"""
Custom throttle classes for rate limiting sensitive endpoints.

This module provides specific throttle classes for:
- Login attempts: Prevent brute-force attacks
- Password reset requests: Prevent abuse of password reset functionality
"""

from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


class LoginRateThrottle(AnonRateThrottle):
    """
    Throttle class for login endpoints.
    Limits login attempts to prevent brute-force attacks.
    Uses the 'login' rate defined in settings.
    """
    scope = "login"


class PasswordResetRateThrottle(AnonRateThrottle):
    """
    Throttle class for password reset requests.
    Limits password reset attempts to prevent abuse.
    Uses the 'password_reset' rate defined in settings.
    """
    scope = "password_reset"


class BurstRateThrottle(UserRateThrottle):
    """
    Throttle class for burst traffic control.
    Allows a limited number of requests in a short time window.
    Useful for preventing rapid-fire requests.
    """
    scope = "burst"
    rate = "30/minute"  # 30 requests per minute for authenticated users


class SustainedRateThrottle(UserRateThrottle):
    """
    Throttle class for sustained traffic control.
    Allows a higher number of requests over a longer time window.
    """
    scope = "sustained"
    rate = "500/hour"  # 500 requests per hour for authenticated users
