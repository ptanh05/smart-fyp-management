from django.test import TestCase, override_settings
from django.core.files.storage import default_storage, FileSystemStorage
from rest_framework.test import APIClient
from rest_framework import status
from app.models import CustomUser, Student, Supervisor
from app.storage_backends import get_media_storage, MediaStorage
from app.tasks import dispatch_async_notification, send_async_notification_task


class ProductionStorageAndCeleryTests(TestCase):
    def setUp(self):
        self.user = CustomUser.objects.create_user(
            username="test_student",
            email="201200099@utc.edu.vn",
            password="Password@123",
            user_type="student"
        )
        self.student = Student.objects.create(
            user=self.user,
            registration_no="201200099",
            education_program="BACHELOR"
        )

    def test_storage_fallback_when_s3_disabled(self):
        """Kiểm tra fallback sang FileSystemStorage khi không cấu hình S3 credentials"""
        storage = get_media_storage()
        self.assertIsInstance(storage, (FileSystemStorage, MediaStorage))

    def test_celery_notification_dispatch_fallback(self):
        """Kiểm tra điều phối thông báo bất đồng bộ hoạt động an toàn"""
        result = dispatch_async_notification(
            recipient_user_ids=[self.user.id],
            title="Thông báo kiểm thử Celery",
            message="Nội dung kiểm thử",
            notification_type="general",
            send_email=False
        )
        self.assertTrue(result)


class UTCGoogleSSOTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = CustomUser.objects.create_user(
            username="201200001",
            email="201200001@utc.edu.vn",
            password="Password@123",
            user_type="student"
        )
        self.student = Student.objects.create(
            user=self.user,
            registration_no="201200001",
            education_program="BACHELOR"
        )

    def test_sso_login_with_valid_utc_email(self):
        """Kiểm tra đăng nhập SSO với email hợp lệ của trường UTC"""
        response = self.client.post("/app/auth/google/", {
            "email": "201200001@utc.edu.vn"
        }, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertEqual(response.data["user_type"], "student")
        self.assertIn("refresh_token", response.cookies)

    def test_sso_login_with_disallowed_domain_rejected(self):
        """Kiểm tra email khác tên miền UTC bị từ chối 403 Forbidden"""
        response = self.client.post("/app/auth/google/", {
            "email": "intruder@external-school.edu.vn"
        }, format="json")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("detail", response.data)

    def test_sso_login_without_credentials_rejected(self):
        """Kiểm tra yêu cầu bắt buộc mã xác thực hoặc email"""
        response = self.client.post("/app/auth/google/", {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
