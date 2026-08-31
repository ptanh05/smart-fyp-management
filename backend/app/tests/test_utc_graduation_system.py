import io
from rest_framework.test import APITestCase, APIClient
from django.contrib.auth import get_user_model
from rest_framework import status

from app.models import (
    CustomUser,
    Student,
    Supervisor,
    SupervisorQuota,
    ProjectTopicArea,
    InternshipInfo,
    GraduationProject,
    OutlineReview,
    WeeklyProgressReport,
    DefenseCouncil,
    CouncilMember,
    CouncilLiveScore,
    EvaluationPolicy,
    FinalGradeSummary,
    AcademicBatch,
    CourseClass
)

class UTCGraduationSystemTests(APITestCase):
    client: APIClient  # type: ignore[assignment]

    def setUp(self):
        super().setUp()
        self.client = APIClient()

        # 1. Create Academic Batch & Policy
        self.batch = AcademicBatch.objects.create(
            batch_code="2026_2027_HK1_TEST",
            batch_name="Đợt ĐATN K60-K63 Test",
            is_active=True
        )
        self.policy = EvaluationPolicy.objects.create(
            batch=self.batch,
            weight_supervisor=0.4,
            weight_reviewer=0.2,
            weight_council=0.4
        )

        # 2. Topic Areas
        self.topic_software = ProjectTopicArea.objects.create(
            name="Phát triển phần mềm và ứng dụng (webApp, MobleApp)",
            code="SOFTWARE_DEV",
            is_active=True
        )
        self.topic_ai = ProjectTopicArea.objects.create(
            name="Dữ liệu và trí tuệ nhân tạo",
            code="AI_DATA",
            is_active=True
        )

        # 3. Course Class
        self.course_class = CourseClass.objects.create(
            batch=self.batch,
            class_code="IT1.659.103",
            class_name="Đồ án tốt nghiệp Kỹ sư CNTT",
            program_type="DAI_TRA"
        )

        # 4. Supervisor 1 (GVHD)
        self.sup1_user = CustomUser.objects.create_user(
            username="gv_du",
            email="du@utc.edu.vn",
            password="password123",
            first_name="Dư",
            last_name="Nguyễn Đức",
            user_type="supervisor"
        )
        self.sup1 = Supervisor.objects.create(
            user=self.sup1_user,
            supervisor_id="GV003",
            academic_title="TS",
            department_name="CNPM"
        )
        self.quota1 = SupervisorQuota.objects.create(
            supervisor=self.sup1,
            batch=self.batch,
            viet_anh_quota=4,
            general_cntt_quota=10,
            max_total_quota=14
        )

        # 5. Supervisor 2 (GVPB & Council Member)
        self.sup2_user = CustomUser.objects.create_user(
            username="gv_sao",
            email="sao@utc.edu.vn",
            password="password123",
            first_name="Sao",
            last_name="Nguyễn Kim",
            user_type="supervisor"
        )
        self.sup2 = Supervisor.objects.create(
            user=self.sup2_user,
            supervisor_id="GV008",
            academic_title="TS",
            department_name="Mạng&HTTT"
        )
        self.quota2 = SupervisorQuota.objects.create(
            supervisor=self.sup2,
            batch=self.batch,
            viet_anh_quota=3,
            general_cntt_quota=5,
            max_total_quota=8
        )

        # 6. Student
        self.student_user = CustomUser.objects.create_user(
            username="201200101",
            email="201200101@lms.utc.edu.vn",
            password="password123",
            first_name="Nam",
            last_name="Trần Văn",
            user_type="student"
        )
        self.student = Student.objects.create(
            user=self.student_user,
            registration_no="201200101",
            department="CNTT K62",
            academic_batch=self.batch,
            course_class=self.course_class
        )

    def test_evaluation_policy_weights_and_grade_calculation(self):
        """Test UTC Grade conversion logic (10-scale -> 4.0 scale & letter grade)"""
        # Create Project
        proj = GraduationProject.objects.create(
            student=self.student,
            supervisor=self.sup1,
            reviewer=self.sup2,
            batch=self.batch,
            topic_category=self.topic_software,
            topic_title_vi="Xây dựng hệ thống quản lý ĐATN",
            status="IN_PROGRESS"
        )

        # Final grade summary
        summary = FinalGradeSummary.objects.create(
            project=proj,
            supervisor_score=9.0,   # 40% -> 3.6
            reviewer_score=8.5,     # 20% -> 1.7
            council_avg_score=9.0   # 40% -> 3.6 -> Total: 8.9 (Giỏi, A)
        )
        summary.calculate_and_save(policy=self.policy)

        self.assertEqual(summary.final_score_10, 8.9)
        self.assertEqual(summary.final_score_4, 4.0)
        self.assertEqual(summary.final_letter_grade, "A")
        self.assertEqual(summary.classification, "Giỏi")
        self.assertTrue(summary.is_passed)

    def test_student_survey_api(self):
        """Test Student survey and internship preference registration"""
        self.client.force_authenticate(user=self.student_user)

        # GET survey
        res_get = self.client.get("/app/student/survey/")
        self.assertEqual(res_get.status_code, status.HTTP_200_OK)
        self.assertEqual(res_get.data["student"]["registration_no"], "201200101")

        # POST survey
        res_post = self.client.post("/app/student/survey/", {
            "is_interning": True,
            "company_name": "FPT Software",
            "topic_direction": self.topic_software.id,
            "preferred_supervisor": self.sup1.id,
            "tentative_title": "Nghiên cứu ứng dụng Microservices",
            "phone_number": "0987654321"
        })
        self.assertEqual(res_post.status_code, status.HTTP_200_OK)

        # Verify DB
        info = InternshipInfo.objects.get(student=self.student)
        self.assertTrue(info.is_interning)
        self.assertEqual(info.company_name, "FPT Software")
        self.assertEqual(info.preferred_supervisor, self.sup1)
        self.student.refresh_from_db()
        self.assertEqual(self.student.phone_number, "0987654321")

    def test_outline_submission_and_supervisor_review(self):
        """Test outline submission and approval lifecycle"""
        # Create Project
        proj = GraduationProject.objects.create(
            student=self.student,
            supervisor=self.sup1,
            batch=self.batch,
            topic_title_vi="Tên đề tài ban đầu",
            status="ALLOCATED"
        )

        # Student submits outline
        self.client.force_authenticate(user=self.student_user)
        pdf_file = io.BytesIO(b"%PDF-1.4 Mock PDF Content")
        pdf_file.name = "de_cuong.pdf"

        res_submit = self.client.post("/app/student/outline/submit/", {
            "topic_title_vi": "Nghiên cứu kiến trúc Event-Driven",
            "topic_title_en": "Event-Driven Architecture Research",
            "outline_file": pdf_file
        }, format="multipart")
        self.assertEqual(res_submit.status_code, status.HTTP_200_OK)

        proj.refresh_from_db()
        self.assertEqual(proj.status, "OUTLINE_PENDING")
        self.assertEqual(proj.topic_title_vi, "Nghiên cứu kiến trúc Event-Driven")

        # Supervisor reviews outline
        self.client.force_authenticate(user=self.sup1_user)
        res_review = self.client.post("/app/supervisor/outline/review/", {
            "project_id": proj.id,
            "verdict": "APPROVED",
            "comments": "Đề cương chi tiết đạt yêu cầu, cho phép tiến hành."
        })
        self.assertEqual(res_review.status_code, status.HTTP_200_OK)

        proj.refresh_from_db()
        self.assertEqual(proj.status, "OUTLINE_APPROVED")
        outline_review = OutlineReview.objects.get(project=proj)
        self.assertEqual(outline_review.verdict, "APPROVED")

    def test_weekly_progress_reports_and_supervisor_feedback(self):
        """Test Weekly progress report submission (Week 1 to 15) and rating"""
        proj = GraduationProject.objects.create(
            student=self.student,
            supervisor=self.sup1,
            batch=self.batch,
            topic_title_vi="Phát triển Smart-FYP",
            status="IN_PROGRESS"
        )

        # Student submits Week 1
        self.client.force_authenticate(user=self.student_user)
        res_week = self.client.post("/app/student/weekly-reports/", {
            "week_number": 1,
            "summary_content": "Đã khảo sát yêu cầu và thiết kế Database Schema.",
            "planned_tasks": "Thiết kế API endpoints và viết unit tests.",
            "git_commit_link": "https://github.com/utc/smart-fyp/commit/abc123"
        })
        self.assertEqual(res_week.status_code, status.HTTP_200_OK)

        report = WeeklyProgressReport.objects.get(project=proj, week_number=1)
        self.assertEqual(report.summary_content, "Đã khảo sát yêu cầu và thiết kế Database Schema.")

        # Supervisor provides feedback
        self.client.force_authenticate(user=self.sup1_user)
        res_feedback = self.client.post("/app/supervisor/weekly-feedback/", {
            "report_id": report.id,
            "rating": "GOOD",
            "feedback": "Tiến độ rất tốt, bám sát kế hoạch đề ra."
        })
        self.assertEqual(res_feedback.status_code, status.HTTP_200_OK)

        report.refresh_from_db()
        self.assertEqual(report.supervisor_rating, "GOOD")
        self.assertEqual(report.supervisor_feedback, "Tiến độ rất tốt, bám sát kế hoạch đề ra.")

    def test_council_live_defense_and_conflict_constraint(self):
        """Test Live defense session and prevent supervisor from grading own student in council"""
        council = DefenseCouncil.objects.create(
            batch=self.batch,
            council_number=1,
            council_name="Hội đồng 1 - CNPM",
            defense_room="502-A9"
        )
        # Add sup2 to council
        member2 = CouncilMember.objects.create(
            council=council,
            supervisor=self.sup2,
            user=self.sup2_user,
            role="CHAIR"
        )
        # Add sup1 (student's supervisor) to council
        member1 = CouncilMember.objects.create(
            council=council,
            supervisor=self.sup1,
            user=self.sup1_user,
            role="MEMBER"
        )

        proj = GraduationProject.objects.create(
            student=self.student,
            supervisor=self.sup1,
            reviewer=self.sup2,
            council=council,
            batch=self.batch,
            topic_title_vi="Bảo vệ ĐATN K62",
            supervisor_score=8.5,
            reviewer_score=8.0,
            status="DEFENSE_READY"
        )

        # 1. Sup1 tries to grade his OWN student in Council -> MUST BE REJECTED
        self.client.force_authenticate(user=self.sup1_user)
        res_conflict = self.client.post("/app/council/submit-score/", {
            "project_id": proj.id,
            "score_presentation": 3.0,
            "score_content": 3.0,
            "score_qa": 2.0,
            "score_demo": 2.0
        })
        self.assertEqual(res_conflict.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Vi phạm quy chế", res_conflict.data["detail"])

        # 2. Sup2 (independent committee member) grades student -> SUCCESS
        self.client.force_authenticate(user=self.sup2_user)
        res_grade = self.client.post("/app/council/submit-score/", {
            "project_id": proj.id,
            "score_presentation": 2.7,
            "score_content": 2.8,
            "score_qa": 1.8,
            "score_demo": 1.7,
            "comments": "Thuyết trình rõ ràng, trả lời tốt."
        })
        self.assertEqual(res_grade.status_code, status.HTTP_200_OK)

        score_obj = CouncilLiveScore.objects.get(project=proj, member=member2)
        self.assertEqual(score_obj.total_score, 9.0)

        # Final grade check: 8.5*0.4 + 8.0*0.2 + 9.0*0.4 = 3.4 + 1.6 + 3.6 = 8.6 -> A, Giỏi
        proj.refresh_from_db()
        self.assertEqual(proj.status, "PASSED")
        summary = FinalGradeSummary.objects.get(project=proj)
        self.assertEqual(summary.final_score_10, 8.6)
        self.assertEqual(summary.final_letter_grade, "A")
