from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from app.models import AcademicBatch, CustomUser, GraduationProject, Student, Supervisor


class StageAccessControlTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.student_user = CustomUser.objects.create_user(
            username="241106060",
            password="password123",
            user_type="student",
        )
        supervisor_user = CustomUser.objects.create_user(
            username="stage_guard_supervisor",
            password="password123",
            user_type="supervisor",
        )
        self.batch = AcademicBatch.objects.create(
            batch_code="STAGE_GUARD_2026",
            batch_name="Stage Guard",
            current_stage="PHASE_2_ALLOCATING",
        )
        student = Student.objects.create(
            user=self.student_user,
            registration_no="241106060",
            academic_batch=self.batch,
        )
        supervisor = Supervisor.objects.create(
            user=supervisor_user,
            supervisor_id="GV-STAGE-GUARD",
        )
        self.project = GraduationProject.objects.create(
            student=student,
            supervisor=supervisor,
            batch=self.batch,
            topic_title_vi="Đề tài ban đầu",
        )
        self.client.force_authenticate(user=self.student_user)

    def test_phase_3_topic_draft_is_blocked_while_batch_is_in_phase_2(self):
        response = self.client.post(
            "/api/graduation-project/topic-draft/",
            {"topic_title_vi": "Không được lưu ở GĐ2"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data["current_stage"], 2)
        self.project.refresh_from_db()
        self.assertEqual(self.project.topic_title_vi, "Đề tài ban đầu")

    def test_phase_3_topic_draft_is_allowed_after_batch_enters_phase_3(self):
        self.batch.current_stage = "PHASE_3_TOPIC"
        self.batch.save(update_fields=["current_stage"])

        response = self.client.post(
            "/api/graduation-project/topic-draft/",
            {"topic_title_vi": "Đề tài được phép ở GĐ3"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.project.refresh_from_db()
        self.assertEqual(self.project.topic_title_vi, "Đề tài được phép ở GĐ3")
