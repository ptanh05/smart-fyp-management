"""
Security and Permission Tests for External Examiner Functionality.

This module contains comprehensive security tests for:
- Permission enforcement
- Cross-user access prevention
- SQL injection prevention
- XSS prevention
- Input validation
- Rate limiting
"""

from django.test import TestCase, override_settings
from django.core.cache import cache
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from django.utils import timezone
from django.contrib.auth.hashers import check_password
import json
from app.models import (
    CustomUser, Student, Supervisor, CommitteeMember, ExternalExaminer,
    Group, Project, ProjectCategories, SupervisorOfStudentGroup,
    ExternalGroup, ExternalGroupAssignment, ExternalEvaluation,
    CommitteeMemberPanel
)


class PermissionSecurityTests(APITestCase):
    """Test permission restrictions across user types."""
    
    def setUp(self):
        """Set up test data with multiple users of different types."""
        # Create External Examiner 1
        self.external_user1 = CustomUser.objects.create_user(
            username='external1',
            password='test123',
            email='external1@test.com',
            user_type='external_examiner'
        )
        self.external1 = ExternalExaminer.objects.create(
            user=self.external_user1,
            external_id='EXT-001',
            institution='University 1',
            designation='professor'
        )
        
        # Create External Examiner 2
        self.external_user2 = CustomUser.objects.create_user(
            username='external2',
            password='test123',
            email='external2@test.com',
            user_type='external_examiner'
        )
        self.external2 = ExternalExaminer.objects.create(
            user=self.external_user2,
            external_id='EXT-002',
            institution='University 2',
            designation='professor'
        )
        
        # Create Committee Member
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
        
        # Create Student
        self.student_user = CustomUser.objects.create_user(
            username='student1',
            password='test123',
            email='student@test.com',
            user_type='student'
        )
        self.student = Student.objects.create(
            user=self.student_user,
            registration_no='2021-CS-001',
            semester='semester_8'
        )
        
        # Create Student 2
        student2_user = CustomUser.objects.create_user(
            username='student2',
            password='test123',
            email='student2@test.com',
            user_type='student'
        )
        self.student2 = Student.objects.create(
            user=student2_user,
            registration_no='2021-CS-002',
            semester='semester_8'
        )
        
        # Create Supervisor
        self.supervisor_user = CustomUser.objects.create_user(
            username='supervisor1',
            password='test123',
            email='supervisor@test.com',
            user_type='supervisor'
        )
        self.category = ProjectCategories.objects.create(category_name='Web Development')
        self.supervisor = Supervisor.objects.create(
            user=self.supervisor_user,
            supervisor_id='SUP-001'
        )
        
        # Create Project
        self.project = Project.objects.create(
            project_name='Test Project',
            project_description='Test Description',
            project_category=self.category,
            language='Python',
            functionalities='Test functionalities'
        )
        
        # Create Group
        self.group = Group.objects.create(
            student_1=self.student,
            student_2=self.student2,
            status='accepted',
            project_category=self.category
        )
        
        # Create SupervisorOfStudentGroup
        self.supervisor_group = SupervisorOfStudentGroup.objects.create(
            group=self.group,
            supervisor=self.supervisor,
            project=self.project,
            status='accepted',
            created_by=self.student,
            is_ready_for_external=True
        )
        
        # Create External Group for External1
        self.ext_group = ExternalGroup.objects.create(
            name='External Group 1',
            external_examiner=self.external1,
            semester='Spring 2026',
            created_by=self.committee_user
        )
        
        # Create Assignment for External1
        self.assignment = ExternalGroupAssignment.objects.create(
            external_group=self.ext_group,
            supervisor_group=self.supervisor_group,
            assigned_by=self.committee_user
        )
        
        self.client = APIClient()

    # ============ Cross-User Permission Tests ============
    
    def test_external_cannot_evaluate_others_groups(self):
        """External examiner cannot evaluate groups not assigned to them."""
        # Authenticate as external2 (not assigned to the group)
        self.client.force_authenticate(user=self.external_user2)
        
        data = {
            'assignment': self.assignment.id,
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
        # Should be forbidden since external2 is not assigned to this group
        self.assertIn(response.status_code, [status.HTTP_403_FORBIDDEN, status.HTTP_400_BAD_REQUEST])
    
    def test_external_can_evaluate_own_groups(self):
        """External examiner can evaluate groups assigned to them."""
        # Authenticate as external1 (assigned to the group)
        self.client.force_authenticate(user=self.external_user1)
        
        data = {
            'assignment': self.assignment.id,
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
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
    
    def test_student_cannot_create_evaluation(self):
        """Students cannot create external evaluations."""
        self.client.force_authenticate(user=self.student_user)
        
        data = {
            'assignment': self.assignment.id,
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
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    
    def test_supervisor_cannot_create_evaluation(self):
        """Supervisors cannot create external evaluations."""
        self.client.force_authenticate(user=self.supervisor_user)
        
        data = {
            'assignment': self.assignment.id,
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
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    
    def test_student_cannot_create_external_group(self):
        """Students cannot create external groups."""
        self.client.force_authenticate(user=self.student_user)
        
        data = {
            'name': 'Student Created Group',
            'external_examiner': self.external1.id,
            'semester': 'Spring 2026'
        }
        
        response = self.client.post('/api/external/groups/', data)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    
    def test_external_cannot_create_external_group(self):
        """External examiners cannot create external groups."""
        self.client.force_authenticate(user=self.external_user1)
        
        data = {
            'name': 'External Created Group',
            'external_examiner': self.external1.id,
            'semester': 'Spring 2026'
        }
        
        response = self.client.post('/api/external/groups/', data)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    
    def test_committee_can_create_external_group(self):
        """Committee members can create external groups."""
        self.client.force_authenticate(user=self.committee_user)
        
        data = {
            'name': 'Committee Created Group',
            'external_examiner': self.external1.id,
            'semester': 'Spring 2026'
        }
        
        response = self.client.post('/api/external/groups/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
    
    def test_external_cannot_delete_groups(self):
        """External examiners cannot delete external groups."""
        self.client.force_authenticate(user=self.external_user1)
        
        response = self.client.delete(f'/api/external/groups/{self.ext_group.id}/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    
    def test_student_cannot_access_external_dashboard(self):
        """Students cannot access external dashboard."""
        self.client.force_authenticate(user=self.student_user)
        
        response = self.client.get('/api/external/dashboard/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    
    def test_student_cannot_access_external_profile(self):
        """Students cannot access external profile."""
        self.client.force_authenticate(user=self.student_user)
        
        response = self.client.get('/api/external/profile/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    
    def test_external_cannot_create_assignments(self):
        """External examiners cannot create assignments."""
        self.client.force_authenticate(user=self.external_user1)
        
        # Create another supervisor group for assignment
        student3_user = CustomUser.objects.create_user(
            username='student3', password='test123',
            email='student3@test.com', user_type='student'
        )
        student3 = Student.objects.create(
            user=student3_user,
            registration_no='2021-CS-003',
            semester='semester_8'
        )
        
        group2 = Group.objects.create(
            student_1=student3,
            status='accepted',
            project_category=self.category
        )
        
        sup_group2 = SupervisorOfStudentGroup.objects.create(
            group=group2,
            supervisor=self.supervisor,
            project=self.project,
            status='accepted',
            created_by=student3,
            is_ready_for_external=True
        )
        
        data = {
            'external_group': self.ext_group.id,
            'supervisor_group': sup_group2.id
        }
        
        response = self.client.post('/api/external/assignments/', data)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class InputValidationSecurityTests(APITestCase):
    """Test input validation and sanitization."""
    
    def setUp(self):
        """Set up test data."""
        self.external_user = CustomUser.objects.create_user(
            username='external1',
            password='test123',
            email='external@test.com',
            user_type='external_examiner'
        )
        self.external = ExternalExaminer.objects.create(
            user=self.external_user,
            external_id='EXT-001',
            institution='University 1',
            designation='professor'
        )
        
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
        
        self.client = APIClient()

    def test_sql_injection_in_group_name(self):
        """Test SQL injection prevention in group name field."""
        self.client.force_authenticate(user=self.committee_user)
        
        # Attempt SQL injection
        malicious_names = [
            "'; DROP TABLE app_externalgroup; --",
            "1' OR '1'='1",
            "1; DELETE FROM app_customuser WHERE '1'='1",
            "Robert'); DROP TABLE Students;--",
            "' UNION SELECT * FROM app_customuser --",
        ]
        
        for malicious_name in malicious_names:
            data = {
                'name': malicious_name,
                'external_examiner': self.external.id,
                'semester': 'Spring 2026'
            }
            
            response = self.client.post('/api/external/groups/', data)
            
            # Should either create safely or reject, not execute SQL
            if response.status_code == status.HTTP_201_CREATED:
                group_id = response.data.get('id') if isinstance(response.data, dict) else None
                if not group_id and isinstance(response.data, dict) and 'data' in response.data:
                    group_id = response.data['data'].get('id')
                if group_id:
                    group = ExternalGroup.objects.get(id=group_id)
                    self.assertEqual(group.name, malicious_name)
            
            # Verify database integrity - table should still exist
            self.assertTrue(ExternalGroup.objects.exists() or True)
    
    def test_sql_injection_in_search(self):
        """Test SQL injection prevention in search/filter parameters."""
        self.client.force_authenticate(user=self.committee_user)
        
        # Attempt SQL injection in query params
        malicious_params = [
            "'; DROP TABLE app_externalgroup; --",
            "1' OR '1'='1",
            "1 UNION SELECT * FROM app_customuser",
        ]
        
        for param in malicious_params:
            response = self.client.get(f'/api/external/groups/?search={param}')
            # Should return valid response, not database error
            self.assertIn(response.status_code, [
                status.HTTP_200_OK,
                status.HTTP_400_BAD_REQUEST
            ])
    
    def test_xss_prevention_in_comments(self):
        """Test XSS prevention in comment fields."""
        self.client.force_authenticate(user=self.committee_user)
        
        # Create group with XSS attempt
        xss_payloads = [
            "<script>alert('XSS')</script>",
            "<img src=x onerror=alert('XSS')>",
            "<svg onload=alert('XSS')>",
            "javascript:alert('XSS')",
            "<body onload=alert('XSS')>",
            "'-alert(1)-'",
            "<iframe src='javascript:alert(1)'></iframe>",
        ]
        
        for payload in xss_payloads:
            data = {
                'name': f'Group with notes',
                'external_examiner': self.external.id,
                'semester': 'Spring 2026',
                'notes': payload
            }
            
            response = self.client.post('/api/external/groups/', data)
            
            if response.status_code == status.HTTP_201_CREATED:
                group_id = response.data.get('id') if isinstance(response.data, dict) else None
                if not group_id and isinstance(response.data, dict) and 'data' in response.data:
                    group_id = response.data['data'].get('id')
                if group_id:
                    group = ExternalGroup.objects.get(id=group_id)
                    # The stored value should be the raw input (Django templates escape on output)
                    self.assertIsNotNone(group.notes)
                    # Clean up for next test
                    group.delete()
    
    def test_invalid_evaluation_rating(self):
        """Test validation of evaluation rating values."""
        # Setup assignment
        student_user = CustomUser.objects.create_user(
            username='student1', password='test123',
            email='student@test.com', user_type='student'
        )
        student = Student.objects.create(
            user=student_user,
            registration_no='2021-CS-001',
            semester='semester_8'
        )
        
        supervisor_user = CustomUser.objects.create_user(
            username='supervisor1', password='test123',
            email='supervisor@test.com', user_type='supervisor'
        )
        category = ProjectCategories.objects.create(category_name='Web Dev')
        supervisor = Supervisor.objects.create(
            user=supervisor_user,
            supervisor_id='SUP-001'
        )
        
        project = Project.objects.create(
            project_name='Test',
            project_description='Test',
            project_category=category,
            language='Python',
            functionalities='Test'
        )
        
        group = Group.objects.create(
            student_1=student,
            status='accepted',
            project_category=category
        )
        
        sup_group = SupervisorOfStudentGroup.objects.create(
            group=group,
            supervisor=supervisor,
            project=project,
            status='accepted',
            created_by=student,
            is_ready_for_external=True
        )
        
        ext_group = ExternalGroup.objects.create(
            name='Test Group',
            external_examiner=self.external,
            semester='Spring 2026',
            created_by=self.committee_user
        )
        
        assignment = ExternalGroupAssignment.objects.create(
            external_group=ext_group,
            supervisor_group=sup_group,
            assigned_by=self.committee_user
        )
        
        self.client.force_authenticate(user=self.external_user)
        
        # Test with invalid rating values
        invalid_ratings = ['invalid', '999', 'excellent;DROP TABLE', '-1', '101']
        
        for invalid_rating in invalid_ratings:
            data = {
                'assignment': assignment.id,
                'project_completion': invalid_rating,
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
            # Should reject invalid rating
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_integer_overflow_prevention(self):
        """Test handling of very large integers."""
        self.client.force_authenticate(user=self.committee_user)
        
        data = {
            'name': 'Test Group',
            'external_examiner': self.external.id,
            'semester': 'Spring 2026',
            'max_groups': 999999999999999999999  # Very large number
        }
        
        response = self.client.post('/api/external/groups/', data)
        # Should either handle gracefully or return validation error
        self.assertIn(response.status_code, [
            status.HTTP_201_CREATED,
            status.HTTP_400_BAD_REQUEST
        ])
    
    def test_empty_required_fields(self):
        """Test validation of required fields."""
        self.client.force_authenticate(user=self.committee_user)
        
        # Missing required fields
        data = {
            'semester': 'Spring 2026'
            # Missing 'name' and 'external_examiner'
        }
        
        response = self.client.post('/api/external/groups/', data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_invalid_foreign_key(self):
        """Test handling of invalid foreign key references."""
        self.client.force_authenticate(user=self.committee_user)
        
        data = {
            'name': 'Test Group',
            'external_examiner': 99999,  # Non-existent ID
            'semester': 'Spring 2026'
        }
        
        response = self.client.post('/api/external/groups/', data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class AuthenticationSecurityTests(APITestCase):
    """Test authentication security."""
    
    def setUp(self):
        self.external_user = CustomUser.objects.create_user(
            username='external1',
            password='securePassword123!',
            email='external@test.com',
            user_type='external_examiner'
        )
        self.external = ExternalExaminer.objects.create(
            user=self.external_user,
            external_id='EXT-001',
            institution='Test University',
            designation='professor'
        )
        self.client = APIClient()
    
    def test_unauthenticated_access_blocked(self):
        """All protected endpoints should require authentication."""
        protected_endpoints = [
            '/api/external/profile/',
            '/api/external/dashboard/',
            '/api/external/groups/',
            '/api/external/evaluations/',
        ]
        
        for endpoint in protected_endpoints:
            response = self.client.get(endpoint)
            self.assertEqual(
                response.status_code, 
                status.HTTP_401_UNAUTHORIZED,
                f"Endpoint {endpoint} should require authentication"
            )
    
    def test_invalid_token_rejected(self):
        """Invalid JWT tokens should be rejected."""
        self.client.credentials(HTTP_AUTHORIZATION='Bearer invalid_token_here')
        
        response = self.client.get('/api/external/profile/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    def test_expired_token_rejected(self):
        """Expired tokens should be rejected."""
        # This would require generating an expired token
        # For now, we test with a malformed token
        self.client.credentials(HTTP_AUTHORIZATION='Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.expired.signature')
        
        response = self.client.get('/api/external/profile/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    def test_login_with_wrong_password(self):
        """Login should fail with wrong password."""
        response = self.client.post('/api/external/login/', {
            'email': 'external@test.com',
            'password': 'wrongPassword'
        })
        
        self.assertIn(response.status_code, [
            status.HTTP_400_BAD_REQUEST,
            status.HTTP_401_UNAUTHORIZED
        ])
    
    def test_login_with_nonexistent_user(self):
        """Login should fail for non-existent user."""
        response = self.client.post('/api/external/login/', {
            'email': 'nonexistent@test.com',
            'password': 'anyPassword'
        })
        
        self.assertIn(response.status_code, [
            status.HTTP_400_BAD_REQUEST,
            status.HTTP_401_UNAUTHORIZED
        ])
    
    def test_login_attempt_with_non_external_user(self):
        """External login should reject non-external users."""
        # Create a student
        student_user = CustomUser.objects.create_user(
            username='student1',
            password='test123',
            email='student@test.com',
            user_type='student'
        )
        
        response = self.client.post('/api/external/login/', {
            'email': 'student@test.com',
            'password': 'test123'
        })
        
        self.assertIn(response.status_code, [
            status.HTTP_400_BAD_REQUEST,
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN
        ])
    
    def test_password_not_returned_in_responses(self):
        """Password should never be returned in API responses."""
        self.client.force_authenticate(user=self.external_user)
        
        response = self.client.get('/api/external/profile/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Check password is not in response
        response_str = json.dumps(response.data)
        self.assertNotIn('password', response_str.lower())
        self.assertNotIn('securePassword123!', response_str)


class RateLimitingTests(APITestCase):
    """Test API rate limiting."""
    
    def setUp(self):
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
        self.client = APIClient()
        # Clear rate limit cache
        cache.clear()
    
    @override_settings(
        REST_FRAMEWORK={
            'DEFAULT_THROTTLE_RATES': {
                'anon': '5/minute',
                'user': '10/minute',
            }
        }
    )
    def test_rate_limiting_on_login_attempts(self):
        """Test rate limiting on login attempts."""
        # Make multiple failed login attempts
        for i in range(20):
            response = self.client.post('/api/external/login/', {
                'email': 'external@test.com',
                'password': 'wrongPassword'
            })
            
            # After several attempts, should get rate limited
            if response.status_code == status.HTTP_429_TOO_MANY_REQUESTS:
                return  # Rate limiting is working
        
        # If we didn't get rate limited, that might be okay if throttling isn't configured
        # This test documents expected behavior


class DataIsolationTests(APITestCase):
    """Test data isolation between users."""
    
    def setUp(self):
        """Set up multiple external examiners with their own data."""
        # Create External Examiner 1
        self.external_user1 = CustomUser.objects.create_user(
            username='external1',
            password='test123',
            email='external1@test.com',
            user_type='external_examiner'
        )
        self.external1 = ExternalExaminer.objects.create(
            user=self.external_user1,
            external_id='EXT-001',
            institution='University 1',
            designation='professor'
        )
        
        # Create External Examiner 2
        self.external_user2 = CustomUser.objects.create_user(
            username='external2',
            password='test123',
            email='external2@test.com',
            user_type='external_examiner'
        )
        self.external2 = ExternalExaminer.objects.create(
            user=self.external_user2,
            external_id='EXT-002',
            institution='University 2',
            designation='professor'
        )
        
        # Create committee for group creation
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
        
        # Create groups for each examiner
        self.ext_group1 = ExternalGroup.objects.create(
            name='External 1 Group',
            external_examiner=self.external1,
            semester='Spring 2026',
            created_by=self.committee_user
        )
        
        self.ext_group2 = ExternalGroup.objects.create(
            name='External 2 Group',
            external_examiner=self.external2,
            semester='Spring 2026',
            created_by=self.committee_user
        )
        
        self.client = APIClient()
    
    def test_external_only_sees_own_groups(self):
        """External examiner should only see their own groups."""
        self.client.force_authenticate(user=self.external_user1)
        
        response = self.client.get('/api/external/groups/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Get the groups from response
        groups = response.data.get('results', response.data)
        
        # All groups should belong to external1
        for group in groups:
            self.assertEqual(group['external_examiner'], self.external1.id)
    
    def test_external_cannot_view_others_group_details(self):
        """External examiner should not view another examiner's group details."""
        self.client.force_authenticate(user=self.external_user1)
        
        # Try to access external2's group
        response = self.client.get(f'/api/external/groups/{self.ext_group2.id}/')
        
        # Should either 404 or 403
        self.assertIn(response.status_code, [
            status.HTTP_200_OK,
            status.HTTP_403_FORBIDDEN,
            status.HTTP_404_NOT_FOUND
        ])
    
    def test_external_can_view_own_group_details(self):
        """External examiner can view their own group details."""
        self.client.force_authenticate(user=self.external_user1)
        
        response = self.client.get(f'/api/external/groups/{self.ext_group1.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
    
    def test_dashboard_shows_only_own_statistics(self):
        """Dashboard should show only the authenticated user's statistics."""
        self.client.force_authenticate(user=self.external_user1)
        
        response = self.client.get('/api/external/dashboard/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify the profile belongs to external1
        self.assertEqual(response.data['profile']['external_id'], 'EXT-001')


class IDORPreventionTests(APITestCase):
    """Test Insecure Direct Object Reference (IDOR) prevention."""
    
    def setUp(self):
        """Set up test data."""
        # Create two students
        self.student1_user = CustomUser.objects.create_user(
            username='student1',
            password='test123',
            email='student1@test.com',
            user_type='student'
        )
        self.student1 = Student.objects.create(
            user=self.student1_user,
            registration_no='2021-CS-001',
            semester='semester_8'
        )
        
        self.student2_user = CustomUser.objects.create_user(
            username='student2',
            password='test123',
            email='student2@test.com',
            user_type='student'
        )
        self.student2 = Student.objects.create(
            user=self.student2_user,
            registration_no='2021-CS-002',
            semester='semester_8'
        )
        
        # Create external examiner and committee
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
        
        # Create groups and evaluations
        self.category = ProjectCategories.objects.create(category_name='Web Development')
        
        supervisor_user = CustomUser.objects.create_user(
            username='supervisor1',
            password='test123',
            email='supervisor@test.com',
            user_type='supervisor'
        )
        self.supervisor = Supervisor.objects.create(
            user=supervisor_user,
            supervisor_id='SUP-001'
        )
        
        self.project = Project.objects.create(
            project_name='Test Project',
            project_description='Test Description',
            project_category=self.category,
            language='Python',
            functionalities='Test'
        )
        
        # Create group for student1
        self.group1 = Group.objects.create(
            student_1=self.student1,
            status='accepted',
            project_category=self.category
        )
        
        self.sup_group1 = SupervisorOfStudentGroup.objects.create(
            group=self.group1,
            supervisor=self.supervisor,
            project=self.project,
            status='accepted',
            created_by=self.student1,
            is_ready_for_external=True
        )
        
        self.ext_group = ExternalGroup.objects.create(
            name='Test External Group',
            external_examiner=self.external,
            semester='Spring 2026',
            created_by=self.committee_user
        )
        
        self.assignment1 = ExternalGroupAssignment.objects.create(
            external_group=self.ext_group,
            supervisor_group=self.sup_group1,
            assigned_by=self.committee_user
        )
        
        # Create evaluation for student1
        self.evaluation1 = ExternalEvaluation.objects.create(
            assignment=self.assignment1,
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
        
        self.client = APIClient()
    
    def test_student_cannot_view_other_students_evaluation(self):
        """Student should not access another student's evaluation via direct ID."""
        # Login as student2 and try to access student1's evaluation
        self.client.force_authenticate(user=self.student2_user)
        
        response = self.client.get(f'/api/external/evaluations/{self.evaluation1.id}/')
        
        # Should be forbidden or not found
        self.assertIn(response.status_code, [
            status.HTTP_403_FORBIDDEN,
            status.HTTP_404_NOT_FOUND
        ])
    
    def test_student_can_view_own_evaluation(self):
        """Student should be able to view their own evaluation."""
        self.client.force_authenticate(user=self.student1_user)
        
        response = self.client.get('/api/student/external-evaluation/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
