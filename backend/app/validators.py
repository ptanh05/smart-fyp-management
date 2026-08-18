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


def validate_uploaded_file(file_obj):
    """
    Validate uploaded files for:
    - Maximum file size (25MB)
    - Safe file extension (pdf, doc, docx, ppt, pptx, zip, rar, xls, xlsx, txt)
    - Path safety / double extension checks
    - Content-based magic bytes & binary signature inspection
    """
    if not file_obj:
        return file_obj

    # 1. File Size Check (25 MB max)
    MAX_SIZE = 25 * 1024 * 1024
    if file_obj.size > MAX_SIZE:
        raise serializers.ValidationError("File size exceeds maximum limit of 25MB.")

    # 2. Extension Check
    ALLOWED_EXTENSIONS = {".pdf", ".doc", ".docx", ".ppt", ".pptx", ".zip", ".rar", ".xls", ".xlsx", ".txt"}
    import os
    ext = os.path.splitext(file_obj.name)[1].lower()
    
    if ext not in ALLOWED_EXTENSIONS:
        raise serializers.ValidationError(
            f"File extension '{ext}' is not allowed. Allowed types: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    # 3. Path traversal / Double extension check
    base_name = os.path.basename(file_obj.name)
    if ".." in base_name or "/" in base_name or "\\" in base_name:
        raise serializers.ValidationError("Invalid file name.")

    # 4. Read header bytes for Magic Byte Inspection
    try:
        if hasattr(file_obj, "seek"):
            file_obj.seek(0)
        header = file_obj.read(2048) if hasattr(file_obj, "read") else b""
        if hasattr(file_obj, "seek"):
            file_obj.seek(0)
    except Exception:
        raise serializers.ValidationError("Unable to read file content.")

    if not header:
        if ext != ".txt":
            raise serializers.ValidationError("File content is empty.")
        return file_obj

    # Explicitly block known executable / binary payload signatures regardless of extension
    BLOCKED_MAGIC_SIGNATURES = [
        b"MZ",                     # Windows PE Executable / DLL
        b"\x7fELF",                # Linux ELF Executable
        b"\xca\xfe\xba\xbe",        # Mach-O / Java Class File
        b"\xfe\xed\xfa\xce",        # Mach-O 32-bit
        b"\xfe\xed\xfa\xcf",        # Mach-O 64-bit
    ]
    for sig in BLOCKED_MAGIC_SIGNATURES:
        if header.startswith(sig):
            raise serializers.ValidationError("Executable or malicious file binary content detected.")

    # Magic byte validation per extension
    if ext == ".pdf":
        if not header.startswith(b"%PDF-"):
            raise serializers.ValidationError("Invalid PDF file header. File content does not match .pdf format.")

    elif ext in [".zip", ".docx", ".xlsx", ".pptx"]:
        # ZIP archive signature (PK\x03\x04 or PK\x05\x06 or PK\x07\x08)
        if not (header.startswith(b"PK\x03\x04") or header.startswith(b"PK\x05\x06") or header.startswith(b"PK\x07\x08")):
            raise serializers.ValidationError(f"Invalid file header for '{ext}'. File content is not a valid ZIP-compressed document.")

        if ext == ".zip":
            import zipfile
            try:
                if hasattr(file_obj, "seek"):
                    file_obj.seek(0)
                if zipfile.is_zipfile(file_obj):
                    file_obj.seek(0)
                    with zipfile.ZipFile(file_obj) as zf:
                        total_uncompressed = 0
                        max_uncompressed_limit = 200 * 1024 * 1024  # 200 MB
                        for info in zf.infolist():
                            if ".." in info.filename or info.filename.startswith("/") or info.filename.startswith("\\"):
                                raise serializers.ValidationError("Archive contains unsafe file path entry.")
                            total_uncompressed += info.file_size
                            if total_uncompressed > max_uncompressed_limit:
                                raise serializers.ValidationError("Decompressed archive size exceeds maximum safety limit (Zip Bomb detected).")
                if hasattr(file_obj, "seek"):
                    file_obj.seek(0)
            except serializers.ValidationError:
                raise
            except Exception:
                pass

    elif ext in [".doc", ".xls", ".ppt"]:
        # OLE Compound File signature: \xd0\xcf\11\xe0\xa1\xb1\x1a\xe1
        OLE_HEADER = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"
        if not header.startswith(OLE_HEADER):
            raise serializers.ValidationError(f"Invalid binary header for '{ext}'. File content does not match Microsoft Office legacy format.")

    elif ext == ".rar":
        # RAR signature: Rar!\x1a\x07 (v4 or v5)
        if not header.startswith(b"Rar!\x1a\x07"):
            raise serializers.ValidationError("Invalid RAR file header. File content does not match .rar format.")

    elif ext == ".txt":
        # Check text file for binary null bytes or non-text control characters
        if b"\x00" in header:
            raise serializers.ValidationError("Binary content detected in text file.")
        
        # Check UTF-8 / text decodability
        try:
            sample_text = header.decode("utf-8")
        except UnicodeDecodeError:
            try:
                sample_text = header.decode("latin-1")
            except Exception:
                raise serializers.ValidationError("Invalid text encoding.")
        
        # Reject if text contains high ratio of non-printable control characters
        non_printable = sum(1 for char in sample_text if ord(char) < 32 and char not in "\n\r\t\f")
        if len(sample_text) > 0 and (non_printable / len(sample_text)) > 0.05:
            raise serializers.ValidationError("Binary content detected in text file.")

    return file_obj
