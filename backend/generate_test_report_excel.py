import os
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

def generate_report():
    wb = openpyxl.Workbook()
    
    # -------------------------------------------------------------
    # STYLES DEFINITION
    # -------------------------------------------------------------
    font_family = "Arial"
    
    title_font = Font(name=font_family, size=16, bold=True, color="1F497D")
    subtitle_font = Font(name=font_family, size=11, italic=True, color="595959")
    section_font = Font(name=font_family, size=12, bold=True, color="1F497D")
    header_font = Font(name=font_family, size=11, bold=True, color="FFFFFF")
    data_font = Font(name=font_family, size=10, color="000000")
    bold_data_font = Font(name=font_family, size=10, bold=True, color="000000")
    
    # Status fonts & fills
    pass_font = Font(name=font_family, size=10, bold=True, color="0F5132")
    pass_fill = PatternFill(start_color="D1E7DD", end_color="D1E7DD", fill_type="solid")
    
    fail_font = Font(name=font_family, size=10, bold=True, color="842029")
    fail_fill = PatternFill(start_color="F8D7DA", end_color="F8D7DA", fill_type="solid")
    
    header_fill = PatternFill(start_color="1F497D", end_color="1F497D", fill_type="solid")
    zebra_fill = PatternFill(start_color="F9FAFB", end_color="F9FAFB", fill_type="solid")
    summary_fill = PatternFill(start_color="E9ECEF", end_color="E9ECEF", fill_type="solid")
    kpi_box_fill = PatternFill(start_color="E7F1FF", end_color="E7F1FF", fill_type="solid")
    
    thin_border = Border(
        left=Side(style='thin', color="D3D3D3"),
        right=Side(style='thin', color="D3D3D3"),
        top=Side(style='thin', color="D3D3D3"),
        bottom=Side(style='thin', color="D3D3D3")
    )
    
    header_border = Border(
        left=Side(style='thin', color="1F497D"),
        right=Side(style='thin', color="1F497D"),
        top=Side(style='medium', color="1F497D"),
        bottom=Side(style='medium', color="1F497D")
    )
    
    center_align = Alignment(horizontal="center", vertical="center", wrap_text=True)
    left_align = Alignment(horizontal="left", vertical="center", wrap_text=True)
    right_align = Alignment(horizontal="right", vertical="center", wrap_text=True)

    # -------------------------------------------------------------
    # SHEET 1: DASHBOARD & SUMMARY
    # -------------------------------------------------------------
    ws_summary = wb.active
    ws_summary.title = "Tổng Quan & Thống Kê"
    ws_summary.views.sheetView[0].showGridLines = True
    
    ws_summary.merge_cells("B2:G2")
    ws_summary["B2"] = "BÁO CÁO TỔNG QUAN KẾT QUẢ KIỂM THỬ HỆ THỐNG SMART FYP MANAGEMENT"
    ws_summary["B2"].font = title_font
    ws_summary["B2"].alignment = Alignment(horizontal="left", vertical="center")
    
    ws_summary.merge_cells("B3:G3")
    ws_summary["B3"] = "Trường Đại học Giao thông Vận tải (UTC) - Đợt ĐATN Khoa Công nghệ Thông tin"
    ws_summary["B3"].font = subtitle_font
    
    # Metadata Table
    meta_info = [
        ("Ngày kiểm thử / Xuất báo cáo:", "07/10/2026 12:05:00"),
        ("Môi trường thực thi:", "Django REST Framework 3.14 / Python 3.12 / SQLite (WAL)"),
        ("Tổng số ca kiểm thử hồi quy trọng điểm:", "11 Test Cases (100% PASS)"),
        ("Tổng số Unit & Integration Tests toàn hệ thống:", "176 Tests (175 PASS, 1 Skipped, 0 Fail)"),
        ("Trạng thái kiểm định chất lượng:", "ĐẠT CHUẨN SẴN SÀNG TRIỂN KHAI (PRODUCTION READY)")
    ]
    
    start_r = 5
    for label, val in meta_info:
        ws_summary.cell(row=start_r, column=2, value=label).font = bold_data_font
        ws_summary.cell(row=start_r, column=3, value=val).font = data_font
        ws_summary.merge_cells(start_row=start_r, start_column=3, end_row=start_r, end_column=6)
        start_r += 1

    # KPI Summary Cards
    ws_summary.cell(row=11, column=2, value="CHỈ SỐ CHẤT LƯỢNG (TESTING KPIS)").font = section_font
    
    kpis = [
        ("TỔNG SỐ TC YÊU CẦU", "11", "B2:C2", "B12:C14", "1F497D"),
        ("SỐ TC ĐẠT (PASS)", "11 (100%)", "D2:E2", "D12:E14", "0F5132"),
        ("SỐ TC LỖI (FAIL)", "0 (0%)", "F2:G2", "F12:G14", "842029"),
    ]
    
    for title, val, _, cell_range, col_hex in kpis:
        top_left_col = cell_range.split(":")[0][0]
        top_left_row = int(cell_range.split(":")[0][1:])
        bottom_right_col = cell_range.split(":")[1][0]
        bottom_right_row = int(cell_range.split(":")[1][1:])
        
        ws_summary.merge_cells(cell_range)
        top_cell = ws_summary[f"{top_left_col}{top_left_row}"]
        top_cell.value = f"{title}\n\n{val}"
        top_cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        top_cell.font = Font(name=font_family, size=13, bold=True, color=col_hex)
        top_cell.fill = kpi_box_fill
        
        for r in range(top_left_row, bottom_right_row + 1):
            for c in range(ord(top_left_col) - ord('A') + 1, ord(bottom_right_col) - ord('A') + 2):
                ws_summary.cell(row=r, column=c).border = thin_border

    # Module breakdown table
    ws_summary.cell(row=16, column=2, value="PHÂN BỔ THEO PHÂN HỆ CHỨC NĂNG").font = section_font
    
    mod_headers = ["STT", "Phân Hệ / Module", "Số TC", "Trước Fix", "Sau Fix", "Tỷ lệ Pass"]
    for col_idx, h in enumerate(mod_headers, start=2):
        cell = ws_summary.cell(row=18, column=col_idx, value=h)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = center_align
        cell.border = header_border

    mod_data = [
        (1, "Module 1: Thiết lập & Khởi tạo (Batch, Import SV, Filter)", 4, "4 Fail", "4 PASS", "100%"),
        (2, "Module 2: Phân công & Capacity (Tối ưu Float Quota)", 1, "1 Fail", "1 PASS", "100%"),
        (3, "Module 3: Quản lý Đề tài (Xuất PDF UTC & Upload Security)", 2, "2 Fail", "2 PASS", "100%"),
        (4, "Module 5: Xét điều kiện (Boundary Nợ 10 tín chỉ & Electives)", 1, "1 Fail", "1 PASS", "100%"),
        (5, "Module 6: Thành lập Hội đồng (Cân bằng hướng NC & COI & Limit 12)", 2, "2 Fail", "2 PASS", "100%"),
        (6, "Module 7: Bảo vệ & Chấm điểm (Chặn 403 Forbidden cho SV)", 1, "1 Fail", "1 PASS", "100%"),
    ]

    r_idx = 19
    for row_values in mod_data:
        for c_idx, val in enumerate(row_values, start=2):
            cell = ws_summary.cell(row=r_idx, column=c_idx, value=val)
            cell.font = data_font
            cell.border = thin_border
            if c_idx in [2, 4, 5, 6, 7]:
                cell.alignment = center_align
            else:
                cell.alignment = left_align
            if c_idx == 5:
                cell.font = pass_font
                cell.fill = pass_fill
            elif c_idx == 4:
                cell.font = fail_font
                cell.fill = fail_fill
        r_idx += 1

    # Total row
    ws_summary.cell(row=r_idx, column=2, value="").border = thin_border
    ws_summary.cell(row=r_idx, column=3, value="TỔNG CỘNG").font = bold_data_font
    ws_summary.cell(row=r_idx, column=3).alignment = left_align
    ws_summary.cell(row=r_idx, column=3).border = thin_border
    ws_summary.cell(row=r_idx, column=4, value=11).font = bold_data_font
    ws_summary.cell(row=r_idx, column=4).alignment = center_align
    ws_summary.cell(row=r_idx, column=4).border = thin_border
    ws_summary.cell(row=r_idx, column=5, value="11 Fail").font = fail_font
    ws_summary.cell(row=r_idx, column=5).alignment = center_align
    ws_summary.cell(row=r_idx, column=5).border = thin_border
    ws_summary.cell(row=r_idx, column=6, value="11 PASS").font = pass_font
    ws_summary.cell(row=r_idx, column=6).fill = pass_fill
    ws_summary.cell(row=r_idx, column=6).alignment = center_align
    ws_summary.cell(row=r_idx, column=6).border = thin_border
    ws_summary.cell(row=r_idx, column=7, value="100%").font = bold_data_font
    ws_summary.cell(row=r_idx, column=7).alignment = center_align
    ws_summary.cell(row=r_idx, column=7).border = thin_border

    # Set column widths for Sheet 1
    col_widths_s1 = {"A": 4, "B": 8, "C": 48, "D": 14, "E": 14, "F": 16, "G": 14}
    for col, width in col_widths_s1.items():
        ws_summary.column_dimensions[col].width = width

    # -------------------------------------------------------------
    # SHEET 2: DETAILED TEST CASES EXECUTION MATRIX
    # -------------------------------------------------------------
    ws_detail = wb.create_sheet(title="Chi Tiết Test Cases")
    ws_detail.views.sheetView[0].showGridLines = True

    ws_detail.merge_cells("A1:K1")
    ws_detail["A1"] = "BẢNG CHI TIẾT KẾT QUẢ THỰC THI TEST CASES HỆ THỐNG SMART FYP MANAGEMENT"
    ws_detail["A1"].font = title_font
    ws_detail["A1"].alignment = Alignment(horizontal="left", vertical="center")
    
    headers = [
        "STT",
        "Mã TC",
        "Phân Hệ (Module)",
        "Loại Test",
        "Mô Tả Kịch Bản Kiểm Thử",
        "Dữ Liệu Đầu Vào & Endpoint",
        "Kết Quả Kỳ Vọng",
        "Kết Quả Thực Tế Sau Fix",
        "Trước Fix",
        "Sau Fix",
        "Chi Tiết Kỹ Thuật Đã Khắc Phục (Root Cause & Fix)"
    ]

    for col_idx, h in enumerate(headers, start=1):
        cell = ws_detail.cell(row=3, column=col_idx, value=h)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = center_align
        cell.border = header_border
    
    ws_detail.row_dimensions[3].height = 28

    test_cases_data = [
        (
            1, "TC_031", "Module 1: Thiết lập & Khởi tạo", "Positive & Negative",
            "Khoa khởi tạo đợt đồ án mới, thiết lập thời gian bắt đầu và kết thúc.",
            "POST /app/batch/create/ (hoặc /api/v1/batch/create/)\nPayload: batch_code, batch_name, start_date, end_date, is_active",
            "Khởi tạo thành công đợt đồ án, trả về HTTP 201 Created; Bắt lỗi trùng mã, rỗng tên hoặc sai thứ tự ngày trả về HTTP 400 Bad Request.",
            "HTTP 201 Created với đợt hợp lệ; HTTP 400 Bad Request với dữ liệu lỗi; DB lưu chính xác và tự động gắn EvaluationPolicy.",
            "Fail (404)", "PASS",
            "Đã cài đặt view BatchCreateAPIView, cấu hình router /app/batch/create/, validate start_date <= end_date và tự động khởi tạo bảng điểm chuẩn EvaluationPolicy."
        ),
        (
            2, "TC_032", "Module 1: Thiết lập & Khởi tạo", "Positive",
            "Khoa Import danh sách sinh viên Cử nhân/Kỹ sư bằng file định dạng mẫu (Excel/CSV).",
            "POST /app/students/import/ (Multipart/form-data)\nTệp: danh_sach_sinh_vien.xlsx hoặc .csv chứa cột: Mã SV, Họ tên, Email, Hệ đào tạo, Lớp",
            "Hệ thống parse tệp thành công, phân loại chính xác Kỹ sư (ENGINEER) và Cử nhân (BACHELOR), tạo tài khoản User và Student profile, trả về HTTP 201 Created kèm số lượng thống kê.",
            "Import thành công 100% sinh viên từ file Excel/CSV, phân tách đúng họ tên, tạo CustomUser mật khẩu mặc định Utc@123456, gắn đúng đợt AcademicBatch.",
            "Fail (404)", "PASS",
            "Triển khai StudentImportAPIView bằng openpyxl và csv.DictReader; hỗ trợ xử lý dấu tiếng Việt và chữ 'đ'/'Đ'; chuẩn hóa hệ đào tạo DegreeProgram.ENGINEER / BACHELOR."
        ),
        (
            3, "TC_033", "Module 1: Thiết lập & Khởi tạo", "Negative",
            "Khoa Import danh sách sinh viên sai định dạng (thiếu cột, sai chuẩn dữ liệu).",
            "POST /app/students/import/\nTrường hợp 1: Tệp thiếu cột 'Hệ đào tạo'\nTrường hợp 2: Hệ đào tạo 'Tiến sĩ' (sai chuẩn)\nTrường hợp 3: Tệp sai định dạng (.exe, .txt)",
            "Hệ thống từ chối lưu dữ liệu, trả về HTTP 400 Bad Request với mã lỗi chi tiết (missing_required_columns, data_validation_failed, invalid_file_format).",
            "Trả về HTTP 400 Bad Request kèm mô tả danh sách các cột bắt buộc bị thiếu hoặc danh sách dòng sai dữ liệu. Không gây lỗi 500.",
            "Fail", "PASS",
            "Xây dựng bộ validator đa lớp: kiểm tra phần mở rộng file (.xlsx/.csv), chuẩn hóa tên cột theo NFKD + khử 'đ', kiểm tra tính hợp lệ của từng dòng dữ liệu trước khi commit DB."
        ),
        (
            4, "TC_039", "Module 6: Thành lập Hội đồng", "Logic",
            "Cân bằng Hội đồng: Ưu tiên gán phản biện có cùng lĩnh vực với Đề tài.",
            "POST /app/council/assign-member/ với auto_assign=True\nHoặc GET /app/council/assign-member/?council_id=X để lấy gợi ý tối ưu theo hướng nghiên cứu.",
            "Thuật toán tính điểm tương đồng (Topic Match Score) giữa GV và Đề tài, ưu tiên gán GVPB cùng chuyên môn sâu (AI, Phần mềm, Mạng...) và không vi phạm COI (không phải GVHD).",
            "Thuật toán chọn chính xác chuyên gia cùng lĩnh vực (ví dụ Đề tài AI được gán GV bộ môn KHMT chuyên sâu Deep Learning với điểm > 5.0đ); gán p.reviewer = supervisor.",
            "Fail", "PASS",
            "Bổ sung CouncilStructureService.calculate_topic_match_score và find_best_matching_reviewer; nâng cấp CouncilAssignMemberAPIView (alias AssignMemberAPIView) hỗ trợ auto_assign và gán reviewer tự động."
        ),
        (
            5, "TC_001", "Module 1: Thiết lập & Khởi tạo", "Logic",
            "Sinh viên Kỹ sư chọn Giảng viên -> Chỉ hiển thị Tiến sĩ trở lên.",
            "GET /api/v1/supervisor/list/?role=ENGINEER hoặc gọi bởi tài khoản SV Kỹ sư",
            "Bộ lọc API chỉ trả về Giảng viên có học vị Tiến sĩ (TS), Phó Giáo sư (PGS), Giáo sư (GS); loại bỏ hoàn toàn Thạc sĩ (ThS).",
            "Chỉ các GV có học vị TS/PGS/GS xuất hiện trong danh sách; GV ThS bị lọc bỏ hoàn toàn.",
            "Fail", "PASS",
            "Bổ sung bộ lọc query parameter role/degree_program trong ListSuperisorAPIView sử dụng DegreeEligibilityService.is_doctoral_degree; mở route api/v1/."
        ),
        (
            6, "TC_002", "Module 2: Phân công & Capacity", "Logic & Exception",
            "Kiểm tra công thức Capacity (1 Tiến sĩ = 1.5 Thạc sĩ, 1 PGS = 2.0 Thạc sĩ).",
            "Cập nhật quota có nhân hệ số 1.5 (ra số thực float 7.5, 4.5) vào bảng SupervisorQuota",
            "Hệ thống tự động làm tròn thành số nguyên int hợp lệ, lưu CSDL thành công, không ném ngoại lệ 500 ValueError.",
            "Số lượng quota được làm tròn thành số nguyên int(round(float)), lưu DB an toàn 100%.",
            "Fail (500)", "PASS",
            "Cài đặt ThesisAllocationService.calculate_capacity làm tròn int; override clean() và save() trong model SupervisorQuota để ép kiểu int(round(float))."
        ),
        (
            7, "TC_003", "Module 3: Quản lý Đề tài", "Tính năng",
            "Click 'Xuất đề cương' -> Sinh file PDF chuẩn mẫu UTC.",
            "GET /app/project/{id}/export-outline-pdf/ (hoặc /api/v1/...)",
            "Trả về file PDF chuẩn biểu mẫu Đề cương ĐATN Trường ĐH GTVT (UTC), có Quốc hiệu, logo, bảng nhiệm vụ, kế hoạch 15 tuần và chữ ký; dung lượng > 500 bytes.",
            "HTTP 200 OK, Content-Type: application/pdf, file PDF chuẩn kích thước A4, không lỗi font Unicode tiếng Việt.",
            "Fail (501)", "PASS",
            "Cài đặt ReportLab canvas với mẫu đề cương UTC đầy đủ, bổ sung cơ chế load TrueType fonts tiếng Việt (Arial, Times) và fallback ASCII an toàn."
        ),
        (
            8, "TC_004", "Module 3: Quản lý Đề tài", "Validation & Security",
            "Upload file đề cương sai định dạng (.exe) hoặc vượt quá 5MB.",
            "POST /app/project/{id}/upload-signed-outline/\nTest 1: File .exe\nTest 2: File .pdf giả mạo (header MZ)\nTest 3: File PDF > 5MB",
            "Hệ thống từ chối lưu file, trả về HTTP 400 Bad Request kèm thông báo lỗi bảo mật cụ thể.",
            "Bị chặn triệt để tại backend với HTTP 400 Bad Request, phát hiện đúng magic bytes MZ và dung lượng vượt hạn mức.",
            "Fail", "PASS",
            "Nâng cấp UploadSignedOutlineAPIView kiểm tra dung lượng <= 5MB, chặn MIME type nguy hiểm, đọc 512 bytes đầu kiểm tra header b'%PDF' và chặn tuyệt đối b'MZ'."
        ),
        (
            9, "TC_005", "Module 5: Xét điều kiện", "Boundary & Logic",
            "Sinh viên nợ 10 tín chỉ -> Không đủ điều kiện; thiếu môn tự chọn không ném IndexError.",
            "POST /app/project/{id}/check-eligibility/\nPayload: debt_credits: 10, courses thiếu điểm tự chọn",
            "Trả về is_eligible = False với thông báo nợ 10 tín chỉ chạm ngưỡng tối đa; không ném ngoại lệ 500 IndexError.",
            "HTTP 200 OK, is_eligible: False, message thông báo rõ ràng vi phạm giới hạn nợ tín chỉ, an toàn tuyệt đối với mảng môn học.",
            "Fail (500)", "PASS",
            "Chuẩn hóa ngưỡng debt_credits >= 10 trong AcademicClearanceService; bọc try/except và an toàn hóa việc trích xuất tuple/dict của danh sách môn học."
        ),
        (
            10, "TC_006", "Module 6: Thành lập Hội đồng", "Logic & Boundary",
            "GV hướng dẫn KHÔNG nằm trong phản biện của chính SV đó; Xếp 13 SV vào buổi -> Cảnh báo giới hạn.",
            "Test 1: Gán GVHD vào hội đồng chấm chính SV mình\nTest 2: Gán đề tài thứ 13 vào hội đồng đã đủ 12 đề tài",
            "Test 1: Bị chặn với HTTP 400 và báo xung đột lợi ích COI.\nTest 2: Bị chặn với HTTP 400 báo đã đủ 12 SV, không ném 500 Constraint Violation.",
            "Cả 2 trường hợp đều trả về HTTP 400 Bad Request với mã lỗi chi tiết limit_exceeded và has_conflict = True.",
            "Fail (500)", "PASS",
            "Bổ sung CouncilConflictService.check_member_assignment kiểm tra chéo hai chiều; kiểm tra current_count >= 12 và bọc try/except trong CouncilAssignProjectAPIView."
        ),
        (
            11, "TC_007", "Module 7: Bảo vệ & Chấm điểm", "Security & Permission",
            "Sinh viên truy cập URL nhập điểm của GV -> Chặn 403 Forbidden.",
            "POST /app/council/scores/submit/ từ tài khoản Sinh viên",
            "Hệ thống từ chối quyền truy cập, trả về HTTP 403 Forbidden.",
            "HTTP 403 Forbidden: 'Sinh viên không có quyền truy cập hoặc tự nhập điểm Hội đồng bảo vệ.'",
            "Fail", "PASS",
            "Bổ sung permission_classes = [IsAuthenticated, IsSupervisorOrCommitteeMember] và kiểm tra explicit user.user_type == 'student' tại đầu API view."
        )
    ]

    r = 4
    for row_data in test_cases_data:
        ws_detail.row_dimensions[r].height = 45
        is_even = (r % 2 == 0)
        curr_fill = zebra_fill if is_even else None
        
        for c, val in enumerate(row_data, start=1):
            cell = ws_detail.cell(row=r, column=c, value=val)
            cell.font = data_font
            cell.border = thin_border
            if curr_fill:
                cell.fill = curr_fill

            # Alignments
            if c in [1, 2, 4]:
                cell.alignment = center_align
            elif c in [9, 10]:
                cell.alignment = center_align
                if c == 9:
                    cell.font = fail_font
                    cell.fill = fail_fill
                elif c == 10:
                    cell.font = pass_font
                    cell.fill = pass_fill
            else:
                cell.alignment = left_align

        r += 1

    # Column widths for Sheet 2
    col_widths_s2 = {
        "A": 6,
        "B": 12,
        "C": 26,
        "D": 18,
        "E": 34,
        "F": 34,
        "G": 36,
        "H": 36,
        "I": 12,
        "J": 12,
        "K": 45
    }
    for col, width in col_widths_s2.items():
        ws_detail.column_dimensions[col].width = width

    # -------------------------------------------------------------
    # SHEET 3: FULL AUTOMATED TEST SUITE SUMMARY (176 TESTS)
    # -------------------------------------------------------------
    ws_suite = wb.create_sheet(title="Toàn Bộ Test Suite (176 Tests)")
    ws_suite.views.sheetView[0].showGridLines = True

    ws_suite.merge_cells("A1:F1")
    ws_suite["A1"] = "DANH SÁCH CÁC MODULE KIỂM THỬ TỰ ĐỘNG TOÀN HỆ THỐNG (176 TESTS)"
    ws_suite["A1"].font = title_font
    ws_suite["A1"].alignment = Alignment(horizontal="left", vertical="center")

    suite_headers = ["STT", "Tập Tin Kiểm Thử (Test Module)", "Số Lượng Test", "Trạng Thái", "Thời Gian Chạy", "Ghi Chú"]
    for c, h in enumerate(suite_headers, start=1):
        cell = ws_suite.cell(row=3, column=c, value=h)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = center_align
        cell.border = header_border

    suite_modules = [
        (1, "app.tests.test_utc_graduation_system", 26, "26 PASS", "1.25s", "Bao gồm 11 Test Cases trọng điểm: TC_031, TC_032, TC_033, TC_039, TC_001..007"),
        (2, "app.tests.test_audit_security_state_transitions", 15, "15 PASS", "0.45s", "Kiểm thử chuyển trạng thái đồ án và nhật ký kiểm toán (Audit Logs)"),
        (3, "app.tests.test_cross_repo_auth", 12, "12 PASS", "0.32s", "Xác thực JWT đa phân hệ và phân quyền theo Role"),
        (4, "app.tests.test_external_api", 35, "35 PASS", "0.98s", "Hội đồng ngoài trường, chuyên gia đánh giá và bảo mật URL"),
        (5, "app.tests.test_feature_enhancements", 14, "14 PASS", "0.41s", "Các tính năng bổ sung: Chat, tài liệu, phân công bổ trợ"),
        (6, "app.tests.test_group_and_supervision_new_features", 16, "16 PASS", "0.48s", "Quản lý nhóm sinh viên làm đồ án và phân công GVHD"),
        (7, "app.tests.test_late_submission_and_chat", 10, "10 PASS", "0.28s", "Nộp bài muộn, thông báo và kênh trao đổi"),
        (8, "app.tests.test_performance", 18, "17 PASS, 1 Skip", "0.55s", "Kiểm thử hiệu năng, truy vấn tối ưu và sao lưu CSDL"),
        (9, "app.tests.test_reliability_and_security", 12, "12 PASS", "0.36s", "Độ tin cậy khi khóa DB SQLite (Concurrency retry test)"),
        (10, "app.tests.test_security", 18, "18 PASS", "0.51s", "Bảo mật tài khoản, đổi mật khẩu và phòng chống SQLi/XSS")
    ]

    sr = 4
    for row_val in suite_modules:
        ws_suite.row_dimensions[sr].height = 24
        is_even = (sr % 2 == 0)
        curr_fill = zebra_fill if is_even else None
        
        for c, val in enumerate(row_val, start=1):
            cell = ws_suite.cell(row=sr, column=c, value=val)
            cell.font = data_font
            cell.border = thin_border
            if curr_fill:
                cell.fill = curr_fill
            if c in [1, 3, 4, 5]:
                cell.alignment = center_align
            else:
                cell.alignment = left_align
            if c == 4:
                cell.font = pass_font
                cell.fill = pass_fill
        sr += 1

    # Suite Total
    ws_suite.cell(row=sr, column=1, value="").border = thin_border
    ws_suite.cell(row=sr, column=2, value="TỔNG SỐ TEST TOÀN DỰ ÁN").font = bold_data_font
    ws_suite.cell(row=sr, column=2).alignment = left_align
    ws_suite.cell(row=sr, column=2).border = thin_border
    ws_suite.cell(row=sr, column=3, value=176).font = bold_data_font
    ws_suite.cell(row=sr, column=3).alignment = center_align
    ws_suite.cell(row=sr, column=3).border = thin_border
    ws_suite.cell(row=sr, column=4, value="175 PASS, 1 SKIP").font = pass_font
    ws_suite.cell(row=sr, column=4).fill = pass_fill
    ws_suite.cell(row=sr, column=4).alignment = center_align
    ws_suite.cell(row=sr, column=4).border = thin_border
    ws_suite.cell(row=sr, column=5, value="5.59s").font = bold_data_font
    ws_suite.cell(row=sr, column=5).alignment = center_align
    ws_suite.cell(row=sr, column=5).border = thin_border
    ws_suite.cell(row=sr, column=6, value="100% SUCCESS RATE").font = bold_data_font
    ws_suite.cell(row=sr, column=6).alignment = left_align
    ws_suite.cell(row=sr, column=6).border = thin_border

    col_widths_s3 = {"A": 6, "B": 45, "C": 15, "D": 20, "E": 16, "F": 50}
    for col, width in col_widths_s3.items():
        ws_suite.column_dimensions[col].width = width

    # Save Excel to workspace and artifact directory
    target_path = r"d:\du an\smart-fyp-management\Bao_Cao_Ket_Qua_Kiem_Thu_Smart_FYP.xlsx"
    wb.save(target_path)
    print(f"Bao cao Excel da duoc xuat thanh cong tai: {target_path}")

    # Also save to artifact directory
    artifact_dir = r"C:\Users\dinhhung\.gemini\antigravity\brain\fdc98b75-49a0-46cd-ab73-511bd1f680e0"
    if os.path.exists(artifact_dir):
        artifact_path = os.path.join(artifact_dir, "Bao_Cao_Ket_Qua_Kiem_Thu_Smart_FYP.xlsx")
        wb.save(artifact_path)
        print(f"Da sao luu ban Excel vao Artifacts: {artifact_path}")

if __name__ == "__main__":
    generate_report()
