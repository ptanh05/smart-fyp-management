"""
Secure Media and Document Download Views with Signed URL / Media Token support.
Ensures document files are never exposed to unauthorized or anonymous incognito sessions.
"""
import os
import mimetypes
from django.conf import settings
from django.http import FileResponse, Http404, JsonResponse
from django.core.signing import TimestampSigner, BadSignature, SignatureExpired
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework import status
from rest_framework.response import Response

signer = TimestampSigner(salt="utc-media-token")
MEDIA_TOKEN_MAX_AGE_SECONDS = 900  # 15 minutes


def generate_media_token(user_id, file_path):
    """Generate a signed, tamper-proof token for media download with 15-minute validity."""
    norm_path = os.path.normpath(file_path).replace("\\", "/")
    value = f"{user_id}:{norm_path}"
    return signer.sign(value)


def verify_media_token(token, file_path):
    """
    Verify signed media token.
    Returns user_id if valid, None if invalid or expired.
    """
    norm_path = os.path.normpath(file_path).replace("\\", "/")
    try:
        unsigned_value = signer.unsign(token, max_age=MEDIA_TOKEN_MAX_AGE_SECONDS)
        parts = unsigned_value.split(":", 1)
        if len(parts) == 2 and parts[1] == norm_path:
            return parts[0]
    except (BadSignature, SignatureExpired):
        return None
    return None


class GetSignedMediaUrlAPIView(APIView):
    """
    Endpoint for authenticated clients to obtain a short-lived Signed URL / Media Token
    for downloading or opening files in browser tabs.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        file_path = request.query_params.get("file_path", "").strip().lstrip("/")
        if not file_path:
            return Response({"detail": "Thiếu tham số file_path."}, status=status.HTTP_400_BAD_REQUEST)

        # Sanitize file path
        norm_path = os.path.normpath(file_path).replace("\\", "/")
        if norm_path.startswith("..") or os.path.isabs(norm_path):
            return Response({"detail": "Đường dẫn tệp không hợp lệ."}, status=status.HTTP_400_BAD_REQUEST)

        token = generate_media_token(request.user.id, norm_path)
        download_url = f"/api/media/download/{norm_path}?token={token}"

        return Response({
            "file_path": norm_path,
            "signed_url": download_url,
            "token": token,
            "expires_in": MEDIA_TOKEN_MAX_AGE_SECONDS,
        }, status=status.HTTP_200_OK)


class SecureMediaDownloadView(APIView):
    """
    Unified secure media download handler:
    1. Rejects unauthenticated/anonymous requests (e.g. Incognito browser without login or token).
    2. Accepts:
       - Header 'Authorization: Bearer <jwt_token>'
       - Query parameter '?token=<signed_media_token>'
    3. Verifies file path boundaries (prevents directory traversal).
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [AllowAny]

    subfolder = None  # Can be overridden by subclasses or url kwargs

    def get(self, request, file_path=None, filename=None):
        raw_path = file_path or filename or ""
        if self.subfolder and filename:
            raw_path = os.path.join(self.subfolder, filename)
        
        # Normalize and sanitize file path
        safe_rel_path = os.path.normpath(raw_path.lstrip("/")).replace("\\", "/")
        if safe_rel_path.startswith("..") or os.path.isabs(safe_rel_path):
            return Response({"detail": "Đường dẫn không hợp lệ."}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Check Authentication:
        # Either request.user is authenticated (JWT in header / session) OR query token is valid
        is_authenticated = request.user and request.user.is_authenticated

        if not is_authenticated:
            # Check for ?token= query parameter
            query_token = request.query_params.get("token")
            if query_token:
                user_id = verify_media_token(query_token, safe_rel_path)
                if user_id:
                    is_authenticated = True
                else:
                    return Response(
                        {"detail": "Liên kết tải tệp hoặc mã xác thực (Media Token) đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại."},
                        status=status.HTTP_401_UNAUTHORIZED
                    )

        if not is_authenticated:
            return Response(
                {"detail": "Yêu cầu xác thực phiên đăng nhập. Vui lòng đăng nhập để tải tài liệu."},
                status=status.HTTP_401_UNAUTHORIZED
            )

        # 2. Locate File inside MEDIA_ROOT or fallback BASE_DIR subfolders
        full_path = os.path.abspath(os.path.join(settings.MEDIA_ROOT, safe_rel_path))
        media_root_abs = os.path.abspath(settings.MEDIA_ROOT)
        
        # Check if file is in settings.MEDIA_ROOT
        file_found = os.path.exists(full_path) and os.path.isfile(full_path)
        
        # Fallback check in BASE_DIR if stored before MEDIA_ROOT setting
        if not file_found:
            base_full_path = os.path.abspath(os.path.join(settings.BASE_DIR, safe_rel_path))
            if os.path.exists(base_full_path) and os.path.isfile(base_full_path):
                # Ensure it is in an allowed media directory
                allowed_subdirs = ["documents", "doc_templates", "outlines", "weekly_reports", "bug_reports"]
                first_part = safe_rel_path.split(os.sep)[0].split("/")[0]
                if first_part in allowed_subdirs:
                    full_path = base_full_path
                    file_found = True

        if not file_found:
            raise Http404("Tệp tin không tồn tại hoặc đã bị xóa.")

        # 3. Stream File
        filename = os.path.basename(full_path)
        content_type, _ = mimetypes.guess_type(full_path)
        response = FileResponse(
            open(full_path, "rb"),
            as_attachment=True,
            filename=filename,
            content_type=content_type or "application/octet-stream"
        )
        response["Cache-Control"] = "private, no-cache, no-store, must-revalidate"
        response["Pragma"] = "no-cache"
        return response


class DocumentSecureDownloadView(SecureMediaDownloadView):
    """Secure download for documents/ subfolder."""
    subfolder = "documents"


class TemplateSecureDownloadView(SecureMediaDownloadView):
    """Secure download for doc_templates/ subfolder."""
    subfolder = "doc_templates"
