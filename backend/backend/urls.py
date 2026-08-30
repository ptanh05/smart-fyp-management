from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from .project_views import DocumentDownloadView, SRSTemplateDownloadView

def health_check(request):
    return JsonResponse({"status": "ok", "service": "Smart FYP Management API"})

urlpatterns = [
    path("", health_check, name="health-check"),
    path("admin/", admin.site.urls),
    path("app/", include("app.urls")),
    path("api/", include("app.urls")),
    path(
        "documents/<str:filename>/",
        DocumentDownloadView.as_view(),
        name="document-download",
    ),
    path(
        "doc_templates/<str:filename>/",
        SRSTemplateDownloadView.as_view(),
        name="template-download",
    ),
]
