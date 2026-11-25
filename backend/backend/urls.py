import os

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
from app.openapi_docs import make_schema_view, make_swagger_docs_view

def health_check(request):
    render_commit = os.environ.get("RENDER_GIT_COMMIT", "")
    return JsonResponse({
        "status": "ok",
        "service": "Smart FYP Management API",
        "version": render_commit[:7] if render_commit else "local",
        "workflow_stage_guard": "project-aware-v2",
    })

urlpatterns = [
    path("", health_check, name="health-check"),
    path("api/schema/", make_schema_view("Smart FYP UTC — Portal API", "API Cổng Sinh viên, Giảng viên & Hội đồng"), name="api-schema"),
    path("api/docs/", make_swagger_docs_view("Smart FYP UTC — Portal API", "/api/schema/"), name="api-docs"),
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
