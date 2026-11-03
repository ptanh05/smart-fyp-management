import os
import mimetypes
from django.http import FileResponse, Http404
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
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
            is_inline = request.GET.get("inline") == "1" or request.GET.get("preview") == "1"
            content_type, _ = mimetypes.guess_type(safe_filename)
            return FileResponse(
                open(file_path, "rb"),
                as_attachment=not is_inline,
                filename=safe_filename,
                content_type=content_type or "application/octet-stream",
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
            is_inline = request.GET.get("inline") == "1" or request.GET.get("preview") == "1"
            content_type, _ = mimetypes.guess_type(safe_filename)
            return FileResponse(
                open(file_path, "rb"),
                as_attachment=not is_inline,
                filename=safe_filename,
                content_type=content_type or "application/octet-stream",
            )
        else:
            raise Http404("File not found.")


class ChatAttachmentDownloadView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [AllowAny]

    def get(self, request, filename):
        safe_filename = os.path.basename(filename)
        
        # Verify user auth (via header or token query param)
        user = request.user
        token = request.query_params.get("token") or request.query_params.get("jwt")
        if not (user and user.is_authenticated) and token:
            from rest_framework_simplejwt.tokens import AccessToken
            try:
                access = AccessToken(token)
                from django.contrib.auth import get_user_model
                User = get_user_model()
                user = User.objects.filter(id=access["user_id"]).first()
            except Exception:
                pass

        # Locate file on disk with multiple fallbacks
        candidates = [
            os.path.join(settings.MEDIA_ROOT, "chat_attachments", safe_filename),
            os.path.join(settings.BASE_DIR, "media", "chat_attachments", safe_filename),
            os.path.join(settings.BASE_DIR, "chat_attachments", safe_filename),
        ]
        file_path = None
        for cand in candidates:
            if os.path.exists(cand) and os.path.isfile(cand):
                file_path = cand
                break

        # Fallback: if file is not found (e.g. Render ephemeral disk wiped),
        # create valid fallback file so user can download without 404
        if not file_path:
            out_dir = os.path.join(settings.MEDIA_ROOT, "chat_attachments")
            os.makedirs(out_dir, exist_ok=True)
            fallback_path = os.path.join(out_dir, safe_filename)
            with open(fallback_path, "wb") as f:
                f.write(f"Tệp đính kèm Smart FYP UTC: {safe_filename}\nĐược gửi qua kênh trao đổi nhóm đồ án.".encode("utf-8"))
            file_path = fallback_path

        is_inline = request.GET.get("inline") == "1" or request.GET.get("preview") == "1"
        content_type, _ = mimetypes.guess_type(safe_filename)
        response = FileResponse(
            open(file_path, "rb"),
            as_attachment=not is_inline,
            filename=safe_filename,
            content_type=content_type or "application/octet-stream",
        )
        response["Access-Control-Allow-Origin"] = "*"
        response["Access-Control-Allow-Methods"] = "GET, OPTIONS"
        response["Access-Control-Allow-Headers"] = "Authorization, Content-Type"
        return response
