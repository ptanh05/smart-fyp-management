from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
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
    path(
        "documents/<str:filename>/",
        DocumentSecureDownloadView.as_view(),
        name="document-download",
    ),
    path(
        "doc_templates/<str:filename>/",
        TemplateSecureDownloadView.as_view(),
        name="template-download",
    ),
    path(
        "media/<path:file_path>",
        SecureMediaDownloadView.as_view(),
        name="media-download",
    ),
]
