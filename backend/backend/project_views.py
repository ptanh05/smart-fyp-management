from django.http import FileResponse, Http404
import os
from django.conf import settings
from rest_framework.views import APIView


class DocumentDownloadView(APIView):
    # permission_classes = [IsAuthenticated]

    def get(self, request, filename):
        file_path = os.path.join(settings.MEDIA_ROOT, "documents", filename)
        if os.path.exists(file_path):
            return FileResponse(
                open(file_path, "rb"), as_attachment=True, filename=filename
            )
        else:
            raise Http404("File not found.")


class SRSTemplateDownloadView(APIView):
    # permission_classes = [IsAuthenticated]

    def get(self, request, filename):
        file_path = os.path.join(settings.MEDIA_ROOT, "doc_templates", filename)
        if os.path.exists(file_path):
            return FileResponse(
                open(file_path, "rb"), as_attachment=True, filename=filename
            )
        else:
            raise Http404("File not found.")
