from rest_framework import status
from rest_framework.test import APITestCase, APIClient

from app.models import (
    AcademicBatch,
    CouncilLiveScore,
    CouncilMember,
    CourseClass,
    CustomUser,
    DefenseCouncil,
    EvaluationPolicy,
    FinalGradeSummary,
    GraduationProject,
    ProjectTopicArea,
    Student,
    Supervisor,
)


class GD6LiveFixesTests(APITestCase):
    client: APIClient

    def setUp(self):
        super().setUp()
        self.client = APIClient()
        self.batch = AcademicBatch.objects.create(
            batch_code="GD6_FIX_2026",
            batch_name="Đợt Fix GĐ6",
            current_stage="PHASE_6_DEFENSE",
            is_active=True,
        )
        EvaluationPolicy.objects.create(
            batch=self.batch,
            weight_supervisor=0.3,
            weight_reviewer=0.2,
            weight_council=0.5,
        )
        self.topic_area = ProjectTopicArea.objects.create(
            name="AI & Data", code="AI_FIX", is_active=True
        )
        self.course_class = CourseClass.objects.create(
            batch=self.batch,
            class_code="CNTT.K63.01",
            class_name="CNTT K63",
            program_type="DAI_TRA",
        )

        self.sup = self._make_sup("gv_hd", "Huấn", "Vũ", "PGS.TS")
        self.chair = self._make_sup("gv_chair", "Long", "Nguyễn Văn", "TS")
        self.sec1 = self._make_sup("gv_sec1", "Ngân", "Trần Thị", "ThS")
        self.sec2 = self._make_sup("gv_sec2", "Dũng", "Bùi Ngọc", "ThS")
        self.mem1 = self._make_sup("gv_mem1", "Luyến", "Cao Thị", "TS")
        self.mem2 = self._make_sup("gv_mem2", "Thông", "Hoàng Văn", "TS")

        self.st_user = CustomUser.objects.create_user(
            username="999000001", email="999000001@lms.utc.edu.vn", password="x",
            first_name="Một", last_name="Nguyễn Test", user_type="student"
        )
        self.st = Student.objects.create(
            user=self.st_user, registration_no="999000001",
            academic_batch=self.batch, course_class=self.course_class
        )

        self.council = DefenseCouncil.objects.create(
            batch=self.batch, council_number=1, council_name="Hội đồng 1", defense_room="P301"
        )
        self.m_chair = CouncilMember.objects.create(council=self.council, supervisor=self.chair, user=self.chair.user, role="CHAIR")
        self.m_sec1 = CouncilMember.objects.create(council=self.council, supervisor=self.sec1, user=self.sec1.user, role="SECRETARY")
        self.m_sec2 = CouncilMember.objects.create(council=self.council, supervisor=self.sec2, user=self.sec2.user, role="SECRETARY")
        self.m_mem1 = CouncilMember.objects.create(council=self.council, supervisor=self.mem1, user=self.mem1.user, role="MEMBER")
        self.m_mem2 = CouncilMember.objects.create(council=self.council, supervisor=self.mem2, user=self.mem2.user, role="MEMBER")

        self.proj = GraduationProject.objects.create(
            student=self.st,
            supervisor=self.sup,
            reviewer=self.chair,
            council=self.council,
            batch=self.batch,
            topic_category=self.topic_area,
            topic_title_vi="Đề tài test GĐ6",
            status="DEFENSE_READY",
            is_eligible_for_defense=True,
            supervisor_score=8.5,
            reviewer_score=8.0,
        )

    def _make_sup(self, username, first_name, last_name, title):
        user = CustomUser.objects.create_user(
            username=username, email=f"{username}@utc.edu.vn", password="x",
            first_name=first_name, last_name=last_name, user_type="supervisor"
        )
        return Supervisor.objects.create(
            user=user, supervisor_id=username.upper(), academic_title=title, department_name="CNTT"
        )

    def test_no_premature_passed_on_partial_score_or_while_defending(self):
        # Chair starts turn -> DEFENDING
        self.client.force_authenticate(user=self.chair.user)
        start_res = self.client.post(
            "/app/council/chair/set-defense-status/",
            {"council_id": self.council.id, "project_id": self.proj.id, "defense_status": "DEFENDING"},
            format="json",
        )
        self.assertEqual(start_res.status_code, status.HTTP_200_OK)

        # Reviewer conflict check: chair IS reviewer -> 403
        conflict_res = self.client.post(
            "/app/council/submit-score/",
            {"council_id": self.council.id, "project_id": self.proj.id, "score_presentation": 2.5, "score_content": 2.5, "score_qa": 1.8, "score_demo": 1.7},
            format="json",
        )
        self.assertEqual(conflict_res.status_code, status.HTTP_403_FORBIDDEN)

        # First eligible member scores 8.5 -> still DEFENDING (1/4)
        self.client.force_authenticate(user=self.sec1.user)
        s1 = self.client.post(
            "/app/council/submit-score/",
            {"council_id": self.council.id, "project_id": self.proj.id, "score_presentation": 2.5, "score_content": 2.5, "score_qa": 1.8, "score_demo": 1.7},
            format="json",
        )
        self.assertEqual(s1.status_code, status.HTTP_200_OK)
        self.proj.refresh_from_db()
        self.assertEqual(self.proj.status, "DEFENDING")

        # Remaining 3 eligible members score 8.5 -> still DEFENDING until Chair ends turn
        for sup in (self.sec2, self.mem1, self.mem2):
            self.client.force_authenticate(user=sup.user)
            r = self.client.post(
                "/app/council/submit-score/",
                {"council_id": self.council.id, "project_id": self.proj.id, "score_presentation": 2.5, "score_content": 2.5, "score_qa": 1.8, "score_demo": 1.7},
                format="json",
            )
            self.assertEqual(r.status_code, status.HTTP_200_OK)

        self.proj.refresh_from_db()
        self.assertEqual(self.proj.status, "DEFENDING")

        # Chair ends turn -> transitions cleanly to PASSED since 4/4 scored + summary exists
        self.client.force_authenticate(user=self.chair.user)
        end_res = self.client.post(
            "/app/council/chair/set-defense-status/",
            {"council_id": self.council.id, "project_id": self.proj.id, "defense_status": "DEFENDED"},
            format="json",
        )
        self.assertEqual(end_res.status_code, status.HTTP_200_OK)
        self.proj.refresh_from_db()
        self.assertEqual(self.proj.status, "PASSED")

        # Lock council -> live-session MUST return 200 (not 500 AttributeError on locked_at)
        lock_res = self.client.post(
            "/app/council/toggle-lock/",
            {"council_id": self.council.id, "lock": True},
            format="json",
        )
        self.assertEqual(lock_res.status_code, status.HTTP_200_OK)

        live_res = self.client.get(
            f"/app/council/live-session/?council_id={self.council.id}&batch_id={self.batch.id}"
        )
        self.assertEqual(live_res.status_code, status.HTTP_200_OK)
        self.assertTrue(live_res.data["council"]["is_locked"])

        # Export consolidated report -> 200 Excel (no ProgrammingError on missing legacy table)
        export_res = self.client.get("/app/export/consolidated-report/")
        self.assertEqual(export_res.status_code, status.HTTP_200_OK)
        self.assertIn("spreadsheetml.sheet", export_res["Content-Type"])

        # Student profile exposes full grade breakdown & names for UTCEvaluationSheetModal
        self.client.force_authenticate(user=self.st_user)
        prof_res = self.client.get("/app/student/profile/")
        self.assertEqual(prof_res.status_code, status.HTTP_200_OK)
        gp = prof_res.data["graduation_project"]
        self.assertIn("Long", gp["reviewer_name"])
        self.assertEqual(gp["council_name"], "Hội đồng 1")
        self.assertIn("Long", gp["council_chair_name"])
        self.assertEqual(gp["final_grade"]["council_avg_score"], 8.5)
        self.assertEqual(gp["final_grade"]["final_score_10"], 8.4)
        self.assertEqual(gp["final_grade"]["final_letter_grade"], "B+")
