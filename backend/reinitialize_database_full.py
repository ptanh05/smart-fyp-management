import os
import sys
import django

# Set encoding
if sys.platform.startswith("win"):
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")
django.setup()

from datetime import date, timedelta
from django.utils import timezone
from app.models import (
    CustomUser,
    Department,
    AcademicBatch,
    CourseClass,
    Student,
    Supervisor,
    SupervisorQuota,
    ProjectTopicArea,
    StudentPreference,
    InternshipInfo,
    GraduationProject,
    SupervisionTask,
    WeeklyProgressReport,
    ThesisDeferralRequest,
    DefenseCouncil,
    CouncilMember,
    DefenseScheduleSlot,
    CouncilLiveScore,
    EvaluationPolicy,
    FinalGradeSummary,
    AuditLog
)

def reinitialize_database():
    print("================================================================================")
    print(">>> [BẮT ĐẦU] KIỂM TRA & KHỞI TẠO LẠI DỮ LIỆU ĐIỀN MẪU TRÊN WEB VÀ ADMIN")
    print("================================================================================")

    # --------------------------------------------------------------------------
    # 1. CHUẨN HÓA ĐỢT ĐỒ ÁN CHÍNH THỨC & DỌN DẸP BATCH RÁC
    # --------------------------------------------------------------------------
    print("\n--- [1/6] Thiết lập Đợt đồ án chính thức ---")
    # Deactivate tất cả batch test rác
    AcademicBatch.objects.exclude(batch_code="K62_HK1_2026_2027").update(is_active=False)

    main_batch, created = AcademicBatch.objects.get_or_create(
        batch_code="K62_HK1_2026_2027",
        defaults={
            "batch_name": "Đợt Đồ án Tốt nghiệp K62 - Học kỳ 1 Năm học 2026-2027",
            "start_date": "2026-09-01",
            "end_date": "2027-01-15",
            "program_type": "BOTH",
            "current_stage": "PHASE_3_TOPIC",
            "is_active": True,
            "is_allocation_published": True,
            "is_closed": False,
        }
    )
    main_batch.is_active = True
    main_batch.is_allocation_published = True
    main_batch.batch_name = "Đợt Đồ án Tốt nghiệp K62 - Học kỳ 1 Năm học 2026-2027"
    main_batch.current_stage = "PHASE_3_TOPIC"
    main_batch.save()
    print(f"[OK] Đợt hoạt động chính thức: {main_batch.batch_code} (ID: {main_batch.id}) - {main_batch.batch_name}")

    # --------------------------------------------------------------------------
    # 2. KHỞI TẠO BỘ MÔN & QUY CHẾ ĐIỂM & HƯỚNG ĐỀ TÀI
    # --------------------------------------------------------------------------
    print("\n--- [2/6] Bộ môn, Hướng đề tài & Quy chế điểm ---")
    dept_cnpm, _ = Department.objects.get_or_create(code="CNPM", defaults={"name": "Bộ môn Công nghệ phần mềm", "description": "Khoa CNTT - UTC"})
    dept_httt, _ = Department.objects.get_or_create(code="HTTT", defaults={"name": "Bộ môn Hệ thống thông tin", "description": "Khoa CNTT - UTC"})
    dept_khmt, _ = Department.objects.get_or_create(code="KHMT", defaults={"name": "Bộ môn Khoa học máy tính", "description": "Khoa CNTT - UTC"})
    dept_mmt, _ = Department.objects.get_or_create(code="MMT", defaults={"name": "Bộ môn Mạng máy tính & ATTT", "description": "Khoa CNTT - UTC"})

    policy, _ = EvaluationPolicy.objects.get_or_create(
        batch=main_batch,
        defaults={"weight_supervisor": 0.4, "weight_reviewer": 0.2, "weight_council": 0.4}
    )

    topic_ai, _ = ProjectTopicArea.objects.get_or_create(code="AI_ML", defaults={"name": "Trí tuệ nhân tạo & Học máy", "description": "Mô hình LLM, thị giác máy tính", "is_active": True})
    topic_web, _ = ProjectTopicArea.objects.get_or_create(code="WEB_MOBILE", defaults={"name": "Phát triển Web & Cloud Microservices", "description": "Hệ thống phân tán, React, Docker", "is_active": True})
    topic_sec, _ = ProjectTopicArea.objects.get_or_create(code="CYBER_SEC", defaults={"name": "An toàn thông tin & Mạng máy tính", "description": "Bảo mật đám mây, Zero Trust", "is_active": True})
    topic_data, _ = ProjectTopicArea.objects.get_or_create(code="DATA_SCI", defaults={"name": "Khoa học Dữ liệu & Phân tích lớn", "description": "Big Data, Pipeline", "is_active": True})

    # --------------------------------------------------------------------------
    # 3. CHUẨN HÓA TOÀN BỘ TÀI KHOẢN & MẬT KHẨU (ADMIN, GVHD, SV)
    # --------------------------------------------------------------------------
    print("\n--- [3/6] Đồng bộ Tài khoản Quản trị, Giảng viên & Sinh viên ---")
    
    # 3.1 Admin User
    admin_u, _ = CustomUser.objects.get_or_create(
        username="admin",
        defaults={
            "email": "admin@utc.edu.vn",
            "first_name": "Quản Trị",
            "last_name": "Khoa CNTT",
            "user_type": "admin",
            "is_staff": True,
            "is_superuser": True
        }
    )
    admin_u.set_password("Admin@123456")
    admin_u.is_staff = True
    admin_u.is_superuser = True
    admin_u.user_type = "admin"
    admin_u.save()
    print("[OK] Admin: admin / admin@utc.edu.vn -> Mật khẩu: Admin@123456")

    # 3.2 Supervisors
    supervisors_info = [
        # (username, email, fname, lname, gid, title, dept_obj, mult, quota, pwd)
        ("ts_thang", "thangvb@utc.edu.vn", "Vũ Bá", "Thắng", "GV001", "TS", dept_cnpm, 1.2, 6, "Gv@123456"),
        ("pgs_ha", "hadt@utc.edu.vn", "Đỗ Thị", "Hà", "GV002", "PGS.TS", dept_httt, 1.5, 8, "Gv@123456"),
        ("ts_nam", "namth@utc.edu.vn", "Trần Hoài", "Nam", "GV003", "TS", dept_khmt, 1.2, 6, "Gv@123456"),
        ("ths_linh", "linhnt@utc.edu.vn", "Nguyễn Thùy", "Linh", "GV004", "ThS", dept_cnpm, 1.0, 5, "Gv@123456"),
        ("ths_duc", "duclm@utc.edu.vn", "Lê Minh", "Đức", "GV005", "ThS", dept_httt, 1.0, 5, "Gv@123456"),
        # Alias tài khoản gợi ý trên màn hình đăng nhập web
        ("supervisor1", "gvc.nguyen@utc.edu.vn", "Nguyễn Hướng", "Dẫn", "GV999", "GVC.TS", dept_cnpm, 1.5, 8, "supervisor123"),
        ("committee1", "hd.nguyen@utc.edu.vn", "Nguyễn Chủ", "Tịch HĐ", "GV998", "PGS.TS", dept_khmt, 1.5, 8, "committee123"),
    ]
    sup_map = {}
    for uname, eml, fn, ln, gid, title, d_obj, mult, qta, pwd in supervisors_info:
        u, _ = CustomUser.objects.get_or_create(
            username=uname,
            defaults={"email": eml, "first_name": fn, "last_name": ln, "user_type": "supervisor"}
        )
        u.set_password(pwd)
        u.email = eml
        u.user_type = "supervisor"
        u.save()

        s, _ = Supervisor.objects.get_or_create(
            user=u,
            defaults={
                "supervisor_id": gid,
                "academic_title": title,
                "department_name": d_obj.name,
                "department_obj": d_obj,
                "academic_rank_multiplier": mult,
                "research_interest": "Công nghệ phần mềm & Hệ thống thông minh"
            }
        )
        s.academic_title = title
        s.academic_rank_multiplier = mult
        s.save()

        SupervisorQuota.objects.update_or_create(
            supervisor=s, batch=main_batch,
            defaults={"department": d_obj.code, "base_quota": qta, "rank_multiplier": mult, "max_total_quota": int(round(qta * mult))}
        )
        sup_map[uname] = s
        print(f"  [GV] {uname} ({title}. {fn} {ln}) -> Mật khẩu: {pwd}")

    # 3.3 Course Classes
    class_cn, _ = CourseClass.objects.get_or_create(
        batch=main_batch, class_code="CNTT1-K62",
        defaults={"class_name": "Công nghệ Thông tin 1 K62", "education_program": "BACHELOR"}
    )
    class_ks, _ = CourseClass.objects.get_or_create(
        batch=main_batch, class_code="KSCNTT-K62",
        defaults={"class_name": "Kỹ sư Công nghệ Thông tin K62", "education_program": "ENGINEER"}
    )

    # 3.4 Students
    students_info = [
        # (username, email, fname, lname, mssv, prog, cclass, pwd)
        ("sv_an", "an.nv@utc.edu.vn", "Nguyễn Văn", "An", "201200001", "BACHELOR", class_cn, "Sv@123456"),
        ("sv_binh", "binh.tt@utc.edu.vn", "Trần Thị", "Bình", "201200002", "BACHELOR", class_cn, "Sv@123456"),
        ("sv_chi", "chi.lk@utc.edu.vn", "Lê Khánh", "Chi", "201200003", "BACHELOR", class_cn, "Sv@123456"),
        ("sv_dung", "dung.pq@utc.edu.vn", "Phạm Quốc", "Dũng", "201200004", "BACHELOR", class_cn, "Sv@123456"),
        ("sv_em", "em.hk@utc.edu.vn", "Hoàng Kim", "Em", "201200005", "BACHELOR", class_cn, "Sv@123456"),
        ("sv_giang", "giang.dt@utc.edu.vn", "Đinh Trường", "Giang", "201200006", "BACHELOR", class_cn, "Sv@123456"),
        ("sv_hung", "hung.vm@utc.edu.vn", "Vũ Mạnh", "Hùng", "201200007", "ENGINEER", class_ks, "Sv@123456"),
        ("sv_khanh", "khanh.bn@utc.edu.vn", "Bùi Nam", "Khánh", "201200008", "ENGINEER", class_ks, "Sv@123456"),
        ("sv_long", "long.dh@utc.edu.vn", "Đỗ Hoàng", "Long", "201200009", "ENGINEER", class_ks, "Sv@123456"),
        ("sv_minh", "minh.nn@utc.edu.vn", "Ngô Nhật", "Minh", "201200010", "ENGINEER", class_ks, "Sv@123456"),
        # Alias tài khoản gợi ý trên màn hình login web
        ("student2", "201200102@sv.utc.edu.vn", "Trần Thị", "Bích", "201200102", "BACHELOR", class_cn, "student123"),
        ("student3", "201200103@sv.utc.edu.vn", "Lê Văn", "Cường", "201200103", "BACHELOR", class_cn, "student123"),
    ]
    stu_map = {}
    for uname, eml, fn, ln, msv, prog, cclass, pwd in students_info:
        u, _ = CustomUser.objects.get_or_create(
            username=uname,
            defaults={"email": eml, "first_name": fn, "last_name": ln, "user_type": "student"}
        )
        u.set_password(pwd)
        u.email = eml
        u.user_type = "student"
        u.save()

        s, _ = Student.objects.get_or_create(
            user=u,
            defaults={
                "registration_no": msv,
                "education_program": prog,
                "course_class": cclass,
                "academic_batch": main_batch,
                "department": "CNTT"
            }
        )
        s.education_program = prog
        s.course_class = cclass
        s.academic_batch = main_batch
        s.save()
        stu_map[uname] = s
        print(f"  [SV] {msv} (user: {uname}) -> Mật khẩu: {pwd}")

    # --------------------------------------------------------------------------
    # 4. KHỞI TẠO ĐỀ TÀI ĐỒ ÁN MẪU ĐẦY ĐỦ CÁC GIAI ĐOẠN
    # --------------------------------------------------------------------------
    print("\n--- [4/6] Khởi tạo Đồ án Tốt nghiệp & Hồ sơ học vụ mẫu ---")
    
    # SV 1: sv_an (Cử nhân) -> Đã duyệt đề tài, sẵn sàng bảo vệ
    p_an, _ = GraduationProject.objects.update_or_create(
        student=stu_map["sv_an"],
        defaults={
            "supervisor": sup_map["ts_thang"],
            "reviewer": sup_map["ts_nam"],
            "batch": main_batch,
            "topic_category": topic_web,
            "topic_title_vi": "Xây dựng nền tảng quản lý đồ án tốt nghiệp thông minh ThesisHub dựa trên kiến trúc Microservices",
            "topic_title_en": "Building Intelligent Graduation Thesis Management Platform ThesisHub on Microservices",
            "status": "DEFENSE_READY",
            "topic_review_status": "APPROVED",
            "supervisor_score": 9.0,
            "reviewer_score": 8.5,
            "final_academic_eligibility": "ELIGIBLE",
            "is_eligible_for_defense": True,
            "supervisor_defense_confirmed": True
        }
    )

    # SV 2: sv_binh (Cử nhân) -> Đang làm đồ án
    p_binh, _ = GraduationProject.objects.update_or_create(
        student=stu_map["sv_binh"],
        defaults={
            "supervisor": sup_map["ths_linh"],
            "batch": main_batch,
            "topic_category": topic_data,
            "topic_title_vi": "Xây dựng hệ thống Data Pipeline phân tích hành vi người dùng thương mại điện tử",
            "status": "IN_PROGRESS",
            "topic_review_status": "APPROVED",
            "final_academic_eligibility": "CLEARED"
        }
    )

    # SV 3: sv_chi (Cử nhân) -> Đề tài mới xác nhận, chờ Admin duyệt
    p_chi, _ = GraduationProject.objects.update_or_create(
        student=stu_map["sv_chi"],
        defaults={
            "supervisor": sup_map["ts_thang"],
            "batch": main_batch,
            "topic_category": topic_ai,
            "topic_title_vi": "Hệ thống gợi ý việc làm ngành CNTT ứng dụng mô hình ngôn ngữ lớn (LLM)",
            "status": "TOPIC_CONFIRMED",
            "topic_review_status": "PENDING"
        }
    )

    # SV 7: sv_hung (Kỹ sư) -> Đồ án Kỹ sư, sẵn sàng bảo vệ
    p_hung, _ = GraduationProject.objects.update_or_create(
        student=stu_map["sv_hung"],
        defaults={
            "supervisor": sup_map["ts_thang"],
            "reviewer": sup_map["ts_nam"],
            "batch": main_batch,
            "topic_category": topic_ai,
            "topic_title_vi": "Ứng dụng Deep Learning và Thị giác máy tính nhận dạng bất thường trong giao thông đô thị",
            "status": "DEFENSE_READY",
            "topic_review_status": "APPROVED",
            "supervisor_score": 9.2,
            "reviewer_score": 8.8,
            "final_academic_eligibility": "ELIGIBLE",
            "is_eligible_for_defense": True,
            "supervisor_defense_confirmed": True
        }
    )

    # SV 8: sv_khanh (Kỹ sư) -> Nợ 14 tín chỉ, không đủ ĐK (chờ Force Approve hoặc Bảo lưu)
    p_khanh, _ = GraduationProject.objects.update_or_create(
        student=stu_map["sv_khanh"],
        defaults={
            "supervisor": sup_map["ts_nam"],
            "batch": main_batch,
            "topic_category": topic_sec,
            "topic_title_vi": "Nghiên cứu kiến trúc Zero Trust Network Access trong bảo vệ hạ tầng đám mây",
            "status": "IN_PROGRESS",
            "topic_review_status": "APPROVED",
            "final_academic_eligibility": "NOT_ELIGIBLE",
            "is_eligible_for_defense": False,
            "supervisor_defense_confirmed": False
        }
    )

    # SV 9: sv_long (Kỹ sư) -> Đã nộp đơn xin bảo lưu
    p_long, _ = GraduationProject.objects.update_or_create(
        student=stu_map["sv_long"],
        defaults={
            "supervisor": sup_map["pgs_ha"],
            "batch": main_batch,
            "topic_category": topic_sec,
            "topic_title_vi": "Đánh giá an toàn thông tin hệ thống mạng doanh nghiệp theo tiêu chuẩn ISO/IEC 27001",
            "status": "IN_PROGRESS",
            "topic_review_status": "APPROVED"
        }
    )
    ThesisDeferralRequest.objects.update_or_create(
        project=p_long,
        defaults={
            "student": p_long.student,
            "reason": "Điều trị y tế phục hồi chức năng sau phẫu thuật, xin bảo lưu kết quả 01 học kỳ.",
            "status": "PENDING"
        }
    )

    # SV gợi ý: student2, student3
    p_st2, _ = GraduationProject.objects.update_or_create(
        student=stu_map["student2"],
        defaults={
            "supervisor": sup_map["supervisor1"],
            "batch": main_batch,
            "topic_category": topic_web,
            "topic_title_vi": "Xây dựng cổng thông tin quản lý sinh viên thực tập doanh nghiệp",
            "status": "IN_PROGRESS",
            "topic_review_status": "APPROVED"
        }
    )
    p_st3, _ = GraduationProject.objects.update_or_create(
        student=stu_map["student3"],
        defaults={
            "supervisor": sup_map["supervisor1"],
            "batch": main_batch,
            "topic_category": topic_web,
            "topic_title_vi": "Ứng dụng Web Progressive (PWA) hỗ trợ học tập trực tuyến",
            "status": "IN_PROGRESS",
            "topic_review_status": "APPROVED"
        }
    )

    print("[OK] Đã khởi tạo 8 Đồ án Tốt nghiệp mẫu với đầy đủ các trạng thái nghiệp vụ.")

    # --------------------------------------------------------------------------
    # 5. KHỞI TẠO TIẾN ĐỘ & TASKS MẪU
    # --------------------------------------------------------------------------
    print("\n--- [5/6] Giao Task & Báo cáo tiến độ mẫu ---")
    SupervisionTask.objects.update_or_create(
        project=p_an, title="Thiết kế cơ sở dữ liệu và ERD Diagram chuẩn 3NF",
        defaults={
            "assigned_by": sup_map["ts_thang"],
            "description": "Phân tích 25 thực thể dữ liệu chuẩn UTC và chuẩn hóa 3NF.",
            "due_date": date.today() - timedelta(days=7),
            "priority": "HIGH",
            "status": "COMPLETED",
            "is_completed": True,
            "is_late": False,
            "review_verdict": "ACCEPTED",
            "supervisor_review_notes": "Thiết kế hoàn chỉnh, đáp ứng tốt yêu cầu."
        }
    )
    SupervisionTask.objects.update_or_create(
        project=p_an, title="Xây dựng API Backend và tích hợp thuật toán phân công MCMF",
        defaults={
            "assigned_by": sup_map["ts_thang"],
            "description": "Viết Django REST API và giải thuật phân luồng cực đại chi phí cực tiểu.",
            "due_date": date.today() + timedelta(days=14),
            "priority": "HIGH",
            "status": "IN_PROGRESS",
            "is_completed": False,
            "is_late": False,
            "review_verdict": "PENDING"
        }
    )
    SupervisionTask.objects.update_or_create(
        project=p_an, title="Hoàn thiện tài liệu thuyết minh và slide bảo vệ",
        defaults={
            "assigned_by": sup_map["ts_thang"],
            "description": "Đóng quyển đồ án theo mẫu quy định và chuẩn bị slide thuyết trình 15 phút.",
            "due_date": date.today() + timedelta(days=30),
            "priority": "MEDIUM",
            "status": "TODO",
            "is_completed": False,
            "is_late": False,
            "review_verdict": "PENDING"
        }
    )
    WeeklyProgressReport.objects.update_or_create(
        project=p_an, week_number=4,
        defaults={
            "summary_content": "Hoàn thành phân tích nghiệp vụ 6 giai đoạn và thiết kế database.",
            "planned_tasks": "Viết mã nguồn các endpoint API phân công và duyệt đề tài.",
            "supervisor_feedback": "Tiến độ rất tốt, cần lưu ý các ràng buộc học vị theo quy chế mới.",
            "supervisor_rating": "GOOD"
        }
    )
    print("[OK] Đã tạo 3 Tasks tiến độ và 1 Báo cáo tuần mẫu cho sinh viên Nguyễn Văn An.")

    # --------------------------------------------------------------------------
    # 6. KHỞI TẠO HỘI ĐỒNG BẢO VỆ & XẾP LỊCH & ĐIỂM SỐ MẪU
    # --------------------------------------------------------------------------
    print("\n--- [6/6] Hội đồng Bảo vệ (1CT-2TK-2UV) & Xếp lịch Slots ---")
    council, _ = DefenseCouncil.objects.update_or_create(
        batch=main_batch,
        council_number=1,
        defaults={
            "council_name": "Hội đồng Bảo vệ ĐATN K62 - Hội đồng 01",
            "defense_room": "P.402-A9",
            "session_date": "2026-06-25",
            "session_time": "MORNING",
            "is_finalized": False
        }
    )

    # 5 thành viên chuẩn UTC:
    c_members_data = [
        (sup_map["pgs_ha"], "CHAIR"),       # Chủ tịch: PGS.TS Đỗ Thị Hà
        (sup_map["ths_linh"], "SECRETARY"), # Thư ký 1: ThS Nguyễn Thùy Linh
        (sup_map["ths_duc"], "SECRETARY"),  # Thư ký 2: ThS Lê Minh Đức
        (sup_map["ts_nam"], "MEMBER"),      # Ủy viên: TS Trần Hoài Nam
        (sup_map["ts_thang"], "MEMBER"),    # Ủy viên: TS Vũ Bá Thắng
    ]
    member_objs = []
    for s_obj, role_name in c_members_data:
        m, _ = CouncilMember.objects.update_or_create(
            council=council,
            user=s_obj.user,
            defaults={"supervisor": s_obj, "role": role_name}
        )
        member_objs.append(m)

    # Gán đề tài vào Hội đồng & Xếp lịch Slots
    p_an.council = council
    p_an.save(update_fields=["council"])
    DefenseScheduleSlot.objects.update_or_create(
        council=council, order_number=1,
        defaults={
            "project": p_an,
            "room": "P.402-A9",
            "start_time": "08:00",
            "end_time": "08:35"
        }
    )

    p_hung.council = council
    p_hung.save(update_fields=["council"])
    DefenseScheduleSlot.objects.update_or_create(
        council=council, order_number=2,
        defaults={
            "project": p_hung,
            "room": "P.402-A9",
            "start_time": "08:35",
            "end_time": "09:10"
        }
    )

    # Điểm chấm live score mẫu từ 5 thành viên cho SV Nguyễn Văn An
    for m in member_objs:
        CouncilLiveScore.objects.update_or_create(
            council=council, project=p_an, member=m,
            defaults={
                "score_presentation": 3.0,
                "score_content": 3.0,
                "score_qa": 1.5,
                "score_demo": 1.5,
                "total_score": 9.0,
                "comments": "Trình bày rõ ràng, demo chạy mượt mà, trả lời tốt câu hỏi."
            }
        )

    # Final Grade Summary
    summary, _ = FinalGradeSummary.objects.update_or_create(
        project=p_an,
        defaults={
            "supervisor_score": 9.0,
            "reviewer_score": 8.5,
            "council_avg_score": 9.0,
        }
    )
    summary.calculate_and_save(policy=policy)
    print(f"[OK] Hội đồng: {council.council_name} (5 thành viên).")
    print(f"     Xếp lịch: Slot 1 ({p_an.student.registration_no}), Slot 2 ({p_hung.student.registration_no})")
    print(f"     Điểm tổng hợp mẫu SV {p_an.student.registration_no}: {summary.final_score_10} (Điểm chữ {summary.final_letter_grade}, Thang 4: {summary.final_score_4})")

    # Audit log
    AuditLog.objects.create(
        user=admin_u,
        action_type="DATABASE_REINITIALIZE",
        description="Khởi tạo lại toàn bộ dữ liệu điền mẫu chuẩn UTC trên Web và Admin thành công."
    )

    print("================================================================================")
    print(">>> [HOÀN TẤT] DATABASE ĐÃ ĐƯỢC ĐỒNG BỘ 100% VỚI DỮ LIỆU ĐIỀN MẪU CHUẨN!")
    print("================================================================================")

if __name__ == "__main__":
    reinitialize_database()
