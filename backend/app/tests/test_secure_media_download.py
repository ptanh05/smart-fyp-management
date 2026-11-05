import os
import shutil
import tempfile
import datetime
from django.conf import settings
from django.test import override_settings
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from rest_framework_simplejwt.tokens import AccessToken

from app.models import (
    CustomUser,
    Student,
    Supervisor,
    AcademicBatch,
    CourseClass,
    GraduationProject,
    SupervisorGroupChatMessage,
    ChatRoom,
)


class SecureMediaDownloadTestCase(APITestCase):
    """
    Test suite for secure media attachment download:
    - Token authentication via Authorization header
    - Token expiration enforcement
    - Cross-supervisor attachment authorization & permission boundaries
    - Directory traversal protection
    - Missing file (404) handling
    - Content-Disposition filename safety
    """

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.temp_media_dir = tempfile.mkdtemp()
        cls.chat_attachments_dir = os.path.join(cls.temp_media_dir, "chat_attachments")
        os.makedirs(cls.chat_attachments_dir, exist_ok=True)

        # Create sample files
        cls.sample_file_name = "bug_cong.docx"
        cls.sample_file_path = os.path.join(cls.chat_attachments_dir, cls.sample_file_name)
        with open(cls.sample_file_path, "wb") as f:
            f.write(b"Word document content for test attachment.")

        cls.utf8_file_name = "bao_cao_do_an.docx"
        cls.utf8_file_path = os.path.join(cls.chat_attachments_dir, cls.utf8_file_name)
        with open(cls.utf8_file_path, "wb") as f:
            f.write(b"UTF-8 encoded document content.")

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.temp_media_dir, ignore_errors=True)
        super().tearDownClass()

    def setUp(self):
        super().setUp()
        self.client = APIClient()

        # Batch & Class
        self.batch = AcademicBatch.objects.create(
            batch_code="MEDIA_TEST_BATCH",
            batch_name="Media Test Batch",
        )
        self.course_class = CourseClass.objects.create(
            class_code="MEDIA_TEST_CLASS",
            batch=self.batch,
        )

        # Supervisor 1
        self.user_sup1 = CustomUser.objects.create_user(
            username="sup1_media",
            email="sup1_media@utc.edu.vn",
            password="TestPassword123!",
            user_type="supervisor",
            first_name="Nguyen",
            last_name="Van Mot",
        )
        self.sup1 = Supervisor.objects.create(
            user=self.user_sup1,
            supervisor_id="SUP_MEDIA_001",
            department_name="Khoa CNTT",
        )

        # Supervisor 2
        self.user_sup2 = CustomUser.objects.create_user(
            username="sup2_media",
            email="sup2_media@utc.edu.vn",
            password="TestPassword123!",
            user_type="supervisor",
            first_name="Tran",
            last_name="Van Hai",
        )
        self.sup2 = Supervisor.objects.create(
            user=self.user_sup2,
            supervisor_id="SUP_MEDIA_002",
            department_name="Khoa CNTT",
        )

        # Student 1 (assigned to Supervisor 1)
        self.user_stu1 = CustomUser.objects.create_user(
            username="stu1_media",
            email="stu1_media@utc.edu.vn",
            password="TestPassword123!",
            user_type="student",
            first_name="Vu",
            last_name="Manh Hung",
        )
        self.stu1 = Student.objects.create(
            user=self.user_stu1,
            registration_no="20260001",
            academic_batch=self.batch,
            course_class=self.course_class,
        )
        self.proj1 = GraduationProject.objects.create(
            student=self.stu1,
            batch=self.batch,
            supervisor=self.sup1,
            topic_title_vi="He thong quan ly do an",
            status="IN_PROGRESS",
        )

        # Student 2 (assigned to Supervisor 2)
        self.user_stu2 = CustomUser.objects.create_user(
            username="stu2_media",
            email="stu2_media@utc.edu.vn",
            password="TestPassword123!",
            user_type="student",
            first_name="Le",
            last_name="Thi Mai",
        )
        self.stu2 = Student.objects.create(
            user=self.user_stu2,
            registration_no="20260002",
            academic_batch=self.batch,
            course_class=self.course_class,
        )
        self.proj2 = GraduationProject.objects.create(
            student=self.stu2,
            batch=self.batch,
            supervisor=self.sup2,
            topic_title_vi="De tai cua GVHD 2",
            status="IN_PROGRESS",
        )

        # Admin user
        self.user_admin = CustomUser.objects.create_user(
            username="admin_media",
            email="admin_media@utc.edu.vn",
            password="TestPassword123!",
            user_type="admin",
            first_name="Admin",
            last_name="Khoa CNTT",
            is_staff=True,
        )

        # Attach sample_file_name to Supervisor 1's group chat
        self.group_msg = SupervisorGroupChatMessage.objects.create(
            supervisor=self.sup1,
            sender=self.user_stu1,
            message="Em gui file bao cao bug",
            attachment=f"chat_attachments/{self.sample_file_name}",
            attachment_name=self.sample_file_name,
            attachment_size=len(b"Word document content for test attachment."),
        )

    def test_1_download_with_valid_access_token_in_header(self):
        """Authenticated student downloads attachment with valid access token."""
        token = str(AccessToken.for_user(self.user_stu1))
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        with override_settings(MEDIA_ROOT=self.temp_media_dir):
            response = self.client.get(f"/media/chat_attachments/{self.sample_file_name}")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("attachment", response["Content-Disposition"])
        self.assertIn(self.sample_file_name, response["Content-Disposition"])
        self.assertEqual(b"".join(response.streaming_content), b"Word document content for test attachment.")

    def test_2_download_with_expired_access_token_fails_401(self):
        """Expired access token in header returns 401 Unauthorized."""
        token = AccessToken.for_user(self.user_stu1)
        token.set_exp(lifetime=datetime.timedelta(seconds=-10))

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(token)}")

        with override_settings(MEDIA_ROOT=self.temp_media_dir):
            response = self.client.get(f"/media/chat_attachments/{self.sample_file_name}")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_3_download_unauthenticated_fails_401(self):
        """Request without authentication header or token query returns 401."""
        self.client.credentials()  # Clear auth

        with override_settings(MEDIA_ROOT=self.temp_media_dir):
            response = self.client.get(f"/media/chat_attachments/{self.sample_file_name}")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_4_path_traversal_attack_blocked(self):
        """Path traversal patterns are strictly rejected with 400 Bad Request."""
        token = str(AccessToken.for_user(self.user_stu1))
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        with override_settings(MEDIA_ROOT=self.temp_media_dir):
            response = self.client.get("/media/../../../../etc/passwd")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data.get("detail"), "Đường dẫn không hợp lệ.")

    def test_5_missing_file_returns_404(self):
        """Non-existent file returns clean 404 JSON with descriptive detail."""
        token = str(AccessToken.for_user(self.user_stu1))
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        with override_settings(MEDIA_ROOT=self.temp_media_dir):
            response = self.client.get("/media/chat_attachments/non_existent_file.docx")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertIn("không tồn tại hoặc đã bị xóa", response.data.get("detail", ""))

    def test_6_authorized_student_can_download_their_supervisor_attachment(self):
        """Student assigned to Supervisor 1 can download Supervisor 1's group chat files."""
        token = str(AccessToken.for_user(self.user_stu1))
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        with override_settings(MEDIA_ROOT=self.temp_media_dir):
            response = self.client.get(f"/media/chat_attachments/{self.sample_file_name}")

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_7_unauthorized_student_from_different_supervisor_blocked_403(self):
        """Student 2 (supervised by Supervisor 2) is forbidden from downloading Supervisor 1's chat file."""
        token = str(AccessToken.for_user(self.user_stu2))
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        with override_settings(MEDIA_ROOT=self.temp_media_dir):
            response = self.client.get(f"/media/chat_attachments/{self.sample_file_name}")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data.get("detail"), "Bạn không có quyền truy cập tệp tin này.")

    def test_8_admin_has_full_access_to_all_attachments(self):
        """Admin user has permission to download any chat attachment."""
        token = str(AccessToken.for_user(self.user_admin))
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        with override_settings(MEDIA_ROOT=self.temp_media_dir):
            response = self.client.get(f"/media/chat_attachments/{self.sample_file_name}")

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_9_app_media_direct_url_route(self):
        """New direct route /app/media/... is supported and serves file."""
        token = str(AccessToken.for_user(self.user_stu1))
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        with override_settings(MEDIA_ROOT=self.temp_media_dir):
            response = self.client.get(f"/app/media/chat_attachments/{self.sample_file_name}")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(b"".join(response.streaming_content), b"Word document content for test attachment.")

    def test_10_content_disposition_header_and_cache_control(self):
        """FileResponse contains proper Content-Disposition and no-cache security headers."""
        token = str(AccessToken.for_user(self.user_stu1))
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        with override_settings(MEDIA_ROOT=self.temp_media_dir):
            response = self.client.get(f"/media/chat_attachments/{self.utf8_file_name}")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("attachment", response["Content-Disposition"])
        self.assertIn("no-store", response["Cache-Control"])

    def test_11_cookie_refresh_token_rotation(self):
        """CookieTokenRefreshAPIView successfully rotates refresh token and returns new access token."""
        from rest_framework_simplejwt.tokens import RefreshToken
        refresh = RefreshToken.for_user(self.user_stu1)
        self.client.cookies["refresh_token"] = str(refresh)

        response = self.client.post("/app/token/refresh/", {})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh_token", response.cookies)
        new_refresh_cookie = response.cookies["refresh_token"].value
        self.assertTrue(bool(new_refresh_cookie))

    def test_12_cookie_refresh_token_invalid_returns_401(self):
        """Invalid or expired refresh token returns 401 Unauthorized and clears cookie."""
        self.client.cookies["refresh_token"] = "invalid_refresh_token_string"

        response = self.client.post("/app/token/refresh/", {})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
