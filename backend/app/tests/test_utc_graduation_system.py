import io
from django.core.files.uploadedfile import SimpleUploadedFile
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
    ProposedAllocation,
    SupervisionTask,
    ThesisDeferralRequest,
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
from app.services import (
    DegreeEligibilityService,
    ThesisAllocationService,
    AcademicClearanceService,
    CouncilStructureService
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

    def test_supervision_meeting_log_and_tasks(self):
        """Test module Supervision Meeting Log và Task Board tương tác"""
        proj = GraduationProject.objects.create(
            student=self.student,
            supervisor=self.sup1,
            batch=self.batch,
            topic_title_vi="Hệ thống quản lý đồ án tốt nghiệp UTC",
            status="IN_PROGRESS"
        )

        # 1. GVHD tạo nhật ký hướng dẫn
        self.client.force_authenticate(user=self.sup1_user)
        res_log = self.client.post("/app/supervisor/supervision-logs/", {
            "project_id": proj.id,
            "meeting_date": "2026-09-10",
            "meeting_time": "09:00 - 10:30",
            "meeting_type": "ONLINE",
            "location_or_link": "https://meet.google.com/abc-xyz",
            "content_discussed": "Rà soát kiến trúc cơ sở dữ liệu và API",
            "supervisor_notes": "Cần hoàn thiện module xác thực và bảng điểm",
            "next_meeting_plan": "Báo cáo demo phiên bản thử nghiệm"
        })
        self.assertEqual(res_log.status_code, status.HTTP_201_CREATED)
        meeting_log_id = res_log.data["log"]["id"]

        # 2. GVHD giao 2 nhiệm vụ cho sinh viên
        res_task1 = self.client.post("/app/supervisor/tasks/", {
            "project_id": proj.id,
            "meeting_log_id": meeting_log_id,
            "title": "Thiết kế CSDL cho Module Council",
            "description": "Bao gồm bảng CouncilMember và CouncilLiveScore",
            "due_date": "2026-09-15",
            "priority": "HIGH"
        })
        self.assertEqual(res_task1.status_code, status.HTTP_201_CREATED)
        task1_id = res_task1.data["task"]["id"]

        res_task2 = self.client.post("/app/supervisor/tasks/", {
            "project_id": proj.id,
            "title": "Viết Unit Tests cho API chấm điểm",
            "priority": "MEDIUM"
        })
        self.assertEqual(res_task2.status_code, status.HTTP_201_CREATED)
        task2_id = res_task2.data["task"]["id"]

        # 3. Sinh viên xem nhật ký hướng dẫn
        self.client.force_authenticate(user=self.student_user)
        res_sv_logs = self.client.get("/app/student/supervision-logs/")
        self.assertEqual(res_sv_logs.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_sv_logs.data), 1)
        self.assertEqual(res_sv_logs.data[0]["content_discussed"], "Rà soát kiến trúc cơ sở dữ liệu và API")

        # 4. Sinh viên xem danh sách Task Board & thống kê tiến độ
        res_sv_tasks = self.client.get("/app/student/tasks/")
        self.assertEqual(res_sv_tasks.status_code, status.HTTP_200_OK)
        self.assertEqual(res_sv_tasks.data["stats"]["total"], 2)
        self.assertEqual(res_sv_tasks.data["stats"]["completed"], 0)
        self.assertEqual(res_sv_tasks.data["stats"]["completion_rate"], 0.0)

        # 5. Sinh viên đánh dấu hoàn thành nhiệm vụ 1 (Mark Task as Completed)
        res_complete = self.client.patch(f"/app/student/tasks/{task1_id}/complete/", {
            "is_completed": True,
            "student_notes": "Đã tạo migration và push lên nhánh feature/council-db"
        })
        self.assertEqual(res_complete.status_code, status.HTTP_200_OK)
        self.assertTrue(res_complete.data["task"]["is_completed"])
        self.assertEqual(res_complete.data["task"]["status"], "COMPLETED")
        self.assertIsNotNone(res_complete.data["task"]["completed_at"])
        self.assertEqual(res_complete.data["stats"]["completed"], 1)
        self.assertEqual(res_complete.data["stats"]["completion_rate"], 50.0)

    def test_chair_set_defense_status_and_secretary_remind_scoring(self):
        """Test Chủ tịch điều hành Live Session & Thư ký nhắc nhở nộp điểm"""
        # Tạo thêm tài khoản Chủ tịch (CHAIR) và Thư ký (SECRETARY)
        chair_user = CustomUser.objects.create_user(
            username="gv_chair", email="chair@utc.edu.vn", password="password123",
            first_name="Chủ tịch", last_name="PGS. TS.", user_type="supervisor"
        )
        chair_sup = Supervisor.objects.create(user=chair_user, supervisor_id="GV_CHAIR")

        sec_user = CustomUser.objects.create_user(
            username="gv_sec", email="sec@utc.edu.vn", password="password123",
            first_name="Thư ký", last_name="ThS.", user_type="supervisor"
        )
        sec_sup = Supervisor.objects.create(user=sec_user, supervisor_id="GV_SEC")

        council = DefenseCouncil.objects.create(
            batch=self.batch, council_number=10, council_name="Hội đồng 10 - Bảo vệ thử nghiệm", defense_room="P502-A9"
        )

        CouncilMember.objects.create(council=council, user=chair_user, supervisor=chair_sup, role="CHAIR")
        CouncilMember.objects.create(council=council, user=sec_user, supervisor=sec_sup, role="SECRETARY")
        CouncilMember.objects.create(council=council, user=self.sup2_user, supervisor=self.sup2, role="MEMBER")

        proj = GraduationProject.objects.create(
            student=self.student,
            supervisor=self.sup1, # sup1 không thuộc hội đồng này -> cả 3 thành viên trên đều được chấm
            reviewer=self.sup2,
            council=council,
            batch=self.batch,
            topic_title_vi="Đồ án bảo vệ trực tiếp",
            status="DEFENSE_READY"
        )

        # 1. Chủ tịch chuyển trạng thái sang "Đang bảo vệ" (DEFENDING / In Progress)
        self.client.force_authenticate(user=chair_user)
        res_defense = self.client.post("/app/council/chair/set-defense-status/", {
            "project_id": proj.id,
            "defense_status": "DEFENDING"
        })
        self.assertEqual(res_defense.status_code, status.HTTP_200_OK)
        proj.refresh_from_db()
        council.refresh_from_db()
        self.assertEqual(proj.status, "DEFENDING")
        self.assertEqual(proj.defense_status, "DEFENDING")
        self.assertEqual(council.current_defending_project_id, proj.id)

        # 2. Thành viên thông thường không có quyền chuyển trạng thái buổi bảo vệ
        self.client.force_authenticate(user=self.sup2_user)
        res_denied = self.client.post("/app/council/chair/set-defense-status/", {
            "project_id": proj.id,
            "defense_status": "DEFENDED"
        })
        self.assertEqual(res_denied.status_code, status.HTTP_403_FORBIDDEN)

        # 3. Thư ký gửi nhắc nhở nộp điểm cho các thành viên chưa nộp điểm
        self.client.force_authenticate(user=sec_user)
        res_remind = self.client.post("/app/council/remind-scoring/", {
            "project_id": proj.id
        })
        self.assertEqual(res_remind.status_code, status.HTTP_200_OK)
        self.assertTrue(res_remind.data["success"])
        # Cả 3 thành viên (Chair, Sec, Member) chưa nộp -> được nhắc nhở
        self.assertEqual(res_remind.data["pending_count"], 3)
        self.assertEqual(len(res_remind.data["reminded_members"]), 3)

    def test_council_conflict_of_interest_detection_and_assignment(self):
        """Test phát hiện xung đột lợi ích (COI) khi phân công HĐ và đề tài"""
        council = DefenseCouncil.objects.create(
            batch=self.batch, council_number=1, council_name="Hội đồng 01 - CNTT", defense_room="P301-A9"
        )
        CouncilMember.objects.create(council=council, user=self.sup1_user, supervisor=self.sup1, role="CHAIR")
        CouncilMember.objects.create(council=council, user=self.sup2_user, supervisor=self.sup2, role="MEMBER")

        proj = GraduationProject.objects.create(
            student=self.student,
            supervisor=self.sup1,
            reviewer=self.sup2,
            batch=self.batch,
            topic_title_vi="Nghiên cứu kiến trúc Microservices và AI Gateway",
            status="DEFENSE_READY"
        )

        # 1. Phân công đồ án vào hội đồng có GVHD -> Phải trả về 400 và báo xung đột lợi ích
        self.client.force_authenticate(user=self.sup1_user)
        res_assign_fail = self.client.post("/app/council/assign-project/", {
            "project_id": proj.id,
            "council_id": council.id,
            "force": False
        }, format="json")
        self.assertEqual(res_assign_fail.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(res_assign_fail.data["has_conflict"])
        self.assertGreaterEqual(res_assign_fail.data["conflicts_count"], 1)
        conflict_types = [c["conflict_type"] for c in res_assign_fail.data["conflicts"]]
        self.assertIn("SUPERVISOR", conflict_types)

        # 2. Phân công cưỡng chế với force=True -> Cho phép thành công
        res_assign_force = self.client.post("/app/council/assign-project/", {
            "project_id": proj.id,
            "council_id": council.id,
            "force": True
        }, format="json")
        self.assertEqual(res_assign_force.status_code, status.HTTP_200_OK)
        self.assertTrue(res_assign_force.data["success"])
        proj.refresh_from_db()
        self.assertEqual(proj.council, council)

        # 3. Kiểm tra API query xung đột toàn hội đồng: /app/council/conflicts/
        res_conflicts = self.client.get(f"/app/council/conflicts/?council_id={council.id}")
        self.assertEqual(res_conflicts.status_code, status.HTTP_200_OK)
        self.assertTrue(res_conflicts.data["has_conflict"])
        self.assertGreaterEqual(res_conflicts.data["total_conflicts"], 1)

        # 4. Hủy phân công đề tài khỏi hội đồng
        res_unassign = self.client.post("/app/council/assign-project/", {
            "project_id": proj.id,
            "council_id": None
        }, format="json")
        self.assertEqual(res_unassign.status_code, status.HTTP_200_OK)
        proj.refresh_from_db()
        self.assertIsNone(proj.council)

    def test_global_search_api(self):
        """Test thanh tìm kiếm toàn cục (Global Search) tức thời"""
        GraduationProject.objects.create(
            student=self.student,
            supervisor=self.sup1,
            reviewer=self.sup2,
            batch=self.batch,
            topic_title_vi="Hệ thống quản lý chấm điểm ĐATN UTC",
            status="DEFENSE_READY"
        )
        self.client.force_authenticate(user=self.student_user)

        # 1. Tìm kiếm rỗng hoặc dưới 2 ký tự -> Trả về mảng rỗng
        res_empty = self.client.get("/app/global-search/?q=a")
        self.assertEqual(res_empty.status_code, status.HTTP_200_OK)
        self.assertEqual(res_empty.data["total_results"], 0)

        # 2. Tìm kiếm theo tên đề tài
        res_search_proj = self.client.get("/app/global-search/?q=chấm điểm")
        self.assertEqual(res_search_proj.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(res_search_proj.data["total_results"], 1)
        found_project = any(item["type"] == "project" and "chấm điểm" in item["title"].lower() for item in res_search_proj.data["results"])
        self.assertTrue(found_project)

        # 3. Tìm kiếm theo tên hoặc mã sinh viên
        res_search_sv = self.client.get(f"/app/global-search/?q={self.student.registration_no}")
        self.assertEqual(res_search_sv.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(res_search_sv.data["total_results"], 1)
        found_sv = any(item["type"] == "student" for item in res_search_sv.data["results"])
        self.assertTrue(found_sv)

        # 4. Lọc danh mục type=faculty
        res_search_faculty = self.client.get(f"/app/global-search/?q={self.sup1_user.last_name}&type=faculty")
        self.assertEqual(res_search_faculty.status_code, status.HTTP_200_OK)
        for item in res_search_faculty.data["results"]:
            self.assertEqual(item["type"], "faculty")

    def test_phase2_engineer_supervisor_degree_requirement(self):
        """Test quy tắc phân công CT Kỹ sư: Chỉ giảng viên học vị TS/PGS/GS mới được hướng dẫn"""
        sup_ths_user = CustomUser.objects.create_user(
            username="gv_ths_test",
            email="ths_test@utc.edu.vn",
            password="password123",
            first_name="Thạc sĩ",
            last_name="Nguyễn",
            user_type="supervisor"
        )
        sup_ths = Supervisor.objects.create(
            user=sup_ths_user,
            supervisor_id="GV_THS_01",
            academic_title="ThS",
            department_name="CNTT"
        )
        SupervisorQuota.objects.create(
            supervisor=sup_ths,
            batch=self.batch,
            viet_anh_quota=3,
            general_cntt_quota=5,
            max_total_quota=8
        )

        self.client.force_authenticate(user=self.student_user)

        # 1. SV Kỹ sư (ENGINEER) chọn GV ThS -> Phải bị từ chối với HTTP 400
        self.student.degree_program = 'ENGINEER'
        self.student.save()

        res_engineer_ths = self.client.post("/app/student/survey/", {
            "is_interning": False,
            "topic_direction": self.topic_software.id,
            "preference_1": sup_ths.id,
            "tentative_title": "Đề tài Kỹ sư"
        }, format="json")
        self.assertEqual(res_engineer_ths.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Kỹ sư", res_engineer_ths.data.get("detail", ""))

        # 2. SV Cử nhân (BACHELOR) chọn GV ThS -> Cho phép hợp lệ HTTP 200
        self.student.degree_program = 'BACHELOR'
        self.student.save()

        res_bachelor_ths = self.client.post("/app/student/survey/", {
            "is_interning": False,
            "topic_direction": self.topic_software.id,
            "preference_1": sup_ths.id,
            "tentative_title": "Đề tài Cử nhân"
        }, format="json")
        self.assertEqual(res_bachelor_ths.status_code, status.HTTP_200_OK)

        # 3. SV Kỹ sư chọn GV TS (self.sup1) -> Hợp lệ HTTP 200
        self.student.degree_program = 'ENGINEER'
        self.student.save()

        res_engineer_ts = self.client.post("/app/student/survey/", {
            "is_interning": False,
            "topic_direction": self.topic_software.id,
            "preference_1": self.sup1.id,
            "tentative_title": "Đề tài Kỹ sư với GV TS"
        }, format="json")
        self.assertEqual(res_engineer_ts.status_code, status.HTTP_200_OK)

    def test_phase2_thesis_allocation_mcmf_and_finalize(self):
        """Test thuật toán tối ưu phân bổ đề tài MCMF và chốt phân công (Allocation Finalize)"""
        admin_user = CustomUser.objects.create_user(
            username="admin_user_alloc",
            email="admin_alloc@utc.edu.vn",
            password="password123",
            user_type="admin",
            is_staff=True
        )
        self.client.force_authenticate(user=admin_user)

        # Đăng ký nguyện vọng hợp lệ cho sinh viên
        InternshipInfo.objects.update_or_create(
            student=self.student,
            defaults={
                "batch": self.batch,
                "topic_direction": self.topic_software,
                "preference_1": self.sup1,
                "preference_2": self.sup2,
                "preferred_supervisor": self.sup1,
                "secondary_criteria_note": "Mong muốn làm về web backend"
            }
        )

        # 1. Chạy thuật toán đề xuất phân công MCMF
        res_run = self.client.post("/app/allocation/run-algorithm/", {
            "batch_id": self.batch.id
        }, format="json")
        self.assertEqual(res_run.status_code, status.HTTP_200_OK)
        self.assertTrue(res_run.data["success"])
        self.assertGreaterEqual(len(res_run.data["allocations"]), 1)

        # Kiểm tra bản ghi ProposedAllocation
        proposals = ProposedAllocation.objects.filter(batch=self.batch, student=self.student)
        self.assertTrue(proposals.exists())

        # 2. Khoa chốt phân công (Finalize allocation) -> Chuyển thành GraduationProject
        res_finalize = self.client.post("/app/allocation/finalize/", {
            "batch_id": self.batch.id
        }, format="json")
        self.assertEqual(res_finalize.status_code, status.HTTP_200_OK)
        self.assertTrue(res_finalize.data["success"])
        self.assertGreaterEqual(res_finalize.data["finalized_projects_count"], 1)

        proj = GraduationProject.objects.filter(student=self.student, batch=self.batch).first()
        self.assertIsNotNone(proj)
        self.assertEqual(proj.status, 'TOPIC_DRAFT')

    def test_phase3_topic_drafting_and_confirmation(self):
        """Test quy trình bản thảo đề tài (Draft), GV xác nhận, sinh đề cương PDF và nộp bản ký"""
        proj = GraduationProject.objects.create(
            student=self.student,
            supervisor=self.sup1,
            batch=self.batch,
            topic_category=self.topic_software,
            status='TOPIC_DRAFT'
        )

        # 1. Sinh viên cập nhật bản thảo đề tài (Draft)
        self.client.force_authenticate(user=self.student_user)
        res_draft = self.client.post("/app/graduation-project/topic-draft/", {
            "project_id": proj.id,
            "topic_title_vi": "Nghiên cứu ứng dụng Microservices trong quản lý ĐATN",
            "topic_title_en": "Microservices Application in FYP Management"
        }, format="json")
        self.assertEqual(res_draft.status_code, status.HTTP_200_OK)
        proj.refresh_from_db()
        self.assertEqual(proj.topic_title_vi, "Nghiên cứu ứng dụng Microservices trong quản lý ĐATN")
        self.assertEqual(proj.status, 'TOPIC_DRAFT')

        # 2. GVHD xác nhận tên đề tài -> Trạng thái TOPIC_CONFIRMED
        self.client.force_authenticate(user=self.sup1_user)
        res_confirm = self.client.post("/app/graduation-project/confirm-topic/", {
            "project_id": proj.id,
            "topic_title_vi": "Nghiên cứu ứng dụng Microservices trong quản lý ĐATN (Chính thức)",
            "topic_title_en": "Microservices Application in FYP Management (Official)"
        }, format="json")
        self.assertEqual(res_confirm.status_code, status.HTTP_200_OK)
        proj.refresh_from_db()
        self.assertEqual(proj.status, 'TOPIC_CONFIRMED')
        self.assertIn("Chính thức", proj.topic_title_vi)

        # 3. Sinh đề cương chi tiết định dạng PDF tự động
        self.client.force_authenticate(user=self.student_user)
        res_pdf = self.client.get(f"/app/graduation-project/{proj.id}/export-outline-pdf/")
        self.assertEqual(res_pdf.status_code, status.HTTP_200_OK)
        self.assertEqual(res_pdf["Content-Type"], "application/pdf")
        self.assertGreater(len(res_pdf.content), 500)

        # 4. Sinh viên nộp file đề cương đã ký
        sample_signed_file = SimpleUploadedFile("de_cuong_da_ky.pdf", b"%PDF-1.4 test signed outline content", content_type="application/pdf")
        res_upload = self.client.post(
            f"/app/graduation-project/{proj.id}/upload-signed-outline/",
            {"signed_outline_file": sample_signed_file},
            format="multipart"
        )
        self.assertEqual(res_upload.status_code, status.HTTP_200_OK)
        proj.refresh_from_db()
        self.assertTrue(bool(proj.signed_outline_file))

    def test_phase4_academic_clearance_and_force_approve(self):
        """Test xét điều kiện học vụ: CPA < 2.0 bị loại và tính năng Force Approve của Khoa"""
        admin_user = CustomUser.objects.create_user(
            username="admin_clearance",
            email="admin_clearance@utc.edu.vn",
            password="password123",
            user_type="admin",
            is_staff=True
        )

        # Sinh viên không đủ điều kiện (CPA = 1.7 < 2.0)
        self.student.cpa = 1.7
        self.student.credits_accumulated = 90
        self.student.is_eligible_for_thesis = False
        self.student.save()

        proj = GraduationProject.objects.create(
            student=self.student,
            supervisor=self.sup1,
            batch=self.batch,
            topic_category=self.topic_software,
            topic_title_vi="Đề tài của sinh viên chưa đủ điều kiện",
            status='TOPIC_APPROVED'
        )

        self.client.force_authenticate(user=admin_user)

        # 1. Khoa quét điều kiện học vụ
        res_check = self.client.post(f"/app/graduation-project/{proj.id}/check-eligibility/", format="json")
        self.assertEqual(res_check.status_code, status.HTTP_200_OK)
        proj.refresh_from_db()
        self.assertEqual(proj.status, 'DISQUALIFIED')

        # 2. Khoa duyệt ngoại lệ (Force Approve)
        res_force = self.client.post(f"/app/graduation-project/{proj.id}/force-approve/", {
            "reason": "Ban Chủ nhiệm Khoa đặc cách cho phép làm đồ án có điều kiện"
        }, format="json")
        self.assertEqual(res_force.status_code, status.HTTP_200_OK)
        self.assertTrue(res_force.data["success"])

        proj.refresh_from_db()
        self.assertTrue(proj.is_force_approved)
        self.assertEqual(proj.status, 'IN_PROGRESS')

    def test_phase5_task_deliverable_and_review(self):
        """Test sinh viên nộp sản phẩm nhiệm vụ và GV review: Đạt hoặc Yêu cầu sửa lại"""
        proj = GraduationProject.objects.create(
            student=self.student,
            supervisor=self.sup1,
            batch=self.batch,
            topic_category=self.topic_software,
            topic_title_vi="Hệ thống chấm thi trực tuyến",
            status='IN_PROGRESS'
        )

        task = SupervisionTask.objects.create(
            project=proj,
            assigned_by=self.sup1,
            title="Xây dựng API xác thực người dùng JWT",
            description="Cài đặt refresh token và middleware phân quyền",
            priority="HIGH",
            status="TODO"
        )

        # 1. Sinh viên nộp sản phẩm kết quả (URL & ghi chú)
        self.client.force_authenticate(user=self.student_user)
        res_submit = self.client.post(f"/app/student/tasks/{task.id}/submit-deliverable/", {
            "deliverable_url": "https://github.com/utc/jwt-auth/pull/1",
            "student_notes": "Em đã hoàn thành các test case xác thực và gán role"
        }, format="json")
        self.assertEqual(res_submit.status_code, status.HTTP_200_OK)
        task.refresh_from_db()
        self.assertEqual(task.review_verdict, 'PENDING')
        self.assertEqual(task.status, 'IN_PROGRESS')
        self.assertEqual(task.deliverable_url, "https://github.com/utc/jwt-auth/pull/1")

        # 2. GV đánh giá: Yêu cầu sửa lại (REVISION_REQUIRED)
        self.client.force_authenticate(user=self.sup1_user)
        res_review_rev = self.client.post(f"/app/supervisor/tasks/{task.id}/review/", {
            "verdict": "REVISION_REQUIRED",
            "supervisor_notes": "Cần bổ sung kiểm tra hết hạn của Refresh Token"
        }, format="json")
        self.assertEqual(res_review_rev.status_code, status.HTTP_200_OK)
        task.refresh_from_db()
        self.assertEqual(task.review_verdict, 'REVISION_REQUIRED')
        self.assertFalse(task.is_completed)

        # 3. GV đánh giá: Đạt yêu cầu (ACCEPTED)
        res_review_acc = self.client.post(f"/app/supervisor/tasks/{task.id}/review/", {
            "verdict": "ACCEPTED",
            "supervisor_notes": "Đã sửa hoàn thiện, code sạch"
        }, format="json")
        self.assertEqual(res_review_acc.status_code, status.HTTP_200_OK)
        task.refresh_from_db()
        self.assertEqual(task.review_verdict, 'ACCEPTED')
        self.assertTrue(task.is_completed)

    def test_phase6_council_structure_1ct_2tk_2uv_and_minutes_pdf(self):
        """Test cơ cấu hội đồng bảo vệ chuẩn UTC (1CT-2TK-2UV) và xuất biên bản PDF"""
        council = DefenseCouncil.objects.create(
            batch=self.batch,
            council_number=99,
            council_name="Hội đồng Bảo vệ CNTT Số 99",
            defense_room="502-A9",
            session_time="MORNING"
        )

        # Tạo 5 thành viên chuẩn UTC (1CT - 2TK - 2UV)
        members_data = [
            ("CHAIR", "Hội đồng Chủ tịch", "gv_ct", "TS"),
            ("SECRETARY", "Thư ký 1", "gv_tk1", "ThS"),
            ("SECRETARY", "Thư ký 2", "gv_tk2", "ThS"),
            ("MEMBER", "Ủy viên 1", "gv_uv1", "TS"),
            ("MEMBER", "Ủy viên 2", "gv_uv2", "TS"),
        ]

        for role, name, uname, title in members_data:
            u = CustomUser.objects.create_user(username=uname, email=f"{uname}@utc.edu.vn", password="pw", user_type="supervisor")
            sup = Supervisor.objects.create(user=u, supervisor_id=uname.upper(), academic_title=title, department_name="CNTT")
            CouncilMember.objects.create(council=council, supervisor=sup, user=u, role=role)

        # Kiểm tra cơ cấu qua Service
        validation = CouncilStructureService.validate_utc_council_structure(council)
        self.assertTrue(validation["is_valid"])
        self.assertEqual(validation["chairs_count"], 1)
        self.assertEqual(validation["secretaries_count"], 2)
        self.assertEqual(validation["members_count"], 2)

        # Test xuất biên bản PDF của hội đồng
        admin_user = CustomUser.objects.create_user(
            username="admin_minutes",
            email="admin_minutes@utc.edu.vn",
            password="password123",
            user_type="admin",
            is_staff=True
        )
        self.client.force_authenticate(user=admin_user)
        res_minutes = self.client.get(f"/app/council/{council.id}/export-minutes-pdf/")
        self.assertEqual(res_minutes.status_code, status.HTTP_200_OK)
        self.assertEqual(res_minutes["Content-Type"], "application/pdf")
        self.assertGreater(len(res_minutes.content), 500)

    def test_deferral_branch_workflow(self):
        """Test nhánh Bảo lưu đồ án tốt nghiệp: SV nộp đơn và theo dõi trạng thái"""
        GraduationProject.objects.create(
            student=self.student,
            supervisor=self.sup1,
            batch=self.batch,
            topic_category=self.topic_software,
            topic_title_vi="Đề tài xin bảo lưu",
            status="DISQUALIFIED"
        )
        self.client.force_authenticate(user=self.student_user)

        # 1. Sinh viên nộp đơn xin bảo lưu
        res_defer = self.client.post("/app/student/deferral-request/", {
            "reason_category": "ACADEMIC",
            "reason_details": "Em bị thiếu 2 tín chỉ Tiếng Anh chuyên ngành nên xin bảo lưu kết quả sang đợt sau."
        }, format="json")
        self.assertIn(res_defer.status_code, [status.HTTP_200_OK, status.HTTP_201_CREATED])
        self.assertTrue(res_defer.data["success"])

        # 2. Sinh viên xem danh sách đơn bảo lưu
        res_list = self.client.get("/app/student/deferral-request/")
        self.assertEqual(res_list.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(res_list.data), 1)
        self.assertIn("Tiếng Anh", res_list.data[0]["reason"])
        self.assertEqual(res_list.data[0]["status"], "PENDING")

