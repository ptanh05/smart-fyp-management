"""
Backend API Integration Tests for External Examiner Functionality.

This module contains comprehensive tests for:
- External Examiner authentication and profile
- External Groups management
- Student group assignments
- External evaluations
- Permission restrictions
"""

from django.test import TestCase
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from django.utils import timezone
from app.models import (
    CustomUser, Student, Supervisor, CommitteeMember, ExternalExaminer,
    Group, Project, ProjectCategories, SupervisorOfStudentGroup,
    ExternalGroup, ExternalGroupAssignment, ExternalEvaluation,
    CommitteeMemberPanel, Notification
)


class ExternalExaminerAPITests(APITestCase):
    """Test External Examiner API endpoints."""
    
    def setUp(self):
        """Set up test data."""
        # Create external examiner user
        self.external_user = CustomUser.objects.create_user(
            username='external1',
            password='test123',
            email='external@test.com',
            user_type='external_examiner',
            first_name='Dr. External',
            last_name='Examiner'
        )
        self.external = ExternalExaminer.objects.create(
            user=self.external_user,
            external_id='EXT-001',
            institution='Test University',
            designation='professor'
        )
        
        # Create committee member for management tests
        self.committee_user = CustomUser.objects.create_user(
            username='committee1',
            password='test123',
            email='committee@test.com',
            user_type='committee_member'
        )
        panel = CommitteeMemberPanel.objects.create(name='Panel A')
        self.committee = CommitteeMember.objects.create(
            user=self.committee_user,
            committee_id='COM-001',
            panel=panel
        )
        
        # Create student and supervisor for assignment tests
        self.setup_student_group()
        
        self.client = APIClient()
    
    def setup_student_group(self):
        """Create a student group for testing."""
        # Create students
        student1_user = CustomUser.objects.create_user(
            username='student1', password='test123',
            email='s1@test.com', user_type='student'
        )
        student2_user = CustomUser.objects.create_user(
            username='student2', password='test123',
            email='s2@test.com', user_type='student'
        )
        self.student1 = Student.objects.create(
            user=student1_user,
            registration_no='2021-CS-001',
            semester='semester_8'
        )
        self.student2 = Student.objects.create(
            user=student2_user,
            registration_no='2021-CS-002',
            semester='semester_8'
        )
        
        # Create supervisor
        supervisor_user = CustomUser.objects.create_user(
            username='supervisor1', password='test123',
            email='sup@test.com', user_type='supervisor'
        )
        self.category = ProjectCategories.objects.create(category_name='Web Development')
        self.supervisor = Supervisor.objects.create(
            user=supervisor_user,
            supervisor_id='EMP-001'
        )
        self.supervisor.category.add(self.category)
        
        # Create project
        self.project = Project.objects.create(
            project_name='Test Project',
            project_description='Test Description',
            project_category=self.category,
            language='Python',
            functionalities='Test functionalities'
        )
        
        # Create group
        self.group = Group.objects.create(
            student_1=self.student1,
            student_2=self.student2,
            status='accepted',
            project_category=self.category
        )
        
        # Create supervisor-student relationship
        self.supervisor_group = SupervisorOfStudentGroup.objects.create(
            group=self.group,
            supervisor=self.supervisor,
            project=self.project,
            status='accepted',
            created_by=self.student1,
            is_ready_for_external=True
        )
    
    # ============ External Profile Tests ============
    
    def test_external_profile_unauthenticated(self):
        """Test profile access without authentication."""
        response = self.client.get('/api/external/profile/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    def test_external_profile_authenticated(self):
        """Test profile access with authentication."""
        self.client.force_authenticate(user=self.external_user)
        response = self.client.get('/api/external/profile/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['external_id'], 'EXT-001')
        self.assertEqual(response.data['institution'], 'Test University')
    
    def test_external_profile_wrong_user_type(self):
        """Test profile access with non-external user."""
        self.client.force_authenticate(user=self.committee_user)
        response = self.client.get('/api/external/profile/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    
    # ============ External Dashboard Tests ============
    
    def test_external_dashboard(self):
        """Test dashboard data retrieval."""
        self.client.force_authenticate(user=self.external_user)
        response = self.client.get('/api/external/dashboard/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('profile', response.data)
        self.assertIn('statistics', response.data)
        self.assertIn('external_groups', response.data)
    
    def test_external_dashboard_unauthenticated(self):
        """Test dashboard access without authentication."""
        response = self.client.get('/api/external/dashboard/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    # ============ External Login Tests ============
    
    def test_external_login_success(self):
        """Test successful external examiner login."""
        response = self.client.post('/api/external/login/', {
            'email': 'external@test.com',
            'password': 'test123'
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh_token', response.cookies)
    
    def test_external_login_invalid_credentials(self):
        """Test login with invalid credentials."""
        response = self.client.post('/api/external/login/', {
            'email': 'external@test.com',
            'password': 'wrongpassword'
        })
        self.assertIn(response.status_code, [status.HTTP_400_BAD_REQUEST, status.HTTP_401_UNAUTHORIZED])
    
    def test_external_login_non_external_user(self):
        """Test login attempt with non-external user."""
        response = self.client.post('/api/external/login/', {
            'email': 'committee@test.com',
            'password': 'test123'
        })
        self.assertIn(response.status_code, [status.HTTP_400_BAD_REQUEST, status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])
    
    # ============ External Group Tests ============
    
    def test_create_external_group_as_committee(self):
        """Test creating external group as committee member."""
        self.client.force_authenticate(user=self.committee_user)
        data = {
            'name': 'External Group A',
            'external_examiner': self.external.id,
            'semester': 'Spring 2026',
            'max_groups': 7
        }
        response = self.client.post('/api/external/groups/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['name'], 'External Group A')
    
    def test_create_external_group_as_external(self):
        """Test that external examiner cannot create groups."""
        self.client.force_authenticate(user=self.external_user)
        data = {
            'name': 'External Group B',
            'external_examiner': self.external.id,
            'semester': 'Spring 2026'
        }
        response = self.client.post('/api/external/groups/', data)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    
    def test_list_external_groups(self):
        """Test listing external groups."""
        # Create a group first
        ExternalGroup.objects.create(
            name='Test External Group',
            external_examiner=self.external,
            semester='Spring 2026',
            created_by=self.committee_user
        )
        
        self.client.force_authenticate(user=self.external_user)
        response = self.client.get('/api/external/groups/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Check response structure
        if 'results' in response.data:
            self.assertTrue(len(response.data['results']) >= 1)
        else:
            self.assertTrue(len(response.data) >= 1)
    
    def test_external_group_detail(self):
        """Test retrieving external group details."""
        ext_group = ExternalGroup.objects.create(
            name='Test External Group',
            external_examiner=self.external,
            semester='Spring 2026',
            created_by=self.committee_user
        )
        
        self.client.force_authenticate(user=self.external_user)
        response = self.client.get(f'/api/external/groups/{ext_group.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], 'Test External Group')
    
    def test_delete_external_group_as_committee(self):
        """Test deleting external group as committee member."""
        ext_group = ExternalGroup.objects.create(
            name='Test External Group',
            external_examiner=self.external,
            semester='Spring 2026',
            created_by=self.committee_user
        )
        
        self.client.force_authenticate(user=self.committee_user)
        response = self.client.delete(f'/api/external/groups/{ext_group.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        
        # Verify deletion
        self.assertFalse(ExternalGroup.objects.filter(id=ext_group.id).exists())
    
    def test_delete_external_group_as_external(self):
        """Test that external examiner cannot delete groups."""
        ext_group = ExternalGroup.objects.create(
            name='Test External Group',
            external_examiner=self.external,
            semester='Spring 2026',
            created_by=self.committee_user
        )
        
        self.client.force_authenticate(user=self.external_user)
        response = self.client.delete(f'/api/external/groups/{ext_group.id}/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    
    # ============ Assignment Tests ============
    
    def test_create_assignment(self):
        """Test assigning student group to external."""
        ext_group = ExternalGroup.objects.create(
            name='Test External Group',
            external_examiner=self.external,
            semester='Spring 2026',
            created_by=self.committee_user
        )
        
        self.client.force_authenticate(user=self.committee_user)
        data = {
            'external_group': ext_group.id,
            'supervisor_group': self.supervisor_group.id
        }
        response = self.client.post('/api/external/assignments/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
    
    def test_duplicate_assignment_fails(self):
        """Test that duplicate assignment fails."""
        ext_group = ExternalGroup.objects.create(
            name='Test External Group',
            external_examiner=self.external,
            semester='Spring 2026',
            created_by=self.committee_user
        )
        
        # Create first assignment
        ExternalGroupAssignment.objects.create(
            external_group=ext_group,
            supervisor_group=self.supervisor_group,
            assigned_by=self.committee_user
        )
        
        # Try to create duplicate
        self.client.force_authenticate(user=self.committee_user)
        data = {
            'external_group': ext_group.id,
            'supervisor_group': self.supervisor_group.id
        }
        response = self.client.post('/api/external/assignments/', data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_assignment_auto_slot_number(self):
        """Test that slot numbers are auto-assigned."""
        ext_group = ExternalGroup.objects.create(
            name='Test External Group',
            external_examiner=self.external,
            semester='Spring 2026',
            max_groups=7,
            created_by=self.committee_user
        )
        
        assignment = ExternalGroupAssignment.objects.create(
            external_group=ext_group,
            supervisor_group=self.supervisor_group,
            assigned_by=self.committee_user
        )
        
        self.assertEqual(assignment.slot_number, 1)
    
    def test_delete_assignment(self):
        """Test deleting an assignment."""
        ext_group = ExternalGroup.objects.create(
            name='Test External Group',
            external_examiner=self.external,
            semester='Spring 2026',
            created_by=self.committee_user
        )
        
        assignment = ExternalGroupAssignment.objects.create(
            external_group=ext_group,
            supervisor_group=self.supervisor_group,
            assigned_by=self.committee_user
        )
        
        self.client.force_authenticate(user=self.committee_user)
        response = self.client.delete(f'/api/external/assignments/{assignment.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
    
    # ============ Available Groups Tests ============
    
    def test_list_available_groups_for_external(self):
        """Test listing groups available for external assignment."""
        self.client.force_authenticate(user=self.committee_user)
        response = self.client.get('/api/external/available-groups/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
    
    # ============ Evaluation Tests ============
    
    def test_create_evaluation(self):
        """Test creating external evaluation."""
        ext_group = ExternalGroup.objects.create(
            name='Test External Group',
            external_examiner=self.external,
            semester='Spring 2026',
            created_by=self.committee_user
        )
        assignment = ExternalGroupAssignment.objects.create(
            external_group=ext_group,
            supervisor_group=self.supervisor_group,
            assigned_by=self.committee_user
        )
        
        self.client.force_authenticate(user=self.external_user)
        data = {
            'assignment': assignment.id,
            'project_completion': 'good',
            'code_quality': 'excellent',
            'functionality': 'good',
            'understanding_of_technology': 'good',
            'problem_solving': 'adequate',
            'innovation': 'good',
            'presentation_clarity': 'excellent',
            'communication': 'good',
            'time_management': 'adequate',
            'documentation_completeness': 'good',
            'documentation_quality': 'good',
            'qa_response': 'excellent',
            'overall_comment': 'Good project',
            'is_pass': True
        }
        response = self.client.post('/api/external/evaluations/create/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Verify notifications created for students and supervisor
        self.assertTrue(
            Notification.objects.filter(
                user=self.student1.user,
                notification_type='evaluation_completed'
            ).exists()
        )
        self.assertTrue(
            Notification.objects.filter(
                user=self.student2.user,
                notification_type='evaluation_completed'
            ).exists()
        )
        self.assertTrue(
            Notification.objects.filter(
                user=self.supervisor.user,
                notification_type='evaluation_completed'
            ).exists()
        )

    def test_notification_sent_when_external_evaluation_created(self):
        """Test that automatic notification is fired to students and supervisor upon external evaluation submission."""
        Notification.objects.all().delete()
        
        ext_group = ExternalGroup.objects.create(
            name='Notification Test External Group',
            external_examiner=self.external,
            semester='Spring 2026',
            created_by=self.committee_user
        )
        assignment = ExternalGroupAssignment.objects.create(
            external_group=ext_group,
            supervisor_group=self.supervisor_group,
            assigned_by=self.committee_user
        )
        
        self.client.force_authenticate(user=self.external_user)
        data = {
            'assignment': assignment.id,
            'project_completion': 'excellent',
            'code_quality': 'excellent',
            'functionality': 'excellent',
            'understanding_of_technology': 'excellent',
            'problem_solving': 'excellent',
            'innovation': 'excellent',
            'presentation_clarity': 'excellent',
            'communication': 'excellent',
            'time_management': 'excellent',
            'documentation_completeness': 'excellent',
            'documentation_quality': 'excellent',
            'qa_response': 'excellent',
            'overall_comment': 'Outstanding work by the group',
            'is_pass': True
        }
        response = self.client.post('/api/external/evaluations/create/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Check student 1 notification
        s1_notif = Notification.objects.filter(
            user=self.student1.user,
            notification_type='evaluation_completed'
        ).first()
        self.assertIsNotNone(s1_notif)
        self.assertEqual(s1_notif.title, 'External Evaluation Completed')
        self.assertIn('Chuyên gia ngoài', s1_notif.message)
        self.assertFalse(s1_notif.is_read)
        
        # Check student 2 notification
        s2_notif = Notification.objects.filter(
            user=self.student2.user,
            notification_type='evaluation_completed'
        ).first()
        self.assertIsNotNone(s2_notif)
        self.assertIn('Chuyên gia ngoài', s2_notif.message)
        
        # Check supervisor notification
        sup_notif = Notification.objects.filter(
            user=self.supervisor.user,
            notification_type='evaluation_completed'
        ).first()
        self.assertIsNotNone(sup_notif)
        self.assertIn('Chuyên gia ngoài', sup_notif.message)
        self.assertEqual(sup_notif.action_url, '/supervisor/dashboard?tab=evaluations')

    def test_create_evaluation_unauthenticated(self):
        """Test creating evaluation without authentication."""
        ext_group = ExternalGroup.objects.create(
            name='Test External Group',
            external_examiner=self.external,
            semester='Spring 2026',
            created_by=self.committee_user
        )
        assignment = ExternalGroupAssignment.objects.create(
            external_group=ext_group,
            supervisor_group=self.supervisor_group,
            assigned_by=self.committee_user
        )
        
        data = {
            'assignment': assignment.id,
            'project_completion': 'good',
            'code_quality': 'good',
            'functionality': 'good',
            'understanding_of_technology': 'good',
            'problem_solving': 'good',
            'innovation': 'good',
            'presentation_clarity': 'good',
            'communication': 'good',
            'time_management': 'good',
            'documentation_completeness': 'good',
            'documentation_quality': 'good',
            'qa_response': 'good',
            'is_pass': True
        }
        response = self.client.post('/api/external/evaluations/create/', data)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    def test_evaluation_marks_calculation(self):
        """Test that evaluation marks are calculated correctly."""
        ext_group = ExternalGroup.objects.create(
            name='Test External Group',
            external_examiner=self.external,
            semester='Spring 2026',
            created_by=self.committee_user
        )
        assignment = ExternalGroupAssignment.objects.create(
            external_group=ext_group,
            supervisor_group=self.supervisor_group,
            assigned_by=self.committee_user
        )
        
        # Create evaluation with all 'excellent' ratings
        evaluation = ExternalEvaluation.objects.create(
            assignment=assignment,
            project_completion='excellent',
            code_quality='excellent',
            functionality='excellent',
            understanding_of_technology='excellent',
            problem_solving='excellent',
            innovation='excellent',
            presentation_clarity='excellent',
            communication='excellent',
            time_management='excellent',
            documentation_completeness='excellent',
            documentation_quality='excellent',
            qa_response='excellent',
            is_pass=True
        )
        
        # All excellent = 95% of each criterion
        # Total should be 95
        self.assertEqual(evaluation.total_marks, 95.0)
        self.assertEqual(evaluation.grade, 'A')
    
    def test_evaluation_marks_calculation_mixed(self):
        """Test marks calculation with mixed ratings."""
        ext_group = ExternalGroup.objects.create(
            name='Test External Group',
            external_examiner=self.external,
            semester='Spring 2026',
            created_by=self.committee_user
        )
        assignment = ExternalGroupAssignment.objects.create(
            external_group=ext_group,
            supervisor_group=self.supervisor_group,
            assigned_by=self.committee_user
        )
        
        # Create evaluation with all 'good' ratings
        evaluation = ExternalEvaluation.objects.create(
            assignment=assignment,
            project_completion='good',
            code_quality='good',
            functionality='good',
            understanding_of_technology='good',
            problem_solving='good',
            innovation='good',
            presentation_clarity='good',
            communication='good',
            time_management='good',
            documentation_completeness='good',
            documentation_quality='good',
            qa_response='good',
            is_pass=True
        )
        
        # All good = 75% of each criterion
        # Total should be 75
        self.assertEqual(evaluation.total_marks, 75.0)
        self.assertEqual(evaluation.grade, 'B+')
    
    def test_evaluation_grade_boundaries(self):
        """Test grade boundaries."""
        ext_group = ExternalGroup.objects.create(
            name='Test External Group',
            external_examiner=self.external,
            semester='Spring 2026',
            created_by=self.committee_user
        )
        assignment = ExternalGroupAssignment.objects.create(
            external_group=ext_group,
            supervisor_group=self.supervisor_group,
            assigned_by=self.committee_user
        )
        
        # Create evaluation with 'adequate' ratings (50%)
        evaluation = ExternalEvaluation.objects.create(
            assignment=assignment,
            project_completion='adequate',
            code_quality='adequate',
            functionality='adequate',
            understanding_of_technology='adequate',
            problem_solving='adequate',
            innovation='adequate',
            presentation_clarity='adequate',
            communication='adequate',
            time_management='adequate',
            documentation_completeness='adequate',
            documentation_quality='adequate',
            qa_response='adequate',
            is_pass=True
        )
        
        # All adequate = 50% of each criterion
        self.assertEqual(evaluation.total_marks, 50.0)
        self.assertEqual(evaluation.grade, 'C')
    
    def test_update_evaluation(self):
        """Test updating an existing evaluation."""
        ext_group = ExternalGroup.objects.create(
            name='Test External Group',
            external_examiner=self.external,
            semester='Spring 2026',
            created_by=self.committee_user
        )
        assignment = ExternalGroupAssignment.objects.create(
            external_group=ext_group,
            supervisor_group=self.supervisor_group,
            assigned_by=self.committee_user
        )
        evaluation = ExternalEvaluation.objects.create(
            assignment=assignment,
            project_completion='good',
            code_quality='good',
            functionality='good',
            understanding_of_technology='good',
            problem_solving='good',
            innovation='good',
            presentation_clarity='good',
            communication='good',
            time_management='good',
            documentation_completeness='good',
            documentation_quality='good',
            qa_response='good',
            is_pass=True
        )
        
        self.client.force_authenticate(user=self.external_user)
        update_data = {
            'project_completion': 'excellent',
            'overall_comment': 'Updated comment'
        }
        response = self.client.patch(f'/api/external/evaluations/{evaluation.id}/', update_data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify update
        evaluation.refresh_from_db()
        self.assertEqual(evaluation.project_completion, 'excellent')
        self.assertEqual(evaluation.overall_comment, 'Updated comment')
    
    def test_list_evaluations(self):
        """Test listing evaluations."""
        ext_group = ExternalGroup.objects.create(
            name='Test External Group',
            external_examiner=self.external,
            semester='Spring 2026',
            created_by=self.committee_user
        )
        assignment = ExternalGroupAssignment.objects.create(
            external_group=ext_group,
            supervisor_group=self.supervisor_group,
            assigned_by=self.committee_user
        )
        ExternalEvaluation.objects.create(
            assignment=assignment,
            project_completion='good',
            code_quality='good',
            functionality='good',
            understanding_of_technology='good',
            problem_solving='good',
            innovation='good',
            presentation_clarity='good',
            communication='good',
            time_management='good',
            documentation_completeness='good',
            documentation_quality='good',
            qa_response='good',
            is_pass=True
        )
        
        self.client.force_authenticate(user=self.external_user)
        response = self.client.get('/api/external/evaluations/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)


class ExternalPermissionTests(APITestCase):
    """Test permission restrictions."""
    
    def setUp(self):
        self.student_user = CustomUser.objects.create_user(
            username='student', password='test123',
            email='student@test.com', user_type='student'
        )
        self.supervisor_user = CustomUser.objects.create_user(
            username='supervisor', password='test123',
            email='sup@test.com', user_type='supervisor'
        )
        self.client = APIClient()
    
    def test_student_cannot_access_external_profile(self):
        """Students should not access external profile endpoint."""
        self.client.force_authenticate(user=self.student_user)
        response = self.client.get('/api/external/profile/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    
    def test_student_cannot_access_external_dashboard(self):
        """Students should not access external dashboard endpoint."""
        self.client.force_authenticate(user=self.student_user)
        response = self.client.get('/api/external/dashboard/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    
    def test_supervisor_cannot_access_external_profile(self):
        """Supervisors should not access external profile endpoint."""
        self.client.force_authenticate(user=self.supervisor_user)
        response = self.client.get('/api/external/profile/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    
    def test_supervisor_cannot_access_external_dashboard(self):
        """Supervisors should not access external dashboard endpoint."""
        self.client.force_authenticate(user=self.supervisor_user)
        response = self.client.get('/api/external/dashboard/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class ExternalExaminerListTests(APITestCase):
    """Test External Examiner listing for committee members."""
    
    def setUp(self):
        # Create committee member
        self.committee_user = CustomUser.objects.create_user(
            username='committee1',
            password='test123',
            email='committee@test.com',
            user_type='committee_member'
        )
        panel = CommitteeMemberPanel.objects.create(name='Panel A')
        self.committee = CommitteeMember.objects.create(
            user=self.committee_user,
            committee_id='COM-001',
            panel=panel
        )
        
        # Create external examiners
        for i in range(3):
            ext_user = CustomUser.objects.create_user(
                username=f'external{i}',
                password='test123',
                email=f'external{i}@test.com',
                user_type='external_examiner',
                first_name=f'Dr. External{i}',
                last_name='Examiner'
            )
            ExternalExaminer.objects.create(
                user=ext_user,
                external_id=f'EXT-{i:03d}',
                institution=f'University {i}',
                designation='professor'
            )
        
        self.client = APIClient()
    
    def test_list_external_examiners(self):
        """Test listing all external examiners."""
        self.client.force_authenticate(user=self.committee_user)
        response = self.client.get('/api/external/examiners/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Check response structure
        if 'results' in response.data:
            self.assertEqual(len(response.data['results']), 3)
        else:
            self.assertEqual(len(response.data), 3)


class StudentExternalEvaluationTests(APITestCase):
    """Test student viewing their external evaluation."""
    
    def setUp(self):
        # Create external examiner
        self.external_user = CustomUser.objects.create_user(
            username='external1',
            password='test123',
            email='external@test.com',
            user_type='external_examiner'
        )
        self.external = ExternalExaminer.objects.create(
            user=self.external_user,
            external_id='EXT-001',
            institution='Test University',
            designation='professor'
        )
        
        # Create committee member
        self.committee_user = CustomUser.objects.create_user(
            username='committee1',
            password='test123',
            email='committee@test.com',
            user_type='committee_member'
        )
        panel = CommitteeMemberPanel.objects.create(name='Panel A')
        CommitteeMember.objects.create(
            user=self.committee_user,
            committee_id='COM-001',
            panel=panel
        )
        
        # Create students
        self.student1_user = CustomUser.objects.create_user(
            username='student1', password='test123',
            email='s1@test.com', user_type='student'
        )
        student2_user = CustomUser.objects.create_user(
            username='student2', password='test123',
            email='s2@test.com', user_type='student'
        )
        self.student1 = Student.objects.create(
            user=self.student1_user,
            registration_no='2021-CS-001',
            semester='semester_8'
        )
        self.student2 = Student.objects.create(
            user=student2_user,
            registration_no='2021-CS-002',
            semester='semester_8'
        )
        
        # Create supervisor
        supervisor_user = CustomUser.objects.create_user(
            username='supervisor1', password='test123',
            email='sup@test.com', user_type='supervisor'
        )
        category = ProjectCategories.objects.create(category_name='Web Development')
        supervisor = Supervisor.objects.create(
            user=supervisor_user,
            supervisor_id='EMP-001'
        )
        
        # Create project
        project = Project.objects.create(
            project_name='Test Project',
            project_description='Test Description',
            project_category=category,
            language='Python',
            functionalities='Test functionalities'
        )
        
        # Create group
        group = Group.objects.create(
            student_1=self.student1,
            student_2=self.student2,
            status='accepted',
            project_category=category
        )
        
        # Create supervisor-student relationship
        self.supervisor_group = SupervisorOfStudentGroup.objects.create(
            group=group,
            supervisor=supervisor,
            project=project,
            status='accepted',
            created_by=self.student1,
            is_ready_for_external=True
        )
        
        # Create external group and assignment
        self.ext_group = ExternalGroup.objects.create(
            name='Test External Group',
            external_examiner=self.external,
            semester='Spring 2026',
            created_by=self.committee_user
        )
        self.assignment = ExternalGroupAssignment.objects.create(
            external_group=self.ext_group,
            supervisor_group=self.supervisor_group,
            assigned_by=self.committee_user
        )
        
        self.client = APIClient()
    
    def test_student_view_own_evaluation(self):
        """Test student viewing their own external evaluation."""
        # Create evaluation
        ExternalEvaluation.objects.create(
            assignment=self.assignment,
            project_completion='good',
            code_quality='good',
            functionality='good',
            understanding_of_technology='good',
            problem_solving='good',
            innovation='good',
            presentation_clarity='good',
            communication='good',
            time_management='good',
            documentation_completeness='good',
            documentation_quality='good',
            qa_response='good',
            is_pass=True
        )
        
        self.client.force_authenticate(user=self.student1_user)
        response = self.client.get('/api/student/external-evaluation/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('total_marks', response.data)
        self.assertIn('grade', response.data)
    
    def test_student_no_evaluation_yet(self):
        """Test student viewing when no evaluation exists."""
        self.client.force_authenticate(user=self.student1_user)
        response = self.client.get('/api/student/external-evaluation/')
        # Should return 404 when no evaluation exists
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class ExternalGroupCapacityTests(APITestCase):
    """Test external group capacity limits."""
    
    def setUp(self):
        # Create external examiner
        self.external_user = CustomUser.objects.create_user(
            username='external1',
            password='test123',
            email='external@test.com',
            user_type='external_examiner'
        )
        self.external = ExternalExaminer.objects.create(
            user=self.external_user,
            external_id='EXT-001',
            institution='Test University',
            designation='professor'
        )
        
        # Create committee member
        self.committee_user = CustomUser.objects.create_user(
            username='committee1',
            password='test123',
            email='committee@test.com',
            user_type='committee_member'
        )
        panel = CommitteeMemberPanel.objects.create(name='Panel A')
        CommitteeMember.objects.create(
            user=self.committee_user,
            committee_id='COM-001',
            panel=panel
        )
        
        self.category = ProjectCategories.objects.create(category_name='Web Development')
        
        self.client = APIClient()
    
    def create_student_group(self, index):
        """Helper to create a student group."""
        student1_user = CustomUser.objects.create_user(
            username=f'student{index}a', password='test123',
            email=f's{index}a@test.com', user_type='student'
        )
        student2_user = CustomUser.objects.create_user(
            username=f'student{index}b', password='test123',
            email=f's{index}b@test.com', user_type='student'
        )
        student1 = Student.objects.create(
            user=student1_user,
            registration_no=f'2021-CS-{index:03d}A',
            semester='semester_8'
        )
        student2 = Student.objects.create(
            user=student2_user,
            registration_no=f'2021-CS-{index:03d}B',
            semester='semester_8'
        )
        
        supervisor_user = CustomUser.objects.create_user(
            username=f'supervisor{index}', password='test123',
            email=f'sup{index}@test.com', user_type='supervisor'
        )
        supervisor = Supervisor.objects.create(
            user=supervisor_user,
            supervisor_id=f'EMP-{index:03d}'
        )
        
        project = Project.objects.create(
            project_name=f'Test Project {index}',
            project_description='Test Description',
            project_category=self.category,
            language='Python',
            functionalities='Test functionalities'
        )
        
        group = Group.objects.create(
            student_1=student1,
            student_2=student2,
            status='accepted',
            project_category=self.category
        )
        
        return SupervisorOfStudentGroup.objects.create(
            group=group,
            supervisor=supervisor,
            project=project,
            status='accepted',
            created_by=student1,
            is_ready_for_external=True
        )
    
    def test_external_group_capacity_properties(self):
        """Test external group capacity-related properties."""
        ext_group = ExternalGroup.objects.create(
            name='Test External Group',
            external_examiner=self.external,
            semester='Spring 2026',
            max_groups=3,
            created_by=self.committee_user
        )
        
        # Initial state
        self.assertEqual(ext_group.assigned_count, 0)
        self.assertEqual(ext_group.available_slots, 3)
        self.assertFalse(ext_group.is_full)
        
        # Add assignments
        for i in range(3):
            supervisor_group = self.create_student_group(i)
            ExternalGroupAssignment.objects.create(
                external_group=ext_group,
                supervisor_group=supervisor_group,
                assigned_by=self.committee_user
            )
        
        # After filling
        self.assertEqual(ext_group.assigned_count, 3)
        self.assertEqual(ext_group.available_slots, 0)
        self.assertTrue(ext_group.is_full)


class ExternalEvaluationDetailTests(APITestCase):
    """Test detailed evaluation calculations."""
    
    def setUp(self):
        # Create external examiner
        self.external_user = CustomUser.objects.create_user(
            username='external1',
            password='test123',
            email='external@test.com',
            user_type='external_examiner'
        )
        self.external = ExternalExaminer.objects.create(
            user=self.external_user,
            external_id='EXT-001',
            institution='Test University',
            designation='professor'
        )
        
        # Create committee member
        self.committee_user = CustomUser.objects.create_user(
            username='committee1',
            password='test123',
            email='committee@test.com',
            user_type='committee_member'
        )
        panel = CommitteeMemberPanel.objects.create(name='Panel A')
        CommitteeMember.objects.create(
            user=self.committee_user,
            committee_id='COM-001',
            panel=panel
        )
        
        # Create students
        student1_user = CustomUser.objects.create_user(
            username='student1', password='test123',
            email='s1@test.com', user_type='student'
        )
        student2_user = CustomUser.objects.create_user(
            username='student2', password='test123',
            email='s2@test.com', user_type='student'
        )
        category = ProjectCategories.objects.create(category_name='Web Development')
        student1 = Student.objects.create(
            user=student1_user,
            registration_no='2021-CS-001',
            semester='semester_8'
        )
        student2 = Student.objects.create(
            user=student2_user,
            registration_no='2021-CS-002',
            semester='semester_8'
        )
        
        # Create supervisor
        supervisor_user = CustomUser.objects.create_user(
            username='supervisor1', password='test123',
            email='sup@test.com', user_type='supervisor'
        )
        supervisor = Supervisor.objects.create(
            user=supervisor_user,
            supervisor_id='EMP-001'
        )
        
        # Create project
        project = Project.objects.create(
            project_name='Test Project',
            project_description='Test Description',
            project_category=category,
            language='Python',
            functionalities='Test functionalities'
        )
        
        # Create group
        group = Group.objects.create(
            student_1=student1,
            student_2=student2,
            status='accepted',
            project_category=category
        )
        
        # Create supervisor-student relationship
        supervisor_group = SupervisorOfStudentGroup.objects.create(
            group=group,
            supervisor=supervisor,
            project=project,
            status='accepted',
            created_by=student1,
            is_ready_for_external=True
        )
        
        # Create external group and assignment
        ext_group = ExternalGroup.objects.create(
            name='Test External Group',
            external_examiner=self.external,
            semester='Spring 2026',
            created_by=self.committee_user
        )
        self.assignment = ExternalGroupAssignment.objects.create(
            external_group=ext_group,
            supervisor_group=supervisor_group,
            assigned_by=self.committee_user
        )
    
    def test_project_implementation_marks(self):
        """Test project implementation marks calculation."""
        evaluation = ExternalEvaluation.objects.create(
            assignment=self.assignment,
            project_completion='excellent',  # 9.5
            code_quality='excellent',        # 9.5
            functionality='excellent',       # 9.5
            understanding_of_technology='pending',
            problem_solving='pending',
            innovation='pending',
            presentation_clarity='pending',
            communication='pending',
            time_management='pending',
            documentation_completeness='pending',
            documentation_quality='pending',
            qa_response='pending',
            is_pass=True
        )
        
        # 3 * 10 * 0.95 = 28.5
        self.assertEqual(evaluation.project_implementation_marks, 28.5)
    
    def test_technical_knowledge_marks(self):
        """Test technical knowledge marks calculation."""
        evaluation = ExternalEvaluation.objects.create(
            assignment=self.assignment,
            project_completion='pending',
            code_quality='pending',
            functionality='pending',
            understanding_of_technology='good',  # 7.5
            problem_solving='good',              # 7.5
            innovation='good',                   # 3.75
            presentation_clarity='pending',
            communication='pending',
            time_management='pending',
            documentation_completeness='pending',
            documentation_quality='pending',
            qa_response='pending',
            is_pass=True
        )
        
        # (10 * 0.75) + (10 * 0.75) + (5 * 0.75) = 18.75
        self.assertEqual(evaluation.technical_knowledge_marks, 18.75)
    
    def test_presentation_marks(self):
        """Test presentation marks calculation."""
        evaluation = ExternalEvaluation.objects.create(
            assignment=self.assignment,
            project_completion='pending',
            code_quality='pending',
            functionality='pending',
            understanding_of_technology='pending',
            problem_solving='pending',
            innovation='pending',
            presentation_clarity='excellent',  # 9.5
            communication='excellent',         # 4.75
            time_management='excellent',       # 4.75
            documentation_completeness='pending',
            documentation_quality='pending',
            qa_response='pending',
            is_pass=True
        )
        
        # (10 * 0.95) + (5 * 0.95) + (5 * 0.95) = 19.0
        self.assertEqual(evaluation.presentation_marks, 19.0)
    
    def test_documentation_marks(self):
        """Test documentation marks calculation."""
        evaluation = ExternalEvaluation.objects.create(
            assignment=self.assignment,
            project_completion='pending',
            code_quality='pending',
            functionality='pending',
            understanding_of_technology='pending',
            problem_solving='pending',
            innovation='pending',
            presentation_clarity='pending',
            communication='pending',
            time_management='pending',
            documentation_completeness='good',  # 6.0
            documentation_quality='good',       # 5.25
            qa_response='pending',
            is_pass=True
        )
        
        # (8 * 0.75) + (7 * 0.75) = 11.25
        self.assertEqual(evaluation.documentation_marks, 11.25)
    
    def test_qa_marks(self):
        """Test Q&A marks calculation."""
        evaluation = ExternalEvaluation.objects.create(
            assignment=self.assignment,
            project_completion='pending',
            code_quality='pending',
            functionality='pending',
            understanding_of_technology='pending',
            problem_solving='pending',
            innovation='pending',
            presentation_clarity='pending',
            communication='pending',
            time_management='pending',
            documentation_completeness='pending',
            documentation_quality='pending',
            qa_response='excellent',  # 9.5
            is_pass=True
        )
        
        # 10 * 0.95 = 9.5
        self.assertEqual(evaluation.qa_marks, 9.5)
    
    def test_failing_grade(self):
        """Test failing grade calculation."""
        evaluation = ExternalEvaluation.objects.create(
            assignment=self.assignment,
            project_completion='marginal',
            code_quality='marginal',
            functionality='marginal',
            understanding_of_technology='marginal',
            problem_solving='marginal',
            innovation='marginal',
            presentation_clarity='marginal',
            communication='marginal',
            time_management='marginal',
            documentation_completeness='marginal',
            documentation_quality='marginal',
            qa_response='marginal',
            is_pass=False
        )
        
        # All marginal = 20% of each criterion = 20
        self.assertEqual(evaluation.total_marks, 20.0)
        self.assertEqual(evaluation.grade, 'F')
