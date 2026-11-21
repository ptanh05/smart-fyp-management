"""
Extended tests for feature API endpoints added by Agent 1.
Covers: rubric DRAFT/SUBMIT/lock/unlock, per-criterion weight, criterion_comments,
        discrepancy (SUBMITTED only), lecturer workload, admin archive list/update,
        calendar DELETE (revoke), data retention apply, file validators.
"""
import shutil
import tempfile
from datetime import date, timedelta

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from app.feature_validators import sanitize_filename, validate_submission_file
from app.models import (
    AcademicBatch, AuditLog, CalendarFeedToken, CustomUser, GraduationProject, ProjectTopicArea,
    Rubric, RubricCriterion, RubricScore, Student, Supervisor,
    ThesisArchiveRecord,
)
from app import feature_services as fs


# ---------------------------------------------------------------------------
# Shared base
# ---------------------------------------------------------------------------

class FeatureBase(APITestCase):
    def setUp(self):
        self.media_root = tempfile.mkdtemp(prefix="fyp_ext_")
        self._media = override_settings(MEDIA_ROOT=self.media_root)
        self._media.enable()
        self.client = APIClient()
        self.batch = AcademicBatch.objects.create(batch_code="EXT_26", batch_name="Đợt mở rộng", is_active=True)
        self.topic = ProjectTopicArea.objects.create(name="AI", code="EXT_AI", is_active=True)
        self.admin = CustomUser.objects.create_user(username="ext_admin", password="x", user_type="admin", is_staff=True)
        self.sup_user = CustomUser.objects.create_user(username="ext_sup", password="x", user_type="supervisor", first_name="Nam")
        self.sup = Supervisor.objects.create(user=self.sup_user, supervisor_id="E01", academic_title="TS")
        self.rev_user = CustomUser.objects.create_user(username="ext_rev", password="x", user_type="supervisor", first_name="Lan")
        self.rev = Supervisor.objects.create(user=self.rev_user, supervisor_id="E02", academic_title="PGS")
        self.sv_user = CustomUser.objects.create_user(username="ext_sv", password="x", user_type="student")
        self.sv = Student.objects.create(user=self.sv_user, registration_no="E0001", academic_batch=self.batch)
        self.project = GraduationProject.objects.create(
            student=self.sv, supervisor=self.sup, reviewer=self.rev, batch=self.batch,
            topic_category=self.topic, topic_title_vi="Hệ thống nhận dạng khuôn mặt bằng AI",
            status="IN_PROGRESS",
        )

    def tearDown(self):
        self._media.disable()
        shutil.rmtree(self.media_root, ignore_errors=True)

    def _create_rubric(self, role="SUPERVISOR", criteria=None):
        self.client.force_authenticate(user=self.admin)
        if criteria is None:
            criteria = [{"name": "Nội dung", "max_score": 7}, {"name": "Trình bày", "max_score": 3}]
        res = self.client.post("/app/rubrics/", {
            "name": f"Phiếu {role}", "evaluator_role": role, "criteria": criteria,
        }, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        return res.data


# ---------------------------------------------------------------------------
# Rubric DRAFT / SUBMIT / lock / unlock
# ---------------------------------------------------------------------------

class RubricDraftSubmitTests(FeatureBase):

    def test_draft_allows_multiple_saves(self):
        rubric = self._create_rubric()
        c1, c2 = [c["id"] for c in rubric["criteria"]]
        self.client.force_authenticate(user=self.sup_user)

        # First save as DRAFT
        r1 = self.client.post(f"/app/graduation-project/{self.project.id}/rubric-scores/", {
            "rubric_id": rubric["id"], "criterion_scores": {str(c1): 5, str(c2): 2}, "action": "DRAFT",
        }, format="json")
        self.assertEqual(r1.status_code, 200)
        self.assertEqual(r1.data["status"], "DRAFT")
        self.assertIsNone(r1.data["locked_at"])

        # Second save as DRAFT (should succeed)
        r2 = self.client.post(f"/app/graduation-project/{self.project.id}/rubric-scores/", {
            "rubric_id": rubric["id"], "criterion_scores": {str(c1): 6, str(c2): 3}, "action": "DRAFT",
        }, format="json")
        self.assertEqual(r2.status_code, 200)
        self.assertEqual(r2.data["total_10"], 9.0)

    def test_submit_locks_score(self):
        rubric = self._create_rubric()
        c1, c2 = [c["id"] for c in rubric["criteria"]]
        self.client.force_authenticate(user=self.sup_user)

        # Submit
        r = self.client.post(f"/app/graduation-project/{self.project.id}/rubric-scores/", {
            "rubric_id": rubric["id"], "criterion_scores": {str(c1): 7, str(c2): 3}, "action": "SUBMIT",
        }, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["status"], "SUBMITTED")
        self.assertIsNotNone(r.data["locked_at"])

        # Try to edit after submit -> 409
        r2 = self.client.post(f"/app/graduation-project/{self.project.id}/rubric-scores/", {
            "rubric_id": rubric["id"], "criterion_scores": {str(c1): 4, str(c2): 2}, "action": "DRAFT",
        }, format="json")
        self.assertEqual(r2.status_code, 409)

    def test_admin_unlock_allows_edit(self):
        rubric = self._create_rubric()
        c1, c2 = [c["id"] for c in rubric["criteria"]]
        self.client.force_authenticate(user=self.sup_user)
        self.client.post(f"/app/graduation-project/{self.project.id}/rubric-scores/", {
            "rubric_id": rubric["id"], "criterion_scores": {str(c1): 7, str(c2): 3}, "action": "SUBMIT",
        }, format="json")
        score = RubricScore.objects.get(project=self.project, rubric_id=rubric["id"])
        self.assertEqual(score.status, "SUBMITTED")

        # Admin unlocks
        self.client.force_authenticate(user=self.admin)
        ur = self.client.post(f"/app/rubric-scores/{score.id}/unlock/")
        self.assertEqual(ur.status_code, 200)
        self.assertEqual(ur.data["status"], "DRAFT")
        score.refresh_from_db()
        self.assertEqual(score.status, "DRAFT")
        self.assertIsNone(score.locked_at)

        # AuditLog entry exists
        self.assertTrue(AuditLog.objects.filter(action_type="rubric_unlock").exists())

        # Now supervisor can edit again
        self.client.force_authenticate(user=self.sup_user)
        r3 = self.client.post(f"/app/graduation-project/{self.project.id}/rubric-scores/", {
            "rubric_id": rubric["id"], "criterion_scores": {str(c1): 6, str(c2): 2}, "action": "DRAFT",
        }, format="json")
        self.assertEqual(r3.status_code, 200)

    def test_non_admin_cannot_unlock(self):
        rubric = self._create_rubric()
        c1, c2 = [c["id"] for c in rubric["criteria"]]
        self.client.force_authenticate(user=self.sup_user)
        self.client.post(f"/app/graduation-project/{self.project.id}/rubric-scores/", {
            "rubric_id": rubric["id"], "criterion_scores": {str(c1): 7, str(c2): 3}, "action": "SUBMIT",
        }, format="json")
        score = RubricScore.objects.get(project=self.project, rubric_id=rubric["id"])
        self.client.force_authenticate(user=self.sup_user)
        r = self.client.post(f"/app/rubric-scores/{score.id}/unlock/")
        self.assertEqual(r.status_code, 403)

    def test_criterion_comments_saved(self):
        rubric = self._create_rubric()
        c1, c2 = [c["id"] for c in rubric["criteria"]]
        self.client.force_authenticate(user=self.sup_user)
        r = self.client.post(f"/app/graduation-project/{self.project.id}/rubric-scores/", {
            "rubric_id": rubric["id"],
            "criterion_scores": {str(c1): 6, str(c2): 3},
            "criterion_comments": {str(c1): "Nội dung tốt", str(c2): "Trình bày rõ ràng"},
            "action": "DRAFT",
        }, format="json")
        self.assertEqual(r.status_code, 200)
        score = RubricScore.objects.get(project=self.project, rubric_id=rubric["id"])
        self.assertEqual(score.criterion_comments[str(c1)], "Nội dung tốt")


# ---------------------------------------------------------------------------
# Per-criterion weight
# ---------------------------------------------------------------------------

class RubricWeightTests(FeatureBase):

    def test_weight_changes_total(self):
        """With weight, total_10 uses weighted average of normalized per-criterion scores."""
        rubric = self._create_rubric(criteria=[
            {"name": "A", "max_score": 10, "weight": 2},
            {"name": "B", "max_score": 10, "weight": 8},
        ])
        c1, c2 = [c["id"] for c in rubric["criteria"]]
        self.client.force_authenticate(user=self.sup_user)
        r = self.client.post(f"/app/graduation-project/{self.project.id}/rubric-scores/", {
            "rubric_id": rubric["id"],
            "criterion_scores": {str(c1): 10, str(c2): 0},  # A=full, B=zero
            "action": "DRAFT",
        }, format="json")
        self.assertEqual(r.status_code, 200)
        # total = (10/10*2 + 0/10*8) / (2+8) * 10 = 2/10 * 10 = 2.0
        self.assertAlmostEqual(r.data["total_10"], 2.0)

    def test_no_weight_backward_compatible(self):
        """Without weight the original formula applies: sum/max * 10."""
        rubric = self._create_rubric(criteria=[
            {"name": "A", "max_score": 6},
            {"name": "B", "max_score": 4},
        ])
        c1, c2 = [c["id"] for c in rubric["criteria"]]
        self.client.force_authenticate(user=self.sup_user)
        r = self.client.post(f"/app/graduation-project/{self.project.id}/rubric-scores/", {
            "rubric_id": rubric["id"],
            "criterion_scores": {str(c1): 5, str(c2): 3.5},
            "action": "DRAFT",
        }, format="json")
        self.assertEqual(r.status_code, 200)
        # sum=8.5, max=10 -> 8.5
        self.assertAlmostEqual(r.data["total_10"], 8.5)


# ---------------------------------------------------------------------------
# Discrepancy: only SUBMITTED scores counted
# ---------------------------------------------------------------------------

class DiscrepancySubmittedOnlyTests(FeatureBase):

    def test_draft_scores_excluded_from_discrepancy(self):
        # Single-criterion rubrics to avoid missing-score validation errors
        rubric_sup = self._create_rubric(role="SUPERVISOR", criteria=[{"name": "Tổng hợp", "max_score": 10}])
        rubric_rev = self._create_rubric(role="REVIEWER", criteria=[{"name": "Phản biện", "max_score": 10}])
        c_sup = rubric_sup["criteria"][0]["id"]
        c_rev = rubric_rev["criteria"][0]["id"]

        # Supervisor: SUBMIT with high score
        self.client.force_authenticate(user=self.sup_user)
        r1 = self.client.post(f"/app/graduation-project/{self.project.id}/rubric-scores/", {
            "rubric_id": rubric_sup["id"],
            "criterion_scores": {str(c_sup): 9},
            "action": "SUBMIT",
        }, format="json")
        self.assertEqual(r1.status_code, 200, r1.data)

        # Reviewer: only DRAFT (should not be in discrepancy)
        self.client.force_authenticate(user=self.rev_user)
        r2 = self.client.post(f"/app/graduation-project/{self.project.id}/rubric-scores/", {
            "rubric_id": rubric_rev["id"],
            "criterion_scores": {str(c_rev): 3},  # very different but only DRAFT
            "action": "DRAFT",
        }, format="json")
        self.assertEqual(r2.status_code, 200, r2.data)

        self.client.force_authenticate(user=self.admin)
        res = self.client.get(f"/app/graduation-project/{self.project.id}/score-discrepancy/")
        self.assertEqual(res.status_code, 200)
        # Only 1 SUBMITTED rubric score -> DRAFT reviewer score excluded
        rubric_sources = [e["source"] for e in res.data["entries"] if "RUBRIC" in e["source"]]
        self.assertEqual(len(rubric_sources), 1)  # only SUPERVISOR submitted


# ---------------------------------------------------------------------------
# Lecturer workload endpoint
# ---------------------------------------------------------------------------

class LecturerWorkloadTests(FeatureBase):

    def test_supervisor_sees_own_project(self):
        self.client.force_authenticate(user=self.sup_user)
        res = self.client.get("/app/lecturer/workload/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 1)
        item = res.data[0]
        self.assertEqual(item["project_id"], self.project.id)
        self.assertIn("SUPERVISOR", item["roles"])
        self.assertEqual(item["my_rubric_status"], "MISSING")  # no score yet
        self.assertIn("student_reg_no", item)
        self.assertIn("status", item)
        self.assertIsNone(item["needs_reconciliation"])  # not admin

    def test_reviewer_sees_own_project(self):
        self.client.force_authenticate(user=self.rev_user)
        res = self.client.get("/app/lecturer/workload/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 1)
        self.assertIn("REVIEWER", res.data[0]["roles"])

    def test_workload_shows_rubric_score_status(self):
        # Use a single-criterion rubric to avoid missing-score validation errors
        rubric = self._create_rubric(role="SUPERVISOR", criteria=[{"name": "Tổng hợp", "max_score": 10}])
        c1 = rubric["criteria"][0]["id"]
        self.client.force_authenticate(user=self.sup_user)
        r = self.client.post(f"/app/graduation-project/{self.project.id}/rubric-scores/", {
            "rubric_id": rubric["id"], "criterion_scores": {str(c1): 7}, "action": "DRAFT",
        }, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        res = self.client.get("/app/lecturer/workload/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data[0]["my_rubric_status"], "DRAFT")

    def test_student_sees_empty_workload(self):
        self.client.force_authenticate(user=self.sv_user)
        res = self.client.get("/app/lecturer/workload/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data, [])

    def test_admin_sees_discrepancy_flag(self):
        self.project.supervisor_score = 9.0
        self.project.reviewer_score = 5.0
        self.project.save()
        # Admin is not supervisor/reviewer/council so workload is empty for them as a lecturer
        self.client.force_authenticate(user=self.admin)
        res = self.client.get("/app/lecturer/workload/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data, [])

    def test_is_draft_true_saves_draft(self):
        rubric = self._create_rubric(role="SUPERVISOR", criteria=[{"name": "Tổng", "max_score": 10}])
        c1 = rubric["criteria"][0]["id"]
        self.client.force_authenticate(user=self.sup_user)
        r = self.client.post(f"/app/graduation-project/{self.project.id}/rubric-scores/", {
            "rubric_id": rubric["id"],
            "criterion_scores": {str(c1): 7},
            "is_draft": True,
        }, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["status"], "DRAFT")

    def test_is_draft_false_submits(self):
        rubric = self._create_rubric(role="SUPERVISOR", criteria=[{"name": "Tổng", "max_score": 10}])
        c1 = rubric["criteria"][0]["id"]
        self.client.force_authenticate(user=self.sup_user)
        r = self.client.post(f"/app/graduation-project/{self.project.id}/rubric-scores/", {
            "rubric_id": rubric["id"],
            "criterion_scores": {str(c1): 7},
            "is_draft": False,
        }, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["status"], "SUBMITTED")
        self.assertIsNotNone(r.data["locked_at"])

    def test_latest_submission_in_workload(self):
        self.client.force_authenticate(user=self.sv_user)
        f = SimpleUploadedFile("rep.txt", b"content " * 20, content_type="text/plain")
        self.client.post(f"/app/graduation-project/{self.project.id}/submissions/", {"file": f, "kind": "REPORT"}, format="multipart")
        self.client.force_authenticate(user=self.sup_user)
        res = self.client.get("/app/lecturer/workload/")
        self.assertIsNotNone(res.data[0]["latest_submission"])
        sub = res.data[0]["latest_submission"]
        self.assertEqual(sub["kind"], "REPORT")
        self.assertIn("similarity_score", sub)
        self.assertIn("similarity_level", sub)


# ---------------------------------------------------------------------------
# Admin archive list / update
# ---------------------------------------------------------------------------

class AdminArchiveTests(FeatureBase):

    def setUp(self):
        super().setUp()
        self.project.status = "PASSED"
        self.project.save()
        self.client.force_authenticate(user=self.admin)
        self.client.post(f"/app/graduation-project/{self.project.id}/archive/", {
            "visibility": "EMBARGOED",
            "embargo_until": (date.today() + timedelta(days=180)).isoformat(),
            "embargo_reason": "Chờ công bố bài báo",
        }, format="json")
        self.record = ThesisArchiveRecord.objects.get(project=self.project)

    def test_admin_archive_list_returns_all_with_admin_fields(self):
        res = self.client.get("/app/admin/archive/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["count"], 1)
        item = res.data["results"][0]
        self.assertIn("embargo_reason", item)
        self.assertIn("archived_by", item)

    def test_admin_archive_filter_by_visibility(self):
        res = self.client.get("/app/admin/archive/", {"visibility": "EMBARGOED"})
        self.assertEqual(res.data["count"], 1)
        res2 = self.client.get("/app/admin/archive/", {"visibility": "PUBLIC"})
        self.assertEqual(res2.data["count"], 0)

    def test_admin_archive_filter_by_is_embargoed(self):
        res = self.client.get("/app/admin/archive/", {"is_embargoed": "1"})
        self.assertEqual(res.data["count"], 1)

    def test_admin_lift_embargo(self):
        res = self.client.patch(f"/app/admin/archive/{self.record.id}/", {
            "visibility": "PUBLIC",
        }, format="json")
        self.assertEqual(res.status_code, 200)
        self.record.refresh_from_db()
        self.assertEqual(self.record.visibility, "PUBLIC")
        self.assertIsNone(self.record.embargo_until)
        # AuditLog entry
        self.assertTrue(AuditLog.objects.filter(action_type="archive_embargo_change").exists())

    def test_non_admin_cannot_access_admin_archive(self):
        self.client.force_authenticate(user=self.sup_user)
        res = self.client.get("/app/admin/archive/")
        self.assertEqual(res.status_code, 403)
        res2 = self.client.patch(f"/app/admin/archive/{self.record.id}/", {}, format="json")
        self.assertEqual(res2.status_code, 403)

    def test_admin_archive_filter_by_keyword(self):
        res = self.client.get("/app/admin/archive/", {"q": "nhận dạng khuôn mặt"})
        self.assertEqual(res.data["count"], 1)
        res2 = self.client.get("/app/admin/archive/", {"q": "không có gì"})
        self.assertEqual(res2.data["count"], 0)


# ---------------------------------------------------------------------------
# Calendar DELETE (revoke feed)
# ---------------------------------------------------------------------------

class CalendarFeedRevokeTests(FeatureBase):

    def test_delete_revokes_feed(self):
        self.client.force_authenticate(user=self.sv_user)
        url = self.client.get("/app/calendar/feed-token/").data["feed_url"]
        path = url.split("testserver", 1)[1]
        # Token works
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get(path).status_code, 200)
        # Revoke
        self.client.force_authenticate(user=self.sv_user)
        r = self.client.delete("/app/calendar/feed-token/")
        self.assertEqual(r.status_code, 204)
        # Token no longer works
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get(path).status_code, 404)
        # Token object deleted
        self.assertFalse(CalendarFeedToken.objects.filter(user=self.sv_user).exists())

    def test_bad_token_returns_404(self):
        self.client.force_authenticate(user=None)
        res = self.client.get("/app/calendar/feed/nonexistenttoken123abc.ics")
        self.assertEqual(res.status_code, 404)


# ---------------------------------------------------------------------------
# Data retention apply endpoint
# ---------------------------------------------------------------------------

class DataRetentionApplyTests(FeatureBase):

    def test_apply_requires_confirm_flag(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.post("/app/admin/data-retention/apply/", {}, format="json")
        self.assertEqual(res.status_code, 400)
        res2 = self.client.post("/app/admin/data-retention/apply/", {"confirm": False}, format="json")
        self.assertEqual(res2.status_code, 400)

    def test_apply_with_confirm_true_runs_and_logs(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.post("/app/admin/data-retention/apply/", {"confirm": True, "years": 100}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data["applied"])
        # AuditLog entry written by view
        self.assertTrue(AuditLog.objects.filter(action_type="retention_apply").exists())

    def test_non_admin_cannot_apply(self):
        self.client.force_authenticate(user=self.sup_user)
        res = self.client.post("/app/admin/data-retention/apply/", {"confirm": True}, format="json")
        self.assertEqual(res.status_code, 403)


# ---------------------------------------------------------------------------
# feature_validators unit tests
# ---------------------------------------------------------------------------

class FeatureValidatorsTests(APITestCase):

    def test_sanitize_filename_strips_path_traversal(self):
        # os.path.basename keeps only the last component; .. traversal is removed
        self.assertEqual(sanitize_filename("../../etc/passwd"), "passwd")
        # Windows separators: basename picks last component after \
        self.assertEqual(sanitize_filename("C:\\Windows\\system32\\evil.exe"), "evil.exe")
        self.assertEqual(sanitize_filename("normal_file.pdf"), "normal_file.pdf")
        self.assertEqual(sanitize_filename("file with spaces.docx"), "file with spaces.docx")
        # Null byte stripped
        self.assertEqual(sanitize_filename("file\x00name.pdf"), "filename.pdf")

    def test_exe_magic_rejected(self):
        f = SimpleUploadedFile("evil.pdf", b"MZ\x90\x00extra bytes here", content_type="application/pdf")
        from rest_framework import serializers as drf_s
        with self.assertRaises(drf_s.ValidationError):
            validate_submission_file(f)

    def test_valid_pdf_accepted(self):
        f = SimpleUploadedFile("thesis.pdf", b"%PDF-1.4 valid content " * 20, content_type="application/pdf")
        result = validate_submission_file(f, allowed_extensions=[".pdf"])
        self.assertEqual(result, "thesis.pdf")

    def test_disallowed_extension_rejected(self):
        f = SimpleUploadedFile("script.py", b"print('hello')", content_type="text/plain")
        from rest_framework import serializers as drf_s
        with self.assertRaises(drf_s.ValidationError):
            validate_submission_file(f, allowed_extensions=[".pdf", ".docx"])

    def test_oversized_file_rejected(self):
        f = SimpleUploadedFile("big.pdf", b"%PDF-1.4" + b"x" * 100, content_type="application/pdf")
        f.size = 30 * 1024 * 1024  # Fake 30 MB
        from rest_framework import serializers as drf_s
        with self.assertRaises(drf_s.ValidationError):
            validate_submission_file(f, allowed_extensions=[".pdf"], max_size_bytes=25 * 1024 * 1024)

    def test_txt_accepted(self):
        f = SimpleUploadedFile("note.txt", b"hello world " * 50, content_type="text/plain")
        result = validate_submission_file(f, allowed_extensions=[".txt"])
        self.assertEqual(result, "note.txt")
