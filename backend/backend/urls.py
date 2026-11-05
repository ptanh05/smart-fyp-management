from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from .project_views import (
    DocumentDownloadView,
    SRSTemplateDownloadView,
    ChatAttachmentDownloadView,
)
from app.views_media import (
    DocumentSecureDownloadView,
    TemplateSecureDownloadView,
    SecureMediaDownloadView,
)

def health_check(request):
    return JsonResponse({"status": "ok", "service": "Smart FYP Management API"})

urlpatterns = [
    path("", health_check, name="health-check"),
    path("admin/", admin.site.urls),
    path("app/", include("app.urls")),
    path("api/", include("app.urls")),
    path("api/v1/", include("app.urls")),

    # Secure document download routes (with and without trailing slash)
    path(
        "documents/<str:filename>/",
        DocumentSecureDownloadView.as_view(),
        name="document-download",
    ),
    path(
        "documents/<str:filename>",
        DocumentSecureDownloadView.as_view(),
        name="document-download-noslash",
    ),
    path(
        "media/documents/<str:filename>/",
        DocumentDownloadView.as_view(),
        name="media-document-download",
    ),
    path(
        "media/documents/<str:filename>",
        DocumentDownloadView.as_view(),
        name="media-document-download-noslash",
    ),

    # Secure SRS & template download routes (with and without trailing slash)
    path(
        "doc_templates/<str:filename>/",
        TemplateSecureDownloadView.as_view(),
        name="template-download",
    ),
    path(
        "doc_templates/<str:filename>",
        TemplateSecureDownloadView.as_view(),
        name="template-download-noslash",
    ),
    path(
        "media/doc_templates/<str:filename>/",
        SRSTemplateDownloadView.as_view(),
        name="media-template-download",
    ),
    path(
        "media/doc_templates/<str:filename>",
        SRSTemplateDownloadView.as_view(),
        name="media-template-download-noslash",
    ),

    # Secure chat attachment download routes (with and without trailing slash)
    path(
        "chat_attachments/<str:filename>/",
        ChatAttachmentDownloadView.as_view(),
        name="chat-attachment-download",
    ),
    path(
        "chat_attachments/<str:filename>",
        ChatAttachmentDownloadView.as_view(),
        name="chat-attachment-download-noslash",
    ),
    path(
        "media/chat_attachments/<str:filename>/",
        ChatAttachmentDownloadView.as_view(),
        name="media-chat-attachment-download",
    ),
    path(
        "media/chat_attachments/<str:filename>",
        ChatAttachmentDownloadView.as_view(),
        name="media-chat-attachment-download-noslash",
    ),

    # Universal direct media download
    path(
        "media/<path:file_path>",
        SecureMediaDownloadView.as_view(),
        name="media-download",
    ),
]
