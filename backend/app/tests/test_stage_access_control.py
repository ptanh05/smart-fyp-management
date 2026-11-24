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

    def test_approved_outline_does_not_open_weekly_reports_before_stage_5(self):
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

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data["required_stage"], 5)

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

    def test_weekly_reports_continue_after_supervisor_eval_and_during_stage_5(self):
        self.batch.current_stage = "PHASE_5_IN_PROGRESS"
        self.batch.save(update_fields=["current_stage"])
        self.project.status = "OUTLINE_APPROVED"
        self.project.save(update_fields=["status"])

        # 1. Student submits Week 1 report
        r1 = self.client.post(
            "/api/student/weekly-reports/",
            {"week_number": 1, "summary_content": "Báo cáo tuần 1", "planned_tasks": "Kế hoạch tuần 2"},
            format="json",
        )
        self.assertEqual(r1.status_code, status.HTTP_200_OK)
        report_id = r1.data["report"]["id"]

        # 2. Supervisor evaluates Week 1 report
        self.client.force_authenticate(user=self.supervisor_user)
        fb = self.client.post(
            "/api/supervisor/weekly-feedback/",
            {"report_id": report_id, "rating": "GOOD", "feedback": "Tiến độ rất tốt"},
            format="json",
        )
        self.assertEqual(fb.status_code, status.HTTP_200_OK)

        # 3. Supervisor can edit their feedback without getting locked out
        fb2 = self.client.post(
            "/api/supervisor/weekly-feedback/",
            {"report_id": report_id, "rating": "ACCEPTABLE", "feedback": "Đã cập nhật: chấp nhận được"},
            format="json",
        )
        self.assertEqual(fb2.status_code, status.HTTP_200_OK)

        # 4. Student can submit Week 2 report even after Week 1 was evaluated
        self.client.force_authenticate(user=self.student_user)
        r2 = self.client.post(
            "/api/student/weekly-reports/",
            {"week_number": 2, "summary_content": "Báo cáo tuần 2", "planned_tasks": "Kế hoạch tuần 3"},
            format="json",
        )
        self.assertEqual(r2.status_code, status.HTTP_200_OK)

        # 5. Weekly reports continue throughout GĐ5
        r3 = self.client.post(
            "/api/student/weekly-reports/",
            {"week_number": 3, "summary_content": "Báo cáo tuần 3 trong GĐ5", "planned_tasks": "Kế hoạch tuần 4"},
            format="json",
        )
        self.assertEqual(r3.status_code, status.HTTP_200_OK)

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
        self.assertTrue(first_submit.data["task"]["is_completed"])
        self.assertEqual(first_submit.data["task"]["status"], "COMPLETED")

        self.client.force_authenticate(user=self.supervisor_user)
        review = self.client.post(
            f"/api/supervisor/tasks/{task.id}/review/",
            {"verdict": "REVISION_REQUIRED", "notes": "Cần bổ sung kiểm thử"},
            format="json",
        )
        self.assertEqual(review.status_code, status.HTTP_200_OK)
        self.assertFalse(review.data["task"]["is_completed"])
        self.assertEqual(review.data["task"]["status"], "IN_PROGRESS")

        self.client.force_authenticate(user=self.student_user)
        second_submit = self.client.post(
            f"/api/student/tasks/{task.id}/submit-deliverable/",
            {"deliverable_url": "https://example.com/submission-2", "student_notes": "Đã bổ sung kiểm thử"},
            format="json",
        )
        self.assertEqual(second_submit.status_code, status.HTTP_200_OK)
        self.assertTrue(second_submit.data["task"]["is_completed"])

        tasks_response = self.client.get("/api/student/tasks/")
        self.assertEqual(tasks_response.status_code, status.HTTP_200_OK)
        saved_task = next(item for item in tasks_response.data["tasks"] if item["id"] == task.id)
        self.assertEqual(
            [entry["event"] for entry in saved_task["submission_history"]],
            ["SUBMITTED", "REVISION_REQUIRED", "RESUBMITTED"],
        )

    def test_supervisor_can_complete_stage_5_only_after_all_tasks_are_accepted(self):
        self.batch.current_stage = "PHASE_5_IN_PROGRESS"
        self.batch.save(update_fields=["current_stage"])
        accepted_task = SupervisionTask.objects.create(
            project=self.project,
            assigned_by=self.supervisor,
            title="Nhiệm vụ đã đạt",
            review_verdict="ACCEPTED",
            status="COMPLETED",
            is_completed=True,
            deliverable_url="https://example.com/accepted",
            student_notes="Đã hoàn thành đầy đủ",
        )
        pending_task = SupervisionTask.objects.create(
            project=self.project,
            assigned_by=self.supervisor,
            title="Nhiệm vụ chưa đánh giá",
            review_verdict="PENDING",
            status="COMPLETED",
            is_completed=True,
            deliverable_url="https://example.com/pending",
            student_notes="Chờ giảng viên đánh giá",
        )
        self.client.force_authenticate(user=self.supervisor_user)

        blocked = self.client.post(f"/api/supervisor/projects/{self.project.id}/complete-stage-5/")
        self.assertEqual(blocked.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(blocked.data["incomplete_count"], 1)

        pending_task.review_verdict = "ACCEPTED"
        pending_task.save(update_fields=["review_verdict"])
        completed = self.client.post(f"/api/supervisor/projects/{self.project.id}/complete-stage-5/")

        self.assertEqual(completed.status_code, status.HTTP_200_OK)
        self.project.refresh_from_db()
        self.assertTrue(self.project.is_eligible_for_defense)
        self.assertTrue(self.project.supervisor_defense_confirmed)
        self.assertEqual(self.project.status, "DEFENSE_READY")

    def test_student_cannot_complete_and_supervisor_cannot_review_without_submission_evidence(self):
        self.batch.current_stage = "PHASE_5_IN_PROGRESS"
        self.batch.save(update_fields=["current_stage"])
        task = SupervisionTask.objects.create(
            project=self.project,
            assigned_by=self.supervisor,
            title="Nhiệm vụ chưa có sản phẩm",
        )

        student_complete = self.client.patch(
            f"/api/student/tasks/{task.id}/complete/",
            {"is_completed": True},
            format="json",
        )
        self.assertEqual(student_complete.status_code, status.HTTP_400_BAD_REQUEST)

        self.client.force_authenticate(user=self.supervisor_user)
        supervisor_review = self.client.post(
            f"/api/supervisor/tasks/{task.id}/review/",
            {"verdict": "ACCEPTED", "notes": "Đạt"},
            format="json",
        )
        self.assertEqual(supervisor_review.status_code, status.HTTP_409_CONFLICT)

    def test_topic_approved_student_cannot_submit_weekly_report_in_stage_4(self):
        """Khoa duyệt đề cương chỉ mở GĐ4 nộp bản nháp; báo cáo tuần thuộc GĐ5."""
        self.project.topic_review_status = "APPROVED"
        self.project.outline_pdf_path = "outlines/1_signed.pdf"
        self.project.save(update_fields=["topic_review_status", "outline_pdf_path"])

        self.client.force_authenticate(user=self.student_user)
        res = self.client.post(
            "/api/student/weekly-reports/",
            {"week_number": 1, "summary_content": "Báo cáo tuần 1 sau khi Khoa duyệt đề cương"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(res.data["required_stage"], 5)

    def test_force_approved_student_still_waits_until_stage_5_for_weekly_reports(self):
        """Đặc cách mở GĐ4 bản nháp, không mở sớm báo cáo tuần của GĐ5."""
        self.project.initial_eligibility = "FORCE_APPROVED"
        self.project.status = "IN_PROGRESS"
        self.project.save(update_fields=["initial_eligibility", "status"])

        self.client.force_authenticate(user=self.student_user)
        res = self.client.post(
            "/api/student/weekly-reports/",
            {"week_number": 1, "summary_content": "Báo cáo tuần 1 sinh viên đặc cách"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(res.data["required_stage"], 5)
