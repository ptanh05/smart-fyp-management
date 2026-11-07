import logging
import threading
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.http import HttpResponse
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from .permissions import IsSupervisorOrCommitteeMember
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from .models import (
    CustomUser,
    Student,
    Supervisor,
    SupervisorQuota,
    ProjectTopicArea,
    StudentPreference,
    InternshipInfo,
    GraduationProject,
    OutlineReview,
    WeeklyProgressReport,
    SupervisionMeetingLog,
    SupervisionTask,
    DefenseCouncil,
    CouncilMember,
    CouncilLiveScore,
    EvaluationPolicy,
    FinalGradeSummary,
    AcademicBatch,
    AuditLog,
    Notification,
    Project,
    Document,
    DocumentRequirement,
    Group,
    GroupMember,
    ProposedAllocation,
    ThesisDeferralRequest,
    DegreeProgram,
)
from .services import (
    NotificationService,
    CouncilConflictService,
    DegreeEligibilityService,
    ThesisAllocationService,
    AcademicClearanceService,
    CouncilStructureService,
)
from .serializers.utc_graduation_serializers import (
    ProjectTopicAreaSerializer,
    SupervisorBriefSerializer,
    InternshipInfoSerializer,
    OutlineReviewSerializer,
    WeeklyProgressReportSerializer,
    SupervisionMeetingLogSerializer,
    SupervisionTaskSerializer,
    CouncilLiveScoreSerializer,
    GraduationProjectDetailSerializer,
    FinalGradeSummarySerializer,
    ProposedAllocationSerializer,
    ThesisDeferralRequestSerializer,
    AcademicBatchSerializer,
)
from .validators import validate_uploaded_file
from .concurrency import retry_on_db_lock

logger = logging.getLogger(__name__)


# ==============================================================================
# MODULE 1: BATCH INITIALIZATION & STUDENT IMPORT APIS (TC_031, TC_032, TC_033)
# ==============================================================================

class BatchCreateAPIView(APIView):
    """
    Khoa khá»Ÿi táº¡o Ä‘á»£t Ä‘á»“ Ã¡n má»›i, thiáº¿t láº­p thá»i gian báº¯t Ä‘áº§u vÃ  káº¿t thÃºc (TC_031).
    Endpoint: /app/batch/create/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        batches = AcademicBatch.objects.all().order_by("-created_at")
        serializer = AcademicBatchSerializer(batches, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        user = request.user
        data = request.data
        batch_code = str(data.get("batch_code", "")).strip()
        batch_name = str(data.get("batch_name", "")).strip()
        start_date = data.get("start_date")
        end_date = data.get("end_date")
        is_active = data.get("is_active", True)
        if isinstance(is_active, str):
            is_active = is_active.lower() in ("true", "1", "yes")

        errors = {}
        if not batch_code:
            errors["batch_code"] = ["MÃ£ Ä‘á»£t Ä‘á»“ Ã¡n khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng."]
        elif AcademicBatch.objects.filter(batch_code=batch_code).exists():
            errors["batch_code"] = ["MÃ£ Ä‘á»£t Ä‘á»“ Ã¡n Ä‘Ã£ tá»“n táº¡i. Vui lÃ²ng chá»n mÃ£ khÃ¡c."]

        if not batch_name:
            errors["batch_name"] = ["TÃªn Ä‘á»£t Ä‘á»“ Ã¡n khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng."]

        if start_date and end_date:
            try:
                import datetime
                if isinstance(start_date, str):
                    sd = datetime.date.fromisoformat(start_date)
                else:
                    sd = start_date
                if isinstance(end_date, str):
                    ed = datetime.date.fromisoformat(end_date)
                else:
                    ed = end_date
                if sd > ed:
                    errors["end_date"] = ["Thá»i gian káº¿t thÃºc pháº£i sau hoáº·c báº±ng thá»i gian báº¯t Ä‘áº§u."]
            except (ValueError, TypeError):
                errors["dates"] = ["Äá»‹nh dáº¡ng ngÃ y thÃ¡ng khÃ´ng há»£p lá»‡ (YYYY-MM-DD)."]

        if errors:
            return Response(errors, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            batch = AcademicBatch.objects.create(
                batch_code=batch_code,
                batch_name=batch_name,
                start_date=start_date or None,
                end_date=end_date or None,
                is_active=is_active
            )
            # Ensure evaluation policy exists for batch
            EvaluationPolicy.objects.get_or_create(
                batch=batch,
                defaults={
                    "weight_supervisor": 0.3,
                    "weight_reviewer": 0.2,
                    "weight_council": 0.5,
                }
            )

        AuditLog.objects.create(
            user=user,
            action_type="status_change",
            description=f"Khoa khá»Ÿi táº¡o Ä‘á»£t Ä‘á»“ Ã¡n má»›i: {batch.batch_name} ({batch.batch_code})."
        )

        return Response({
            "success": True,
            "message": f"Khoa khá»Ÿi táº¡o Ä‘á»£t Ä‘á»“ Ã¡n '{batch.batch_name}' thÃ nh cÃ´ng.",
            "batch": AcademicBatchSerializer(batch).data
        }, status=status.HTTP_201_CREATED)


class StudentImportAPIView(APIView):
    """
    Khoa Import danh sÃ¡ch sinh viÃªn Cá»­ nhÃ¢n / Ká»¹ sÆ° báº±ng file Ä‘á»‹nh dáº¡ng máº«u (Excel/CSV).
    - TC_032 (Positive): Import danh sÃ¡ch sinh viÃªn Cá»­ nhÃ¢n/Ká»¹ sÆ° thÃ nh cÃ´ng tá»« file máº«u Excel (.xlsx, .xls) hoáº·c CSV (.csv).
    - TC_033 (Negative): Báº¯t lá»—i vÃ  tá»« chá»‘i khi file sai Ä‘á»‹nh dáº¡ng, thiáº¿u cá»™t báº¯t buá»™c, hoáº·c sai chuáº©n dá»¯ liá»‡u (tráº£ vá» HTTP 400).
    Endpoint: /app/students/import/
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        file_obj = (
            request.FILES.get("file")
            or request.FILES.get("student_file")
            or request.FILES.get("excel_file")
            or request.FILES.get("csv_file")
        )
        if not file_obj:
            return Response({
                "success": False,
                "error": "missing_file",
                "detail": "Vui lÃ²ng chá»n tá»‡p danh sÃ¡ch sinh viÃªn (.xlsx, .xls hoáº·c .csv) Ä‘á»ƒ táº£i lÃªn."
            }, status=status.HTTP_400_BAD_REQUEST)

        # 1. Check file extension
        import os
        ext = os.path.splitext(file_obj.name)[1].lower()
        if ext not in [".xlsx", ".xls", ".csv"]:
            return Response({
                "success": False,
                "error": "invalid_file_format",
                "detail": f"Äá»‹nh dáº¡ng tá»‡p '{ext}' khÃ´ng Ä‘Æ°á»£c há»— trá»£. Há»‡ thá»‘ng chá»‰ cháº¥p nháº­n tá»‡p Excel (.xlsx, .xls) hoáº·c CSV (.csv)."
            }, status=status.HTTP_400_BAD_REQUEST)

        # 2. Identify target AcademicBatch
        batch_id = request.data.get("batch_id")
        batch = None
        if batch_id:
            batch = AcademicBatch.objects.filter(id=batch_id).first()
        if not batch:
            batch = AcademicBatch.get_active_batch() or AcademicBatch.objects.last()

        # 3. Parse content
        rows = []
        raw_headers = []
        try:
            if ext in [".xlsx", ".xls"]:
                import openpyxl
                file_obj.seek(0)
                wb = openpyxl.load_workbook(file_obj, data_only=True)
                sheet = wb.active
                all_rows = list(sheet.iter_rows(values_only=True))
                if not all_rows or len(all_rows) < 2:
                    return Response({
                        "success": False,
                        "error": "empty_file",
                        "detail": "Tá»‡p Excel khÃ´ng chá»©a dá»¯ liá»‡u hoáº·c chá»‰ cÃ³ tiÃªu Ä‘á»."
                    }, status=status.HTTP_400_BAD_REQUEST)
                raw_headers = [str(cell).strip() if cell is not None else "" for cell in all_rows[0]]
                for r in all_rows[1:]:
                    if any(cell is not None and str(cell).strip() != "" for cell in r):
                        row_dict = {}
                        for h_idx, h in enumerate(raw_headers):
                            if h:
                                val = r[h_idx] if h_idx < len(r) else None
                                row_dict[h] = val
                        rows.append(row_dict)
            else:  # .csv
                import csv
                import io
                file_obj.seek(0)
                content = file_obj.read()
                for enc in ["utf-8-sig", "utf-8", "latin-1"]:
                    try:
                        text_stream = io.StringIO(content.decode(enc))
                        reader = csv.DictReader(text_stream)
                        raw_headers = reader.fieldnames or []
                        rows = [r for r in reader if any(v and v.strip() for v in r.values() if v is not None)]
                        break
                    except UnicodeDecodeError:
                        continue

                if not rows:
                    return Response({
                        "success": False,
                        "error": "empty_file",
                        "detail": "Tá»‡p CSV khÃ´ng chá»©a dá»¯ liá»‡u hoáº·c chá»‰ cÃ³ tiÃªu Ä‘á»."
                    }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({
                "success": False,
                "error": "parse_error",
                "detail": f"KhÃ´ng thá»ƒ Ä‘á»c ná»™i dung tá»‡p: {str(e)}"
            }, status=status.HTTP_400_BAD_REQUEST)

        # 4. Normalize and validate required columns (TC_033)
        def normalize_col_name(c):
            import unicodedata
            clean = str(c).replace("Ä‘", "d").replace("Ä", "D")
            norm = unicodedata.normalize('NFKD', clean).encode('ASCII', 'ignore').decode('utf-8')
            return norm.lower().strip().replace(" ", "_").replace(".", "").replace("-", "_")

        header_norm_map = {normalize_col_name(h): h for h in raw_headers if h}

        # Match columns
        reg_col = None
        for candidate in ["registration_no", "student_id", "ma_sv", "mssv", "ma_sinh_vien", "masv"]:
            if candidate in header_norm_map:
                reg_col = header_norm_map[candidate]
                break

        name_col = None
        for candidate in ["full_name", "ho_ten", "ho_va_ten", "ten_sinh_vien", "ho_ten_sinh_vien", "name", "ten"]:
            if candidate in header_norm_map:
                name_col = header_norm_map[candidate]
                break

        prog_col = None
        for candidate in ["degree_program", "he_dao_tao", "he", "chuong_trinh", "chuong_trinh_dao_tao", "program", "program_type"]:
            if candidate in header_norm_map:
                prog_col = header_norm_map[candidate]
                break

        email_col = None
        for candidate in ["email", "thu_dien_tu", "email_lms"]:
            if candidate in header_norm_map:
                email_col = header_norm_map[candidate]
                break

        class_col = None
        for candidate in ["class_name", "lop", "lop_hoc_phan", "lop_sinh_hoat", "department", "khoa"]:
            if candidate in header_norm_map:
                class_col = header_norm_map[candidate]
                break

        missing_columns = []
        if not reg_col:
            missing_columns.append("MÃ£ sinh viÃªn (registration_no / ma_sv / mssv)")
        if not name_col:
            missing_columns.append("Há» vÃ  tÃªn (full_name / ho_ten)")
        if not prog_col:
            missing_columns.append("Há»‡ Ä‘Ã o táº¡o (degree_program / he_dao_tao)")

        if missing_columns:
            return Response({
                "success": False,
                "error": "missing_required_columns",
                "detail": f"Tá»‡p danh sÃ¡ch thiáº¿u cÃ¡c cá»™t báº¯t buá»™c: {', '.join(missing_columns)}. Vui lÃ²ng sá»­ dá»¥ng file máº«u chuáº©n.",
                "missing_columns": missing_columns,
                "found_columns": raw_headers
            }, status=status.HTTP_400_BAD_REQUEST)

        # 5. Row-level data validation (TC_033)
        row_errors = []
        valid_records = []

        for idx, row in enumerate(rows, start=2):
            reg_val = str(row.get(reg_col) or "").strip()
            name_val = str(row.get(name_col) or "").strip()
            prog_val = str(row.get(prog_col) or "").strip()
            email_val = str(row.get(email_col) or "").strip() if email_col else ""
            dept_val = str(row.get(class_col) or "").strip() if class_col else "CNTT"

            if reg_val.endswith('.0'):
                reg_val = reg_val[:-2]

            if not reg_val:
                row_errors.append(f"DÃ²ng {idx}: MÃ£ sinh viÃªn khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng.")
                continue

            import re
            if not re.match(r"^\d{9}$", reg_val):
                row_errors.append(f"DÃ²ng {idx}: MÃ£ sinh viÃªn '{reg_val}' khÃ´ng há»£p lá»‡ (MÃ£ sinh viÃªn UTC pháº£i gá»“m Ä‘Ãºng 9 chá»¯ sá»‘).")
                continue

            if not name_val:
                row_errors.append(f"DÃ²ng {idx}: Há» vÃ  tÃªn sinh viÃªn khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng.")
                continue

            # Standardize degree program
            import unicodedata
            clean_prog = str(prog_val).replace("Ä‘", "d").replace("Ä", "D")
            norm_prog = unicodedata.normalize('NFKD', clean_prog).encode('ASCII', 'ignore').decode('utf-8').upper()
            if any(k in norm_prog for k in ["KY SU", "ENGINEER", "KS"]):
                degree_program = DegreeProgram.ENGINEER
            elif any(k in norm_prog for k in ["CU NHAN", "BACHELOR", "CN"]):
                degree_program = DegreeProgram.BACHELOR
            else:
                row_errors.append(f"DÃ²ng {idx}: Há»‡ Ä‘Ã o táº¡o '{prog_val}' khÃ´ng há»£p lá»‡ (Chá»‰ cháº¥p nháº­n 'Ká»¹ sÆ°' hoáº·c 'Cá»­ nhÃ¢n').")
                continue

            # Check email syntax if provided
            if email_val:
                if "@" not in email_val or "." not in email_val.split("@")[-1]:
                    row_errors.append(f"DÃ²ng {idx}: Email '{email_val}' khÃ´ng Ä‘Ãºng Ä‘á»‹nh dáº¡ng.")
                    continue
            else:
                email_val = f"{reg_val.lower()}@lms.utc.edu.vn"

            valid_records.append({
                "row_number": idx,
                "registration_no": reg_val,
                "full_name": name_val,
                "degree_program": degree_program,
                "email": email_val,
                "department": dept_val,
            })

        # If there are data validation errors (TC_033), reject the import
        if row_errors:
            return Response({
                "success": False,
                "error": "data_validation_failed",
                "detail": f"Dá»¯ liá»‡u trong tá»‡p khÃ´ng Ä‘áº¡t chuáº©n ({len(row_errors)} lá»—i phÃ¡t hiá»‡n). Vui lÃ²ng kiá»ƒm tra láº¡i dá»¯ liá»‡u.",
                "errors_count": len(row_errors),
                "errors": row_errors[:20]
            }, status=status.HTTP_400_BAD_REQUEST)

        # 6. Execute Import (TC_032 - Positive)
        imported_students = []
        engineer_count = 0
        bachelor_count = 0

        with transaction.atomic():
            for rec in valid_records:
                reg_no = rec["registration_no"]
                full_name = rec["full_name"]
                email = rec["email"]
                deg_prog = rec["degree_program"]
                dept = rec["department"]

                parts = full_name.split()
                if len(parts) > 1:
                    first_name = parts[-1]
                    last_name = " ".join(parts[:-1])
                else:
                    first_name = full_name
                    last_name = ""

                user, u_created = CustomUser.objects.update_or_create(
                    username=reg_no,
                    defaults={
                        "email": email,
                        "first_name": first_name,
                        "last_name": last_name,
                        "user_type": "student",
                    }
                )
                if u_created:
                    user.set_password("Utc@123456")
                    user.save()

                student, s_created = Student.objects.update_or_create(
                    user=user,
                    defaults={
                        "registration_no": reg_no,
                        "degree_program": deg_prog,
                        "department": dept,
                        "academic_batch": batch,
                    }
                )

                if deg_prog == DegreeProgram.ENGINEER:
                    engineer_count += 1
                else:
                    bachelor_count += 1

                imported_students.append({
                    "registration_no": student.registration_no,
                    "full_name": user.get_full_name() or full_name,
                    "degree_program": student.degree_program,
                    "degree_program_display": student.get_degree_program_display(),
                    "email": user.email,
                    "department": student.department,
                    "batch": batch.batch_code if batch else None,
                })

        AuditLog.objects.create(
            user=request.user,
            action_type="status_change",
            description=f"Khoa import thÃ nh cÃ´ng {len(imported_students)} sinh viÃªn (Ká»¹ sÆ°: {engineer_count}, Cá»­ nhÃ¢n: {bachelor_count})."
        )

        return Response({
            "success": True,
            "message": f"Khoa Ä‘Ã£ import thÃ nh cÃ´ng {len(imported_students)} sinh viÃªn (Ká»¹ sÆ°: {engineer_count}, Cá»­ nhÃ¢n: {bachelor_count}).",
            "total_imported": len(imported_students),
            "engineer_count": engineer_count,
            "bachelor_count": bachelor_count,
            "batch_code": batch.batch_code if batch else None,
            "students": imported_students
        }, status=status.HTTP_201_CREATED)


class AcademicGradesImportAPIView(APIView):
    """
    TC-032: GiÃ¡o vá»¥ Import file Ä‘iá»ƒm Excel/CSV tá»± Ä‘á»™ng Ä‘á»ƒ xÃ©t Ä‘iá»u kiá»‡n há»c vá»¥:
    - Báº¯t lá»—i chi tiáº¿t khi file bá»‹ sai Ä‘á»‹nh dáº¡ng / sai header (HTTP 400 kÃ¨m missing_columns).
    - BÃ¡o lá»—i chi tiáº¿t dÃ²ng lá»—i (HTTP 400 kÃ¨m danh sÃ¡ch row_errors: dÃ²ng sá»‘ máº¥y, trÆ°á»ng nÃ o, lá»—i gÃ¬).
    - Cáº­p nháº­t CPA, tÃ­n chá»‰ tÃ­ch lÅ©y, ná»£ tÃ­n chá»‰ cho sinh viÃªn khi há»£p lá»‡.
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        user = request.user
        if getattr(user, "user_type", "") == "student":
            return Response(
                {"detail": "Sinh viÃªn khÃ´ng cÃ³ quyá»n Import Ä‘iá»ƒm há»c vá»¥ (Chá»‰ dÃ nh cho GiÃ¡o vá»¥/Khoa).", "message": "Lá»—i 403 Forbidden"},
                status=status.HTTP_403_FORBIDDEN
            )

        file_obj = (
            request.FILES.get("file")
            or request.FILES.get("grades_file")
            or request.FILES.get("excel_file")
            or request.FILES.get("transcript_file")
        )
        if not file_obj:
            return Response({
                "success": False,
                "error": "missing_file",
                "detail": "Vui lÃ²ng chá»n tá»‡p báº£ng Ä‘iá»ƒm (.xlsx, .xls hoáº·c .csv) Ä‘á»ƒ táº£i lÃªn."
            }, status=status.HTTP_400_BAD_REQUEST)

        import os
        ext = os.path.splitext(file_obj.name)[1].lower()
        if ext not in [".xlsx", ".xls", ".csv"]:
            return Response({
                "success": False,
                "error": "invalid_file_format",
                "detail": f"Äá»‹nh dáº¡ng tá»‡p '{ext}' khÃ´ng Ä‘Æ°á»£c há»— trá»£. Há»‡ thá»‘ng chá»‰ cháº¥p nháº­n tá»‡p Excel (.xlsx, .xls) hoáº·c CSV (.csv)."
            }, status=status.HTTP_400_BAD_REQUEST)

        # Parse file
        rows = []
        raw_headers = []
        try:
            if ext in [".xlsx", ".xls"]:
                import openpyxl
                file_obj.seek(0)
                wb = openpyxl.load_workbook(file_obj, data_only=True)
                sheet = wb.active
                all_rows = list(sheet.iter_rows(values_only=True))
                if not all_rows or len(all_rows) < 2:
                    return Response({
                        "success": False,
                        "error": "empty_file",
                        "detail": "Tá»‡p Excel khÃ´ng chá»©a dá»¯ liá»‡u hoáº·c chá»‰ cÃ³ tiÃªu Ä‘á»."
                    }, status=status.HTTP_400_BAD_REQUEST)
                raw_headers = [str(c).strip() if c is not None else "" for c in all_rows[0]]
                for r in all_rows[1:]:
                    if any(cell is not None and str(cell).strip() != "" for cell in r):
                        row_dict = {}
                        for h_idx, h in enumerate(raw_headers):
                            if h:
                                val = r[h_idx] if h_idx < len(r) else None
                                row_dict[h] = val
                        rows.append(row_dict)
            else:
                import csv
                import io
                file_obj.seek(0)
                content = file_obj.read()
                for enc in ["utf-8-sig", "utf-8", "latin-1"]:
                    try:
                        text_stream = io.StringIO(content.decode(enc))
                        reader = csv.DictReader(text_stream)
                        raw_headers = reader.fieldnames or []
                        rows = [r for r in reader if any(v and v.strip() for v in r.values() if v is not None)]
                        break
                    except UnicodeDecodeError:
                        continue
                if not rows:
                    return Response({
                        "success": False,
                        "error": "empty_file",
                        "detail": "Tá»‡p CSV khÃ´ng chá»©a dá»¯ liá»‡u hoáº·c chá»‰ cÃ³ tiÃªu Ä‘á»."
                    }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({
                "success": False,
                "error": "parse_error",
                "detail": f"KhÃ´ng thá»ƒ Ä‘á»c ná»™i dung tá»‡p: {str(e)}"
            }, status=status.HTTP_400_BAD_REQUEST)

        # Header normalization and verification
        def norm_header(h):
            import unicodedata
            clean = str(h).replace("Ä‘", "d").replace("Ä", "D")
            norm = unicodedata.normalize('NFKD', clean).encode('ASCII', 'ignore').decode('utf-8')
            return norm.lower().strip().replace(" ", "_").replace(".", "").replace("-", "_")

        header_norm_map = {norm_header(h): h for h in raw_headers if h}

        # Check MSSV column
        reg_col = None
        for cand in ["registration_no", "student_id", "ma_sv", "mssv", "ma_sinh_vien", "masv"]:
            if cand in header_norm_map:
                reg_col = header_norm_map[cand]
                break

        # Check CPA column
        cpa_col = None
        for cand in ["cpa", "gpa", "diem_cpa", "diem_tb", "diem_tich_luy", "cpa_he_4"]:
            if cand in header_norm_map:
                cpa_col = header_norm_map[cand]
                break

        # Check Credits column
        cred_col = None
        for cand in ["credits", "credits_accumulated", "so_tin_chi", "tin_chi", "tin_chi_tich_luy"]:
            if cand in header_norm_map:
                cred_col = header_norm_map[cand]
                break

        # Optional debt credits
        debt_col = None
        for cand in ["debt_credits", "no_tin_chi", "tin_chi_no", "so_tin_chi_no"]:
            if cand in header_norm_map:
                debt_col = header_norm_map[cand]
                break

        missing_headers = []
        if not reg_col:
            missing_headers.append("MÃ£ sinh viÃªn (mssv / registration_no / ma_sv)")
        if not cpa_col:
            missing_headers.append("Äiá»ƒm CPA (cpa / gpa / diem_cpa)")
        if not cred_col:
            missing_headers.append("TÃ­n chá»‰ tÃ­ch lÅ©y (credits / tin_chi_tich_luy)")

        if missing_headers:
            return Response({
                "success": False,
                "error": "invalid_header",
                "detail": f"File Ä‘iá»ƒm Excel bá»‹ lá»—i header / thiáº¿u cá»™t báº¯t buá»™c: {', '.join(missing_headers)}. Vui lÃ²ng kiá»ƒm tra láº¡i cáº¥u trÃºc file máº«u.",
                "missing_columns": missing_headers,
                "found_columns": raw_headers,
            }, status=status.HTTP_400_BAD_REQUEST)

        # Row-level validation
        row_errors = []
        valid_updates = []

        for idx, row in enumerate(rows, start=2):
            reg_val = str(row.get(reg_col) or "").strip()
            cpa_raw = row.get(cpa_col)
            cred_raw = row.get(cred_col)
            debt_raw = row.get(debt_col) if debt_col else None

            if reg_val.endswith('.0'):
                reg_val = reg_val[:-2]

            if not reg_val:
                row_errors.append(f"DÃ²ng {idx}: MÃ£ sinh viÃªn khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng.")
                continue

            import re
            if not re.match(r"^\d{9}$", reg_val):
                row_errors.append(f"DÃ²ng {idx}: MÃ£ sinh viÃªn '{reg_val}' khÃ´ng há»£p lá»‡ (MÃ£ sinh viÃªn UTC pháº£i gá»“m Ä‘Ãºng 9 chá»¯ sá»‘).")
                continue

            student = Student.objects.filter(registration_no=reg_val).first()
            if not student:
                row_errors.append(f"DÃ²ng {idx}: KhÃ´ng tÃ¬m tháº¥y sinh viÃªn cÃ³ MSSV '{reg_val}' trong há»‡ thá»‘ng.")
                continue

            # Validate CPA
            try:
                cpa_val = float(str(cpa_raw).replace(",", ".").strip())
                if cpa_val < 0.0 or cpa_val > 4.0:
                    row_errors.append(f"DÃ²ng {idx}: Äiá»ƒm CPA '{cpa_raw}' khÃ´ng há»£p lá»‡ (Pháº£i lÃ  sá»‘ thá»±c tá»« 0.0 Ä‘áº¿n 4.0).")
                    continue
            except (ValueError, TypeError):
                row_errors.append(f"DÃ²ng {idx}: Äiá»ƒm CPA '{cpa_raw}' khÃ´ng Ä‘Ãºng Ä‘á»‹nh dáº¡ng sá»‘ thá»±c.")
                continue

            # Validate Credits
            try:
                cred_val = int(float(str(cred_raw).strip()))
                if cred_val < 0:
                    row_errors.append(f"DÃ²ng {idx}: Sá»‘ tÃ­n chá»‰ tÃ­ch lÅ©y '{cred_raw}' khÃ´ng Ä‘Æ°á»£c lÃ  sá»‘ Ã¢m.")
                    continue
            except (ValueError, TypeError):
                row_errors.append(f"DÃ²ng {idx}: Sá»‘ tÃ­n chá»‰ tÃ­ch lÅ©y '{cred_raw}' khÃ´ng Ä‘Ãºng Ä‘á»‹nh dáº¡ng sá»‘ nguyÃªn.")
                continue

            # Validate Debt Credits if present
            debt_val = 0
            if debt_raw is not None and str(debt_raw).strip() != "":
                try:
                    debt_val = int(float(str(debt_raw).strip()))
                    if debt_val < 0:
                        row_errors.append(f"DÃ²ng {idx}: Sá»‘ tÃ­n chá»‰ ná»£ '{debt_raw}' khÃ´ng Ä‘Æ°á»£c lÃ  sá»‘ Ã¢m.")
                        continue
                except (ValueError, TypeError):
                    row_errors.append(f"DÃ²ng {idx}: Sá»‘ tÃ­n chá»‰ ná»£ '{debt_raw}' khÃ´ng Ä‘Ãºng Ä‘á»‹nh dáº¡ng sá»‘ nguyÃªn.")
                    continue

            valid_updates.append({
                "student": student,
                "cpa": cpa_val,
                "credits": cred_val,
                "debt_credits": debt_val,
            })

        if row_errors:
            return Response({
                "success": False,
                "error": "invalid_rows_data",
                "detail": f"Import file Ä‘iá»ƒm tháº¥t báº¡i: PhÃ¡t hiá»‡n {len(row_errors)} dÃ²ng dá»¯ liá»‡u bá»‹ lá»—i Ä‘á»‹nh dáº¡ng.",
                "row_errors": row_errors,
                "error_count": len(row_errors),
                "total_rows": len(rows),
            }, status=status.HTTP_400_BAD_REQUEST)

        # Save valid records
        with transaction.atomic():
            for item in valid_updates:
                std = item["student"]
                std.cpa = item["cpa"]
                std.credits_accumulated = item["credits"]
                is_eligible = (item["debt_credits"] < 10)
                std.is_eligible_for_thesis = is_eligible
                std.save(update_fields=["cpa", "credits_accumulated", "is_eligible_for_thesis"])

                proj = getattr(std, "graduation_project", None)
                if proj:
                    proj.debt_credits = item["debt_credits"]
                    proj.initial_eligibility = "ELIGIBLE" if is_eligible else "INELIGIBLE"
                    proj.academic_clearance_status = "CLEARED" if is_eligible else "NOT_CLEARED"
                    if is_eligible:
                        proj.ineligibility_reason = f"Äá»§ Ä‘iá»u kiá»‡n lÃ m Ä‘á»“ Ã¡n (Ná»£ {item['debt_credits']} TC < 10 TC)"
                    else:
                        proj.status = "DEFERRED"
                        proj.deferral_status = "APPROVED"
                        proj.deferral_reason = f"Báº£o lÆ°u do ná»£ {item['debt_credits']} tÃ­n chá»‰ (>= 10 TC theo quy Ä‘á»‹nh)"
                        proj.deferral_decided_at = timezone.now()
                        proj.ineligibility_reason = f"Ná»£ {item['debt_credits']} tÃ­n chá»‰ (>= 10 TC theo quy Ä‘á»‹nh) - Tá»± Ä‘á»™ng loáº¡i khá»i Ä‘á»£t vÃ  báº£o lÆ°u"
                    proj.save(update_fields=[
                        "debt_credits", "initial_eligibility", "academic_clearance_status",
                        "status", "ineligibility_reason", "deferral_status",
                        "deferral_reason", "deferral_decided_at"
                    ])

        return Response({
            "success": True,
            "message": f"Import báº£ng Ä‘iá»ƒm thÃ nh cÃ´ng cho {len(valid_updates)} sinh viÃªn!",
            "total_updated": len(valid_updates),
        }, status=status.HTTP_200_OK)


# ==============================================================================
# STUDENT SURVEY & ONBOARDING API
# ==============================================================================

class StudentSurveyAPIView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        user = request.user
        if user.user_type != "student":
            return Response({"detail": "Chá»‰ dÃ nh cho tÃ i khoáº£n sinh viÃªn."}, status=status.HTTP_403_FORBIDDEN)

        student = getattr(user, "student_profile", None)
        if not student:
            return Response({"detail": "Há»“ sÆ¡ sinh viÃªn khÃ´ng tá»“n táº¡i."}, status=status.HTTP_404_NOT_FOUND)

        batch = student.academic_batch or AcademicBatch.get_active_batch()
        
        from django.core.cache import cache

        topic_areas_data = cache.get("utc_active_topic_areas_data")
        if topic_areas_data is None:
            topic_areas = ProjectTopicArea.objects.filter(is_active=True)
            topic_areas_data = ProjectTopicAreaSerializer(topic_areas, many=True).data
            cache.set("utc_active_topic_areas_data", topic_areas_data, 600)

        supervisors_data = cache.get("utc_active_supervisors_brief_data")
        if supervisors_data is None:
            supervisors = (
                Supervisor.objects.filter(is_active=True)
                .select_related("user")
                .prefetch_related("topic_area_links__topic_area")
                .order_by("user__first_name")
            )
            supervisors_data = SupervisorBriefSerializer(supervisors, many=True).data
            cache.set("utc_active_supervisors_brief_data", supervisors_data, 300)

        survey = InternshipInfo.objects.filter(student=student).first()
        survey_data = InternshipInfoSerializer(survey).data if survey else None

        # Lá»c & Ä‘á» xuáº¥t giáº£ng viÃªn theo chuyÃªn ngÃ nh (hÆ°á»›ng nghiÃªn cá»©u) Ä‘Ã£ chá»n
        selected_topic_id = request.query_params.get("topic_area_id") or ""
        if not selected_topic_id and survey and survey.topic_direction_id:
            selected_topic_id = str(survey.topic_direction_id)

        supervisors_for_topic = []
        if selected_topic_id:
            try:
                selected_topic_id_int = int(selected_topic_id)
            except (TypeError, ValueError):
                selected_topic_id_int = None

            if selected_topic_id_int:
                topic_ids = {s.get("id") for s in topic_areas_data}
                if selected_topic_id_int in topic_ids:
                    for sup in supervisors_data:
                        sup["is_topic_match"] = selected_topic_id_int in (sup.get("topic_area_ids") or [])
                        if sup["is_topic_match"]:
                            supervisors_for_topic.append(sup)

        return Response({
            "student": {
                "id": student.id,
                "registration_no": student.registration_no,
                "full_name": user.get_full_name() or user.username,
                "email": user.email,
                "phone_number": student.phone_number,
                "department": student.department,
                "degree_program": student.degree_program,
                "degree_program_display": student.get_degree_program_display(),
                "cpa": student.cpa,
                "credits_accumulated": student.credits_accumulated,
                "is_eligible_for_thesis": student.is_eligible_for_thesis,
                "course_class": student.course_class.class_name if student.course_class else ""
            },
            "batch": {
                "id": getattr(batch, "id", None) if batch else None,
                "batch_code": getattr(batch, "batch_code", "") if batch else "",
                "batch_name": getattr(batch, "batch_name", "") if batch else ""
            },
            "topic_areas": topic_areas_data,
            "supervisors": supervisors_data,
            "selected_topic_area_id": selected_topic_id or "",
            "supervisors_for_topic": supervisors_for_topic,
            "survey": survey_data
        }, status=status.HTTP_200_OK)

    def post(self, request):
        user = request.user
        if user.user_type != "student":
            return Response({"detail": "Chá»‰ dÃ nh cho tÃ i khoáº£n sinh viÃªn."}, status=status.HTTP_403_FORBIDDEN)

        student = getattr(user, "student_profile", None)
        if not student:
            return Response({"detail": "Há»“ sÆ¡ sinh viÃªn khÃ´ng tá»“n táº¡i."}, status=status.HTTP_404_NOT_FOUND)

        batch = student.academic_batch or AcademicBatch.get_active_batch()
        if not batch:
            return Response({"detail": "KhÃ´ng cÃ³ Ä‘á»£t lÃ m Ä‘á»“ Ã¡n nÃ o Ä‘ang hoáº¡t Ä‘á»™ng."}, status=status.HTTP_400_BAD_REQUEST)

        data = request.data
        is_interning = str(data.get("is_interning", "false")).lower() in ["true", "1"]
        company_name = data.get("company_name", "").strip()
        topic_direction_id = data.get("topic_direction")
        
        pref1_id = data.get("preference_1") or data.get("preferred_supervisor")
        pref2_id = data.get("preference_2")
        pref3_id = data.get("preference_3")
        secondary_criteria_note = data.get("secondary_criteria_note", "").strip()

        tentative_title = data.get("tentative_title", "").strip()
        phone_number = data.get("phone_number", "").strip()
        email = data.get("email", "").strip()
        new_password = data.get("new_password", "").strip()

        # Validation
        if is_interning and not company_name:
            return Response({"company_name": ["Vui lÃ²ng nháº­p tÃªn cÃ´ng ty/doanh nghiá»‡p Ä‘ang thá»±c táº­p."]}, status=status.HTTP_400_BAD_REQUEST)

        topic_direction = ProjectTopicArea.objects.filter(id=topic_direction_id).first() if topic_direction_id else None
        
        sup1 = Supervisor.objects.filter(id=pref1_id).first() if pref1_id else None
        sup2 = Supervisor.objects.filter(id=pref2_id).first() if pref2_id else None
        sup3 = Supervisor.objects.filter(id=pref3_id).first() if pref3_id else None

        # Check duplicate preferences
        selected_sups = [s for s in [sup1, sup2, sup3] if s is not None]
        selected_ids = [s.id for s in selected_sups]
        if len(selected_ids) != len(set(selected_ids)):
            return Response({"detail": "CÃ¡c nguyá»‡n vá»ng NV1, NV2, NV3 khÃ´ng Ä‘Æ°á»£c trÃ¹ng nhau. Vui lÃ²ng chá»n cÃ¡c tháº§y cÃ´ khÃ¡c nhau!"}, status=status.HTTP_400_BAD_REQUEST)

        # NÃºt quyáº¿t Ä‘á»‹nh Giai Ä‘oáº¡n 2: SV Ká»¹ sÆ° -> Kiá»ƒm tra há»c vá»‹ GV tá»‘i thiá»ƒu (Tiáº¿n sÄ© trá»Ÿ lÃªn)
        try:
            DegreeEligibilityService.validate_preferences_for_student(student, selected_sups)
        except ValueError as ve:
            return Response({"detail": str(ve)}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            # Update student profile
            fields_to_save = []
            if phone_number:
                student.phone_number = phone_number
                fields_to_save.append("phone_number")
            if batch and not student.academic_batch:
                student.academic_batch = batch
                fields_to_save.append("academic_batch")
            if fields_to_save:
                student.save(update_fields=fields_to_save)

            if email:
                user.email = email
            if new_password and len(new_password) >= 6:
                user.set_password(new_password)
            user.save()

            # Update or create InternshipInfo
            survey, _ = InternshipInfo.objects.update_or_create(
                student=student,
                defaults={
                    "batch": batch,
                    "is_interning": is_interning,
                    "company_name": company_name if is_interning else "",
                    "topic_direction": topic_direction,
                    "tentative_title": tentative_title
                }
            )

            # Update or create StudentPreference
            StudentPreference.objects.update_or_create(
                student=student,
                defaults={
                    "batch": batch,
                    "topic_direction": topic_direction,
                    "preference_1": sup1,
                    "preference_2": sup2,
                    "preference_3": sup3,
                    "sub_criteria": secondary_criteria_note
                }
            )

        # Cáº£nh bÃ¡o (khÃ´ng cháº·n): GVHD Ä‘Æ°á»£c chá»n khÃ´ng thuá»™c chuyÃªn ngÃ nh sinh viÃªn Ä‘Ã£ chá»n
        warnings = []
        if topic_direction:
            for label, sup in (("NV1", sup1), ("NV2", sup2), ("NV3", sup3)):
                if sup and not sup.has_topic_area(topic_direction):
                    warnings.append(
                        f"{label}: {sup.user.get_full_name()} ({sup.academic_title or 'GV'}) "
                        f"khÃ´ng Ä‘Æ°á»£c Ä‘Äƒng kÃ½ chuyÃªn ngÃ nh \"{topic_direction.name}\"."
                    )

        response_data = {
            "message": "Cáº­p nháº­t kháº£o sÃ¡t vÃ  nguyá»‡n vá»ng thÃ nh cÃ´ng!",
            "survey": InternshipInfoSerializer(survey).data
        }
        if warnings:
            response_data["warnings"] = warnings
        return Response(response_data, status=status.HTTP_200_OK)


# ==============================================================================
# GRADUATION PROJECT & OUTLINE WORKFLOW
# ==============================================================================

class StudentGraduationProjectAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        student = getattr(user, "student_profile", None)
        if not student:
            return Response({"detail": "Há»“ sÆ¡ sinh viÃªn khÃ´ng tá»“n táº¡i."}, status=status.HTTP_404_NOT_FOUND)

        project = GraduationProject.objects.filter(student=student).select_related(
            "supervisor__user",
            "reviewer__user",
            "council",
            "topic_category",
            "final_grade_summary"
        ).first()

        if not project:
            return Response({
                "has_project": False,
                "message": "Báº¡n chÆ°a Ä‘Æ°á»£c phÃ¢n cÃ´ng Äá» tÃ i vÃ  Giáº£ng viÃªn hÆ°á»›ng dáº«n."
            }, status=status.HTTP_200_OK)

        try:
            NotificationService.sync_student_graduation_notifications(user)
        except Exception:
            pass

        return Response({
            "has_project": True,
            "project": GraduationProjectDetailSerializer(project).data
        }, status=status.HTTP_200_OK)


class StudentOutlineSubmissionAPIView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    @retry_on_db_lock(max_retries=5, initial_delay=0.05, backoff_factor=1.5)
    def post(self, request):
        user = request.user
        student = getattr(user, "student_profile", None)
        if not student:
            return Response({"detail": "Há»“ sÆ¡ sinh viÃªn khÃ´ng tá»“n táº¡i."}, status=status.HTTP_404_NOT_FOUND)

        project = GraduationProject.objects.filter(student=student).first()
        if not project:
            return Response({"detail": "ChÆ°a Ä‘Æ°á»£c phÃ¢n cÃ´ng Ä‘á» tÃ i."}, status=status.HTTP_400_BAD_REQUEST)

        topic_title_vi = request.data.get("topic_title_vi", "").strip()
        topic_title_en = request.data.get("topic_title_en", "").strip()
        outline_file = request.FILES.get("outline_file")

        if not topic_title_vi:
            return Response({"topic_title_vi": ["Vui lÃ²ng nháº­p tÃªn Ä‘á» tÃ i tiáº¿ng Viá»‡t."]}, status=status.HTTP_400_BAD_REQUEST)

        # Check for duplicated topic names
        is_duplicated = GraduationProject.objects.filter(
            topic_title_vi__iexact=topic_title_vi, status="PASSED"
        ).exclude(id=project.id).exists()
        if is_duplicated:
            return Response({"topic_title_vi": ["TÃªn Ä‘á» tÃ i Ä‘Ã£ trÃ¹ng láº·p vá»›i Ä‘á» tÃ i Ä‘Ã£ Ä‘Æ°á»£c nghiá»‡m thu tá»« cÃ¡c nÄƒm trÆ°á»›c."]}, status=status.HTTP_400_BAD_REQUEST)

        # File validation with binary magic checks
        if outline_file:
            try:
                validate_uploaded_file(outline_file, allowed_extensions=[".pdf"], max_size_bytes=25 * 1024 * 1024)
            except Exception as e:
                err_msg = getattr(e, "detail", str(e))
                if isinstance(err_msg, list):
                    err_msg = err_msg[0]
                return Response({"outline_file": [str(err_msg)]}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            project = GraduationProject.objects.select_for_update().get(id=project.id)
            project.topic_title_vi = topic_title_vi
            if topic_title_en:
                project.topic_title_en = topic_title_en
            project.status = "OUTLINE_PENDING"
            project.save()

            review, _ = OutlineReview.objects.select_for_update().get_or_create(project=project)
            if outline_file:
                review.outline_file = outline_file
            review.verdict = "PENDING"
            review.save()

        return Response({
            "message": "Ná»™p Ä‘á» cÆ°Æ¡ng thÃ nh cÃ´ng, Ä‘ang chá» Giáº£ng viÃªn xÃ©t duyá»‡t!",
            "project": GraduationProjectDetailSerializer(project).data
        }, status=status.HTTP_200_OK)


# ==============================================================================
# WEEKLY PROGRESS REPORTS (Week 1 -> 15)
# ==============================================================================

class StudentWeeklyReportAPIView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        user = request.user
        student = getattr(user, "student_profile", None)
        if not student:
            return Response({"detail": "Há»“ sÆ¡ sinh viÃªn khÃ´ng tá»“n táº¡i."}, status=status.HTTP_404_NOT_FOUND)

        project = GraduationProject.objects.filter(student=student).first()
        if not project:
            return Response({"detail": "ChÆ°a cÃ³ Ä‘á»“ Ã¡n."}, status=status.HTTP_400_BAD_REQUEST)

        reports = WeeklyProgressReport.objects.filter(project=project).order_by("week_number")
        return Response(WeeklyProgressReportSerializer(reports, many=True).data, status=status.HTTP_200_OK)

    @retry_on_db_lock(max_retries=5, initial_delay=0.05, backoff_factor=1.5)
    def post(self, request):
        user = request.user
        student = getattr(user, "student_profile", None)
        if not student:
            return Response({"detail": "Há»“ sÆ¡ sinh viÃªn khÃ´ng tá»“n táº¡i."}, status=status.HTTP_404_NOT_FOUND)

        project = GraduationProject.objects.filter(student=student).first()
        if not project:
            return Response({"detail": "ChÆ°a cÃ³ Ä‘á»“ Ã¡n."}, status=status.HTTP_400_BAD_REQUEST)

        week_number = request.data.get("week_number")
        summary_content = request.data.get("summary_content", "").strip()
        planned_tasks = request.data.get("planned_tasks", "").strip()
        git_commit_link = request.data.get("git_commit_link", "").strip()
        attached_file = request.FILES.get("attached_file")

        try:
            week_num = int(week_number)
            if week_num < 1 or week_num > 15:
                return Response({"week_number": ["Tuáº§n bÃ¡o cÃ¡o pháº£i tá»« 1 Ä‘áº¿n 15."]}, status=status.HTTP_400_BAD_REQUEST)
        except (ValueError, TypeError):
            return Response({"week_number": ["Tuáº§n bÃ¡o cÃ¡o khÃ´ng há»£p lá»‡."]}, status=status.HTTP_400_BAD_REQUEST)

        if not summary_content:
            return Response({"summary_content": ["Vui lÃ²ng nháº­p ná»™i dung tÃ³m táº¯t káº¿t quáº£ cÃ´ng viá»‡c trong tuáº§n."]}, status=status.HTTP_400_BAD_REQUEST)

        # File validation with binary magic checks
        if attached_file:
            try:
                validate_uploaded_file(
                    attached_file,
                    allowed_extensions=[".pdf", ".zip", ".rar", ".docx", ".xlsx", ".pptx"],
                    max_size_bytes=25 * 1024 * 1024
                )
            except Exception as e:
                err_msg = getattr(e, "detail", str(e))
                if isinstance(err_msg, list):
                    err_msg = err_msg[0]
                return Response({"attached_file": [str(err_msg)]}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            project = GraduationProject.objects.select_for_update().get(id=project.id)
            report, _ = WeeklyProgressReport.objects.select_for_update().update_or_create(
                project=project,
                week_number=week_num,
                defaults={
                    "summary_content": summary_content,
                    "planned_tasks": planned_tasks,
                    "git_commit_link": git_commit_link,
                    "submitted_at": timezone.now(),
                }
            )
            if attached_file:
                report.attached_file = attached_file
                report.save(update_fields=["attached_file", "submitted_at"])

        return Response({
            "message": f"Ná»™p bÃ¡o cÃ¡o tuáº§n {week_num} thÃ nh cÃ´ng!",
            "report": WeeklyProgressReportSerializer(report).data
        }, status=status.HTTP_200_OK)


# ==============================================================================
# STUDENT SUPERVISION LOGS & TASK BOARD APIS
# ==============================================================================

class StudentSupervisionLogsAPIView(APIView):
    """Sinh viÃªn xem danh sÃ¡ch nháº­t kÃ½ cÃ¡c buá»•i gáº·p / lÃ m viá»‡c tá»« GVHD"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        student = getattr(user, "student_profile", None)
        if not student:
            return Response({"detail": "Há»“ sÆ¡ sinh viÃªn khÃ´ng tá»“n táº¡i."}, status=status.HTTP_404_NOT_FOUND)

        project = GraduationProject.objects.filter(student=student).first()
        if not project:
            membership = GroupMember.objects.filter(student=student).first()
            if membership and membership.group:
                project = GraduationProject.objects.filter(student__group_memberships__group=membership.group).first()

        if not project:
            return Response([], status=status.HTTP_200_OK)

        logs = SupervisionMeetingLog.objects.filter(project=project).order_by("-meeting_date", "-created_at")
        return Response(SupervisionMeetingLogSerializer(logs, many=True).data, status=status.HTTP_200_OK)



class StudentTasksAPIView(APIView):
    """Sinh viÃªn xem danh sÃ¡ch cÃ´ng viá»‡c Ä‘Æ°á»£c giao vÃ  tiáº¿n Ä‘á»™ tá»•ng quan"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        student = getattr(user, "student_profile", None)
        if not student:
            return Response({"detail": "Há»“ sÆ¡ sinh viÃªn khÃ´ng tá»“n táº¡i."}, status=status.HTTP_404_NOT_FOUND)

        project = GraduationProject.objects.filter(student=student).first()
        if not project:
            return Response({"detail": "ChÆ°a Ä‘Æ°á»£c phÃ¢n cÃ´ng Ä‘á» tÃ i."}, status=status.HTTP_400_BAD_REQUEST)

        tasks = SupervisionTask.objects.filter(project=project).order_by("is_completed", "due_date", "-created_at")
        total = tasks.count()
        completed = tasks.filter(is_completed=True).count()
        in_progress = tasks.filter(status="IN_PROGRESS", is_completed=False).count()
        todo = tasks.filter(status="TODO", is_completed=False).count()
        completion_rate = round((completed / total * 100), 1) if total > 0 else 0

        return Response({
            "stats": {
                "total": total,
                "completed": completed,
                "in_progress": in_progress,
                "todo": todo,
                "completion_rate": completion_rate,
            },
            "tasks": SupervisionTaskSerializer(tasks, many=True).data
        }, status=status.HTTP_200_OK)


class StudentMarkTaskCompletedAPIView(APIView):
    """Sinh viÃªn Ä‘Ã¡nh dáº¥u hoÃ n thÃ nh nhiá»‡m vá»¥ (hoáº·c bá» chá»n) kÃ¨m ghi chÃº káº¿t quáº£"""
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        user = request.user
        student = getattr(user, "student_profile", None)
        if not student:
            return Response({"detail": "Há»“ sÆ¡ sinh viÃªn khÃ´ng tá»“n táº¡i."}, status=status.HTTP_404_NOT_FOUND)

        project = GraduationProject.objects.filter(student=student).first()
        if not project:
            return Response({"detail": "ChÆ°a Ä‘Æ°á»£c phÃ¢n cÃ´ng Ä‘á» tÃ i."}, status=status.HTTP_400_BAD_REQUEST)

        task = get_object_or_404(SupervisionTask, id=pk, project=project)

        is_completed_val = request.data.get("is_completed")
        if is_completed_val is not None:
            is_completed = str(is_completed_val).lower() in ["true", "1"]
        else:
            is_completed = not task.is_completed

        student_notes = request.data.get("student_notes")
        if student_notes is not None:
            task.student_notes = str(student_notes).strip()

        task.is_completed = is_completed
        now = timezone.now()
        if is_completed:
            task.status = "COMPLETED"
            task.completed_at = now
            task.submitted_at = now
            if task.due_date and now.date() > task.due_date:
                task.is_late = True
        else:
            task.status = "IN_PROGRESS"
            task.completed_at = None
        task.save()

        try:
            status_text = "Ä‘Ã£ hoÃ n thÃ nh" if is_completed else "Ä‘ang thá»±c hiá»‡n láº¡i"
            NotificationService.create_notification(
                user=project.supervisor.user,
                notification_type="general",
                title=f"[Tiáº¿n Ä‘á»™ nhiá»‡m vá»¥] SV {student.user.get_full_name()}",
                message=f"Sinh viÃªn {student.user.get_full_name()} ({student.registration_no}) {status_text} nhiá»‡m vá»¥: '{task.title}'.",
            )
        except Exception as e:
            logger.warning("Could not send notification for task completion: %s", e)

        all_tasks = SupervisionTask.objects.filter(project=project)
        total = all_tasks.count()
        completed = all_tasks.filter(is_completed=True).count()
        rate = round((completed / total * 100), 1) if total > 0 else 0

        return Response({
            "message": f"ÄÃ£ cáº­p nháº­t tráº¡ng thÃ¡i nhiá»‡m vá»¥: {'HoÃ n thÃ nh' if is_completed else 'ChÆ°a hoÃ n thÃ nh'}",
            "task": SupervisionTaskSerializer(task).data,
            "stats": {
                "total": total,
                "completed": completed,
                "completion_rate": rate,
            }
        }, status=status.HTTP_200_OK)


# ==============================================================================
# SUPERVISOR DASHBOARD & ACTIONS
# ==============================================================================

class SupervisorGraduationProjectsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        supervisor = getattr(user, "supervisor_profile", None)
        if not supervisor:
            return Response({"detail": "Chá»‰ dÃ nh cho Giáº£ng viÃªn hÆ°á»›ng dáº«n."}, status=status.HTTP_403_FORBIDDEN)

        from django.db.models import Q, Prefetch

        tasks_qs = SupervisionTask.objects.select_related("assigned_by__user")
        meeting_logs_qs = SupervisionMeetingLog.objects.select_related(
            "project__supervisor__user"
        ).prefetch_related(
            Prefetch("tasks", queryset=tasks_qs)
        )

        projects = GraduationProject.objects.filter(supervisor=supervisor).select_related(
            "student__user",
            "supervisor__user",
            "reviewer__user",
            "topic_category",
            "council",
            "final_grade_summary",
            "outline_review__reviewer__user",
            "outline_review__review_group",
        ).prefetch_related(
            Prefetch("tasks", queryset=tasks_qs),
            Prefetch("weekly_reports", queryset=WeeklyProgressReport.objects.all()),
            Prefetch("meeting_logs", queryset=meeting_logs_qs),
        ).order_by("student__user__last_name")

        data = list(GraduationProjectDetailSerializer(projects, many=True).data)

        # Stage 2 students: students who submitted survey preferences choosing this supervisor,
        # but do not have an active GraduationProject assigned yet
        assigned_student_ids = GraduationProject.objects.filter(student__isnull=False).values_list("student_id", flat=True)
        stage2_prefs = StudentPreference.objects.filter(
            Q(preference_1=supervisor) | Q(preference_2=supervisor) | Q(preference_3=supervisor)
        ).exclude(student_id__in=assigned_student_ids).select_related(
            "student__user", "student__course_class", "topic_direction"
        ).order_by("student__user__last_name", "student__user__first_name")

        stage2_prefs_list = list(stage2_prefs)
        surveys_map = {}
        if stage2_prefs_list:
            st_ids = [p.student_id for p in stage2_prefs_list]
            surveys = InternshipInfo.objects.filter(student_id__in=st_ids).only(
                "student_id", "tentative_title", "company_name", "is_interning"
            )
            surveys_map = {s.student_id: s for s in surveys}

        for pref in stage2_prefs_list:
            survey = surveys_map.get(pref.student_id)
            s = pref.student
            su = s.user
            course_class_name = getattr(s.course_class, "class_name", "") if hasattr(s, "course_class") and s.course_class else ""
            student_display_name = (
                f"{su.last_name} {su.first_name}".strip()
                if (su.last_name or su.first_name)
                else (su.get_full_name() or su.username)
            )

            p_rank = 1 if pref.preference_1_id == supervisor.id else (2 if pref.preference_2_id == supervisor.id else 3)

            topic_title = ""
            if survey and survey.tentative_title:
                topic_title = survey.tentative_title
            elif pref.topic_direction:
                topic_title = pref.topic_direction.name
            else:
                topic_title = "Kháº£o sÃ¡t nguyá»‡n vá»ng ÄATN"

            stage2_item = {
                "id": -pref.id,
                "preference_id": pref.id,
                "is_stage_2": True,
                "status": "SURVEY",
                "stage": 2,
                "batch": pref.batch_id or getattr(s, "academic_batch_id", None),
                "student": {
                    "id": s.id,
                    "registration_no": s.registration_no,
                    "user": {
                        "first_name": su.first_name,
                        "last_name": su.last_name,
                        "username": su.username,
                        "email": su.email,
                    },
                    "department": s.department or "",
                    "course_class": course_class_name,
                    "phone_number": getattr(s, "phone_number", ""),
                },
                "student_name": student_display_name,
                "student_reg_no": s.registration_no,
                "student_phone": getattr(s, "phone_number", ""),
                "student_email": su.email or "",
                "student_class": course_class_name or (s.department or ""),
                "supervisor": {
                    "id": supervisor.id,
                    "supervisor_id": supervisor.supervisor_id,
                    "full_name": supervisor.user.get_full_name(),
                },
                "supervisor_name": supervisor.user.get_full_name(),
                "topic_title_vi": topic_title,
                "topic_title_en": topic_title,
                "topic_direction_name": pref.topic_direction.name if pref.topic_direction else "",
                "preference_rank": p_rank,
                "company_name": survey.company_name if (survey and survey.company_name) else "",
                "is_interning": survey.is_interning if survey else False,
                "sub_criteria": pref.sub_criteria or "",
                "submitted_at": pref.submitted_at.isoformat() if pref.submitted_at else None,
                "created_at": pref.submitted_at.isoformat() if pref.submitted_at else None,
                "topic_review_status": "DRAFT",
                "supervisor_score": None,
                "reviewer_score": None,
                "tasks": [],
                "weekly_reports": [],
                "meeting_logs": [],
                "final_grade": None,
                "final_grade_summary": None,
                "outline_review": None,
            }
            data.append(stage2_item)

        return Response(data, status=status.HTTP_200_OK)

class SupervisorOutlineGroupReviewListAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        supervisor = getattr(user, "supervisor_profile", None)
        if not supervisor:
            return Response({"detail": "Chá»‰ dÃ nh cho Giáº£ng viÃªn."}, status=status.HTTP_403_FORBIDDEN)

        # Supervisor can review outlines from:
        # 1. Any review groups they are a member of
        # 2. Any graduation projects they directly supervise
        review_groups = supervisor.outline_groups.all()

        # Ensure outline reviews exist for projects supervised by this supervisor
        supervised_projects = GraduationProject.objects.filter(supervisor=supervisor)
        for p in supervised_projects:
            OutlineReview.objects.get_or_create(project=p)

        from django.db.models import Q
        query = Q(project__supervisor=supervisor)
        if review_groups.exists():
            query |= Q(review_group__in=review_groups)

        reviews = OutlineReview.objects.filter(query).select_related(
            "project__student__user",
            "project__supervisor__user",
            "review_group",
            "reviewer__user"
        ).distinct()

        from .utils.vietnamese_sort import sort_by_vietnamese_name
        reviews_list = list(reviews)
        reviews_list = sort_by_vietnamese_name(
            reviews_list,
            key_extractor=lambda r: (f"{r.project.student.user.last_name} {r.project.student.user.first_name}".strip() if (r.project.student.user.last_name or r.project.student.user.first_name) else (r.project.student.user.get_full_name() or r.project.student.user.username))
        )
        
        from app.serializers.utc_graduation_serializers import OutlineReviewSerializer
        return Response(OutlineReviewSerializer(reviews_list, many=True).data, status=status.HTTP_200_OK)


class SupervisorOutlineReviewAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        supervisor = getattr(user, "supervisor_profile", None)
        if not supervisor:
            return Response({"detail": "Chá»‰ dÃ nh cho Giáº£ng viÃªn."}, status=status.HTTP_403_FORBIDDEN)

        project_id = request.data.get("project_id")
        verdict = request.data.get("verdict")  # APPROVED, REVISION_REQUIRED, REJECTED
        comments = request.data.get("comments", "").strip()

        if not project_id or not verdict:
            return Response({"detail": "project_id vÃ  verdict lÃ  báº¯t buá»™c."}, status=status.HTTP_400_BAD_REQUEST)

        project = get_object_or_404(GraduationProject, id=project_id)
        
        # Verify permissions: either supervisor of the project OR member of the assigned review group
        is_supervisor = project.supervisor_id == supervisor.id
        review, _ = OutlineReview.objects.get_or_create(project=project)
        
        is_group_reviewer = False
        if review.review_group and review.review_group.members.filter(id=supervisor.id).exists():
            is_group_reviewer = True
            
        if not is_supervisor and not is_group_reviewer:
            return Response({"detail": "Báº¡n khÃ´ng cÃ³ quyá»n tháº©m Ä‘á»‹nh Ä‘á» cÆ°Æ¡ng nÃ y."}, status=status.HTTP_403_FORBIDDEN)

        with transaction.atomic():
            review.reviewer = supervisor
            review.verdict = verdict
            review.comments = comments
            review.reviewed_at = timezone.now()
            review.save()

            if verdict == "APPROVED":
                project.status = "OUTLINE_APPROVED"
            elif verdict == "REVISION_REQUIRED":
                project.status = "OUTLINE_REVISION"
            elif verdict == "REJECTED":
                project.status = "FAILED"
            project.save()

        verdict_display = getattr(review, "get_verdict_display", lambda: verdict)()
        return Response({
            "message": f"ÄÃ£ cáº­p nháº­t káº¿t quáº£ duyá»‡t Ä‘á» cÆ°Æ¡ng: {verdict_display}",
            "project": GraduationProjectDetailSerializer(project).data
        }, status=status.HTTP_200_OK)


class SupervisorWeeklyFeedbackAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        supervisor = getattr(user, "supervisor_profile", None)
        if not supervisor:
            return Response({"detail": "Chá»‰ dÃ nh cho Giáº£ng viÃªn."}, status=status.HTTP_403_FORBIDDEN)

        report_id = request.data.get("report_id")
        rating = request.data.get("rating")  # GOOD, ACCEPTABLE, LATE, UNSATISFACTORY
        feedback = request.data.get("feedback", "").strip()

        if not report_id or not rating:
            return Response({"detail": "report_id vÃ  rating lÃ  báº¯t buá»™c."}, status=status.HTTP_400_BAD_REQUEST)

        report = get_object_or_404(WeeklyProgressReport, id=report_id, project__supervisor=supervisor)
        report.supervisor_rating = rating
        report.supervisor_feedback = feedback
        report.reviewed_at = timezone.now()
        report.save()

        return Response({
            "message": "ÄÃ£ lÆ°u nháº­n xÃ©t vÃ  Ä‘Ã¡nh giÃ¡ tuáº§n!",
            "report": WeeklyProgressReportSerializer(report).data
        }, status=status.HTTP_200_OK)


class SupervisorDefenseEvaluationAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        supervisor = getattr(user, "supervisor_profile", None)
        if not supervisor:
            return Response({"detail": "Chá»‰ dÃ nh cho Giáº£ng viÃªn hÆ°á»›ng dáº«n."}, status=status.HTTP_403_FORBIDDEN)

        project_id = request.data.get("project_id")
        supervisor_score = request.data.get("supervisor_score")
        supervisor_feedback = request.data.get("supervisor_feedback", "").strip()
        is_eligible = request.data.get("is_eligible_for_defense", True)

        try:
            score = float(supervisor_score)
            if score < 0.0 or score > 10.0:
                return Response({"supervisor_score": ["Äiá»ƒm hÆ°á»›ng dáº«n pháº£i tá»« 0.0 Ä‘áº¿n 10.0"]}, status=status.HTTP_400_BAD_REQUEST)
        except (ValueError, TypeError):
            return Response({"supervisor_score": ["Äiá»ƒm sá»‘ khÃ´ng há»£p lá»‡."]}, status=status.HTTP_400_BAD_REQUEST)

        project = get_object_or_404(GraduationProject, id=project_id, supervisor=supervisor)
        is_draft = bool(request.data.get("is_draft", False))

        with transaction.atomic():
            project.supervisor_score = score
            project.supervisor_feedback = supervisor_feedback
            project.supervisor_score_is_draft = is_draft
            if not is_draft:
                project.is_eligible_for_defense = is_eligible
                if is_eligible:
                    project.status = "DEFENSE_READY"
                else:
                    project.status = "DEFERRED"
                    project.deferral_status = "APPROVED"
                    project.deferral_reason = f"Báº£o lÆ°u do GVHD Ä‘Ã¡nh giÃ¡ khÃ´ng Ä‘á»§ Ä‘iá»u kiá»‡n báº£o vá»‡: {supervisor_feedback or 'ChÆ°a hoÃ n thÃ nh nhiá»‡m vá»¥ theo yÃªu cáº§u'}"
                    project.deferral_decided_at = timezone.now()
                project.save()

                # Update Final Grade
                summary, _ = FinalGradeSummary.objects.get_or_create(project=project)
                summary.supervisor_score = score
                policy = EvaluationPolicy.objects.filter(batch=project.batch).first()
                summary.calculate_and_save(policy=policy)
            else:
                project.save()

        msg = "ÄÃ£ lÆ°u nhÃ¡p phiáº¿u Ä‘Ã¡nh giÃ¡ cá»§a Giáº£ng viÃªn hÆ°á»›ng dáº«n! Äiá»ƒm chÆ°a cÃ´ng bá»‘ cho sinh viÃªn." if is_draft else "ÄÃ£ lÆ°u vÃ  cÃ´ng bá»‘ phiáº¿u Ä‘Ã¡nh giÃ¡ cá»§a Giáº£ng viÃªn hÆ°á»›ng dáº«n!"
        return Response({
            "message": msg,
            "project": GraduationProjectDetailSerializer(project).data
        }, status=status.HTTP_200_OK)


class SupervisorSupervisionLogsAPIView(APIView):
    """Giáº£ng viÃªn xem vÃ  táº¡o nháº­t kÃ½ lÃ m viá»‡c / há»p vá»›i sinh viÃªn"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        supervisor = getattr(user, "supervisor_profile", None)
        if not supervisor:
            return Response({"detail": "Chá»‰ dÃ nh cho Giáº£ng viÃªn."}, status=status.HTTP_403_FORBIDDEN)

        project_id = request.query_params.get("project_id")
        if project_id:
            project = get_object_or_404(GraduationProject, id=project_id, supervisor=supervisor)
            logs = SupervisionMeetingLog.objects.filter(project=project).order_by("-meeting_date", "-created_at")
        else:
            logs = SupervisionMeetingLog.objects.filter(project__supervisor=supervisor).order_by("-meeting_date", "-created_at")

        return Response(SupervisionMeetingLogSerializer(logs, many=True).data, status=status.HTTP_200_OK)

    def post(self, request):
        user = request.user
        supervisor = getattr(user, "supervisor_profile", None)
        if not supervisor:
            return Response({"detail": "Chá»‰ dÃ nh cho Giáº£ng viÃªn."}, status=status.HTTP_403_FORBIDDEN)

        project_id = request.data.get("project_id")
        meeting_date = request.data.get("meeting_date")
        meeting_time = request.data.get("meeting_time", "09:00 - 10:30")
        meeting_type = request.data.get("meeting_type", "OFFLINE")
        location_or_link = request.data.get("location_or_link", "").strip()
        content_discussed = request.data.get("content_discussed", "").strip()
        supervisor_notes = request.data.get("supervisor_notes", "").strip()
        next_meeting_plan = request.data.get("next_meeting_plan", "").strip()

        if not project_id or not meeting_date or not content_discussed:
            return Response({"detail": "project_id, meeting_date vÃ  content_discussed lÃ  báº¯t buá»™c."}, status=status.HTTP_400_BAD_REQUEST)

        project = get_object_or_404(GraduationProject, id=project_id, supervisor=supervisor)

        with transaction.atomic():
            log = SupervisionMeetingLog.objects.create(
                project=project,
                meeting_date=meeting_date,
                meeting_time=meeting_time,
                meeting_type=meeting_type,
                location_or_link=location_or_link,
                content_discussed=content_discussed,
                supervisor_notes=supervisor_notes,
                next_meeting_plan=next_meeting_plan,
            )

            # Feature 5: Giao viá»‡c tuáº§n tá»›i kÃ¨m Deadline lÃ m cÄƒn cá»© Ä‘Ã¡nh giÃ¡ Ä‘iá»ƒm quÃ¡ trÃ¬nh
            task_title = request.data.get("task_title", "").strip()
            created_task = None
            if task_title:
                task_desc = request.data.get("task_description", "").strip()
                task_due_date = request.data.get("task_due_date") or None
                task_priority = request.data.get("task_priority", "MEDIUM")
                created_task = SupervisionTask.objects.create(
                    project=project,
                    meeting_log=log,
                    title=task_title,
                    description=task_desc,
                    assigned_by=supervisor,
                    due_date=task_due_date,
                    priority=task_priority,
                    status="TODO",
                )

        try:
            supervisor_name = supervisor.user.get_full_name() or supervisor.user.username
            if meeting_type == "ONLINE" and location_or_link:
                notif_title = f"[Lá»‹ch há»p trá»±c tuyáº¿n] Cuá»™c háº¹n tá»« GVHD {supervisor_name}"
                notif_msg = f"GVHD Ä‘Ã£ táº¡o lá»‹ch háº¹n gáº·p trá»±c tuyáº¿n lÃºc {meeting_time} ngÃ y {meeting_date}. Link tham gia: {location_or_link}"
            else:
                notif_title = "[Nháº­t kÃ½ hÆ°á»›ng dáº«n] GVHD vá»«a ghi nháº­n buá»•i lÃ m viá»‡c"
                notif_msg = f"GVHD {supervisor_name} Ä‘Ã£ cáº­p nháº­t nháº­t kÃ½ buá»•i lÃ m viá»‡c ngÃ y {meeting_date}."

            NotificationService.create_notification(
                user=project.student.user,
                notification_type="general",
                title=notif_title,
                message=notif_msg,
                action_url="/student/dashboard",
                send_email=True,
            )

            if created_task:
                NotificationService.create_notification(
                    user=project.student.user,
                    notification_type="general",
                    title=f"[Nhiá»‡m vá»¥ má»›i] {task_title}",
                    message=f"GVHD Ä‘Ã£ giao nhiá»‡m vá»¥ tuáº§n tá»›i: '{task_title}'. Háº¡n ná»™p: {created_task.due_date or 'KhÃ´ng cÃ³'}. (LÆ°u lÃ m cÄƒn cá»© Ä‘Ã¡nh giÃ¡ Ä‘iá»ƒm quÃ¡ trÃ¬nh)",
                    action_url="/student/dashboard",
                    send_email=True,
                )
        except Exception as e:
            logger.warning("Could not send notification for meeting log: %s", e)

        return Response({
            "message": "ÄÃ£ lÆ°u nháº­t kÃ½ hÆ°á»›ng dáº«n vÃ  cÄƒn cá»© Ä‘Ã¡nh giÃ¡ Ä‘iá»ƒm quÃ¡ trÃ¬nh thÃ nh cÃ´ng!",
            "log": SupervisionMeetingLogSerializer(log).data
        }, status=status.HTTP_201_CREATED)


class SupervisorTasksAPIView(APIView):
    """Giáº£ng viÃªn xem, giao nhiá»‡m vá»¥ má»›i, sá»­a hoáº·c xÃ³a nhiá»‡m vá»¥ cho sinh viÃªn"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        supervisor = getattr(user, "supervisor_profile", None)
        if not supervisor:
            return Response({"detail": "Chá»‰ dÃ nh cho Giáº£ng viÃªn."}, status=status.HTTP_403_FORBIDDEN)

        project_id = request.query_params.get("project_id")
        if project_id:
            project = get_object_or_404(GraduationProject, id=project_id, supervisor=supervisor)
            tasks = SupervisionTask.objects.filter(project=project).order_by("is_completed", "due_date", "-created_at")
        else:
            tasks = SupervisionTask.objects.filter(project__supervisor=supervisor).order_by("is_completed", "due_date", "-created_at")

        return Response(SupervisionTaskSerializer(tasks, many=True).data, status=status.HTTP_200_OK)

    def post(self, request):
        user = request.user
        supervisor = getattr(user, "supervisor_profile", None)
        if not supervisor:
            return Response({"detail": "Chá»‰ dÃ nh cho Giáº£ng viÃªn."}, status=status.HTTP_403_FORBIDDEN)

        project_id = request.data.get("project_id")
        title = request.data.get("title", "").strip()
        description = request.data.get("description", "").strip()
        due_date = request.data.get("due_date") or None
        priority = request.data.get("priority", "MEDIUM")
        meeting_log_id = request.data.get("meeting_log_id")

        if not project_id or not title:
            return Response({"detail": "project_id vÃ  title lÃ  báº¯t buá»™c."}, status=status.HTTP_400_BAD_REQUEST)

        project = get_object_or_404(GraduationProject, id=project_id, supervisor=supervisor)
        meeting_log = SupervisionMeetingLog.objects.filter(id=meeting_log_id, project=project).first() if meeting_log_id else None

        task = SupervisionTask.objects.create(
            project=project,
            meeting_log=meeting_log,
            title=title,
            description=description,
            assigned_by=supervisor,
            due_date=due_date,
            priority=priority,
            status="TODO",
            is_completed=False,
        )

        try:
            NotificationService.create_notification(
                user=project.student.user,
                notification_type="general",
                title="[Nhiá»‡m vá»¥ má»›i] GVHD vá»«a giao viá»‡c cho báº¡n",
                message=f"GVHD {supervisor.user.get_full_name()} Ä‘Ã£ giao nhiá»‡m vá»¥: '{title}'. Háº¡n ná»™p: {due_date or 'KhÃ´ng'}.",
            )
        except Exception as e:
            logger.warning("Could not send notification for task creation: %s", e)

        return Response({
            "message": f"ÄÃ£ giao nhiá»‡m vá»¥ '{title}' cho sinh viÃªn!",
            "task": SupervisionTaskSerializer(task).data
        }, status=status.HTTP_201_CREATED)

    def patch(self, request, pk=None):
        user = request.user
        supervisor = getattr(user, "supervisor_profile", None)
        if not supervisor:
            return Response({"detail": "Chá»‰ dÃ nh cho Giáº£ng viÃªn."}, status=status.HTTP_403_FORBIDDEN)

        task_id = pk or request.data.get("task_id")
        task = get_object_or_404(SupervisionTask, id=task_id, project__supervisor=supervisor)

        for field in ["title", "description", "due_date", "priority", "status", "is_completed"]:
            if field in request.data:
                val = request.data[field]
                if field == "is_completed":
                    val = str(val).lower() in ["true", "1"]
                setattr(task, field, val)

        if task.is_completed and not task.completed_at:
            task.completed_at = timezone.now()
        elif not task.is_completed:
            task.completed_at = None

        task.save()
        return Response({
            "message": "ÄÃ£ cáº­p nháº­t nhiá»‡m vá»¥ thÃ nh cÃ´ng!",
            "task": SupervisionTaskSerializer(task).data
        }, status=status.HTTP_200_OK)

    def delete(self, request, pk=None):
        user = request.user
        supervisor = getattr(user, "supervisor_profile", None)
        if not supervisor:
            return Response({"detail": "Chá»‰ dÃ nh cho Giáº£ng viÃªn."}, status=status.HTTP_403_FORBIDDEN)

        task_id = pk or request.query_params.get("task_id") or request.data.get("task_id")
        task = get_object_or_404(SupervisionTask, id=task_id, project__supervisor=supervisor)
        task.delete()
        return Response({"message": "ÄÃ£ xÃ³a nhiá»‡m vá»¥ thÃ nh cÃ´ng!"}, status=status.HTTP_200_OK)


# ==============================================================================
# SUPERVISOR BROADCAST ANNOUNCEMENT (Feature 2)
# ==============================================================================

class SupervisorBroadcastAnnouncementAPIView(APIView):
    """
    Giáº£ng viÃªn gá»­i tin nháº¯n thÃ´ng bÃ¡o chung cho táº¥t cáº£ cÃ¡c nhÃ³m mÃ¬nh hÆ°á»›ng dáº«n:
    - Nháº­p tiÃªu Ä‘á» vÃ  ná»™i dung thÃ´ng bÃ¡o chung
    - Táº¥t cáº£ sinh viÃªn trong cÃ¡c nhÃ³m do GV hÆ°á»›ng dáº«n nháº­n Ä‘Æ°á»£c thÃ´ng bÃ¡o
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        supervisor = getattr(user, "supervisor_profile", None)
        if not supervisor:
            return Response(
                {"message": "Chá»‰ dÃ nh cho giáº£ng viÃªn hÆ°á»›ng dáº«n."},
                status=status.HTTP_403_FORBIDDEN,
            )

        title = request.data.get("title", "").strip()
        message = request.data.get("message", "").strip()

        if not title:
            return Response(
                {"message": "TiÃªu Ä‘á» thÃ´ng bÃ¡o khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not message:
            return Response(
                {"message": "Ná»™i dung thÃ´ng bÃ¡o khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        recipient_users = set()

        # From individual graduation projects
        grad_projects = GraduationProject.objects.filter(
            supervisor=supervisor
        ).select_related("student__user")

        for gp in grad_projects:
            if gp.student and gp.student.user:
                recipient_users.add(gp.student.user)

        if not recipient_users:
            return Response(
                {"message": "Báº¡n hiá»‡n chÆ°a cÃ³ sinh viÃªn hoáº·c nhÃ³m nÃ o Ä‘Æ°á»£c phÃ¢n cÃ´ng hÆ°á»›ng dáº«n."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        supervisor_name = supervisor.user.get_full_name() or supervisor.user.username
        full_title = f"[ThÃ´ng bÃ¡o GVHD {supervisor_name}] {title}"

        for u in recipient_users:
            NotificationService.create_notification(
                user=u,
                notification_type="general",
                title=full_title,
                message=message,
                action_url="/student/dashboard",
                send_email=True,
            )

        return Response(
            {
                "message": f"ÄÃ£ gá»­i thÃ´ng bÃ¡o chung thÃ nh cÃ´ng tá»›i {len(recipient_users)} sinh viÃªn.",
                "recipient_count": len(recipient_users),
            },
            status=status.HTTP_200_OK,
        )



# ==============================================================================
# REVIEWER DASHBOARD & EVALUATION
# ==============================================================================

class ReviewerAssignedProjectsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        supervisor = getattr(user, "supervisor_profile", None)
        if not supervisor:
            return Response({"detail": "Chá»‰ dÃ nh cho Giáº£ng viÃªn pháº£n biá»‡n."}, status=status.HTTP_403_FORBIDDEN)

        projects = GraduationProject.objects.filter(reviewer=supervisor).select_related(
            "student__user",
            "supervisor__user",
            "council",
            "final_grade_summary"
        )
        return Response(GraduationProjectDetailSerializer(projects, many=True).data, status=status.HTTP_200_OK)


class ReviewerSubmitEvaluationAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        supervisor = getattr(user, "supervisor_profile", None)
        if not supervisor:
            return Response({"detail": "Chá»‰ dÃ nh cho Giáº£ng viÃªn pháº£n biá»‡n."}, status=status.HTTP_403_FORBIDDEN)

        project_id = request.data.get("project_id")
        reviewer_score = request.data.get("reviewer_score")
        reviewer_feedback = request.data.get("reviewer_feedback", "").strip()
        reviewer_verdict = request.data.get("reviewer_verdict", "APPROVED")
        if reviewer_verdict not in ["APPROVED", "CONDITIONAL", "REJECTED"]:
            reviewer_verdict = "APPROVED"

        try:
            score = float(reviewer_score)
            if score < 0.0 or score > 10.0:
                return Response({"reviewer_score": ["Äiá»ƒm pháº£n biá»‡n pháº£i tá»« 0.0 Ä‘áº¿n 10.0"]}, status=status.HTTP_400_BAD_REQUEST)
        except (ValueError, TypeError):
            return Response({"reviewer_score": ["Äiá»ƒm sá»‘ khÃ´ng há»£p lá»‡."]}, status=status.HTTP_400_BAD_REQUEST)

        project = get_object_or_404(GraduationProject, id=project_id, reviewer=supervisor)

        with transaction.atomic():
            project.reviewer_score = score
            project.reviewer_feedback = reviewer_feedback
            project.reviewer_verdict = reviewer_verdict
            project.save()

            # Update Final Grade
            summary, _ = FinalGradeSummary.objects.get_or_create(project=project)
            summary.reviewer_score = score
            policy = EvaluationPolicy.objects.filter(batch=project.batch).first()
            summary.calculate_and_save(policy=policy)

        verdict_text = getattr(project, "get_reviewer_verdict_display", lambda: reviewer_verdict)()
        return Response({
            "message": f"ÄÃ£ lÆ°u nháº­n xÃ©t vÃ  káº¿t luáº­n pháº£n biá»‡n ({verdict_text})!",
            "project": GraduationProjectDetailSerializer(project).data
        }, status=status.HTTP_200_OK)


# ==============================================================================
# COUNCIL LIVE DEFENSE & LIVE GRADING
# ==============================================================================

class CouncilLiveDefenseSessionAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        council_member = CouncilMember.objects.filter(user=user).select_related("council__batch").first()

        if not council_member:
            return Response({"detail": "Báº¡n khÃ´ng thuá»™c Há»™i Ä‘á»“ng báº£o vá»‡ nÃ o trong ká»³ nÃ y."}, status=status.HTTP_404_NOT_FOUND)

        council = council_member.council
        all_members = list(council.members.select_related("user", "supervisor").all())

        projects = GraduationProject.objects.filter(council=council).select_related(
            "student__user",
            "supervisor__user",
            "reviewer__user",
            "reviewer__user",
            "final_grade_summary"
        )

        from .utils.vietnamese_sort import sort_by_vietnamese_name
        projects_list = list(projects)
        projects_list = sort_by_vietnamese_name(
            projects_list,
            key_extractor=lambda p: (p.student.user.get_full_name() or p.student.user.username) if p.student and p.student.user else (p.topic_title_vi or "")
        )

        # Get scores submitted by this member and all scores in council
        member_scores = {getattr(s, "project_id", getattr(s.project, "id", None)): s for s in CouncilLiveScore.objects.filter(member=council_member)}
        all_live_scores = list(CouncilLiveScore.objects.filter(council=council).select_related("member__user"))

        # Group scores by project_id
        scores_by_project = {}
        for s in all_live_scores:
            p_id = s.project_id
            if p_id not in scores_by_project:
                scores_by_project[p_id] = {}
            scores_by_project[p_id][s.member_id] = s

        projects_data = []
        for p in projects_list:
            p_data = dict(GraduationProjectDetailSerializer(p).data)
            my_score = member_scores.get(getattr(p, "id", None))
            p_data["my_score"] = CouncilLiveScoreSerializer(my_score).data if my_score else None

            # Build scoring status breakdown for this project
            p_scores = scores_by_project.get(p.id, {})
            eligible_count = 0
            submitted_count = 0
            members_breakdown = []

            for m in all_members:
                is_sup = bool(m.supervisor_id and m.supervisor_id == p.supervisor_id)
                m_score = p_scores.get(m.id)
                has_sub = m_score is not None
                if not is_sup:
                    eligible_count += 1
                    if has_sub:
                        submitted_count += 1

                members_breakdown.append({
                    "member_id": m.id,
                    "name": m.user.get_full_name() or m.user.username,
                    "role": m.get_role_display(),
                    "role_code": m.role,
                    "is_supervisor": is_sup,
                    "has_submitted": has_sub,
                    "total_score": m_score.total_score if m_score else None,
                })

            p_conflicts = CouncilConflictService.check_project_assignment(council, p)
            p_data["conflicts"] = p_conflicts
            p_data["has_conflict"] = len(p_conflicts) > 0

            p_data["scoring_summary"] = {
                "total_eligible_members": eligible_count,
                "submitted_count": submitted_count,
                "pending_count": max(0, eligible_count - submitted_count),
                "is_fully_graded": eligible_count > 0 and submitted_count >= eligible_count,
                "members_breakdown": members_breakdown
            }
            projects_data.append(p_data)

        role_display = getattr(council_member, "get_role_display", lambda: council_member.role)()
        session_time_display = getattr(council, "get_session_time_display", lambda: council.session_time)()
        can_lock = role_display in ["Chá»§ tá»‹ch há»™i Ä‘á»“ng", "á»¦y viÃªn, ThÆ° kÃ½"] or user.is_staff
        council_conflict_info = CouncilConflictService.check_council_conflicts(council_id=council.id)

        return Response({
            "council": {
                "id": getattr(council, "id", None),
                "council_number": council.council_number,
                "council_name": council.council_name,
                "session_date": council.session_date,
                "session_time": session_time_display,
                "defense_room": council.defense_room,
                "my_role": role_display,
                "is_locked": getattr(council, "is_locked", False),
                "locked_at": council.locked_at if getattr(council, "is_locked", False) else None,
                "locked_by": council.locked_by.get_full_name() or council.locked_by.username if getattr(council, "is_locked", False) and council.locked_by else None,
                "can_lock": can_lock,
                "my_role_code": council_member.role,
                "current_defending_project_id": council.current_defending_project_id,
                "has_conflict": council_conflict_info.get("has_conflict", False),
                "total_conflicts": council_conflict_info.get("total_conflicts", 0),
                "conflicts": council_conflict_info.get("conflicts", []),
            },
            "members": [
                {
                    "id": m.id,
                    "name": m.user.get_full_name() or m.user.username,
                    "role": m.get_role_display(),
                    "role_code": m.role,
                }
                for m in all_members
            ],
            "projects": projects_data
        }, status=status.HTTP_200_OK)


class CouncilSubmitScoreAPIView(APIView):
    permission_classes = [IsAuthenticated, IsSupervisorOrCommitteeMember]

    @retry_on_db_lock(max_retries=5, initial_delay=0.05, backoff_factor=1.5)
    def post(self, request):
        user = request.user
        if getattr(user, "user_type", "") == "student":
            return Response({"detail": "Sinh viÃªn khÃ´ng cÃ³ quyá»n truy cáº­p hoáº·c tá»± nháº­p Ä‘iá»ƒm Há»™i Ä‘á»“ng báº£o vá»‡."}, status=status.HTTP_403_FORBIDDEN)

        council_member = CouncilMember.objects.filter(user=user).first()
        if not council_member:
            return Response({"detail": "Báº¡n khÃ´ng pháº£i thÃ nh viÃªn Há»™i Ä‘á»“ng báº£o vá»‡."}, status=status.HTTP_403_FORBIDDEN)

        if council_member.council and getattr(council_member.council, "is_locked", False):
            return Response(
                {"detail": "Há»™i Ä‘á»“ng Ä‘Ã£ khÃ³a Ä‘iá»ƒm. ToÃ n bá»™ Ä‘iá»ƒm sá»‘ á»Ÿ tráº¡ng thÃ¡i chá»‰ Ä‘á»c (Read-only), khÃ´ng thá»ƒ chá»‰nh sá»­a."},
                status=status.HTTP_403_FORBIDDEN
            )

        project_id = request.data.get("project_id")
        p_score = float(request.data.get("score_presentation", 0.0))
        c_score = float(request.data.get("score_content", 0.0))
        q_score = float(request.data.get("score_qa", 0.0))
        d_score = float(request.data.get("score_demo", 0.0))
        comments = request.data.get("comments", "").strip()

        # Strict checks (TC-034): Supervisor cannot grade their own student in council -> 403 Forbidden
        project = get_object_or_404(GraduationProject, id=project_id, council=council_member.council)
        is_gvhd = (
            (council_member.supervisor and project.supervisor == council_member.supervisor)
            or (project.supervisor and project.supervisor.user == user)
            or (hasattr(user, "supervisor_profile") and project.supervisor == user.supervisor_profile)
            or (council_member.user == project.supervisor.user)
        )
        if is_gvhd:
            return Response(
                {"detail": "Vi pháº¡m quy cháº¿: Giáº£ng viÃªn hÆ°á»›ng dáº«n khÃ´ng Ä‘Æ°á»£c phÃ©p cháº¥m Ä‘iá»ƒm Há»™i Ä‘á»“ng cho chÃ­nh sinh viÃªn cá»§a mÃ¬nh.", "error": "supervisor_self_scoring_forbidden"},
                status=status.HTTP_403_FORBIDDEN
            )

        with transaction.atomic():
            project = GraduationProject.objects.select_for_update().get(id=project_id, council=council_member.council)
            live_score, _ = CouncilLiveScore.objects.update_or_create(
                project=project,
                member=council_member,
                defaults={
                    "council": council_member.council,
                    "score_presentation": p_score,
                    "score_content": c_score,
                    "score_qa": q_score,
                    "score_demo": d_score,
                    "comments": comments
                }
            )

            # Re-calculate average council score
            all_scores = list(CouncilLiveScore.objects.filter(project=project))
            if all_scores:
                avg_council = round(sum(s.total_score for s in all_scores) / len(all_scores), 2)
            else:
                avg_council = 0.0

            # Update FinalGradeSummary
            summary, _ = FinalGradeSummary.objects.select_for_update().get_or_create(project=project)
            summary.supervisor_score = project.supervisor_score
            summary.reviewer_score = project.reviewer_score
            summary.council_avg_score = avg_council

            policy = EvaluationPolicy.objects.filter(batch=project.batch).first()
            summary.calculate_and_save(policy=policy)

            # If all evaluations exist, mark PASSED/FAILED
            if summary.final_score_10 is not None:
                project.status = "PASSED" if summary.is_passed else "FAILED"
                project.save()

            # Automatic notification when External council member submits evaluation score
            if council_member.role == "EXTERNAL_MEMBER":
                ext_name = council_member.user.get_full_name() or council_member.user.username
                # Notify Chair & Secretary of council
                leaders = CouncilMember.objects.filter(
                    council=council_member.council,
                    role__in=["CHAIR", "SECRETARY"]
                ).select_related("user")
                for leader in leaders:
                    if leader.user != user:
                        NotificationService.create_notification(
                            user=leader.user,
                            notification_type="evaluation_completed",
                            title="ChuyÃªn gia ngoÃ i Ä‘Ã£ ná»™p phiáº¿u Ä‘Ã¡nh giÃ¡",
                            message=f"ChuyÃªn gia ngoÃ i (á»¦y viÃªn ngoÃ i trÆ°á»ng) {ext_name} Ä‘Ã£ hoÃ n táº¥t cháº¥m Ä‘iá»ƒm cho sinh viÃªn {project.student.user.get_full_name()} ({project.student.registration_no}): {live_score.total_score}Ä‘.",
                        )
                # Notify Student
                NotificationService.create_notification(
                    user=project.student.user,
                    notification_type="evaluation_completed",
                    title="ChuyÃªn gia ngoÃ i Ä‘Ã£ ná»™p phiáº¿u Ä‘Ã¡nh giÃ¡",
                    message=f"ChuyÃªn gia ngoÃ i (á»¦y viÃªn ngoÃ i trÆ°á»ng) {ext_name} Ä‘Ã£ ná»™p phiáº¿u Ä‘Ã¡nh giÃ¡ báº£o vá»‡ cho Ä‘á»“ Ã¡n cá»§a báº¡n: {live_score.total_score}Ä‘.",
                )

        return Response({
            "message": f"ÄÃ£ cháº¥m Ä‘iá»ƒm thÃ nh cÃ´ng cho SV {project.student.registration_no}: {live_score.total_score}Ä‘ (Äiá»ƒm TB HÄ: {summary.council_avg_score}Ä‘ - Tá»•ng káº¿t: {summary.final_score_10}Ä‘)",
            "live_score": CouncilLiveScoreSerializer(live_score).data,
            "final_grade": FinalGradeSummarySerializer(summary).data
        }, status=status.HTTP_200_OK)


class CouncilToggleLockAPIView(APIView):
    """KhÃ³a hoáº·c má»Ÿ khÃ³a báº£ng Ä‘iá»ƒm há»™i Ä‘á»“ng"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        council_id = request.data.get("council_id")
        lock = request.data.get("lock", True)

        council = get_object_or_404(DefenseCouncil, id=council_id)
        membership = CouncilMember.objects.filter(council=council, user=user).first()
        is_chair_or_secretary = membership and membership.role in ["CHAIR", "SECRETARY"]
        is_admin = user.is_staff or getattr(user, "user_type", None) == "committee_member"

        if not is_chair_or_secretary and not is_admin:
            return Response(
                {"detail": "Chá»‰ Chá»§ tá»‹ch hoáº·c ThÆ° kÃ½ há»™i Ä‘á»“ng má»›i cÃ³ quyá»n khÃ³a hoáº·c má»Ÿ khÃ³a Ä‘iá»ƒm."},
                status=status.HTTP_403_FORBIDDEN
            )

        if lock:
            # TC-033: Báº¯t buá»™c 5/5 ngÆ°á»i cháº¥m má»›i cho phÃ©p chá»‘t
            council_members_count = council.members.count()
            required_scorers = council_members_count if council_members_count >= 5 else 5
            projects = GraduationProject.objects.filter(council=council)
            for proj in projects:
                submitted_count = CouncilLiveScore.objects.filter(project=proj, council=council).count()
                if submitted_count < required_scorers:
                    return Response({
                        "detail": f"BÃ¡o lá»—i: Báº¯t buá»™c {required_scorers}/{required_scorers} ngÆ°á»i cháº¥m má»›i cho phÃ©p chá»‘t.",
                        "error": "incomplete_scoring",
                        "submitted_count": submitted_count,
                        "required_count": required_scorers,
                        "student": proj.student.registration_no,
                    }, status=status.HTTP_400_BAD_REQUEST)

        council.is_locked = bool(lock)
        council.locked_at = timezone.now() if lock else None
        council.locked_by = user if lock else None
        council.save(update_fields=["is_locked", "locked_at", "locked_by"])

        action = "khÃ³a" if lock else "má»Ÿ khÃ³a"
        return Response({
            "message": f"ÄÃ£ {action} Ä‘iá»ƒm há»™i Ä‘á»“ng {council.council_name} thÃ nh cÃ´ng!",
            "is_locked": council.is_locked,
            "locked_at": council.locked_at,
            "locked_by": user.get_full_name() or user.username if lock else None
        }, status=status.HTTP_200_OK)


class CouncilFinalizeScoresAPIView(APIView):
    """
    TC-033: HÃ m tá»•ng há»£p vÃ  chá»‘t Ä‘iá»ƒm Há»™i Ä‘á»“ng:
    - Báº¯t buá»™c 5/5 ngÆ°á»i cháº¥m má»›i cho phÃ©p chá»‘t.
    - Náº¿u chá»‰ cÃ³ 4/5 ngÆ°á»i cháº¥m -> BÃ¡o lá»—i: Báº¯t buá»™c 5/5 ngÆ°á»i cháº¥m má»›i cho phÃ©p chá»‘t (HTTP 400).
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, council_id=None):
        user = request.user
        cid = council_id or request.data.get("council_id")
        project_id = request.data.get("project_id")

        if not cid and project_id:
            proj = GraduationProject.objects.filter(id=project_id).first()
            if proj and proj.council:
                cid = proj.council.id

        council = get_object_or_404(DefenseCouncil, id=cid)
        membership = CouncilMember.objects.filter(council=council, user=user).first()
        is_chair_or_secretary = membership and membership.role in ["CHAIR", "SECRETARY"]
        is_admin = user.is_staff or getattr(user, "user_type", None) in ["admin", "committee_member"]

        if not is_chair_or_secretary and not is_admin:
            return Response(
                {"detail": "Chá»‰ Chá»§ tá»‹ch hoáº·c ThÆ° kÃ½ há»™i Ä‘á»“ng má»›i cÃ³ quyá»n tá»•ng há»£p vÃ  chá»‘t Ä‘iá»ƒm."},
                status=status.HTTP_403_FORBIDDEN
            )

        council_members_count = council.members.count()
        required_scorers = council_members_count if council_members_count >= 5 else 5

        if project_id:
            projects = GraduationProject.objects.filter(id=project_id, council=council)
        else:
            projects = GraduationProject.objects.filter(council=council)

        for proj in projects:
            submitted_count = CouncilLiveScore.objects.filter(project=proj, council=council).count()
            if submitted_count < required_scorers:
                return Response({
                    "detail": f"BÃ¡o lá»—i: Báº¯t buá»™c {required_scorers}/{required_scorers} ngÆ°á»i cháº¥m má»›i cho phÃ©p chá»‘t.",
                    "error": "incomplete_scoring",
                    "submitted_count": submitted_count,
                    "required_count": required_scorers,
                    "project_id": proj.id,
                    "student": proj.student.registration_no,
                }, status=status.HTTP_400_BAD_REQUEST)

        council.is_finalized = True
        council.save(update_fields=["is_finalized"])

        return Response({
            "success": True,
            "message": f"Tá»•ng há»£p vÃ  chá»‘t Ä‘iá»ƒm thÃ nh cÃ´ng cho Há»™i Ä‘á»“ng {council.council_name}!",
            "is_locked": True,
            "total_projects": projects.count(),
        }, status=status.HTTP_200_OK)


class CouncilChairSetDefenseStatusAPIView(APIView):
    """Chá»§ tá»‹ch há»™i Ä‘á»“ng Ä‘iá»u hÃ nh buá»•i báº£o vá»‡: Chuyá»ƒn tráº¡ng thÃ¡i Ä‘á»“ Ã¡n sang 'Äang báº£o vá»‡' (In Progress / DEFENDING)"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        council_member = CouncilMember.objects.filter(user=user).select_related("council").first()
        if not council_member:
            return Response({"detail": "Báº¡n khÃ´ng thuá»™c Há»™i Ä‘á»“ng báº£o vá»‡ nÃ o."}, status=status.HTTP_403_FORBIDDEN)

        if council_member.role not in ["CHAIR", "SECRETARY"]:
            return Response({"detail": "Chá»‰ Chá»§ tá»‹ch há»™i Ä‘á»“ng (hoáº·c ThÆ° kÃ½) má»›i cÃ³ quyá»n Ä‘iá»u hÃ nh tráº¡ng thÃ¡i buá»•i báº£o vá»‡."}, status=status.HTTP_403_FORBIDDEN)

        council = council_member.council
        project_id = request.data.get("project_id")
        defense_status = request.data.get("defense_status", "DEFENDING")  # DEFENDING, DEFENDED, WAITING

        if not project_id:
            return Response({"detail": "project_id lÃ  báº¯t buá»™c."}, status=status.HTTP_400_BAD_REQUEST)

        project = get_object_or_404(GraduationProject, id=project_id, council=council)

        with transaction.atomic():
            if defense_status == "DEFENDING":
                # If there's another project currently defending in council, mark it DEFENDED
                GraduationProject.objects.filter(council=council, status="DEFENDING").exclude(id=project.id).update(status="DEFENDED")

                project.status = "DEFENDING"
                project.save(update_fields=["status"])

                council.current_defending_project = project
                council.save(update_fields=["current_defending_project"])

                status_msg = f"ÄÃ£ chuyá»ƒn sinh viÃªn {project.student.user.get_full_name()} ({project.student.registration_no}) sang tráº¡ng thÃ¡i 'Äang báº£o vá»‡'."
            elif defense_status == "DEFENDED":
                project.status = "DEFENDED"
                project.save(update_fields=["status"])

                if council.current_defending_project_id == project.id:
                    council.current_defending_project = None
                    council.save(update_fields=["current_defending_project"])

                status_msg = f"ÄÃ£ hoÃ n táº¥t pháº§n báº£o vá»‡ cho sinh viÃªn {project.student.user.get_full_name()}."
            else:  # WAITING
                if project.status == "DEFENDING":
                    project.status = "DEFENSE_READY"
                project.save(update_fields=["status"])

                if council.current_defending_project_id == project.id:
                    council.current_defending_project = None
                    council.save(update_fields=["current_defending_project"])

                status_msg = f"ÄÃ£ Ä‘áº·t láº¡i tráº¡ng thÃ¡i chá» báº£o vá»‡ cho sinh viÃªn {project.student.user.get_full_name()}."

            AuditLog.objects.create(
                user=user,
                action_type="evaluation_update",
                description=f"Há»™i Ä‘á»“ng {council.council_name}: {status_msg}"
            )

        return Response({
            "message": status_msg,
            "current_defending_project_id": council.current_defending_project_id,
            "project": GraduationProjectDetailSerializer(project).data
        }, status=status.HTTP_200_OK)


class CouncilSecretaryRemindScoringAPIView(APIView):
    """ThÆ° kÃ½ (hoáº·c Chá»§ tá»‹ch) nháº¯c nhá»Ÿ cÃ¡c thÃ nh viÃªn há»™i Ä‘á»“ng chÆ°a ná»™p Ä‘iá»ƒm báº£o vá»‡"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        council_member = CouncilMember.objects.filter(user=user).select_related("council").first()
        if not council_member:
            return Response({"detail": "Báº¡n khÃ´ng pháº£i thÃ nh viÃªn Há»™i Ä‘á»“ng báº£o vá»‡."}, status=status.HTTP_403_FORBIDDEN)

        if council_member.role not in ["SECRETARY", "CHAIR"]:
            return Response({"detail": "Chá»‰ ThÆ° kÃ½ hoáº·c Chá»§ tá»‹ch há»™i Ä‘á»“ng má»›i cÃ³ quyá»n gá»­i nháº¯c nhá»Ÿ ná»™p Ä‘iá»ƒm."}, status=status.HTTP_403_FORBIDDEN)

        council = council_member.council
        project_id = request.data.get("project_id")
        if not project_id:
            if council.current_defending_project_id:
                project_id = council.current_defending_project_id
            else:
                return Response({"detail": "Vui lÃ²ng chá»n Ä‘á» tÃ i/sinh viÃªn cáº§n nháº¯c ná»™p Ä‘iá»ƒm."}, status=status.HTTP_400_BAD_REQUEST)

        project = get_object_or_404(GraduationProject, id=project_id, council=council)

        # Find eligible members (exclude supervisor of this student)
        eligible_members = [
            m for m in council.members.select_related("user").all()
            if not (m.supervisor_id and m.supervisor_id == project.supervisor_id)
        ]

        # Find members who already submitted score
        submitted_member_ids = set(CouncilLiveScore.objects.filter(project=project).values_list("member_id", flat=True))

        pending_members = [m for m in eligible_members if m.id not in submitted_member_ids]

        reminded_list = []
        for m in pending_members:
            title = f"ðŸ”” [Há»™i Ä‘á»“ng #{council.council_number}] Nháº¯c nhá»Ÿ ná»™p Ä‘iá»ƒm báº£o vá»‡"
            msg = (
                f"ThÆ° kÃ½ Há»™i Ä‘á»“ng {council.council_name} kÃ­nh nháº¯c Tháº§y/CÃ´ {m.user.get_full_name()} "
                f"chÆ°a ná»™p Ä‘iá»ƒm báº£o vá»‡ cho SV {project.student.user.get_full_name()} (MSSV: {project.student.registration_no}) "
                f"- Äá» tÃ i: '{project.topic_title_vi}'. KÃ­nh Ä‘á» nghá»‹ Tháº§y/CÃ´ hoÃ n táº¥t cháº¥m Ä‘iá»ƒm."
            )
            try:
                NotificationService.create_notification(
                    user=m.user,
                    notification_type="general",
                    title=title,
                    message=msg,
                    action_url="/utc-live-defense",
                    send_email=True
                )
            except Exception as e:
                logger.warning("Could not send reminder notification: %s", e)

            reminded_list.append({
                "id": m.id,
                "name": m.user.get_full_name() or m.user.username,
                "role": m.get_role_display(),
                "email": m.user.email
            })

        names_str = ", ".join(m["name"] for m in reminded_list) if reminded_list else "KhÃ´ng cÃ³ thÃ nh viÃªn nÃ o chÆ°a ná»™p"
        success_message = (
            f"ÄÃ£ gá»­i thÃ´ng bÃ¡o nháº¯c nhá»Ÿ ná»™p Ä‘iá»ƒm tá»›i {len(reminded_list)} thÃ nh viÃªn: {names_str}."
            if reminded_list
            else "Táº¥t cáº£ cÃ¡c thÃ nh viÃªn há»™i Ä‘á»“ng Ä‘Ã£ ná»™p Ä‘á»§ Ä‘iá»ƒm cho sinh viÃªn nÃ y!"
        )

        return Response({
            "success": True,
            "message": success_message,
            "reminded_members": reminded_list,
            "already_submitted_count": len(submitted_member_ids),
            "pending_count": len(pending_members)
        }, status=status.HTTP_200_OK)


class CouncilScheduleDefenseAPIView(APIView):
    """
    TC-036: Xáº¿p lá»‹ch báº£o vá»‡ cho Há»™i Ä‘á»“ng:
    - Kiá»ƒm tra vÃ  ngÄƒn cháº·n Overlapping Schedule (trÃ¹ng giá» báº£o vá»‡ cá»§a Giáº£ng viÃªn/Pháº£n biá»‡n trong 2 Há»™i Ä‘á»“ng khÃ¡c nhau).
    - BÃ¡o lá»—i xung Ä‘á»™t lá»‹ch (Conflict Schedule).
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, council_id=None):
        user = request.user
        if not (user.is_staff or user.is_superuser or getattr(user, "user_type", None) in ["admin", "committee", "faculty_admin"]):
            return Response({"detail": "Chá»‰ Ban chá»§ nhiá»‡m hoáº·c Admin má»›i cÃ³ quyá»n xáº¿p lá»‹ch báº£o vá»‡."}, status=status.HTTP_403_FORBIDDEN)

        cid = council_id or request.data.get("council_id")
        if not cid:
            return Response({"detail": "council_id lÃ  báº¯t buá»™c."}, status=status.HTTP_400_BAD_REQUEST)

        council = get_object_or_404(DefenseCouncil, id=cid)
        session_date = request.data.get("session_date")
        session_time = request.data.get("session_time")
        defense_room = request.data.get("defense_room", "").strip()
        force = request.data.get("force") or request.data.get("override")
        if isinstance(force, str):
            force = force.lower() in ["true", "1"]

        target_date = session_date or council.session_date
        target_time = session_time or council.session_time
        target_room = defense_room or council.defense_room

        # TC-036: Overlapping Schedule Validation
        if target_date and target_time and not force:
            other_councils = DefenseCouncil.objects.filter(
                session_date=target_date,
                session_time=target_time
            ).exclude(id=council.id)

            if other_councils.exists():
                # Get all member users and supervisors of current council
                current_members = list(council.members.select_related("user", "supervisor").all())
                current_user_ids = {m.user_id for m in current_members if m.user_id}
                current_supervisor_ids = {m.supervisor_id for m in current_members if m.supervisor_id}

                # Also get reviewers of projects in current council
                current_projects = list(GraduationProject.objects.filter(council=council).select_related("reviewer__user"))
                for p in current_projects:
                    if p.reviewer:
                        current_supervisor_ids.add(p.reviewer.id)
                        if p.reviewer.user_id:
                            current_user_ids.add(p.reviewer.user_id)

                conflicts = []
                for other in other_councils:
                    other_members = list(other.members.select_related("user", "supervisor").all())
                    for om in other_members:
                        if (om.user_id and om.user_id in current_user_ids) or (om.supervisor_id and om.supervisor_id in current_supervisor_ids):
                            m_name = om.user.get_full_name() or om.user.username if om.user else "Giáº£ng viÃªn"
                            conflicts.append({
                                "member_name": m_name,
                                "role": om.get_role_display(),
                                "other_council_id": other.id,
                                "other_council_name": other.council_name or f"HÄ #{other.council_number}",
                                "conflict_type": "MEMBER_OVERLAP"
                            })

                    # Check reviewer of projects in other council
                    other_projects = list(GraduationProject.objects.filter(council=other).select_related("reviewer__user"))
                    for op in other_projects:
                        if op.reviewer and (op.reviewer.id in current_supervisor_ids or (op.reviewer.user_id and op.reviewer.user_id in current_user_ids)):
                            r_name = op.reviewer.user.get_full_name() if op.reviewer.user else "GV Pháº£n biá»‡n"
                            conflicts.append({
                                "member_name": r_name,
                                "role": "Giáº£ng viÃªn pháº£n biá»‡n",
                                "other_council_id": other.id,
                                "other_council_name": other.council_name or f"HÄ #{other.council_number}",
                                "conflict_type": "REVIEWER_OVERLAP"
                            })

                    # Check room conflict
                    if target_room and other.defense_room and target_room.lower() == other.defense_room.lower():
                        conflicts.append({
                            "member_name": f"PhÃ²ng báº£o vá»‡ {target_room}",
                            "role": "PhÃ²ng báº£o vá»‡",
                            "other_council_id": other.id,
                            "other_council_name": other.council_name or f"HÄ #{other.council_number}",
                            "conflict_type": "ROOM_OVERLAP"
                        })

                if conflicts:
                    first_conf = conflicts[0]
                    return Response({
                        "detail": f"BÃ¡o lá»—i xung Ä‘á»™t lá»‹ch (Conflict Schedule): {first_conf['role']} {first_conf['member_name']} bá»‹ trÃ¹ng giá» trong 2 Há»™i Ä‘á»“ng khÃ¡c nhau ({council.council_name} vÃ  {first_conf['other_council_name']}) vÃ o ngÃ y {target_date} ({target_time}).",
                        "error": "conflict_schedule",
                        "conflicts": conflicts,
                        "session_date": str(target_date),
                        "session_time": target_time,
                    }, status=status.HTTP_400_BAD_REQUEST)

        if session_date:
            council.session_date = session_date
        if session_time:
            council.session_time = session_time
        if defense_room:
            council.defense_room = defense_room

        council.save()

        # Send UTC branded email notifications to all parties
        NotificationService.notify_defense_scheduled_emails(council)

        return Response({
            "message": f"Xáº¿p lá»‹ch báº£o vá»‡ thÃ nh cÃ´ng cho Há»™i Ä‘á»“ng sá»‘ {council.council_number} vÃ  Ä‘Ã£ kÃ­ch hoáº¡t email thÃ´ng bÃ¡o nháº­n diá»‡n UTC!",
            "council": {
                "id": council.id,
                "council_number": council.council_number,
                "session_date": str(council.session_date),
                "session_time": council.session_time,
                "defense_room": council.defense_room,
            }
        }, status=status.HTTP_200_OK)


# ==============================================================================
# COUNCIL CONFLICT OF INTEREST & ASSIGNMENT MANAGEMENT
# ==============================================================================

class CouncilConflictCheckAPIView(APIView):
    """
    API kiá»ƒm tra xung Ä‘á»™t lá»£i Ã­ch (Conflict of Interest) trong phÃ¢n cÃ´ng há»™i Ä‘á»“ng báº£o vá»‡.
    Há»— trá»£ kiá»ƒm tra toÃ n bá»™ há»™i Ä‘á»“ng trong Ä‘á»£t hoáº·c má»™t há»™i Ä‘á»“ng cá»¥ thá»ƒ.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        council_id = request.query_params.get("council_id")
        batch_id = request.query_params.get("batch_id")

        if council_id:
            try:
                council_id = int(council_id)
            except ValueError:
                return Response({"detail": "council_id pháº£i lÃ  sá»‘ nguyÃªn."}, status=status.HTTP_400_BAD_REQUEST)

        if batch_id:
            try:
                batch_id = int(batch_id)
            except ValueError:
                return Response({"detail": "batch_id pháº£i lÃ  sá»‘ nguyÃªn."}, status=status.HTTP_400_BAD_REQUEST)

        data = CouncilConflictService.check_council_conflicts(council_id=council_id, batch_id=batch_id)
        return Response(data, status=status.HTTP_200_OK)


class CouncilAssignProjectAPIView(APIView):
    """
    API phÃ¢n cÃ´ng Ä‘á» tÃ i vÃ o há»™i Ä‘á»“ng báº£o vá»‡ cÃ³ kiá»ƒm tra cáº£nh bÃ¡o xung Ä‘á»™t lá»£i Ã­ch.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        project_id = request.data.get("project_id")
        council_id = request.data.get("council_id")
        force = request.data.get("force", False)
        if isinstance(force, str):
            force = force.lower() in ("true", "1")
        else:
            force = bool(force)

        if not project_id:
            return Response({"detail": "project_id lÃ  báº¯t buá»™c."}, status=status.HTTP_400_BAD_REQUEST)

        project = get_object_or_404(
            GraduationProject.objects.select_related("student__user", "supervisor__user", "reviewer__user"),
            id=project_id
        )

        # Unassign if council_id is None or 0
        if council_id is None or council_id == "" or council_id == 0:
            old_council_name = project.council.council_name if project.council else "KhÃ´ng"
            project.council = None
            project.save(update_fields=["council"])

            AuditLog.objects.create(
                user=request.user,
                action_type="status_change",
                description=f"Há»§y phÃ¢n cÃ´ng Ä‘á» tÃ i {project.student.registration_no} khá»i há»™i Ä‘á»“ng {old_council_name}."
            )
            return Response({
                "success": True,
                "message": f"ÄÃ£ há»§y phÃ¢n cÃ´ng Ä‘á» tÃ i khá»i há»™i Ä‘á»“ng.",
                "project_id": project.id,
                "council_id": None
            }, status=status.HTTP_200_OK)

        council = get_object_or_404(DefenseCouncil, id=council_id)

        # Boundary check: Quy cháº¿ UTC tá»‘i Ä‘a 12 sinh viÃªn trong má»™t buá»•i báº£o vá»‡ (max_limit=12)
        current_assigned_count = council.projects.exclude(id=project.id).count()
        if current_assigned_count >= 12:
            return Response({
                "success": False,
                "error": "limit_exceeded",
                "max_limit": 12,
                "current_count": current_assigned_count,
                "detail": f"Há»™i Ä‘á»“ng '{council.council_name}' Ä‘Ã£ Ä‘áº¡t giá»›i háº¡n tá»‘i Ä‘a 12 sinh viÃªn trong má»™t buá»•i báº£o vá»‡. KhÃ´ng thá»ƒ xáº¿p thÃªm sinh viÃªn thá»© {current_assigned_count + 1}.",
                "message": f"Há»™i Ä‘á»“ng '{council.council_name}' Ä‘Ã£ Ä‘áº¡t giá»›i háº¡n tá»‘i Ä‘a 12 sinh viÃªn trong má»™t buá»•i báº£o vá»‡. KhÃ´ng thá»ƒ xáº¿p thÃªm sinh viÃªn thá»© {current_assigned_count + 1}."
            }, status=status.HTTP_400_BAD_REQUEST)

        conflicts = CouncilConflictService.check_project_assignment(council, project)

        if conflicts and not force:
            return Response({
                "success": False,
                "has_conflict": True,
                "conflicts_count": len(conflicts),
                "conflicts": conflicts,
                "message": conflicts[0].get("message", f"KhÃ´ng thá»ƒ xáº¿p sinh viÃªn vÃ o Há»™i Ä‘á»“ng cÃ³ GVHD tham gia cháº¥m. ({len(conflicts)} vi pháº¡m)")
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            project.council = council
            project.save(update_fields=["council"])
        except Exception as e:
            return Response({
                "success": False,
                "error": "constraint_violation",
                "detail": f"Lá»—i rÃ ng buá»™c CSDL: {str(e)}",
                "message": f"KhÃ´ng thá»ƒ xáº¿p sinh viÃªn vÃ o há»™i Ä‘á»“ng do vi pháº¡m rÃ ng buá»™c CSDL: {str(e)}"
            }, status=status.HTTP_400_BAD_REQUEST)

        AuditLog.objects.create(
            user=request.user,
            action_type="status_change",
            description=f"PhÃ¢n cÃ´ng Ä‘á» tÃ i {project.student.registration_no} vÃ o {council.council_name}."
        )

        return Response({
            "success": True,
            "message": f"ÄÃ£ phÃ¢n cÃ´ng Ä‘á» tÃ i cá»§a sinh viÃªn {project.student.user.get_full_name()} vÃ o {council.council_name}.",
            "project_id": project.id,
            "council_id": council.id,
            "council_name": council.council_name,
            "has_conflict": len(conflicts) > 0,
            "conflicts": conflicts
        }, status=status.HTTP_200_OK)


class CouncilAssignMemberAPIView(APIView):
    """
    API thÃªm hoáº·c cáº­p nháº­t thÃ nh viÃªn vÃ o há»™i Ä‘á»“ng báº£o vá»‡ cÃ³ kiá»ƒm tra cáº£nh bÃ¡o xung Ä‘á»™t lá»£i Ã­ch
    vÃ  tá»‘i Æ°u hÃ³a phÃ¢n bá»• hÆ°á»›ng nghiÃªn cá»©u (TC_039: CÃ¢n báº±ng Há»™i Ä‘á»“ng: Æ¯u tiÃªn gÃ¡n pháº£n biá»‡n cÃ³ cÃ¹ng lÄ©nh vá»±c vá»›i Äá» tÃ i).
    Quy cháº¿: GV hÆ°á»›ng dáº«n KHÃ”NG náº±m trong há»™i Ä‘á»“ng/pháº£n biá»‡n cá»§a chÃ­nh sinh viÃªn Ä‘Ã³.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Gá»£i Ã½ danh sÃ¡ch giáº£ng viÃªn pháº£n biá»‡n / á»§y viÃªn Ä‘Æ°á»£c tá»‘i Æ°u theo hÆ°á»›ng nghiÃªn cá»©u cá»§a cÃ¡c Ä‘á» tÃ i trong há»™i Ä‘á»“ng"""
        council_id = request.query_params.get("council_id")
        if not council_id:
            return Response({"detail": "council_id lÃ  báº¯t buá»™c."}, status=status.HTTP_400_BAD_REQUEST)

        council = get_object_or_404(DefenseCouncil, id=council_id)
        projects = list(council.projects.all().select_related("topic_category", "supervisor__user"))
        supervisors = list(Supervisor.objects.all().select_related("user"))

        existing_user_ids = set(council.members.values_list("user_id", flat=True))

        recommendations = []
        for s in supervisors:
            # Check COI
            conflicts = CouncilConflictService.check_member_assignment(council, s.user, s)
            has_coi = len(conflicts) > 0

            # Calculate match score across all projects in council
            scores = [CouncilStructureService.calculate_topic_match_score(s, p) for p in projects]
            avg_score = round(sum(scores) / len(scores), 1) if scores else 0.0
            max_score = max(scores, default=0.0)

            recommendations.append({
                "supervisor_id": s.id,
                "user_id": s.user.id,
                "full_name": s.user.get_full_name() or s.user.username,
                "academic_title": s.academic_title or "ThS",
                "department": s.department_name,
                "research_interest": s.research_interest,
                "topic_match_score": max_score,
                "avg_match_score": avg_score,
                "is_topic_matched": max_score >= 3.0,
                "has_coi": has_coi,
                "is_already_member": s.user.id in existing_user_ids,
                "conflicts": conflicts
            })

        recommendations.sort(key=lambda x: (not x["has_coi"], not x["is_already_member"], x["topic_match_score"]), reverse=True)

        return Response({
            "council_id": council.id,
            "council_name": council.council_name,
            "projects_count": len(projects),
            "recommendations": recommendations[:20]
        }, status=status.HTTP_200_OK)

    def post(self, request):
        council_id = request.data.get("council_id")
        user_id = request.data.get("user_id")
        supervisor_id = request.data.get("supervisor_id")
        role = request.data.get("role", "MEMBER")
        auto_assign = request.data.get("auto_assign", False)
        optimize_topics = request.data.get("optimize_topics", False)

        if isinstance(auto_assign, str):
            auto_assign = auto_assign.lower() in ("true", "1", "yes")
        if isinstance(optimize_topics, str):
            optimize_topics = optimize_topics.lower() in ("true", "1", "yes")

        if not council_id:
            return Response({"detail": "council_id lÃ  báº¯t buá»™c."}, status=status.HTTP_400_BAD_REQUEST)

        council = get_object_or_404(DefenseCouncil, id=council_id)
        council_projects = list(council.projects.all().select_related("topic_category", "supervisor__user"))

        # Thuáº­t toÃ¡n tá»± Ä‘á»™ng tá»‘i Æ°u hÃ³a gÃ¡n pháº£n biá»‡n theo hÆ°á»›ng nghiÃªn cá»©u (TC_039)
        if (auto_assign or optimize_topics or not (user_id or supervisor_id)) and council_projects:
            all_supervisors = list(Supervisor.objects.select_related("user").all())
            existing_sup_ids = set(council.members.filter(supervisor__isnull=False).values_list("supervisor_id", flat=True))

            best_sup = None
            best_score = -1.0

            for cand in all_supervisors:
                if cand.id in existing_sup_ids:
                    continue
                coi = CouncilConflictService.check_member_assignment(council, cand.user, cand)
                if coi:
                    continue
                cand_scores = [CouncilStructureService.calculate_topic_match_score(cand, p) for p in council_projects]
                max_cand_score = max(cand_scores, default=0.0)
                if max_cand_score > best_score:
                    best_score = max_cand_score
                    best_sup = cand

            if best_sup:
                user = best_sup.user
                supervisor = best_sup
                role = role or "REVIEWER"
            else:
                return Response({
                    "success": False,
                    "detail": "KhÃ´ng tÃ¬m tháº¥y giáº£ng viÃªn phÃ¹ há»£p khÃ´ng cÃ³ xung Ä‘á»™t lá»£i Ã­ch Ä‘á»ƒ phÃ¢n cÃ´ng."
                }, status=status.HTTP_400_BAD_REQUEST)
        else:
            if not user_id and not supervisor_id:
                return Response({"detail": "council_id vÃ  user_id (hoáº·c supervisor_id) lÃ  báº¯t buá»™c."}, status=status.HTTP_400_BAD_REQUEST)

            user = None
            supervisor = None
            if supervisor_id:
                supervisor = Supervisor.objects.filter(id=supervisor_id).first()
                if supervisor:
                    user = supervisor.user

            if not user and user_id:
                user = CustomUser.objects.filter(id=user_id).first()
                if user:
                    supervisor = Supervisor.objects.filter(user=user).first()
                if not supervisor:
                    supervisor = Supervisor.objects.filter(id=user_id).first()
                    if supervisor and not user:
                        user = supervisor.user

            if not user:
                return Response({"detail": "KhÃ´ng tÃ¬m tháº¥y thÃ´ng tin giáº£ng viÃªn/ngÆ°á»i dÃ¹ng."}, status=status.HTTP_404_NOT_FOUND)

        # Cross-check conflict of interest: GVHD cannot evaluate/review their own students in council
        conflicts = CouncilConflictService.check_member_assignment(council, user, supervisor)

        if conflicts:
            return Response({
                "success": False,
                "has_conflict": True,
                "conflicts_count": len(conflicts),
                "conflicts": conflicts,
                "message": conflicts[0].get("message", f"Xung Ä‘á»™t lá»£i Ã­ch: Giáº£ng viÃªn hÆ°á»›ng dáº«n khÃ´ng Ä‘Æ°á»£c lÃ m thÃ nh viÃªn/pháº£n biá»‡n trong há»™i Ä‘á»“ng cá»§a chÃ­nh sinh viÃªn Ä‘Ã³.")
            }, status=status.HTTP_400_BAD_REQUEST)

        # Calculate topic match score (TC_039: CÃ¢n báº±ng há»™i Ä‘á»“ng & Æ¯u tiÃªn cÃ¹ng lÄ©nh vá»±c)
        topic_match_score = 0.0
        if supervisor and council_projects:
            scores = [CouncilStructureService.calculate_topic_match_score(supervisor, p) for p in council_projects]
            topic_match_score = max(scores, default=0.0)

            # GÃ¡n lÃ m GVPB (Reviewer) cho cÃ¡c Ä‘á» tÃ i trong há»™i Ä‘á»“ng náº¿u vai trÃ² lÃ  REVIEWER hoáº·c MEMBER
            if role in ["REVIEWER", "MEMBER"]:
                for p in council_projects:
                    if not p.reviewer or CouncilStructureService.calculate_topic_match_score(supervisor, p) >= 3.0:
                        p.reviewer = supervisor
                        p.save(update_fields=["reviewer"])

        member, created = CouncilMember.objects.update_or_create(
            council=council,
            user=user,
            defaults={
                "role": role,
                "supervisor": supervisor
            }
        )

        AuditLog.objects.create(
            user=request.user,
            action_type="status_change",
            description=f"{'ThÃªm' if created else 'Cáº­p nháº­t'} á»§y viÃªn {user.get_full_name()} ({member.get_role_display()}) vÃ o {council.council_name}."
        )

        return Response({
            "success": True,
            "message": f"ÄÃ£ phÃ¢n cÃ´ng Tháº§y/CÃ´ {user.get_full_name()} vÃ o {council.council_name} ({member.get_role_display()}).",
            "member_id": member.id,
            "council_id": council.id,
            "role": member.role,
            "role_display": member.get_role_display(),
            "topic_match_score": topic_match_score,
            "is_topic_matched": topic_match_score >= 3.0,
            "has_conflict": len(conflicts) > 0,
            "conflicts": conflicts
        }, status=status.HTTP_200_OK)


# Alias AssignMemberAPIView for TC_039
AssignMemberAPIView = CouncilAssignMemberAPIView


# ==============================================================================
# GLOBAL SEARCH API
# ==============================================================================

class GlobalSearchAPIView(APIView):
    """
    Thanh tÃ¬m kiáº¿m toÃ n cá»¥c (Global Search) á»Ÿ Top Header.
    TÃ¬m kiáº¿m tá»©c thá»i Ä‘a Ä‘á»‘i tÆ°á»£ng: Äá» tÃ i, Sinh viÃªn, Giáº£ng viÃªn, Há»™i Ä‘á»“ng, Biá»ƒu máº«u.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.db.models import Q

        q = request.query_params.get("q", "").strip()
        search_type = request.query_params.get("type", "all").lower()

        if not q or len(q) < 2:
            return Response({
                "query": q,
                "total_results": 0,
                "results": [],
                "categories": {
                    "projects": 0,
                    "faculty": 0,
                    "students": 0,
                    "councils": 0,
                    "documents": 0
                }
            }, status=status.HTTP_200_OK)

        results = []

        # 1. Projects (GraduationProject & Project)
        if search_type in ["all", "projects"]:
            # Graduation Projects (UTC)
            grad_projects = GraduationProject.objects.filter(
                Q(topic_title_vi__icontains=q) |
                Q(topic_title_en__icontains=q) |
                Q(student__registration_no__icontains=q) |
                Q(student__user__first_name__icontains=q) |
                Q(student__user__last_name__icontains=q) |
                Q(supervisor__user__first_name__icontains=q) |
                Q(supervisor__user__last_name__icontains=q)
            ).select_related("student__user", "supervisor__user", "council")[:8]

            for p in grad_projects:
                s_name = p.student.user.get_full_name() or p.student.user.username
                results.append({
                    "id": f"grad_project_{p.id}",
                    "item_id": p.id,
                    "type": "project",
                    "type_label": "Äá»“ Ã¡n Tá»‘t nghiá»‡p",
                    "icon": "ðŸŽ“",
                    "title": p.topic_title_vi or p.topic_title_en,
                    "subtitle": f"SV: {s_name} ({p.student.registration_no}) â€¢ Lá»›p: {p.student.course_class or 'K62'}",
                    "extra_info": f"HÄ: {p.council.council_name if p.council else 'ChÆ°a gÃ¡n'} â€¢ Tráº¡ng thÃ¡i: {p.get_status_display()}",
                    "action_url": f"/student/dashboard?tab=overview",
                })

            # Standard FYP Projects (legacy fallback)
            try:
                fyp_projects = Project.objects.filter(
                    Q(project_name__icontains=q) |
                    Q(project_description__icontains=q) |
                    Q(language__icontains=q)
                ).select_related("project_category")[:5]

                for p in fyp_projects:
                    results.append({
                        "id": f"fyp_project_{p.id}",
                        "item_id": p.id,
                        "type": "project",
                        "type_label": "Äá» tÃ i FYP",
                        "icon": "ðŸ“",
                        "title": p.project_name,
                        "subtitle": f"NgÃ´n ngá»¯: {p.language or 'N/A'} â€¢ Danh má»¥c: {p.project_category.category_name if p.project_category else 'N/A'}",
                        "extra_info": p.project_description[:80] + "..." if p.project_description and len(p.project_description) > 80 else p.project_description,
                        "action_url": f"/student/dashboard?tab=project",
                    })
            except Exception:
                pass

        # 2. Faculty / Supervisors
        if search_type in ["all", "faculty"]:
            supervisors = Supervisor.objects.filter(
                Q(user__first_name__icontains=q) |
                Q(user__last_name__icontains=q) |
                Q(user__username__icontains=q) |
                Q(user__email__icontains=q) |
                Q(supervisor_id__icontains=q) |
                Q(department_name__icontains=q)
            ).select_related("user")[:6]

            for s in supervisors:
                name = s.user.get_full_name() or s.user.username
                results.append({
                    "id": f"supervisor_{s.id}",
                    "item_id": s.id,
                    "type": "faculty",
                    "type_label": "Giáº£ng viÃªn",
                    "icon": "ðŸ‘¨â€ðŸ«",
                    "title": f"{s.academic_title or 'ThS/TS'}. {name}",
                    "subtitle": f"Bá»™ mÃ´n: {s.department_name or 'CNTT'} â€¢ Email: {s.user.email or 'N/A'}",
                    "extra_info": f"MÃ£ GV: {s.supervisor_id}",
                    "action_url": f"/supervisor/dashboard",
                })

        # 3. Students
        if search_type in ["all", "students"]:
            students = Student.objects.filter(
                Q(user__first_name__icontains=q) |
                Q(user__last_name__icontains=q) |
                Q(user__username__icontains=q) |
                Q(user__email__icontains=q) |
                Q(registration_no__icontains=q) |
                Q(department__icontains=q)
            ).select_related("user")[:6]

            for st in students:
                name = st.user.get_full_name() or st.user.username
                results.append({
                    "id": f"student_{st.id}",
                    "item_id": st.id,
                    "type": "student",
                    "type_label": "Sinh viÃªn",
                    "icon": "ðŸ‘¨â€ðŸŽ“",
                    "title": name,
                    "subtitle": f"MSSV: {st.registration_no} â€¢ Khoa: {st.department or 'CNTT'}",
                    "extra_info": f"Email: {st.user.email or 'N/A'}",
                    "action_url": f"/student/dashboard",
                })

        # 4. Councils & Panels
        if search_type in ["all", "councils"]:
            councils = DefenseCouncil.objects.filter(
                Q(council_name__icontains=q) |
                Q(defense_room__icontains=q)
            ).select_related("batch")[:6]

            for c in councils:
                results.append({
                    "id": f"council_{c.id}",
                    "item_id": c.id,
                    "type": "council",
                    "type_label": "Há»™i Ä‘á»“ng Báº£o vá»‡",
                    "icon": "ðŸ›ï¸",
                    "title": f"{c.council_name} (HÄ #{c.council_number})",
                    "subtitle": f"PhÃ²ng: {c.defense_room or 'TBA'} â€¢ NgÃ y: {c.session_date or 'TBA'} ({c.session_time})",
                    "extra_info": f"Äá»£t: {c.batch.batch_code if c.batch else 'Ká»³ hiá»‡n táº¡i'}",
                    "action_url": f"/committee_member/dashboard?tab=utc_live_defense",
                })

        # 5. Documents & Templates
        if search_type in ["all", "documents"]:
            try:
                doc_reqs = DocumentRequirement.objects.filter(
                    Q(title__icontains=q) |
                    Q(document_type__icontains=q)
                )[:5]

                for d in doc_reqs:
                    results.append({
                        "id": f"doc_{d.id}",
                        "item_id": d.id,
                        "type": "document",
                        "type_label": "Biá»ƒu máº«u / TÃ i liá»‡u",
                        "icon": "ðŸ“„",
                        "title": d.title,
                        "subtitle": f"Loáº¡i: {d.get_document_type_display()} â€¢ Háº¡n ná»™p: {d.deadline.strftime('%d/%m/%Y %H:%M') if d.deadline else 'KhÃ´ng cÃ³'}",
                        "extra_info": f"Há»c ká»³: {d.semester}",
                        "action_url": f"/student/dashboard?tab=documents",
                    })
            except Exception:
                pass

        # Tally counts by category
        categories_count = {
            "projects": sum(1 for r in results if r["type"] == "project"),
            "faculty": sum(1 for r in results if r["type"] == "faculty"),
            "students": sum(1 for r in results if r["type"] == "student"),
            "councils": sum(1 for r in results if r["type"] == "council"),
            "documents": sum(1 for r in results if r["type"] == "document"),
        }

        return Response({
            "query": q,
            "total_results": len(results),
            "categories": categories_count,
            "results": results
        }, status=status.HTTP_200_OK)


# ==============================================================================
# PHASE 2: ALLOCATION OPTIMIZATION & OVERRIDE APIS
# ==============================================================================

class BatchProgressAPIView(APIView):
    """
    Tiáº¿n trÃ¬nh 6 giai Ä‘oáº¡n cá»§a Ä‘á»£t Ä‘á»“ Ã¡n hiá»‡n táº¡i â€” dÃ¹ng cho thanh tiáº¿n trÃ¬nh
    á»Ÿ Ä‘áº§u trang cá»§a Cá»•ng Sinh viÃªn / Cá»•ng Giáº£ng viÃªn.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from .utils.batch_progress import compute_batch_progress

        user = request.user
        batch = None

        # Æ¯u tiÃªn Ä‘á»£t mÃ  sinh viÃªn Ä‘ang tham gia
        student = getattr(user, "student_profile", None)
        if student is not None and student.academic_batch_id:
            batch = student.academic_batch

        # Giáº£ng viÃªn: Æ°u tiÃªn Ä‘á»£t cÃ³ Ä‘á» tÃ i Ä‘ang hÆ°á»›ng dáº«n
        if batch is None:
            supervisor = getattr(user, "supervisor_profile", None)
            if supervisor is not None:
                batch = (
                    GraduationProject.objects.filter(supervisor=supervisor)
                    .select_related("batch")
                    .order_by("-created_at")
                    .values_list("batch", flat=True)
                    .first()
                )
                if batch is not None:
                    batch = AcademicBatch.objects.filter(id=batch).first()

        if batch is None:
            batch = AcademicBatch.get_active_batch() or AcademicBatch.objects.order_by("-id").first()

        if not batch:
            return Response(
                {
                    "is_open": False,
                    "current_stage_number": 1,
                    "overall_percent": 0,
                    "stages": [],
                    "next_actions": ["ChÆ°a cÃ³ Ä‘á»£t Ä‘á»“ Ã¡n nÃ o Ä‘ang hoáº¡t Ä‘á»™ng."],
                },
                status=status.HTTP_200_OK,
            )

        data = compute_batch_progress(batch)

        # Bá»• sung tiáº¿n Ä‘á»™ cÃ¡ nhÃ¢n cho sinh viÃªn
        if student is not None:
            project = getattr(student, "graduation_project", None)
            data["my_project"] = {
                "has_project": project is not None,
                "status": getattr(project, "status", None),
                "topic_title": getattr(project, "topic_title_vi", ""),
                "supervisor_name": (
                    project.supervisor.user.get_full_name() if project and project.supervisor_id else ""
                ),
            }

        return Response(data, status=status.HTTP_200_OK)


class RunAllocationAlgorithmAPIView(APIView):
    """Khoa / Admin cháº¡y thuáº­t toÃ¡n tá»‘i Æ°u phÃ¢n cÃ´ng nguyá»‡n vá»ng Ä‘á»“ Ã¡n"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        batch_id = request.data.get("batch_id")
        if batch_id:
            batch = get_object_or_404(AcademicBatch, id=batch_id)
        else:
            batch = AcademicBatch.get_active_batch()
            if not batch:
                return Response({"detail": "KhÃ´ng cÃ³ Ä‘á»£t Ä‘á»“ Ã¡n nÃ o Ä‘ang hoáº¡t Ä‘á»™ng."}, status=status.HTTP_400_BAD_REQUEST)

        stats = ThesisAllocationService.run_allocation(batch)
        try:
            allocations = ProposedAllocation.objects.filter(batch=batch).select_related(
                "student__user", "supervisor__user"
            )
            data = ProposedAllocationSerializer(allocations, many=True).data
        except Exception:
            projects = GraduationProject.objects.filter(batch=batch).select_related(
                "student__user", "supervisor__user"
            )
            data = [
                {
                    "id": p.id,
                    "student": p.student.id,
                    "student_name": p.student.user.get_full_name(),
                    "student_code": p.student.registration_no,
                    "supervisor": p.supervisor.id if p.supervisor else None,
                    "supervisor_name": p.supervisor.user.get_full_name() if p.supervisor else "",
                    "matched_preference": 1,
                    "match_score": 10.0,
                    "is_overridden": False,
                }
                for p in projects
            ]

        return Response({
            "success": True,
            "message": f"Cháº¡y thuáº­t toÃ¡n tá»‘i Æ°u phÃ¢n cÃ´ng thÃ nh cÃ´ng cho Ä‘á»£t {batch.batch_code}!",
            "stats": stats,
            "allocations": data,
        }, status=status.HTTP_200_OK)


class ProposedAllocationListAPIView(APIView):
    """Xem danh sÃ¡ch Ä‘á» xuáº¥t phÃ¢n cÃ´ng Ä‘á»ƒ Khoa review"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        batch_id = request.query_params.get("batch_id")
        if batch_id:
            batch = get_object_or_404(AcademicBatch, id=batch_id)
        else:
            batch = AcademicBatch.get_active_batch()
            if not batch:
                return Response({"detail": "KhÃ´ng cÃ³ Ä‘á»£t Ä‘á»“ Ã¡n nÃ o Ä‘ang hoáº¡t Ä‘á»™ng."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            allocations = ProposedAllocation.objects.filter(batch=batch).select_related(
                "student__user", "supervisor__user"
            )
            return Response(ProposedAllocationSerializer(allocations, many=True).data, status=status.HTTP_200_OK)
        except Exception:
            projects = GraduationProject.objects.filter(batch=batch).select_related(
                "student__user", "supervisor__user"
            )
            data = [
                {
                    "id": p.id,
                    "student": p.student.id,
                    "student_name": p.student.user.get_full_name(),
                    "student_code": p.student.registration_no,
                    "supervisor": p.supervisor.id if p.supervisor else None,
                    "supervisor_name": p.supervisor.user.get_full_name() if p.supervisor else "",
                    "matched_preference": 1,
                    "match_score": 10.0,
                    "is_overridden": False,
                }
                for p in projects
            ]
            return Response(data, status=status.HTTP_200_OK)


class OverrideAllocationAPIView(APIView):
    """Khoa review / override: Äiá»u chá»‰nh phÃ¢n cÃ´ng thá»§ cÃ´ng"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        allocation_id = request.data.get("allocation_id") or request.data.get("project_id")
        supervisor_id = request.data.get("supervisor_id")
        reason = request.data.get("reason", "Khoa Ä‘iá»u chá»‰nh thá»§ cÃ´ng").strip()

        if not allocation_id or not supervisor_id:
            return Response({"detail": "allocation_id vÃ  supervisor_id lÃ  báº¯t buá»™c."}, status=status.HTTP_400_BAD_REQUEST)

        supervisor = get_object_or_404(Supervisor, id=supervisor_id)

        alloc = None
        project = None
        try:
            alloc = ProposedAllocation.objects.filter(id=allocation_id).first()
        except Exception:
            alloc = None

        if not alloc:
            project = GraduationProject.objects.filter(id=allocation_id).first()
            if not project and request.data.get("project_id"):
                project = GraduationProject.objects.filter(id=request.data.get("project_id")).first()
            if not project:
                return Response({"detail": "KhÃ´ng tÃ¬m tháº¥y báº£n ghi phÃ¢n cÃ´ng hoáº·c Ä‘á»“ Ã¡n."}, status=status.HTTP_404_NOT_FOUND)

        student = alloc.student if alloc else project.student
        batch = alloc.batch if alloc else project.batch

        # Kiá»ƒm tra há»c vá»‹ Ká»¹ sÆ° náº¿u SV thuá»™c CT Ká»¹ sÆ°
        if student.degree_program == "ENGINEER":
            if not DegreeEligibilityService.is_doctoral_degree(supervisor.academic_title or ""):
                return Response({
                    "detail": f"KhÃ´ng thá»ƒ phÃ¢n cÃ´ng: SV {student.registration_no} thuá»™c CT Ká»¹ sÆ°, GVHD báº¯t buá»™c cÃ³ há»c vá»‹ Tiáº¿n sÄ© trá»Ÿ lÃªn."
                }, status=status.HTTP_400_BAD_REQUEST)

        force = request.data.get("force") or request.data.get("override") or request.data.get("force_assign")
        if isinstance(force, str):
            force = force.lower() in ["true", "1"]

        # TC-037: Quota / Capacity Check & Warning for Force Assign / Override
        q = SupervisorQuota.objects.filter(supervisor=supervisor, batch=batch).first()
        if q:
            max_quota = int(round(float(q.max_total_quota)))
        else:
            max_quota = ThesisAllocationService.calculate_capacity(supervisor, base_capacity=6)

        assigned_in_projects = GraduationProject.objects.filter(
            supervisor=supervisor, batch=batch
        ).exclude(id=project.id if project else None).count()

        assigned_in_proposals = 0
        try:
            assigned_in_proposals = ProposedAllocation.objects.filter(
                supervisor=supervisor, batch=batch
            ).exclude(id=alloc.id if alloc else None).count()
        except Exception:
            assigned_in_proposals = 0

        current_assigned = max(assigned_in_projects, assigned_in_proposals)
        is_quota_full = current_assigned >= max_quota
        warning_msg = None

        if is_quota_full:
            if not force:
                return Response({
                    "detail": f"Cáº£nh bÃ¡o: Giáº£ng viÃªn {supervisor.user.get_full_name()} Ä‘Ã£ Ä‘áº¡t Ä‘á»‹nh má»©c tá»‘i Ä‘a ({current_assigned}/{max_quota} Slot). Vui lÃ²ng xÃ¡c nháº­n Override / Force Assign Ä‘á»ƒ tiáº¿p tá»¥c gÃ¡n.",
                    "warning": f"Giáº£ng viÃªn Ä‘Ã£ Ä‘áº§y chá»‰ tiÃªu ({current_assigned}/{max_quota} Slot).",
                    "error": "supervisor_quota_exceeded",
                    "is_quota_exceeded": True,
                    "can_override": True,
                    "current_assigned": current_assigned,
                    "max_quota": max_quota,
                }, status=status.HTTP_400_BAD_REQUEST)
            else:
                warning_msg = f"Cáº£nh bÃ¡o: Giáº£ng viÃªn {supervisor.user.get_full_name()} Ä‘Ã£ Ä‘áº¡t Ä‘á»‹nh má»©c tá»‘i Ä‘a ({current_assigned}/{max_quota} Slot). Há»‡ thá»‘ng Ä‘Ã£ ghi nháº­n Ä‘iá»u chá»‰nh Ä‘áº·c cÃ¡ch (Force Assign/Override)."

        if alloc:
            alloc.supervisor = supervisor
            alloc.is_overridden = True
            alloc.override_reason = reason or ("Force Assign vÆ°á»£t chá»‰ tiÃªu" if is_quota_full else "Khoa Ä‘iá»u chá»‰nh thá»§ cÃ´ng")
            alloc.save(update_fields=["supervisor", "is_overridden", "override_reason"])
            alloc_data = ProposedAllocationSerializer(alloc).data
        else:
            project.supervisor = supervisor
            project.save(update_fields=["supervisor"])
            alloc_data = {
                "id": project.id,
                "student": student.id,
                "student_name": student.user.get_full_name(),
                "supervisor": supervisor.id,
                "supervisor_name": supervisor.user.get_full_name(),
                "is_overridden": True,
                "override_reason": reason,
            }

        resp_data = {
            "message": f"Khoa Ä‘Ã£ Ä‘iá»u chá»‰nh GVHD thÃ nh cÃ´ng cho SV {student.registration_no}!",
            "allocation": alloc_data,
            "is_overridden": True,
        }
        if warning_msg:
            resp_data["warning"] = warning_msg
            resp_data["is_quota_exceeded"] = True

        return Response(resp_data, status=status.HTTP_200_OK)


class FinalizeAllocationAPIView(APIView):
    """Khoa chá»‘t phÃ¢n cÃ´ng: Chuyá»ƒn toÃ n bá»™ Ä‘á» xuáº¥t thÃ nh GraduationProject vÃ  kÃ­ch hoáº¡t email"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        batch_id = request.data.get("batch_id")
        if batch_id:
            batch = get_object_or_404(AcademicBatch, id=batch_id)
        else:
            batch = AcademicBatch.get_active_batch()
            if not batch:
                return Response({"detail": "KhÃ´ng cÃ³ Ä‘á»£t Ä‘á»“ Ã¡n nÃ o Ä‘ang hoáº¡t Ä‘á»™ng."}, status=status.HTTP_400_BAD_REQUEST)

        result = ThesisAllocationService.finalize_allocation(batch, user=request.user)
        return Response({"success": True, **result}, status=status.HTTP_200_OK)


# ==============================================================================
# PHASE 3: TOPIC FORMULATION (DRAFT -> CONFIRM -> APPROVE -> PDF)
# ==============================================================================

class TopicDraftAPIView(APIView):
    """GV vÃ  SV cÃ¹ng xÃ¡c Ä‘á»‹nh Ä‘á» tÃ i (tráº¡ng thÃ¡i Draft)"""
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        return self._update_topic_draft(request)

    def post(self, request):
        return self._update_topic_draft(request)

    def _update_topic_draft(self, request):
        user = request.user
        project_id = request.data.get("project_id")
        topic_title_vi = request.data.get("topic_title_vi", "").strip()
        topic_title_en = request.data.get("topic_title_en", "").strip()

        if not topic_title_vi:
            return Response({"detail": "TÃªn Ä‘á» tÃ i tiáº¿ng Viá»‡t lÃ  báº¯t buá»™c."}, status=status.HTTP_400_BAD_REQUEST)

        if user.user_type == "student":
            student = getattr(user, "student_profile", None)
            project = get_object_or_404(GraduationProject, student=student)
        elif user.user_type == "supervisor":
            supervisor = getattr(user, "supervisor_profile", None)
            project = get_object_or_404(GraduationProject, id=project_id, supervisor=supervisor)
        else:
            project = get_object_or_404(GraduationProject, id=project_id)

        project.topic_title_vi = topic_title_vi
        if topic_title_en:
            project.topic_title_en = topic_title_en
        
        is_resubmit = request.data.get("is_resubmit") or request.data.get("action") == "resubmit"
        if is_resubmit or project.topic_review_status == "REVISION_REQUIRED" or project.status == "TOPIC_REVISION":
            project.status = "PENDING_REVIEW"
            project.topic_review_status = "GV_CONFIRMED"
            project.topic_revision_notes = ""
            msg = "ÄÃ£ chá»‰nh sá»­a vÃ  ná»™p láº¡i Ä‘á» tÃ i (Re-Submit thÃ nh cÃ´ng). Tráº¡ng thÃ¡i chuyá»ƒn thÃ nh 'Chá» Khoa duyá»‡t'."
        else:
            project.status = "TOPIC_DRAFT"
            project.topic_review_status = "DRAFT"
            msg = "ÄÃ£ cáº­p nháº­t tÃªn Ä‘á» tÃ i (Tráº¡ng thÃ¡i Draft)."

        project.save(update_fields=["topic_title_vi", "topic_title_en", "status", "topic_review_status", "topic_revision_notes"])

        return Response({
            "message": msg,
            "status": project.status,
            "project": GraduationProjectDetailSerializer(project).data
        }, status=status.HTTP_200_OK)


class SupervisorConfirmTopicAPIView(APIView):
    """GV xÃ¡c nháº­n Ä‘á» tÃ i (sau khi thá»‘ng nháº¥t vá»›i SV) Ä‘á»ƒ trÃ¬nh Khoa/Ban duyá»‡t"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        supervisor = getattr(user, "supervisor_profile", None)
        if not supervisor:
            return Response({"detail": "Chá»‰ dÃ nh cho Giáº£ng viÃªn hÆ°á»›ng dáº«n."}, status=status.HTTP_403_FORBIDDEN)

        project_id = request.data.get("project_id")
        project = get_object_or_404(GraduationProject, id=project_id, supervisor=supervisor)

        topic_title_vi = request.data.get("topic_title_vi", "").strip()
        topic_title_en = request.data.get("topic_title_en", "").strip()
        update_fields = ["status"]

        if topic_title_vi:
            project.topic_title_vi = topic_title_vi
            update_fields.append("topic_title_vi")
        if topic_title_en:
            project.topic_title_en = topic_title_en
            update_fields.append("topic_title_en")

        project.status = "TOPIC_CONFIRMED"
        project.save(update_fields=update_fields)

        try:
            NotificationService.create_notification(
                user=project.student.user,
                notification_type="general",
                title="[Äá» tÃ i ÄATN] GVHD Ä‘Ã£ xÃ¡c nháº­n Ä‘á» tÃ i",
                message=f"GVHD {supervisor.user.get_full_name()} Ä‘Ã£ xÃ¡c nháº­n Ä‘á» tÃ i: '{project.topic_title_vi}'. Äang trÃ¬nh Khoa/Bá»™ mÃ´n phÃª duyá»‡t.",
                action_url="/student/dashboard",
                send_email=True,
            )
        except Exception as e:
            logger.warning("Could not send notification: %s", e)

        return Response({
            "message": "GV Ä‘Ã£ xÃ¡c nháº­n Ä‘á» tÃ i thÃ nh cÃ´ng! Äang trÃ¬nh Khoa/Ban duyá»‡t.",
            "project": GraduationProjectDetailSerializer(project).data
        }, status=status.HTTP_200_OK)


class TopicReSubmitAPIView(APIView):
    """
    TC-030: Sau khi bá»‹ Khoa 'Tá»« chá»‘i' hoáº·c 'YÃªu cáº§u sá»­a' (TOPIC_REVISION, TOPIC_DRAFT, REJECTED),
    GV/SV chá»‰nh sá»­a láº¡i ná»™i dung vÃ  Re-Submit -> Tráº¡ng thÃ¡i chuyá»ƒn láº¡i thÃ nh 'Pending Review' (PENDING_REVIEW).
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        project_id = request.data.get("project_id")
        topic_title_vi = request.data.get("topic_title_vi", "").strip()
        topic_title_en = request.data.get("topic_title_en", "").strip()
        description = request.data.get("description", "").strip() or request.data.get("topic_description", "").strip()

        # Find target project
        if getattr(user, "user_type", "") == "student":
            student = getattr(user, "student_profile", None)
            if not student:
                return Response({"detail": "Há»“ sÆ¡ sinh viÃªn khÃ´ng tá»“n táº¡i."}, status=status.HTTP_404_NOT_FOUND)
            project = GraduationProject.objects.filter(student=student).first()
            if not project and project_id:
                project = GraduationProject.objects.filter(id=project_id, student=student).first()
        elif getattr(user, "user_type", "") == "supervisor":
            supervisor = getattr(user, "supervisor_profile", None)
            if not supervisor:
                return Response({"detail": "Há»“ sÆ¡ giáº£ng viÃªn khÃ´ng tá»“n táº¡i."}, status=status.HTTP_404_NOT_FOUND)
            project = get_object_or_404(GraduationProject, id=project_id, supervisor=supervisor)
        else:
            project = get_object_or_404(GraduationProject, id=project_id)

        if not project:
            return Response({"detail": "KhÃ´ng tÃ¬m tháº¥y Ä‘á»“ Ã¡n tá»‘t nghiá»‡p cáº§n ná»™p láº¡i Ä‘á» tÃ i."}, status=status.HTTP_404_NOT_FOUND)

        if not topic_title_vi:
            topic_title_vi = project.topic_title_vi

        project.topic_title_vi = topic_title_vi
        if topic_title_en:
            project.topic_title_en = topic_title_en

        # Chuyá»ƒn tráº¡ng thÃ¡i láº¡i thÃ nh PENDING_REVIEW (Chá» duyá»‡t Ä‘á» tÃ i)
        project.status = "PENDING_REVIEW"
        project.topic_review_status = "GV_CONFIRMED"
        project.topic_revision_notes = ""
        project.save(update_fields=["topic_title_vi", "topic_title_en", "status", "topic_review_status", "topic_revision_notes"])

        # Äá»“ng bá»™ tráº¡ng thÃ¡i nhÃ³m náº¿u cÃ³
        try:
            from app.models import GroupMember
            membership = GroupMember.objects.filter(student=project.student).select_related("group").first()
            if membership and membership.group:
                group = membership.group
                group.tentative_topic = topic_title_vi
                if description:
                    group.tentative_description = description
                group.topic_status = "PENDING_REVIEW"
                group.save(update_fields=["tentative_topic", "tentative_description", "topic_status"])
        except Exception:
            pass

        # Gá»­i thÃ´ng bÃ¡o
        try:
            NotificationService.create_notification(
                user=project.supervisor.user,
                notification_type="general",
                title="[Äá» tÃ i ÄATN] Äá» tÃ i Ä‘Ã£ Ä‘Æ°á»£c Re-Submit",
                message=f"Äá» tÃ i '{project.topic_title_vi}' Ä‘Ã£ Ä‘Æ°á»£c cáº­p nháº­t vÃ  Re-Submit. Tráº¡ng thÃ¡i chuyá»ƒn láº¡i thÃ nh Chá» duyá»‡t Ä‘á» tÃ i (Pending Review).",
                action_url="/supervisor/dashboard",
                send_email=True,
            )
        except Exception:
            pass

        return Response({
            "message": "Ná»™p láº¡i Ä‘á» tÃ i (Re-Submit) thÃ nh cÃ´ng! Tráº¡ng thÃ¡i Ä‘Ã£ chuyá»ƒn thÃ nh 'Chá» duyá»‡t Ä‘á» tÃ i' (Pending Review).",
            "status": "PENDING_REVIEW",
            "project": GraduationProjectDetailSerializer(project).data
        }, status=status.HTTP_200_OK)


class AdminApproveTopicAPIView(APIView):
    """TrÃ¬nh duyá»‡t: Khoa/Ban duyá»‡t Ä‘á» tÃ i (Approved hoáº·c YÃªu cáº§u sá»­a quay vá» Draft)"""
    permission_classes = [IsAuthenticated]

    @retry_on_db_lock(max_retries=5, initial_delay=0.05, backoff_factor=1.5)
    def post(self, request):
        user = request.user
        if getattr(user, "user_type", "") == "student":
            return Response(
                {"detail": "Sinh viÃªn khÃ´ng cÃ³ quyá»n phÃª duyá»‡t Ä‘á» tÃ i (Chá»‰ dÃ nh cho Khoa/Ban quáº£n trá»‹).", "message": "Lá»—i 403 Forbidden (KhÃ´ng cÃ³ quyá»n)"},
                status=status.HTTP_403_FORBIDDEN
            )
        is_admin_or_staff = (
            user.is_staff
            or user.is_superuser
            or getattr(user, "user_type", "") in ["admin", "faculty_admin", "department_admin"]
        )
        if not is_admin_or_staff:
            return Response(
                {"detail": "Chá»‰ Ban chá»§ nhiá»‡m Khoa hoáº·c Quáº£n trá»‹ viÃªn má»›i cÃ³ quyá»n phÃª duyá»‡t Ä‘á» tÃ i.", "message": "Lá»—i 403 Forbidden (KhÃ´ng cÃ³ quyá»n)"},
                status=status.HTTP_403_FORBIDDEN
            )

        project_id = request.data.get("project_id")
        decision = str(request.data.get("decision", "APPROVED")).upper().strip()  # APPROVED, REJECTED, REVISION
        notes = str(request.data.get("notes", "")).strip()

        # FLOW_14: Khoa áº¥n tá»« chá»‘i hoáº·c yÃªu cáº§u sá»­a nhÆ°ng Ä‘á»ƒ trá»‘ng lÃ½ do -> Validate báº¯t buá»™c cÃ³ lÃ½ do
        if decision in ["REJECTED", "REVISION", "REVISION_REQUESTED"] and not notes:
            return Response(
                {
                    "detail": "Vui lÃ²ng nháº­p lÃ½ do tá»« chá»‘i hoáº·c yÃªu cáº§u chá»‰nh sá»­a Ä‘á» tÃ i. KhÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng lÃ½ do.",
                    "message": "KhÃ´ng thá»ƒ tá»« chá»‘i Ä‘á» tÃ i khi Ä‘á»ƒ trá»‘ng lÃ½ do.",
                    "error": "rejection_reason_required",
                    "notes": ["TrÆ°á»ng lÃ½ do tá»« chá»‘i khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng."]
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # TC_034: Database row-level lock vá»›i select_for_update ngÄƒn Race condition khi 2 Admin duyá»‡t cÃ¹ng lÃºc
        with transaction.atomic():
            project = GraduationProject.objects.select_for_update().get(id=project_id)

            if decision == "APPROVED":
                project.status = "TOPIC_APPROVED"
                project.topic_review_status = "APPROVED"
                project.topic_revision_notes = ""
                msg = "Khoa Ä‘Ã£ phÃª duyá»‡t Ä‘á» tÃ i chÃ­nh thá»©c!"
            else:
                project.status = "TOPIC_REVISION"
                project.topic_review_status = "REVISION_REQUIRED"
                project.topic_revision_notes = notes
                msg = f"Khoa yÃªu cáº§u chá»‰nh sá»­a Ä‘á» tÃ i: {notes}."

            project.save(update_fields=["status", "topic_review_status", "topic_revision_notes"])

        # FLOW_15: Gá»­i email/thÃ´ng bÃ¡o cÃ´ng bá»‘ Ä‘á» tÃ i qua Background Thread Asynchronous
        # Äáº£m báº£o dÃ¹ SMTP Server cÃ³ cháº­m hay lag thÃ¬ API váº«n pháº£n há»“i siÃªu tá»‘c (<50ms), khÃ´ng bá»‹ Timeout 504
        recipient_user_ids = []
        if hasattr(project, "student") and project.student and project.student.user_id:
            recipient_user_ids.append(project.student.user_id)
        if hasattr(project, "supervisor") and project.supervisor and project.supervisor.user_id:
            recipient_user_ids.append(project.supervisor.user_id)

        from .tasks import dispatch_async_notification
        dispatch_async_notification(
            recipient_user_ids=recipient_user_ids,
            title="[Káº¿t quáº£ duyá»‡t Ä‘á» tÃ i ÄATN]",
            message=msg,
            notification_type="general",
            action_url="/student/dashboard",
            send_email=True
        )

        return Response({
            "message": msg,
            "project": GraduationProjectDetailSerializer(project).data
        }, status=status.HTTP_200_OK)


class ExportOutlinePdfAPIView(APIView):
    """Há»‡ thá»‘ng sinh biá»ƒu máº«u Ä‘á» cÆ°Æ¡ng Ä‘á»“ Ã¡n tá»‘t nghiá»‡p ra file PDF chuáº©n UTC"""
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        project = get_object_or_404(
            GraduationProject.objects.select_related("student__user", "supervisor__user", "topic_category", "batch"),
            id=pk
        )

        import io
        import os
        import unicodedata
        from reportlab.lib.pagesizes import A4
        from reportlab.pdfgen import canvas
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont

        # Try to register a TrueType font supporting UTF-8 Vietnamese
        font_name = "Helvetica"
        possible_fonts = [
            "C:\\Windows\\Fonts\\arial.ttf",
            "C:\\Windows\\Fonts\\times.ttf",
            "C:\\Windows\\Fonts\\tahoma.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
            "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
        ]
        has_unicode_font = False
        for fpath in possible_fonts:
            if os.path.exists(fpath):
                try:
                    pdfmetrics.registerFont(TTFont("CustomFont", fpath))
                    font_name = "CustomFont"
                    has_unicode_font = True
                    break
                except Exception:
                    pass

        def clean_txt(text: str) -> str:
            if not text:
                return ""
            if has_unicode_font:
                return str(text)
            # Normalize to ASCII fallback if only Type 1 Helvetica font is available
            normalized = unicodedata.normalize('NFKD', str(text)).encode('ASCII', 'ignore').decode('ASCII')
            return normalized or str(text)

        buffer = io.BytesIO()
        p = canvas.Canvas(buffer, pagesize=A4)
        width, height = A4

        # 1. Header: Bá»™ GD&ÄT & Quá»‘c hiá»‡u tiÃªu ngá»¯ chuáº©n biá»ƒu máº«u UTC
        p.setFont(font_name, 11)
        p.drawString(50, height - 50, clean_txt("Bá»˜ GIÃO Dá»¤C VÃ€ ÄÃ€O Táº O"))
        p.drawString(50, height - 66, clean_txt("TRÆ¯á»œNG Äáº I Há»ŒC GIAO THÃ”NG Váº¬N Táº¢I"))
        p.drawString(50, height - 82, clean_txt("KHOA CÃ”NG NGHá»† THÃ”NG TIN"))

        p.drawString(width - 250, height - 50, clean_txt("Cá»˜NG HÃ’A XÃƒ Há»˜I CHá»¦ NGHÄ¨A VIá»†T NAM"))
        p.drawString(width - 210, height - 66, clean_txt("Äá»™c láº­p - Tá»± do - Háº¡nh phÃºc"))
        p.setLineWidth(0.5)
        p.line(width - 200, height - 74, width - 100, height - 74)

        # 2. TiÃªu Ä‘á» Äá» cÆ°Æ¡ng chuáº©n
        p.setFont(font_name, 15)
        p.drawCentredString(width / 2, height - 120, clean_txt("Äá»€ CÆ¯Æ NG CHI TIáº¾T Äá»’ ÃN Tá»T NGHIá»†P"))

        # 3. ThÃ´ng tin sinh viÃªn & Ä‘á» tÃ i
        p.setFont(font_name, 10)
        y = height - 155

        p.drawString(50, y, clean_txt(f"1. TÃªn Ä‘á» tÃ i (Tiáº¿ng Viá»‡t): {project.topic_title_vi}"))
        y -= 20
        p.drawString(50, y, clean_txt(f"   TÃªn Ä‘á» tÃ i (Tiáº¿ng Anh): {project.topic_title_en or 'N/A'}"))
        y -= 20
        st_name = project.student.user.get_full_name() if project.student and project.student.user else "N/A"
        st_reg = project.student.registration_no if project.student else "N/A"
        st_prog = project.student.get_degree_program_display() if project.student else "Cá»­ nhÃ¢n"
        st_dept = project.student.department or "CÃ´ng nghá»‡ thÃ´ng tin" if project.student else "CNTT"
        p.drawString(50, y, clean_txt(f"2. Sinh viÃªn thá»±c hiá»‡n: {st_name} - MSSV: {st_reg}"))
        y -= 20
        p.drawString(50, y, clean_txt(f"   ChÆ°Æ¡ng trÃ¬nh Ä‘Ã o táº¡o: {st_prog} - NgÃ nh/Lá»›p: {st_dept}"))
        y -= 20

        sup_name = project.supervisor.user.get_full_name() if project.supervisor and project.supervisor.user else "N/A"
        sup_title = project.supervisor.academic_title or "GV" if project.supervisor else "GV"
        p.drawString(50, y, clean_txt(f"3. Giáº£ng viÃªn hÆ°á»›ng dáº«n: {sup_title}. {sup_name}"))
        y -= 20
        cat_name = project.topic_category.name if project.topic_category else "CÃ´ng nghá»‡ pháº§n má»m & TrÃ­ tuá»‡ nhÃ¢n táº¡o"
        batch_info = f"{project.batch.batch_name} ({project.batch.batch_code})" if project.batch else "Há»c ká»³ tá»‘t nghiá»‡p"
        p.drawString(50, y, clean_txt(f"4. HÆ°á»›ng nghiÃªn cá»©u: {cat_name}"))
        y -= 20
        p.drawString(50, y, clean_txt(f"5. Äá»£t thá»±c hiá»‡n: {batch_info}"))
        y -= 28

        # 4. Má»¥c tiÃªu vÃ  ná»™i dung nghiÃªn cá»©u chÃ­nh
        p.drawString(50, y, clean_txt("6. Má»¥c tiÃªu nghiÃªn cá»©u:"))
        y -= 16
        p.drawString(65, y, clean_txt("- Kháº£o sÃ¡t hiá»‡n tráº¡ng, phÃ¢n tÃ­ch nghiá»‡p vá»¥ vÃ  thu tháº­p yÃªu cáº§u há»‡ thá»‘ng."))
        y -= 16
        p.drawString(65, y, clean_txt("- NghiÃªn cá»©u cÃ¡c giáº£i phÃ¡p cÃ´ng nghá»‡, thuáº­t toÃ¡n vÃ  mÃ´ hÃ¬nh kiáº¿n trÃºc phÃ¹ há»£p."))
        y -= 16
        p.drawString(65, y, clean_txt("- Thiáº¿t káº¿ kiáº¿n trÃºc giáº£i phÃ¡p, cÆ¡ sá»Ÿ dá»¯ liá»‡u vÃ  cÃ¡c giao diá»‡n ngÆ°á»i dÃ¹ng."))
        y -= 24

        p.drawString(50, y, clean_txt("7. Káº¿ hoáº¡ch vÃ  ná»™i dung triá»ƒn khai:"))
        y -= 16
        p.drawString(65, y, clean_txt("- Giai Ä‘oáº¡n 1 (Tuáº§n 1-4): HoÃ n thÃ nh Ä‘á» cÆ°Æ¡ng, kháº£o sÃ¡t thá»±c táº¿ vÃ  phÃ¢n tÃ­ch yÃªu cáº§u."))
        y -= 16
        p.drawString(65, y, clean_txt("- Giai Ä‘oáº¡n 2 (Tuáº§n 5-10): Thiáº¿t káº¿ há»‡ thá»‘ng, xÃ¢y dá»±ng CSDL vÃ  láº­p trÃ¬nh cÃ¡c module."))
        y -= 16
        p.drawString(65, y, clean_txt("- Giai Ä‘oáº¡n 3 (Tuáº§n 11-14): Kiá»ƒm thá»­ pháº§n má»m, Ä‘Ã¡nh giÃ¡ hiá»‡u nÄƒng vÃ  viáº¿t thuyáº¿t minh."))
        y -= 16
        p.drawString(65, y, clean_txt("- Giai Ä‘oáº¡n 4 (Tuáº§n 15): BÃ¡o cÃ¡o nghiá»‡m thu trÆ°á»›c Há»™i Ä‘á»“ng cháº¥m Äá»“ Ã¡n tá»‘t nghiá»‡p."))
        y -= 24

        p.drawString(50, y, clean_txt("8. Dá»± kiáº¿n sáº£n pháº©m bÃ n giao:"))
        y -= 16
        p.drawString(65, y, clean_txt("- Quyá»ƒn bÃ¡o cÃ¡o thuyáº¿t minh Äá»“ Ã¡n tá»‘t nghiá»‡p hoÃ n chá»‰nh vÃ  slide trÃ¬nh chiáº¿u."))
        y -= 16
        p.drawString(65, y, clean_txt("- MÃ£ nguá»“n chÆ°Æ¡ng trÃ¬nh (Source code) vÃ  pháº§n má»m demo triá»ƒn khai thá»±c táº¿."))
        y -= 45

        # 5. Khá»‘i chá»¯ kÃ½ xÃ¡c nháº­n chuáº©n
        p.drawString(80, y, clean_txt("GIáº¢NG VIÃŠN HÆ¯á»šNG DáºªN"))
        p.drawString(80, y - 14, clean_txt("(KÃ½ vÃ  ghi rÃµ há» tÃªn)"))
        p.drawString(width - 220, y, clean_txt("SINH VIÃŠN THá»°C HIá»†N"))
        p.drawString(width - 220, y - 14, clean_txt("(KÃ½ vÃ  ghi rÃµ há» tÃªn)"))

        p.showPage()
        p.save()

        buffer.seek(0)
        filename = f"De_cuong_{st_reg}.pdf"
        response = HttpResponse(buffer.getvalue(), content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        response["Content-Length"] = len(buffer.getvalue())
        return response


class UploadSignedOutlineAPIView(APIView):
    """SV kÃ½ ná»™p báº£n Ä‘á» cÆ°Æ¡ng Ä‘Ã£ kÃ½, Khoa lÆ°u há»“ sÆ¡ (Giá»›i háº¡n tá»‘i Ä‘a 5MB, cháº·n .exe vÃ  parse MIME type)"""
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, pk):
        user = request.user
        student = getattr(user, "student_profile", None)
        project = get_object_or_404(GraduationProject, id=pk)

        signed_file = request.FILES.get("signed_outline_file")
        if not signed_file:
            return Response({"detail": "Vui lÃ²ng chá»n file scan Ä‘á» cÆ°Æ¡ng Ä‘Ã£ kÃ½."}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Kiá»ƒm tra kÃ­ch thÆ°á»›c tá»‡p tá»‘i Ä‘a 5MB (5 * 1024 * 1024)
        MAX_SIZE = 5 * 1024 * 1024
        if signed_file.size > MAX_SIZE:
            return Response(
                {"signed_outline_file": ["KÃ­ch thÆ°á»›c tá»‡p vÆ°á»£t quÃ¡ giá»›i háº¡n 5MB. Vui lÃ²ng táº£i lÃªn file nhá» hÆ¡n hoáº·c báº±ng 5MB."]},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 2. Kiá»ƒm tra pháº§n má»Ÿ rá»™ng tá»‡p (chá»‰ cho phÃ©p .pdf)
        import os
        ext = os.path.splitext(signed_file.name)[1].lower()
        if ext != ".pdf":
            return Response(
                {"signed_outline_file": [f"Äá»‹nh dáº¡ng tá»‡p '{ext}' khÃ´ng há»£p lá»‡. Chá»‰ cháº¥p nháº­n tá»‡p Ä‘á»‹nh dáº¡ng PDF (.pdf). Tuyá»‡t Ä‘á»‘i khÃ´ng cho phÃ©p tá»‡p thá»±c thi (.exe)."]},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 3. PhÃ¢n tÃ­ch vÃ  kiá»ƒm tra MIME type tá»« request header / file metadata
        content_type = getattr(signed_file, "content_type", "").lower()
        blocked_mimes = [
            "application/x-msdownload", "application/x-dosexec", "application/x-executable",
            "application/x-msdos-program", "application/x-bat", "application/x-sh",
            "application/x-sharedlib", "application/octet-stream"
        ]
        if any(bad_mime in content_type for bad_mime in ["x-msdownload", "dosexec", "x-executable"]):
            return Response(
                {"signed_outline_file": ["PhÃ¡t hiá»‡n tá»‡p thá»±c thi nguy hiá»ƒm (.exe). Há»‡ thá»‘ng tá»« chá»‘i lÆ°u trá»¯."]},
                status=status.HTTP_400_BAD_REQUEST
            )
        if content_type and "pdf" not in content_type and content_type not in ["application/pdf", "application/x-pdf"]:
            return Response(
                {"signed_outline_file": [f"MIME type '{content_type}' khÃ´ng khá»›p vá»›i Ä‘á»‹nh dáº¡ng PDF há»£p lá»‡."]},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 4. Kiá»ƒm tra Header Magic Bytes trong ruá»™t tá»‡p
        try:
            signed_file.seek(0)
            header = signed_file.read(512)
            signed_file.seek(0)
            # Cháº·n triá»‡t Ä‘á»ƒ tá»‡p nhá»‹ phÃ¢n PE / Windows executable (.exe header MZ)
            if header.startswith(b"MZ"):
                return Response(
                    {"signed_outline_file": ["PhÃ¡t hiá»‡n tá»‡p thá»±c thi Windows (.exe/MZ). Há»‡ thá»‘ng tá»« chá»‘i lÆ°u trá»¯ vÃ¬ lÃ½ do báº£o máº­t."]},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if not header.startswith(b"%PDF"):
                return Response(
                    {"signed_outline_file": ["Tá»‡p khÃ´ng Ä‘Ãºng Ä‘á»‹nh dáº¡ng PDF há»£p lá»‡ (Magic bytes khÃ´ng báº¯t Ä‘áº§u báº±ng %PDF)."]},
                    status=status.HTTP_400_BAD_REQUEST
                )
        except Exception:
            return Response({"signed_outline_file": ["KhÃ´ng thá»ƒ Ä‘á»c ná»™i dung tá»‡p tin."]}, status=status.HTTP_400_BAD_REQUEST)

        # 5. Cháº¡y validator chuáº©n há»‡ thá»‘ng
        try:
            validate_uploaded_file(signed_file, allowed_extensions=[".pdf"], max_size_bytes=MAX_SIZE)
        except Exception as e:
            err_msg = getattr(e, "detail", str(e))
            return Response({"signed_outline_file": [str(err_msg)]}, status=status.HTTP_400_BAD_REQUEST)

        project.signed_outline_file = signed_file
        project.outline_pdf_path = signed_file.name if hasattr(signed_file, "name") else str(signed_file)
        project.save(update_fields=["outline_pdf_path"])

        file_url = getattr(project.signed_outline_file, "url", None)
        if not file_url and project.signed_outline_file:
            file_url = f"/media/outlines/{project.id}_signed.pdf"
        return Response({
            "message": "Ná»™p báº£n Ä‘á» cÆ°Æ¡ng cÃ³ chá»¯ kÃ½ thÃ nh cÃ´ng! Há»“ sÆ¡ Ä‘Ã£ Ä‘Æ°á»£c lÆ°u trá»¯.",
            "signed_outline_file_url": file_url,
            "project": GraduationProjectDetailSerializer(project).data
        }, status=status.HTTP_200_OK)


# ==============================================================================
# PHASE 4: THESIS ELIGIBILITY CHECK & FORCE APPROVE APIS
# ==============================================================================

class CheckThesisEligibilityAPIView(APIView):
    """Giai Ä‘oáº¡n 4: XÃ©t Ä‘iá»u kiá»‡n lÃ m Ä‘á»“ Ã¡n (CPA >= 2.0, ná»£ tÃ­n chá»‰, mÃ´n há»c/tá»± chá»n)"""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        project = get_object_or_404(GraduationProject, id=pk)
        
        # Há»— trá»£ nháº­n thÃ´ng tin ná»£ tÃ­n chá»‰ vÃ  dá»¯ liá»‡u mÃ´n há»c tá»« request body
        debt_credits = request.data.get("debt_credits")
        if debt_credits is None:
            debt_credits = request.data.get("credits_debt") or request.data.get("no_tin_chi")
        if debt_credits is not None:
            try:
                debt_credits = int(debt_credits)
            except (ValueError, TypeError):
                debt_credits = None

        courses_data = request.data.get("courses") or request.data.get("mon_hoc") or request.data.get("transcript") or request.data.get("electives")

        ok, msg = AcademicClearanceService.check_thesis_start_eligibility(
            project, debt_credits=debt_credits, courses_data=courses_data
        )
        return Response({
            "success": True,
            "is_eligible": ok,
            "message": msg,
            "status": project.status,
            "project": GraduationProjectDetailSerializer(project).data
        }, status=status.HTTP_200_OK)


class ForceApproveThesisAPIView(APIView):
    """Giai Ä‘oáº¡n 4: NÃºt quyáº¿t Ä‘á»‹nh Force Approve cá»§a Khoa (váº«n cho lÃ m ÄA dÃ¹ chÆ°a Ä‘á»§ tiÃªu chÃ­)"""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        project = get_object_or_404(GraduationProject, id=pk)
        force = request.data.get("force", True)
        if isinstance(force, str):
            force = force.lower() in ["true", "1"]
        reason = request.data.get("reason") or request.data.get("notes") or "Äáº·c cÃ¡ch: Khoa phÃª duyá»‡t Ä‘áº·c cÃ¡ch theo Ä‘Æ¡n giáº£i trÃ¬nh"
        if force:
            project.is_force_approved = True
            project.status = "IN_PROGRESS"
            project.ineligibility_reason = reason
            msg = f"Khoa Ä‘Ã£ duyá»‡t Ä‘áº·c cÃ¡ch (Force Approve) cho SV {project.student.registration_no} tiáº¿p tá»¥c lÃ m Ä‘á»“ Ã¡n!"
        else:
            project.is_force_approved = False
            project.status = "DISQUALIFIED"
            msg = f"KhÃ´ng duyá»‡t Ä‘áº·c cÃ¡ch. SV {project.student.registration_no} bá»‹ loáº¡i khá»i Ä‘á»£t Ä‘á»“ Ã¡n."

        project.save(update_fields=["initial_eligibility", "ineligibility_reason", "status"])

        return Response({
            "success": True,
            "message": msg,
            "project": GraduationProjectDetailSerializer(project).data
        }, status=status.HTTP_200_OK)


# ==============================================================================
# PHASE 5: TASK DELIVERABLES & SUPERVISOR REVIEW APIS
# ==============================================================================

class StudentTaskDeliverableSubmitAPIView(APIView):
    """SV submit káº¿t quáº£ task (file bÃ¡o cÃ¡o, link demo/commit, ghi chÃº)"""
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request, pk):
        user = request.user
        student = getattr(user, "student_profile", None)
        if not student:
            return Response({"detail": "Chá»‰ dÃ nh cho sinh viÃªn."}, status=status.HTTP_403_FORBIDDEN)

        task = get_object_or_404(SupervisionTask, id=pk, project__student=student)
        deliverable_file = request.FILES.get("deliverable_file")
        deliverable_url = request.data.get("deliverable_url", "").strip()
        student_notes = request.data.get("student_notes", "").strip()

        if deliverable_file:
            import os
            ext = os.path.splitext(deliverable_file.name)[1].lower() if deliverable_file.name else ""

            # 1. Cháº·n Ä‘uÃ´i file thá»±c thi nguy hiá»ƒm
            BLOCKED_EXTS = [".exe", ".bat", ".cmd", ".sh", ".bin", ".msi", ".dll", ".com", ".vbs", ".ps1", ".scr", ".jar"]
            if ext in BLOCKED_EXTS:
                return Response({
                    "detail": f"PhÃ¡t hiá»‡n tá»‡p thá»±c thi nguy hiá»ƒm ({ext}). Há»‡ thá»‘ng tá»« chá»‘i lÆ°u trá»¯ vÃ¬ lÃ½ do an toÃ n báº£o máº­t.",
                    "deliverable_file": [f"Äá»‹nh dáº¡ng tá»‡p '{ext}' khÃ´ng Ä‘Æ°á»£c há»— trá»£. Tuyá»‡t Ä‘á»‘i khÃ´ng cho phÃ©p tá»‡p thá»±c thi nguy hiá»ƒm (.exe)."],
                    "error": "executable_file_forbidden"
                }, status=status.HTTP_400_BAD_REQUEST)

            # 2. PhÃ¢n tÃ­ch MIME Type tá»« request header/file metadata
            content_type = getattr(deliverable_file, "content_type", "").lower()
            if any(bad_mime in content_type for bad_mime in ["x-msdownload", "dosexec", "x-executable", "x-msdos-program"]):
                return Response({
                    "detail": "PhÃ¡t hiá»‡n MIME type tá»‡p thá»±c thi nguy hiá»ƒm (.exe). Há»‡ thá»‘ng tá»« chá»‘i lÆ°u trá»¯.",
                    "deliverable_file": ["PhÃ¡t hiá»‡n tá»‡p thá»±c thi Ä‘á»™c háº¡i (.exe). Há»‡ thá»‘ng tá»« chá»‘i lÆ°u trá»¯ vÃ¬ lÃ½ do an toÃ n báº£o máº­t."],
                    "error": "executable_mime_forbidden"
                }, status=status.HTTP_400_BAD_REQUEST)

            # 3. FLOW_23: Kiá»ƒm tra trá»±c tiáº¿p ruá»™t tá»‡p Magic Bytes Ä‘á»ƒ cháº·n file .exe Ä‘á»•i tÃªn giáº£ máº¡o thÃ nh .zip/.pdf
            try:
                if hasattr(deliverable_file, "seek"):
                    deliverable_file.seek(0)
                header = deliverable_file.read(512) if hasattr(deliverable_file, "read") else b""
                if hasattr(deliverable_file, "seek"):
                    deliverable_file.seek(0)

                # Cháº·n mÃ£ nhá»‹ phÃ¢n thá»±c thi PE Windows (MZ header)
                if header.startswith(b"MZ"):
                    return Response({
                        "detail": "PhÃ¡t hiá»‡n tá»‡p thá»±c thi Windows (.exe/MZ) giáº£ máº¡o. Há»‡ thá»‘ng tá»« chá»‘i lÆ°u trá»¯ vÃ¬ lÃ½ do an toÃ n báº£o máº­t.",
                        "deliverable_file": ["PhÃ¡t hiá»‡n tá»‡p thá»±c thi Ä‘á»™c háº¡i (.exe) giáº£ máº¡o dÆ°á»›i dáº¡ng tá»‡p khÃ¡c. Há»‡ thá»‘ng tá»« chá»‘i lÆ°u trá»¯."],
                        "error": "malicious_executable_detected"
                    }, status=status.HTTP_400_BAD_REQUEST)

                # Cháº·n mÃ£ nhá»‹ phÃ¢n thá»±c thi ELF Linux / Unix
                if header.startswith(b"\x7fELF"):
                    return Response({
                        "detail": "PhÃ¡t hiá»‡n tá»‡p thá»±c thi ELF giáº£ máº¡o. Há»‡ thá»‘ng tá»« chá»‘i lÆ°u trá»¯.",
                        "deliverable_file": ["PhÃ¡t hiá»‡n tá»‡p thá»±c thi ELF Ä‘á»™c háº¡i. Há»‡ thá»‘ng tá»« chá»‘i lÆ°u trá»¯."],
                        "error": "malicious_executable_detected"
                    }, status=status.HTTP_400_BAD_REQUEST)

                # Kiá»ƒm tra tÃ­nh toÃ n váº¹n Ä‘á»‹nh dáº¡ng theo Magic Bytes tÆ°Æ¡ng á»©ng Ä‘uÃ´i má»Ÿ rá»™ng
                if ext == ".pdf" and not header.startswith(b"%PDF"):
                    return Response({
                        "detail": "Tá»‡p khÃ´ng Ä‘Ãºng Ä‘á»‹nh dáº¡ng PDF há»£p lá»‡ (Magic bytes khÃ´ng báº¯t Ä‘áº§u báº±ng %PDF).",
                        "deliverable_file": ["Tá»‡p PDF khÃ´ng Ä‘Ãºng Ä‘á»‹nh dáº¡ng (Magic bytes khÃ´ng há»£p lá»‡)."],
                        "error": "invalid_magic_bytes"
                    }, status=status.HTTP_400_BAD_REQUEST)

                if ext in [".zip", ".docx", ".xlsx", ".pptx"] and not header.startswith(b"PK"):
                    return Response({
                        "detail": f"Tá»‡p '{ext}' khÃ´ng Ä‘Ãºng Ä‘á»‹nh dáº¡ng lÆ°u trá»¯ há»£p lá»‡ (Magic bytes khÃ´ng báº¯t Ä‘áº§u báº±ng PK).",
                        "deliverable_file": [f"Tá»‡p '{ext}' khÃ´ng Ä‘Ãºng Ä‘á»‹nh dáº¡ng (Magic bytes khÃ´ng há»£p lá»‡)."],
                        "error": "invalid_magic_bytes"
                    }, status=status.HTTP_400_BAD_REQUEST)

                if ext == ".rar" and not (header.startswith(b"Rar!\x1a\x07\x00") or header.startswith(b"Rar!\x1a\x07\x01") or header.startswith(b"Rar!")):
                    return Response({
                        "detail": "Tá»‡p khÃ´ng Ä‘Ãºng Ä‘á»‹nh dáº¡ng RAR há»£p lá»‡ (Magic bytes khÃ´ng há»£p lá»‡).",
                        "deliverable_file": ["Tá»‡p RAR khÃ´ng Ä‘Ãºng Ä‘á»‹nh dáº¡ng (Magic bytes khÃ´ng há»£p lá»‡)."],
                        "error": "invalid_magic_bytes"
                    }, status=status.HTTP_400_BAD_REQUEST)

                # 4. Kiá»ƒm tra qua validator chung cá»§a há»‡ thá»‘ng
                validate_uploaded_file(
                    deliverable_file,
                    allowed_extensions=[".pdf", ".zip", ".rar", ".docx", ".xlsx", ".pptx"],
                    max_size_bytes=25 * 1024 * 1024
                )
                task.deliverable_file = deliverable_file
            except Exception as e:
                err_msg = getattr(e, "detail", str(e))
                return Response({"deliverable_file": [str(err_msg)]}, status=status.HTTP_400_BAD_REQUEST)

        if deliverable_url:
            task.deliverable_url = deliverable_url
        if student_notes:
            task.student_notes = student_notes

        task.status = "IN_PROGRESS"
        task.review_verdict = "PENDING"
        now = timezone.now()
        task.submitted_at = now

        # Validate deadline (TC-031)
        is_late = False
        if task.due_date and now.date() > task.due_date:
            is_late = True

        strict_mode = request.data.get("strict") or request.data.get("block_late")
        if isinstance(strict_mode, str):
            strict_mode = strict_mode.lower() in ["true", "1"]

        if strict_mode and is_late:
            return Response({
                "detail": f"ÄÃ£ quÃ¡ háº¡n ná»™p bÃ i (Deadline: {task.due_date}). Há»‡ thá»‘ng cháº·n ná»™p do quÃ¡ thá»i háº¡n quy Ä‘á»‹nh.",
                "error": "deadline_exceeded",
                "is_late": True,
                "due_date": str(task.due_date)
            }, status=status.HTTP_400_BAD_REQUEST)

        task.is_late = is_late
        task.save()

        # ThÃ´ng bÃ¡o tá»›i GVHD
        try:
            NotificationService.create_notification(
                user=task.project.supervisor.user,
                notification_type="general",
                title="[Ná»™p káº¿t quáº£ nhiá»‡m vá»¥]" + (" (Ná»™p muá»™n - Late Submit)" if is_late else ""),
                message=f"SV {student.user.get_full_name()} Ä‘Ã£ ná»™p káº¿t quáº£ cho nhiá»‡m vá»¥: '{task.title}'" + (" [Ghi nháº­n ná»™p muá»™n]." if is_late else "."),
                action_url="/supervisor/dashboard",
                send_email=True,
            )
        except Exception as e:
            logger.warning("Could not send notification: %s", e)

        msg = "Ná»™p bÃ i thÃ nh cÃ´ng (Há»‡ thá»‘ng gáº¯n flag 'Late Submit' do quÃ¡ deadline)!" if is_late else "Ná»™p káº¿t quáº£ nhiá»‡m vá»¥ thÃ nh cÃ´ng! Äang chá» GVHD Ä‘Ã¡nh giÃ¡."
        return Response({
            "message": msg,
            "is_late": is_late,
            "submission_status": "LATE_SUBMIT" if is_late else "ON_TIME",
            "task": SupervisionTaskSerializer(task).data
        }, status=status.HTTP_200_OK)


class SupervisorReviewTaskAPIView(APIView):
    """GV review káº¿t quáº£ task: NÃºt quyáº¿t Ä‘á»‹nh Äáº¡t? (ACCEPTED: Äáº¡t / REVISION_REQUIRED: YÃªu cáº§u sá»­a)"""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        user = request.user
        supervisor = getattr(user, "supervisor_profile", None)
        if not supervisor:
            return Response({"detail": "Chá»‰ dÃ nh cho Giáº£ng viÃªn hÆ°á»›ng dáº«n."}, status=status.HTTP_403_FORBIDDEN)

        task = get_object_or_404(SupervisionTask, id=pk, project__supervisor=supervisor)
        verdict = request.data.get("verdict", "ACCEPTED").upper()  # ACCEPTED or REVISION_REQUIRED
        notes = request.data.get("notes", "").strip()

        if verdict == "ACCEPTED":
            task.review_verdict = "ACCEPTED"
            task.status = "COMPLETED"
            task.is_completed = True
            task.completed_at = timezone.now()
            msg = f"GVHD Ä‘Ã£ Ä‘Ã¡nh giÃ¡ Äáº T cho nhiá»‡m vá»¥ '{task.title}'!"
        else:
            task.review_verdict = "REVISION_REQUIRED"
            task.status = "IN_PROGRESS"
            task.is_completed = False
            task.completed_at = None
            msg = f"GVHD yÃªu cáº§u lÃ m láº¡i nhiá»‡m vá»¥ '{task.title}': {notes or 'Cáº§n hoÃ n thiá»‡n thÃªm'}."

        task.supervisor_review_notes = notes
        task.reviewed_at = timezone.now()
        task.save()

        # ThÃ´ng bÃ¡o tá»›i SV
        try:
            NotificationService.create_notification(
                user=task.project.student.user,
                notification_type="general",
                title="[ÄÃ¡nh giÃ¡ nhiá»‡m vá»¥ tá»« GVHD]",
                message=msg,
                action_url="/student/dashboard",
                send_email=True,
            )
        except Exception as e:
            logger.warning("Could not send notification: %s", e)

        return Response({
            "message": msg,
            "task": SupervisionTaskSerializer(task).data
        }, status=status.HTTP_200_OK)


# ==============================================================================
# PHASE 6: EXPORT MINUTES PDF & BATCH FINAL GRADES EXCEL APIS
# ==============================================================================

class CouncilMinutesPdfExportAPIView(APIView):
    """BiÃªn báº£n: Xuáº¥t biÃªn báº£n há»p báº£o vá»‡ PDF theo chuáº©n UTC (1CT-2TK-2UV)"""
    permission_classes = [IsAuthenticated]

    def get(self, request, council_id):
        user = request.user
        if getattr(user, "user_type", "") == "student" or (not user.is_staff and not user.is_superuser and getattr(user, "user_type", "") not in ["admin", "supervisor", "committee_member"]):
            return Response(
                {
                    "detail": "Sinh viÃªn khÃ´ng cÃ³ quyá»n truy cáº­p hoáº·c táº£i vá» BiÃªn báº£n há»p Há»™i Ä‘á»“ng báº£o vá»‡.",
                    "message": "Sinh viÃªn khÃ´ng cÃ³ quyá»n truy cáº­p hoáº·c táº£i vá» BiÃªn báº£n há»p Há»™i Ä‘á»“ng báº£o vá»‡.",
                    "error": "FORBIDDEN"
                },
                status=status.HTTP_403_FORBIDDEN
            )

        council = get_object_or_404(
            DefenseCouncil.objects.select_related("batch"),
            id=council_id
        )

        # FLOW_33: Báº¯t buá»™c 100% thÃ nh viÃªn Há»™i Ä‘á»“ng nháº­p Ä‘iá»ƒm Ä‘áº§y Ä‘á»§ cho toÃ n bá»™ SV má»›i cho phÃ©p xuáº¥t BiÃªn báº£n PDF
        council_members_count = council.members.count()
        required_scorers = council_members_count if council_members_count >= 5 else (council_members_count or 5)
        projects_in_council = list(council.projects.select_related("student__user").all())

        if projects_in_council and required_scorers > 0:
            incomplete_students = []
            for proj in projects_in_council:
                submitted_count = CouncilLiveScore.objects.filter(project=proj, council=council).count()
                if submitted_count < required_scorers:
                    st_name = proj.student.user.get_full_name() if (proj.student and proj.student.user) else proj.student.registration_no
                    incomplete_students.append(f"SV {st_name} ({proj.student.registration_no}): {submitted_count}/{required_scorers} ngÆ°á»i")

            if incomplete_students:
                return Response(
                    {
                        "detail": f"KhÃ´ng thá»ƒ xuáº¥t biÃªn báº£n: Há»™i Ä‘á»“ng chÆ°a hoÃ n thÃ nh cháº¥m Ä‘iá»ƒm (Báº¯t buá»™c Ä‘á»§ 100% thÃ nh viÃªn cháº¥m Ä‘iá»ƒm má»›i Ä‘Æ°á»£c xuáº¥t biÃªn báº£n). ChÆ°a Ä‘á»§ Ä‘iá»ƒm: {'; '.join(incomplete_students)}.",
                        "message": "Há»™i Ä‘á»“ng má»›i cÃ³ thÃ nh viÃªn nháº­p Ä‘iá»ƒm dá»Ÿ dang, chÆ°a hoÃ n táº¥t 100%.",
                        "error": "incomplete_council_scores",
                        "incomplete_students": incomplete_students
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

        import io
        import os
        from reportlab.lib.pagesizes import A4
        from reportlab.pdfgen import canvas
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont

        font_name = "Helvetica"
        if os.path.exists("C:\\Windows\\Fonts\\arial.ttf"):
            try:
                pdfmetrics.registerFont(TTFont("Arial", "C:\\Windows\\Fonts\\arial.ttf"))
                font_name = "Arial"
            except Exception:
                pass

        buffer = io.BytesIO()
        p = canvas.Canvas(buffer, pagesize=A4)
        width, height = A4

        # Header
        p.setFont(font_name, 11)
        p.drawString(50, height - 50, "Bá»˜ GIÃO Dá»¤C VÃ€ ÄÃ€O Táº O")
        p.drawString(50, height - 68, "TRÆ¯á»œNG ÄH GIAO THÃ”NG Váº¬N Táº¢I")
        p.drawString(width - 240, height - 50, "Cá»˜NG HÃ’A XÃƒ Há»˜I CHá»¦ NGHÄ¨A VIá»†T NAM")
        p.drawString(width - 200, height - 68, "Äá»™c láº­p - Tá»± do - Háº¡nh phÃºc")

        p.setFont(font_name, 15)
        p.drawCentredString(width / 2, height - 110, f"BIÃŠN Báº¢N Há»ŒP Há»˜I Äá»’NG Báº¢O Vá»† Äá»’ ÃN Tá»T NGHIá»†P #{council.council_number}")

        p.setFont(font_name, 10)
        y = height - 140
        session_time_disp = council.get_session_time_display()
        p.drawString(50, y, f"Há»™i Ä‘á»“ng: {council.council_name} | PhÃ²ng: {council.defense_room or 'TBA'} | NgÃ y: {council.session_date or 'TBA'} ({session_time_disp})")
        y -= 25

        p.drawString(50, y, "I. THÃ€NH VIÃŠN Há»˜I Äá»’NG (CÆ¡ cáº¥u chuáº©n 1CT - 2TK - 2UV):")
        y -= 18
        members = list(council.members.select_related("user").all())
        for idx, m in enumerate(members, 1):
            p.drawString(70, y, f"{idx}. {m.get_role_display()}: {m.user.get_full_name()} ({m.user.email})")
            y -= 16

        y -= 15
        p.drawString(50, y, "II. Káº¾T QUáº¢ ÄÃNH GIÃ Cá»¦A CÃC SINH VIÃŠN:")
        y -= 20

        # Projects and grades
        projects = council.projects.select_related("student__user", "final_grade_summary").all()
        p.drawString(50, y, "STT | MSSV | Há» vÃ  tÃªn | Äiá»ƒm GVHD | Äiá»ƒm GVPB | Äiá»ƒm TB HÄ | Tá»•ng káº¿t (Há»‡ 10 / Chá»¯)")
        y -= 15

        for idx, proj in enumerate(projects, 1):
            summary = getattr(proj, "final_grade_summary", None)
            sup_s = f"{proj.supervisor_score:.1f}" if proj.supervisor_score is not None else "--"
            rev_s = f"{proj.reviewer_score:.1f}" if proj.reviewer_score is not None else "--"
            cou_s = f"{summary.council_avg_score:.2f}" if summary and summary.council_avg_score is not None else "--"
            fin_s = f"{summary.final_score_10:.2f} ({summary.final_letter_grade})" if summary and summary.final_score_10 is not None else "--"
            s_name = proj.student.user.get_full_name()
            p.drawString(50, y, f"{idx}. {proj.student.registration_no} - {s_name} | {sup_s}Ä‘ | {rev_s}Ä‘ | {cou_s}Ä‘ | {fin_s}")
            y -= 16
            if y < 100:
                p.showPage()
                y = height - 50

        y -= 40
        p.drawString(70, y, "CHá»¦ Tá»ŠCH Há»˜I Äá»’NG")
        p.drawString(width - 220, y, "THÆ¯ KÃ Há»˜I Äá»’NG")
        p.drawString(70, y - 15, "(KÃ½ vÃ  ghi rÃµ há» tÃªn)")
        p.drawString(width - 220, y - 15, "(KÃ½ vÃ  ghi rÃµ há» tÃªn)")

        p.showPage()
        p.save()

        buffer.seek(0)
        filename = f"Bien_ban_HD_{council.council_number}.pdf"
        response = HttpResponse(buffer.getvalue(), content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response


class BatchFinalGradesExcelExportAPIView(APIView):
    """Xuáº¥t cuá»‘i ká»³: Xuáº¥t dá»¯ liá»‡u cuá»‘i ká»³ toÃ n bá»™ Ä‘á»£t Ä‘á»“ Ã¡n ra Excel (kÃ½, lÆ°u)"""
    permission_classes = [IsAuthenticated]

    def get(self, request, batch_id):
        user = request.user
        if getattr(user, "user_type", "") == "student" or (not user.is_staff and not user.is_superuser and getattr(user, "user_type", "") not in ["admin", "supervisor", "academic_staff"]):
            return Response(
                {
                    "detail": "Sinh viÃªn khÃ´ng cÃ³ quyá»n truy cáº­p hoáº·c táº£i vá» Báº£ng Ä‘iá»ƒm tá»‘t nghiá»‡p.",
                    "message": "Sinh viÃªn khÃ´ng cÃ³ quyá»n truy cáº­p hoáº·c táº£i vá» Báº£ng Ä‘iá»ƒm tá»‘t nghiá»‡p.",
                    "error": "FORBIDDEN"
                },
                status=status.HTTP_403_FORBIDDEN
            )

        batch = get_object_or_404(AcademicBatch, id=batch_id)
        class_id = request.query_params.get("class_id")
        from openpyxl import Workbook
        import io

        wb = Workbook()
        ws = wb.active
        ws.title = "Báº£ng Ä‘iá»ƒm tá»‘t nghiá»‡p"

        ws.append(["TRÆ¯á»œNG Äáº I Há»ŒC GIAO THÃ”NG Váº¬N Táº¢I - KHOA CÃ”NG NGHá»† THÃ”NG TIN"])
        title_extra = f" - Lá»›p ID: {class_id}" if class_id else ""
        ws.append([f"Báº¢NG Tá»”NG Há»¢P Káº¾T QUáº¢ Äá»’ ÃN Tá»T NGHIá»†P: {batch.batch_name}{title_extra}"])
        ws.append([])
        ws.append([
            "STT", "MSSV", "Há» vÃ  tÃªn", "ChÆ°Æ¡ng trÃ¬nh", "TÃªn Ä‘á» tÃ i tiáº¿ng Viá»‡t", "GVHD",
            "Há»™i Ä‘á»“ng", "Äiá»ƒm GVHD", "Äiá»ƒm GVPB", "Äiá»ƒm TB HÄ", "Äiá»ƒm Tá»•ng (10)",
            "Äiá»ƒm Há»‡ 4", "Äiá»ƒm chá»¯", "Xáº¿p loáº¡i", "Káº¿t quáº£"
        ])

        projects = GraduationProject.objects.filter(batch=batch).select_related(
            "student__user", "supervisor__user", "council", "final_grade_summary", "student__course_class"
        )
        if class_id:
            projects = projects.filter(student__course_class_id=class_id)
        projects = projects.order_by("student__registration_no")

        for idx, p in enumerate(projects, 1):
            s = getattr(p, "final_grade_summary", None)
            ws.append([
                idx,
                p.student.registration_no,
                p.student.user.get_full_name(),
                p.student.get_degree_program_display(),
                p.topic_title_vi,
                p.supervisor.user.get_full_name(),
                p.council.council_name if p.council else "ChÆ°a gÃ¡n",
                p.supervisor_score or "",
                p.reviewer_score or "",
                s.council_avg_score if s else "",
                s.final_score_10 if s else "",
                s.final_score_4 if s else "",
                s.final_letter_grade if s else "",
                s.classification if s else "",
                "Äáº¡t" if (s and s.is_passed) else ("Báº£o lÆ°u" if p.status == "DEFERRED" else "KhÃ´ng Ä‘áº¡t")
            ])

        buffer = io.BytesIO()
        wb.save(buffer)
        buffer.seek(0)

        filename = f"Bang_diem_tot_nghiep_{batch.batch_code}.xlsx"
        response = HttpResponse(buffer.getvalue(), content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response


# ==============================================================================
# DEFERRED THESIS (NHÃNH Báº¢O LÆ¯U) APIS
# ==============================================================================

class StudentDeferralRequestAPIView(APIView):
    """Sinh viÃªn ná»™p Ä‘Æ¡n xin báº£o lÆ°u Ä‘á»“ Ã¡n khi khÃ´ng Ä‘á»§ Ä‘iá»u kiá»‡n báº£o vá»‡ / há»c vá»¥"""
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        user = request.user
        student = getattr(user, "student_profile", None)
        if not student:
            return Response({"detail": "Chá»‰ dÃ nh cho sinh viÃªn."}, status=status.HTTP_403_FORBIDDEN)

        requests = ThesisDeferralRequest.objects.filter(student=student).order_by("-submitted_at")
        return Response(ThesisDeferralRequestSerializer(requests, many=True).data, status=status.HTTP_200_OK)

    def post(self, request):
        user = request.user
        student = getattr(user, "student_profile", None)
        if not student:
            return Response({"detail": "Chá»‰ dÃ nh cho sinh viÃªn."}, status=status.HTTP_403_FORBIDDEN)

        project = GraduationProject.objects.filter(student=student).first()
        if not project:
            batch = getattr(student, "academic_batch", None) or AcademicBatch.get_active_batch()
            if batch:
                project = GraduationProject.objects.create(
                    student=student,
                    batch=batch,
                    status="DISQUALIFIED"
                )
            else:
                return Response({"detail": "ChÆ°a cÃ³ Ä‘á»“ Ã¡n hoáº·c Ä‘á»£t há»£p lá»‡ Ä‘á»ƒ xin báº£o lÆ°u."}, status=status.HTTP_400_BAD_REQUEST)

        reason = (request.data.get("reason", "") or request.data.get("reason_details", "")).strip()
        evidence_file = request.FILES.get("evidence_file")

        if not reason:
            return Response({"detail": "Vui lÃ²ng nháº­p lÃ½ do xin báº£o lÆ°u Ä‘á»“ Ã¡n."}, status=status.HTTP_400_BAD_REQUEST)

        if evidence_file:
            try:
                validate_uploaded_file(evidence_file, allowed_extensions=[".pdf", ".zip", ".docx", ".png", ".jpg"], max_size_bytes=25 * 1024 * 1024)
            except Exception as e:
                err_msg = getattr(e, "detail", str(e))
                return Response({"evidence_file": [str(err_msg)]}, status=status.HTTP_400_BAD_REQUEST)

        deferral = ThesisDeferralRequest.objects.create(
            project=project,
            student=student,
            reason=reason,
            evidence_file=evidence_file,
            status="PENDING",
        )

        return Response({
            "success": True,
            "message": "Ná»™p Ä‘Æ¡n xin báº£o lÆ°u Ä‘á»“ Ã¡n thÃ nh cÃ´ng! Äang chá» Khoa phÃª duyá»‡t.",
            "deferral": ThesisDeferralRequestSerializer(deferral).data
        }, status=status.HTTP_201_CREATED)


class AdminDeferralRequestListAPIView(APIView):
    """Khoa/Admin xem danh sÃ¡ch Ä‘Æ¡n xin báº£o lÆ°u Ä‘á»“ Ã¡n cá»§a sinh viÃªn"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if getattr(user, "user_type", "") == "student":
            return Response(
                {"detail": "Sinh viÃªn khÃ´ng cÃ³ quyá»n truy cáº­p danh sÃ¡ch quáº£n lÃ½ Ä‘Æ¡n báº£o lÆ°u."},
                status=status.HTTP_403_FORBIDDEN
            )
        status_filter = request.query_params.get("status")
        requests_qs = ThesisDeferralRequest.objects.select_related(
            "student__user", "project__supervisor__user", "project__batch"
        ).order_by("-submitted_at")
        if status_filter:
            requests_qs = requests_qs.filter(status=status_filter.upper())
        return Response(ThesisDeferralRequestSerializer(requests_qs, many=True).data, status=status.HTTP_200_OK)


class AdminReviewDeferralRequestAPIView(APIView):
    """Khoa duyá»‡t Ä‘Æ¡n báº£o lÆ°u: APPROVED -> project.status='DEFERRED', REJECTED -> project.status='DISQUALIFIED'"""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        user = request.user
        if getattr(user, "user_type", "") == "student":
            return Response(
                {"detail": "Sinh viÃªn khÃ´ng cÃ³ quyá»n phÃª duyá»‡t Ä‘Æ¡n báº£o lÆ°u Ä‘á»“ Ã¡n (Chá»‰ dÃ nh cho Khoa/Ban quáº£n trá»‹)."},
                status=status.HTTP_403_FORBIDDEN
            )

        deferral = get_object_or_404(ThesisDeferralRequest, id=pk)

        raw_decision = request.data.get("decision") or request.data.get("status") or request.data.get("action") or "APPROVED"
        raw_decision_str = str(raw_decision).upper().strip()
        if raw_decision_str in ["APPROVE", "APPROVED", "ACCEPT", "ACCEPTED", "TRUE"]:
            decision = "APPROVED"
        else:
            decision = "REJECTED"

        admin_notes = request.data.get("admin_notes") or request.data.get("notes") or request.data.get("faculty_review_notes") or ""
        admin_notes = str(admin_notes).strip()

        with transaction.atomic():
            deferral.status = decision
            deferral.admin_notes = admin_notes
            deferral.reviewed_at = timezone.now()
            deferral.reviewed_by = request.user
            deferral.save()

            project = deferral.project
            if decision == "APPROVED":
                project.status = "DEFERRED"
                msg = f"Khoa Ä‘Ã£ duyá»‡t Ä‘Æ¡n báº£o lÆ°u Ä‘á»“ Ã¡n cho sinh viÃªn {project.student.registration_no}."
            else:
                project.status = "DISQUALIFIED"
                msg = f"Khoa khÃ´ng duyá»‡t Ä‘Æ¡n báº£o lÆ°u. Sinh viÃªn {project.student.registration_no} bá»‹ loáº¡i khá»i Ä‘á»£t."

            project.save(update_fields=["status"])

        # ThÃ´ng bÃ¡o tá»›i SV
        try:
            NotificationService.create_notification(
                user=deferral.student.user,
                notification_type="general",
                title="[Káº¿t quáº£ duyá»‡t Ä‘Æ¡n báº£o lÆ°u Ä‘á»“ Ã¡n]",
                message=msg,
                action_url="/student/dashboard",
                send_email=True,
            )
        except Exception as e:
            logger.warning("Could not send notification: %s", e)

        return Response({
            "message": msg,
            "deferral": ThesisDeferralRequestSerializer(deferral).data,
            "project": GraduationProjectDetailSerializer(project).data
        }, status=status.HTTP_200_OK)


class CloseBatchAPIView(APIView):
    """Khoa káº¿t thÃºc Ä‘á»£t Ä‘á»“ Ã¡n"""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        batch = get_object_or_404(AcademicBatch, pk=pk)
        batch.current_stage = "COMPLETED"
        batch.is_closed = True
        batch.is_active = False
        batch.save(update_fields=["current_stage", "is_closed", "is_active"])

        AuditLog.objects.create(
            user=request.user,
            action_type="group_status_change",
            description=f"Khoa Ä‘Ã£ chÃ­nh thá»©c káº¿t thÃºc Äá»£t Ä‘á»“ Ã¡n {batch.batch_code}."
        )

        return Response({
            "message": f"Äá»£t {batch.batch_code} Ä‘Ã£ hoÃ n táº¥t vÃ  káº¿t thÃºc thÃ nh cÃ´ng.",
            "batch_id": batch.id,
            "is_closed": True,
            "is_active": False,
            "current_stage": "COMPLETED"
        }, status=status.HTTP_200_OK)


class ReopenBatchAPIView(APIView):
    """Khoa má»Ÿ láº¡i Ä‘á»£t Ä‘á»“ Ã¡n Ä‘Ã£ káº¿t thÃºc tá»« kho lÆ°u trá»¯"""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        batch = get_object_or_404(AcademicBatch, pk=pk)
        batch.is_closed = False
        batch.is_active = True
        if batch.current_stage == "COMPLETED":
            batch.current_stage = "PHASE_6_DEFENSE"
        batch.save(update_fields=["current_stage", "is_closed", "is_active"])

        AuditLog.objects.create(
            user=request.user,
            action_type="group_status_change",
            description=f"Khoa Ä‘Ã£ má»Ÿ láº¡i Äá»£t Ä‘á»“ Ã¡n {batch.batch_code} tá»« kho lÆ°u trá»¯."
        )

        return Response({
            "message": f"Äá»£t {batch.batch_code} Ä‘Ã£ Ä‘Æ°á»£c má»Ÿ láº¡i thÃ nh cÃ´ng.",
            "batch_id": batch.id,
            "is_closed": False,
            "is_active": True,
            "current_stage": batch.current_stage
        }, status=status.HTTP_200_OK)


