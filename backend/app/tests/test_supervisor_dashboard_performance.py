import datetime
from django.utils import timezone
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from app.models import (
    CustomUser,
    Student,
    Supervisor,
    AcademicBatch,
    CourseClass,
    ProjectTopicArea,
    GraduationProject,
    SupervisionTask,
    SupervisionMeetingLog,
    WeeklyProgressReport,
    StudentPreference,
    InternshipInfo,
    DefenseCouncil,
)
from app.serializers.utc_graduation_serializers import GraduationProjectDetailSerializer

def old_reference_get_is_currently_defending(obj):
    """Exact implementation of old get_is_currently_defending prior to P0.3 optimization"""
    if obj.council and obj.council.current_defending_project_id == obj.id:
        return True
    return obj.defense_status == "DEFENDING" or obj.status == "DEFENDING"

class SupervisorDashboardPerformanceTestCase(APITestCase):
    """
    P0.3 Regression and Query-Budget Test Suite for:
    SupervisorGraduationProjectsAPIView and GraduationProjectDetailSerializer
    """

    def setUp(self):
        super().setUp()
        self.client = APIClient()

        # Batch
        self.batch = AcademicBatch.objects.create(
            batch_code="BATCH_P03_TEST",
            batch_name="Đợt Test P0.3",
            program_type="BOTH"
        )
        self.course_class = CourseClass.objects.create(
            batch=self.batch,
            class_code="CNTT_P03",
            class_name="Công nghệ thông tin P0.3"
        )
        self.topic_area = ProjectTopicArea.objects.create(
            name="Hệ thống thông tin & AI",
            code="HTTT_AI"
        )

        # Supervisor A
        self.user_a = CustomUser.objects.create_user(
            username="sup_a_p03",
            first_name="Văn A",
            last_name="Nguyễn",
            email="sup_a@utc.edu.vn",
            user_type="supervisor"
        )
        self.sup_a = Supervisor.objects.create(
            user=self.user_a,
            supervisor_id="GV_P03_A",
            academic_title="TS."
        )

        # Supervisor B
        self.user_b = CustomUser.objects.create_user(
            username="sup_b_p03",
            first_name="Thị B",
            last_name="Trần",
            email="sup_b@utc.edu.vn",
            user_type="supervisor"
        )
        self.sup_b = Supervisor.objects.create(
            user=self.user_b,
            supervisor_id="GV_P03_B",
            academic_title="ThS."
        )

        # Student user not a supervisor
        self.user_student = CustomUser.objects.create_user(
            username="student_p03",
            first_name="Học",
            last_name="Sinh",
            user_type="student"
        )

        self.endpoint = "/api/supervisor/graduation-projects/"

    def _create_student(self, index, batch=None):
        batch = batch or self.batch
        u = CustomUser.objects.create_user(
            username=f"sv_p03_{index}",
            first_name=f"Văn {index}",
            last_name="Lê",
            email=f"sv_{index}@utc.edu.vn",
            user_type="student"
        )
        st = Student.objects.create(
            user=u,
            registration_no=f"2026_SV_{index:03d}",
            department="CNTT",
            academic_batch=batch,
            course_class=self.course_class
        )
        return st

    def test_supervisor_with_zero_projects(self):
        """Supervisor with 0 projects and 0 stage-2 preferences."""
        self.client.force_authenticate(user=self.user_a)
        response = self.client.get(self.endpoint)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 0)

    def test_supervisor_with_one_project_and_task_stats(self):
        """
        Verify that task_stats computes total, completed, in_progress, todo,
        and completion_rate accurately without N+1 count queries.
        """
        st = self._create_student(1)
        project = GraduationProject.objects.create(
            batch=self.batch,
            student=st,
            supervisor=self.sup_a,
            topic_category=self.topic_area,
            topic_title_vi="Đề tài Thử nghiệm 1",
            status="ALLOCATED"
        )

        # Create tasks in various states:
        # 2 completed, 1 in_progress, 1 todo
        SupervisionTask.objects.create(
            project=project,
            assigned_by=self.sup_a,
            title="Task 1: Khảo sát",
            status="DONE",
            is_completed=True
        )
        SupervisionTask.objects.create(
            project=project,
            assigned_by=self.sup_a,
            title="Task 2: Thiết kế",
            status="DONE",
            is_completed=True
        )
        SupervisionTask.objects.create(
            project=project,
            assigned_by=self.sup_a,
            title="Task 3: Cài đặt",
            status="IN_PROGRESS",
            is_completed=False
        )
        SupervisionTask.objects.create(
            project=project,
            assigned_by=self.sup_a,
            title="Task 4: Kiểm thử",
            status="TODO",
            is_completed=False
        )

        self.client.force_authenticate(user=self.user_a)
        response = self.client.get(self.endpoint)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

        p_data = response.data[0]
        stats = p_data["task_stats"]
        self.assertEqual(stats["total"], 4)
        self.assertEqual(stats["completed"], 2)
        self.assertEqual(stats["in_progress"], 1)
        self.assertEqual(stats["todo"], 1)
        self.assertEqual(stats["completion_rate"], 50.0)

    def test_project_without_tasks(self):
        """Project with 0 tasks should have total=0 and completion_rate=0."""
        st = self._create_student(2)
        GraduationProject.objects.create(
            batch=self.batch,
            student=st,
            supervisor=self.sup_a,
            topic_category=self.topic_area,
            topic_title_vi="Đề tài không có task",
            status="ALLOCATED"
        )

        self.client.force_authenticate(user=self.user_a)
        response = self.client.get(self.endpoint)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

        stats = response.data[0]["task_stats"]
        self.assertEqual(stats["total"], 0)
        self.assertEqual(stats["completed"], 0)
        self.assertEqual(stats["in_progress"], 0)
        self.assertEqual(stats["todo"], 0)
        self.assertEqual(stats["completion_rate"], 0)

    def test_multiple_projects_zero_n_plus_one_bounded_queries(self):
        """
        Verify that scaling to 5 projects with tasks, meeting logs, and weekly reports
        executes in a bounded number of queries (<= 6 queries), with zero N+1.
        """
        for i in range(10, 15):
            st = self._create_student(i)
            p = GraduationProject.objects.create(
                batch=self.batch,
                student=st,
                supervisor=self.sup_a,
                topic_category=self.topic_area,
                topic_title_vi=f"Đề tài số {i}",
                status="ALLOCATED"
            )
            # Create a task, a log, a report for each
            t = SupervisionTask.objects.create(
                project=p,
                assigned_by=self.sup_a,
                title=f"Task for {i}",
                status="TODO"
            )
            log = SupervisionMeetingLog.objects.create(
                project=p,
                meeting_date=datetime.date.today(),
                meeting_time=datetime.time(9, 0),
                content_discussed="Trao đổi tiến độ"
            )
            log.tasks.add(t)
            WeeklyProgressReport.objects.create(
                project=p,
                week_number=1,
                summary_content="Báo cáo tuần 1"
            )

        self.client.force_authenticate(user=self.user_a)

        # Expected bounded queries: <= 6 queries regardless of project count (zero N+1)
        with self.assertNumQueries(6):
            response = self.client.get(self.endpoint)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 5)

    def test_stage2_preferences_batch_fetching(self):
        """
        Verify that students in Stage 2 (unassigned students who submitted survey choosing supervisor)
        are properly fetched in batch with zero N+1 queries.
        """
        st1 = self._create_student(21)
        st2 = self._create_student(22)
        st3 = self._create_student(23)

        # Create preferences choosing sup_a as preference 1, 2, 3
        pref1 = StudentPreference.objects.create(
            student=st1,
            batch=self.batch,
            preference_1=self.sup_a,
            topic_direction=self.topic_area
        )
        pref2 = StudentPreference.objects.create(
            student=st2,
            batch=self.batch,
            preference_2=self.sup_a,
            topic_direction=self.topic_area
        )
        pref3 = StudentPreference.objects.create(
            student=st3,
            batch=self.batch,
            preference_3=self.sup_a,
            topic_direction=self.topic_area
        )

        InternshipInfo.objects.create(
            student=st1,
            batch=self.batch,
            tentative_title="Hệ thống AI khảo sát 1",
            company_name="FPT Software",
            is_interning=True
        )
        InternshipInfo.objects.create(
            student=st2,
            batch=self.batch,
            tentative_title="Hệ thống Quản lý IoT",
            company_name="Viettel Solutions",
            is_interning=True
        )

        self.client.force_authenticate(user=self.user_a)

        # Expected queries:
        # 1. GraduationProject (empty for sup_a here)
        # 2. StudentPreference stage 2
        # 3. InternshipInfo batch fetch
        with self.assertNumQueries(3):
            response = self.client.get(self.endpoint)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 3)

        # Check stage 2 contract
        for item in response.data:
            self.assertTrue(item["is_stage_2"])
            self.assertEqual(item["stage"], 2)
            self.assertEqual(item["status"], "SURVEY")
            self.assertTrue(item["id"] < 0)

        # Check survey tentative title and company mapping
        item1 = next(it for it in response.data if it["preference_id"] == pref1.id)
        self.assertEqual(item1["topic_title_vi"], "Hệ thống AI khảo sát 1")
        self.assertEqual(item1["company_name"], "FPT Software")
        self.assertTrue(item1["is_interning"])
        self.assertEqual(item1["preference_rank"], 1)

        item2 = next(it for it in response.data if it["preference_id"] == pref2.id)
        self.assertEqual(item2["topic_title_vi"], "Hệ thống Quản lý IoT")
        self.assertEqual(item2["company_name"], "Viettel Solutions")
        self.assertEqual(item2["preference_rank"], 2)

        item3 = next(it for it in response.data if it["preference_id"] == pref3.id)
        self.assertEqual(item3["topic_title_vi"], self.topic_area.name)
        self.assertEqual(item3["company_name"], "")
        self.assertFalse(item3["is_interning"])
        self.assertEqual(item3["preference_rank"], 3)

    def test_isolation_between_supervisors(self):
        """Supervisor A and Supervisor B must only see their own projects."""
        st_a = self._create_student(31)
        GraduationProject.objects.create(
            batch=self.batch,
            student=st_a,
            supervisor=self.sup_a,
            topic_category=self.topic_area,
            topic_title_vi="Đề tài riêng của GV A",
            status="ALLOCATED"
        )

        st_b = self._create_student(32)
        GraduationProject.objects.create(
            batch=self.batch,
            student=st_b,
            supervisor=self.sup_b,
            topic_category=self.topic_area,
            topic_title_vi="Đề tài riêng của GV B",
            status="ALLOCATED"
        )

        # Check Sup A view
        self.client.force_authenticate(user=self.user_a)
        resp_a = self.client.get(self.endpoint)
        self.assertEqual(len(resp_a.data), 1)
        self.assertEqual(resp_a.data[0]["topic_title_vi"], "Đề tài riêng của GV A")

        # Check Sup B view
        self.client.force_authenticate(user=self.user_b)
        resp_b = self.client.get(self.endpoint)
        self.assertEqual(len(resp_b.data), 1)
        self.assertEqual(resp_b.data[0]["topic_title_vi"], "Đề tài riêng của GV B")

    def test_permissions_and_unauthenticated(self):
        """Non-supervisor users receive 403 Forbidden; unauthenticated receive 401."""
        # Unauthenticated
        resp = self.client.get(self.endpoint)
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

        # Student user (no supervisor_profile)
        self.client.force_authenticate(user=self.user_student)
        resp2 = self.client.get(self.endpoint)
        self.assertEqual(resp2.status_code, status.HTTP_403_FORBIDDEN)

    def test_is_currently_defending_all_cases_parity_with_old_logic(self):
        """
        Comprehensive safety audit:
        Verifies that get_is_currently_defending() produces 100% identical results
        between old logic and optimized logic across ALL database states:
        1. Project status=DEFENDING with council.
        2. Project status=DEFENSE_READY in council with another project defending.
        3. Project status=DEFENDED in council.
        4. Council with no defending projects.
        5. Edge case: Council with MULTIPLE projects having status=DEFENDING.
        6. Project without council with status=DEFENDING.
        7. Project without council with status=ALLOCATED.
        8. In-memory override on council: _current_defending_project = obj.
        9. In-memory override on council: _current_defending_project = other.
        """
        serializer = GraduationProjectDetailSerializer()

        # Council 1: has one project currently defending (p1) and other projects (p2, p3)
        council_1 = DefenseCouncil.objects.create(
            batch=self.batch,
            council_number=1,
            council_name="Hội đồng 1"
        )
        st41 = self._create_student(41)
        p1 = GraduationProject.objects.create(
            batch=self.batch,
            student=st41,
            supervisor=self.sup_a,
            council=council_1,
            topic_category=self.topic_area,
            topic_title_vi="Đề tài P1 (HĐ1 - DEFENDING)",
            status="DEFENDING"
        )

        st42 = self._create_student(42)
        p2 = GraduationProject.objects.create(
            batch=self.batch,
            student=st42,
            supervisor=self.sup_a,
            council=council_1,
            topic_category=self.topic_area,
            topic_title_vi="Đề tài P2 (HĐ1 - DEFENSE_READY)",
            status="DEFENSE_READY"
        )

        st43 = self._create_student(43)
        p3 = GraduationProject.objects.create(
            batch=self.batch,
            student=st43,
            supervisor=self.sup_a,
            council=council_1,
            topic_category=self.topic_area,
            topic_title_vi="Đề tài P3 (HĐ1 - DEFENDED)",
            status="DEFENDED"
        )

        # Council 2: no project is defending
        council_2 = DefenseCouncil.objects.create(
            batch=self.batch,
            council_number=2,
            council_name="Hội đồng 2 (Trống defending)"
        )
        st44 = self._create_student(44)
        p4 = GraduationProject.objects.create(
            batch=self.batch,
            student=st44,
            supervisor=self.sup_a,
            council=council_2,
            topic_category=self.topic_area,
            topic_title_vi="Đề tài P4 (HĐ2 - WAITING)",
            status="WAITING"
        )

        # Council 3: anomalous case with MULTIPLE projects having status=DEFENDING
        council_3 = DefenseCouncil.objects.create(
            batch=self.batch,
            council_number=3,
            council_name="Hội đồng 3 (2 Defending)"
        )
        st45 = self._create_student(45)
        p5 = GraduationProject.objects.create(
            batch=self.batch,
            student=st45,
            supervisor=self.sup_a,
            council=council_3,
            topic_category=self.topic_area,
            topic_title_vi="Đề tài P5 (HĐ3 - DEFENDING A)",
            status="DEFENDING"
        )
        st46 = self._create_student(46)
        p6 = GraduationProject.objects.create(
            batch=self.batch,
            student=st46,
            supervisor=self.sup_a,
            council=council_3,
            topic_category=self.topic_area,
            topic_title_vi="Đề tài P6 (HĐ3 - DEFENDING B)",
            status="DEFENDING"
        )

        # Projects without council
        st47 = self._create_student(47)
        p7 = GraduationProject.objects.create(
            batch=self.batch,
            student=st47,
            supervisor=self.sup_a,
            council=None,
            topic_category=self.topic_area,
            topic_title_vi="Đề tài P7 (No Council - DEFENDING)",
            status="DEFENDING"
        )
        st48 = self._create_student(48)
        p8 = GraduationProject.objects.create(
            batch=self.batch,
            student=st48,
            supervisor=self.sup_a,
            council=None,
            topic_category=self.topic_area,
            topic_title_vi="Đề tài P8 (No Council - ALLOCATED)",
            status="ALLOCATED"
        )

        all_projects = [p1, p2, p3, p4, p5, p6, p7, p8]
        for p in all_projects:
            old_res = old_reference_get_is_currently_defending(p)
            new_res = serializer.get_is_currently_defending(p)
            self.assertEqual(
                new_res, old_res,
                f"Mismatch for project {p.id} ({p.topic_title_vi}): new={new_res}, old={old_res}"
            )

        # Verify expected concrete boolean values
        self.assertTrue(serializer.get_is_currently_defending(p1))
        self.assertFalse(serializer.get_is_currently_defending(p2))
        self.assertFalse(serializer.get_is_currently_defending(p3))
        self.assertFalse(serializer.get_is_currently_defending(p4))
        self.assertTrue(serializer.get_is_currently_defending(p5))
        self.assertTrue(serializer.get_is_currently_defending(p6))
        self.assertTrue(serializer.get_is_currently_defending(p7))
        self.assertFalse(serializer.get_is_currently_defending(p8))

        # Test in-memory override on council with no defending project in DB (council_2)
        p4.council.current_defending_project = p4
        self.assertEqual(serializer.get_is_currently_defending(p4), old_reference_get_is_currently_defending(p4))
        self.assertTrue(serializer.get_is_currently_defending(p4))

        p4.council.current_defending_project = p1
        self.assertEqual(serializer.get_is_currently_defending(p4), old_reference_get_is_currently_defending(p4))
        self.assertFalse(serializer.get_is_currently_defending(p4))

        # Test in-memory override on council where another project already defends in DB (council_1)
        # DB defending project (p1) takes precedence over in-memory override in both old and new logic
        p2.council.current_defending_project = p2
        self.assertEqual(serializer.get_is_currently_defending(p2), old_reference_get_is_currently_defending(p2))
        self.assertFalse(serializer.get_is_currently_defending(p2))

    def test_detail_endpoint_serializer_direct_usage(self):
        """
        Verify that GraduationProjectDetailSerializer works cleanly without prefetch/annotation
        when called on a single project (e.g. from detail / update endpoints).
        """
        st = self._create_student(50)
        council = DefenseCouncil.objects.create(
            batch=self.batch,
            council_number=5,
            council_name="Hội đồng 5"
        )
        p = GraduationProject.objects.create(
            batch=self.batch,
            student=st,
            supervisor=self.sup_a,
            council=council,
            topic_category=self.topic_area,
            topic_title_vi="Đề tài xem chi tiết",
            status="DEFENDING"
        )
        SupervisionTask.objects.create(
            project=p,
            assigned_by=self.sup_a,
            title="Task Chi tiết 1",
            status="DONE",
            is_completed=True
        )

        serializer = GraduationProjectDetailSerializer(p)
        data = serializer.data

        self.assertEqual(data["id"], p.id)
        self.assertEqual(data["topic_title_vi"], "Đề tài xem chi tiết")
        self.assertEqual(data["status"], "DEFENDING")
        self.assertTrue(data["is_currently_defending"])
        self.assertEqual(data["task_stats"]["total"], 1)
        self.assertEqual(data["task_stats"]["completed"], 1)
        self.assertEqual(data["task_stats"]["completion_rate"], 100.0)

    def test_is_currently_defending_all_cases_parity_with_old_logic(self):
        """
        Comprehensive safety audit:
        Verifies that get_is_currently_defending() produces 100% identical results
        between old logic and optimized logic across ALL database states:
        1. Project status=DEFENDING with council.
        2. Project status=DEFENSE_READY in council with another project defending.
        3. Project status=DEFENDED in council.
        4. Council with no defending projects.
        5. Edge case: Council with MULTIPLE projects having status=DEFENDING.
        6. Project without council with status=DEFENDING.
        7. Project without council with status=ALLOCATED.
        8. In-memory override on council: _current_defending_project = obj.
        9. In-memory override on council: _current_defending_project = other.
        """
        serializer = GraduationProjectDetailSerializer()

        # Council 1: has one project currently defending (p1) and other projects (p2, p3)
        council_1 = DefenseCouncil.objects.create(
            batch=self.batch,
            council_number=1,
            council_name="Hội đồng 1"
        )
        st41 = self._create_student(41)
        p1 = GraduationProject.objects.create(
            batch=self.batch,
            student=st41,
            supervisor=self.sup_a,
            council=council_1,
            topic_category=self.topic_area,
            topic_title_vi="Đề tài P1 (HĐ1 - DEFENDING)",
            status="DEFENDING"
        )

        st42 = self._create_student(42)
        p2 = GraduationProject.objects.create(
            batch=self.batch,
            student=st42,
            supervisor=self.sup_a,
            council=council_1,
            topic_category=self.topic_area,
            topic_title_vi="Đề tài P2 (HĐ1 - DEFENSE_READY)",
            status="DEFENSE_READY"
        )

        st43 = self._create_student(43)
        p3 = GraduationProject.objects.create(
            batch=self.batch,
            student=st43,
            supervisor=self.sup_a,
            council=council_1,
            topic_category=self.topic_area,
            topic_title_vi="Đề tài P3 (HĐ1 - DEFENDED)",
            status="DEFENDED"
        )

        # Council 2: no project is defending
        council_2 = DefenseCouncil.objects.create(
            batch=self.batch,
            council_number=2,
            council_name="Hội đồng 2 (Trống defending)"
        )
        st44 = self._create_student(44)
        p4 = GraduationProject.objects.create(
            batch=self.batch,
            student=st44,
            supervisor=self.sup_a,
            council=council_2,
            topic_category=self.topic_area,
            topic_title_vi="Đề tài P4 (HĐ2 - WAITING)",
            status="WAITING"
        )

        # Council 3: anomalous case with MULTIPLE projects having status=DEFENDING
        council_3 = DefenseCouncil.objects.create(
            batch=self.batch,
            council_number=3,
            council_name="Hội đồng 3 (2 Defending)"
        )
        st45 = self._create_student(45)
        p5 = GraduationProject.objects.create(
            batch=self.batch,
            student=st45,
            supervisor=self.sup_a,
            council=council_3,
            topic_category=self.topic_area,
            topic_title_vi="Đề tài P5 (HĐ3 - DEFENDING A)",
            status="DEFENDING"
        )
        st46 = self._create_student(46)
        p6 = GraduationProject.objects.create(
            batch=self.batch,
            student=st46,
            supervisor=self.sup_a,
            council=council_3,
            topic_category=self.topic_area,
            topic_title_vi="Đề tài P6 (HĐ3 - DEFENDING B)",
            status="DEFENDING"
        )

        # Projects without council
        st47 = self._create_student(47)
        p7 = GraduationProject.objects.create(
            batch=self.batch,
            student=st47,
            supervisor=self.sup_a,
            council=None,
            topic_category=self.topic_area,
            topic_title_vi="Đề tài P7 (No Council - DEFENDING)",
            status="DEFENDING"
        )
        st48 = self._create_student(48)
        p8 = GraduationProject.objects.create(
            batch=self.batch,
            student=st48,
            supervisor=self.sup_a,
            council=None,
            topic_category=self.topic_area,
            topic_title_vi="Đề tài P8 (No Council - ALLOCATED)",
            status="ALLOCATED"
        )

        all_projects = [p1, p2, p3, p4, p5, p6, p7, p8]
        for p in all_projects:
            old_res = old_reference_get_is_currently_defending(p)
            new_res = serializer.get_is_currently_defending(p)
            self.assertEqual(
                new_res, old_res,
                f"Mismatch for project {p.id} ({p.topic_title_vi}): new={new_res}, old={old_res}"
            )

        # Verify expected concrete boolean values
        self.assertTrue(serializer.get_is_currently_defending(p1))
        self.assertFalse(serializer.get_is_currently_defending(p2))
        self.assertFalse(serializer.get_is_currently_defending(p3))
        self.assertFalse(serializer.get_is_currently_defending(p4))
        self.assertTrue(serializer.get_is_currently_defending(p5))
        self.assertTrue(serializer.get_is_currently_defending(p6))
        self.assertTrue(serializer.get_is_currently_defending(p7))
        self.assertFalse(serializer.get_is_currently_defending(p8))

        # Test in-memory override cases
        # On council_2 (where no project has status='DEFENDING' in DB), in-memory override applies:
        p4.council.current_defending_project = p4
        self.assertEqual(serializer.get_is_currently_defending(p4), old_reference_get_is_currently_defending(p4))
        self.assertTrue(serializer.get_is_currently_defending(p4))

        p4.council.current_defending_project = p1
        self.assertEqual(serializer.get_is_currently_defending(p4), old_reference_get_is_currently_defending(p4))
        self.assertFalse(serializer.get_is_currently_defending(p4))

        # On council_1 (where p1 is 'DEFENDING' in DB), DB project takes precedence per DefenseCouncil model property:
        p2.council.current_defending_project = p2
        self.assertEqual(serializer.get_is_currently_defending(p2), old_reference_get_is_currently_defending(p2))
        self.assertFalse(serializer.get_is_currently_defending(p2))

    def test_detail_endpoint_serializer_direct_usage(self):
        """
        Verify that GraduationProjectDetailSerializer works cleanly without prefetch/annotation
        when called on a single project (e.g. from detail / update endpoints).
        """
        st = self._create_student(50)
        council = DefenseCouncil.objects.create(
            batch=self.batch,
            council_number=5,
            council_name="Hội đồng 5"
        )
        p = GraduationProject.objects.create(
            batch=self.batch,
            student=st,
            supervisor=self.sup_a,
            council=council,
            topic_category=self.topic_area,
            topic_title_vi="Đề tài xem chi tiết",
            status="DEFENDING"
        )
        SupervisionTask.objects.create(
            project=p,
            assigned_by=self.sup_a,
            title="Task Chi tiết 1",
            status="DONE",
            is_completed=True
        )

        serializer = GraduationProjectDetailSerializer(p)
        data = serializer.data

        self.assertEqual(data["id"], p.id)
        self.assertEqual(data["topic_title_vi"], "Đề tài xem chi tiết")
        self.assertEqual(data["status"], "DEFENDING")
        self.assertTrue(data["is_currently_defending"])
        self.assertEqual(data["task_stats"]["total"], 1)
        self.assertEqual(data["task_stats"]["completed"], 1)
        self.assertEqual(data["task_stats"]["completion_rate"], 100.0)
