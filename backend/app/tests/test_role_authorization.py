"""
Kiểm thử hồi quy phân quyền theo vai trò cho các API nghiệp vụ của Khoa.

Trước bản sửa này, các endpoint dưới đây chỉ yêu cầu đăng nhập (IsAuthenticated),
nên sinh viên có thể tự đóng đợt, chạy phân công, đặc cách đồ án hoặc duyệt đơn bảo lưu.
"""
import os
import shutil
import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from app.models import (
    AcademicBatch,
    CustomUser,
    GraduationProject,
    ProjectTopicArea,
    Student,
    Supervisor,
    ThesisDeferralRequest,
)


class RoleAuthorizationTests(APITestCase):
    def setUp(self):
        self.client = APIClient()
        self.batch = AcademicBatch.objects.create(
            batch_code="AUTHZ_2026", batch_name="Đợt kiểm thử phân quyền", is_active=True
        )
        self.topic = ProjectTopicArea.objects.create(name="Phần mềm", code="AUTHZ_SW", is_active=True)

        self.admin_user = CustomUser.objects.create_user(
            username="authz_admin", password="x", user_type="admin", is_staff=True
        )
        self.staff_user = CustomUser.objects.create_user(
            username="authz_giaovu", password="x", user_type="academic_staff"
        )

        self.sup_a_user = CustomUser.objects.create_user(username="authz_gv_a", password="x", user_type="supervisor")
        self.sup_a = Supervisor.objects.create(user=self.sup_a_user, supervisor_id="AZ01", academic_title="TS")
        self.sup_b_user = CustomUser.objects.create_user(username="authz_gv_b", password="x", user_type="supervisor")
        self.sup_b = Supervisor.objects.create(user=self.sup_b_user, supervisor_id="AZ02", academic_title="TS")

        self.committee_user = CustomUser.objects.create_user(
            username="authz_hd", password="x", user_type="committee_member"
        )

        self.student_user = CustomUser.objects.create_user(
            username="authz_sv", password="x", user_type="student", email="sv1@st.utc.edu.vn"
        )
        self.student = Student.objects.create(user=self.student_user, registration_no="AZ0001", academic_batch=self.batch)
        self.other_student_user = CustomUser.objects.create_user(
            username="authz_sv2", password="x", user_type="student", email="sv2@st.utc.edu.vn"
        )
        self.other_student = Student.objects.create(
            user=self.other_student_user, registration_no="AZ0002", academic_batch=self.batch
        )

        self.project = GraduationProject.objects.create(
            student=self.student, supervisor=self.sup_a, batch=self.batch,
            topic_category=self.topic, topic_title_vi="Đề tài AZ một", status="IN_PROGRESS",
        )
        self.other_project = GraduationProject.objects.create(
            student=self.other_student, supervisor=self.sup_b, batch=self.batch,
            topic_category=self.topic, topic_title_vi="Đề tài AZ hai", status="IN_PROGRESS",
        )

    # ------------------------------------------------------------------
    # Thao tác chỉ dành cho Khoa / Giáo vụ
    # ------------------------------------------------------------------
    def _faculty_only_requests(self):
        return [
            ("post", f"/app/batches/{self.batch.id}/close/", {}),
            ("post", f"/app/admin/batches/{self.batch.id}/close/", {}),
            ("post", "/app/allocation/run-algorithm/", {"batch_id": self.batch.id}),
            ("post", f"/app/graduation-project/{self.project.id}/force-approve/", {"decision": "APPROVE"}),
            ("post", "/app/batch/create/", {"batch_code": "AZ_NEW", "batch_name": "Đợt mới"}),
        ]

    def test_student_cannot_call_faculty_only_actions(self):
        self.client.force_authenticate(user=self.student_user)
        for method, url, payload in self._faculty_only_requests():
            res = getattr(self.client, method)(url, payload, format="json")
            self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN, url)
        self.batch.refresh_from_db()
        self.project.refresh_from_db()
        self.assertTrue(self.batch.is_active)
        self.assertEqual(self.project.status, "IN_PROGRESS")
        self.assertFalse(AcademicBatch.objects.filter(batch_code="AZ_NEW").exists())

    def test_supervisor_cannot_call_faculty_only_actions(self):
        self.client.force_authenticate(user=self.sup_a_user)
        for method, url, payload in self._faculty_only_requests():
            res = getattr(self.client, method)(url, payload, format="json")
            self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN, url)

    def test_batch_list_stays_readable_for_all_roles(self):
        self.client.force_authenticate(user=self.student_user)
        res = self.client.get("/app/batch/create/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_academic_staff_can_create_batch(self):
        self.client.force_authenticate(user=self.staff_user)
        res = self.client.post(
            "/app/batch/create/",
            {"batch_code": "AZ_STAFF", "batch_name": "Đợt do giáo vụ tạo",
             "start_date": "2026-09-01", "end_date": "2027-01-31"},
            format="json",
        )
        self.assertNotEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    # ------------------------------------------------------------------
    # Phân công hội đồng
    # ------------------------------------------------------------------
    def test_student_cannot_assign_council(self):
        self.client.force_authenticate(user=self.student_user)
        res = self.client.post(
            "/app/council/assign-project/", {"project_id": self.project.id, "council_id": 1}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        res = self.client.get("/app/council/assign-member/", {"council_id": 1})
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    # ------------------------------------------------------------------
    # Đơn bảo lưu: GVHD chỉ xem/duyệt đơn của SV mình hướng dẫn
    # ------------------------------------------------------------------
    def _make_deferral(self, project, student):
        return ThesisDeferralRequest.objects.create(project=project, student=student, reason="Lý do sức khỏe")

    def test_supervisor_only_sees_own_students_deferrals(self):
        own = self._make_deferral(self.project, self.student)
        self._make_deferral(self.other_project, self.other_student)
        self.client.force_authenticate(user=self.sup_a_user)
        res = self.client.get("/app/admin/deferral-request/list/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual([item["id"] for item in res.data], [own.id])

    def test_supervisor_cannot_review_other_supervisors_deferral(self):
        foreign = self._make_deferral(self.other_project, self.other_student)
        self.client.force_authenticate(user=self.sup_a_user)
        res = self.client.post(
            f"/app/admin/deferral-request/{foreign.id}/review/", {"decision": "REJECTED"}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.other_project.refresh_from_db()
        foreign.refresh_from_db()
        self.assertEqual(self.other_project.status, "IN_PROGRESS")
        self.assertEqual(foreign.status, "PENDING")

    def test_admin_still_sees_all_deferrals(self):
        self._make_deferral(self.project, self.student)
        self._make_deferral(self.other_project, self.other_student)
        self.client.force_authenticate(user=self.admin_user)
        res = self.client.get("/app/admin/deferral-request/list/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 2)

    # ------------------------------------------------------------------
    # Sửa đề tài: vai trò khác (hội đồng, phản biện) không được sửa đồ án bất kỳ
    # ------------------------------------------------------------------
    def test_committee_member_cannot_edit_any_topic_draft(self):
        self.client.force_authenticate(user=self.committee_user)
        res = self.client.post(
            "/app/graduation-project/topic-draft/",
            {"project_id": self.other_project.id, "topic_title_vi": "Đổi tên trái phép"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.other_project.refresh_from_db()
        self.assertEqual(self.other_project.topic_title_vi, "Đề tài AZ hai")

    # ------------------------------------------------------------------
    # Global search: SV không tra cứu được email / đồ án của SV khác
    # ------------------------------------------------------------------
    def test_student_global_search_is_scoped_to_self(self):
        self.client.force_authenticate(user=self.student_user)
        res = self.client.get("/app/global-search/", {"q": "AZ"})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        payload = str(res.data)
        self.assertNotIn("sv2@st.utc.edu.vn", payload)
        self.assertNotIn("AZ0002", payload)
        self.assertNotIn("Đề tài AZ hai", payload)
        self.assertIn("Đề tài AZ một", payload)

    def test_supervisor_global_search_still_finds_students(self):
        self.client.force_authenticate(user=self.sup_a_user)
        res = self.client.get("/app/global-search/", {"q": "AZ000"})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("AZ0002", str(res.data))


class SignedOutlinePersistenceTests(APITestCase):
    """File đề cương đã ký phải thực sự được ghi xuống storage, không chỉ lưu tên file."""

    def setUp(self):
        self.media_root = tempfile.mkdtemp(prefix="fyp_media_test_")
        self.override = override_settings(MEDIA_ROOT=self.media_root)
        self.override.enable()

        batch = AcademicBatch.objects.create(
            batch_code="AZ_OUTLINE", batch_name="Đợt đề cương", is_active=True, current_stage="PHASE_3_TOPIC"
        )
        topic = ProjectTopicArea.objects.create(name="Phần mềm", code="AZ_OUT_SW", is_active=True)
        sup_user = CustomUser.objects.create_user(username="az_out_gv", password="x", user_type="supervisor")
        sup = Supervisor.objects.create(user=sup_user, supervisor_id="AZO1", academic_title="TS")
        self.student_user = CustomUser.objects.create_user(username="az_out_sv", password="x", user_type="student")
        student = Student.objects.create(user=self.student_user, registration_no="AZO0001", academic_batch=batch)
        self.project = GraduationProject.objects.create(
            student=student, supervisor=sup, batch=batch, topic_category=topic,
            topic_title_vi="Đề cương lưu file", status="OUTLINE_PENDING",
        )

    def tearDown(self):
        self.override.disable()
        shutil.rmtree(self.media_root, ignore_errors=True)

    def test_uploaded_signed_outline_is_written_to_storage(self):
        self.client.force_authenticate(user=self.student_user)
        content = b"%PDF-1.4\nSigned outline\n%%EOF"
        pdf = SimpleUploadedFile("signed.pdf", content, content_type="application/pdf")
        res = self.client.post(
            f"/app/project/{self.project.id}/upload-signed-outline/",
            {"signed_outline_file": pdf}, format="multipart",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.project.refresh_from_db()
        # Serializer phải trả URL dạng chuỗi (trước đây là object stub -> lỗi 500 khi render JSON).
        self.assertIsInstance(res.data["project"]["signed_outline_file"], str)
        detail = self.client.get(f"/app/graduation-project/{self.project.id}/")
        self.assertNotEqual(detail.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
        saved_path = os.path.join(self.media_root, self.project.outline_pdf_path)
        self.assertTrue(os.path.exists(saved_path), saved_path)
        with open(saved_path, "rb") as fh:
            self.assertEqual(fh.read(), content)
