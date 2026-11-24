"""
Hồi quy end-to-end cho lộ trình 6 giai đoạn qua API thật của Cổng Người dùng.

Mỗi test tương ứng một kịch bản bắt buộc (đánh số theo yêu cầu 1..10, 15):
kiểm tra cả payload `workflow` (nguồn hiển thị) và guard ghi (409) phải khớp nhau.
"""
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from app import workflow_stages
from app.models import AcademicBatch, CustomUser, GraduationProject, Student, Supervisor, SupervisionTask


class WorkflowStageRegressionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.batch = AcademicBatch.objects.create(
            batch_code="WF_STAGE_2026",
            batch_name="Workflow Stage",
            current_stage="PHASE_1_SETUP",
            is_active=True,
        )
        self.student_user = CustomUser.objects.create_user(
            username="wf_student", password="password123", user_type="student"
        )
        self.student = Student.objects.create(
            user=self.student_user, registration_no="WF0001", academic_batch=self.batch
        )
        self.supervisor_user = CustomUser.objects.create_user(
            username="wf_supervisor", password="password123", user_type="supervisor"
        )
        self.supervisor = Supervisor.objects.create(user=self.supervisor_user, supervisor_id="GV-WF-1")
        self.reviewer_user = CustomUser.objects.create_user(
            username="wf_reviewer", password="password123", user_type="supervisor"
        )
        self.reviewer = Supervisor.objects.create(user=self.reviewer_user, supervisor_id="GV-WF-2")
        self.project = None

    # ------------------------------------------------------------------ helpers
    def auth(self, user):
        # Nạp lại user như một request thật (tránh cache quan hệ ngược trong bộ nhớ).
        self.client.force_authenticate(user=CustomUser.objects.get(pk=user.pk))

    def set_batch(self, stage, **extra):
        self.batch.current_stage = stage
        for key, value in extra.items():
            setattr(self.batch, key, value)
        self.batch.save()

    def create_project(self, **fields):
        self.project = GraduationProject.objects.create(
            student=self.student,
            supervisor=self.supervisor,
            reviewer=self.reviewer,
            batch=self.batch,
            topic_title_vi="Đề tài kiểm thử giai đoạn",
            **fields,
        )
        return self.project

    def update_project(self, **fields):
        for key, value in fields.items():
            setattr(self.project, key, value)
        self.project.save()

    def student_workflow(self):
        self.auth(self.student_user)
        response = self.client.get("/api/batches/progress/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("workflow", response.data)
        self.assertEqual(response.data["workflow"], response.data["my_project"]["workflow"])
        return response.data["workflow"]

    def supervisor_item(self):
        self.auth(self.supervisor_user)
        response = self.client.get(f"/api/supervisor/graduation-projects/?batch_id={self.batch.id}")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return next(item for item in response.data if item.get("id") == self.project.id)

    def post_weekly_report(self, week=1):
        self.auth(self.student_user)
        return self.client.post(
            "/api/student/weekly-reports/",
            {
                "week_number": week,
                "summary_content": "Đã hoàn thành phân tích yêu cầu.",
                "planned_tasks": "Thiết kế cơ sở dữ liệu.",
            },
        )

    def post_supervisor_task(self):
        self.auth(self.supervisor_user)
        return self.client.post(
            "/api/supervisor/tasks/",
            {"project_id": self.project.id, "title": "Nhiệm vụ GĐ5", "description": "Xây dựng API"},
            format="json",
        )

    def post_reviewer_score(self):
        self.auth(self.reviewer_user)
        return self.client.post(
            "/api/reviewer/submit-evaluation/",
            {"project_id": self.project.id, "reviewer_score": 8.0, "reviewer_feedback": "Tốt"},
            format="json",
        )

    def post_supervisor_evaluation(self):
        self.auth(self.supervisor_user)
        return self.client.post(
            "/api/supervisor/defense-evaluation/",
            {
                "project_id": self.project.id,
                "supervisor_score": 8.0,
                "supervisor_feedback": "Đạt yêu cầu",
                "is_eligible_for_defense": True,
            },
            format="json",
        )

    def assert_conflict(self, response, current, required):
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT, getattr(response, "data", None))
        self.assertEqual(response.data["current_stage"], current)
        self.assertEqual(response.data["required_stage"], required)
        self.assertIn("reason", response.data)

    # -------------------------------------------------------------------- tests
    def test_01_gd1_done_opens_gd2(self):
        self.assertEqual(self.student_workflow()["current_stage_number"], 1)
        self.set_batch("PHASE_2_ALLOCATING")
        workflow = self.student_workflow()
        self.assertEqual(workflow["current_stage_number"], 2)
        self.assertEqual(workflow["current_stage_key"], "survey")
        self.assertEqual(workflow["stages"][0]["status"], "completed")
        self.assertTrue(workflow["stages"][1]["editable"])
        self.assertEqual(workflow["stages"][2]["status"], "locked")

    def test_02_gd2_done_opens_gd3(self):
        self.set_batch("PHASE_2_LOCKED")
        self.create_project(status="ALLOCATED")
        self.assertEqual(self.student_workflow()["current_stage_number"], 2)
        self.set_batch("PHASE_3_TOPIC")
        workflow = self.student_workflow()
        self.assertEqual(workflow["current_stage_number"], 3)
        self.assertEqual(workflow["stages"][1]["status"], "completed")
        self.auth(self.student_user)
        response = self.client.post(
            "/api/graduation-project/topic-draft/", {"topic_title_vi": "Đề tài GĐ3"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_03_outline_sent_to_supervisor_only_stays_gd3(self):
        self.set_batch("PHASE_3_TOPIC")
        self.create_project(status="OUTLINE_PENDING", topic_review_status="DRAFT")
        workflow = self.student_workflow()
        self.assertEqual(workflow["current_stage_number"], 3)
        self.assertEqual(workflow["current_step_key"], "outline_waiting_supervisor")
        self.assertIn("chờ GVHD", workflow["stages"][3]["reason"])
        self.assert_conflict(self.post_weekly_report(), 3, 4)

    def test_04_supervisor_approved_without_faculty_stays_gd3(self):
        self.set_batch("PHASE_3_TOPIC")
        self.create_project(status="OUTLINE_PENDING", topic_review_status="GV_CONFIRMED")
        workflow = self.student_workflow()
        self.assertEqual(workflow["current_stage_number"], 3)
        self.assertEqual(workflow["current_step_key"], "outline_waiting_faculty")
        self.assertIn("chờ Khoa", workflow["stages"][3]["reason"])
        self.assert_conflict(self.post_weekly_report(), 3, 4)

    def test_05_faculty_approval_opens_gd4(self):
        self.set_batch("PHASE_3_TOPIC")
        self.create_project(status="OUTLINE_PENDING", topic_review_status="GV_CONFIRMED")
        # Khoa phê duyệt đề cương (Admin OutlineReviewDetailAPIView ghi đúng 2 trường này).
        self.update_project(status="OUTLINE_APPROVED", topic_review_status="APPROVED")
        workflow = self.student_workflow()
        self.assertEqual(workflow["current_stage_number"], 4)
        self.assertEqual(workflow["stages"][2]["status"], "completed")
        self.assertFalse(workflow["stages"][2]["editable"])
        self.assertEqual(self.post_weekly_report().status_code, status.HTTP_200_OK)
        self.auth(self.student_user)
        topic_edit = self.client.post(
            "/api/graduation-project/topic-draft/", {"topic_title_vi": "Sửa muộn"}, format="json"
        )
        self.assert_conflict(topic_edit, 4, 3)
        self.assertTrue(topic_edit.data["read_only"])

    def test_06_gd4_incomplete_keeps_gd5_locked(self):
        self.set_batch("PHASE_4_ELIGIBILITY")
        self.create_project(status="IN_PROGRESS", topic_review_status="APPROVED", initial_eligibility="ELIGIBLE")
        workflow = self.student_workflow()
        self.assertEqual(workflow["current_stage_number"], 4)
        self.assertEqual(workflow["stages"][4]["status"], "locked")
        self.assertFalse(workflow["stages"][4]["accessible"])
        self.assert_conflict(self.post_supervisor_task(), 4, 5)

        # Không đủ ĐK (chờ đặc cách): đợt sang GĐ5 nhưng đồ án vẫn dừng ở GĐ4.
        self.update_project(status="OUTLINE_APPROVED", initial_eligibility="INELIGIBLE")
        self.set_batch("PHASE_5_IN_PROGRESS")
        workflow = self.student_workflow()
        self.assertEqual(workflow["current_stage_number"], 4)
        self.assertEqual(workflow["current_step_key"], "waiting_force_approval")
        self.assert_conflict(self.post_supervisor_task(), 4, 5)

    def test_07_execution_confirmation_moves_gd5_to_gd6(self):
        self.set_batch("PHASE_5_IN_PROGRESS")
        self.create_project(status="IN_PROGRESS", topic_review_status="APPROVED", initial_eligibility="ELIGIBLE")
        self.assertEqual(self.student_workflow()["current_stage_number"], 5)
        self.assertEqual(self.post_supervisor_task().status_code, status.HTTP_201_CREATED)
        SupervisionTask.objects.filter(project=self.project).update(
            review_verdict="ACCEPTED",
            status="COMPLETED",
            is_completed=True,
            deliverable_url="https://example.com/result",
            student_notes="Đã hoàn thành",
        )
        # Chưa xác nhận hoàn thành GĐ5 -> GĐ6 vẫn khóa, chưa được đánh giá.
        self.assert_conflict(self.post_supervisor_evaluation(), 5, 6)

        self.auth(self.supervisor_user)
        confirm = self.client.post(f"/api/supervisor/projects/{self.project.id}/complete-stage-5/")
        self.assertEqual(confirm.status_code, status.HTTP_200_OK)

        workflow = self.student_workflow()
        self.assertEqual(workflow["current_stage_number"], 6)
        self.assertEqual(workflow["stages"][4]["status"], "completed")
        self.assertTrue(workflow["defense_eligible"])
        self.assert_conflict(self.post_supervisor_task(), 6, 5)
        self.assertEqual(self.post_reviewer_score().status_code, status.HTTP_200_OK)

    def test_08_not_eligible_for_defense_blocks_gd6_scoring(self):
        self.set_batch("PHASE_6_DEFENSE")
        self.create_project(status="IN_PROGRESS", topic_review_status="APPROVED", initial_eligibility="ELIGIBLE")
        workflow = self.student_workflow()
        self.assertEqual(workflow["current_stage_number"], 6)
        self.assertFalse(workflow["defense_eligible"])
        self.assertEqual(workflow["current_step_key"], "defense_not_eligible")
        response = self.post_reviewer_score()
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.project.refresh_from_db()
        self.assertIsNone(self.project.reviewer_score)

    def test_09_deferred_or_disqualified_never_auto_advance(self):
        self.set_batch("PHASE_6_DEFENSE")
        self.create_project(
            status="DEFERRED",
            topic_review_status="APPROVED",
            initial_eligibility="ELIGIBLE",
            deferral_status="APPROVED",
        )
        workflow = self.student_workflow()
        self.assertEqual(workflow["current_stage_number"], 4)
        self.assertTrue(workflow["is_blocked"])
        self.assertEqual([s["status"] for s in workflow["stages"]][4:], ["locked", "locked"])
        self.assertFalse(any(s["editable"] for s in workflow["stages"]))
        self.assertEqual(self.post_weekly_report().status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(self.post_supervisor_evaluation().status_code, status.HTTP_409_CONFLICT)

        self.set_batch("PHASE_5_IN_PROGRESS")
        self.update_project(status="DISQUALIFIED", initial_eligibility="DISQUALIFIED", deferral_status="NONE")
        workflow = self.student_workflow()
        self.assertEqual(workflow["current_stage_number"], 4)
        self.assertEqual(workflow["block_kind"], "disqualified")
        self.assertEqual(self.post_supervisor_task().status_code, status.HTTP_409_CONFLICT)

    def test_10_defended_project_is_terminal(self):
        self.set_batch("PHASE_6_DEFENSE")
        self.create_project(
            status="PASSED",
            topic_review_status="APPROVED",
            is_eligible_for_defense=True,
            supervisor_score=8.0,
            reviewer_score=8.5,
        )
        workflow = self.student_workflow()
        self.assertEqual(workflow["current_stage_number"], 6)
        self.assertTrue(workflow["is_finished"])
        self.assertEqual(workflow["overall_percent"], 100)
        self.assertEqual({s["status"] for s in workflow["stages"]}, {"completed"})
        self.assertEqual(self.post_reviewer_score().status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(self.post_supervisor_evaluation().status_code, status.HTTP_409_CONFLICT)

    def test_closed_batch_is_read_only(self):
        self.set_batch("PHASE_6_DEFENSE")
        self.create_project(status="DEFENSE_READY", topic_review_status="APPROVED", is_eligible_for_defense=True)
        self.set_batch("COMPLETED", is_closed=True, is_active=False)
        self.assertEqual(self.post_supervisor_evaluation().status_code, status.HTTP_409_CONFLICT)
        self.set_batch("PHASE_6_DEFENSE", is_closed=False, is_active=True)
        self.assertEqual(self.post_supervisor_evaluation().status_code, status.HTTP_200_OK)

    def test_15_student_supervisor_admin_see_same_stage(self):
        scenarios = [
            ("PHASE_3_TOPIC", {"status": "OUTLINE_PENDING", "topic_review_status": "GV_CONFIRMED"}),
            ("PHASE_3_TOPIC", {"status": "OUTLINE_APPROVED", "topic_review_status": "APPROVED"}),
            ("PHASE_5_IN_PROGRESS", {"status": "IN_PROGRESS", "topic_review_status": "APPROVED"}),
            ("PHASE_5_IN_PROGRESS", {"status": "DEFENSE_READY", "is_eligible_for_defense": True}),
            ("PHASE_6_DEFENSE", {"status": "DEFERRED", "deferral_status": "APPROVED"}),
        ]
        self.create_project(status="ALLOCATED")
        for stage, fields in scenarios:
            with self.subTest(stage=stage, fields=fields):
                self.set_batch(stage)
                self.update_project(**fields)
                student_stage = self.student_workflow()["current_stage_number"]
                item = self.supervisor_item()
                self.assertEqual(item["workflow_stage_number"], student_stage)
                self.assertEqual(item["workflow"]["current_stage_number"], student_stage)

                self.auth(self.student_user)
                profile = self.client.get("/api/student/profile/")
                self.assertEqual(profile.status_code, status.HTTP_200_OK)
                self.assertEqual(
                    profile.data["graduation_project"]["workflow"]["current_stage_number"], student_stage
                )
                detail = self.client.get("/api/student/graduation-project/")
                self.assertEqual(detail.data["workflow"]["current_stage_number"], student_stage)

                # Admin Portal dùng bản sao giống hệt module này (contract test kiểm tra).
                fresh = GraduationProject.objects.select_related("batch").get(pk=self.project.pk)
                self.assertEqual(workflow_stages.resolve_project_stage(fresh), student_stage)
