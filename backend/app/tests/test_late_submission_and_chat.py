from datetime import timedelta
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
    DocumentRequirement,
    ChatRoom,
)
from app.views import format_late_duration
from app.serializers.serializers import ChatRoomSerializer

User = get_user_model()


class LateSubmissionAndChatAttachmentTests(APITestCase):
    def setUp(self):
        super().setUp()
        self.client = APIClient()

        # 1. Create Student User and Profile
        self.student_user = User.objects.create_user(
            username='test_student_late',
            email='student_late@utc.edu.vn',
            password='testpassword123',
            user_type='student',
        )
        self.student = Student.objects.create(
            user=self.student_user,
            registration_no='SV2026001',
            semester='semester_7',
            phone_number='0987654321',
        )

        # 2. Create Supervisor
        self.supervisor_user = User.objects.create_user(
            username='test_supervisor_chat',
            email='sup_chat@utc.edu.vn',
            password='testpassword123',
            user_type='supervisor',
        )
        self.supervisor = Supervisor.objects.create(
            user=self.supervisor_user,
            supervisor_id='GV2026001',
        )

        # 3. Create Project Category, Project, Group, and SupervisorOfStudentGroup
        self.category = ProjectCategories.objects.create(category_name='Web Development')
        self.project = Project.objects.create(
            project_category=self.category,
            project_name='Smart FYP Platform',
            project_description='Platform for FYP management',
            language='Python/TypeScript',
            functionalities='Chat, Docs, Grading',
            user=self.supervisor_user,
        )
        self.group = Group.objects.create(
            student_1=self.student,
            status='accepted',
            project_category=self.category,
        )
        self.sup_group = SupervisorOfStudentGroup.objects.create(
            group=self.group,
            supervisor=self.supervisor,
            project=self.project,
            created_by=self.student,
            status='accepted',
        )

    def test_format_late_duration_minutes(self):
        diff = timedelta(minutes=25, seconds=30)
        formatted = format_late_duration(diff)
        self.assertEqual(formatted, '25 phút')

    def test_format_late_duration_hours_and_minutes(self):
        diff = timedelta(hours=3, minutes=15)
        formatted = format_late_duration(diff)
        self.assertEqual(formatted, '3 giờ 15 phút')

    def test_format_late_duration_days(self):
        diff = timedelta(days=2, hours=4, minutes=10)
        formatted = format_late_duration(diff)
        self.assertEqual(formatted, '2 ngày 4 giờ')

    def test_upload_on_time_success(self):
        self.client.force_authenticate(user=self.student_user)

        DocumentRequirement.objects.create(
            title='SRS Document Phase 1',
            document_type='srs_document',
            deadline=timezone.now() + timedelta(days=5),
            semester='semester_7',
            allow_late_submission=False,
        )

        fake_pdf = SimpleUploadedFile('srs.pdf', b'%PDF-1.4 test content', content_type='application/pdf')
        response = self.client.post(
            '/api/proposal-document/srs_document/',
            {
                'title': 'Nộp tài liệu SRS',
                'uploaded_file': fake_pdf,
            },
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertFalse(response.data.get('is_late'))
        self.assertIsNone(response.data.get('late_duration'))

    def test_upload_late_locked_returns_403(self):
        self.client.force_authenticate(user=self.student_user)

        DocumentRequirement.objects.create(
            title='Scope Document Due Yesterday',
            document_type='scope_document',
            deadline=timezone.now() - timedelta(hours=5),
            semester='semester_7',
            allow_late_submission=False,
        )

        fake_pdf = SimpleUploadedFile('scope.pdf', b'%PDF-1.4 test content', content_type='application/pdf')
        response = self.client.post(
            '/api/proposal-document/scope_document/',
            {
                'title': 'Cố tình nộp Scope Document trễ hạn',
                'uploaded_file': fake_pdf,
            },
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('Hệ thống đã khóa tính năng nộp muộn', response.data.get('error', ''))

    def test_upload_late_allowed_marks_late_and_duration(self):
        self.client.force_authenticate(user=self.student_user)

        DocumentRequirement.objects.create(
            title='SDD Document Late Allowed',
            document_type='sdd_document',
            deadline=timezone.now() - timedelta(hours=2, minutes=30),
            semester='semester_7',
            allow_late_submission=True,
        )

        fake_pdf = SimpleUploadedFile('sdd.pdf', b'%PDF-1.4 test content', content_type='application/pdf')
        response = self.client.post(
            '/api/proposal-document/sdd_document/',
            {
                'title': 'Nộp SDD Document nộp muộn cho phép',
                'uploaded_file': fake_pdf,
            },
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data.get('is_late'))
        self.assertIsNotNone(response.data.get('late_duration'))
        self.assertTrue('Trễ' in response.data.get('late_duration', ''))

    def test_chat_room_attachment_empty_message_allowed(self):
        fake_image = SimpleUploadedFile('screenshot.png', b'fake image bytes', content_type='image/png')
        data = {
            'group': self.sup_group.id,
            'message': '',
            'attachment': fake_image,
        }
        serializer = ChatRoomSerializer(data=data)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        instance = serializer.save(sent_by='student', student=self.student)
        self.assertEqual(instance.attachment_name, 'screenshot.png')
        self.assertEqual(instance.attachment_type, 'image/png')
        self.assertGreater(instance.attachment_size, 0)

    def test_chat_room_attachment_size_limit_validation(self):
        huge_file = SimpleUploadedFile('huge.pdf', b'fake', content_type='application/pdf')
        huge_file.size = 26 * 1024 * 1024

        data = {
            'group': self.sup_group.id,
            'message': 'Here is a huge file',
            'attachment': huge_file,
        }
        serializer = ChatRoomSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('attachment', serializer.errors)
        self.assertIn('exceeds maximum allowed size of 25MB', str(serializer.errors['attachment']))