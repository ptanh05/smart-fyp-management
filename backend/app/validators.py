"""
Input validation and sanitization utilities.

This module provides validators for:
- Text length limits
- HTML/XSS sanitization
- Content validation
"""

import re
import html
from typing import Any
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

def validate_no_html(value: str) -> Any:
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


def validate_chat_message(value: str) -> Any:
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


def validate_comment(value: str) -> Any:
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


def validate_project_name(value: str) -> Any:
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


def validate_project_description(value: str) -> Any:
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


def validate_functionalities(value: str) -> Any:
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


def validate_evaluation_comment(value: str) -> Any:
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


def validate_title(value: str) -> Any:
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


def validate_uploaded_file(file_obj, allowed_extensions=None, max_size_bytes=52428800):
    """
    Validate uploaded files at binary level:
    - Maximum file size (default 50MB)
    - Safe file extension check
    - Path safety / directory traversal checks
    - Content-based magic bytes & binary signature inspection
    - Strict rejection of executable binaries (PE/ELF/Mach-O) and script payloads
    """
    if not file_obj:
        return file_obj

    # 1. File Size Check (Default 50 MB)
    if hasattr(file_obj, "size") and file_obj.size > max_size_bytes:
        max_mb = max_size_bytes // (1024 * 1024)
        raise serializers.ValidationError(f"Kích thước tệp vượt quá giới hạn cho phép ({max_mb}MB).")

    # 2. Extension Check
    import os
    ext = os.path.splitext(file_obj.name)[1].lower() if file_obj.name else ""
    
    DEFAULT_ALLOWED_EXTENSIONS = {
        ".pdf", ".doc", ".docx", ".ppt", ".pptx",
        ".zip", ".rar", ".xls", ".xlsx", ".txt",
        ".png", ".jpg", ".jpeg", ".webp"
    }
    allowed = set(allowed_extensions) if allowed_extensions else DEFAULT_ALLOWED_EXTENSIONS

    if ext not in allowed:
        raise serializers.ValidationError(
            f"Định dạng tệp '{ext}' không được hỗ trợ. Các định dạng cho phép: {', '.join(sorted(allowed))}"
        )

    # 3. Path traversal / Double extension check
    base_name = os.path.basename(file_obj.name)
    if ".." in base_name or "/" in base_name or "\\" in base_name:
        raise serializers.ValidationError("Tên tệp không hợp lệ.")

    # 4. Read header bytes for Magic Byte Inspection
    header = b""
    try:
        if hasattr(file_obj, "seek"):
            file_obj.seek(0)
        header = file_obj.read(4096) if hasattr(file_obj, "read") else b""
        if hasattr(file_obj, "seek"):
            file_obj.seek(0)
    except Exception:
        raise serializers.ValidationError("Không thể đọc nội dung tệp tin.")

    if not header:
        if ext != ".txt":
            raise serializers.ValidationError("Nội dung tệp tin trống (0 bytes).")
        return file_obj

    # 5. Strictly block known executable / script binary signatures regardless of extension
    BLOCKED_MAGIC_SIGNATURES = [
        (b"MZ", "Windows Executable/DLL (.exe/.dll)"),
        (b"\x7fELF", "Linux/Unix ELF Executable"),
        (b"\xca\xfe\xba\xbe", "Java Class/Mach-O Binary"),
        (b"\xfe\xed\xfa\xce", "Mach-O 32-bit Binary"),
        (b"\xfe\xed\xfa\xcf", "Mach-O 64-bit Binary"),
        (b"\xce\xfa\xed\xfe", "Mach-O Reverse Endian"),
        (b"\xcf\xfa\xed\xfe", "Mach-O Reverse Endian 64-bit"),
        (b"#!", "Shell Script / Executable Script"),
        (b"MSCF", "Microsoft Cabinet File (.cab)"),
        (b"\x4c\x00\x00\x00", "Windows Shortcut (.lnk)"),
        (b"regf", "Windows Registry Hive"),
    ]
    for sig, desc in BLOCKED_MAGIC_SIGNATURES:
        if header.startswith(sig):
            raise serializers.ValidationError(
                f"Phát hiện tệp thực thi hoặc nhị phân nguy hiểm ({desc}). Hệ thống từ chối lưu trữ."
            )

    # Check for embedded script payloads disguised as documents
    header_lower = header.lower()
    if ext in [".pdf", ".doc", ".docx", ".ppt", ".pptx", ".txt"]:
        dangerous_script_tags = [b"<?php", b"<script", b"<html", b"<%"]
        for tag in dangerous_script_tags:
            if tag in header_lower[:512]:
                raise serializers.ValidationError(
                    "Tệp chứa mã kịch bản thực thi nguy hiểm (PHP/HTML/Script). Hệ thống từ chối lưu trữ."
                )

    # 6. Magic byte validation per extension using python-magic
    try:
        import magic
        mime_type = magic.from_buffer(header, mime=True)
        ALLOWED_MIME_TYPES = {
            '.pdf': ['application/pdf'],
            '.doc': ['application/msword', 'application/CDFV2'],
            '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip'],
            '.xls': ['application/vnd.ms-excel', 'application/CDFV2'],
            '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/zip'],
            '.ppt': ['application/vnd.ms-powerpoint', 'application/CDFV2'],
            '.pptx': ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/zip'],
            '.zip': ['application/zip'],
            '.rar': ['application/x-rar-compressed', 'application/vnd.rar'],
            '.txt': ['text/plain'],
            '.png': ['image/png'],
            '.jpg': ['image/jpeg'],
            '.jpeg': ['image/jpeg'],
            '.webp': ['image/webp'],
        }
        
        if ext in ALLOWED_MIME_TYPES:
            # magic can sometimes return slightly different mimes, but typically these are standard.
            if mime_type not in ALLOWED_MIME_TYPES[ext]:
                # Allow fallback for zip-based files if magic says application/zip but ext is docx/xlsx/pptx
                if not (mime_type == 'application/zip' and ext in ['.docx', '.xlsx', '.pptx']):
                    raise serializers.ValidationError(f"MIME type '{mime_type}' không khớp với định dạng tệp '{ext}' (Magic Bytes không hợp lệ).")
    except ImportError:
        # Fallback if python-magic is not installed correctly
        pass

    return file_obj


# Alias for backward and forward compatibility
validate_file_content = validate_uploaded_file
