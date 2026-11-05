import os
import shutil
import tempfile
import datetime
from unittest.mock import patch, MagicMock
from django.conf import settings
from django.test import override_settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage, FileSystemStorage
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken

from app.models import (
    CustomUser,
    Student,
    Supervisor,
    AcademicBatch,
    CourseClass,
    GraduationProject,
    SupervisorGroupChatMessage,
)
from app.storage_backends import MediaStorage, get_media_storage, is_cloud_storage_active


class PersistentMediaStorageTestCase(APITestCase):
    """
    Comprehensive test suite for Persistent Media Storage (Cloudflare R2 / AWS S3 & Local Fallback):
    1. Upload file
    2. Download file
    3. Delete file
    4. Nonexistent file (JSON 404)
    5. Unauthenticated user (401)
    6. Expired JWT and refresh token
    7. User outside supervisor group rejected (403)
    8. Student and Supervisor valid access (200)
    9. Large file handling
    10. Vietnamese and special characters in filename
    11. Storage backend unavailable (503)
    12. Local development fallback (USE_S3=False)
    """

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.temp_media_dir = tempfile.mkdtemp()
        cls.chat_attachments_dir = os.path.join(cls.temp_media_dir, "chat_attachments")
        os.makedirs(cls.chat_attachments_dir, exist_ok=True)

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        if os.path.exists(cls.temp_media_dir):
            shutil.rmtree(cls.temp_media_dir, ignore_errors=True)

    def setUp(self):
        self.client = APIClient()

        # Batch & Class
        self.batch = AcademicBatch.objects.create(
            batch_code="STORAGE_TEST_BATCH",
            batch_name="Storage Test Batch",
            start_date=datetime.date(2026, 9, 1),
            end_date=datetime.date(2027, 6, 30),
            is_active=True,
        )
        self.course_class = CourseClass.objects.create(
            class_code="CNTT_STORAGE_K62",
            class_name="CNTT Storage K62",
            batch=self.batch,
        )

        # Supervisor 1 (Primary)
        self.user_sup1 = CustomUser.objects.create_user(
            username="sup_storage_01",
            first_name="Vũ Bá",
            last_name="Thắng",
            email="sup1_storage@utc.edu.vn",
            password="Gv@123456",
            user_type="supervisor",
        )
        self.sup1 = Supervisor.objects.create(
            user=self.user_sup1,
            supervisor_id="SUP_STORAGE_001",
            department_name="Khoa CNTT",
        )

        # Supervisor 2 (Different Group)
        self.user_sup2 = CustomUser.objects.create_user(
            username="sup_storage_02",
            first_name="Đỗ Thị",
            last_name="Hà",
            email="sup2_storage@utc.edu.vn",
            password="Gv@123456",
            user_type="supervisor",
        )
        self.sup2 = Supervisor.objects.create(
            user=self.user_sup2,
            supervisor_id="SUP_STORAGE_002",
            department_name="Khoa HTTT",
        )

        # Student 1 (Supervised by Supervisor 1)
        self.user_sv1 = CustomUser.objects.create_user(
            username="sv_storage_01",
            first_name="Nguyễn Văn",
            last_name="An",
            email="sv1_storage@utc.edu.vn",
            password="Sv@123456",
            user_type="student",
        )
        self.student1 = Student.objects.create(
            user=self.user_sv1,
            registration_no="201299001",
            course_class=self.course_class,
            academic_batch=self.batch,
        )

        # Student 2 (Supervised by Supervisor 2)
        self.user_sv2 = CustomUser.objects.create_user(
            username="sv_storage_02",
            first_name="Trần Văn",
            last_name="Bình",
            email="sv2_storage@utc.edu.vn",
            password="Sv@123456",
            user_type="student",
        )
        self.student2 = Student.objects.create(
            user=self.user_sv2,
            registration_no="201299002",
            course_class=self.course_class,
            academic_batch=self.batch,
        )

        # Graduation Project linking Student 1 -> Supervisor 1
        self.proj1 = GraduationProject.objects.create(
            student=self.student1,
            supervisor=self.sup1,
            batch=self.batch,
            topic_title_vi="Đề tài Lưu trữ Đám mây",
            status="DEFENSE_READY",
        )

        # Graduation Project linking Student 2 -> Supervisor 2
        self.proj2 = GraduationProject.objects.create(
            student=self.student2,
            supervisor=self.sup2,
            batch=self.batch,
            topic_title_vi="Đề tài Phân tán",
            status="DEFENSE_READY",
        )

        # Chat Message with attachment in Supervisor 1's group
        self.chat_msg = SupervisorGroupChatMessage.objects.create(
            supervisor=self.sup1,
            sender=self.user_sup1,
            message="Tài liệu đính kèm đồ án nhóm 1",
            attachment="chat_attachments/do_an_tot_nghiep.docx",
            attachment_name="do_an_tot_nghiep.docx",
        )

    # -------------------------------------------------------------
    # 1. Upload File Test
    # -------------------------------------------------------------
    def test_01_upload_file_to_storage(self):
        with override_settings(MEDIA_ROOT=self.temp_media_dir):
            content = b"Binary content of thesis document for upload test."
            saved_name = default_storage.save("chat_attachments/upload_test.docx", ContentFile(content))
            self.assertTrue(default_storage.exists(saved_name))
            with default_storage.open(saved_name, "rb") as f:
                read_bytes = f.read()
            self.assertEqual(read_bytes, content)

    # -------------------------------------------------------------
    # 2. Download File Test
    # -------------------------------------------------------------
    def test_02_download_file_via_secure_view(self):
        with override_settings(MEDIA_ROOT=self.temp_media_dir):
            file_name = "do_an_tot_nghiep.docx"
            storage_path = f"chat_attachments/{file_name}"
            default_storage.save(storage_path, ContentFile(b"Sample thesis content."))

            token = str(AccessToken.for_user(self.user_sup1))
            self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
            response = self.client.get(f"/app/media/{storage_path}")

            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertEqual(response["Content-Disposition"], f'attachment; filename="{file_name}"')
            self.assertIn(b"Sample thesis content.", b"".join(response.streaming_content))

    # -------------------------------------------------------------
    # 3. Delete File Test
    # -------------------------------------------------------------
    def test_03_delete_file_from_storage(self):
        with override_settings(MEDIA_ROOT=self.temp_media_dir):
            saved_name = default_storage.save("chat_attachments/to_delete.txt", ContentFile(b"Delete me"))
            self.assertTrue(default_storage.exists(saved_name))
            default_storage.delete(saved_name)
            self.assertFalse(default_storage.exists(saved_name))

    # -------------------------------------------------------------
    # 4. Nonexistent File (Clean JSON 404)
    # -------------------------------------------------------------
    def test_04_download_nonexistent_file_returns_404_json(self):
        token = str(AccessToken.for_user(self.user_sup1))
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        response = self.client.get("/app/media/chat_attachments/file_does_not_exist_xyz.docx")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(response.headers.get("content-type"), "application/json")
        self.assertIn("không tồn tại hoặc đã bị xóa", response.data.get("detail", ""))

    # -------------------------------------------------------------
    # 5. Unauthenticated User (401)
    # -------------------------------------------------------------
    def test_05_unauthenticated_request_rejected_401(self):
        self.client.credentials()  # Clear credentials
        response = self.client.get("/app/media/chat_attachments/do_an_tot_nghiep.docx")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn("Yêu cầu xác thực", response.data.get("detail", ""))

    # -------------------------------------------------------------
    # 6. Expired JWT and Refresh Token Flow
    # -------------------------------------------------------------
    def test_06_expired_jwt_refresh_flow(self):
        # Create an expired access token
        refresh = RefreshToken.for_user(self.user_sup1)
        expired_access = refresh.access_token
        expired_access.set_exp(lifetime=-datetime.timedelta(seconds=60))

        # Request with expired token fails 401
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {expired_access}")
        response = self.client.get("/app/media/chat_attachments/do_an_tot_nghiep.docx")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        # Refresh token endpoint provides new valid access token
        self.client.credentials()  # Clear Authorization header so refresh endpoint uses cookie
        self.client.cookies["refresh_token"] = str(refresh)
        refresh_res = self.client.post("/app/token/refresh/", data={})
        self.assertEqual(refresh_res.status_code, status.HTTP_200_OK)
        new_token = refresh_res.data.get("access")

        # Retry with new token succeeds (using mock storage file)
        with override_settings(MEDIA_ROOT=self.temp_media_dir):
            default_storage.save("chat_attachments/do_an_tot_nghiep.docx", ContentFile(b"Thesis content."))
            self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {new_token}")
            dl_res = self.client.get("/app/media/chat_attachments/do_an_tot_nghiep.docx")
            self.assertEqual(dl_res.status_code, status.HTTP_200_OK)

    # -------------------------------------------------------------
    # 7. User Outside Supervisor Group Rejected (403 Forbidden)
    # -------------------------------------------------------------
    def test_07_unauthorized_student_cross_group_rejected_403(self):
        with override_settings(MEDIA_ROOT=self.temp_media_dir):
            default_storage.save("chat_attachments/do_an_tot_nghiep.docx", ContentFile(b"Secret Group 1."))

            # Student 2 belongs to Supervisor 2, NOT Supervisor 1
            token_sv2 = str(AccessToken.for_user(self.user_sv2))
            self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token_sv2}")
            response = self.client.get("/app/media/chat_attachments/do_an_tot_nghiep.docx")

            self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
            self.assertIn("Bạn không có quyền truy cập", response.data.get("detail", ""))

    # -------------------------------------------------------------
    # 8. Authorized Student and Supervisor Allowed (200 OK)
    # -------------------------------------------------------------
    def test_08_authorized_student_and_supervisor_allowed(self):
        with override_settings(MEDIA_ROOT=self.temp_media_dir):
            default_storage.save("chat_attachments/do_an_tot_nghiep.docx", ContentFile(b"Shared Group 1 content."))

            # 1. Supervisor 1 downloads
            token_sup1 = str(AccessToken.for_user(self.user_sup1))
            self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token_sup1}")
            res_sup = self.client.get("/app/media/chat_attachments/do_an_tot_nghiep.docx")
            self.assertEqual(res_sup.status_code, status.HTTP_200_OK)

            # 2. Student 1 (assigned to Supervisor 1) downloads
            token_sv1 = str(AccessToken.for_user(self.user_sv1))
            self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token_sv1}")
            res_sv = self.client.get("/app/media/chat_attachments/do_an_tot_nghiep.docx")
            self.assertEqual(res_sv.status_code, status.HTTP_200_OK)

    # -------------------------------------------------------------
    # 9. Large File Handling (Chunked Streaming)
    # -------------------------------------------------------------
    def test_09_large_file_streaming(self):
        with override_settings(MEDIA_ROOT=self.temp_media_dir):
            large_content = b"X" * (1024 * 512)  # 512 KB test chunk
            default_storage.save("chat_attachments/large_report.pdf", ContentFile(large_content))

            # Register in chat message so RBAC passes
            SupervisorGroupChatMessage.objects.create(
                supervisor=self.sup1,
                sender=self.user_sup1,
                message="Large file",
                attachment="chat_attachments/large_report.pdf",
            )

            token = str(AccessToken.for_user(self.user_sup1))
            self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
            response = self.client.get("/app/media/chat_attachments/large_report.pdf")

            self.assertEqual(response.status_code, status.HTTP_200_OK)
            streamed = b"".join(response.streaming_content)
            self.assertEqual(len(streamed), len(large_content))

    # -------------------------------------------------------------
    # 10. Vietnamese and Special Characters Filename (RFC 5987 / RFC 6266)
    # -------------------------------------------------------------
    def test_10_vietnamese_filename_rfc5987(self):
        with override_settings(MEDIA_ROOT=self.temp_media_dir):
            vn_filename = "Báo_Cáo_Đồ_Án_K62_UTC.pdf"
            default_storage.save(f"chat_attachments/{vn_filename}", ContentFile(b"Vietnamese content."))

            SupervisorGroupChatMessage.objects.create(
                supervisor=self.sup1,
                sender=self.user_sup1,
                message="Bao cao",
                attachment=f"chat_attachments/{vn_filename}",
            )

            token = str(AccessToken.for_user(self.user_sup1))
            self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
            response = self.client.get(f"/app/media/chat_attachments/{vn_filename}")

            self.assertEqual(response.status_code, status.HTTP_200_OK)
            disposition = response["Content-Disposition"]
            self.assertIn("filename*=", disposition)

    # -------------------------------------------------------------
    # 11. Storage Backend Unavailable (503 Service Unavailable)
    # -------------------------------------------------------------
    def test_11_storage_backend_unavailable_returns_503(self):
        with override_settings(USE_S3=True, AWS_STORAGE_BUCKET_NAME="mock-bucket"):
            with patch.object(default_storage, "exists", side_effect=Exception("S3 Connection Timeout")):
                token = str(AccessToken.for_user(self.user_sup1))
                self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
                response = self.client.get("/app/media/chat_attachments/do_an_tot_nghiep.docx")

                self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
                self.assertIn("không khả dụng", response.data.get("detail", ""))

    # -------------------------------------------------------------
    # 12. Local Development Fallback (USE_S3=False Regression)
    # -------------------------------------------------------------
    def test_12_local_development_fallback(self):
        with override_settings(USE_S3=False, AWS_STORAGE_BUCKET_NAME=""):
            self.assertFalse(is_cloud_storage_active())
            storage = get_media_storage()
            self.assertIsInstance(storage, FileSystemStorage)
            self.assertEqual(storage.base_url, "/media/")

    # -------------------------------------------------------------
    # 13. Legacy Routes: Trailing Slash & No-Slash Resolution
    # -------------------------------------------------------------
    def test_13_legacy_routes_trailing_slash_and_noslash(self):
        with override_settings(MEDIA_ROOT=self.temp_media_dir):
            default_storage.save("chat_attachments/do_an_tot_nghiep.docx", ContentFile(b"Legacy test content."))
            default_storage.save("doc_templates/sample_template.docx", ContentFile(b"Template content."))
            default_storage.save("documents/sample_doc.pdf", ContentFile(b"Document content."))

            token = str(AccessToken.for_user(self.user_sv1))
            self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

            # Chat attachment routes (with and without trailing slash, under / and /app/)
            urls_to_test = [
                "/media/chat_attachments/do_an_tot_nghiep.docx",
                "/media/chat_attachments/do_an_tot_nghiep.docx/",
                "/chat_attachments/do_an_tot_nghiep.docx",
                "/chat_attachments/do_an_tot_nghiep.docx/",
                "/app/chat_attachments/do_an_tot_nghiep.docx",
                "/app/chat_attachments/do_an_tot_nghiep.docx/",
                "/doc_templates/sample_template.docx",
                "/doc_templates/sample_template.docx/",
                "/app/doc_templates/sample_template.docx",
                "/app/doc_templates/sample_template.docx/",
                "/media/doc_templates/sample_template.docx",
                "/media/doc_templates/sample_template.docx/",
                "/documents/sample_doc.pdf",
                "/documents/sample_doc.pdf/",
                "/app/documents/sample_doc.pdf",
                "/app/documents/sample_doc.pdf/",
                "/media/documents/sample_doc.pdf",
                "/media/documents/sample_doc.pdf/",
            ]

            for url in urls_to_test:
                response = self.client.get(url)
                self.assertEqual(
                    response.status_code,
                    status.HTTP_200_OK,
                    f"URL failed: {url} returned {response.status_code}"
                )

    # -------------------------------------------------------------
    # 14. Legacy Routes: Anonymous Access Rejected (HTTP 401)
    # -------------------------------------------------------------
    def test_14_legacy_routes_anonymous_rejected_401(self):
        with override_settings(MEDIA_ROOT=self.temp_media_dir):
            default_storage.save("chat_attachments/do_an_tot_nghiep.docx", ContentFile(b"Content."))
            default_storage.save("documents/sample_doc.pdf", ContentFile(b"Doc content."))
            self.client.credentials()  # Clear auth

            unauth_urls = [
                "/chat_attachments/do_an_tot_nghiep.docx",
                "/chat_attachments/do_an_tot_nghiep.docx/",
                "/media/chat_attachments/do_an_tot_nghiep.docx",
                "/media/chat_attachments/do_an_tot_nghiep.docx/",
                "/app/chat_attachments/do_an_tot_nghiep.docx",
                "/app/chat_attachments/do_an_tot_nghiep.docx/",
                "/documents/sample_doc.pdf",
                "/documents/sample_doc.pdf/",
                "/media/documents/sample_doc.pdf",
                "/media/documents/sample_doc.pdf/",
                "/app/documents/sample_doc.pdf",
                "/app/documents/sample_doc.pdf/",
            ]

            for url in unauth_urls:
                response = self.client.get(url)
                self.assertEqual(
                    response.status_code,
                    status.HTTP_401_UNAUTHORIZED,
                    f"Anonymous request to {url} should be 401, got {response.status_code}"
                )

    # -------------------------------------------------------------
    # 15. Legacy Routes: Cross-Group Access Rejected (HTTP 403)
    # -------------------------------------------------------------
    def test_15_legacy_routes_cross_group_rejected_403(self):
        with override_settings(MEDIA_ROOT=self.temp_media_dir):
            default_storage.save("chat_attachments/do_an_tot_nghiep.docx", ContentFile(b"Secret Group 1."))
            # Student 2 is NOT in Group 1
            token2 = str(AccessToken.for_user(self.user_sv2))
            self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token2}")

            forbidden_urls = [
                "/chat_attachments/do_an_tot_nghiep.docx",
                "/chat_attachments/do_an_tot_nghiep.docx/",
                "/media/chat_attachments/do_an_tot_nghiep.docx",
                "/media/chat_attachments/do_an_tot_nghiep.docx/",
                "/app/chat_attachments/do_an_tot_nghiep.docx",
                "/app/chat_attachments/do_an_tot_nghiep.docx/",
            ]

            for url in forbidden_urls:
                response = self.client.get(url)
                self.assertEqual(
                    response.status_code,
                    status.HTTP_403_FORBIDDEN,
                    f"Cross-group request to {url} should be 403, got {response.status_code}"
                )

    # -------------------------------------------------------------
    # 16. Legacy Routes: Authorized Student & Supervisor Allowed (HTTP 200)
    # -------------------------------------------------------------
    def test_16_legacy_routes_authorized_student_and_supervisor_200(self):
        with override_settings(MEDIA_ROOT=self.temp_media_dir):
            default_storage.save("chat_attachments/do_an_tot_nghiep.docx", ContentFile(b"Shared Group 1 content."))

            # Supervisor of Group 1
            token_sup = str(AccessToken.for_user(self.user_sup1))
            self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token_sup}")
            res_sup = self.client.get("/chat_attachments/do_an_tot_nghiep.docx/")
            self.assertEqual(res_sup.status_code, status.HTTP_200_OK)

            # Student of Group 1
            token_sv = str(AccessToken.for_user(self.user_sv1))
            self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token_sv}")
            res_sv = self.client.get("/media/chat_attachments/do_an_tot_nghiep.docx/")
            self.assertEqual(res_sv.status_code, status.HTTP_200_OK)

    # -------------------------------------------------------------
    # 17. Legacy Routes: S3 Storage Support (No Direct MEDIA_ROOT dependency)
    # -------------------------------------------------------------
    def test_17_legacy_routes_with_s3_storage_active(self):
        with override_settings(USE_S3=True, AWS_STORAGE_BUCKET_NAME="mock-s3-bucket"):
            content_bytes = b"Cloud S3 legacy file content."
            mock_file = ContentFile(content_bytes)

            with patch.object(default_storage, "exists", return_value=True), \
                 patch.object(default_storage, "open", return_value=mock_file):

                token = str(AccessToken.for_user(self.user_sv1))
                self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

                res_legacy_slash = self.client.get("/media/chat_attachments/do_an_tot_nghiep.docx/")
                self.assertEqual(res_legacy_slash.status_code, status.HTTP_200_OK)

                res_legacy_root = self.client.get("/chat_attachments/do_an_tot_nghiep.docx/")
                self.assertEqual(res_legacy_root.status_code, status.HTTP_200_OK)


class MediaMigrationCommandTestCase(APITestCase):
    """
    Test suite for migrate_media_to_s3 management command:
    - Dry-run verification (does not write, counts correctly)
    - Full upload execution
    - Idempotent rerun (skips existing files)
    """

    def setUp(self):
        from django.core.management import call_command
        self.call_command = call_command
        self.test_src_dir = tempfile.mkdtemp()
        self.test_dest_dir = tempfile.mkdtemp()

        # Create sample local files
        os.makedirs(os.path.join(self.test_src_dir, "chat_attachments"), exist_ok=True)
        self.sample_file = os.path.join(self.test_src_dir, "chat_attachments", "migration_test.txt")
        with open(self.sample_file, "wb") as f:
            f.write(b"Migration test file content.")

    def tearDown(self):
        shutil.rmtree(self.test_src_dir, ignore_errors=True)
        shutil.rmtree(self.test_dest_dir, ignore_errors=True)

    def test_migration_dry_run(self):
        from io import StringIO
        out = StringIO()
        with override_settings(MEDIA_ROOT=self.test_dest_dir):
            self.call_command("migrate_media_to_s3", source_dir=self.test_src_dir, dry_run=True, stdout=out)
            output = out.getvalue()
            self.assertIn("Total Discovered: 1", output)
            self.assertIn("Successfully Uploaded: 1", output)
            # Verify file was NOT actually created on destination in dry-run
            self.assertFalse(os.path.exists(os.path.join(self.test_dest_dir, "chat_attachments", "migration_test.txt")))

    def test_migration_actual_upload_and_idempotence(self):
        from io import StringIO
        # First run: actual migration
        out1 = StringIO()
        with override_settings(MEDIA_ROOT=self.test_dest_dir):
            self.call_command("migrate_media_to_s3", source_dir=self.test_src_dir, stdout=out1)
            output1 = out1.getvalue()
            self.assertIn("Total Discovered: 1", output1)
            self.assertIn("Successfully Uploaded: 1", output1)
            # Verify file exists on destination
            self.assertTrue(os.path.exists(os.path.join(self.test_dest_dir, "chat_attachments", "migration_test.txt")))

            # Second run: idempotent rerun, should skip
            out2 = StringIO()
            self.call_command("migrate_media_to_s3", source_dir=self.test_src_dir, stdout=out2)
            output2 = out2.getvalue()
            self.assertIn("Skipped (Already in Storage): 1", output2)
            self.assertIn("Successfully Uploaded: 0", output2)

    def test_migration_with_verify_checksum(self):
        from io import StringIO
        out = StringIO()
        with override_settings(MEDIA_ROOT=self.test_dest_dir):
            self.call_command("migrate_media_to_s3", source_dir=self.test_src_dir, verify_checksum=True, stdout=out)
            output = out.getvalue()
            self.assertIn("Successfully Uploaded: 1", output)
            self.assertIn("Checksums Verified: 1", output)
            self.assertIn("Failed Files: 0", output)

    def test_migration_reverse_rollback(self):
        from io import StringIO
        # First put file into default_storage
        with override_settings(MEDIA_ROOT=self.test_dest_dir):
            self.call_command("migrate_media_to_s3", source_dir=self.test_src_dir, stdout=StringIO())

            restore_dir = tempfile.mkdtemp()
            try:
                out = StringIO()
                self.call_command("migrate_media_to_s3", reverse=True, dest_dir=restore_dir, verify_checksum=True, stdout=out)
                output = out.getvalue()
                self.assertIn("Successfully Downloaded: 1", output)
                self.assertIn("Checksums Verified: 1", output)
                restored_path = os.path.join(restore_dir, "chat_attachments", "migration_test.txt")
                self.assertTrue(os.path.exists(restored_path))
                with open(restored_path, "rb") as rf:
                    self.assertEqual(rf.read(), b"Migration test file content.")
            finally:
                shutil.rmtree(restore_dir, ignore_errors=True)

    def test_migration_reverse_dry_run(self):
        from io import StringIO
        with override_settings(MEDIA_ROOT=self.test_dest_dir):
            self.call_command("migrate_media_to_s3", source_dir=self.test_src_dir, stdout=StringIO())

            restore_dir = tempfile.mkdtemp()
            try:
                out = StringIO()
                self.call_command("migrate_media_to_s3", reverse=True, dest_dir=restore_dir, dry_run=True, stdout=out)
                output = out.getvalue()
                self.assertIn("DRY-RUN", output)
                self.assertIn("Would download", output)
                restored_path = os.path.join(restore_dir, "chat_attachments", "migration_test.txt")
                self.assertFalse(os.path.exists(restored_path))
            finally:
                shutil.rmtree(restore_dir, ignore_errors=True)

    def test_migration_with_vietnamese_filename(self):
        from io import StringIO
        vn_file = os.path.join(self.test_src_dir, "chat_attachments", "Báo_cáo_Đồ_án_2026.pdf")
        with open(vn_file, "wb") as f:
            f.write(b"%PDF-1.4 Vietnamese Content")

        out = StringIO()
        with override_settings(MEDIA_ROOT=self.test_dest_dir):
            self.call_command("migrate_media_to_s3", source_dir=self.test_src_dir, verify_checksum=True, stdout=out)
            output = out.getvalue()
            self.assertIn("Failed Files: 0", output)
            self.assertTrue(os.path.exists(os.path.join(self.test_dest_dir, "chat_attachments", "Báo_cáo_Đồ_án_2026.pdf")))

    def test_forward_migration_when_use_s3_true_and_source_only_on_local(self):
        """
        Verifies that when USE_S3=True, forward migration correctly reads from local filesystem
        (source_dir / MEDIA_ROOT) and uploads to cloud/destination storage without conflation.
        Source file is preserved, SHA256 matches, and idempotence holds on rerun.
        """
        from io import StringIO
        # Local source file exists only on local disk
        local_sample = os.path.join(self.test_src_dir, "chat_attachments", "local_only_sample.pdf")
        content = b"%PDF-1.4 Local Only File Content"
        with open(local_sample, "wb") as f:
            f.write(content)

        dest_file = os.path.join(self.test_dest_dir, "chat_attachments", "local_only_sample.pdf")
        self.assertFalse(os.path.exists(dest_file))

        out1 = StringIO()
        with override_settings(USE_S3=True, MEDIA_ROOT=self.test_dest_dir):
            self.call_command("migrate_media_to_s3", source_dir=self.test_src_dir, verify_checksum=True, stdout=out1)
            output1 = out1.getvalue()
            self.assertIn("Checksums Verified:", output1)
            self.assertIn("Failed Files: 0", output1)

            # 1. Destination received the file
            self.assertTrue(os.path.exists(dest_file))
            with open(dest_file, "rb") as df:
                self.assertEqual(df.read(), content)

            # 2. Source file is PRESERVED (never deleted)
            self.assertTrue(os.path.exists(local_sample))

            # 3. Rerun skips the existing file (idempotent, no duplicates)
            out2 = StringIO()
            self.call_command("migrate_media_to_s3", source_dir=self.test_src_dir, verify_checksum=True, stdout=out2)
            output2 = out2.getvalue()
            self.assertIn("Skipped (Already in Storage):", output2)
            self.assertIn("Successfully Uploaded: 0", output2)

    def test_reverse_migration_when_r2_has_new_file_and_local_missing(self):
        """
        Verifies that when cloud storage (R2) has a newly uploaded file that does NOT exist
        on local filesystem, reverse migration (--from-s3-to-local) discovers the file,
        downloads it to local MEDIA_ROOT, verifies checksum, and skips on rerun.
        """
        from io import StringIO
        # Simulate cloud storage containing a new file
        os.makedirs(os.path.join(self.test_dest_dir, "outlines"), exist_ok=True)
        cloud_file = os.path.join(self.test_dest_dir, "outlines", "new_cloud_thesis.docx")
        content = b"PK0304 New Cloud Thesis Outline"
        with open(cloud_file, "wb") as f:
            f.write(content)

        local_restore_dir = tempfile.mkdtemp()
        try:
            local_target = os.path.join(local_restore_dir, "outlines", "new_cloud_thesis.docx")
            self.assertFalse(os.path.exists(local_target))

            out1 = StringIO()
            with override_settings(MEDIA_ROOT=self.test_dest_dir):
                self.call_command("migrate_media_to_s3", reverse=True, dest_dir=local_restore_dir, verify_checksum=True, stdout=out1)
                output1 = out1.getvalue()
                self.assertIn("Successfully Downloaded: 1", output1)
                self.assertIn("Checksums Verified: 1", output1)

                # Local file successfully restored
                self.assertTrue(os.path.exists(local_target))
                with open(local_target, "rb") as lf:
                    self.assertEqual(lf.read(), content)

                # Rerun skips already restored local file
                out2 = StringIO()
                self.call_command("migrate_media_to_s3", reverse=True, dest_dir=local_restore_dir, verify_checksum=True, stdout=out2)
                output2 = out2.getvalue()
                self.assertIn("Skipped (Already in Local Storage): 1", output2)
                self.assertIn("Successfully Downloaded: 0", output2)
        finally:
            shutil.rmtree(local_restore_dir, ignore_errors=True)

