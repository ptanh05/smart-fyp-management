"""
Locust Performance Testing Configuration for External Evaluation System.

This module provides load testing scenarios for:
- External Examiner workflows
- Committee Member operations
- Student dashboard access
- API endpoint stress testing

Run with: locust -f locustfile.py --host=http://localhost:8000
"""

from locust import HttpUser, task, between, events
from locust.runners import MasterRunner
import json
import random
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ExternalExaminerUser(HttpUser):
    """
    Simulates an External Examiner user performing typical tasks:
    - Login and authentication
    - Viewing dashboard
    - Accessing assigned groups
    - Submitting evaluations
    """
    
    weight = 3  # External examiners are most active
    wait_time = between(1, 5)
    
    def on_start(self):
        """Login and obtain JWT token."""
        self.token = None
        self.external_id = None
        self.groups = []
        self.assignments = []
        
        # Attempt login
        response = self.client.post("/api/external/login/", json={
            "email": f"external{random.randint(1, 5)}@test.com",
            "password": "test123"
        })
        
        if response.status_code == 200:
            data = response.json()
            self.token = data.get("access") or data.get("token")
            logger.info(f"External examiner logged in successfully")
        else:
            logger.warning(f"External login failed: {response.status_code}")
            # Use fallback token endpoint
            response = self.client.post("/api/token/", json={
                "username": "external1",
                "password": "test123"
            })
            if response.status_code == 200:
                self.token = response.json().get("access")
    
    def get_headers(self):
        """Get authorization headers."""
        if self.token:
            return {"Authorization": f"Bearer {self.token}"}
        return {}
    
    @task(10)
    def get_dashboard(self):
        """View external examiner dashboard - high frequency."""
        with self.client.get(
            "/api/external/dashboard/",
            headers=self.get_headers(),
            name="/api/external/dashboard/",
            catch_response=True
        ) as response:
            if response.status_code == 200:
                response.success()
            elif response.status_code == 401:
                response.failure("Unauthorized - token may be expired")
            else:
                response.failure(f"Failed with status {response.status_code}")
    
    @task(8)
    def get_profile(self):
        """View profile information."""
        self.client.get(
            "/api/external/profile/",
            headers=self.get_headers(),
            name="/api/external/profile/"
        )
    
    @task(6)
    def get_groups(self):
        """List assigned groups."""
        response = self.client.get(
            "/api/external/groups/",
            headers=self.get_headers(),
            name="/api/external/groups/"
        )
        
        if response.status_code == 200:
            data = response.json()
            self.groups = data.get("results", data) if isinstance(data, dict) else data
    
    @task(5)
    def get_assignments(self):
        """List group assignments."""
        response = self.client.get(
            "/api/external/assignments/",
            headers=self.get_headers(),
            name="/api/external/assignments/"
        )
        
        if response.status_code == 200:
            data = response.json()
            self.assignments = data.get("results", data) if isinstance(data, dict) else data
    
    @task(3)
    def get_evaluations(self):
        """List existing evaluations."""
        self.client.get(
            "/api/external/evaluations/",
            headers=self.get_headers(),
            name="/api/external/evaluations/"
        )
    
    @task(2)
    def get_schedules(self):
        """View evaluation schedules."""
        self.client.get(
            "/api/external/schedules/",
            headers=self.get_headers(),
            name="/api/external/schedules/"
        )
    
    @task(1)
    def submit_evaluation(self):
        """Submit an evaluation (low frequency due to write operation)."""
        if not self.assignments:
            return
        
        assignment = random.choice(self.assignments)
        assignment_id = assignment.get("id") if isinstance(assignment, dict) else assignment
        
        evaluation_data = {
            "assignment": assignment_id,
            "project_completion": random.choice(["adequate", "good", "excellent"]),
            "code_quality": random.choice(["adequate", "good", "excellent"]),
            "functionality": random.choice(["adequate", "good", "excellent"]),
            "understanding_of_technology": random.choice(["adequate", "good", "excellent"]),
            "problem_solving": random.choice(["adequate", "good", "excellent"]),
            "innovation": random.choice(["adequate", "good", "excellent"]),
            "presentation_clarity": random.choice(["adequate", "good", "excellent"]),
            "communication": random.choice(["adequate", "good", "excellent"]),
            "time_management": random.choice(["adequate", "good", "excellent"]),
            "documentation_completeness": random.choice(["adequate", "good", "excellent"]),
            "documentation_quality": random.choice(["adequate", "good", "excellent"]),
            "qa_response": random.choice(["adequate", "good", "excellent"]),
            "comments": f"Load test evaluation - {random.randint(1000, 9999)}",
            "is_pass": True
        }
        
        with self.client.post(
            "/api/external/evaluations/create/",
            json=evaluation_data,
            headers=self.get_headers(),
            name="/api/external/evaluations/create/",
            catch_response=True
        ) as response:
            if response.status_code in [200, 201]:
                response.success()
            elif response.status_code == 400:
                # Evaluation may already exist
                response.success()
            else:
                response.failure(f"Evaluation failed: {response.status_code}")


class CommitteeMemberUser(HttpUser):
    """
    Simulates a Committee Member user:
    - Managing external groups
    - Creating assignments
    - Viewing reports
    """
    
    weight = 2
    wait_time = between(2, 6)
    
    def on_start(self):
        """Login as committee member."""
        self.token = None
        
        response = self.client.post("/api/token/", json={
            "username": f"committee{random.randint(1, 3)}",
            "password": "test123"
        })
        
        if response.status_code == 200:
            self.token = response.json().get("access")
            logger.info("Committee member logged in")
    
    def get_headers(self):
        if self.token:
            return {"Authorization": f"Bearer {self.token}"}
        return {}
    
    @task(10)
    def get_dashboard(self):
        """View committee dashboard."""
        self.client.get(
            "/api/committee/dashboard/",
            headers=self.get_headers(),
            name="/api/committee/dashboard/"
        )
    
    @task(8)
    def list_external_examiners(self):
        """List all external examiners."""
        self.client.get(
            "/api/external/examiners/",
            headers=self.get_headers(),
            name="/api/external/examiners/"
        )
    
    @task(6)
    def list_external_groups(self):
        """List external groups."""
        self.client.get(
            "/api/external/groups/",
            headers=self.get_headers(),
            name="/api/external/groups/ [committee]"
        )
    
    @task(4)
    def list_available_groups(self):
        """List groups available for assignment."""
        self.client.get(
            "/api/external/available-groups/",
            headers=self.get_headers(),
            name="/api/external/available-groups/"
        )
    
    @task(3)
    def list_assignments(self):
        """List all assignments."""
        self.client.get(
            "/api/external/assignments/",
            headers=self.get_headers(),
            name="/api/external/assignments/ [committee]"
        )
    
    @task(2)
    def get_analytics(self):
        """View analytics/reports."""
        self.client.get(
            "/api/committee/analytics/",
            headers=self.get_headers(),
            name="/api/committee/analytics/"
        )
    
    @task(1)
    def create_external_group(self):
        """Create a new external group (low frequency)."""
        group_data = {
            "name": f"Load Test Group {random.randint(1000, 9999)}",
            "external_examiner": random.randint(1, 5),
            "semester": "Spring 2026",
            "max_groups": 5
        }
        
        self.client.post(
            "/api/external/groups/",
            json=group_data,
            headers=self.get_headers(),
            name="/api/external/groups/ [create]"
        )


class StudentUser(HttpUser):
    """
    Simulates a Student user:
    - Viewing dashboard
    - Checking external evaluation
    - Accessing project information
    """
    
    weight = 4  # Many students
    wait_time = between(2, 8)
    
    def on_start(self):
        """Login as student."""
        self.token = None
        
        response = self.client.post("/api/token/", json={
            "username": f"student{random.randint(1, 20)}",
            "password": "test123"
        })
        
        if response.status_code == 200:
            self.token = response.json().get("access")
    
    def get_headers(self):
        if self.token:
            return {"Authorization": f"Bearer {self.token}"}
        return {}
    
    @task(10)
    def get_dashboard(self):
        """View student dashboard."""
        self.client.get(
            "/api/student/dashboard/",
            headers=self.get_headers(),
            name="/api/student/dashboard/"
        )
    
    @task(8)
    def get_profile(self):
        """View profile."""
        self.client.get(
            "/api/student/profile/",
            headers=self.get_headers(),
            name="/api/student/profile/"
        )
    
    @task(6)
    def get_group_info(self):
        """View group information."""
        self.client.get(
            "/api/student/group/",
            headers=self.get_headers(),
            name="/api/student/group/"
        )
    
    @task(5)
    def get_external_evaluation(self):
        """View external evaluation results."""
        self.client.get(
            "/api/student/external-evaluation/",
            headers=self.get_headers(),
            name="/api/student/external-evaluation/"
        )
    
    @task(4)
    def get_notifications(self):
        """Check notifications."""
        self.client.get(
            "/api/notifications/",
            headers=self.get_headers(),
            name="/api/notifications/"
        )
    
    @task(3)
    def get_documents(self):
        """List documents."""
        self.client.get(
            "/api/documents/",
            headers=self.get_headers(),
            name="/api/documents/"
        )
    
    @task(2)
    def get_schedules(self):
        """View evaluation schedules."""
        self.client.get(
            "/api/schedules/",
            headers=self.get_headers(),
            name="/api/schedules/"
        )


class AnonymousUser(HttpUser):
    """
    Simulates unauthenticated users (hitting public endpoints).
    """
    
    weight = 1
    wait_time = between(1, 3)
    
    @task(5)
    def access_login_page(self):
        """Access login endpoint."""
        self.client.get("/api/health/", name="/api/health/")
    
    @task(3)
    def attempt_unauthorized_access(self):
        """Test unauthorized access (should fail fast)."""
        with self.client.get(
            "/api/external/dashboard/",
            name="/api/external/dashboard/ [unauth]",
            catch_response=True
        ) as response:
            if response.status_code == 401:
                response.success()  # Expected behavior
            else:
                response.failure(f"Expected 401, got {response.status_code}")


# Event hooks for custom reporting
@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    """Log when test starts."""
    logger.info("=" * 60)
    logger.info("LOAD TEST STARTING")
    logger.info("=" * 60)


@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    """Log when test stops."""
    logger.info("=" * 60)
    logger.info("LOAD TEST COMPLETED")
    logger.info("=" * 60)


@events.request.add_listener
def on_request(request_type, name, response_time, response_length, exception, **kwargs):
    """Track slow requests."""
    if response_time > 500:  # > 500ms
        logger.warning(f"SLOW REQUEST: {name} took {response_time}ms")
