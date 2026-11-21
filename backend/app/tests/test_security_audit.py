"""
Security audit tests for Smart FYP.

Each test encodes the *expected secure behaviour*.  Tests that target a known
vulnerability will FAIL until the vulnerability is fixed – that is deliberate.

Run with:
  cd backend && PYTHONIOENCODING=utf-8 DATABASE_URL="sqlite:///:memory:" \
      python manage.py test app.tests.test_security_audit

Findings are tagged with the finding ID from the security-audit report:
  F1  – Hardcoded backdoor passwords in admin-backend login
  F2  – Default ADMIN_REGISTRATION_SECRET allows anonymous superuser creation
  F3  – MD5 password hashing in bulk Excel import
  F4  – IDOR: any authenticated user can download any submission media file
  F5  – Zip bomb / uncompressed-size limit missing in DOCX text extraction
  F6  – Student can see RubricScores before Khoa publishes (blind-scoring leak)
  F7  – similarity_matches exposed to students (should be hidden)
        F7b – student_code (registration_no) must NOT be shown to supervisors/reviewers
  F8  – Embargoed archive: file_url accessible via media endpoint to any auth user
  F9  – File upload: path traversal via filename
  F10 – File upload: magic-byte mismatch not rejected
  F11 – TopicSimilarityCheck: students see supervisor_name of matching projects
  F12 – IDOR on archive: student can retrieve another student's embargoed archive
  F14 – DEBUG/SECRET_KEY insecure defaults (production fail-closed guard)
  F16 – CanManageExternalGroups SAFE_METHODS readable by any authenticated user
  F18 – Login throttle rate relaxed to 120/min under DEBUG
"""

import io
import re
import struct
import zipfile

from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import identify_hasher
from django.core.files.uploadedfile import SimpleUploadedFile, InMemoryUploadedFile
from rest_framework.test import APIClient
from rest_framework import serializers as drf_serializers

User = get_user_model()

THROTTLE_OVERRIDE = {
    'DEFAULT_THROTTLE_CLASSES': [],
    'DEFAULT_THROTTLE_RATES': {},
}

DRF_OVERRIDE = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    **THROTTLE_OVERRIDE,
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_user(username, user_type='student', **kwargs):
    u = User.objects.create_user(
        username=username,
        password='TestPass!2024',
        user_type=user_type,
        email=f'{username}@test.local',
        **kwargs
    )
    return u


def _get_jwt(client, username, password='TestPass!2024'):
    resp = client.post('/app/student/login/', {'username': username, 'password': password}, format='json')
    if resp.status_code == 200:
        return resp.data.get('access')
    # Try supervisor login path
    resp = client.post('/app/supervisor/login/', {'username': username, 'password': password}, format='json')
    if resp.status_code == 200:
        return resp.data.get('access')
    return None


def _auth_client(user):
    from rest_framework_simplejwt.tokens import RefreshToken
    client = APIClient()
    refresh = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(refresh.access_token)}')
    return client


# ---------------------------------------------------------------------------
# F1 – Hardcoded backdoor passwords in admin-backend login
# ---------------------------------------------------------------------------

import os as _os
import unittest as _unittest

_ADMIN_BACKEND = _os.path.abspath(_os.path.join(
    _os.path.dirname(__file__), '..', '..', '..', '..', 'Smart-Fyp-Admin', 'backend'))


def _admin_src(rel):
    with open(_os.path.join(_ADMIN_BACKEND, rel), encoding='utf-8') as fh:
        return fh.read()


@_unittest.skipUnless(_os.path.isdir(_ADMIN_BACKEND), 'Smart-Fyp-Admin repo not checked out next to this repo')
class AdminBackdoorPasswordTest(TestCase):
    """F1 (CRITICAL): AdminLoginAPIView in Smart-Fyp-Admin must not contain hardcoded fallback passwords."""

    def test_backdoor_password_should_not_grant_access(self):
        src = _admin_src(_os.path.join('app', 'views.py'))
        for bad_pass in ["Admin@123456", "Giaovu@123456", "Utc@123456"]:
            self.assertNotIn(f'"{bad_pass}"', src, f"F1: backdoor password {bad_pass} still in admin views.py")
        self.assertIsNone(re.search(r'password\s+in\s+\[', src), "F1: password-in-list backdoor branch still present")


@_unittest.skipUnless(_os.path.isdir(_ADMIN_BACKEND), 'Smart-Fyp-Admin repo not checked out next to this repo')
class AdminRegistrationSecretTest(TestCase):
    """F2 (CRITICAL): ADMIN_REGISTRATION_SECRET must not default to a publicly known value."""

    def test_admin_registration_secret_not_default(self):
        src = _admin_src(_os.path.join('backend', 'settings.py'))
        self.assertNotIn('utc-smart-fyp-admin-secret-key-2026', src,
                         "F2: known default ADMIN_REGISTRATION_SECRET still in admin settings.py")


@_unittest.skipUnless(_os.path.isdir(_ADMIN_BACKEND), 'Smart-Fyp-Admin repo not checked out next to this repo')
class MD5PasswordHasherTest(TestCase):
    """F3 (CRITICAL): the admin Excel importer must not hash passwords with MD5."""

    def test_imported_student_password_is_not_md5(self):
        src = _admin_src(_os.path.join('app', 'services', 'excel_importer.py'))
        self.assertIsNone(re.search(r"hasher\s*=\s*['\"]md5", src),
                          "F3: excel_importer still uses hasher='md5'")


# ---------------------------------------------------------------------------
# F4 – IDOR: any authenticated user can download any submission media file
# ---------------------------------------------------------------------------

@override_settings(REST_FRAMEWORK=DRF_OVERRIDE, MEDIA_ROOT='/tmp/smart-fyp-test-media')
class SubmissionIDORTest(TestCase):
    """
    F4 (HIGH): SecureMediaDownloadView.check_attachment_access() falls through
    to `return True` for non-chat files. Any authenticated user who guesses
    the path submissions/{project_id}/{kind}/v{n}_{filename} can download
    another student's submission, bypassing project-role checks.
    Expected: access to a submission file must be denied for a user with no
    role on the corresponding project.
    """

    def _can_access(self, user, path):
        """Call check_attachment_access with the given user/path."""
        from app.views_media import check_attachment_access
        return check_attachment_access(user, path)

    def test_unrelated_student_cannot_access_submission_file(self):
        """
        F4: A student who is NOT the owner/supervisor/reviewer of a project
        must NOT be able to download that project's submission file via
        the media access check.
        """
        student_a = _make_user('student_a_idor', user_type='student')
        student_b = _make_user('student_b_idor', user_type='student')

        # Simulate a submission file path for student_a's project
        submission_path = 'submissions/42/REPORT/v1_my_thesis.pdf'

        # student_b has no role on project 42 – should be denied
        result = self._can_access(student_b, submission_path)
        self.assertFalse(
            result,
            "F4 (HIGH): check_attachment_access returns True for a student "
            "who is NOT linked to the project. Any authenticated user can "
            "download any submission file."
        )

    def test_project_owner_can_access_submission_file(self):
        """Sanity: project owner must pass the access check (once F4 is fixed)."""
        # Until the fix is in place, we just ensure the function is callable.
        from app.views_media import check_attachment_access
        self.assertTrue(callable(check_attachment_access))


# ---------------------------------------------------------------------------
# F5 – Zip bomb in DOCX text extraction
# ---------------------------------------------------------------------------

class ZipBombDocxTest(TestCase):
    """
    F5 (HIGH): feature_services.extract_text() opens a DOCX (zip) and calls
    zf.read("word/document.xml") with no limit on the uncompressed size.
    A malicious 1 MB zip can expand to >1 GB, exhausting server memory.
    Expected: extraction must refuse or truncate at a safe uncompressed limit
    before reading the bytes into memory.
    """

    @staticmethod
    def _make_bomb_docx(compressed_size_kb=100, expansion_ratio=5000):
        """
        Build a minimal DOCX whose document.xml expands to
        compressed_size_kb * expansion_ratio bytes.
        We cap it at 10 MB for the test to avoid actually OOMing CI.
        """
        raw_xml_size = min(compressed_size_kb * expansion_ratio * 1024, 10 * 1024 * 1024)
        raw_xml = (b'<w:document>' + b'A' * raw_xml_size + b'</w:document>')
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
            zf.writestr('word/document.xml', raw_xml)
        buf.seek(0)
        return buf.read()

    def test_docx_extraction_respects_uncompressed_size_limit(self):
        """
        F5: extract_text must not expand more than a safe limit (e.g. 50 MB).
        The test verifies that a large uncompressed XML does NOT cause
        a MemoryError / OOM, and that the function returns a capped string.
        If the function reads all bytes first and then truncates, this test
        will either raise MemoryError (caught as failure) or take an
        unreasonably long time.
        """
        from app.feature_services import extract_text, MAX_EXTRACTED_CHARS
        bomb_bytes = self._make_bomb_docx(compressed_size_kb=50, expansion_ratio=200)
        file_obj = io.BytesIO(bomb_bytes)
        # Must complete without MemoryError and return at most MAX_EXTRACTED_CHARS
        try:
            result = extract_text(file_obj, 'thesis.docx')
        except MemoryError:
            self.fail("F5 (HIGH): extract_text raised MemoryError on a zip bomb DOCX. "
                      "Add uncompressed-size limit before zf.read().")
        self.assertLessEqual(
            len(result),
            MAX_EXTRACTED_CHARS + 1000,  # small tolerance
            "F5 (HIGH): extract_text returned more than MAX_EXTRACTED_CHARS bytes. "
            "Truncation must happen before or during the read, not after."
        )
        # Also check that the uncompressed read itself is bounded:
        # The fix should read at most e.g. 50 MB before truncating.
        SAFE_UNCOMPRESSED_LIMIT = 50 * 1024 * 1024
        self.assertLessEqual(
            len(result.encode('utf-8', errors='replace')),
            SAFE_UNCOMPRESSED_LIMIT,
            "F5: Extracted content exceeds safe uncompressed limit."
        )


# ---------------------------------------------------------------------------
# F6 – Blind scoring: supervisor/reviewer must NOT see other evaluators' scores
# ---------------------------------------------------------------------------

@override_settings(REST_FRAMEWORK=DRF_OVERRIDE)
class BlindScoringIDORTest(TestCase):
    """
    F6 (HIGH): ProjectRubricScoreAPIView.get() filters scores by evaluator
    for SUPERVISOR/REVIEWER/COUNCIL roles (blind scoring). But if role lookup
    fails or the query param bypasses the check, a supervisor could see another
    supervisor's scores. This test asserts the blind filter is applied.
    """

    def _make_project_with_rubric(self):
        from app.models import (
            AcademicBatch, GraduationProject, Rubric, RubricCriterion,
            RubricScore, Student, Supervisor,
        )
        batch = AcademicBatch.objects.create(
            batch_code='AUD2024', batch_name='Audit Batch',
        )
        sup_user1 = _make_user('sup_blind_1', user_type='supervisor')
        sup_user2 = _make_user('sup_blind_2', user_type='supervisor')
        stu_user = _make_user('stu_blind_1', user_type='student')
        sup1 = Supervisor.objects.create(user=sup_user1, supervisor_id='E001')
        sup2 = Supervisor.objects.create(user=sup_user2, supervisor_id='E002')
        stu = Student.objects.create(user=stu_user, registration_no='SV_BLIND_01',
                                     academic_batch=batch, education_program='CQ')
        project = GraduationProject.objects.create(
            student=stu, supervisor=sup1, reviewer=sup2, batch=batch,
            topic_title_vi='Test topic blind scoring',
            status='PROPOSAL',
        )
        rubric = Rubric.objects.create(name='Supervisor Rubric', evaluator_role='SUPERVISOR', is_active=True)
        criterion = RubricCriterion.objects.create(
            rubric=rubric, name='Criterion 1', max_score=10.0, order=0
        )
        # sup1 submits a score
        score1 = RubricScore.objects.create(
            project=project, rubric=rubric, evaluator=sup_user1,
            criterion_scores={str(criterion.id): 8.0}, total_10=8.0,
        )
        # sup2 submits a different score
        score2 = RubricScore.objects.create(
            project=project, rubric=rubric, evaluator=sup_user2,
            criterion_scores={str(criterion.id): 5.0}, total_10=5.0,
        )
        return project, sup_user1, sup_user2, score1, score2

    def test_supervisor_cannot_see_other_evaluators_scores(self):
        """
        F6: supervisor sees only their own RubricScore rows, not reviewers'.
        """
        project, sup_user1, sup_user2, score1, score2 = self._make_project_with_rubric()
        client = _auth_client(sup_user1)
        resp = client.get(f'/app/graduation-project/{project.id}/rubric-scores/')
        self.assertEqual(resp.status_code, 200)
        ids_returned = [s['id'] for s in resp.data]
        self.assertIn(score1.id, ids_returned,
                      "Supervisor must see their own score.")
        self.assertNotIn(score2.id, ids_returned,
                         "F6 (HIGH): Supervisor can see reviewer's score "
                         "before Khoa reconciliation (blind scoring violated).")


# ---------------------------------------------------------------------------
# F7 – similarity_matches must be hidden from students
# ---------------------------------------------------------------------------

@override_settings(REST_FRAMEWORK=DRF_OVERRIDE)
class SimilarityMatchesStudentTest(TestCase):
    """
    F7 (MEDIUM): serialize_version() sets include_matches=False for students.
    This test checks that the GET response for a student does NOT include the
    'similarity_matches' field (which contains other students' codes).
    """

    def _setup(self):
        from app.models import AcademicBatch, GraduationProject, Student, Supervisor, SubmissionVersion
        batch = AcademicBatch.objects.create(
            batch_code='SIM2024', batch_name='Sim Batch',
        )
        sup_user = _make_user('sup_sim_1', user_type='supervisor')
        stu_user = _make_user('stu_sim_1', user_type='student')
        sup = Supervisor.objects.create(user=sup_user, supervisor_id='E_SIM_01')
        stu = Student.objects.create(user=stu_user, registration_no='SV_SIM_01',
                                     academic_batch=batch, education_program='CQ')
        project = GraduationProject.objects.create(
            student=stu, supervisor=sup, batch=batch,
            topic_title_vi='Similarity test topic', status='PROPOSAL',
        )
        version = SubmissionVersion.objects.create(
            project=project, kind='REPORT', version_no=1,
            original_name='report.pdf', uploaded_by=stu_user,
            similarity_status='CHECKED', similarity_score=35.0,
            similarity_matches=[{'version_id': 999, 'student_code': 'SV_OTHER_01', 'score': 35.0}],
        )
        return project, stu_user, version

    def test_student_does_not_see_similarity_matches(self):
        """
        F7: Student API response must NOT contain 'similarity_matches'.
        """
        project, stu_user, version = self._setup()
        client = _auth_client(stu_user)
        resp = client.get(f'/app/graduation-project/{project.id}/submissions/')
        self.assertEqual(resp.status_code, 200)
        for item in resp.data:
            self.assertNotIn(
                'similarity_matches', item,
                "F7 (MEDIUM): 'similarity_matches' exposed to student. "
                "It contains other students' registration numbers."
            )

    def test_supervisor_sees_similarity_matches(self):
        """Sanity: supervisor must receive similarity_matches."""
        from app.models import Supervisor
        project, stu_user, version = self._setup()
        sup_user = project.supervisor.user
        client = _auth_client(sup_user)
        resp = client.get(f'/app/graduation-project/{project.id}/submissions/')
        self.assertEqual(resp.status_code, 200)
        if resp.data:
            self.assertIn(
                'similarity_matches', resp.data[0],
                "Supervisor must see similarity_matches for plagiarism review."
            )


# ---------------------------------------------------------------------------
# F8 – Embargo bypass: embargoed archive file accessible via media endpoint
# ---------------------------------------------------------------------------

@override_settings(REST_FRAMEWORK=DRF_OVERRIDE, MEDIA_ROOT='/tmp/smart-fyp-test-media')
class EmbargoBypassTest(TestCase):
    """
    F8 (HIGH): ThesisArchiveListAPIView hides file_url for embargoed records,
    but SecureMediaDownloadView.check_attachment_access() returns True for any
    authenticated user accessing non-chat files. If an attacker knows the
    submission path (predictable from project_id + version_no), they bypass
    the embargo entirely.
    Expected: check_attachment_access must verify the user has a role on the
    project before allowing access to its submission files.
    """

    def test_unrelated_user_cannot_access_embargoed_file(self):
        """
        F8: An unrelated authenticated user must NOT pass access check for
        a path under submissions/ that belongs to an embargoed project.
        """
        from app.views_media import check_attachment_access
        unrelated = _make_user('unrelated_embargo', user_type='student')
        embargoed_path = 'submissions/99/REPORT/v1_secret_thesis.pdf'
        result = check_attachment_access(unrelated, embargoed_path)
        self.assertFalse(
            result,
            "F8 (HIGH): check_attachment_access returns True for an unrelated "
            "user accessing a submission file. Embargo is bypassed via direct "
            "media URL."
        )


# ---------------------------------------------------------------------------
# F9 – File upload: path traversal via filename
# ---------------------------------------------------------------------------

class FileUploadPathTraversalTest(TestCase):
    """
    F9 (MEDIUM): validate_uploaded_file() checks for '..' and '/' in basename.
    These tests confirm the check is present and effective.
    """

    def _make_file(self, name, content=b'%PDF-1.4 fake'):
        return SimpleUploadedFile(name, content, content_type='application/pdf')

    def test_path_traversal_filename_cannot_escape_upload_dir(self):
        """F9: Django's UploadedFile strips directory components from the client
        filename, so traversal sequences never reach the validator or storage.
        (The original finding was a false positive; this test pins the behaviour.)"""
        from app.validators import validate_uploaded_file
        traversal_names = [
            '../../../etc/passwd.pdf',
            'normal/../../../secret.pdf',
        ]
        for name in traversal_names:
            f = self._make_file(name)
            self.assertNotIn('..', f.name)
            self.assertNotIn('/', f.name)
            validate_uploaded_file(f, allowed_extensions=['.pdf'])

    def test_null_byte_filename_rejected(self):
        """F9: Null bytes in filenames must be rejected."""
        from app.validators import validate_uploaded_file
        f = self._make_file('thesis\x00.pdf')
        with self.assertRaises(drf_serializers.ValidationError,
                               msg="F9: Null-byte filename must be rejected."):
            validate_uploaded_file(f, allowed_extensions=['.pdf'])

    def test_normal_pdf_accepted(self):
        """Sanity: a normal PDF must pass validation."""
        from app.validators import validate_uploaded_file
        content = b'%PDF-1.4 fake pdf content here 1234'
        f = self._make_file('thesis.pdf', content)
        # Should not raise
        validate_uploaded_file(f, allowed_extensions=['.pdf'])


# ---------------------------------------------------------------------------
# F10 – File upload: magic-byte mismatch must be rejected
# ---------------------------------------------------------------------------

class FileMagicBytesTest(TestCase):
    """
    F10 (MEDIUM): validate_uploaded_file() checks magic bytes.
    A file named 'thesis.pdf' but with DOCX bytes must be rejected.
    A Windows PE executable named 'report.pdf' must be rejected.
    """

    def test_pdf_extension_with_exe_magic_rejected(self):
        """F10: MZ header (PE executable) disguised as .pdf must be rejected."""
        from app.validators import validate_uploaded_file
        exe_content = b'MZ' + b'\x00' * 100
        f = SimpleUploadedFile('report.pdf', exe_content, content_type='application/pdf')
        with self.assertRaises(drf_serializers.ValidationError,
                               msg="F10: PE executable with .pdf extension must be rejected."):
            validate_uploaded_file(f, allowed_extensions=['.pdf'])

    def test_docx_extension_without_pk_magic_rejected(self):
        """F10: A file with .docx extension but no PK magic bytes must be rejected."""
        from app.validators import validate_uploaded_file
        f = SimpleUploadedFile('thesis.docx', b'This is not a zip file at all', content_type='application/octet-stream')
        with self.assertRaises(drf_serializers.ValidationError,
                               msg="F10: DOCX without PK magic bytes must be rejected."):
            validate_uploaded_file(f, allowed_extensions=['.docx'])

    def test_shell_script_rejected_regardless_of_extension(self):
        """F10: A file starting with #! (shebang) must be rejected."""
        from app.validators import validate_uploaded_file
        f = SimpleUploadedFile('script.pdf', b'#!/bin/bash\nrm -rf /', content_type='application/pdf')
        with self.assertRaises(drf_serializers.ValidationError,
                               msg="F10: Shell script disguised as .pdf must be rejected."):
            validate_uploaded_file(f, allowed_extensions=['.pdf'])

    def test_valid_pdf_magic_accepted(self):
        """Sanity: proper PDF magic bytes must pass."""
        from app.validators import validate_uploaded_file
        content = b'%PDF-1.4\n%fake content'
        f = SimpleUploadedFile('valid.pdf', content, content_type='application/pdf')
        validate_uploaded_file(f, allowed_extensions=['.pdf'])


# ---------------------------------------------------------------------------
# F11 – TopicSimilarityCheck: students must NOT see supervisor_name
# ---------------------------------------------------------------------------

@override_settings(REST_FRAMEWORK=DRF_OVERRIDE)
class TopicSimilarityStudentViewTest(TestCase):
    """
    F11 (MEDIUM): TopicSimilarityCheckAPIView strips supervisor_name from
    results for student users. This test asserts that behaviour.
    """

    def _make_existing_project(self):
        from app.models import AcademicBatch, GraduationProject, Student, Supervisor
        batch = AcademicBatch.objects.create(
            batch_code='TOP2024', batch_name='Topic Batch',
        )
        sup_user = _make_user('sup_topsim', user_type='supervisor')
        stu_user = _make_user('stu_topsim', user_type='student')
        sup = Supervisor.objects.create(user=sup_user, supervisor_id='E_TOP')
        stu = Student.objects.create(user=stu_user, registration_no='SV_TOP_01',
                                     academic_batch=batch, education_program='CQ')
        project = GraduationProject.objects.create(
            student=stu, supervisor=sup, batch=batch,
            topic_title_vi='Hệ thống quản lý đồ án tốt nghiệp',
            status='PROPOSAL',
        )
        return stu_user, project

    def test_student_does_not_see_supervisor_name_in_topic_similarity(self):
        """
        F11: 'supervisor_name' must not appear in topic-similarity results
        returned to a student user.
        """
        stu_user, project = self._make_existing_project()
        client = _auth_client(stu_user)
        resp = client.get(
            '/app/topics/similarity-check/',
            {'title': 'Hệ thống quản lý đồ án tốt nghiệp UTC'},
        )
        self.assertEqual(resp.status_code, 200)
        for match in resp.data.get('matches', []):
            self.assertNotIn(
                'supervisor_name', match,
                "F11 (MEDIUM): 'supervisor_name' exposed to student in "
                "topic-similarity check response."
            )


# ---------------------------------------------------------------------------
# F12 – IDOR: student cannot retrieve another student's embargoed archive
# ---------------------------------------------------------------------------

@override_settings(REST_FRAMEWORK=DRF_OVERRIDE)
class ArchiveEmbargoIDORTest(TestCase):
    """
    F12 (MEDIUM): ThesisArchiveListAPIView sets can_see = admin or own or not embargoed.
    This test verifies that an embargoed record returns no file_url and no
    abstract for a student who does not own the project.
    """

    def _setup_embargoed_archive(self):
        from django.utils import timezone
        import datetime
        from app.models import (
            AcademicBatch, GraduationProject, Student, Supervisor,
            SubmissionVersion, ThesisArchiveRecord,
        )
        batch = AcademicBatch.objects.create(
            batch_code='EMB2024', batch_name='Embargo Batch',
        )
        sup_user = _make_user('sup_emb', user_type='supervisor')
        stu_user_a = _make_user('stu_emb_a', user_type='student')
        stu_user_b = _make_user('stu_emb_b', user_type='student')
        sup = Supervisor.objects.create(user=sup_user, supervisor_id='E_EMB')
        stu_a = Student.objects.create(user=stu_user_a, registration_no='SV_EMB_A',
                                       academic_batch=batch, education_program='CQ')
        stu_b = Student.objects.create(user=stu_user_b, registration_no='SV_EMB_B',
                                       academic_batch=batch, education_program='CQ')
        project_a = GraduationProject.objects.create(
            student=stu_a, supervisor=sup, batch=batch,
            topic_title_vi='Secret Project Embargo', status='PASSED',
        )
        # Create archive with embargo
        future_date = timezone.localdate() + datetime.timedelta(days=365)
        archive = ThesisArchiveRecord.objects.create(
            project=project_a,
            title='Secret Project Embargo',
            abstract='This is a secret abstract that should be hidden.',
            visibility='EMBARGOED',
            embargo_until=future_date,
            embargo_reason='Confidential',
        )
        return archive, stu_user_b

    def test_other_student_cannot_see_embargoed_abstract_or_file(self):
        """
        F12: Student B must receive empty abstract and no file_url for
        Student A's embargoed archive.
        """
        archive, stu_user_b = self._setup_embargoed_archive()
        client = _auth_client(stu_user_b)
        resp = client.get('/app/archive/')
        self.assertEqual(resp.status_code, 200)
        for record in resp.data:
            if record.get('id') == archive.id:
                self.assertEqual(
                    record.get('abstract'), '',
                    "F12 (MEDIUM): Embargoed abstract visible to unrelated student."
                )
                self.assertIsNone(
                    record.get('file_url'),
                    "F12 (MEDIUM): file_url exposed for embargoed archive to unrelated student."
                )
                self.assertIsNone(
                    record.get('final_score'),
                    "F12 (MEDIUM): final_score exposed for embargoed archive to unrelated student."
                )
                break

    def test_archive_owner_can_see_own_embargoed_data(self):
        """Sanity: the student who owns the embargoed project must see it."""
        from app.models import ThesisArchiveRecord
        archive, _ = self._setup_embargoed_archive()
        owner_user = archive.project.student.user
        client = _auth_client(owner_user)
        resp = client.get('/app/archive/')
        self.assertEqual(resp.status_code, 200)
        found = next((r for r in resp.data if r.get('id') == archive.id), None)
        self.assertIsNotNone(found, "Owner must be able to see their own archive record.")


# ---------------------------------------------------------------------------
# F4-extra – IDOR on submission versions: unrelated student gets 403
# ---------------------------------------------------------------------------

@override_settings(REST_FRAMEWORK=DRF_OVERRIDE)
class SubmissionVersionIDORTest(TestCase):
    """
    F4-extra (HIGH): ProjectSubmissionVersionsAPIView checks project_role.
    An unrelated student must receive 403 when accessing another project's
    submission list.
    """

    def _setup(self):
        from app.models import AcademicBatch, GraduationProject, Student, Supervisor
        batch = AcademicBatch.objects.create(
            batch_code='IDOR2024', batch_name='IDOR Batch',
        )
        sup_user = _make_user('sup_idor2', user_type='supervisor')
        stu_user_a = _make_user('stu_idor_a2', user_type='student')
        stu_user_b = _make_user('stu_idor_b2', user_type='student')
        sup = Supervisor.objects.create(user=sup_user, supervisor_id='E_IDR2')
        stu_a = Student.objects.create(user=stu_user_a, registration_no='SV_IDR_A2',
                                       academic_batch=batch, education_program='CQ')
        Student.objects.create(user=stu_user_b, registration_no='SV_IDR_B2',
                               academic_batch=batch, education_program='CQ')
        project_a = GraduationProject.objects.create(
            student=stu_a, supervisor=sup, batch=batch,
            topic_title_vi='Project A IDOR',
            status='PROPOSAL',
        )
        return project_a, stu_user_b

    def test_unrelated_student_cannot_list_submissions(self):
        """
        F4-extra: An unrelated student must get 403 on another project's
        submissions endpoint.
        """
        project, stu_b = self._setup()
        client = _auth_client(stu_b)
        resp = client.get(f'/app/graduation-project/{project.id}/submissions/')
        self.assertEqual(
            resp.status_code, 403,
            "F4-extra (HIGH): Unrelated student can list submissions of "
            f"project {project.id} (got {resp.status_code} instead of 403)."
        )

    def test_unauthenticated_user_cannot_list_submissions(self):
        """Submissions endpoint must require authentication."""
        project, _ = self._setup()
        client = APIClient()  # no credentials
        resp = client.get(f'/app/graduation-project/{project.id}/submissions/')
        self.assertIn(resp.status_code, [401, 403],
                      "Unauthenticated access to submissions must be blocked.")


# ---------------------------------------------------------------------------
# F7b – student_code (PII) must NOT be visible to supervisors/reviewers in
#        similarity_matches (they need overlap scores but not student IDs of
#        other students)
# ---------------------------------------------------------------------------

@override_settings(REST_FRAMEWORK=DRF_OVERRIDE)
class SimilarityMatchesStudentCodePIITest(TestCase):
    """
    F7b (MEDIUM): serialize_version() must strip 'student_code' from
    similarity_matches when the caller is SUPERVISOR, REVIEWER, or COUNCIL.
    Only ADMIN roles may see the full match including student registration numbers.
    """

    def _setup(self):
        from app.models import AcademicBatch, GraduationProject, Student, Supervisor, SubmissionVersion
        batch = AcademicBatch.objects.create(batch_code='F7B2024', batch_name='F7b Batch')
        sup_user = _make_user('sup_f7b', user_type='supervisor')
        stu_user = _make_user('stu_f7b', user_type='student')
        sup = Supervisor.objects.create(user=sup_user, supervisor_id='E_F7B')
        stu = Student.objects.create(user=stu_user, registration_no='SV_F7B_01',
                                     academic_batch=batch, education_program='CQ')
        project = GraduationProject.objects.create(
            student=stu, supervisor=sup, batch=batch,
            topic_title_vi='F7b test topic', status='PROPOSAL',
        )
        version = SubmissionVersion.objects.create(
            project=project, kind='REPORT', version_no=1,
            original_name='report.pdf', uploaded_by=stu_user,
            similarity_status='CHECKED', similarity_score=40.0,
            similarity_matches=[{
                'version_id': 777,
                'project_id': 888,
                'kind': 'REPORT',
                'topic_title_vi': 'Another thesis',
                'batch_code': 'OLD',
                'student_code': 'SV999999',  # PII – must be stripped for non-admin
                'score': 40.0,
                'snippets': [],
            }],
        )
        return project, sup_user, stu_user, version

    def test_supervisor_does_not_see_student_code_in_similarity_matches(self):
        """F7b: supervisor sees similarity_matches but without student_code field."""
        project, sup_user, _, _ = self._setup()
        client = _auth_client(sup_user)
        resp = client.get(f'/app/graduation-project/{project.id}/submissions/')
        self.assertEqual(resp.status_code, 200)
        for item in resp.data:
            matches = item.get('similarity_matches', [])
            for m in matches:
                self.assertNotIn(
                    'student_code', m,
                    "F7b (MEDIUM): 'student_code' (PII) is visible to supervisor "
                    "in similarity_matches. Only ADMIN role should see it."
                )

    def test_student_code_absent_even_when_matches_present(self):
        """F7b: regardless of match content the PII key must not leak."""
        project, sup_user, _, _ = self._setup()
        client = _auth_client(sup_user)
        resp = client.get(f'/app/graduation-project/{project.id}/submissions/')
        self.assertEqual(resp.status_code, 200)
        for item in resp.data:
            if item.get('similarity_matches'):
                for m in item['similarity_matches']:
                    self.assertNotIn('student_code', m)
                break

    def test_serialize_version_strips_student_code_for_non_admin(self):
        """Unit test: serialize_version with is_admin=False removes student_code."""
        from app.views_features import serialize_version
        from app.models import SubmissionVersion, AcademicBatch, GraduationProject, Student, Supervisor
        project, _, _, version = self._setup()
        data = serialize_version(version, include_matches=True, is_admin=False)
        for m in data.get('similarity_matches', []):
            self.assertNotIn('student_code', m,
                             "serialize_version(is_admin=False) must strip student_code")

    def test_serialize_version_keeps_student_code_for_admin(self):
        """Unit test: serialize_version with is_admin=True keeps student_code."""
        from app.views_features import serialize_version
        project, _, _, version = self._setup()
        data = serialize_version(version, include_matches=True, is_admin=True)
        for m in data.get('similarity_matches', []):
            self.assertIn('student_code', m,
                          "serialize_version(is_admin=True) must keep student_code for admin review")


# ---------------------------------------------------------------------------
# F14 – Production fail-closed: insecure SECRET_KEY must raise if DEBUG=False
# ---------------------------------------------------------------------------

class ProductionInsecureKeyTest(TestCase):
    """
    F14 (HIGH): When DEBUG=False and SECRET_KEY starts with 'django-insecure-',
    Django settings must raise ImproperlyConfigured, preventing accidental
    production deployment with a development key.
    """

    def test_insecure_key_flagged_in_settings_source(self):
        """F14: settings.py must contain the fail-closed guard."""
        import os
        settings_path = os.path.join(
            os.path.dirname(__file__), '..', '..', 'backend', 'settings.py'
        )
        with open(settings_path, encoding='utf-8') as fh:
            src = fh.read()
        self.assertIn(
            'django-insecure-',
            src,
            "F14: settings.py must reference 'django-insecure-' for the guard check"
        )
        self.assertIn(
            'ImproperlyConfigured',
            src,
            "F14 (HIGH): settings.py must raise ImproperlyConfigured when "
            "SECRET_KEY is insecure in production."
        )

    def test_login_throttle_not_relaxed_under_debug(self):
        """
        F18: login throttle rate must NOT be conditional on DEBUG.
        The rate string '120/minute' in a debug-conditional block is the vulnerable pattern.
        """
        import os
        settings_path = os.path.join(
            os.path.dirname(__file__), '..', '..', 'backend', 'settings.py'
        )
        with open(settings_path, encoding='utf-8') as fh:
            src = fh.read()
        # Must NOT contain the pattern that relaxes login throttle under DEBUG
        self.assertNotIn(
            '"login": "120/minute" if DEBUG',
            src,
            "F18 (MEDIUM): login throttle rate is conditionally relaxed to "
            "120/min under DEBUG. This allows brute-force attacks in dev "
            "environments exposed to the internet."
        )


# ---------------------------------------------------------------------------
# F16 – CanManageExternalGroups must NOT grant SAFE_METHODS to all auth users
# ---------------------------------------------------------------------------

class CanManageExternalGroupsPermissionTest(TestCase):
    """
    F16 (MEDIUM): CanManageExternalGroups.has_permission() previously returned
    True for ALL authenticated users on SAFE_METHODS (GET/HEAD/OPTIONS).
    After the fix, only external_examiner (and admin/committee) may read.
    """

    def _perm(self, user_type, method='GET'):
        """Return has_permission result for a user of given type and HTTP method."""
        from app.permissions import CanManageExternalGroups
        from unittest.mock import MagicMock
        perm = CanManageExternalGroups()
        request = MagicMock()
        request.method = method
        user = MagicMock()
        user.is_authenticated = True
        user.is_staff = False
        user.is_superuser = False
        user.user_type = user_type
        request.user = user
        return perm.has_permission(request, None)

    def test_external_examiner_can_read(self):
        """External examiners must be allowed GET (to see their own groups)."""
        self.assertTrue(self._perm('external_examiner', 'GET'),
                        "F16: external_examiner must pass GET permission check.")

    def test_student_cannot_read_external_groups(self):
        """F16: students must NOT be able to list external groups via GET."""
        self.assertFalse(
            self._perm('student', 'GET'),
            "F16 (MEDIUM): student can list external groups (CanManageExternalGroups "
            "returns True for SAFE_METHODS for all authenticated users)."
        )

    def test_supervisor_cannot_read_external_groups(self):
        """F16: supervisors must NOT be able to list external groups via GET."""
        self.assertFalse(
            self._perm('supervisor', 'GET'),
            "F16 (MEDIUM): supervisor can list external groups (CanManageExternalGroups "
            "returns True for SAFE_METHODS for all authenticated users)."
        )

    def test_admin_can_read_and_write(self):
        """Admin must pass both GET and POST permission checks."""
        self.assertTrue(self._perm('admin', 'GET'))
        self.assertTrue(self._perm('admin', 'POST'))

    def test_committee_member_can_read_and_write(self):
        """committee_member must pass both GET and POST."""
        self.assertTrue(self._perm('committee_member', 'GET'))
        self.assertTrue(self._perm('committee_member', 'POST'))

    def test_external_examiner_cannot_write(self):
        """External examiners must NOT be able to POST/PUT/DELETE external groups."""
        self.assertFalse(self._perm('external_examiner', 'POST'),
                         "F16: external_examiner must not be able to POST external groups.")
        self.assertFalse(self._perm('external_examiner', 'DELETE'),
                         "F16: external_examiner must not be able to DELETE external groups.")
