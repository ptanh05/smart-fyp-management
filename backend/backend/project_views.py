from django.http import FileResponse, Http404
import os
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication


class DocumentDownloadView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, filename):
        # Prevent path traversal attacks by getting basename only
        safe_filename = os.path.basename(filename)
        file_path = os.path.join(settings.MEDIA_ROOT, "documents", safe_filename)
        
        # Verify canonical path is inside media directory
        media_documents_dir = os.path.abspath(os.path.join(settings.MEDIA_ROOT, "documents"))
        if not os.path.abspath(file_path).startswith(media_documents_dir):
            raise Http404("File not found.")

        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(
                open(file_path, "rb"), as_attachment=True, filename=safe_filename
            )
        else:
            raise Http404("File not found.")


class SRSTemplateDownloadView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, filename):
        safe_filename = os.path.basename(filename)
        file_path = os.path.join(settings.MEDIA_ROOT, "doc_templates", safe_filename)
        
        media_templates_dir = os.path.abspath(os.path.join(settings.MEDIA_ROOT, "doc_templates"))
        if not os.path.abspath(file_path).startswith(media_templates_dir):
            raise Http404("File not found.")

        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(
                open(file_path, "rb"), as_attachment=True, filename=safe_filename
            )
        else:
            raise Http404("File not found.")
