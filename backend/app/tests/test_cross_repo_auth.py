import os
from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from app.models import (
    Student,
    Supervisor,
    CommitteeMember,
    CommitteeMemberPanel,
    ExternalExaminer,
)

User = get_user_model()


@override_settings(REST_FRAMEWORK={
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_THROTTLE_RATES': {
        'login': '10000/min',
        'user': '10000/min',
        'anon': '10000/min',
    }
})
class CrossRepoAuthContractTestCase(TestCase):
    """
    Automated End-to-End Cross-Repository Authentication Contract Verification Test Suite.
    Tests the complete lifecycle:
    Admin creates user -> Database persistence -> User Portal Login -> JWT issuance ->
    Role detection -> Profile endpoint -> RBAC authorization & boundary enforcement -> Cleanup.
    """

    def setUp(self):
        from django.core.cache import cache
        cache.clear()
        self.client = APIClient()

        # Admin Staff User for Admin API access
        self.admin_user = User.objects.create_superuser(
            username="E2E_CROSS_REPO_admin",
            email="E2E_CROSS_REPO_admin@utc.edu.vn",
            password="AdminPassword123!",
            user_type="admin",
        )

        # Common panel for committee
        self.panel = CommitteeMemberPanel.objects.create(name="E2E Panel A")

    def tearDown(self):
        # Clean up any temporary E2E_CROSS_REPO_ test users
        User.objects.filter(username__startswith="E2E_CROSS_REPO_").delete()

    # =========================================================================
    # 1. STUDENT LIFECYCLE
    # =========================================================================

    def test_student_e2e_lifecycle(self):
        """Verify Student creation, database persistence, login, JWT, profile, and RBAC."""
        # A. Admin creates the account
        user = User.objects.create_user(
            username="E2E_CROSS_REPO_student",
            email="E2E_CROSS_REPO_student@sv.utc.edu.vn",
            password="StudentPassword123!",
            user_type="student",
            is_active=True,
        )
        student_profile = Student.objects.create(
            user=user,
            registration_no="E2E_REG_101",
            department="Khoa Cong nghe Thong tin",
            semester="semester_8",
            batch_no="K61",
        )

        # B & C. Verify database record
        db_user = User.objects.get(username="E2E_CROSS_REPO_student")
        self.assertEqual(db_user.email, "E2E_CROSS_REPO_student@sv.utc.edu.vn")
        self.assertEqual(db_user.user_type, "student")
        self.assertTrue(db_user.is_active)
        self.assertTrue(hasattr(db_user, "student_profile"))
        self.assertEqual(db_user.student_profile.registration_no, "E2E_REG_101")

        # D. Authenticate via User Portal Login API
        login_res = self.client.post("/app/student/login/", {
            "registration_no": "E2E_REG_101",
            "password": "StudentPassword123!",
        })
        self.assertEqual(login_res.status_code, status.HTTP_200_OK)

        # E. Verify JWT issued & HttpOnly cookie set
        self.assertIn("access", login_res.data)
        self.assertIn("refresh_token", login_res.cookies)
        token = login_res.data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        # F & G. Verify Profile endpoint
        profile_res = self.client.get("/app/student/profile/")
        self.assertEqual(profile_res.status_code, status.HTTP_200_OK)
        self.assertEqual(profile_res.data.get("registration_no"), "E2E_REG_101")

        # H & I. RBAC: User Portal Routing & Cross-role rejection
        # Student cannot access supervisor/committee/external profiles
        self.assertEqual(self.client.get("/app/supervisor/profile/").status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.client.get("/app/committee_member/profile/").status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.client.get("/app/external/profile/").status_code, status.HTTP_403_FORBIDDEN)

        # J. Student cannot access Admin APIs
        self.assertEqual(self.client.get("/app/admin/users/").status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.client.get("/app/admin/security-center/").status_code, status.HTTP_403_FORBIDDEN)

    # =========================================================================
    # 2. SUPERVISOR LIFECYCLE
    # =========================================================================

    def test_supervisor_e2e_lifecycle(self):
        """Verify Supervisor creation, database persistence, login, JWT, profile, and RBAC."""
        # A. Admin creates the account
        user = User.objects.create_user(
            username="E2E_CROSS_REPO_supervisor",
            email="E2E_CROSS_REPO_supervisor@utc.edu.vn",
            password="SupervisorPassword123!",
            user_type="supervisor",
            is_active=True,
        )
        Supervisor.objects.create(
            user=user,
            supervisor_id="E2E_SUP_201",
            research_interest="AI & Data Science",
            academic_background="Ph.D",
        )

        # B & C. Verify database record
        db_user = User.objects.get(username="E2E_CROSS_REPO_supervisor")
        self.assertEqual(db_user.email, "E2E_CROSS_REPO_supervisor@utc.edu.vn")
        self.assertEqual(db_user.user_type, "supervisor")
        self.assertTrue(db_user.is_active)
        self.assertTrue(hasattr(db_user, "supervisor_profile"))
        self.assertEqual(db_user.supervisor_profile.supervisor_id, "E2E_SUP_201")

        # D. Authenticate via User Portal Login API
        login_res = self.client.post("/app/supervisor/login/", {
            "email": "E2E_CROSS_REPO_supervisor@utc.edu.vn",
            "password": "SupervisorPassword123!",
        })
        self.assertEqual(login_res.status_code, status.HTTP_200_OK)

        # E. Verify JWT issued & HttpOnly cookie set
        self.assertIn("access", login_res.data)
        self.assertIn("refresh_token", login_res.cookies)
        token = login_res.data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        # F & G. Verify Profile endpoint
        profile_res = self.client.get("/app/supervisor/profile/")
        self.assertEqual(profile_res.status_code, status.HTTP_200_OK)
        self.assertEqual(profile_res.data.get("supervisor_id"), "E2E_SUP_201")

        # H & I. RBAC: User Portal Routing & Cross-role rejection
        self.assertEqual(self.client.get("/app/student/profile/").status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.client.get("/app/committee_member/profile/").status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.client.get("/app/external/profile/").status_code, status.HTTP_403_FORBIDDEN)

        # J. Supervisor cannot access Admin APIs
        self.assertEqual(self.client.get("/app/admin/users/").status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.client.get("/app/admin/security-center/").status_code, status.HTTP_403_FORBIDDEN)

    # =========================================================================
    # 3. COMMITTEE MEMBER LIFECYCLE
    # =========================================================================

    def test_committee_member_e2e_lifecycle(self):
        """Verify Committee Member creation, database persistence, login, JWT, profile, and RBAC."""
        # A. Admin creates the account
        user = User.objects.create_user(
            username="E2E_CROSS_REPO_committee",
            email="E2E_CROSS_REPO_committee@utc.edu.vn",
            password="CommitteePassword123!",
            user_type="committee_member",
            is_active=True,
        )
        CommitteeMember.objects.create(
            user=user,
            committee_id="E2E_COM_301",
            panel=self.panel,
        )

        # B & C. Verify database record
        db_user = User.objects.get(username="E2E_CROSS_REPO_committee")
        self.assertEqual(db_user.email, "E2E_CROSS_REPO_committee@utc.edu.vn")
        self.assertEqual(db_user.user_type, "committee_member")
        self.assertTrue(db_user.is_active)
        self.assertTrue(hasattr(db_user, "committee_member_profile"))
        self.assertEqual(db_user.committee_member_profile.committee_id, "E2E_COM_301")

        # D. Authenticate via User Portal Login API
        login_res = self.client.post("/app/committee_member/login/", {
            "email": "E2E_CROSS_REPO_committee@utc.edu.vn",
            "password": "CommitteePassword123!",
        })
        self.assertEqual(login_res.status_code, status.HTTP_200_OK)

        # E. Verify JWT issued & HttpOnly cookie set
        self.assertIn("access", login_res.data)
        self.assertIn("refresh_token", login_res.cookies)
        token = login_res.data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        # F & G. Verify Profile endpoint
        profile_res = self.client.get("/app/committee_member/profile/")
        self.assertEqual(profile_res.status_code, status.HTTP_200_OK)
        self.assertEqual(profile_res.data.get("committee_id"), "E2E_COM_301")

        # H & I. RBAC: User Portal Routing & Cross-role rejection
        self.assertEqual(self.client.get("/app/student/profile/").status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.client.get("/app/supervisor/profile/").status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.client.get("/app/external/profile/").status_code, status.HTTP_403_FORBIDDEN)

        # J. Committee Member cannot access Admin APIs
        self.assertEqual(self.client.get("/app/admin/users/").status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.client.get("/app/admin/security-center/").status_code, status.HTTP_403_FORBIDDEN)

    # =========================================================================
    # 4. EXTERNAL EXAMINER LIFECYCLE
    # =========================================================================

    def test_external_examiner_e2e_lifecycle(self):
        """Verify External Examiner creation, database persistence, login, JWT, profile, and RBAC."""
        # A. Admin creates the account
        user = User.objects.create_user(
            username="E2E_CROSS_REPO_external",
            email="E2E_CROSS_REPO_external@partner.edu.vn",
            password="ExternalPassword123!",
            user_type="external_examiner",
            is_active=True,
        )
        ExternalExaminer.objects.create(
            user=user,
            external_id="E2E_EXT_401",
            institution="Partner University",
            designation="professor",
            specialization="Software Engineering",
        )

        # B & C. Verify database record
        db_user = User.objects.get(username="E2E_CROSS_REPO_external")
        self.assertEqual(db_user.email, "E2E_CROSS_REPO_external@partner.edu.vn")
        self.assertEqual(db_user.user_type, "external_examiner")
        self.assertTrue(db_user.is_active)
        self.assertTrue(hasattr(db_user, "external_examiner_profile"))
        self.assertEqual(db_user.external_examiner_profile.external_id, "E2E_EXT_401")

        # D. Authenticate via User Portal Login API
        login_res = self.client.post("/app/external/login/", {
            "email": "E2E_CROSS_REPO_external@partner.edu.vn",
            "password": "ExternalPassword123!",
        })
        self.assertEqual(login_res.status_code, status.HTTP_200_OK)

        # E. Verify JWT issued & HttpOnly cookie set
        self.assertIn("access", login_res.data)
        self.assertIn("refresh_token", login_res.cookies)
        token = login_res.data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        # F & G. Verify Profile & Dashboard endpoints
        profile_res = self.client.get("/app/external/profile/")
        self.assertEqual(profile_res.status_code, status.HTTP_200_OK)
        self.assertEqual(profile_res.data.get("external_id"), "E2E_EXT_401")

        dashboard_res = self.client.get("/app/external/dashboard/")
        self.assertEqual(dashboard_res.status_code, status.HTTP_200_OK)

        # H & I. RBAC: User Portal Routing & Cross-role rejection
        self.assertEqual(self.client.get("/app/student/profile/").status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.client.get("/app/supervisor/profile/").status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.client.get("/app/committee_member/profile/").status_code, status.HTTP_403_FORBIDDEN)

        # J. External Examiner cannot access Admin APIs
        self.assertEqual(self.client.get("/app/admin/users/").status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.client.get("/app/admin/security-center/").status_code, status.HTTP_403_FORBIDDEN)

    # =========================================================================
    # 5. UNAUTHENTICATED & ADMIN ACCESS CHECKS
    # =========================================================================

    def test_unauthenticated_and_admin_permissions(self):
        """Verify unauthenticated requests return 401 and Admin staff returns 200 on Admin APIs."""
        # Unauthenticated access returns 401
        self.client.credentials()
        self.assertEqual(self.client.get("/app/student/profile/").status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(self.client.get("/app/supervisor/profile/").status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(self.client.get("/app/committee_member/profile/").status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(self.client.get("/app/external/profile/").status_code, status.HTTP_401_UNAUTHORIZED)

        # Admin Staff access to Admin APIs returns 200
        from rest_framework_simplejwt.tokens import RefreshToken
        admin_token = str(RefreshToken.for_user(self.admin_user).access_token)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")

        admin_users_res = self.client.get("/app/admin/users/")
        self.assertEqual(admin_users_res.status_code, status.HTTP_200_OK)

        admin_sec_res = self.client.get("/app/admin/security-center/")
        self.assertEqual(admin_sec_res.status_code, status.HTTP_200_OK)

    # =========================================================================
    # 6. CLEANUP VERIFICATION
    # =========================================================================

    def test_cleanup_verification(self):
        """Verify all temporary E2E_CROSS_REPO_ accounts are cleanly purged."""
        # Create temporary accounts
        User.objects.create_user(username="E2E_CROSS_REPO_temp1", password="pw", user_type="student")
        User.objects.create_user(username="E2E_CROSS_REPO_temp2", password="pw", user_type="supervisor")
        
        # Ensure they exist
        self.assertEqual(User.objects.filter(username__startswith="E2E_CROSS_REPO_").count(), 3)  # + admin
        
        # Run cleanup
        User.objects.filter(username__startswith="E2E_CROSS_REPO_").delete()
        
        # Verify 0 remaining
        count = User.objects.filter(username__startswith="E2E_CROSS_REPO_").count()
        self.assertEqual(count, 0)
