import logging
import re
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from django.conf import settings
from django.db.models import Q
from .models import CustomUser, Student, Supervisor, AuditLog
from .views import get_tokens_for_user, set_refresh_cookie
from .throttles import LoginRateThrottle

logger = logging.getLogger(__name__)


class GoogleSSOLoginAPIView(APIView):
    """
    UTC Single Sign-On via Google OAuth2.
    Verifies Google ID Token, enforces UTC email domain (@utc.edu.vn or configured domains),
    authenticates or links the user, and issues JWT + HttpOnly refresh cookie.
    """
    permission_classes = [AllowAny]
    throttle_classes = [LoginRateThrottle]

    def post(self, request):
        credential = request.data.get("credential") or request.data.get("token") or request.data.get("id_token")
        test_email = request.data.get("email")  # Allowed in DEBUG/dev environment

        email = None
        first_name = ""
        last_name = ""

        if credential:
            # Verify Google ID Token
            try:
                from google.oauth2 import id_token
                from google.auth.transport import requests as google_requests

                client_id = getattr(settings, "GOOGLE_OAUTH_CLIENT_ID", "") or None
                id_info = id_token.verify_oauth2_token(
                    credential,
                    google_requests.Request(),
                    client_id
                )
                email = id_info.get("email", "").strip().lower()
                first_name = id_info.get("given_name", "")
                last_name = id_info.get("family_name", "")
            except Exception as e:
                logger.warning("[SSO_GOOGLE] Token verification via google-auth failed: %s, trying tokeninfo...", e)
                import urllib.request
                import json
                try:
                    url = f"https://oauth2.googleapis.com/tokeninfo?id_token={credential}"
                    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
                    with urllib.request.urlopen(req, timeout=5) as resp:
                        data = json.loads(resp.read().decode())
                        email = data.get("email", "").strip().lower()
                        first_name = data.get("given_name", "")
                        last_name = data.get("family_name", "")
                except Exception as inner_e:
                    logger.error("[SSO_GOOGLE] Tokeninfo fallback failed: %s", inner_e)
                    return Response({
                        "detail": "Mã xác thực Google không hợp lệ hoặc đã hết hạn.",
                        "error": str(e)
                    }, status=status.HTTP_400_BAD_REQUEST)
        elif test_email and (
            getattr(settings, "DEBUG", False)
            or any(h in request.get_host() for h in ["localhost", "127.0.0.1", "testserver"])
            or "test" in sys.argv
        ):
            # Development mode direct email SSO simulation
            email = test_email.strip().lower()
            first_name = "UTC"
            last_name = "Member"
        else:
            return Response({
                "detail": "Vui lòng cung cấp mã xác thực Google OAuth (credential)."
            }, status=status.HTTP_400_BAD_REQUEST)

        if not email or "@" not in email:
            return Response({
                "detail": "Không thể lấy thông tin email từ tài khoản Google."
            }, status=status.HTTP_400_BAD_REQUEST)

        # Domain verification
        domain = email.split("@")[1].lower()
        allowed_domains = getattr(settings, "ALLOWED_SSO_DOMAINS", ["utc.edu.vn", "gmail.com"])
        if allowed_domains and domain not in allowed_domains and "*" not in allowed_domains:
            return Response({
                "detail": f"Email '{email}' không thuộc tên miền được phép của Trường Đại học Giao thông Vận tải (@utc.edu.vn)."
            }, status=status.HTTP_403_FORBIDDEN)

        # User identification
        username_candidate = email.split("@")[0]
        user = CustomUser.objects.filter(
            Q(email__iexact=email) | Q(username__iexact=username_candidate)
        ).first()

        # If user not found, try finding Student by registration_no
        if not user:
            student = Student.objects.filter(
                Q(registration_no__iexact=username_candidate) | Q(user__email__iexact=email)
            ).first()
            if student:
                user = student.user
                if not user.email:
                    user.email = email
                    user.save(update_fields=["email"])

        # If user still not found, try Supervisor
        if not user:
            supervisor = Supervisor.objects.filter(
                Q(user__email__iexact=email) | Q(user__username__iexact=username_candidate)
            ).first()
            if supervisor:
                user = supervisor.user

        # If user still not found, auto-link or auto-provision student
        if not user:
            is_student_code = bool(re.match(r"^\d{6,10}$", username_candidate))
            user_type = "student" if is_student_code else "student"
            user = CustomUser.objects.create_user(
                username=username_candidate,
                email=email,
                first_name=first_name or username_candidate,
                last_name=last_name or "",
                user_type=user_type,
                is_active=True
            )
            if user_type == "student":
                Student.objects.create(
                    user=user,
                    registration_no=username_candidate,
                    education_program="ENGINEER" if "k" in username_candidate.lower() else "BACHELOR"
                )

        if not user.is_active:
            return Response({
                "detail": "Tài khoản của bạn đã bị khóa hoặc chưa được kích hoạt."
            }, status=status.HTTP_403_FORBIDDEN)

        # Audit Log
        try:
            AuditLog.objects.create(
                user=user,
                action_type="LOGIN",
                description=f"Đăng nhập thành công qua UTC SSO (Google): {email}"
            )
        except Exception:
            pass

        # Generate JWT Tokens
        token_data = get_tokens_for_user(user)
        refresh_token = token_data.get("refresh")

        user_info = {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "user_type": user.user_type,
            "full_name": user.get_full_name() or user.username,
        }

        response = Response({
            "access": token_data.get("access"),
            "expire_time": token_data.get("expire_time"),
            "user": user_info,
            "user_type": user.user_type,
            "message": f"Đăng nhập thành công với tài khoản {email}."
        }, status=status.HTTP_200_OK)

        set_refresh_cookie(response, refresh_token)
        return response
