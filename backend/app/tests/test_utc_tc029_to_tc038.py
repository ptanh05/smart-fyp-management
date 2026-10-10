import io
from datetime import timedelta
from django.utils import timezone
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APITestCase, APIClient
from rest_framework import status

from app.models import (
    CustomUser,
    Student,
    Supervisor,
    SupervisorQuota,
    ProjectTopicArea,
    GraduationProject,
    ProposedAllocation,
    SupervisionTask,
    ThesisDeferralRequest,
    DefenseCouncil,
    CouncilMember,
    CouncilLiveScore,
    EvaluationPolicy,
    AcademicBatch,
    CourseClass
)

class TC029toTC038GraduationSystemTests(APITestCase):
    client: APIClient

    def setUp(self):
        super().setUp()
        self.client = APIClient()

        # 1. Batch & Policy
        self.batch = AcademicBatch.objects.create(
            batch_code="2026_2027_HK1",
            batch_name="Đợt ĐATN K60-K63",
            is_active=True
        )
        self.policy = EvaluationPolicy.objects.create(
            batch=self.batch,
            weight_supervisor=0.4,
            weight_reviewer=0.2,
            weight_council=0.4
        )

        # 2. Topic Area
        self.topic_area = ProjectTopicArea.objects.create(
            name="Hệ thống thông tin và Web",
            code="WEB_IS",
            is_active=True
        )

        # 3. Course Class
        self.course_class = CourseClass.objects.create(
            batch=self.batch,
            class_code="CNTT.K62.01",
            class_name="Kỹ sư CNTT K62",
            program_type="DAI_TRA"
        )

        # 4. Admin User
        self.admin_user = CustomUser.objects.create_user(
            username="admin_dean",
            email="admin_dean@utc.edu.vn",
            password="password123",
            first_name="Ban",
            last_name="Chủ Nhiệm",
            user_type="admin",
            is_staff=True,
            is_superuser=True
        )

        # 5. Supervisors
        self.sup1_user = CustomUser.objects.create_user(
            username="gv_an",
            email="an@utc.edu.vn",
            password="password123",
            first_name="An",
            last_name="Nguyễn Văn",
            user_type="supervisor"
        )
        self.sup1 = Supervisor.objects.create(
            user=self.sup1_user,
            supervisor_id="GV001",
            academic_title="TS",
            department_name="CNPM"
        )
        self.quota1 = SupervisorQuota.objects.create(
            supervisor=self.sup1,
            batch=self.batch,
            viet_anh_quota=2,
            general_cntt_quota=3,
            max_total_quota=5
        )

        self.sup2_user = CustomUser.objects.create_user(
            username="gv_binh",
            email="binh@utc.edu.vn",
            password="password123",
            first_name="Bình",
            last_name="Trần Văn",
            user_type="supervisor"
        )
        self.sup2 = Supervisor.objects.create(
            user=self.sup2_user,
            supervisor_id="GV002",
            academic_title="PGS.TS",
            department_name="KHMT"
        )

        # 6. Student
        self.student_user = CustomUser.objects.create_user(
            username="201200001",
            email="201200001@lms.utc.edu.vn",
            password="password123",
            first_name="Cường",
            last_name="Lê Văn",
            user_type="student"
        )
        self.student = Student.objects.create(
            user=self.student_user,
            registration_no="201200001",
            department="CNTT K62",
            degree_program="ENGINEER",
            academic_batch=self.batch,
            course_class=self.course_class
        )

        # 7. Project
        self.project = GraduationProject.objects.create(
            student=self.student,
            supervisor=self.sup1,
            topic_category=self.topic_area,
            batch=self.batch,
            topic_title_vi="Xây dựng hệ thống quản lý đồ án tốt nghiệp",
            topic_title_en="Smart Graduation Project Management System",
            status="PENDING_REVIEW"
        )

    # --------------------------------------------------------------------------
    # TC-029: Auth & Security - Student cannot call admin-approve-topic
    # --------------------------------------------------------------------------
    def test_tc029_student_cannot_admin_approve_topic(self):
        """TC-029: Sinh viên gọi API duyệt đề tài -> 403 Forbidden"""
        self.client.force_authenticate(user=self.student_user)
        res = self.client.post("/app/graduation-project/admin-approve-topic/", {
            "project_id": self.project.id,
            "decision": "APPROVED"
        })
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("Sinh viên không có quyền", res.data.get("detail", ""))

        # Supervisor (non-staff) also forbidden
        self.client.force_authenticate(user=self.sup1_user)
        res_sup = self.client.post("/app/graduation-project/admin-approve-topic/", {
            "project_id": self.project.id,
            "decision": "APPROVED"
        })
        self.assertEqual(res_sup.status_code, status.HTTP_403_FORBIDDEN)

        # Admin allowed
        self.client.force_authenticate(user=self.admin_user)
        res_admin = self.client.post("/app/graduation-project/admin-approve-topic/", {
            "project_id": self.project.id,
            "decision": "APPROVED"
        })
        self.assertEqual(res_admin.status_code, status.HTTP_200_OK)
        self.project.refresh_from_db()
        self.assertEqual(self.project.status, "TOPIC_APPROVED")

    # --------------------------------------------------------------------------
    # TC-030: Topic Re-Submit updates status to PENDING_REVIEW
    # --------------------------------------------------------------------------
    def test_tc030_topic_resubmit_updates_status_to_pending_review(self):
        """TC-030: Chỉnh sửa và nộp lại đề tài sau khi bị từ chối/yêu cầu sửa -> PENDING_REVIEW"""
        self.project.status = "TOPIC_REVISION"
        self.project.save(update_fields=["status"])

        self.client.force_authenticate(user=self.student_user)
        res = self.client.post("/app/graduation-project/re-submit/", {
            "project_id": self.project.id,
            "topic_title_vi": "Xây dựng hệ thống quản lý đồ án tốt nghiệp UTC cập nhật",
            "topic_title_en": "Updated UTC FYP System",
            "description": "Nội dung đã được chỉnh sửa theo góp ý của Khoa"
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.project.refresh_from_db()
        self.assertEqual(self.project.status, "PENDING_REVIEW")
        self.assertEqual(self.project.topic_title_vi, "Xây dựng hệ thống quản lý đồ án tốt nghiệp UTC cập nhật")

    # --------------------------------------------------------------------------
    # TC-031: Late Task Submission sets is_late flag
    # --------------------------------------------------------------------------
    def test_tc031_late_task_submission_sets_is_late_flag(self):
        """TC-031: SV submit task quá deadline -> Ghi nhận is_late = True, Late Submit"""
        past_date = (timezone.now() - timedelta(days=5)).date()
        task = SupervisionTask.objects.create(
            project=self.project,
            assigned_by=self.sup1,
            title="Thiết kế cơ sở dữ liệu",
            due_date=past_date,
            status="NOT_STARTED"
        )

        dummy_file = SimpleUploadedFile(
            "report.pdf",
            b"%PDF-1.4 dummy pdf content",
            content_type="application/pdf"
        )

        self.client.force_authenticate(user=self.student_user)
        res = self.client.post(
            f"/app/student/tasks/{task.id}/submit-deliverable/",
            {
                "deliverable_file": dummy_file,
                "student_notes": "Em nộp bổ sung muộn ạ"
            },
            format="multipart"
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        task.refresh_from_db()
        self.assertTrue(task.is_late)
        self.assertIsNotNone(task.submitted_at)

        # Test strict mode: block late submission
        task_strict = SupervisionTask.objects.create(
            project=self.project,
            assigned_by=self.sup1,
            title="Hoàn thiện prototype",
            due_date=past_date,
            status="NOT_STARTED"
        )
        dummy_file2 = SimpleUploadedFile("proto.zip", b"PK dummy zip", content_type="application/zip")
        res_strict = self.client.post(
            f"/app/student/tasks/{task_strict.id}/submit-deliverable/",
            {
                "deliverable_file": dummy_file2,
                "strict": "true"
            },
            format="multipart"
        )
        self.assertEqual(res_strict.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res_strict.data.get("error"), "deadline_exceeded")
        self.assertTrue(res_strict.data.get("is_late"))

    # --------------------------------------------------------------------------
    # TC-032: Academic Grades Import validation & row errors
    # --------------------------------------------------------------------------
    def test_tc032_academic_grades_import_validation(self):
        """TC-032: Giáo vụ import file điểm Excel sai định dạng / sai dòng báo lỗi chi tiết"""
        self.client.force_authenticate(user=self.admin_user)

        # 1. Missing required headers
        csv_missing_header = "ho_ten,email\nTran Van A,a@utc.edu.vn"
        file_missing = SimpleUploadedFile("grades.csv", csv_missing_header.encode("utf-8"), content_type="text/csv")
        res_missing = self.client.post("/app/academic/grades/import/", {"file": file_missing}, format="multipart")
        self.assertEqual(res_missing.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res_missing.data.get("error"), "invalid_header")
        self.assertTrue(len(res_missing.data.get("missing_columns", [])) > 0)

        # 2. Row errors (invalid CPA > 4.0, negative credits, unknown student)
        import openpyxl
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.append(["MSSV", "CPA", "Tín chỉ tích lũy", "Nợ tín chỉ"])
        ws.append(["201200001", 5.5, 120, 0])     # CPA > 4.0
        ws.append(["201299999", 3.2, 110, 4])     # MSSV not in system
        ws.append(["201200001", 3.0, -10, 0])     # negative credits

        bio = io.BytesIO()
        wb.save(bio)
        bio.seek(0)
        file_row_err = SimpleUploadedFile("grades_err.xlsx", bio.getvalue(), content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

        res_row_err = self.client.post("/app/academic/grades/import/", {"file": file_row_err}, format="multipart")
        self.assertEqual(res_row_err.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res_row_err.data.get("error"), "invalid_rows_data")
        self.assertTrue(len(res_row_err.data.get("row_errors", [])) >= 3)

        # 3. Valid import
        wb_valid = openpyxl.Workbook()
        ws_valid = wb_valid.active
        ws_valid.append(["MSSV", "CPA", "Tín chỉ tích lũy", "Nợ tín chỉ"])
        ws_valid.append(["201200001", 3.45, 135, 2])

        bio_valid = io.BytesIO()
        wb_valid.save(bio_valid)
        bio_valid.seek(0)
        file_valid = SimpleUploadedFile("grades_valid.xlsx", bio_valid.getvalue(), content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

        res_valid = self.client.post("/app/academic/grades/import/", {"file": file_valid}, format="multipart")
        self.assertEqual(res_valid.status_code, status.HTTP_200_OK)
        self.assertEqual(res_valid.data.get("total_updated"), 1)

        self.student.refresh_from_db()
        self.assertAlmostEqual(float(self.student.cpa), 3.45)
        self.assertEqual(self.student.credits_accumulated, 135)

    # --------------------------------------------------------------------------
    # TC-033: Council Finalize Scores requires 5/5 members
    # --------------------------------------------------------------------------
    def test_tc033_council_finalize_scores_requires_all_members(self):
        """TC-033: Bắt buộc 5/5 người chấm mới cho phép chốt điểm Hội đồng"""
        council = DefenseCouncil.objects.create(
            batch=self.batch,
            council_number=1,
            council_name="Hội đồng Bảo vệ CNTT 01",
            defense_room="P.301"
        )
        self.project.council = council
        self.project.save(update_fields=["council"])

        # Create 5 council members
        members = []
        roles = ["CHAIR", "SECRETARY", "REVIEWER", "MEMBER", "MEMBER"]
        for idx in range(5):
            u = CustomUser.objects.create_user(
                username=f"council_member_{idx}",
                email=f"council_{idx}@utc.edu.vn",
                password="password123",
                first_name=f"GV_{idx}",
                last_name="Hội Đồng",
                user_type="supervisor"
            )
            sup = Supervisor.objects.create(
                user=u,
                supervisor_id=f"CM00{idx}",
                academic_title="TS"
            )
            cm = CouncilMember.objects.create(
                council=council,
                supervisor=sup,
                user=u,
                role=roles[idx]
            )
            members.append(cm)

        # 4 out of 5 members grade
        for idx in range(4):
            CouncilLiveScore.objects.create(
                council=council,
                project=self.project,
                member=members[idx],
                score_presentation=3.0,
                score_content=3.0,
                score_qa=2.0,
                score_demo=1.5,
                total_score=9.5
            )

        # Attempt to finalize with only 4/5 scored
        chair_user = members[0].user
        self.client.force_authenticate(user=chair_user)
        res_fail = self.client.post(f"/app/council/{council.id}/finalize-scores/")
        self.assertEqual(res_fail.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Bắt buộc 5/5 người chấm mới cho phép chốt", res_fail.data.get("detail", ""))

        # 5th member grades
        CouncilLiveScore.objects.create(
            council=council,
            project=self.project,
            member=members[4],
            score_presentation=2.8,
            score_content=3.0,
            score_qa=1.8,
            score_demo=1.6,
            total_score=9.2
        )

        # Finalize now succeeds
        res_success = self.client.post(f"/app/council/{council.id}/finalize-scores/")
        self.assertEqual(res_success.status_code, status.HTTP_200_OK)
        council.refresh_from_db()
        self.assertTrue(council.is_locked)

    # --------------------------------------------------------------------------
    # TC-034: Supervisor forbidden to score own student in council
    # --------------------------------------------------------------------------
    def test_tc034_supervisor_forbidden_to_score_own_student_in_council(self):
        """TC-034: GVHD tìm cách chấm điểm cho chính SV của mình trong HĐ -> 403 Forbidden"""
        council = DefenseCouncil.objects.create(
            batch=self.batch,
            council_number=2,
            council_name="Hội đồng Bảo vệ CNTT 02",
            defense_room="P.302"
        )
        self.project.council = council
        self.project.save(update_fields=["council"])

        # Member is sup1 (who is self.project.supervisor)
        cm_sup1 = CouncilMember.objects.create(
            council=council,
            supervisor=self.sup1,
            user=self.sup1_user,
            role="MEMBER"
        )

        self.client.force_authenticate(user=self.sup1_user)
        res = self.client.post("/app/council/submit-score/", {
            "project_id": self.project.id,
            "score_presentation": 3.0,
            "score_content": 3.0,
            "score_qa": 2.0,
            "score_demo": 1.5
        })
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("Vi phạm quy chế", res.data.get("detail", ""))

    # --------------------------------------------------------------------------
    # TC-035: Academic Deferral Request flow (Bảo lưu)
    # --------------------------------------------------------------------------
    def test_tc035_student_deferral_request_and_review(self):
        """TC-035: Luồng nộp đơn xin bảo lưu và phê duyệt của Khoa"""
        self.client.force_authenticate(user=self.student_user)
        res_req = self.client.post("/app/student/deferral-request/", {
            "reason": "Em bị ốm phải nằm viện điều trị",
            "medical_condition": True,
            "financial_difficulty": False
        })
        self.assertEqual(res_req.status_code, status.HTTP_201_CREATED)
        deferral_id = res_req.data.get("deferral", {}).get("id")

        # Admin approves
        self.client.force_authenticate(user=self.admin_user)
        res_review = self.client.post(f"/app/admin/deferral-request/{deferral_id}/review/", {
            "decision": "APPROVED",
            "admin_notes": "Đồng ý bảo lưu sang học kỳ tiếp theo"
        })
        self.assertEqual(res_review.status_code, status.HTTP_200_OK)
        deferral = ThesisDeferralRequest.objects.get(id=deferral_id)
        self.assertEqual(deferral.status, "APPROVED")

    # --------------------------------------------------------------------------
    # TC-036: Defense schedule conflict check (Conflict Schedule)
    # --------------------------------------------------------------------------
    def test_tc036_defense_schedule_conflict_detection(self):
        """TC-036: Xếp lịch cho 1 GV phản biện bị trùng giờ trong 2 HĐ -> Báo lỗi xung đột lịch"""
        # Council 1 scheduled on Dec 1st Morning
        council1 = DefenseCouncil.objects.create(
            batch=self.batch,
            council_number=10,
            council_name="Hội đồng 10",
            session_date="2026-12-01",
            session_time="MORNING",
            defense_room="P.501"
        )
        CouncilMember.objects.create(
            council=council1,
            supervisor=self.sup2,
            user=self.sup2_user,
            role="REVIEWER"
        )

        # Council 2
        council2 = DefenseCouncil.objects.create(
            batch=self.batch,
            council_number=11,
            council_name="Hội đồng 11"
        )
        CouncilMember.objects.create(
            council=council2,
            supervisor=self.sup2,
            user=self.sup2_user,
            role="MEMBER"
        )

        self.client.force_authenticate(user=self.admin_user)
        res_conflict = self.client.post("/app/council/schedule/", {
            "council_id": council2.id,
            "session_date": "2026-12-01",
            "session_time": "MORNING",
            "defense_room": "P.502"
        })
        self.assertEqual(res_conflict.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Conflict Schedule", res_conflict.data.get("detail", ""))
        self.assertTrue(len(res_conflict.data.get("conflicts", [])) > 0)

    # --------------------------------------------------------------------------
    # TC-037: Admin Force Assign / Override Allocation when quota exceeded
    # --------------------------------------------------------------------------
    def test_tc037_admin_force_assign_override_quota(self):
        """TC-037: Admin cố tình gán 1 SV cho GV đã đầy slot -> Cảnh báo kèm cho phép override"""
        # sup1 has quota max_total_quota = 5
        # Create 5 existing allocations for sup1
        for i in range(5):
            u = CustomUser.objects.create_user(
                username=f"st_extra_{i}",
                email=f"st_{i}@utc.edu.vn",
                password="password123",
                user_type="student"
            )
            st = Student.objects.create(
                user=u,
                registration_no=f"20120999{i}",
                academic_batch=self.batch,
                degree_program="ENGINEER"
            )
            ProposedAllocation.objects.create(
                student=st,
                supervisor=self.sup1,
                batch=self.batch,
                is_overridden=False
            )

        # Another student to assign to sup1
        st_new_user = CustomUser.objects.create_user(
            username="st_new",
            email="st_new@utc.edu.vn",
            password="password123",
            user_type="student"
        )
        st_new = Student.objects.create(
            user=st_new_user,
            registration_no="201208888",
            academic_batch=self.batch,
            degree_program="ENGINEER"
        )
        alloc = ProposedAllocation.objects.create(
            student=st_new,
            supervisor=self.sup2,
            batch=self.batch
        )

        self.client.force_authenticate(user=self.admin_user)

        # 1. Without force -> 400 Bad Request with is_quota_exceeded=True and can_override=True
        res_warning = self.client.post("/app/graduation-project/allocation/override/", {
            "allocation_id": alloc.id,
            "supervisor_id": self.sup1.id
        })
        self.assertEqual(res_warning.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(res_warning.data.get("is_quota_exceeded"))
        self.assertTrue(res_warning.data.get("can_override"))

        # 2. With force=True -> 200 OK override succeeds
        res_override = self.client.post("/app/graduation-project/allocation/override/", {
            "allocation_id": alloc.id,
            "supervisor_id": self.sup1.id,
            "force": True
        })
        self.assertEqual(res_override.status_code, status.HTTP_200_OK)
        alloc.refresh_from_db()
        self.assertEqual(alloc.supervisor, self.sup1)
        self.assertTrue(alloc.is_overridden)

    # --------------------------------------------------------------------------
    # TC-038: Student cannot access Council Minutes Export PDF & Final Grades
    # --------------------------------------------------------------------------
    def test_tc038_student_forbidden_to_export_council_minutes_pdf(self):
        """TC-038: SV truy cập link Export PDF Biên bản / Excel điểm -> 403 Forbidden"""
        council = DefenseCouncil.objects.create(
            batch=self.batch,
            council_number=30,
            council_name="Hội đồng 30",
            defense_room="P.303"
        )

        # 1. Student calls PDF export -> 403 Forbidden
        self.client.force_authenticate(user=self.student_user)
        res_pdf = self.client.get(f"/app/council/{council.id}/export-minutes-pdf/")
        self.assertEqual(res_pdf.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("Sinh viên không có quyền", res_pdf.data.get("detail", ""))

        # 2. Student calls Excel final grades export -> 403 Forbidden
        res_excel = self.client.get(f"/app/batch/{self.batch.id}/export-final-grades-excel/")
        self.assertEqual(res_excel.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("Sinh viên không có quyền", res_excel.data.get("detail", ""))

        # 3. Admin calls PDF export -> 200 OK
        self.client.force_authenticate(user=self.admin_user)
        res_admin_pdf = self.client.get(f"/app/council/{council.id}/export-minutes-pdf/")
        self.assertEqual(res_admin_pdf.status_code, status.HTTP_200_OK)
        self.assertEqual(res_admin_pdf["Content-Type"], "application/pdf")

    # --------------------------------------------------------------------------
    # FLOW_14: Khoa ấn từ chối nhưng để trống lý do -> Validate 400 Bad Request
    # --------------------------------------------------------------------------
    def test_flow14_admin_reject_topic_without_notes_fails_400(self):
        """FLOW_14: Khoa từ chối đề tài nhưng để trống ô lý do -> Bắt buộc 400 Bad Request"""
        self.client.force_authenticate(user=self.admin_user)

        # 1. Reject without notes -> 400 Bad Request
        res_fail = self.client.post("/app/graduation-project/admin-approve-topic/", {
            "project_id": self.project.id,
            "decision": "REJECTED",
            "notes": "   "
        })
        self.assertEqual(res_fail.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res_fail.data.get("error"), "rejection_reason_required")
        self.assertIn("Không thể từ chối đề tài khi để trống lý do", res_fail.data.get("message", ""))

        # 2. Reject with notes -> 200 OK and status updated to TOPIC_REVISION
        res_ok = self.client.post("/app/graduation-project/admin-approve-topic/", {
            "project_id": self.project.id,
            "decision": "REJECTED",
            "notes": "Cần làm rõ phạm vi nghiên cứu và công nghệ sử dụng"
        })
        self.assertEqual(res_ok.status_code, status.HTTP_200_OK)
        self.project.refresh_from_db()
        self.assertEqual(self.project.status, "TOPIC_REVISION")

    # --------------------------------------------------------------------------
    # TC_034: Hai Admin duyệt cùng 1 đề tài cùng lúc -> DB Row Lock & Concurrency
    # --------------------------------------------------------------------------
    def test_tc034_concurrency_lock_on_admin_approve_topic(self):
        """TC_034: Hai Admin duyệt đề tài đồng thời -> Có Row lock select_for_update an toàn"""
        self.client.force_authenticate(user=self.admin_user)
        res1 = self.client.post("/app/graduation-project/admin-approve-topic/", {
            "project_id": self.project.id,
            "decision": "APPROVED"
        })
        self.assertEqual(res1.status_code, status.HTTP_200_OK)

        # Admin 2 gửi tiếp yêu cầu sửa
        res2 = self.client.post("/app/graduation-project/admin-approve-topic/", {
            "project_id": self.project.id,
            "decision": "REVISION",
            "notes": "Admin 2 cập nhật yêu cầu chỉnh sửa"
        })
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.project.refresh_from_db()
        self.assertEqual(self.project.status, "TOPIC_REVISION")

    # --------------------------------------------------------------------------
    # FLOW_15: Asynchronous notification / email sending avoids timeout 504
    # --------------------------------------------------------------------------
    def test_flow15_admin_approve_topic_async_email(self):
        """FLOW_15: Gửi email khi duyệt đề tài chạy bất đồng bộ để tránh treo timeout 504"""
        self.client.force_authenticate(user=self.admin_user)
        import time
        start_t = time.time()
        res = self.client.post("/app/graduation-project/admin-approve-topic/", {
            "project_id": self.project.id,
            "decision": "APPROVED"
        })
        duration = time.time() - start_t
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertLess(duration, 1.5)  # API responds quickly without waiting for slow SMTP

    # --------------------------------------------------------------------------
    # FLOW_23: Student task deliverable submit blocks disguised .exe files
    # --------------------------------------------------------------------------
    def test_flow23_task_deliverable_blocks_disguised_exe_file(self):
        """FLOW_23: SV upload file kết quả giả mạo .exe thay vì .zip/.pdf -> Chặn bằng Magic Bytes"""
        task = SupervisionTask.objects.create(
            project=self.project,
            assigned_by=self.sup1,
            title="Nộp báo cáo thử nghiệm",
            due_date=timezone.now().date() + timedelta(days=7),
            status="NOT_STARTED"
        )

        self.client.force_authenticate(user=self.student_user)

        # 1. File có đuôi .pdf nhưng ruột là header MZ (DOS/PE Executable)
        disguised_exe_in_pdf = SimpleUploadedFile(
            "report.pdf",
            b"MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff\x00\x00This is a fake windows binary payload",
            content_type="application/pdf"
        )
        res_disguised = self.client.post(
            f"/app/student/tasks/{task.id}/submit-deliverable/",
            {"deliverable_file": disguised_exe_in_pdf},
            format="multipart"
        )
        self.assertEqual(res_disguised.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res_disguised.data.get("error"), "malicious_executable_detected")

        # 2. File có đuôi .zip nhưng ruột là header MZ
        disguised_exe_in_zip = SimpleUploadedFile(
            "source_code.zip",
            b"MZ\x90\x00fake_zip_binary",
            content_type="application/zip"
        )
        res_disguised_zip = self.client.post(
            f"/app/student/tasks/{task.id}/submit-deliverable/",
            {"deliverable_file": disguised_exe_in_zip},
            format="multipart"
        )
        self.assertEqual(res_disguised_zip.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res_disguised_zip.data.get("error"), "malicious_executable_detected")

        # 3. File có đuôi .exe trực tiếp
        direct_exe = SimpleUploadedFile(
            "setup.exe",
            b"MZ\x90\x00direct_exe",
            content_type="application/x-msdownload"
        )
        res_direct_exe = self.client.post(
            f"/app/student/tasks/{task.id}/submit-deliverable/",
            {"deliverable_file": direct_exe},
            format="multipart"
        )
        self.assertEqual(res_direct_exe.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn(res_direct_exe.data.get("error"), ["executable_file_forbidden", "executable_mime_forbidden"])

        # 4. File PDF chuẩn hợp lệ -> 200 OK
        valid_pdf = SimpleUploadedFile(
            "report_clean.pdf",
            b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF",
            content_type="application/pdf"
        )
        res_valid = self.client.post(
            f"/app/student/tasks/{task.id}/submit-deliverable/",
            {"deliverable_file": valid_pdf},
            format="multipart"
        )
        self.assertEqual(res_valid.status_code, status.HTTP_200_OK)

    # --------------------------------------------------------------------------
    # FLOW_24: Deferral request approved by Khoa updates project status to DEFERRED
    # --------------------------------------------------------------------------
    def test_flow24_deferral_request_admin_review_updates_project_to_deferred(self):
        """FLOW_24: SV xin bảo lưu -> Khoa duyệt bảo lưu -> CSDL chuyển sang DEFERRED"""
        # SV gửi đơn xin bảo lưu
        self.client.force_authenticate(user=self.student_user)
        res_submit = self.client.post("/app/student/deferral-request/", {
            "reason_category": "ACADEMIC",
            "reason_details": "Em xin bảo lưu kết quả đồ án do chưa hoàn thành chứng chỉ ngoại ngữ."
        })
        self.assertEqual(res_submit.status_code, status.HTTP_201_CREATED)
        deferral_id = res_submit.data["deferral"]["id"]

        # Khoa lấy danh sách đơn bảo lưu
        self.client.force_authenticate(user=self.admin_user)
        res_list = self.client.get("/app/admin/deferral-request/list/")
        self.assertEqual(res_list.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(res_list.data), 1)

        # Khoa duyệt đơn bảo lưu -> APPROVED -> CSDL chuyển thành DEFERRED
        res_review = self.client.post(f"/app/admin/deferral-request/{deferral_id}/review/", {
            "decision": "APPROVED",
            "admin_notes": "Khoa chấp thuận bảo lưu đồ án 1 học kỳ theo đơn."
        })
        self.assertEqual(res_review.status_code, status.HTTP_200_OK)
        self.project.refresh_from_db()
        self.assertEqual(self.project.status, "DEFERRED")
        self.assertEqual(res_review.data["deferral"]["status"], "APPROVED")

    # --------------------------------------------------------------------------
    # FLOW_33: Council Minutes PDF Export requires 100% scores (blocks when 4/5)
    # --------------------------------------------------------------------------
    def test_flow33_council_minutes_pdf_export_blocks_when_not_100_percent_scores(self):
        """FLOW_33: Hội đồng mới có 4/5 người chấm -> Bị chặn 400 Bad Request; Đủ 5/5 -> Cho phép xuất PDF"""
        council = DefenseCouncil.objects.create(
            batch=self.batch,
            council_number=88,
            council_name="Hội đồng Bảo vệ 88",
            defense_room="P.501"
        )
        self.project.council = council
        self.project.save(update_fields=["council"])

        # Tạo 5 thành viên hội đồng
        members = []
        roles = ["CHAIR", "SECRETARY", "MEMBER", "MEMBER", "EXTERNAL_MEMBER"]
        for i, role in enumerate(roles):
            u = CustomUser.objects.create_user(
                username=f"flow33_mem_{i}",
                password="password123",
                user_type="supervisor",
                email=f"mem{i}@utc.edu.vn"
            )
            m = CouncilMember.objects.create(council=council, user=u, role=role)
            members.append(m)

        # 4/5 thành viên nhập điểm (chưa đủ 100%)
        for i in range(4):
            CouncilLiveScore.objects.create(
                council=council,
                project=self.project,
                member=members[i],
                score_presentation=2.0,
                score_content=2.0,
                score_qa=2.0,
                score_demo=2.0
            )

        # Khoa bấm xuất PDF khi mới có 4/5 người chấm -> Chặn 400 Bad Request
        self.client.force_authenticate(user=self.admin_user)
        res_blocked = self.client.get(f"/app/council/{council.id}/export-minutes-pdf/")
        self.assertEqual(res_blocked.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res_blocked.data.get("error"), "incomplete_council_scores")
        self.assertIn("Hội đồng chưa hoàn thành chấm điểm", res_blocked.data.get("detail", ""))

        # Thành viên thứ 5 (100%) nhập điểm
        CouncilLiveScore.objects.create(
            council=council,
            project=self.project,
            member=members[4],
            score_presentation=2.5,
            score_content=2.0,
            score_qa=2.0,
            score_demo=2.0
        )

        # Xuất lại PDF khi đã đủ 5/5 (100%) -> 200 OK
        res_ok = self.client.get(f"/app/council/{council.id}/export-minutes-pdf/")
        self.assertEqual(res_ok.status_code, status.HTTP_200_OK)
        self.assertEqual(res_ok["Content-Type"], "application/pdf")
        self.assertGreater(len(res_ok.content), 500)

