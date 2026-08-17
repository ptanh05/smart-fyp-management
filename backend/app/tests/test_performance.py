"""
Performance Tests for External Evaluation System.

This module tests:
- API response times
- Database query performance
- Memory usage
- Concurrent request handling
"""

import time
import gc
from concurrent.futures import ThreadPoolExecutor, as_completed
from django.test import TestCase, TransactionTestCase
from django.test.client import Client
from django.db import connection, reset_queries
from django.conf import settings
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from django.contrib.auth.hashers import make_password
import threading

from app.models import (
    CustomUser, Student, Supervisor, CommitteeMember, ExternalExaminer,
    Group, Project, ProjectCategories, SupervisorOfStudentGroup,
    ExternalGroup, ExternalGroupAssignment, ExternalEvaluation,
    CommitteeMemberPanel
)


class APIResponseTimeTests(APITestCase):
    """Test API endpoint response times."""
    
    # Performance thresholds (in seconds)
    FAST_THRESHOLD = 0.1      # < 100ms
    ACCEPTABLE_THRESHOLD = 0.5  # < 500ms
    MAX_THRESHOLD = 1.0        # < 1s (absolute max)
    
    @classmethod
    def setUpTestData(cls):
        """Set up test data once for all tests."""
        # Create external examiner
        cls.external_user = CustomUser.objects.create_user(
            username='perf_external',
            password='test123',
            email='perf_external@test.com',
            user_type='external_examiner'
        )
        cls.external = ExternalExaminer.objects.create(
            user=cls.external_user,
            external_id='PERF-EXT-001',
            institution='Performance Test University',
            designation='professor'
        )
        
        # Create committee member
        cls.committee_user = CustomUser.objects.create_user(
            username='perf_committee',
            password='test123',
            email='perf_committee@test.com',
            user_type='committee_member'
        )
        panel = CommitteeMemberPanel.objects.create(name='Performance Panel')
        cls.committee = CommitteeMember.objects.create(
            user=cls.committee_user,
            committee_id='PERF-COM-001',
            panel=panel
        )
        
        # Create student
        cls.student_user = CustomUser.objects.create_user(
            username='perf_student',
            password='test123',
            email='perf_student@test.com',
            user_type='student'
        )
        cls.student = Student.objects.create(
            user=cls.student_user,
            registration_no='PERF-2021-CS-001',
            semester='semester_8'
        )
        
        # Create test data
        cls.category = ProjectCategories.objects.create(category_name='Performance Testing')
        
        supervisor_user = CustomUser.objects.create_user(
            username='perf_supervisor',
            password='test123',
            email='perf_supervisor@test.com',
            user_type='supervisor'
        )
        cls.supervisor = Supervisor.objects.create(
            user=supervisor_user,
            supervisor_id='PERF-SUP-001'
        )
        
        cls.project = Project.objects.create(
            project_name='Performance Test Project',
            project_description='Test project for performance testing',
            project_category=cls.category,
            language='Python',
            functionalities='Performance testing functionalities'
        )
        
        cls.group = Group.objects.create(
            student_1=cls.student,
            status='accepted',
            project_category=cls.category
        )
        
        cls.sup_group = SupervisorOfStudentGroup.objects.create(
            group=cls.group,
            supervisor=cls.supervisor,
            project=cls.project,
            status='accepted',
            created_by=cls.student,
            is_ready_for_external=True
        )
        
        cls.ext_group = ExternalGroup.objects.create(
            name='Performance External Group',
            external_examiner=cls.external,
            semester='Spring 2026',
            created_by=cls.committee_user
        )
        
        cls.assignment = ExternalGroupAssignment.objects.create(
            external_group=cls.ext_group,
            supervisor_group=cls.sup_group,
            assigned_by=cls.committee_user
        )
    
    def measure_response_time(self, method, url, **kwargs):
        """Measure API response time."""
        start_time = time.perf_counter()
        response = method(url, **kwargs)
        end_time = time.perf_counter()
        
        elapsed = end_time - start_time
        return response, elapsed
    
    def test_external_dashboard_response_time(self):
        """Dashboard should respond within acceptable time."""
        self.client.force_authenticate(user=self.external_user)
        
        response, elapsed = self.measure_response_time(
            self.client.get, '/api/external/dashboard/'
        )
        
        print(f"\nExternal Dashboard: {elapsed*1000:.2f}ms")
        self.assertLess(elapsed, self.ACCEPTABLE_THRESHOLD,
            f"Dashboard took {elapsed*1000:.2f}ms, expected < {self.ACCEPTABLE_THRESHOLD*1000}ms")
    
    def test_external_profile_response_time(self):
        """Profile endpoint should be fast."""
        self.client.force_authenticate(user=self.external_user)
        
        response, elapsed = self.measure_response_time(
            self.client.get, '/api/external/profile/'
        )
        
        print(f"\nExternal Profile: {elapsed*1000:.2f}ms")
        self.assertLess(elapsed, self.FAST_THRESHOLD,
            f"Profile took {elapsed*1000:.2f}ms, expected < {self.FAST_THRESHOLD*1000}ms")
    
    def test_external_groups_list_response_time(self):
        """Groups list should respond within acceptable time."""
        self.client.force_authenticate(user=self.external_user)
        
        response, elapsed = self.measure_response_time(
            self.client.get, '/api/external/groups/'
        )
        
        print(f"\nExternal Groups List: {elapsed*1000:.2f}ms")
        self.assertLess(elapsed, self.ACCEPTABLE_THRESHOLD,
            f"Groups list took {elapsed*1000:.2f}ms, expected < {self.ACCEPTABLE_THRESHOLD*1000}ms")
    
    def test_external_evaluations_list_response_time(self):
        """Evaluations list should respond within acceptable time."""
        self.client.force_authenticate(user=self.external_user)
        
        response, elapsed = self.measure_response_time(
            self.client.get, '/api/external/evaluations/'
        )
        
        print(f"\nExternal Evaluations List: {elapsed*1000:.2f}ms")
        self.assertLess(elapsed, self.ACCEPTABLE_THRESHOLD,
            f"Evaluations list took {elapsed*1000:.2f}ms")
    
    def test_evaluation_create_response_time(self):
        """Evaluation creation should complete within acceptable time."""
        self.client.force_authenticate(user=self.external_user)
        
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
            'is_pass': True,
            'comments': 'Performance test evaluation'
        }
        
        response, elapsed = self.measure_response_time(
            self.client.post, '/api/external/evaluations/create/',
            data=data, format='json'
        )
        
        print(f"\nEvaluation Create: {elapsed*1000:.2f}ms")
        self.assertLess(elapsed, self.ACCEPTABLE_THRESHOLD,
            f"Evaluation creation took {elapsed*1000:.2f}ms")
    
    def test_multiple_sequential_requests(self):
        """Test performance under sequential requests."""
        self.client.force_authenticate(user=self.external_user)
        
        endpoints = [
            '/api/external/dashboard/',
            '/api/external/profile/',
            '/api/external/groups/',
            '/api/external/evaluations/',
        ]
        
        total_time = 0
        results = []
        
        for endpoint in endpoints:
            response, elapsed = self.measure_response_time(
                self.client.get, endpoint
            )
            total_time += elapsed
            results.append((endpoint, elapsed))
        
        print(f"\n{'Endpoint':<40} {'Time (ms)':<15}")
        print("-" * 55)
        for endpoint, elapsed in results:
            print(f"{endpoint:<40} {elapsed*1000:>10.2f}ms")
        print("-" * 55)
        print(f"{'Total':<40} {total_time*1000:>10.2f}ms")
        
        avg_time = total_time / len(endpoints)
        self.assertLess(avg_time, self.ACCEPTABLE_THRESHOLD,
            f"Average response time {avg_time*1000:.2f}ms exceeds threshold")


class DatabaseQueryPerformanceTests(TransactionTestCase):
    """Test database query performance and optimization."""
    
    MAX_QUERIES = 10  # Maximum acceptable queries for a single request
    QUERY_TIME_THRESHOLD = 0.1  # 100ms per query
    
    def setUp(self):
        """Set up test data."""
        # Enable query logging
        settings.DEBUG = True
        
        # Create test users and data
        self.external_user = CustomUser.objects.create_user(
            username='query_perf_external',
            password='test123',
            email='query_perf@test.com',
            user_type='external_examiner'
        )
        self.external = ExternalExaminer.objects.create(
            user=self.external_user,
            external_id='QUERY-EXT-001',
            institution='Query Test University',
            designation='professor'
        )
        
        self.committee_user = CustomUser.objects.create_user(
            username='query_perf_committee',
            password='test123',
            email='query_committee@test.com',
            user_type='committee_member'
        )
        panel = CommitteeMemberPanel.objects.create(name='Query Panel')
        CommitteeMember.objects.create(
            user=self.committee_user,
            committee_id='QUERY-COM-001',
            panel=panel
        )
        
        # Create multiple groups for N+1 query testing
        self.category = ProjectCategories.objects.create(category_name='Query Testing')
        
        supervisor_user = CustomUser.objects.create_user(
            username='query_supervisor',
            password='test123',
            email='query_sup@test.com',
            user_type='supervisor'
        )
        self.supervisor = Supervisor.objects.create(
            user=supervisor_user,
            supervisor_id='QUERY-SUP-001'
        )
        
        # Create multiple external groups to test N+1 queries
        for i in range(10):
            student_user = CustomUser.objects.create_user(
                username=f'query_student_{i}',
                password='test123',
                email=f'query_student_{i}@test.com',
                user_type='student'
            )
            student = Student.objects.create(
                user=student_user,
                registration_no=f'QUERY-2021-CS-{i:03d}',
                semester='semester_8'
            )
            
            project = Project.objects.create(
                project_name=f'Query Test Project {i}',
                project_description=f'Test project {i}',
                project_category=self.category,
                language='Python',
                functionalities=f'Functionalities {i}'
            )
            
            group = Group.objects.create(
                student_1=student,
                status='accepted',
                project_category=self.category
            )
            
            sup_group = SupervisorOfStudentGroup.objects.create(
                group=group,
                supervisor=self.supervisor,
                project=project,
                status='accepted',
                created_by=student,
                is_ready_for_external=True
            )
            
            ext_group = ExternalGroup.objects.create(
                name=f'Query External Group {i}',
                external_examiner=self.external,
                semester='Spring 2026',
                created_by=self.committee_user
            )
            
            ExternalGroupAssignment.objects.create(
                external_group=ext_group,
                supervisor_group=sup_group,
                assigned_by=self.committee_user
            )
        
        self.client = APIClient()
    
    def tearDown(self):
        settings.DEBUG = False
    
    def count_queries(self, callable_func):
        """Count database queries for a callable."""
        reset_queries()
        result = callable_func()
        query_count = len(connection.queries)
        queries = connection.queries.copy()
        reset_queries()
        return result, query_count, queries
    
    def test_dashboard_query_count(self):
        """Dashboard should not have N+1 query problem."""
        self.client.force_authenticate(user=self.external_user)
        
        def make_request():
            return self.client.get('/api/external/dashboard/')
        
        response, query_count, queries = self.count_queries(make_request)
        
        print(f"\nDashboard Queries: {query_count}")
        if query_count > self.MAX_QUERIES:
            print("Queries executed:")
            for i, q in enumerate(queries[:20]):  # Show first 20
                print(f"  {i+1}. {q['sql'][:100]}...")
        
        self.assertLessEqual(query_count, self.MAX_QUERIES,
            f"Dashboard made {query_count} queries, expected <= {self.MAX_QUERIES}")
    
    def test_groups_list_query_count(self):
        """Groups list should use select_related/prefetch_related."""
        self.client.force_authenticate(user=self.external_user)
        
        def make_request():
            return self.client.get('/api/external/groups/')
        
        response, query_count, queries = self.count_queries(make_request)
        
        print(f"\nGroups List Queries: {query_count}")
        
        # With 10 groups, we shouldn't have N+1 queries
        # Expecting: 1 auth + 1 groups + maybe 2-3 related = ~5 max
        self.assertLessEqual(query_count, self.MAX_QUERIES,
            f"Groups list made {query_count} queries, expected <= {self.MAX_QUERIES}")
    
    def test_evaluations_list_query_count(self):
        """Evaluations list should be optimized."""
        self.client.force_authenticate(user=self.external_user)
        
        def make_request():
            return self.client.get('/api/external/evaluations/')
        
        response, query_count, queries = self.count_queries(make_request)
        
        print(f"\nEvaluations List Queries: {query_count}")
        self.assertLessEqual(query_count, self.MAX_QUERIES,
            f"Evaluations list made {query_count} queries")
    
    def test_bulk_assignment_query_efficiency(self):
        """Bulk operations should be efficient."""
        self.client.force_authenticate(user=self.committee_user)
        
        def make_request():
            return self.client.get('/api/external/assignments/')
        
        response, query_count, queries = self.count_queries(make_request)
        
        print(f"\nAssignments List Queries: {query_count}")
        self.assertLessEqual(query_count, self.MAX_QUERIES,
            f"Assignments list made {query_count} queries")


class ConcurrentRequestTests(TransactionTestCase):
    """Test performance under concurrent load."""
    
    CONCURRENT_USERS = 10
    REQUESTS_PER_USER = 5
    MAX_AVG_RESPONSE_TIME = 1.0  # 1 second
    
    def setUp(self):
        """Set up test data."""
        self.users = []
        
        # Create multiple external examiners
        for i in range(self.CONCURRENT_USERS):
            user = CustomUser.objects.create_user(
                username=f'concurrent_external_{i}',
                password='test123',
                email=f'concurrent_{i}@test.com',
                user_type='external_examiner'
            )
            ExternalExaminer.objects.create(
                user=user,
                external_id=f'CONC-EXT-{i:03d}',
                institution=f'Concurrent University {i}',
                designation='professor'
            )
            self.users.append(user)
        
        self.committee_user = CustomUser.objects.create_user(
            username='concurrent_committee',
            password='test123',
            email='concurrent_committee@test.com',
            user_type='committee_member'
        )
    
    def make_authenticated_request(self, user):
        """Make a single authenticated request."""
        client = APIClient()
        client.force_authenticate(user=user)
        
        start_time = time.perf_counter()
        response = client.get('/api/external/dashboard/')
        end_time = time.perf_counter()
        
        return {
            'user': user.username,
            'status': response.status_code,
            'time': end_time - start_time
        }
    
    def test_concurrent_dashboard_access(self):
        """Test multiple concurrent dashboard requests."""
        results = []
        errors = []
        
        with ThreadPoolExecutor(max_workers=self.CONCURRENT_USERS) as executor:
            futures = []
            
            for _ in range(self.REQUESTS_PER_USER):
                for user in self.users:
                    future = executor.submit(self.make_authenticated_request, user)
                    futures.append(future)
            
            for future in as_completed(futures):
                try:
                    result = future.result()
                    results.append(result)
                except Exception as e:
                    errors.append(str(e))
        
        # Analyze results
        total_requests = len(results)
        successful = sum(1 for r in results if r['status'] == 200)
        failed = total_requests - successful
        avg_time = sum(r['time'] for r in results) / total_requests if results else 0
        max_time = max(r['time'] for r in results) if results else 0
        min_time = min(r['time'] for r in results) if results else 0
        
        print(f"\n{'='*50}")
        print("CONCURRENT ACCESS TEST RESULTS")
        print(f"{'='*50}")
        print(f"Total Requests:     {total_requests}")
        print(f"Successful:         {successful}")
        print(f"Failed:             {failed}")
        print(f"Errors:             {len(errors)}")
        print(f"Avg Response Time:  {avg_time*1000:.2f}ms")
        print(f"Min Response Time:  {min_time*1000:.2f}ms")
        print(f"Max Response Time:  {max_time*1000:.2f}ms")
        print(f"{'='*50}")
        
        # Assertions
        self.assertEqual(failed, 0, f"{failed} requests failed")
        self.assertLess(avg_time, self.MAX_AVG_RESPONSE_TIME,
            f"Average response time {avg_time*1000:.2f}ms exceeds threshold")


class MemoryUsageTests(TestCase):
    """Test for memory leaks and excessive memory usage."""
    
    MAX_MEMORY_INCREASE_MB = 50  # Maximum acceptable memory increase
    
    @classmethod
    def setUpTestData(cls):
        """Set up test data."""
        cls.user = CustomUser.objects.create_user(
            username='memory_test_user',
            password='test123',
            email='memory@test.com',
            user_type='external_examiner'
        )
        ExternalExaminer.objects.create(
            user=cls.user,
            external_id='MEM-EXT-001',
            institution='Memory Test University',
            designation='professor'
        )
    
    def get_memory_usage(self):
        """Get current memory usage in MB."""
        try:
            import psutil
            process = psutil.Process()
            return process.memory_info().rss / 1024 / 1024
        except ImportError:
            # Fallback if psutil not available
            return 0
    
    def test_repeated_requests_memory_stability(self):
        """Repeated requests should not cause memory leaks."""
        client = APIClient()
        client.force_authenticate(user=self.user)
        
        # Force garbage collection
        gc.collect()
        initial_memory = self.get_memory_usage()
        
        if initial_memory == 0:
            self.skipTest("psutil not available for memory testing")
        
        # Make many requests
        for i in range(100):
            client.get('/api/external/dashboard/')
            if i % 20 == 0:
                gc.collect()
        
        gc.collect()
        final_memory = self.get_memory_usage()
        
        memory_increase = final_memory - initial_memory
        
        print(f"\nMemory Usage:")
        print(f"  Initial: {initial_memory:.2f} MB")
        print(f"  Final:   {final_memory:.2f} MB")
        print(f"  Increase: {memory_increase:.2f} MB")
        
        self.assertLess(memory_increase, self.MAX_MEMORY_INCREASE_MB,
            f"Memory increased by {memory_increase:.2f}MB, exceeds {self.MAX_MEMORY_INCREASE_MB}MB threshold")


class PaginationPerformanceTests(APITestCase):
    """Test pagination performance with large datasets."""
    
    RECORDS_TO_CREATE = 100
    PAGE_SIZE = 20
    MAX_PAGE_TIME = 0.5  # 500ms per page
    
    @classmethod
    def setUpTestData(cls):
        """Create large dataset for pagination testing."""
        cls.committee_user = CustomUser.objects.create_user(
            username='pagination_committee',
            password='test123',
            email='pagination@test.com',
            user_type='committee_member'
        )
        panel = CommitteeMemberPanel.objects.create(name='Pagination Panel')
        CommitteeMember.objects.create(
            user=cls.committee_user,
            committee_id='PAGE-COM-001',
            panel=panel
        )
        
        cls.external_user = CustomUser.objects.create_user(
            username='pagination_external',
            password='test123',
            email='pagination_ext@test.com',
            user_type='external_examiner'
        )
        cls.external = ExternalExaminer.objects.create(
            user=cls.external_user,
            external_id='PAGE-EXT-001',
            institution='Pagination University',
            designation='professor'
        )
        
        # Create many groups
        for i in range(cls.RECORDS_TO_CREATE):
            ExternalGroup.objects.create(
                name=f'Pagination Group {i:03d}',
                external_examiner=cls.external,
                semester='Spring 2026',
                created_by=cls.committee_user
            )
    
    def test_first_page_performance(self):
        """First page should load quickly."""
        self.client.force_authenticate(user=self.external_user)
        
        start = time.perf_counter()
        response = self.client.get(f'/api/external/groups/?page=1&page_size={self.PAGE_SIZE}')
        elapsed = time.perf_counter() - start
        
        print(f"\nFirst Page: {elapsed*1000:.2f}ms")
        self.assertLess(elapsed, self.MAX_PAGE_TIME)
    
    def test_middle_page_performance(self):
        """Middle pages should not degrade significantly."""
        self.client.force_authenticate(user=self.external_user)
        
        middle_page = self.RECORDS_TO_CREATE // (self.PAGE_SIZE * 2)
        
        start = time.perf_counter()
        response = self.client.get(f'/api/external/groups/?page={middle_page}&page_size={self.PAGE_SIZE}')
        elapsed = time.perf_counter() - start
        
        print(f"\nMiddle Page ({middle_page}): {elapsed*1000:.2f}ms")
        self.assertLess(elapsed, self.MAX_PAGE_TIME)
    
    def test_last_page_performance(self):
        """Last page should not be significantly slower."""
        self.client.force_authenticate(user=self.external_user)
        
        last_page = (self.RECORDS_TO_CREATE // self.PAGE_SIZE) + 1
        
        start = time.perf_counter()
        response = self.client.get(f'/api/external/groups/?page={last_page}&page_size={self.PAGE_SIZE}')
        elapsed = time.perf_counter() - start
        
        print(f"\nLast Page ({last_page}): {elapsed*1000:.2f}ms")
        self.assertLess(elapsed, self.MAX_PAGE_TIME)
