"""
Tests for smart-fyp-management enhancement suite:
- OpenAPI 3.0 schema & Swagger UI docs
- BatchMilestonesPublicAPIView
- StudentSurveyAPIView supplementary registration unlock for unassigned students + CloseBatch guard
- SupervisorDeferralFeedbackAPIView + AdminCreateDeferralAPIView
- DefenseMinutesSignAPIView (5 council signatures + live session sync + non-member 403)
- RoleHomeSummaryAPIView (Todos, Deadline countdown, AT_RISK / BEHIND / ON_TRACK classification)
- SessionTrackingJWTAuthentication revocation & dynamic SecurityPolicy lockout
"""
import datetime

from django.core.cache import cache
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from app.models import (
    AcademicBatch,
    BatchMilestone,
    CouncilMember,
    CustomUser,
    DefenseCouncil,
    DefenseMinutesSignature,
    GraduationProject,
    ProjectTopicArea,
    SecurityPolicy,
    Student,
    SupervisionTask,
    Supervisor,
    ThesisDeferralRequest,
    UserSessionLog,
    WeeklyProgressReport,
)


class ClientEnhancementsBase(APITestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.batch = AcademicBatch.objects.create(
            batch_code="K64-CL",
            batch_name="Đợt Client K64",
            current_stage="PHASE_3_TOPIC",
            is_active=True,
            is_closed=False,
        )
        self.topic = ProjectTopicArea.objects.create(code="CL_SW", name="Công nghệ phần mềm", is_active=True)

        self.admin = CustomUser.objects.create_user(
            username="cl_admin", email="cl_admin@utc.edu.vn", password="AdminPass123!", user_type="admin", is_staff=True
        )
        self.sup1_user = CustomUser.objects.create_user(
            username="cl_gv1", email="cl_gv1@utc.edu.vn", password="GvPass123!", user_type="supervisor", first_name="Hải"
        )
        self.sup1 = Supervisor.objects.create(user=self.sup1_user, supervisor_id="CLGV1", academic_title="TS")

        self.sup2_user = CustomUser.objects.create_user(
            username="cl_gv2", email="cl_gv2@utc.edu.vn", password="GvPass123!", user_type="supervisor", first_name="Lan"
        )
        self.sup2 = Supervisor.objects.create(user=self.sup2_user, supervisor_id="CLGV2", academic_title="TS")

        self.sv1_user = CustomUser.objects.create_user(
            username="cl_sv1", email="cl_sv1@utc.edu.vn", password="SvPass123!", user_type="student", first_name="Minh"
        )
        self.sv1 = Student.objects.create(user=self.sv1_user, registration_no="20261001", academic_batch=self.batch)

        self.sv2_user = CustomUser.objects.create_user(
            username="cl_sv2", email="cl_sv2@utc.edu.vn", password="SvPass123!", user_type="student", first_name="Nam"
        )
        self.sv2 = Student.objects.create(user=self.sv2_user, registration_no="20261002", academic_batch=self.batch)


class ClientOpenAPIAndSupplementaryTests(ClientEnhancementsBase):
    def test_openapi_docs_and_public_milestones(self):
        schema = self.client.get("/api/schema/")
        self.assertEqual(schema.status_code, status.HTTP_200_OK)
        self.assertEqual(schema.json()["openapi"], "3.0.3")

        now = timezone.now()
        BatchMilestone.objects.create(
            batch=self.batch,
            name="Nộp đề cương ĐATN",
            stage_number=3,
            start_date=now - datetime.timedelta(days=1),
            end_date=now + datetime.timedelta(days=4),
            is_active=True,
        )
        self.client.force_authenticate(user=self.sv1_user)
        ms_res = self.client.get("/app/batches/milestones/")
        self.assertEqual(ms_res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(ms_res.data["milestones"]), 1)
        self.assertEqual(ms_res.data["current_milestone"]["name"], "Nộp đề cương ĐATN")

    def test_supplementary_survey_unlock_and_close_guard(self):
        # Assigned sv1 vs unassigned sv2
        GraduationProject.objects.create(student=self.sv1, supervisor=self.sup1, batch=self.batch, status="ALLOCATED")

        # When supplementary_open=False in PHASE_3 -> sv2 cannot submit survey (409/400)
        self.client.force_authenticate(user=self.sv2_user)
        locked_post = self.client.post(
            "/app/student/survey/",
            {
                "phone_number": "0912345678",
                "topic_direction": self.topic.id,
                "preference_1": self.sup2.id,
            },
            format="json",
        )
        self.assertEqual(locked_post.status_code, status.HTTP_409_CONFLICT)

        # Admin opens supplementary
        self.batch.supplementary_open = True
        self.batch.save(update_fields=["supplementary_open"])

        # sv2 (unassigned) sees can_submit_supplementary=True and CAN submit survey!
        get_sv2 = self.client.get("/app/student/survey/")
        self.assertEqual(get_sv2.status_code, status.HTTP_200_OK)
        self.assertTrue(get_sv2.data["can_submit_supplementary"])
        self.assertTrue(get_sv2.data["batch"]["supplementary_open"])

        ok_post = self.client.post(
            "/app/student/survey/",
            {
                "phone_number": "0912345678",
                "topic_direction": self.topic.id,
                "preference_1": self.sup2.id,
                "tentative_title": "Đề tài bổ sung K64",
            },
            format="json",
        )
        self.assertEqual(ok_post.status_code, status.HTTP_200_OK)

        # Already-assigned sv1 still has can_submit_supplementary=False and CANNOT bypass
        self.client.force_authenticate(user=self.sv1_user)
        get_sv1 = self.client.get("/app/student/survey/")
        self.assertFalse(get_sv1.data["can_submit_supplementary"])
        blocked_sv1 = self.client.post(
            "/app/student/survey/",
            {
                "phone_number": "0912345679",
                "topic_direction": self.topic.id,
                "preference_1": self.sup2.id,
            },
            format="json",
        )
        self.assertEqual(blocked_sv1.status_code, status.HTTP_409_CONFLICT)

        # Close batch rejected while supplementary_open=True
        self.client.force_authenticate(user=self.admin)
        close_res = self.client.post(f"/app/batches/{self.batch.id}/close/")
        self.assertEqual(close_res.status_code, status.HTTP_400_BAD_REQUEST)


class DeferralFeedbackAndSignaturesTests(ClientEnhancementsBase):
    def setUp(self):
        super().setUp()
        self.proj = GraduationProject.objects.create(
            student=self.sv1, supervisor=self.sup1, batch=self.batch, status="IN_PROGRESS"
        )
        self.deferral = ThesisDeferralRequest.objects.create(
            project=self.proj, student=self.sv1, reason="Xin bảo lưu sức khỏe", status="PENDING"
        )

    def test_supervisor_deferral_feedback_and_admin_creation(self):
        # Other supervisor cannot give feedback
        self.client.force_authenticate(user=self.sup2_user)
        forbidden = self.client.post(
            f"/app/supervisor/deferral-request/{self.deferral.id}/feedback/",
            {"supervisor_feedback": "Ý kiến trái phép"},
            format="json",
        )
        self.assertEqual(forbidden.status_code, status.HTTP_403_FORBIDDEN)

        # Assigned supervisor submits feedback
        self.client.force_authenticate(user=self.sup1_user)
        ok = self.client.post(
            f"/app/supervisor/deferral-request/{self.deferral.id}/feedback/",
            {"supervisor_feedback": "GVHD xác nhận SV đã hoàn thành 60% khối lượng."},
            format="json",
        )
        self.assertEqual(ok.status_code, status.HTTP_200_OK)
        self.deferral.refresh_from_db()
        self.assertIn("60%", self.deferral.supervisor_feedback)
        self.assertIsNotNone(self.deferral.supervisor_reviewed_at)

        # Admin create deferral on behalf of student without supervisor -> clean 400
        self.client.force_authenticate(user=self.admin)
        no_proj = self.client.post(
            "/app/admin/deferrals/",
            {"student_id": self.sv2.id, "reason": "Chưa phân GVHD", "auto_approve": True},
            format="json",
        )
        self.assertEqual(no_proj.status_code, status.HTTP_400_BAD_REQUEST)

        # Admin create deferral on behalf of assigned student -> 201
        c_def = self.client.post(
            "/app/admin/deferrals/",
            {"project_id": self.proj.id, "reason": "Khoa lập bảo lưu đặc biệt", "auto_approve": True},
            format="json",
        )
        self.assertEqual(c_def.status_code, status.HTTP_201_CREATED)
        self.assertTrue(c_def.data["deferral"]["created_by_admin"])
        self.proj.refresh_from_db()
        self.assertEqual(self.proj.status, "DEFERRED")

    def test_defense_minutes_signatures_5_members(self):
        council = DefenseCouncil.objects.create(
            batch=self.batch, council_number=1, council_name="HĐ K64", defense_room="P201"
        )
        self.proj.council = council
        self.proj.save(update_fields=["council"])

        roles = ["CHAIR", "SECRETARY", "SECRETARY", "MEMBER", "MEMBER"]
        members = []
        for idx, role in enumerate(roles):
            u = CustomUser.objects.create_user(username=f"cm_sig_{idx}", password="x", user_type="committee_member")
            members.append(CouncilMember.objects.create(council=council, user=u, role=role))

        # Non-member cannot sign -> 403
        self.client.force_authenticate(user=self.sv1_user)
        forb = self.client.post(
            f"/app/council/{council.id}/minutes-signatures/",
            {"project_id": self.proj.id},
            format="json",
        )
        self.assertEqual(forb.status_code, status.HTTP_403_FORBIDDEN)

        # All 5 members sign -> reaches 5/5 & appears in live session
        for m in members:
            self.client.force_authenticate(user=m.user)
            s_res = self.client.post(
                f"/app/council/{council.id}/minutes-signatures/",
                {"project_id": self.proj.id, "note": "Thống nhất điểm bảo vệ"},
                format="json",
            )
            self.assertIn(s_res.status_code, (status.HTTP_200_OK, status.HTTP_201_CREATED))

        live_res = self.client.get(f"/app/council/live-session/?council_id={council.id}")
        self.assertEqual(live_res.status_code, status.HTTP_200_OK)
        proj_payload = live_res.data["projects"][0]
        self.assertEqual(proj_payload["minutes_signatures"]["signed_count"], 5)
        self.assertTrue(proj_payload["minutes_signatures"]["is_fully_signed"])


class HomeSummaryAndSessionSecurityTests(ClientEnhancementsBase):
    def test_role_home_summary_todos_and_risk_alerts(self):
        today = timezone.localdate()
        proj1 = GraduationProject.objects.create(
            student=self.sv1, supervisor=self.sup1, batch=self.batch, status="IN_PROGRESS"
        )
        # Overdue task makes sv1 AT_RISK
        SupervisionTask.objects.create(
            project=proj1,
            title="Nộp chương 1",
            assigned_by=self.sup1,
            due_date=today - datetime.timedelta(days=2),
            is_completed=False,
        )
        # Compliant sv2 with 2 weekly reports -> ON_TRACK
        proj2 = GraduationProject.objects.create(
            student=self.sv2, supervisor=self.sup1, batch=self.batch, status="IN_PROGRESS"
        )
        for wk in (1, 2):
            WeeklyProgressReport.objects.create(
                project=proj2, week_number=wk, summary_content=f"Báo cáo tuần {wk}", supervisor_rating="GOOD"
            )

        self.client.force_authenticate(user=self.sv1_user)
        stu_home = self.client.get("/app/dashboard/home-summary/")
        self.assertEqual(stu_home.status_code, status.HTTP_200_OK)
        self.assertEqual(stu_home.data["stats"]["overdue_tasks"], 1)
        self.assertTrue(any("quá hạn" in t["title"] for t in stu_home.data["todos"]))

        self.client.force_authenticate(user=self.sup1_user)
        sup_home = self.client.get("/app/dashboard/home-summary/")
        self.assertEqual(sup_home.status_code, status.HTTP_200_OK)
        self.assertEqual(sup_home.data["risk_summary"]["at_risk"], 1)
        self.assertEqual(sup_home.data["risk_summary"]["on_track"], 1)
        self.assertEqual(sup_home.data["student_risk_alerts"][0]["risk_level"], "AT_RISK")

    def test_client_login_session_revocation_and_dynamic_policy(self):
        SecurityPolicy.objects.update_or_create(
            policy_key="max_login_attempts",
            defaults={"label": "Max attempts", "policy_value": "2"},
        )
        cache.clear()
        anon = APIClient()
        login_res = anon.post(
            "/app/student/login/",
            {"registration_no": "20261001", "password": "SvPass123!"},
            format="json",
        )
        self.assertEqual(login_res.status_code, status.HTTP_200_OK)
        access = login_res.data["access"]

        bearer = APIClient()
        bearer.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        ok = bearer.get("/app/dashboard/home-summary/")
        self.assertEqual(ok.status_code, status.HTTP_200_OK)

        # Simulate remote Admin revocation in shared DB table
        sess = UserSessionLog.objects.filter(user=self.sv1_user, is_active=True).first()
        self.assertIsNotNone(sess)
        sess.is_active = False
        sess.revoke_reason = "Revoked in test"
        sess.save(update_fields=["is_active", "revoke_reason"])

        revoked = bearer.get("/app/dashboard/home-summary/")
        self.assertEqual(revoked.status_code, status.HTTP_401_UNAUTHORIZED)

        # Dynamic max_login_attempts=2 -> 2 bad attempts triggers 429
        r1 = anon.post("/app/student/login/", {"registration_no": "20261002", "password": "bad"}, format="json")
        self.assertEqual(r1.status_code, status.HTTP_401_UNAUTHORIZED)
        r2 = anon.post("/app/student/login/", {"registration_no": "20261002", "password": "bad"}, format="json")
        self.assertEqual(r2.status_code, status.HTTP_429_TOO_MANY_REQUESTS)


class MilestoneSyncAndTimelineIntegrationTests(APITestCase):
    def test_supervisor_open_batch_preference_milestone_todos_risk_and_calendar(self):
        import datetime as dt
        from app.feature_services import collect_calendar_events
        from app.models import AcademicBatch, BatchMilestone, CustomUser, GraduationProject, Student, Supervisor
        from app.utils.batch_progress import compute_milestone_days_left

        today = timezone.localdate()
        tz = timezone.get_current_timezone()

        sup_user = CustomUser.objects.create_user(
            username="sup_ms_sync",
            email="sup_ms_sync@utc.edu.vn",
            password="Password123!",
            first_name="Bình",
            last_name="Trần",
            user_type="supervisor",
        )
        sup = Supervisor.objects.create(user=sup_user, supervisor_id="GV_MS_01", academic_title="TS")

        sv_user = CustomUser.objects.create_user(
            username="sv_ms_sync",
            email="sv_ms_sync@utc.edu.vn",
            password="Password123!",
            first_name="Lan",
            last_name="Lê",
            user_type="student",
        )
        old_batch = AcademicBatch.objects.create(
            batch_code="K62-OLD",
            batch_name="Đợt Cũ Đã Đóng",
            current_stage="COMPLETED",
            is_active=False,
            is_closed=True,
        )
        old_sv_user = CustomUser.objects.create_user(
            username="sv_old_closed",
            email="sv_old_closed@utc.edu.vn",
            password="Password123!",
            user_type="student",
        )
        old_sv = Student.objects.create(user=old_sv_user, registration_no="SV_OLD_01", academic_batch=old_batch)
        GraduationProject.objects.create(
            student=old_sv,
            supervisor=sup,
            batch=old_batch,
            status="PASSED",
        )

        new_batch = AcademicBatch.objects.create(
            batch_code="K65-ACTIVE",
            batch_name="Đợt Đang Thực Hiện",
            current_stage="PHASE_5_IN_PROGRESS",
            is_active=True,
            is_closed=False,
        )
        sv = Student.objects.create(user=sv_user, registration_no="SV_MS_01", academic_batch=new_batch)
        GraduationProject.objects.create(
            student=sv,
            supervisor=sup,
            batch=new_batch,
            status="IN_PROGRESS",
            initial_eligibility="ELIGIBLE",
        )

        # GĐ2 active milestone + GĐ5 active milestone (80% elapsed, due in 1 day)
        BatchMilestone.objects.create(
            batch=new_batch,
            name="Mốc GĐ2 Đăng ký",
            stage_number=2,
            start_date=timezone.make_aware(dt.datetime.combine(today - dt.timedelta(days=5), dt.time(8, 0)), tz),
            end_date=timezone.make_aware(dt.datetime.combine(today + dt.timedelta(days=10), dt.time(23, 59)), tz),
            order_index=1,
            is_active=True,
        )
        ms5 = BatchMilestone.objects.create(
            batch=new_batch,
            name="Mốc GĐ5 Thực hiện",
            stage_number=5,
            start_date=timezone.make_aware(dt.datetime.combine(today - dt.timedelta(days=20), dt.time(8, 0)), tz),
            end_date=timezone.make_aware(dt.datetime.combine(today + dt.timedelta(days=1), dt.time(23, 59)), tz),
            order_index=2,
            is_active=True,
        )
        self.assertEqual(compute_milestone_days_left(ms5.end_date, today=today), 1)

        # Supervisor without batch_id MUST get K65-ACTIVE (not K62-OLD) and current_milestone=GĐ5
        self.client.force_authenticate(user=sup_user)
        ms_res = self.client.get("/app/batches/milestones/")
        self.assertEqual(ms_res.status_code, status.HTTP_200_OK)
        self.assertEqual(ms_res.data["batch"]["batch_code"], "K65-ACTIVE")
        self.assertEqual(ms_res.data["current_milestone"]["stage_number"], 5)

        prog_res = self.client.get("/app/batches/progress/")
        self.assertEqual(prog_res.status_code, status.HTTP_200_OK)
        self.assertEqual(prog_res.data["batch"]["batch_code"], "K65-ACTIVE")

        home_sup = self.client.get("/app/dashboard/home-summary/")
        self.assertEqual(home_sup.status_code, status.HTTP_200_OK)
        self.assertEqual(home_sup.data["current_milestone"]["stage_number"], 5)
        self.assertTrue(any(t["type"] == "milestone_upcoming" for t in home_sup.data["todos"]))
        self.assertEqual(home_sup.data["risk_summary"]["at_risk"], 1)

        # Student sees milestone_upcoming todo and ICS calendar milestone
        self.client.force_authenticate(user=sv_user)
        home_sv = self.client.get("/app/dashboard/home-summary/")
        self.assertEqual(home_sv.status_code, status.HTTP_200_OK)
        self.assertTrue(any(t["type"] == "milestone_upcoming" for t in home_sv.data["todos"]))

        events = collect_calendar_events(sv_user)
        self.assertTrue(any(ev["uid"] == f"batch-milestone-{ms5.id}" for ev in events))
