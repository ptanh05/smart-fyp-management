"""
API cho các tính năng mở rộng: phiên bản bài nộp + kiểm tra tương đồng, rubric + lệch điểm,
kiểm tra trùng đề tài, thống kê Khoa, lịch iCal, kho lưu trữ đồ án.
"""
import os

from django.db.models import Q
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle
from rest_framework.views import APIView

from . import feature_services as fs
from .feature_validators import validate_submission_file
from .models import (
    AcademicBatch, AuditLog, CalendarFeedToken, CouncilMember, GraduationProject, Rubric,
    RubricCriterion, RubricScore, SubmissionVersion, ThesisArchiveRecord,
)
from .permissions import IsAdminUserRole
from .validators import validate_uploaded_file
from . import workflow_stages

SUBMISSION_ALLOWED_EXTENSIONS = [".pdf", ".docx", ".zip", ".pptx", ".txt", ".md"]
SUBMISSION_MAX_BYTES = 25 * 1024 * 1024


# ---------------------------------------------------------------------------
# Throttle classes for public / heavy endpoints
# ---------------------------------------------------------------------------

class CalendarFeedThrottle(AnonRateThrottle):
    """60 feed requests per hour per IP (calendar subscription clients)."""
    scope = "calendar_feed"
    rate = "60/hour"


class UploadBurstThrottle(UserRateThrottle):
    """20 uploads per minute per user to prevent abuse."""
    scope = "upload_burst"
    rate = "20/minute"


class SimilarityCheckThrottle(UserRateThrottle):
    """30 similarity checks per minute per user."""
    scope = "similarity_check"
    rate = "30/minute"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def is_faculty_admin(request):
    return IsAdminUserRole().has_permission(request, None)


def project_role(user, project):
    """Vai trò của user đối với đồ án: STUDENT / SUPERVISOR / REVIEWER / COUNCIL / ADMIN / None."""
    if project.student_id and project.student.user_id == user.id:
        return "STUDENT"
    if project.supervisor_id and project.supervisor.user_id == user.id:
        return "SUPERVISOR"
    if project.reviewer_id and project.reviewer.user_id == user.id:
        return "REVIEWER"
    if project.council_id and CouncilMember.objects.filter(council_id=project.council_id, user=user).exists():
        return "COUNCIL"
    if user.is_staff or user.is_superuser or getattr(user, "user_type", "") in ("admin", "academic_staff", "giao_vu"):
        return "ADMIN"
    return None


def _forbidden(msg="Bạn không có quyền truy cập đồ án này."):
    return Response({"detail": msg}, status=status.HTTP_403_FORBIDDEN)


def _file_url(f, request=None):
    if not f:
        return None
    try:
        url = f.url
    except Exception:
        return None
    return request.build_absolute_uri(url) if request and url.startswith("/") else url


def _audit(user, action_type, description, field_name=None, old_value=None, new_value=None, request=None):
    """Write an AuditLog entry, silently ignoring any errors so it never breaks the main flow."""
    try:
        ip = None
        if request:
            ip = (request.META.get("HTTP_X_FORWARDED_FOR") or "").split(",")[0].strip() or \
                 request.META.get("REMOTE_ADDR")
        AuditLog.objects.create(
            user=user,
            action_type=action_type,
            description=description,
            field_name=field_name,
            old_value=str(old_value) if old_value is not None else None,
            new_value=str(new_value) if new_value is not None else None,
            ip_address=ip or None,
        )
    except Exception:
        pass


# ==============================================================================
# 1 + 4. Phiên bản bài nộp và kiểm tra tương đồng
# ==============================================================================

def serialize_version(v, request=None, include_matches=True, is_admin=False):
    data = {
        "id": v.id,
        "project_id": v.project_id,
        "kind": v.kind,
        "kind_display": v.get_kind_display(),
        "version_no": v.version_no,
        "original_name": v.original_name,
        "file_size": v.file_size,
        "sha256": v.sha256,
        "note": v.note,
        "file_url": _file_url(v.file, request),
        "uploaded_by": (v.uploaded_by.get_full_name() or v.uploaded_by.username) if v.uploaded_by_id else "",
        "created_at": v.created_at.isoformat() if v.created_at else None,
        "similarity_status": v.similarity_status,
        "similarity_score": v.similarity_score,
        "similarity_level": fs.similarity_level(v.similarity_score),
        "similarity_checked_at": v.similarity_checked_at.isoformat() if v.similarity_checked_at else None,
    }
    if include_matches:
        matches = v.similarity_matches or []
        if not is_admin:
            # F7: strip student PII (student_code/registration_no) from matches shown to
            # SUPERVISOR / REVIEWER / COUNCIL roles – they need overlap scores to verify
            # plagiarism but must NOT see the registration numbers of other students.
            _STRIP_KEYS = {"student_code"}
            matches = [{k: m[k] for k in m if k not in _STRIP_KEYS} for m in matches]
        data["similarity_matches"] = matches
    return data


class ProjectSubmissionVersionsAPIView(APIView):
    """GET: lịch sử phiên bản; POST: SV nộp phiên bản mới (không ghi đè bản cũ)."""
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    throttle_classes = []  # Throttle applied only on POST via get_throttles

    def get_throttles(self):
        if self.request.method == "POST":
            return [UploadBurstThrottle()]
        return []

    def get(self, request, pk):
        project = get_object_or_404(GraduationProject.objects.select_related("student", "supervisor", "reviewer"), pk=pk)
        role = project_role(request.user, project)
        if not role:
            return _forbidden()
        qs = project.submission_versions.select_related("uploaded_by")
        kind = request.query_params.get("kind")
        if kind:
            qs = qs.filter(kind=kind.upper())
        # SV chỉ thấy điểm tương đồng, không thấy chi tiết bài của SV khác.
        include_matches = role != "STUDENT"
        admin_role = role == "ADMIN"
        return Response([serialize_version(v, request, include_matches, is_admin=admin_role) for v in qs])

    def post(self, request, pk):
        project = get_object_or_404(GraduationProject.objects.select_related("student"), pk=pk)
        if project_role(request.user, project) != "STUDENT":
            return _forbidden("Chỉ sinh viên thực hiện đồ án mới được nộp bài.")
        if project.status in ("PASSED", "FAILED", "DISQUALIFIED", "DEFERRED"):
            return Response({"detail": "Đồ án đã kết thúc, không thể nộp thêm phiên bản."}, status=status.HTTP_409_CONFLICT)
        uploaded = request.FILES.get("file")
        if not uploaded:
            return Response({"file": ["Vui lòng chọn file."]}, status=status.HTTP_400_BAD_REQUEST)
        kind = str(request.data.get("kind") or "REPORT").upper()
        if kind not in dict(SubmissionVersion.KIND_CHOICES):
            return Response({"kind": ["Loại bài nộp không hợp lệ."]}, status=status.HTTP_400_BAD_REQUEST)

        # Bản nháp báo cáo/quyển đồ án là sản phẩm của GĐ4. Những loại bài nộp
        # khác vẫn giữ luồng cũ vì có thể thuộc giai đoạn bảo vệ/lưu trữ.
        if kind == "REPORT":
            stage_error = workflow_stages.check_stage_write(project, 4)
            if stage_error:
                stage_error.pop("workflow", None)
                return Response(stage_error, status=status.HTTP_409_CONFLICT)

        ext = os.path.splitext(uploaded.name)[1].lower()
        if ext not in SUBMISSION_ALLOWED_EXTENSIONS:
            return Response({"file": [f"Chỉ chấp nhận: {', '.join(SUBMISSION_ALLOWED_EXTENSIONS)}"]}, status=status.HTTP_400_BAD_REQUEST)
        try:
            validate_submission_file(uploaded, allowed_extensions=SUBMISSION_ALLOWED_EXTENSIONS, max_size_bytes=SUBMISSION_MAX_BYTES)
        except Exception as exc:
            return Response({"file": [str(getattr(exc, "detail", exc))]}, status=status.HTTP_400_BAD_REQUEST)
        try:
            validate_uploaded_file(uploaded, allowed_extensions=SUBMISSION_ALLOWED_EXTENSIONS, max_size_bytes=SUBMISSION_MAX_BYTES)
        except Exception as exc:
            return Response({"file": [str(getattr(exc, "detail", exc))]}, status=status.HTTP_400_BAD_REQUEST)

        version = fs.create_submission_version(project, uploaded, kind, request.user, note=request.data.get("note", ""))
        return Response(serialize_version(version, request, include_matches=False), status=status.HTTP_201_CREATED)


class SubmissionSimilarityRecheckAPIView(APIView):
    """GV/Khoa yêu cầu kiểm tra lại tương đồng (vd. sau khi kho bài nộp có thêm dữ liệu)."""
    permission_classes = [IsAuthenticated]
    throttle_classes = [SimilarityCheckThrottle]

    def post(self, request, pk):
        version = get_object_or_404(SubmissionVersion.objects.select_related("project"), pk=pk)
        role = project_role(request.user, version.project)
        if role not in ("SUPERVISOR", "REVIEWER", "ADMIN"):
            return _forbidden()
        fs.run_similarity_check(version)
        return Response(serialize_version(version, request, is_admin=(role == "ADMIN")))


# ==============================================================================
# 3. Kiểm tra trùng đề tài
# ==============================================================================

class TopicSimilarityCheckAPIView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [SimilarityCheckThrottle]

    def get(self, request):
        title = (request.query_params.get("title") or "").strip()
        if len(title) < 5:
            return Response({"title": title, "matches": [], "has_duplicate_risk": False})
        exclude = request.query_params.get("project_id")
        matches = fs.find_similar_topics(title, exclude_project_id=exclude)
        if getattr(request.user, "user_type", "") == "student":
            # SV chỉ cần biết có đề tài trùng, không xem thông tin GV/đợt của người khác
            matches = [{k: m[k] for k in ("topic_title_vi", "batch_code", "similarity", "level")} for m in matches]
        return Response({
            "title": title,
            "matches": matches,
            "has_duplicate_risk": any(m["level"] == "HIGH" for m in matches),
        })


# ==============================================================================
# 2. Rubric chấm điểm và phát hiện lệch điểm
# ==============================================================================

def serialize_rubric(r):
    return {
        "id": r.id,
        "name": r.name,
        "evaluator_role": r.evaluator_role,
        "batch_id": r.batch_id,
        "description": r.description,
        "is_active": r.is_active,
        "criteria": [
            {
                "id": c.id,
                "name": c.name,
                "description": c.description,
                "max_score": c.max_score,
                "weight": c.weight,
                "order": c.order,
            }
            for c in r.criteria.all()
        ],
        "total_max": r.total_max,
    }


def serialize_rubric_score(s, include_detail=True):
    data = {
        "id": s.id,
        "rubric_id": s.rubric_id,
        "rubric_name": s.rubric.name,
        "evaluator_role": s.rubric.evaluator_role,
        "evaluator": s.evaluator.get_full_name() or s.evaluator.username,
        "criterion_scores": s.criterion_scores,
        "criterion_comments": s.criterion_comments,
        "total_10": s.total_10,
        "comment": s.comment,
        "status": s.status,
        "locked_at": s.locked_at.isoformat() if s.locked_at else None,
        "updated_at": s.updated_at.isoformat(),
    }
    return data


class RubricListCreateAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = Rubric.objects.prefetch_related("criteria").filter(is_active=True)
        if request.query_params.get("role"):
            qs = qs.filter(evaluator_role=request.query_params["role"].upper())
        if request.query_params.get("batch_id"):
            qs = qs.filter(Q(batch_id=request.query_params["batch_id"]) | Q(batch__isnull=True))
        return Response([serialize_rubric(r) for r in qs])

    def post(self, request):
        if not is_faculty_admin(request):
            return _forbidden("Chỉ Khoa/Giáo vụ được tạo rubric.")
        name = str(request.data.get("name") or "").strip()
        role = str(request.data.get("evaluator_role") or "").upper()
        criteria = request.data.get("criteria") or []
        if not name or role not in dict(Rubric.ROLE_CHOICES):
            return Response({"detail": "Cần tên rubric và evaluator_role hợp lệ (SUPERVISOR/REVIEWER/COUNCIL)."}, status=status.HTTP_400_BAD_REQUEST)
        if not isinstance(criteria, list) or not criteria:
            return Response({"criteria": ["Cần ít nhất một tiêu chí."]}, status=status.HTTP_400_BAD_REQUEST)
        for i, c in enumerate(criteria):
            try:
                max_score = float(c.get("max_score", 10))
            except (TypeError, ValueError, AttributeError):
                return Response({"criteria": [f"Tiêu chí #{i + 1} không hợp lệ."]}, status=status.HTTP_400_BAD_REQUEST)
            if not str(c.get("name") or "").strip() or max_score <= 0:
                return Response({"criteria": [f"Tiêu chí #{i + 1} cần tên và điểm tối đa > 0."]}, status=status.HTTP_400_BAD_REQUEST)
        rubric = Rubric.objects.create(
            name=name, evaluator_role=role, batch_id=request.data.get("batch_id") or None,
            description=request.data.get("description") or "",
        )
        RubricCriterion.objects.bulk_create([
            RubricCriterion(
                rubric=rubric,
                name=str(c["name"]).strip(),
                description=c.get("description") or "",
                max_score=float(c.get("max_score", 10)),
                weight=float(c["weight"]) if c.get("weight") is not None else None,
                order=i,
            )
            for i, c in enumerate(criteria)
        ])
        _audit(request.user, "rubric_create",
               f"Tạo rubric '{rubric.name}' (role={role}, id={rubric.id})", request=request)
        return Response(serialize_rubric(rubric), status=status.HTTP_201_CREATED)


ROLE_TO_RUBRIC = {"SUPERVISOR": "SUPERVISOR", "REVIEWER": "REVIEWER", "COUNCIL": "COUNCIL"}


class ProjectRubricScoreAPIView(APIView):
    """GET: các phiếu chấm rubric của đồ án; POST: giám khảo chấm theo rubric đúng vai trò.

    POST body: {rubric_id, criterion_scores, criterion_comments?, comment?, is_draft?, action?}

    Mode resolution (is_draft takes precedence over action):
      is_draft=True  (or action="DRAFT")  → lưu bản nháp, có thể sửa lại.
      is_draft=False (or action="SUBMIT") → khóa phiếu chính thức; sau đó không sửa được nữa.
    If neither is provided: defaults to DRAFT.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        project = get_object_or_404(GraduationProject, pk=pk)
        role = project_role(request.user, project)
        if not role:
            return _forbidden()
        qs = project.rubric_scores.select_related("rubric", "evaluator")
        if role == "STUDENT":
            return _forbidden("Sinh viên xem điểm tổng hợp sau khi Khoa công bố.")
        if role in ROLE_TO_RUBRIC:
            # Chấm độc lập (blind): giám khảo chỉ thấy phiếu của mình cho tới khi Khoa đối chiếu.
            qs = qs.filter(evaluator=request.user)
        return Response([serialize_rubric_score(s) for s in qs])

    def post(self, request, pk):
        project = get_object_or_404(GraduationProject, pk=pk)
        role = project_role(request.user, project)
        rubric = get_object_or_404(Rubric.objects.prefetch_related("criteria"), pk=request.data.get("rubric_id"), is_active=True)
        if ROLE_TO_RUBRIC.get(role) != rubric.evaluator_role:
            return _forbidden("Rubric này không dành cho vai trò của bạn đối với đồ án.")
        if rubric.batch_id and rubric.batch_id != project.batch_id:
            return Response({"detail": "Rubric không áp dụng cho đợt của đồ án."}, status=status.HTTP_400_BAD_REQUEST)

        # Check lock status
        existing = RubricScore.objects.filter(project=project, rubric=rubric, evaluator=request.user).first()
        if existing and existing.status == "SUBMITTED":
            return Response(
                {"detail": "Phiếu chấm đã được nộp chính thức (SUBMITTED) và bị khóa. "
                           "Liên hệ Khoa để mở khóa."},
                status=status.HTTP_409_CONFLICT,
            )

        scores = request.data.get("criterion_scores") or {}
        if not isinstance(scores, dict):
            return Response({"criterion_scores": ["Phải là object {criterion_id: điểm}."]}, status=status.HTTP_400_BAD_REQUEST)
        try:
            cleaned, total = fs.compute_rubric_total(rubric, scores)
        except ValueError as exc:
            return Response({"criterion_scores": [str(exc)]}, status=status.HTTP_400_BAD_REQUEST)

        # is_draft (boolean) takes precedence; falls back to action string
        is_draft_raw = request.data.get("is_draft")
        if is_draft_raw is not None:
            # Accept Python booleans (from JSON) or truthy strings
            if isinstance(is_draft_raw, bool):
                action = "DRAFT" if is_draft_raw else "SUBMIT"
            elif str(is_draft_raw).lower() in ("true", "1", "yes"):
                action = "DRAFT"
            elif str(is_draft_raw).lower() in ("false", "0", "no"):
                action = "SUBMIT"
            else:
                return Response({"is_draft": ["Phải là true hoặc false."]}, status=status.HTTP_400_BAD_REQUEST)
        else:
            action = str(request.data.get("action") or "DRAFT").upper()
            if action not in ("DRAFT", "SUBMIT"):
                return Response({"action": ["Giá trị hợp lệ: DRAFT hoặc SUBMIT."]}, status=status.HTTP_400_BAD_REQUEST)

        # Validate criterion_comments if provided
        c_comments = request.data.get("criterion_comments") or {}
        if not isinstance(c_comments, dict):
            c_comments = {}

        new_status = "SUBMITTED" if action == "SUBMIT" else "DRAFT"
        locked_at = timezone.now() if action == "SUBMIT" else None

        obj, created = RubricScore.objects.update_or_create(
            project=project, rubric=rubric, evaluator=request.user,
            defaults={
                "criterion_scores": cleaned,
                "criterion_comments": c_comments,
                "total_10": total,
                "comment": request.data.get("comment") or "",
                "status": new_status,
                "locked_at": locked_at,
            },
        )
        _audit(
            request.user,
            "rubric_score_submit" if action == "SUBMIT" else "rubric_score_draft",
            f"{'Nộp chính thức' if action == 'SUBMIT' else 'Lưu bản nháp'} phiếu chấm rubric "
            f"id={obj.id} project_id={pk} rubric_id={rubric.id} total_10={total}",
            request=request,
        )
        return Response({
            "id": obj.id,
            "total_10": total,
            "criterion_scores": cleaned,
            "criterion_comments": c_comments,
            "status": new_status,
            "locked_at": locked_at.isoformat() if locked_at else None,
        }, status=status.HTTP_200_OK)


class RubricScoreUnlockAPIView(APIView):
    """Admin mở khóa phiếu chấm đã SUBMIT để giám khảo có thể sửa lại."""
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def post(self, request, pk):
        score = get_object_or_404(RubricScore, pk=pk)
        if score.status != "SUBMITTED":
            return Response({"detail": "Phiếu chấm chưa ở trạng thái SUBMITTED."}, status=status.HTTP_400_BAD_REQUEST)
        old_status = score.status
        score.status = "DRAFT"
        score.locked_at = None
        score.save(update_fields=["status", "locked_at"])
        _audit(
            request.user, "rubric_unlock",
            f"Admin mở khóa phiếu chấm id={pk} (project_id={score.project_id}, "
            f"evaluator={score.evaluator.username})",
            field_name="status", old_value=old_status, new_value="DRAFT",
            request=request,
        )
        return Response({"id": pk, "status": "DRAFT", "locked_at": None})


class ProjectScoreDiscrepancyAPIView(APIView):
    """Khoa xem độ lệch điểm giữa các giám khảo để quyết định đối chiếu/chấm lại."""
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def get(self, request, pk):
        project = get_object_or_404(GraduationProject.objects.select_related("supervisor__user", "reviewer__user"), pk=pk)
        return Response(fs.score_discrepancy(project))


class BatchScoreDiscrepancyAPIView(APIView):
    """Danh sách đồ án trong đợt cần đối chiếu điểm."""
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def get(self, request):
        projects = GraduationProject.objects.select_related("supervisor__user", "reviewer__user", "student__user")
        if request.query_params.get("batch_id"):
            projects = projects.filter(batch_id=request.query_params["batch_id"])
        flagged = []
        for p in projects:
            report = fs.score_discrepancy(p)
            if report["needs_reconciliation"]:
                report["topic_title_vi"] = p.topic_title_vi
                report["student_code"] = p.student.registration_no if p.student_id else ""
                flagged.append(report)
        flagged.sort(key=lambda r: r["spread"], reverse=True)
        return Response({"count": len(flagged), "results": flagged})


# ==============================================================================
# 5. Thống kê cho Khoa
# ==============================================================================

class FacultyAnalyticsAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def get(self, request):
        batch = None
        if request.query_params.get("batch_id"):
            batch = get_object_or_404(AcademicBatch, pk=request.query_params["batch_id"])
        return Response(fs.faculty_analytics(batch))


# ==============================================================================
# Lecturer workload endpoint (for Agent 4 UI)
# ==============================================================================

class LecturerWorkloadAPIView(APIView):
    """
    GET /app/lecturer/workload/
    Returns projects where the requesting user is supervisor, reviewer, or council member.

    JSON contract (each item in list):
    {
        "project_id": int,
        "topic_title_vi": str,
        "student_name": str,
        "student_reg_no": str,
        "batch_code": str,
        "status": str,
        "roles": ["SUPERVISOR"|"REVIEWER"|"COUNCIL", ...],
        "latest_submission": {
            "id": int, "kind": str, "version_no": int,
            "created_at": iso8601, "similarity_score": float|null, "similarity_level": str
        } | null,
        "my_rubric_status": "MISSING"|"DRAFT"|"SUBMITTED",
        "needs_reconciliation": bool|null    // null = not visible to this role; bool = admin-visible
    }

    Permissions: IsAuthenticated.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        admin = is_faculty_admin(request)

        from django.db.models import Prefetch

        sup_project_ids = set(
            GraduationProject.objects.filter(supervisor__user=user).values_list("id", flat=True)
        )
        rev_project_ids = set(
            GraduationProject.objects.filter(reviewer__user=user).values_list("id", flat=True)
        )
        council_ids = list(
            CouncilMember.objects.filter(user=user).values_list("council_id", flat=True)
        )
        council_project_ids = set(
            GraduationProject.objects.filter(council_id__in=council_ids).values_list("id", flat=True)
        ) if council_ids else set()

        all_ids = sup_project_ids | rev_project_ids | council_project_ids
        if not all_ids:
            return Response([])

        projects = GraduationProject.objects.filter(id__in=all_ids).select_related(
            "student__user", "supervisor__user", "reviewer__user", "batch"
        ).prefetch_related(
            Prefetch("rubric_scores",
                     queryset=RubricScore.objects.select_related("rubric").filter(evaluator=user),
                     to_attr="_my_scores"),
        )

        # Latest submission per project (single pass, ordered newest-first)
        latest_versions = {}
        for sv in SubmissionVersion.objects.filter(project_id__in=all_ids).order_by("project_id", "-created_at"):
            if sv.project_id not in latest_versions:
                latest_versions[sv.project_id] = sv

        results = []
        for p in projects:
            roles = []
            if p.id in sup_project_ids:
                roles.append("SUPERVISOR")
            if p.id in rev_project_ids:
                roles.append("REVIEWER")
            if p.id in council_project_ids:
                roles.append("COUNCIL")

            sv = latest_versions.get(p.id)
            latest_sub = None
            if sv:
                latest_sub = {
                    "id": sv.id,
                    "kind": sv.kind,
                    "version_no": sv.version_no,
                    "created_at": sv.created_at.isoformat() if sv.created_at else None,
                    "similarity_score": sv.similarity_score,
                    "similarity_level": fs.similarity_level(sv.similarity_score),
                }

            my_scores = getattr(p, "_my_scores", [])
            if my_scores:
                role_priority = {"SUPERVISOR": 1, "REVIEWER": 2, "COUNCIL": 3}
                best = sorted(my_scores, key=lambda s: role_priority.get(s.rubric.evaluator_role, 99))[0]
                my_rubric_status = best.status  # "DRAFT" or "SUBMITTED"
            else:
                my_rubric_status = "MISSING"

            needs_reconciliation = None
            if admin:
                try:
                    disc = fs.score_discrepancy(p)
                    needs_reconciliation = disc["needs_reconciliation"]
                except Exception:
                    needs_reconciliation = False

            results.append({
                "project_id": p.id,
                "topic_title_vi": p.topic_title_vi or "",
                "student_name": (p.student.user.get_full_name() if p.student_id and p.student.user_id else ""),
                "student_reg_no": (p.student.registration_no if p.student_id else ""),
                "batch_code": (p.batch.batch_code if p.batch_id else ""),
                "status": p.status,
                "roles": roles,
                "latest_submission": latest_sub,
                "my_rubric_status": my_rubric_status,
                "needs_reconciliation": needs_reconciliation,
            })

        return Response(results)


# ==============================================================================
# 7. Lịch iCal
# ==============================================================================

def _ics_response(user):
    body = fs.build_ics(fs.collect_calendar_events(user), calendar_name=f"Smart FYP - {user.get_full_name() or user.username}")
    resp = HttpResponse(body, content_type="text/calendar; charset=utf-8")
    resp["Content-Disposition"] = 'attachment; filename="smart-fyp.ics"'
    return resp


class MyCalendarICSAPIView(APIView):
    """Tải file .ics (đã đăng nhập)."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return _ics_response(request.user)


class CalendarFeedTokenAPIView(APIView):
    """Lấy/đổi/xóa link đăng ký lịch (Google Calendar, Outlook tự đồng bộ theo URL này)."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        token = CalendarFeedToken.for_user(request.user)
        return Response({"feed_url": request.build_absolute_uri(f"/app/calendar/feed/{token.token}.ics")})

    def post(self, request):
        """Rotate token - old URL immediately returns 404."""
        token = CalendarFeedToken.for_user(request.user, rotate=True)
        return Response({"feed_url": request.build_absolute_uri(f"/app/calendar/feed/{token.token}.ics")})

    def delete(self, request):
        """Revoke calendar feed entirely - deletes the token."""
        CalendarFeedToken.objects.filter(user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CalendarFeedAPIView(APIView):
    """Feed công khai theo token bí mật (ứng dụng lịch không gửi được JWT)."""
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [CalendarFeedThrottle]

    def get(self, request, token):
        feed = CalendarFeedToken.objects.select_related("user").filter(token=token).first()
        if not feed or not feed.user.is_active:
            return HttpResponse("Not found", status=404, content_type="text/plain")
        return _ics_response(feed.user)


# ==============================================================================
# 8. Kho lưu trữ đồ án và embargo
# ==============================================================================

def serialize_archive(r, request, can_see_file, include_admin_fields=False):
    data = {
        "id": r.id,
        "project_id": r.project_id,
        "title": r.title,
        "abstract": r.abstract if not r.is_embargoed or can_see_file else "",
        "keywords": r.keywords,
        "author": r.project.student.user.get_full_name() if r.project.student_id else "",
        "student_code": r.project.student.registration_no if r.project.student_id else "",
        "supervisor": r.project.supervisor.user.get_full_name() if r.project.supervisor_id else "",
        "batch_code": r.project.batch.batch_code if r.project.batch_id else "",
        "visibility": r.visibility,
        "is_embargoed": r.is_embargoed,
        "embargo_until": r.embargo_until.isoformat() if r.embargo_until else None,
        "license": r.license,
        "final_score": r.final_score if can_see_file else None,
        "file_url": _file_url(r.final_version.file, request) if (r.final_version_id and can_see_file) else None,
        "archived_at": r.archived_at.isoformat(),
    }
    if include_admin_fields:
        data["embargo_reason"] = r.embargo_reason
        data["archived_by"] = (r.archived_by.get_full_name() or r.archived_by.username) if r.archived_by_id else ""
        data["batch_id"] = r.project.batch_id
    return data


class ThesisArchiveListAPIView(APIView):
    """Tra cứu kho đồ án. Bản bị embargo chỉ hiện metadata, ẩn file và tóm tắt."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        admin = is_faculty_admin(request)
        qs = ThesisArchiveRecord.objects.select_related(
            "project__student__user", "project__supervisor__user", "project__batch", "final_version"
        )
        if not admin:
            qs = qs.exclude(visibility="INTERNAL") if getattr(request.user, "user_type", "") == "student" else qs
        q = (request.query_params.get("q") or "").strip()
        if q:
            qs = qs.filter(Q(title__icontains=q) | Q(keywords__icontains=q) | Q(abstract__icontains=q))
        results = []
        for r in qs[:200]:
            own = r.project.student_id and r.project.student.user_id == request.user.id
            can_see = admin or own or not r.is_embargoed
            results.append(serialize_archive(r, request, can_see))
        return Response(results)


class AdminArchiveListAPIView(APIView):
    """
    Admin: liệt kê và lọc kho đồ án.
    GET /app/admin/archive/
    Query params: batch_id, visibility (PUBLIC|INTERNAL|EMBARGOED), is_embargoed (1/0), q (keyword)
    """
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def get(self, request):
        qs = ThesisArchiveRecord.objects.select_related(
            "project__student__user", "project__supervisor__user", "project__batch",
            "final_version", "archived_by",
        ).order_by("-archived_at")

        if request.query_params.get("batch_id"):
            qs = qs.filter(project__batch_id=request.query_params["batch_id"])
        if request.query_params.get("visibility"):
            qs = qs.filter(visibility=request.query_params["visibility"].upper())
        if request.query_params.get("is_embargoed") in ("1", "true", "True"):
            today = timezone.localdate()
            qs = qs.filter(
                visibility="EMBARGOED"
            ).filter(Q(embargo_until__isnull=True) | Q(embargo_until__gt=today))
        elif request.query_params.get("is_embargoed") in ("0", "false", "False"):
            today = timezone.localdate()
            qs = qs.exclude(
                visibility="EMBARGOED",
                embargo_until__gt=today,
            )
        q = (request.query_params.get("q") or "").strip()
        if q:
            qs = qs.filter(Q(title__icontains=q) | Q(keywords__icontains=q) | Q(abstract__icontains=q))

        results = []
        for r in qs[:500]:
            results.append(serialize_archive(r, request, can_see_file=True, include_admin_fields=True))
        return Response({"count": len(results), "results": results})


class AdminArchiveUpdateAPIView(APIView):
    """
    Admin: cập nhật/dỡ bỏ embargo hoặc thay đổi visibility của bản lưu trữ.
    PATCH /app/admin/archive/<pk>/
    Body: {visibility?, embargo_until?, embargo_reason?, title?, abstract?, keywords?, license?}
    """
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def patch(self, request, pk):
        record = get_object_or_404(
            ThesisArchiveRecord.objects.select_related("project__batch", "project__student__user", "project__supervisor__user", "final_version", "archived_by"),
            pk=pk,
        )
        old_visibility = record.visibility
        old_embargo_until = record.embargo_until

        updatable = ["visibility", "embargo_until", "embargo_reason", "title", "abstract", "keywords", "license"]
        changed = []
        for field in updatable:
            if field in request.data:
                val = request.data[field]
                if field == "visibility" and val not in dict(ThesisArchiveRecord.VISIBILITY_CHOICES):
                    return Response({"detail": f"visibility không hợp lệ: {val}"}, status=status.HTTP_400_BAD_REQUEST)
                if field == "embargo_until" and val:
                    from datetime import date as _date
                    try:
                        val = _date.fromisoformat(val)
                    except ValueError:
                        return Response({"detail": "embargo_until phải dạng YYYY-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)
                setattr(record, field, val)
                changed.append(field)

        # Validate embargo fields
        if record.visibility == "EMBARGOED":
            if not record.embargo_until:
                return Response({"detail": "Cần embargo_until khi visibility=EMBARGOED."}, status=status.HTTP_400_BAD_REQUEST)
            if not (record.embargo_reason or "").strip():
                return Response({"detail": "Cần embargo_reason khi visibility=EMBARGOED."}, status=status.HTTP_400_BAD_REQUEST)
        else:
            # Clear embargo fields when not embargoed
            record.embargo_until = None
            record.embargo_reason = ""

        record.save()

        # AuditLog
        if old_visibility != record.visibility or old_embargo_until != record.embargo_until:
            _audit(
                request.user, "archive_embargo_change",
                f"Thay đổi trạng thái kho đồ án id={pk}: "
                f"visibility {old_visibility!r}→{record.visibility!r}, "
                f"embargo_until {old_embargo_until}→{record.embargo_until}",
                field_name="visibility",
                old_value=old_visibility,
                new_value=record.visibility,
                request=request,
            )
        elif changed:
            _audit(
                request.user, "archive_update",
                f"Cập nhật kho đồ án id={pk}: fields={changed}",
                request=request,
            )

        return Response(serialize_archive(record, request, can_see_file=True, include_admin_fields=True))


class ArchiveProjectAPIView(APIView):
    """Khoa đưa đồ án đã bảo vệ đạt vào kho lưu trữ, đặt chế độ công bố/embargo."""
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def post(self, request, pk):
        project = get_object_or_404(GraduationProject, pk=pk)
        try:
            record = fs.archive_project(project, request.user, request.data)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(serialize_archive(record, request, True), status=status.HTTP_201_CREATED)


class DataRetentionPreviewAPIView(APIView):
    """Khoa xem trước dữ liệu sẽ bị xóa theo chính sách lưu giữ (không xóa gì)."""
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def get(self, request):
        years = request.query_params.get("years")
        try:
            return Response(fs.apply_data_retention(years=int(years) if years else None, apply=False))
        except (TypeError, ValueError) as exc:
            return Response({"detail": str(exc) or "years phải là số nguyên."}, status=status.HTTP_400_BAD_REQUEST)


class AdminDataRetentionApplyAPIView(APIView):
    """
    Admin áp dụng chính sách lưu giữ dữ liệu (xóa thực sự).
    POST /app/admin/data-retention/apply/
    Body: {"confirm": true, "years": 5}
    Requires explicit confirm=true to prevent accidental deletion.
    """
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def post(self, request):
        if request.data.get("confirm") is not True:
            return Response(
                {"detail": "Phải truyền confirm=true để xác nhận xóa dữ liệu thực sự."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        years = request.data.get("years")
        try:
            years = int(years) if years is not None else None
        except (TypeError, ValueError):
            return Response({"detail": "years phải là số nguyên."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            summary = fs.apply_data_retention(years=years, apply=True)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        _audit(
            request.user, "retention_apply",
            f"Admin áp dụng chính sách lưu giữ dữ liệu: years={years}, "
            f"cutoff={summary.get('cutoff')}, batches={summary.get('batches')}",
            request=request,
        )
        return Response(summary)
