"""
Legacy download views in backend/project_views.py.
Refactored to enforce SecureMediaDownloadView authentication, RBAC authorization,
and Cloudflare R2 / AWS S3 storage compatibility.
"""
from app.views_media import (
    SecureMediaDownloadView,
    DocumentSecureDownloadView,
    TemplateSecureDownloadView,
)


class DocumentDownloadView(DocumentSecureDownloadView):
    """
    Secure download for documents/ subfolder.
    Enforces JWT authentication and supports Cloudflare R2 / AWS S3 storage.
    """
    pass


class SRSTemplateDownloadView(TemplateSecureDownloadView):
    """
    Secure download for doc_templates/ subfolder.
    Enforces JWT authentication and supports Cloudflare R2 / AWS S3 storage.
    """
    pass


class ChatAttachmentDownloadView(SecureMediaDownloadView):
    """
    Secure download for chat_attachments/ subfolder.
    Enforces JWT authentication and RBAC group permission checks.
    Supports Cloudflare R2 / AWS S3 storage.
    """
    subfolder = "chat_attachments"
