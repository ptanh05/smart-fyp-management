"""Kiểm thử các tính năng mở rộng: phiên bản bài nộp, tương đồng, trùng đề tài, rubric,
thống kê, iCal, nhắc hạn, lưu trữ/embargo, lưu giữ dữ liệu, phân công ổn định (SPA-S)."""
import shutil
import tempfile
from datetime import date, timedelta

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from app import feature_services as fs
from app.models import (
    AcademicBatch, CustomUser, FinalGradeSummary, GraduationProject, InternshipInfo, Notification,
    ProjectTopicArea, ProposedAllocation, Student, StudentPreference, SubmissionVersion, SupervisionTask,
    Supervisor, SupervisorQuota, WeeklyProgressReport,
)
from app.services import ThesisAllocationService

LOREM = (
    "He thong quan ly do an tot nghiep giup khoa theo doi tien do sinh vien qua tung giai doan "
    "tu dang ky nguyen vong phan cong giang vien huong dan xay dung de cuong bao cao tuan "
    "cho toi bao ve truoc hoi dong va tong hop diem cuoi cung mot cach minh bach va chinh xac "
    "giang vien co the giao nhiem vu danh gia san pham va trao doi voi sinh vien qua kenh chat "
) * 3


class FeatureBase(APITestCase):
    def setUp(self):
        self.media_root = tempfile.mkdtemp(prefix="fyp_feat_")
        self._media = override_settings(MEDIA_ROOT=self.media_root)
        self._media.enable()
        self.client = APIClient()
        self.batch = AcademicBatch.objects.create(batch_code="FEAT_26", batch_name="Đợt tính năng", is_active=True)
        self.topic = ProjectTopicArea.objects.create(name="Phần mềm", code="FEAT_SW", is_active=True)
        self.admin = CustomUser.objects.create_user(username="feat_admin", password="x", user_type="admin", is_staff=True)
        self.sup_user = CustomUser.objects.create_user(username="feat_gv", password="x", user_type="supervisor", first_name="An")
        self.sup = Supervisor.objects.create(user=self.sup_user, supervisor_id="F01", academic_title="TS")
        self.rev_user = CustomUser.objects.create_user(username="feat_pb", password="x", user_type="supervisor")
        self.rev = Supervisor.objects.create(user=self.rev_user, supervisor_id="F02", academic_title="TS")
        self.sv_user = CustomUser.objects.create_user(username="feat_sv", password="x", user_type="student")
        self.sv = Student.objects.create(user=self.sv_user, registration_no="F0001", academic_batch=self.batch)
        self.sv2_user = CustomUser.objects.create_user(username="feat_sv2", password="x", user_type="student")
        self.sv2 = Student.objects.create(user=self.sv2_user, registration_no="F0002", academic_batch=self.batch)
        self.project = GraduationProject.objects.create(
            student=self.sv, supervisor=self.sup, reviewer=self.rev, batch=self.batch, topic_category=self.topic,
            topic_title_vi="Xây dựng hệ thống quản lý thư viện trường đại học", status="IN_PROGRESS",
        )
        self.project2 = GraduationProject.objects.create(
            student=self.sv2, supervisor=self.rev, batch=self.batch, topic_category=self.topic,
            topic_title_vi="Ứng dụng nhận diện biển số xe bằng học sâu", status="IN_PROGRESS",
        )

    def tearDown(self):
        self._media.disable()
        shutil.rmtree(self.media_root, ignore_errors=True)

    def upload(self, user, project, content, name="report.txt", kind="REPORT"):
        self.client.force_authenticate(user=user)
        f = SimpleUploadedFile(name, content.encode() if isinstance(content, str) else content, content_type="text/plain")
        return self.client.post(f"/app/graduation-project/{project.id}/submissions/", {"file": f, "kind": kind}, format="multipart")


class SubmissionVersionTests(FeatureBase):
    def test_supervisor_can_approve_report_draft(self):
        uploaded = self.upload(self.sv_user, self.project, LOREM)
        self.client.force_authenticate(user=self.sup_user)

        response = self.client.post(
            f"/app/submissions/{uploaded.data['id']}/supervisor-review/",
            {"verdict": "APPROVED", "feedback": "Bản nháp đạt yêu cầu."},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["supervisor_review_status"], "APPROVED")
        self.assertEqual(response.data["supervisor_feedback"], "Bản nháp đạt yêu cầu.")
        version = SubmissionVersion.objects.get(pk=uploaded.data["id"])
        self.assertEqual(version.reviewed_by, self.sup_user)
        self.assertIsNotNone(version.reviewed_at)

    def test_revision_request_requires_feedback_and_rejects_outsider(self):
        uploaded = self.upload(self.sv_user, self.project, LOREM)
        url = f"/app/submissions/{uploaded.data['id']}/supervisor-review/"

        self.client.force_authenticate(user=self.sup_user)
        missing = self.client.post(url, {"verdict": "REVISION_REQUIRED", "feedback": ""}, format="json")
        self.assertEqual(missing.status_code, status.HTTP_400_BAD_REQUEST)

        self.client.force_authenticate(user=self.rev_user)
        forbidden = self.client.post(url, {"verdict": "APPROVED"}, format="json")
        self.assertEqual(forbidden.status_code, status.HTTP_403_FORBIDDEN)

    def test_report_draft_upload_is_limited_to_stage_4(self):
        self.batch.current_stage = "PHASE_5_IN_PROGRESS"
        self.batch.save(update_fields=["current_stage"])

        response = self.upload(self.sv_user, self.project, LOREM)

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data["current_stage"], 5)
        self.assertEqual(response.data["required_stage"], 4)

    def test_versions_increment_and_never_overwrite(self):
        r1 = self.upload(self.sv_user, self.project, LOREM)
        r2 = self.upload(self.sv_user, self.project, LOREM + " ban sua")
        self.assertEqual(r1.status_code, status.HTTP_201_CREATED, r1.data)
        self.assertEqual((r1.data["version_no"], r2.data["version_no"]), (1, 2))
        self.assertNotEqual(r1.data["sha256"], r2.data["sha256"])
        self.assertEqual(SubmissionVersion.objects.filter(project=self.project).count(), 2)

    def test_only_owner_student_can_submit_and_outsiders_cannot_read(self):
        self.assertEqual(self.upload(self.sv2_user, self.project, LOREM).status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.upload(self.sup_user, self.project, LOREM).status_code, status.HTTP_403_FORBIDDEN)
        self.client.force_authenticate(user=self.sv2_user)
        res = self.client.get(f"/app/graduation-project/{self.project.id}/submissions/")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_rejects_disallowed_extension(self):
        res = self.upload(self.sv_user, self.project, "MZ...", name="virus.exe")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_similarity_flags_copied_report(self):
        self.upload(self.sv2_user, self.project2, LOREM)
        res = self.upload(self.sv_user, self.project, LOREM)
        version = SubmissionVersion.objects.get(id=res.data["id"])
        self.assertEqual(version.similarity_status, "CHECKED")
        self.assertGreaterEqual(version.similarity_score, 90)
        self.assertEqual(version.similarity_matches[0]["project_id"], self.project2.id)
        # SV không thấy chi tiết bài trùng, GVHD thì thấy
        self.client.force_authenticate(user=self.sv_user)
        self.assertNotIn("similarity_matches", self.client.get(f"/app/graduation-project/{self.project.id}/submissions/").data[0])
        self.client.force_authenticate(user=self.sup_user)
        data = self.client.get(f"/app/graduation-project/{self.project.id}/submissions/").data[0]
        self.assertEqual(data["similarity_level"], "HIGH")

    def test_short_text_marked_unsupported(self):
        res = self.upload(self.sv_user, self.project, "qua ngan")
        self.assertEqual(SubmissionVersion.objects.get(id=res.data["id"]).similarity_status, "UNSUPPORTED")


class TopicSimilarityTests(FeatureBase):
    def test_detects_near_duplicate_title(self):
        self.client.force_authenticate(user=self.sv2_user)
        res = self.client.get("/app/topics/similarity-check/", {"title": "Hệ thống quản lý thư viện cho trường đại học"})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data["has_duplicate_risk"])
        self.assertNotIn("supervisor_name", res.data["matches"][0])

    def test_unrelated_title_is_not_flagged(self):
        self.client.force_authenticate(user=self.sv2_user)
        res = self.client.get("/app/topics/similarity-check/", {"title": "Phân tích cảm xúc bình luận mạng xã hội"})
        self.assertFalse(res.data["has_duplicate_risk"])

    def test_normalize_vi(self):
        self.assertEqual(fs.normalize_vi("Đồ Án Tốt-Nghiệp!"), "do an tot nghiep")


class RubricTests(FeatureBase):
    def _create_rubric(self, role="SUPERVISOR"):
        self.client.force_authenticate(user=self.admin)
        res = self.client.post("/app/rubrics/", {
            "name": "Phiếu GVHD", "evaluator_role": role,
            "criteria": [{"name": "Nội dung", "max_score": 6}, {"name": "Thái độ", "max_score": 4}],
        }, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        return res.data

    def test_supervisor_scores_with_rubric(self):
        rubric = self._create_rubric()
        c1, c2 = [c["id"] for c in rubric["criteria"]]
        self.client.force_authenticate(user=self.sup_user)
        res = self.client.post(f"/app/graduation-project/{self.project.id}/rubric-scores/", {
            "rubric_id": rubric["id"], "criterion_scores": {str(c1): 5, str(c2): 3.5},
        }, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertEqual(res.data["total_10"], 8.5)

    def test_out_of_range_and_wrong_role_rejected(self):
        rubric = self._create_rubric()
        c1, c2 = [c["id"] for c in rubric["criteria"]]
        self.client.force_authenticate(user=self.sup_user)
        bad = self.client.post(f"/app/graduation-project/{self.project.id}/rubric-scores/", {
            "rubric_id": rubric["id"], "criterion_scores": {str(c1): 7, str(c2): 3},
        }, format="json")
        self.assertEqual(bad.status_code, status.HTTP_400_BAD_REQUEST)
        self.client.force_authenticate(user=self.rev_user)  # phản biện không dùng phiếu GVHD
        wrong = self.client.post(f"/app/graduation-project/{self.project.id}/rubric-scores/", {
            "rubric_id": rubric["id"], "criterion_scores": {str(c1): 5, str(c2): 3},
        }, format="json")
        self.assertEqual(wrong.status_code, status.HTTP_403_FORBIDDEN)

    def test_only_admin_creates_rubric(self):
        self.client.force_authenticate(user=self.sup_user)
        res = self.client.post("/app/rubrics/", {"name": "x", "evaluator_role": "SUPERVISOR", "criteria": [{"name": "a"}]}, format="json")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_score_discrepancy_flagged(self):
        self.project.supervisor_score = 9.0
        self.project.reviewer_score = 5.5
        self.project.save()
        self.client.force_authenticate(user=self.admin)
        res = self.client.get(f"/app/graduation-project/{self.project.id}/score-discrepancy/")
        self.assertTrue(res.data["needs_reconciliation"])
        self.assertEqual(res.data["spread"], 3.5)
        batch_res = self.client.get("/app/analytics/score-discrepancies/", {"batch_id": self.batch.id})
        self.assertEqual(batch_res.data["count"], 1)
        self.client.force_authenticate(user=self.sup_user)
        self.assertEqual(self.client.get(f"/app/graduation-project/{self.project.id}/score-discrepancy/").status_code, 403)


class AnalyticsTests(FeatureBase):
    def test_admin_gets_analytics_student_forbidden(self):
        self.project.status = "PASSED"
        self.project.save()
        FinalGradeSummary.objects.create(project=self.project, final_score_10=8.2)
        self.client.force_authenticate(user=self.admin)
        res = self.client.get("/app/analytics/faculty/", {"batch_id": self.batch.id})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["total_projects"], 2)
        self.assertEqual(res.data["pass_rate"], 100.0)
        self.assertEqual(res.data["score_distribution"][8]["count"], 1)
        self.client.force_authenticate(user=self.sv_user)
        self.assertEqual(self.client.get("/app/analytics/faculty/").status_code, status.HTTP_403_FORBIDDEN)


class CalendarAndReminderTests(FeatureBase):
    def setUp(self):
        super().setUp()
        self.task = SupervisionTask.objects.create(
            project=self.project, title="Nộp chương 2", assigned_by=self.sup,
            due_date=timezone.localdate() + timedelta(days=1),
        )

    def test_ics_contains_task_deadline(self):
        self.client.force_authenticate(user=self.sv_user)
        res = self.client.get("/app/calendar/my.ics")
        self.assertEqual(res.status_code, 200)
        body = res.content.decode()
        self.assertIn("BEGIN:VCALENDAR", body)
        self.assertIn(f"UID:task-{self.task.id}@smart-fyp-utc", body)
        self.assertIn("Nộp chương 2", body)

    def test_feed_token_works_without_login_and_rotates(self):
        self.client.force_authenticate(user=self.sv_user)
        url = self.client.get("/app/calendar/feed-token/").data["feed_url"]
        path = url.split("testserver", 1)[1]
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get(path).status_code, 200)
        self.client.force_authenticate(user=self.sv_user)
        self.client.post("/app/calendar/feed-token/")
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get(path).status_code, 404)

    def test_reminders_sent_once(self):
        self.assertEqual(fs.send_deadline_reminders(send_email=False), 1)
        self.assertEqual(fs.send_deadline_reminders(send_email=False), 0)
        self.assertTrue(Notification.objects.filter(user=self.sv_user, notification_type="deadline_reminder").exists())


class ArchiveAndRetentionTests(FeatureBase):
    def test_archive_requires_passed_and_embargo_hides_file(self):
        self.upload(self.sv_user, self.project, LOREM)
        self.client.force_authenticate(user=self.admin)
        url = f"/app/graduation-project/{self.project.id}/archive/"
        self.assertEqual(self.client.post(url, {}, format="json").status_code, status.HTTP_400_BAD_REQUEST)
        self.project.status = "PASSED"
        self.project.save()
        payload = {"visibility": "EMBARGOED", "embargo_until": (date.today() + timedelta(days=365)).isoformat()}
        self.assertEqual(self.client.post(url, payload, format="json").status_code, 400)  # thiếu lý do
        payload["embargo_reason"] = "Bí mật doanh nghiệp đối tác"
        res = self.client.post(url, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)

        self.client.force_authenticate(user=self.sv2_user)
        other = self.client.get("/app/archive/").data[0]
        self.assertTrue(other["is_embargoed"])
        self.assertIsNone(other["file_url"])
        self.client.force_authenticate(user=self.sv_user)
        self.assertIsNotNone(self.client.get("/app/archive/").data[0]["file_url"])

    def test_retention_dry_run_then_apply(self):
        old_batch = AcademicBatch.objects.create(
            batch_code="OLD_2018", batch_name="Đợt cũ", is_active=False, is_closed=True, end_date=date(2018, 6, 30)
        )
        self.project2.batch = old_batch
        self.project2.save()
        report = WeeklyProgressReport.objects.create(
            project=self.project2, week_number=1, summary_content="tuần 1",
            attached_file=SimpleUploadedFile("w1.txt", b"noi dung"),
        )
        preview = fs.apply_data_retention(years=5)
        self.assertEqual(preview["weekly_report_files"], 1)
        self.assertFalse(preview["applied"])
        report.refresh_from_db()
        self.assertTrue(report.attached_file)
        result = fs.apply_data_retention(years=5, apply=True)
        self.assertTrue(result["applied"])
        report.refresh_from_db()
        self.assertFalse(report.attached_file)
        # Đợt hiện tại không bị ảnh hưởng
        self.assertNotIn("FEAT_26", result["batches"])


class StableAllocationTests(APITestCase):
    """Ví dụ kinh điển cho thấy thuật toán greedy theo vòng NV không ổn định:
    X, Y mỗi GV nhận 1 SV; thứ tự ưu tiên S0 > S1 > S2 (nộp trước).
    S0: [X]; S1: [X, Y]; S2: [Y].
    Greedy: S0→X, S2→Y, S1 trượt dù Y ưu tiên S1 hơn S2 (cặp chặn S1–Y).
    Deferred Acceptance: S0→X, S1→Y, S2 không có GV."""

    def setUp(self):
        self.batch = AcademicBatch.objects.create(batch_code="SPA_26", batch_name="Đợt SPA", is_active=True)
        self.sups = {}
        for code in ("X", "Y"):
            u = CustomUser.objects.create_user(username=f"spa_gv_{code}", password="x", user_type="supervisor")
            sup = Supervisor.objects.create(user=u, supervisor_id=f"SPA_{code}", academic_title="TS")
            SupervisorQuota.objects.create(supervisor=sup, batch=self.batch, viet_anh_quota=0, general_cntt_quota=1, max_total_quota=1)
            self.sups[code] = sup
        self.students = {}
        for name, prefs in (("S0", ["X"]), ("S1", ["X", "Y"]), ("S2", ["Y"])):
            u = CustomUser.objects.create_user(username=f"spa_{name}", password="x", user_type="student")
            st = Student.objects.create(user=u, registration_no=f"SPA{name}", academic_batch=self.batch)
            StudentPreference.objects.create(
                student=st, batch=self.batch,
                preference_1=self.sups[prefs[0]], preference_2=self.sups[prefs[1]] if len(prefs) > 1 else None,
            )
            InternshipInfo.objects.create(student=st, batch=self.batch)
            self.students[name] = st

    def _assignment(self):
        return {a.student.registration_no: a.supervisor.supervisor_id for a in ProposedAllocation.objects.filter(batch=self.batch)}

    def test_stable_algorithm_has_no_blocking_pair(self):
        stats = ThesisAllocationService.run_allocation(self.batch)
        self.assertEqual(stats["algorithm"], "stable")
        result = self._assignment()
        self.assertEqual(result.get("SPAS0"), "SPA_X")
        self.assertEqual(result.get("SPAS1"), "SPA_Y")
        self.assertNotIn("SPAS2", result)

    def test_greedy_still_available(self):
        stats = ThesisAllocationService.run_allocation(self.batch, algorithm="greedy")
        self.assertEqual(stats["algorithm"], "greedy")
        self.assertEqual(self._assignment().get("SPAS2"), "SPA_Y")
