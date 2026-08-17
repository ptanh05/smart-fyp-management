"""
Input validation and sanitization utilities.

This module provides validators for:
- Text length limits
- HTML/XSS sanitization
- Content validation
"""

import re
import html
from django.core.exceptions import ValidationError
from rest_framework import serializers


# =============================================================================
# Constants - Maximum lengths for various text fields
# =============================================================================

MAX_CHAT_MESSAGE_LENGTH = 2000
MAX_COMMENT_LENGTH = 1000
MAX_PROJECT_NAME_LENGTH = 200
MAX_PROJECT_DESCRIPTION_LENGTH = 5000
MAX_FUNCTIONALITIES_LENGTH = 3000
MAX_EVALUATION_COMMENT_LENGTH = 500
MAX_TITLE_LENGTH = 200


# =============================================================================
# HTML Sanitization
# =============================================================================

# HTML tags pattern for detection
HTML_TAG_PATTERN = re.compile(r'<[^>]+>')

# Script tags pattern (more dangerous)
SCRIPT_PATTERN = re.compile(r'<script[^>]*>.*?</script>', re.IGNORECASE | re.DOTALL)

# Event handlers pattern (onclick, onload, etc.)
EVENT_HANDLER_PATTERN = re.compile(r'\s+on\w+\s*=', re.IGNORECASE)

# JavaScript URL pattern
JS_URL_PATTERN = re.compile(r'javascript:', re.IGNORECASE)


def sanitize_html(text: str) -> str:
    """
    Sanitize text by escaping HTML entities.
    This prevents XSS attacks by converting HTML special characters to their entity equivalents.
    
    Args:
        text: The input text to sanitize
        
    Returns:
        Sanitized text with HTML entities escaped
    """
    if not text:
        return text
    
    # Escape HTML entities
    sanitized = html.escape(text)
    
    return sanitized


def strip_html_tags(text: str) -> str:
    """
    Remove all HTML tags from text.
    
    Args:
        text: The input text to clean
        
    Returns:
        Text with all HTML tags removed
    """
    if not text:
        return text
    
    # Remove script tags and their content first
    text = SCRIPT_PATTERN.sub('', text)
    
    # Remove all other HTML tags
    text = HTML_TAG_PATTERN.sub('', text)
    
    # Decode HTML entities to get clean text
    text = html.unescape(text)
    
    return text.strip()


def contains_dangerous_content(text: str) -> bool:
    """
    Check if text contains potentially dangerous content (scripts, event handlers, etc.)
    
    Args:
        text: The text to check
        
    Returns:
        True if dangerous content is detected
    """
    if not text:
        return False
    
    # Check for script tags
    if SCRIPT_PATTERN.search(text):
        return True
    
    # Check for event handlers
    if EVENT_HANDLER_PATTERN.search(text):
        return True
    
    # Check for JavaScript URLs
    if JS_URL_PATTERN.search(text):
        return True
    
    return False


# =============================================================================
# DRF Serializer Validators
# =============================================================================

def validate_no_html(value: str) -> str:
    """
    Validator that strips HTML tags and checks for dangerous content.
    Use this in serializer field validators.
    """
    if not value:
        return value
    
    # Check for dangerous content
    if contains_dangerous_content(value):
        raise serializers.ValidationError(
            "Content contains potentially dangerous elements (scripts, event handlers). "
            "Please remove any HTML or JavaScript code."
        )
    
    # Strip HTML tags
    cleaned = strip_html_tags(value)
    
    return cleaned


def validate_chat_message(value: str) -> str:
    """
    Validate and sanitize chat messages.
    """
    if not value:
        raise serializers.ValidationError("Message cannot be empty.")
    
    # Strip HTML
    value = validate_no_html(value)
    
    # Check length
    if len(value) > MAX_CHAT_MESSAGE_LENGTH:
        raise serializers.ValidationError(
            f"Message is too long. Maximum length is {MAX_CHAT_MESSAGE_LENGTH} characters. "
            f"Your message has {len(value)} characters."
        )
    
    # Check if message is not just whitespace
    if not value.strip():
        raise serializers.ValidationError("Message cannot be empty or only whitespace.")
    
    return value.strip()


def validate_comment(value: str) -> str:
    """
    Validate and sanitize comments.
    """
    if not value:
        raise serializers.ValidationError("Comment cannot be empty.")
    
    # Strip HTML
    value = validate_no_html(value)
    
    # Check length
    if len(value) > MAX_COMMENT_LENGTH:
        raise serializers.ValidationError(
            f"Comment is too long. Maximum length is {MAX_COMMENT_LENGTH} characters. "
            f"Your comment has {len(value)} characters."
        )
    
    # Check if comment is not just whitespace
    if not value.strip():
        raise serializers.ValidationError("Comment cannot be empty or only whitespace.")
    
    return value.strip()


def validate_project_name(value: str) -> str:
    """
    Validate and sanitize project names.
    """
    if not value:
        raise serializers.ValidationError("Project name cannot be empty.")
    
    # Strip HTML
    value = validate_no_html(value)
    
    # Check length
    if len(value) > MAX_PROJECT_NAME_LENGTH:
        raise serializers.ValidationError(
            f"Project name is too long. Maximum length is {MAX_PROJECT_NAME_LENGTH} characters."
        )
    
    return value.strip()


def validate_project_description(value: str) -> str:
    """
    Validate and sanitize project descriptions.
    """
    if not value:
        raise serializers.ValidationError("Project description cannot be empty.")
    
    # Strip HTML
    value = validate_no_html(value)
    
    # Check length
    if len(value) > MAX_PROJECT_DESCRIPTION_LENGTH:
        raise serializers.ValidationError(
            f"Project description is too long. Maximum length is {MAX_PROJECT_DESCRIPTION_LENGTH} characters. "
            f"Your description has {len(value)} characters."
        )
    
    return value.strip()


def validate_functionalities(value: str) -> str:
    """
    Validate and sanitize project functionalities.
    """
    if not value:
        raise serializers.ValidationError("Functionalities cannot be empty.")
    
    # Strip HTML
    value = validate_no_html(value)
    
    # Check length
    if len(value) > MAX_FUNCTIONALITIES_LENGTH:
        raise serializers.ValidationError(
            f"Functionalities text is too long. Maximum length is {MAX_FUNCTIONALITIES_LENGTH} characters. "
            f"Your text has {len(value)} characters."
        )
    
    return value.strip()


def validate_evaluation_comment(value: str) -> str:
    """
    Validate and sanitize evaluation comments (optional field).
    """
    if not value:
        return value
    
    # Strip HTML
    value = validate_no_html(value)
    
    # Check length
    if len(value) > MAX_EVALUATION_COMMENT_LENGTH:
        raise serializers.ValidationError(
            f"Comment is too long. Maximum length is {MAX_EVALUATION_COMMENT_LENGTH} characters. "
            f"Your comment has {len(value)} characters."
        )
    
    return value.strip()


def validate_title(value: str) -> str:
    """
    Validate and sanitize document/template titles.
    """
    if not value:
        raise serializers.ValidationError("Title cannot be empty.")
    
    # Strip HTML
    value = validate_no_html(value)
    
    # Check length
    if len(value) > MAX_TITLE_LENGTH:
        raise serializers.ValidationError(
            f"Title is too long. Maximum length is {MAX_TITLE_LENGTH} characters."
        )
    
    return value.strip()


# =============================================================================
# Django Model Validators (for use in models.py if needed)
# =============================================================================

def model_validate_max_length(max_length: int):
    """
    Factory function to create a max length validator for models.
    
    Usage in models:
        comment = models.TextField(validators=[model_validate_max_length(1000)])
    """
    def validator(value):
        if value and len(value) > max_length:
            raise ValidationError(
                f"This field cannot exceed {max_length} characters. "
                f"Current length: {len(value)} characters."
            )
    return validator


def model_validate_no_html(value: str):
    """
    Model validator that checks for dangerous HTML content.
    
    Usage in models:
        comment = models.TextField(validators=[model_validate_no_html])
    """
    if value and contains_dangerous_content(value):
        raise ValidationError(
            "Content contains potentially dangerous elements. "
            "Please remove any HTML or JavaScript code."
        )
