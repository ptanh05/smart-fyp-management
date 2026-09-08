import io
import zipfile
from django.utils import timezone
from django.core.files.uploadedfile import SimpleUploadedFile
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase, APIClient
from rest_framework import status

from app.models import (
    CustomUser,
    Student,
    Supervisor,
    Group,
    ProjectCategories,
    Project,
    SupervisorOfStudentGroup,
    Document,
    DocumentComment,
    AuditLog,
    AcademicBatch,
    DefenseCouncil,
    CouncilMember,
    GraduationProject,
)

User = get_user_model()


class FeatureEnhancementsTests(APITestCase):
    def setUp(self):
        super().setUp()
        self.client = APIClient()

        # 1. Supervisor User & Profile
        self.supervisor_user = User.objects.create_user(
            username='gv_test',
            email='gv_test@utc.edu.vn',
            password='testpassword123',
            user_type='supervisor',
        )
        self.supervisor = Supervisor.objects.create(
            user=self.supervisor_user,
            supervisor_id='GV9999',
        )

        # 2. Student User & Profile
        self.student_user = User.objects.create_user(
            username='sv_test',
            email='sv_test@utc.edu.vn',
            password='testpassword123',
            user_type='student',
        )
        self.student = Student.objects.create(
            user=self.student_user,
            registration_no='SV9999',
            semester='semester_7',
            phone_number='0987654321',
        )

        # 3. Category & Project
        self.category = ProjectCategories.objects.create(category_name='AI & Data Science')
        self.topic = Project.objects.create(
            project_category=self.category,
            project_name='Đề tài Gợi ý Hệ thống AI',
            project_description='Mô tả ban đầu',
            language='Python, PyTorch',
            user=self.supervisor_user,
        )

    def test_supervisor_edit_and_delete_unclaimed_topic(self):
        """Feature 2 & 3: Supervisor can edit and delete suggested topic when no groups registered."""
        self.client.force_authenticate(user=self.supervisor_user)

        # 1. Edit topic
        update_data = {
            'project_name': 'Đề tài Gợi ý Hệ thống AI Nâng Cao',
            'project_description': 'Mô tả cập nhật mới',
            'language': 'Python, TensorFlow',
        }
        res_patch = self.client.patch(f'/app/project/{self.topic.id}/', update_data, format='json')
        self.assertEqual(res_patch.status_code, status.HTTP_200_OK)
        self.topic.refresh_from_db()
        self.assertEqual(self.topic.project_name, 'Đề tài Gợi ý Hệ thống AI Nâng Cao')
        self.assertEqual(self.topic.project_description, 'Mô tả cập nhật mới')

        # 2. Delete topic
        res_delete = self.client.delete(f'/app/project/{self.topic.id}/')
        self.assertEqual(res_delete.status_code, status.HTTP_200_OK)
        self.assertFalse(Project.objects.filter(id=self.topic.id).exists())

    def test_supervisor_cannot_delete_or_edit_claimed_topic(self):
        """Feature 2 & 3: Cannot edit or delete topic if a student group is registered."""
        group = Group.objects.create(
            student_1=self.student,
            project_category=self.category,
            status='accepted',
        )
        SupervisorOfStudentGroup.objects.create(
            supervisor=self.supervisor,
            group=group,
            project=self.topic,
            created_by=self.student,
            status='accepted',
        )

        self.client.force_authenticate(user=self.supervisor_user)

        # Try to edit
        res_patch = self.client.patch(f'/app/project/{self.topic.id}/', {'project_name': 'Đổi tên'}, format='json')
        self.assertEqual(res_patch.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('không thể chỉnh sửa', res_patch.data.get('message', ''))

        # Try to delete
        res_delete = self.client.delete(f'/app/project/{self.topic.id}/')
        self.assertEqual(res_delete.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('không thể xóa', res_delete.data.get('message', ''))

    def test_document_detailed_comments(self):
        """Feature 4: Supervisor can add section/general comments on documents and retrieve them."""
        group = Group.objects.create(student_1=self.student, project_category=self.category, status='accepted')
        sup_group = SupervisorOfStudentGroup.objects.create(
            supervisor=self.supervisor, group=group, project=self.topic, created_by=self.student, status='accepted'
        )
        doc = Document.objects.create(
            group=sup_group,
            uploaded_by=self.student,
            document_type='srs_document',
            title='Báo cáo SRS',
            uploaded_file=SimpleUploadedFile('srs.pdf', b'%PDF-1.4 test', content_type='application/pdf'),
        )

        self.client.force_authenticate(user=self.supervisor_user)

        # Post comment
        comment_data = {
            'section': 'Chương 2: Yêu cầu chức năng',
            'comment': 'Cần mô tả chi tiết hơn use case đăng nhập SSO.',
        }
        res = self.client.post(f'/app/documents/{doc.id}/comments/', comment_data, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['section'], 'Chương 2: Yêu cầu chức năng')
        self.assertEqual(res.data['author_name'], self.supervisor_user.username)

        # Get comments
        res_get = self.client.get(f'/app/documents/{doc.id}/comments/')
        self.assertEqual(res_get.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_get.data), 1)
        self.assertEqual(res_get.data[0]['comment'], 'Cần mô tả chi tiết hơn use case đăng nhập SSO.')

    def test_supervisor_bulk_download_documents(self):
        """Feature 5: Bulk download multiple groups' documents as a zip."""
        group = Group.objects.create(student_1=self.student, project_category=self.category, status='accepted')
        sup_group = SupervisorOfStudentGroup.objects.create(
            supervisor=self.supervisor, group=group, project=self.topic, created_by=self.student, status='accepted'
        )
        Document.objects.create(
            group=sup_group,
            uploaded_by=self.student,
            document_type='srs_document',
            title='SRS_Nhom1',
            uploaded_file=SimpleUploadedFile('SRS_Nhom1.pdf', b'%PDF-1.4 sample content', content_type='application/pdf'),
        )

        self.client.force_authenticate(user=self.supervisor_user)
        res = self.client.post('/app/supervisor/documents/bulk-download/', {'group_ids': [sup_group.id]}, format='json')

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res['Content-Type'], 'application/zip')

        # Verify zip content
        zip_buf = io.BytesIO(res.content)
        with zipfile.ZipFile(zip_buf, 'r') as zf:
            file_names = zf.namelist()
            self.assertTrue(any('SRS_Nhom1' in name for name in file_names))

    def test_audit_log_export_csv_utf8_bom(self):
        """Feature 9: Export audit logs as CSV with UTF-8 BOM."""
        group = Group.objects.create(student_1=self.student, project_category=self.category, status='accepted')
        sup_group = SupervisorOfStudentGroup.objects.create(
            supervisor=self.supervisor, group=group, project=self.topic, created_by=self.student, status='accepted'
        )
        AuditLog.objects.create(
            user=self.supervisor_user,
            action_type='evaluation_update',
            evaluation_type='srs_supervisor',
            supervisor_group=sup_group,
            description='Cập nhật điểm đánh giá SRS: 8.5',
        )

        self.client.force_authenticate(user=self.supervisor_user)
        res = self.client.get('/app/audit-logs/export/')

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res['Content-Type'].startswith('text/csv'))
        # Check UTF-8 BOM
        self.assertTrue(res.content.startswith(b'\xef\xbb\xbf'))
        # Check Vietnamese content decoded
        content_text = res.content.decode('utf-8-sig')
        self.assertIn('Cập nhật điểm đánh giá SRS: 8.5', content_text)

    def test_council_score_locking(self):
        """Feature 8: Council lock prevents score submissions."""
        batch = AcademicBatch.objects.create(
            batch_code='K62_HK1',
            batch_name='Kỳ 1 2025-2026',
        )
        council = DefenseCouncil.objects.create(
            batch=batch,
            council_number=1,
            council_name='Hội đồng Bảo vệ ĐATN K62-CNTT01',
            session_date=timezone.now().date(),
            session_time='MORNING',
            defense_room='Phòng 301-A9',
            is_locked=False,
        )
        chair_user = User.objects.create_user(
            username='chu_tich_hd',
            email='chair@utc.edu.vn',
            password='password123',
            user_type='supervisor',
        )
        chair_sup = Supervisor.objects.create(
            user=chair_user,
            supervisor_id='GV_CHAIR',
        )
        CouncilMember.objects.create(
            council=council,
            user=chair_user,
            supervisor=chair_sup,
            role='CHAIR',
        )

        # 1. Chair locks council
        self.client.force_authenticate(user=chair_user)
        lock_res = self.client.post('/app/council/toggle-lock/', {'council_id': council.id, 'is_locked': True}, format='json')
        self.assertEqual(lock_res.status_code, status.HTTP_200_OK)
        council.refresh_from_db()
        self.assertTrue(council.is_locked)

        # 2. Member attempts to submit score -> should fail with 403 (council is locked)
        grad_project = GraduationProject.objects.create(
            student=self.student,
            supervisor=self.supervisor,
            batch=batch,
            topic_title_vi='Hệ thống quản lý',
            topic_title_en='Management System',
            status='ELIGIBLE_DEFENSE',
            council=council,
        )
        score_res = self.client.post('/app/council/submit-score/', {
            'project_id': grad_project.id,
            'score_presentation': 2.0,
            'score_content': 2.0,
            'score_qa': 2.0,
            'score_demo': 2.0,
            'comments': 'Bảo vệ tốt',
        }, format='json')
        self.assertEqual(score_res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('khóa điểm', score_res.data.get('detail', ''))
