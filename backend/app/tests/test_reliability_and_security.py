import io
import os
import tempfile
import sqlite3
from unittest.mock import patch, MagicMock
from django.test import TestCase
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.contrib.auth import get_user_model
from django.db import OperationalError
from rest_framework.test import APIClient
from rest_framework import status
from rest_framework.exceptions import ValidationError

from app.models import (
    Student,
    Supervisor,
    Group,
    SupervisorOfStudentGroup,
    Document,
    AcademicBatch,
    DefenseCouncil,
    CouncilMember,
    GraduationProject,
    SystemBugReport,
)
from app.concurrency import retry_on_db_lock
from app.validators import validate_uploaded_file
from app.views_media import generate_media_token, verify_media_token
from app.services import NotificationService

User = get_user_model()


class ConcurrencyAndLockingTests(TestCase):
    def test_retry_on_db_lock_success_after_transient_failures(self):
        call_count = 0

        @retry_on_db_lock(max_retries=4, initial_delay=0.01, backoff_factor=1.2)
        def flaky_db_operation():
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise OperationalError("database is locked")
            return "SUCCESS"

        result = flaky_db_operation()
        self.assertEqual(result, "SUCCESS")
        self.assertEqual(call_count, 3)

    def test_retry_on_db_lock_re_raises_after_max_retries(self):
        call_count = 0

        @retry_on_db_lock(max_retries=3, initial_delay=0.01, backoff_factor=1.2)
        def failing_db_operation():
            nonlocal call_count
            call_count += 1
            raise OperationalError("database table is locked")

        with self.assertRaises(OperationalError):
            failing_db_operation()
        self.assertEqual(call_count, 3)

    def test_retry_on_db_lock_does_not_retry_unrelated_errors(self):
        call_count = 0

        @retry_on_db_lock(max_retries=3, initial_delay=0.01)
        def unrelated_error_operation():
            nonlocal call_count
            call_count += 1
            raise OperationalError("no such table: fake_table")

        with self.assertRaises(OperationalError):
            unrelated_error_operation()
        self.assertEqual(call_count, 1)


class BinaryMimeTypeValidatorTests(TestCase):
    def test_reject_windows_pe_executable_disguised_as_pdf(self):
        pe_header = bytes.fromhex("4d5a90000300000004000000ffff0000") + b"This program cannot be run"
        fake_pdf = SimpleUploadedFile("final_thesis.pdf", pe_header, content_type="application/pdf")

        with self.assertRaises(ValidationError) as ctx:
            validate_uploaded_file(fake_pdf, allowed_extensions=[".pdf"])
        self.assertIn("thực thi hoặc nhị phân nguy hiểm", str(ctx.exception))

    def test_reject_linux_elf_disguised_as_pdf(self):
        elf_header = bytes.fromhex("7f454c46020101000000000000000000")
        fake_pdf = SimpleUploadedFile("outline.pdf", elf_header, content_type="application/pdf")

        with self.assertRaises(ValidationError) as ctx:
            validate_uploaded_file(fake_pdf, allowed_extensions=[".pdf"])
        self.assertIn("thực thi hoặc nhị phân nguy hiểm", str(ctx.exception))

    def test_reject_script_payload_disguised_as_document(self):
        script_data = b"<" + b"?php" + b" echo 1; " + b"?" + b">"
        fake_docx = SimpleUploadedFile("project_report.docx", script_data, content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")

        with self.assertRaises(ValidationError) as ctx:
            validate_uploaded_file(fake_docx, allowed_extensions=[".docx"])
        self.assertTrue(
            "kịch bản thực thi nguy hiểm" in str(ctx.exception) or
            "không hợp lệ" in str(ctx.exception)
        )

    def test_accept_valid_pdf(self):
        valid_pdf_content = b"%PDF-1.4\n1 0 obj\n<< /Title (Bao cao Tot nghiep UTC) >>\nendobj\n%%EOF"
        valid_pdf = SimpleUploadedFile("valid_thesis.pdf", valid_pdf_content, content_type="application/pdf")
        validated = validate_uploaded_file(valid_pdf, allowed_extensions=[".pdf"])
        self.assertIsNotNone(validated)


class SecureMediaTokenTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="test_student", password="password123", email="student@utc.edu.vn")

    def test_anonymous_incognito_request_rejected_with_401(self):
        response = self.client.get("/api/media/download/documents/sample_report.pdf")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn("Yêu cầu xác thực phiên đăng nhập", response.data.get("detail", ""))

    def test_tampered_or_invalid_media_token_rejected_with_401(self):
        response = self.client.get("/api/media/download/documents/sample_report.pdf?token=invalid_forged_token_12345")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn("hết hạn hoặc không hợp lệ", response.data.get("detail", ""))

    def test_media_token_generation_and_verification(self):
        file_path = "documents/test_document_utc.pdf"
        token = generate_media_token(self.user.id, file_path)
        self.assertIsNotNone(token)

        verified_user_id = verify_media_token(token, file_path)
        self.assertEqual(str(verified_user_id), str(self.user.id))

        mismatched_result = verify_media_token(token, "documents/another_file.pdf")
        self.assertIsNone(mismatched_result)

    def test_get_signed_media_url_endpoint(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get("/api/media/download-token/?file_path=documents/report.pdf")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("signed_url", response.data)
        self.assertIn("token", response.data)
        self.assertIn("expires_in", response.data)


class UTCEmailAndTemplateTests(TestCase):
    def test_utc_html_email_template_rendering(self):
        with patch("app.services.EmailMultiAlternatives") as mock_email_cls:
            mock_instance = MagicMock()
            mock_email_cls.return_value = mock_instance

            sent = NotificationService.send_utc_html_email(
                recipient_email="student@utc.edu.vn",
                recipient_name="Nguyen Van A",
                subject="Lich bao ve do an",
                title="Lịch Bảo Vệ Đồ Án Tốt Nghiệp",
                intro_text="Khoa CNTT - Truong Dai hoc Giao thong Van tai thong bao:",
                details=[
                    {"label": "Hội đồng", "value": "Hội đồng 01"},
                    {"label": "Phòng", "value": "Phòng 302-A9"},
                ],
                badge_text="Lịch bảo vệ",
                async_send=False
            )
            self.assertTrue(sent)
            mock_email_cls.assert_called_once()
            call_kwargs = mock_email_cls.call_args[1]
            self.assertIn("student@utc.edu.vn", call_kwargs["to"])

            mock_instance.attach_alternative.assert_called_once()
            html_arg = mock_instance.attach_alternative.call_args[0][0]
            self.assertIn("TRƯỜNG ĐẠI HỌC GIAO THÔNG VẬN TẢI", html_arg)
            self.assertIn("#003366", html_arg)
            self.assertIn("#f59e0b", html_arg)


class DatabaseBackupCommandTests(TestCase):
    def test_backup_database_command_execution(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            call_command("backup_database", dest=tmp_dir, keep_days=7)

            files = os.listdir(tmp_dir)
            backup_gz_files = [f for f in files if f.endswith(".sqlite3.gz")]
            json_manifest_files = [f for f in files if f.endswith(".json")]

            self.assertTrue(len(backup_gz_files) >= 1, "Backup .sqlite3.gz file was not generated.")
            self.assertTrue(len(json_manifest_files) >= 1, "Backup manifest .json was not generated.")


class BugReportModuleTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="reporter_user", password="password123")

    def test_submit_bug_report_success(self):
        self.client.force_authenticate(user=self.user)
        png_content = (
            b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
            b"\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4"
            b"\x00\x00\x00\x00IEND\xaeB`\x82"
        )
        screenshot_file = SimpleUploadedFile("error_screen.png", png_content, content_type="image/png")

        data = {
            "title": "Nút Nộp Bài Không Phản Hồi",
            "description": "Khi bấm nút nộp bài đồ án tại trang tổng quan, modal không hiển thị thông báo.",
            "page_url": "http://localhost:5173/student/dashboard",
            "screenshot": screenshot_file,
        }
        response = self.client.post("/api/bug-reports/", data, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("thành công", response.data.get("message", ""))

        bug = SystemBugReport.objects.filter(user=self.user, title="Nút Nộp Bài Không Phản Hồi").first()
        self.assertIsNotNone(bug)
        self.assertEqual(bug.status, "PENDING")
        self.assertTrue(bool(bug.screenshot))

    def test_submit_bug_report_missing_description_rejected(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post("/api/bug-reports/", {"title": "Lỗi gì đó", "description": ""})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_get_bug_reports_authenticated(self):
        SystemBugReport.objects.create(
            user=self.user,
            title="Lỗi giao diện",
            description="Bị tràn chữ trên mobile",
            page_url="http://localhost:5173"
        )
        self.client.force_authenticate(user=self.user)
        response = self.client.get("/api/bug-reports/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
