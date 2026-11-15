from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from app.models import AcademicBatch, CustomUser, GraduationProject, Student, Supervisor, SupervisionTask


class StageAccessControlTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.student_user = CustomUser.objects.create_user(
            username="241106060",
            password="password123",
            user_type="student",
        )
        self.supervisor_user = CustomUser.objects.create_user(
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
        self.supervisor = Supervisor.objects.create(
            user=self.supervisor_user,
            supervisor_id="GV-STAGE-GUARD",
        )
        self.project = GraduationProject.objects.create(
            student=student,
            supervisor=self.supervisor,
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

    def test_student_cannot_modify_completed_stage(self):
        self.batch.current_stage = "PHASE_4_ELIGIBILITY"
        self.batch.save(update_fields=["current_stage"])

        response = self.client.post(
            "/api/graduation-project/topic-draft/",
            {"topic_title_vi": "Không được sửa lại sau khi qua GĐ3"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data["current_stage"], 4)
        self.assertEqual(response.data["required_stage"], 3)
        self.assertTrue(response.data["read_only"])
        self.project.refresh_from_db()
        self.assertEqual(self.project.topic_title_vi, "Đề tài ban đầu")

    def test_supervisor_cannot_modify_completed_stage(self):
        self.batch.current_stage = "PHASE_4_ELIGIBILITY"
        self.batch.save(update_fields=["current_stage"])
        self.client.force_authenticate(user=self.supervisor_user)

        response = self.client.post(
            "/api/graduation-project/confirm-topic/",
            {
                "project_id": self.project.id,
                "topic_title_vi": "GV không được sửa sau khi qua GĐ3",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertTrue(response.data["read_only"])
        self.project.refresh_from_db()
        self.assertEqual(self.project.topic_title_vi, "Đề tài ban đầu")

    def test_approved_outline_opens_weekly_reports_before_batch_advances(self):
        self.batch.current_stage = "PHASE_3_TOPIC"
        self.batch.save(update_fields=["current_stage"])
        self.project.status = "OUTLINE_APPROVED"
        self.project.save(update_fields=["status"])

        response = self.client.post(
            "/api/student/weekly-reports/",
            {
                "week_number": 1,
                "summary_content": "Hoàn thành thiết kế cơ sở dữ liệu",
                "planned_tasks": "Xây dựng API tuần tiếp theo",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["report"]["week_number"], 1)

    def test_approved_outline_makes_phase_3_read_only_even_if_batch_is_phase_3(self):
        self.batch.current_stage = "PHASE_3_TOPIC"
        self.batch.save(update_fields=["current_stage"])
        self.project.status = "OUTLINE_APPROVED"
        self.project.save(update_fields=["status"])

        response = self.client.post(
            "/api/graduation-project/topic-draft/",
            {"topic_title_vi": "Không được quay lại sửa đề tài"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data["current_stage"], 4)
        self.assertTrue(response.data["read_only"])

    def test_task_submission_and_review_history_is_persisted(self):
        self.batch.current_stage = "PHASE_5_IN_PROGRESS"
        self.batch.save(update_fields=["current_stage"])
        task = SupervisionTask.objects.create(
            project=self.project,
            assigned_by=self.supervisor,
            title="Hoàn thiện chức năng đăng nhập",
        )

        first_submit = self.client.post(
            f"/api/student/tasks/{task.id}/submit-deliverable/",
            {"deliverable_url": "https://example.com/submission-1", "student_notes": "Bản nộp đầu tiên"},
            format="json",
        )
        self.assertEqual(first_submit.status_code, status.HTTP_200_OK)

        self.client.force_authenticate(user=self.supervisor_user)
        review = self.client.post(
            f"/api/supervisor/tasks/{task.id}/review/",
            {"verdict": "REVISION_REQUIRED", "notes": "Cần bổ sung kiểm thử"},
            format="json",
        )
        self.assertEqual(review.status_code, status.HTTP_200_OK)

        self.client.force_authenticate(user=self.student_user)
        second_submit = self.client.post(
            f"/api/student/tasks/{task.id}/submit-deliverable/",
            {"deliverable_url": "https://example.com/submission-2", "student_notes": "Đã bổ sung kiểm thử"},
            format="json",
        )
        self.assertEqual(second_submit.status_code, status.HTTP_200_OK)

        tasks_response = self.client.get("/api/student/tasks/")
        self.assertEqual(tasks_response.status_code, status.HTTP_200_OK)
        saved_task = next(item for item in tasks_response.data["tasks"] if item["id"] == task.id)
        self.assertEqual(
            [entry["event"] for entry in saved_task["submission_history"]],
            ["SUBMITTED", "REVISION_REQUIRED", "RESUBMITTED"],
        )
