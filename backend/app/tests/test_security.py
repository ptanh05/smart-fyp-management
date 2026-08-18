import os
from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.conf import settings
from rest_framework.test import APIClient
from rest_framework import status, serializers
from app.models import (
    Student,
    Supervisor,
    CommitteeMember,
    CommitteeMemberPanel,
    ExternalExaminer,
)
from app.validators import validate_uploaded_file

User = get_user_model()


@override_settings(REST_FRAMEWORK={
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_THROTTLE_RATES': {
        'login': '10000/min',
        'user': '10000/min',
        'anon': '10000/min',
    }
})
class SecurityTestCase(TestCase):
    """
    Automated DevSecOps Security Test Suite.
    Tests:
    1. Authentication enforcement on protected endpoints
    2. Path Traversal & Unauthenticated Download prevention
    3. Role-Based Access Control (RBAC) boundaries
    4. Input sanitization (XSS prevention)
    5. Security Headers
    6. Account Enumeration Prevention
    7. File Content & Magic Byte Inspection
    8. HttpOnly Refresh Token & Cookie Security (Phase 2)
    """

    def setUp(self):
        from django.core.cache import cache
        cache.clear()
        self.client = APIClient()
        
        # Create Student User
        self.student_user = User.objects.create_user(
            username="sec_student",
            email="sec_student@sv.utc.edu.vn",
            password="Password123!",
            user_type="student",
        )
        self.student = Student.objects.create(
            user=self.student_user,
            registration_no="201200999",
            semester="8",
        )

        # Create Supervisor User
        self.supervisor_user = User.objects.create_user(
            username="sec_supervisor",
            email="sec_supervisor@utc.edu.vn",
            password="Password123!",
            user_type="supervisor",
        )
        self.supervisor = Supervisor.objects.create(
            user=self.supervisor_user,
            supervisor_id="GV999",
        )

        # Create Committee Member User
        self.panel = CommitteeMemberPanel.objects.create(name="Panel A")
        self.committee_user = User.objects.create_user(
            username="sec_committee",
            email="sec_committee@utc.edu.vn",
            password="Password123!",
            user_type="committee_member",
        )
        self.committee_member = CommitteeMember.objects.create(
            user=self.committee_user,
            committee_id="CM999",
            panel=self.panel,
        )

        # Create External Examiner User
        self.external_user = User.objects.create_user(
            username="sec_external",
            email="sec_external@partner.edu.vn",
            password="Password123!",
            user_type="external_examiner",
        )
        self.external_examiner = ExternalExaminer.objects.create(
            user=self.external_user,
            external_id="EXT999",
            institution="Partner University",
            designation="professor",
        )


    def test_unauthenticated_download_prevented(self):
        """Verify unauthenticated document downloads return 401 Unauthorized."""
        response = self.client.get("/documents/secret_thesis.pdf/")
        self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    def test_path_traversal_download_prevented(self):
        """Verify path traversal payloads in document downloads return 401, 403, or 404."""
        login_res = self.client.post("/app/student/login/", {
            "registration_no": "201200999",
            "password": "Password123!",
        })
        self.assertEqual(login_res.status_code, status.HTTP_200_OK)
        token = login_res.data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        response = self.client.get("/documents/..%2F..%2Fetc%2Fpasswd/")
        self.assertIn(response.status_code, [status.HTTP_404_NOT_FOUND, status.HTTP_400_BAD_REQUEST])

    def test_student_cannot_access_supervisor_profile(self):
        """Verify Students cannot access Supervisor Profile endpoints (RBAC boundary)."""
        login_res = self.client.post("/app/student/login/", {
            "registration_no": "201200999",
            "password": "Password123!",
        })
        token = login_res.data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        response = self.client.get("/app/supervisor/profile/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_student_cannot_access_admin_dashboard(self):
        """Verify Non-staff Students cannot access Admin Dashboard."""
        login_res = self.client.post("/app/student/login/", {
            "registration_no": "201200999",
            "password": "Password123!",
        })
        token = login_res.data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        response = self.client.get("/app/admin/dashboard/")
        self.assertIn(response.status_code, [status.HTTP_302_FOUND, status.HTTP_403_FORBIDDEN])

    def test_xss_script_injection_sanitized(self):
        """Verify malicious XSS script payloads are rejected or sanitized in chat messages."""
        login_res = self.client.post("/app/student/login/", {
            "registration_no": "201200999",
            "password": "Password123!",
        })
        token = login_res.data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        xss_payload = "<script>alert('XSS')</script>"
        response = self.client.post("/app/supervisor/student/comments/", {
            "group": 1,
            "comment": xss_payload,
        })
        self.assertIn(response.status_code, [status.HTTP_400_BAD_REQUEST, status.HTTP_404_NOT_FOUND])

    def test_security_headers_present(self):
        """Verify core security headers are returned in HTTP responses."""
        response = self.client.get("/app/project/categories/")
        self.assertEqual(response.headers.get("X-Frame-Options"), "DENY")
        self.assertEqual(response.headers.get("X-Content-Type-Options"), "nosniff")

    # =========================================================================
    # Account Enumeration Prevention Tests
    # =========================================================================

    def test_account_enumeration_prevented_valid_user_wrong_password(self):
        """Case A: Valid registration number + wrong password returns 401 with generic error."""
        response = self.client.post("/app/student/login/", {
            "registration_no": "201200999",
            "password": "WrongPassword999!",
        })
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.data.get("detail"), "Invalid registration number or password.")

    def test_account_enumeration_prevented_non_existent_user(self):
        """Case B: Non-existing registration number + arbitrary password returns identical 401 response."""
        response = self.client.post("/app/student/login/", {
            "registration_no": "999999999",
            "password": "ArbitraryPassword123!",
        })
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.data.get("detail"), "Invalid registration number or password.")

    # =========================================================================
    # File Upload Magic Byte Verification Tests
    # =========================================================================

    def test_file_upload_valid_pdf_passes(self):
        """TEST 1: Valid PDF content header (%PDF-) passes validation."""
        pdf_bytes = b"%PDF-1.5\n%Header test content for valid PDF document."
        uploaded_file = SimpleUploadedFile("thesis.pdf", pdf_bytes, content_type="application/pdf")
        validated = validate_uploaded_file(uploaded_file)
        self.assertEqual(validated.name, "thesis.pdf")

    def test_file_upload_executable_renamed_to_pdf_rejected(self):
        """TEST 2: Executable content (MZ header) renamed to .pdf is rejected."""
        exe_bytes = b"MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff\x00\x00"
        uploaded_file = SimpleUploadedFile("payload.pdf", exe_bytes, content_type="application/pdf")
        with self.assertRaises(serializers.ValidationError):
            validate_uploaded_file(uploaded_file)

    def test_file_upload_valid_docx_passes(self):
        """TEST 3: Valid DOCX ZIP header (PK\x03\x04) passes validation."""
        docx_bytes = b"PK\x03\x04\x14\x00\x06\x00\x08\x00\x00\x00Test DOCX content"
        uploaded_file = SimpleUploadedFile("report.docx", docx_bytes, content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")
        validated = validate_uploaded_file(uploaded_file)
        self.assertEqual(validated.name, "report.docx")

    def test_file_upload_binary_renamed_to_docx_rejected(self):
        """TEST 4: Binary non-ZIP content renamed to .docx is rejected."""
        binary_bytes = b"\x00\x01\x02\x03\x04\x05\x06\x07\x08\x09Fake binary file"
        uploaded_file = SimpleUploadedFile("fake_report.docx", binary_bytes, content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")
        with self.assertRaises(serializers.ValidationError):
            validate_uploaded_file(uploaded_file)

    def test_file_upload_valid_zip_passes(self):
        """TEST 5: Valid ZIP file header passes validation."""
        zip_bytes = b"PK\x03\x04\x0a\x00\x00\x00\x00\x00Valid ZIP archive content"
        uploaded_file = SimpleUploadedFile("project_code.zip", zip_bytes, content_type="application/zip")
        validated = validate_uploaded_file(uploaded_file)
        self.assertEqual(validated.name, "project_code.zip")

    def test_file_upload_binary_renamed_to_txt_rejected(self):
        """TEST 6: Binary / Executable content containing null bytes renamed to .txt is rejected."""
        binary_txt_bytes = b"MZ\x00\x01Binary payload disguised as plain text file"
        uploaded_file = SimpleUploadedFile("malicious_notes.txt", binary_txt_bytes, content_type="text/plain")
        with self.assertRaises(serializers.ValidationError):
            validate_uploaded_file(uploaded_file)

    # =========================================================================
    # Phase 2: HttpOnly Refresh Token & Security Headers Tests
    # =========================================================================

    def test_login_does_not_return_refresh_token_in_json(self):
        """Verify login response does not expose refresh token in JSON body."""
        response = self.client.post("/app/student/login/", {
            "registration_no": "201200999",
            "password": "Password123!",
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertNotIn("refresh", response.data)

    def test_login_sets_httponly_refresh_cookie(self):
        """Verify login response sets HttpOnly refresh_token cookie."""
        response = self.client.post("/app/student/login/", {
            "registration_no": "201200999",
            "password": "Password123!",
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("refresh_token", response.cookies)
        cookie = response.cookies["refresh_token"]
        self.assertTrue(cookie["httponly"])
        self.assertEqual(cookie["samesite"], "Lax")

    @override_settings(DEBUG=False)
    def test_production_cookie_is_secure(self):
        """Verify production environment (DEBUG=False) sets Secure=True on refresh_token cookie."""
        response = self.client.post("/app/student/login/", {
            "registration_no": "201200999",
            "password": "Password123!",
        })
        cookie = response.cookies["refresh_token"]
        self.assertTrue(cookie["secure"])

    def test_token_refresh_using_cookie(self):
        """Verify POST /app/token/refresh/ works using HttpOnly cookie."""
        login_res = self.client.post("/app/student/login/", {
            "registration_no": "201200999",
            "password": "Password123!",
        })
        refresh_cookie = login_res.cookies["refresh_token"].value
        self.client.cookies["refresh_token"] = refresh_cookie

        refresh_res = self.client.post("/app/token/refresh/", {})
        self.assertEqual(refresh_res.status_code, status.HTTP_200_OK)
        self.assertIn("access", refresh_res.data)
        self.assertNotIn("refresh", refresh_res.data)
        self.assertIn("refresh_token", refresh_res.cookies)

    def test_token_refresh_rotation_and_old_token_rejection(self):
        """Verify Token Rotation blacklists old refresh token after refresh."""
        login_res = self.client.post("/app/student/login/", {
            "registration_no": "201200999",
            "password": "Password123!",
        })
        old_cookie = login_res.cookies["refresh_token"].value

        # First refresh
        self.client.cookies["refresh_token"] = old_cookie
        refresh_res = self.client.post("/app/token/refresh/", {})
        self.assertEqual(refresh_res.status_code, status.HTTP_200_OK)
        new_cookie = refresh_res.cookies["refresh_token"].value

        # Attempt to use old cookie again (should fail because blacklisted)
        self.client.cookies["refresh_token"] = old_cookie
        replay_res = self.client.post("/app/token/refresh/", {})
        self.assertEqual(replay_res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_logout_clears_cookie_and_invalidates_token(self):
        """Verify logout clears HttpOnly cookie and blacklists refresh token."""
        login_res = self.client.post("/app/student/login/", {
            "registration_no": "201200999",
            "password": "Password123!",
        })
        refresh_cookie = login_res.cookies["refresh_token"].value
        self.client.cookies["refresh_token"] = refresh_cookie

        logout_res = self.client.post("/app/token/logout/", {})
        self.assertEqual(logout_res.status_code, status.HTTP_200_OK)

        # Cookie should be deleted/cleared
        self.assertEqual(logout_res.cookies["refresh_token"].value, "")

        # Subsequent refresh attempt with old cookie should fail 401
        self.client.cookies["refresh_token"] = refresh_cookie
        refresh_after_logout = self.client.post("/app/token/refresh/", {})
        self.assertEqual(refresh_after_logout.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_missing_refresh_cookie_fails(self):
        """Verify refresh endpoint fails 401 when no cookie is sent."""
        self.client.cookies.clear()
        response = self.client.post("/app/token/refresh/", {})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_invalid_refresh_cookie_fails(self):
        """Verify refresh endpoint fails 401 when invalid cookie value is sent."""
        self.client.cookies["refresh_token"] = "invalid.jwt.token"
        response = self.client.post("/app/token/refresh/", {})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_cors_credentials_configured(self):
        """Verify CORS_ALLOW_CREDENTIALS is enabled in settings."""
        self.assertTrue(getattr(settings, "CORS_ALLOW_CREDENTIALS", False))

    # =========================================================================
    # Phase 3: WebSocket Security Tests
    # =========================================================================

    def test_websocket_ticket_generation_and_single_use_consumption(self):
        """Verify WebSocket ticket endpoint issues one-time short-lived tickets."""
        from app.middleware import get_user_from_ticket
        from asgiref.sync import async_to_sync

        login_res = self.client.post("/app/student/login/", {
            "registration_no": "201200999",
            "password": "Password123!",
        })
        token = login_res.data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        ticket_res = self.client.post("/app/ws-ticket/", {"group_id": 99})
        self.assertEqual(ticket_res.status_code, status.HTTP_200_OK)
        self.assertIn("ticket", ticket_res.data)
        ticket = ticket_res.data["ticket"]

        # First consumption (valid)
        user, bound_group_id = async_to_sync(get_user_from_ticket)(ticket)
        self.assertEqual(user.username, self.student_user.username)
        self.assertEqual(str(bound_group_id), "99")

        # Second consumption (must fail because ticket is single-use and already consumed)
        reused_user, _ = async_to_sync(get_user_from_ticket)(ticket)
        self.assertTrue(reused_user.is_anonymous)

    # =========================================================================
    # Phase 6: Admin Management & RBAC Tests
    # =========================================================================

    def test_admin_user_management_rbac_enforced(self):
        """Verify non-admin users cannot access Admin User Management APIs."""
        login_res = self.client.post("/app/student/login/", {
            "registration_no": "201200999",
            "password": "Password123!",
        })
        token = login_res.data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        response = self.client.get("/app/admin/users/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_staff_can_access_user_management_and_security_center(self):
        """Verify Admin staff users can access management and Security Center APIs."""
        admin_user = User.objects.create_superuser(
            username="admin_staff",
            email="admin@utc.edu.vn",
            password="AdminPassword123!",
            user_type="admin",
        )
        Supervisor.objects.create(
            user=admin_user,
            supervisor_id="ADM001",
        )
        login_res = self.client.post("/app/supervisor/login/", {
            "email": "admin@utc.edu.vn",
            "password": "AdminPassword123!",
        })
        token = login_res.data.get("access")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        # Test user management endpoint
        res1 = self.client.get("/app/admin/users/")
        self.assertEqual(res1.status_code, status.HTTP_200_OK)
        self.assertIn("users", res1.data)

        # Test security center endpoint
        res2 = self.client.get("/app/admin/security-center/")
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertIn("security_headers", res2.data)

    def test_unauthenticated_requests_receive_401(self):
        """Verify unauthenticated requests to protected endpoints return 401 Unauthorized."""
        self.client.credentials()  # Clear auth headers
        
        # Test student profile
        res_student = self.client.get("/app/student/profile/")
        self.assertEqual(res_student.status_code, status.HTTP_401_UNAUTHORIZED)

        # Test supervisor profile
        res_supervisor = self.client.get("/app/supervisor/profile/")
        self.assertEqual(res_supervisor.status_code, status.HTTP_401_UNAUTHORIZED)

        # Test committee member profile
        res_committee = self.client.get("/app/committee_member/profile/")
        self.assertEqual(res_committee.status_code, status.HTTP_401_UNAUTHORIZED)

        # Test external examiner profile
        res_external = self.client.get("/app/external/profile/")
        self.assertEqual(res_external.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_student_role_rbac_and_admin_forbidden(self):
        """Verify Student can access own allowed resources and receives 403 on admin endpoints."""
        login_res = self.client.post("/app/student/login/", {
            "registration_no": "201200999",
            "password": "Password123!",
        })
        self.assertEqual(login_res.status_code, status.HTTP_200_OK)
        token = login_res.data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        # Allowed resource: Student profile
        res_allowed = self.client.get("/app/student/profile/")
        self.assertEqual(res_allowed.status_code, status.HTTP_200_OK)

        # Forbidden: Admin APIs
        res_admin_users = self.client.get("/app/admin/users/")
        self.assertEqual(res_admin_users.status_code, status.HTTP_403_FORBIDDEN)
        res_security = self.client.get("/app/admin/security-center/")
        self.assertEqual(res_security.status_code, status.HTTP_403_FORBIDDEN)

    def test_supervisor_role_rbac_and_admin_forbidden(self):
        """Verify Supervisor can access own allowed resources and receives 403 on admin endpoints."""
        login_res = self.client.post("/app/supervisor/login/", {
            "email": "sec_supervisor@utc.edu.vn",
            "password": "Password123!",
        })
        self.assertEqual(login_res.status_code, status.HTTP_200_OK)
        token = login_res.data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        # Allowed resource: Supervisor profile
        res_allowed = self.client.get("/app/supervisor/profile/")
        self.assertEqual(res_allowed.status_code, status.HTTP_200_OK)

        # Forbidden: Admin APIs
        res_admin_users = self.client.get("/app/admin/users/")
        self.assertEqual(res_admin_users.status_code, status.HTTP_403_FORBIDDEN)
        res_security = self.client.get("/app/admin/security-center/")
        self.assertEqual(res_security.status_code, status.HTTP_403_FORBIDDEN)

    def test_committee_member_role_rbac_and_admin_forbidden(self):
        """Verify Committee Member can access own allowed resources and receives 403 on admin endpoints."""
        login_res = self.client.post("/app/committee_member/login/", {
            "email": "sec_committee@utc.edu.vn",
            "password": "Password123!",
        })
        self.assertEqual(login_res.status_code, status.HTTP_200_OK)
        token = login_res.data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        # Allowed resource: Committee Member profile
        res_allowed = self.client.get("/app/committee_member/profile/")
        self.assertEqual(res_allowed.status_code, status.HTTP_200_OK)

        # Forbidden: Admin APIs
        res_admin_users = self.client.get("/app/admin/users/")
        self.assertEqual(res_admin_users.status_code, status.HTTP_403_FORBIDDEN)
        res_security = self.client.get("/app/admin/security-center/")
        self.assertEqual(res_security.status_code, status.HTTP_403_FORBIDDEN)

    def test_external_examiner_role_rbac_and_admin_forbidden(self):
        """Verify External Examiner can access own allowed resources and receives 403 on admin endpoints."""
        login_res = self.client.post("/app/external/login/", {
            "email": "sec_external@partner.edu.vn",
            "password": "Password123!",
        })
        self.assertEqual(login_res.status_code, status.HTTP_200_OK)
        token = login_res.data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        # Allowed resource: External profile & dashboard
        res_profile = self.client.get("/app/external/profile/")
        self.assertEqual(res_profile.status_code, status.HTTP_200_OK)
        res_dashboard = self.client.get("/app/external/dashboard/")
        self.assertEqual(res_dashboard.status_code, status.HTTP_200_OK)

        # Forbidden: Admin APIs
        res_admin_users = self.client.get("/app/admin/users/")
        self.assertEqual(res_admin_users.status_code, status.HTTP_403_FORBIDDEN)
        res_security = self.client.get("/app/admin/security-center/")
        self.assertEqual(res_security.status_code, status.HTTP_403_FORBIDDEN)

