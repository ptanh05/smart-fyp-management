"""
Modular enhancement API views for smart-fyp-management (Student/Supervisor/Council portal).
"""
from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    AcademicBatch,
    AuditLog,
    BatchMilestone,
    CouncilMember,
    DefenseCouncil,
    DefenseMinutesSignature,
    GraduationProject,
    InternshipInfo,
    Notification,
    OutlineReview,
    ProjectTopicArea,
    SecurityPolicy,
    Student,
    StudentPreference,
    SupervisionMeetingLog,
    SupervisionTask,
    Supervisor,
    ThesisDeferralRequest,
    UserSessionLog,
    WeeklyProgressReport,
)
from .serializers.utc_graduation_serializers import (
    BatchMilestoneSerializer,
    ThesisDeferralRequestSerializer,
)


def _build_milestone_todos(current_milestone, is_closed=False, user_stage_number=None, role="student"):
    """Sinh việc cần làm cảnh báo khi mốc giai đoạn hiện tại sắp đến hạn (<= 3 ngày) hoặc quá hạn."""
    if not current_milestone or is_closed:
        return []
    days_left = current_milestone.get("days_left")
    if days_left is None or days_left > 3:
        return []
    ms_stage = current_milestone.get("stage_number")
    if user_stage_number is not None and ms_stage is not None and user_stage_number > ms_stage:
        return []

    student_tabs = {1: "project", 2: "survey", 3: "outline", 4: "weekly", 5: "supervision", 6: "grade"}
    action_tab = student_tabs.get(ms_stage, "overview") if role == "student" else f"stage_{ms_stage or 1}"
    action_url = (
        f"/student/dashboard?tab=utc_graduation&subtab={action_tab}"
        if role == "student"
        else f"/supervisor/dashboard?tab={action_tab}"
    )
    ms_name = current_milestone.get("name") or f"Mốc GĐ {ms_stage or ''}".strip()
    end_hint = ""
    if current_milestone.get("end_date"):
        try:
            end_local = timezone.localtime(timezone.datetime.fromisoformat(current_milestone["end_date"]))
            end_hint = f" (Hạn: {end_local.strftime('%d/%m/%Y')})"
        except Exception:
            end_hint = ""

    if days_left < 0:
        title = f'Mốc "{ms_name}" đã quá hạn {abs(days_left)} ngày'
        urgency = "high"
        todo_type = "milestone_overdue"
        description = f"Mốc giai đoạn {ms_stage or ''} đã vượt hạn chót{end_hint}. Hãy kiểm tra và hoàn tất ngay.".strip()
    elif days_left == 0:
        title = f"Hạn chót hôm nay: {ms_name}"
        urgency = "high"
        todo_type = "milestone_due_today"
        description = f"Hôm nay là hạn cuối của mốc GĐ {ms_stage or ''}{end_hint}.".strip()
    else:
        title = f"Sắp tới hạn ({days_left} ngày): {ms_name}"
        urgency = "high" if days_left <= 1 else "medium"
        todo_type = "milestone_upcoming"
        description = f"Còn {days_left} ngày tới hạn chót mốc GĐ {ms_stage or ''}{end_hint}.".strip()

    return [{
        "id": f"milestone-{current_milestone.get('id')}",
        "type": todo_type,
        "urgency": urgency,
        "title": title,
        "description": description,
        "due_date": current_milestone.get("end_date"),
        "project_id": None,
        "student_name": "",
        "action_tab": action_tab,
        "action_url": action_url,
    }]


def _resolve_user_batch(request):
    batch_id = request.query_params.get("batch_id")
    if batch_id:
        return get_object_or_404(AcademicBatch, pk=batch_id)
    student = getattr(request.user, "student_profile", None)
    if student and student.academic_batch_id:
        return student.academic_batch
    sup = getattr(request.user, "supervisor_profile", None)
    if sup:
        sup_projects = GraduationProject.objects.filter(supervisor=sup).select_related("batch")
        open_proj = (
            sup_projects.filter(batch__is_closed=False)
            .order_by("-batch__is_active", "-created_at")
            .first()
        )
        if open_proj and open_proj.batch:
            return open_proj.batch
        active_batch = AcademicBatch.get_active_batch()
        if active_batch:
            return active_batch
        any_proj = sup_projects.order_by("-created_at").first()
        if any_proj and any_proj.batch:
            return any_proj.batch
    return AcademicBatch.get_active_batch() or AcademicBatch.objects.order_by("-id").first()


class BatchMilestonesPublicAPIView(APIView):
    """Lấy danh sách mốc thời gian (Timeline) của đợt đồ án cho Sinh viên & Giảng viên."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        batch = _resolve_user_batch(request)
        if not batch:
            return Response({"batch": None, "milestones": [], "current_milestone": None}, status=status.HTTP_200_OK)

        milestones = BatchMilestone.objects.filter(batch=batch, is_active=True).order_by(
            "order_index", "start_date", "id"
        )
        from app.utils.batch_progress import DB_STAGE_TO_NUMBER, select_current_milestone

        serialized = BatchMilestoneSerializer(milestones, many=True).data
        current_stage_num = DB_STAGE_TO_NUMBER.get(batch.current_stage, 1)
        is_closed = bool(batch.is_closed or batch.current_stage == "COMPLETED")
        current = select_current_milestone(
            serialized,
            current_number=current_stage_num,
            is_closed=is_closed,
        )
        return Response(
            {
                "batch": {
                    "id": batch.id,
                    "batch_code": batch.batch_code,
                    "batch_name": batch.batch_name,
                    "current_stage": batch.current_stage,
                    "supplementary_open": bool(getattr(batch, "supplementary_open", False)),
                },
                "milestones": serialized,
                "current_milestone": current,
            },
            status=status.HTTP_200_OK,
        )


def _is_admin_or_superuser(user) -> bool:
    if not user or not user.is_authenticated:
        return False
    if getattr(user, "is_superuser", False) or getattr(user, "is_staff", False):
        return True
    if getattr(user, "user_type", "") in ("admin", "academic_staff"):
        return True
    return str(getattr(user, "role", "")).lower() in ("admin", "superadmin", "academic_staff")


class SupervisorDeferralFeedbackAPIView(APIView):
    """GVHD góp ý / xác nhận tình trạng đồ án trên đơn xin bảo lưu của sinh viên mình hướng dẫn."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        return self._handle_feedback(request, pk)

    def patch(self, request, pk):
        return self._handle_feedback(request, pk)

    def _handle_feedback(self, request, pk):
        user = request.user
        deferral = get_object_or_404(
            ThesisDeferralRequest.objects.select_related("project__supervisor__user", "student__user"),
            pk=pk,
        )

        is_admin = _is_admin_or_superuser(user)
        if getattr(user, "user_type", "") == "student" and not is_admin:
            return Response({"detail": "Sinh viên không thể gửi góp ý GVHD."}, status=status.HTTP_403_FORBIDDEN)

        owner = getattr(deferral.project, "supervisor", None)
        if not is_admin and (owner is None or owner.user_id != user.id):
            return Response(
                {"detail": "Bạn chỉ được góp ý đơn bảo lưu của sinh viên do mình hướng dẫn."},
                status=status.HTTP_403_FORBIDDEN,
            )

        feedback = (
            request.data.get("supervisor_feedback")
            or request.data.get("feedback")
            or request.data.get("notes")
            or ""
        ).strip()
        if not feedback:
            return Response({"detail": "Vui lòng nhập nội dung góp ý của GVHD."}, status=status.HTTP_400_BAD_REQUEST)

        deferral.supervisor_feedback = feedback
        deferral.supervisor_reviewed_at = timezone.now()
        deferral.save(update_fields=["supervisor_feedback", "supervisor_reviewed_at"])

        try:
            if deferral.student and deferral.student.user_id:
                Notification.objects.create(
                    user=deferral.student.user,
                    notification_type="general",
                    title="[GVHD góp ý đơn bảo lưu]",
                    message=f"GVHD đã gửi ý kiến nhận xét về đơn bảo lưu của bạn: {feedback}",
                    action_url="/student/dashboard?tab=utc_graduation",
                )
        except Exception:
            pass

        AuditLog.objects.create(
            user=user,
            action_type="group_status_change",
            description=f"GVHD góp ý đơn bảo lưu #{deferral.id} cho SV {deferral.student.registration_no}: {feedback}",
        )
        return Response(
            {
                "success": True,
                "message": "Đã lưu ý kiến góp ý của GVHD.",
                "deferral": ThesisDeferralRequestSerializer(deferral).data,
            },
            status=status.HTTP_200_OK,
        )


class AdminCreateDeferralAPIView(APIView):
    """Khoa/Admin lập đơn bảo lưu hộ sinh viên (đồng bộ từ cổng Quản lý/Giảng viên)."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not _is_admin_or_superuser(request.user):
            return Response({"detail": "Chỉ Khoa/Quản trị viên mới có quyền lập đơn bảo lưu hộ."}, status=status.HTTP_403_FORBIDDEN)

        project_id = request.data.get("project_id")
        student_id = request.data.get("student_id")
        reason = (request.data.get("reason") or request.data.get("reason_details") or "").strip()
        admin_notes = (request.data.get("admin_notes") or "").strip()
        auto_approve = request.data.get("auto_approve", False)
        if isinstance(auto_approve, str):
            auto_approve = auto_approve.lower() in ("true", "1", "yes")

        if not reason:
            return Response({"detail": "Vui lòng nhập lý do bảo lưu."}, status=status.HTTP_400_BAD_REQUEST)

        project = GraduationProject.objects.filter(pk=project_id).first() if project_id else None
        student = project.student if project else (
            Student.objects.filter(Q(pk=student_id) | Q(user_id=student_id)).first() if student_id else None
        )
        if not student:
            return Response({"detail": "Không tìm thấy sinh viên."}, status=status.HTTP_404_NOT_FOUND)
        if not project:
            project = GraduationProject.objects.filter(student=student).first()
        if not project:
            batch = student.academic_batch or AcademicBatch.get_active_batch()
            if not batch:
                return Response({"detail": "Chưa có đợt đồ án hợp lệ."}, status=status.HTTP_400_BAD_REQUEST)
            sup_field = GraduationProject._meta.get_field("supervisor")
            supervisor = (
                Supervisor.objects.filter(pk=request.data.get("supervisor_id")).first()
                if request.data.get("supervisor_id")
                else None
            )
            if not sup_field.null and supervisor is None:
                return Response(
                    {"detail": "Sinh viên chưa có đồ án hoặc GVHD. Vui lòng phân công GVHD trước khi lập đơn bảo lưu."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            project = GraduationProject.objects.create(
                student=student, batch=batch, supervisor=supervisor, status="ALLOCATED"
            )

        with transaction.atomic():
            req_status = "APPROVED" if auto_approve else "PENDING"
            deferral = ThesisDeferralRequest.objects.create(
                project=project,
                student=student,
                reason=reason,
                admin_notes=admin_notes,
                status=req_status,
                created_by_admin=True,
                reviewed_by=request.user if auto_approve else None,
                reviewed_at=timezone.now() if auto_approve else None,
            )
            if auto_approve:
                project.deferral_status = "APPROVED"
                project.status = "DEFERRED"
                project.deferral_reason = reason
                project.deferral_decided_at = timezone.now()
                project.is_eligible_for_defense = False
                project.save(
                    update_fields=[
                        "deferral_status",
                        "status",
                        "deferral_reason",
                        "deferral_decided_at",
                        "is_eligible_for_defense",
                    ]
                )

        AuditLog.objects.create(
            user=request.user,
            action_type="group_status_change",
            description=f"Khoa lập đơn bảo lưu hộ SV {student.registration_no} (auto_approve={auto_approve}).",
        )
        return Response(
            {
                "success": True,
                "message": "Đã lập đơn bảo lưu hộ sinh viên thành công.",
                "deferral": ThesisDeferralRequestSerializer(deferral).data,
            },
            status=status.HTTP_201_CREATED,
        )


def _serialize_project_minutes_signatures(council, all_members, sig_map):
    total_members = len(all_members)
    signed_count = len(sig_map)
    return {
        "signed_count": signed_count,
        "total_members": total_members,
        "is_fully_signed": total_members > 0 and signed_count >= total_members,
        "members": [
            {
                "member_id": m.id,
                "user_id": m.user_id,
                "name": m.user.get_full_name() or m.user.username,
                "role": m.get_role_display(),
                "role_code": m.role,
                "signed": m.id in sig_map,
                "signed_at": sig_map[m.id].signed_at if m.id in sig_map else None,
                "note": sig_map[m.id].note if m.id in sig_map else "",
            }
            for m in all_members
        ],
    }


class DefenseMinutesSignAPIView(APIView):
    """Thành viên Hội đồng ký xác nhận Biên bản bảo vệ (đủ 5 chữ ký theo quy chế)."""
    permission_classes = [IsAuthenticated]

    def get(self, request, council_id):
        council = get_object_or_404(DefenseCouncil, pk=council_id)
        is_member = CouncilMember.objects.filter(council=council, user=request.user).exists()
        if not is_member and not _is_admin_or_superuser(request.user):
            return Response(
                {"detail": "Chỉ thành viên của Hội đồng hoặc Khoa mới được xem chữ ký biên bản."},
                status=status.HTTP_403_FORBIDDEN,
            )

        all_members = list(council.members.select_related("user").all())
        project_id = request.query_params.get("project_id")
        projects_qs = council.projects.select_related("student__user").all()
        if project_id:
            projects_qs = projects_qs.filter(pk=project_id)
        projects_list = list(projects_qs)

        sigs = DefenseMinutesSignature.objects.filter(council=council).select_related("member__user")
        sig_by_proj = {}
        for s in sigs:
            sig_by_proj.setdefault(s.project_id, {})[s.member_id] = s

        result = {}
        for p in projects_list:
            summary = _serialize_project_minutes_signatures(council, all_members, sig_by_proj.get(p.id, {}))
            result[str(p.id)] = summary
        return Response(
            {
                "council_id": council.id,
                "council_name": council.council_name,
                "by_project": result,
            },
            status=status.HTTP_200_OK,
        )

    def post(self, request, council_id):
        council = get_object_or_404(DefenseCouncil, pk=council_id)
        member = CouncilMember.objects.filter(council=council, user=request.user).first()
        if not member:
            return Response(
                {"detail": "Chỉ thành viên trực tiếp thuộc Hội đồng này mới có thể ký xác nhận biên bản."},
                status=status.HTTP_403_FORBIDDEN,
            )

        project_id = request.data.get("project_id")
        if not project_id:
            return Response({"detail": "project_id là bắt buộc."}, status=status.HTTP_400_BAD_REQUEST)

        project = get_object_or_404(GraduationProject, pk=project_id, council=council)
        note = str(request.data.get("note") or "").strip()

        sig, created = DefenseMinutesSignature.objects.update_or_create(
            project=project,
            member=member,
            defaults={
                "council": council,
                "signed_by": request.user,
                "note": note,
            },
        )

        all_members = list(council.members.select_related("user").all())
        sig_map = {
            s.member_id: s
            for s in DefenseMinutesSignature.objects.filter(council=council, project=project)
        }
        summary = _serialize_project_minutes_signatures(council, all_members, sig_map)
        summary["signed_by_me"] = True

        AuditLog.objects.create(
            user=request.user,
            action_type="evaluation_update",
            description=(
                f"{member.get_role_display()} {request.user.get_full_name() or request.user.username} "
                f"ký biên bản bảo vệ cho SV {project.student.registration_no if project.student_id else project.id} "
                f"({summary['signed_count']}/{summary['total_members']})."
            ),
        )
        return Response(
            {
                "success": True,
                "message": (
                    f"Đã ký xác nhận biên bản ({summary['signed_count']}/{summary['total_members']} thành viên)."
                ),
                "minutes_signatures": summary,
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class RoleHomeSummaryAPIView(APIView):
    """Tổng quan việc cần làm ngay, đếm ngược deadline & cảnh báo rủi ro SV theo vai trò."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        batch = _resolve_user_batch(request)
        today = timezone.localdate()

        from app.utils.batch_progress import DB_STAGE_TO_NUMBER, select_current_milestone

        milestones = []
        current_milestone = None
        is_batch_closed = bool(batch and (batch.is_closed or batch.current_stage == "COMPLETED"))
        if batch:
            ms_qs = BatchMilestone.objects.filter(batch=batch, is_active=True).order_by("order_index", "start_date", "id")
            milestones = BatchMilestoneSerializer(ms_qs, many=True).data
            current_stage_num = DB_STAGE_TO_NUMBER.get(batch.current_stage, 1)
            current_milestone = select_current_milestone(
                milestones,
                current_number=current_stage_num,
                is_closed=is_batch_closed,
            )

        batch_payload = (
            {
                "id": batch.id,
                "batch_code": batch.batch_code,
                "batch_name": batch.batch_name,
                "current_stage": batch.current_stage,
                "supplementary_open": bool(getattr(batch, "supplementary_open", False)),
                "days_left": (batch.end_date - today).days if getattr(batch, "end_date", None) else None,
            }
            if batch
            else None
        )

        # 1. STUDENT ROLE HOME SUMMARY
        if getattr(user, "user_type", "") == "student":
            student = getattr(user, "student_profile", None)
            if not student:
                milestone_todos = _build_milestone_todos(
                    current_milestone, is_closed=is_batch_closed, user_stage_number=None, role="student"
                )
                return Response({
                    "role": "student",
                    "batch": batch_payload,
                    "current_milestone": current_milestone,
                    "todos": milestone_todos,
                })

            project = GraduationProject.objects.filter(student=student).select_related("supervisor__user", "outline_review").first()
            tasks = list(SupervisionTask.objects.filter(project=project)) if project else []
            pending_tasks = [t for t in tasks if not t.is_completed]
            overdue_tasks = [t for t in pending_tasks if t.due_date and t.due_date < today]
            weekly_count = WeeklyProgressReport.objects.filter(project=project).count() if project else 0
            logs_count = SupervisionMeetingLog.objects.filter(project=project).count() if project else 0
            has_pref = StudentPreference.objects.filter(student=student).exists() or InternshipInfo.objects.filter(student=student).exists()

            from app.workflow_stages import compute_project_progress
            student_stage_num = (
                compute_project_progress(project, batch)["current_stage_number"]
                if (project and batch and getattr(project, "batch_id", None) == batch.id)
                else None
            )
            todos = _build_milestone_todos(
                current_milestone,
                is_closed=is_batch_closed,
                user_stage_number=student_stage_num,
                role="student",
            )
            if batch and getattr(batch, "supplementary_open", False) and (not project or not project.supervisor_id):
                todos.append({
                    "urgency": "high",
                    "title": "Đăng ký nguyện vọng GVHD bổ sung",
                    "description": "Khoa đang mở đăng ký bổ sung. Hãy gửi/cập nhật NV1-NV3 ngay.",
                    "action_url": "/student/dashboard?tab=utc_graduation&subtab=survey",
                })
            elif batch and batch.current_stage == "PHASE_2_ALLOCATING" and not has_pref:
                todos.append({
                    "urgency": "high",
                    "title": "Chưa nộp phiếu khảo sát & nguyện vọng",
                    "description": "Giai đoạn 2 đang mở, hãy chọn chuyên ngành và GVHD nguyện vọng.",
                    "action_url": "/student/dashboard?tab=utc_graduation&subtab=survey",
                })

            if project:
                if project.topic_review_status in ("DRAFT", "REVISION_REQUIRED") and project.status not in ("DEFERRED", "DISQUALIFIED", "FAILED"):
                    todos.append({
                        "urgency": "high" if project.topic_review_status == "REVISION_REQUIRED" else "medium",
                        "title": "Hoàn thiện & Nộp Đề cương ĐATN" if project.topic_review_status == "DRAFT" else "Chỉnh sửa Đề cương theo góp ý",
                        "description": f"Trạng thái đề cương hiện tại: {project.topic_review_status}.",
                        "action_url": "/student/dashboard?tab=utc_graduation&subtab=outline",
                    })
                if overdue_tasks:
                    todos.append({
                        "urgency": "high",
                        "title": f"Có {len(overdue_tasks)} nhiệm vụ quá hạn",
                        "description": f"Nhiệm vụ sớm nhất quá hạn: {overdue_tasks[0].title} ({overdue_tasks[0].due_date}).",
                        "action_url": "/student/dashboard?tab=utc_graduation&subtab=supervision",
                    })
                elif pending_tasks:
                    todos.append({
                        "urgency": "medium",
                        "title": f"{len(pending_tasks)} nhiệm vụ đồ án đang chờ hoàn thành",
                        "description": f"Tiếp theo: {pending_tasks[0].title}.",
                        "action_url": "/student/dashboard?tab=utc_graduation&subtab=supervision",
                    })
                if project.status == "IN_PROGRESS" and weekly_count == 0:
                    todos.append({
                        "urgency": "medium",
                        "title": "Nộp báo cáo tiến độ tuần đầu tiên",
                        "description": "Bạn chưa có báo cáo tiến độ tuần nào trong Giai đoạn thực hiện.",
                        "action_url": "/student/dashboard?tab=utc_graduation&subtab=weekly",
                    })

            return Response(
                {
                    "role": "student",
                    "batch": batch_payload,
                    "current_milestone": current_milestone,
                    "todos": todos,
                    "stats": {
                        "total_tasks": len(tasks),
                        "pending_tasks": len(pending_tasks),
                        "overdue_tasks": len(overdue_tasks),
                        "weekly_reports_count": weekly_count,
                        "meeting_logs_count": logs_count,
                    },
                },
                status=status.HTTP_200_OK,
            )

        # 2. SUPERVISOR / STAFF HOME SUMMARY WITH AT_RISK ALERTS
        supervisor = getattr(user, "supervisor_profile", None)
        projects_qs = GraduationProject.objects.select_related(
            "student__user", "outline_review", "batch"
        )
        if batch:
            projects_qs = projects_qs.filter(batch=batch)
        if supervisor:
            projects_qs = projects_qs.filter(supervisor=supervisor)
        projects_list = list(projects_qs)
        proj_ids = [p.id for p in projects_list]

        all_tasks = list(SupervisionTask.objects.filter(project_id__in=proj_ids)) if proj_ids else []
        all_reports = list(WeeklyProgressReport.objects.filter(project_id__in=proj_ids)) if proj_ids else []
        all_logs = list(SupervisionMeetingLog.objects.filter(project_id__in=proj_ids)) if proj_ids else []
        pending_deferrals_cnt = (
            ThesisDeferralRequest.objects.filter(project_id__in=proj_ids, status="PENDING", supervisor_feedback="")
            .count()
            if proj_ids
            else 0
        )

        tasks_by_proj = {}
        for t in all_tasks:
            tasks_by_proj.setdefault(t.project_id, []).append(t)
        reports_by_proj = {}
        for r in all_reports:
            reports_by_proj.setdefault(r.project_id, []).append(r)
        logs_by_proj = {}
        for lg in all_logs:
            logs_by_proj.setdefault(lg.project_id, []).append(lg)

        risk_alerts = []
        at_risk_cnt = 0
        behind_cnt = 0
        on_track_cnt = 0
        pending_outlines_cnt = 0
        unreviewed_reports_cnt = sum(1 for r in all_reports if r.supervisor_rating == "PENDING")
        pending_task_reviews_cnt = sum(
            1 for t in all_tasks if (t.deliverable_file or t.deliverable_url) and t.review_verdict == "PENDING"
        )

        for p in projects_list:
            if p.status in ("DEFERRED", "DISQUALIFIED", "FAILED", "PASSED"):
                continue
            outline = getattr(p, "outline_review", None)
            if p.status == "OUTLINE_PENDING" or (outline and outline.verdict == "PENDING"):
                pending_outlines_cnt += 1

            p_tasks = tasks_by_proj.get(p.id, [])
            p_reports = reports_by_proj.get(p.id, [])
            p_logs = logs_by_proj.get(p.id, [])
            overdue = [t for t in p_tasks if not t.is_completed and t.due_date and t.due_date < today]

            reasons = []
            risk_level = "ON_TRACK"
            if overdue:
                reasons.append(f"{len(overdue)} task quá hạn")
            if p.topic_review_status == "REVISION_REQUIRED":
                reasons.append("Đề tài/Đề cương cần chỉnh sửa")
            if p.initial_eligibility == "INELIGIBLE":
                reasons.append("Chưa đủ điều kiện học vụ ban đầu")
            now_ts = timezone.now()
            stage5_elapsed = None
            stage5_ms = next((m for m in milestones if m.get("stage_number") == 5 and m.get("start_date") and m.get("end_date")), None)
            if stage5_ms:
                try:
                    s5_start = timezone.datetime.fromisoformat(stage5_ms["start_date"])
                    s5_end = timezone.datetime.fromisoformat(stage5_ms["end_date"])
                    if s5_end > s5_start:
                        stage5_elapsed = min(1.0, max(0.0, (now_ts - s5_start).total_seconds() / (s5_end - s5_start).total_seconds()))
                except Exception:
                    stage5_elapsed = None

            task_done_ratio = (
                sum(1 for t in p_tasks if t.is_completed) / len(p_tasks)
                if p_tasks else None
            )
            zero_activity_late = (
                p.status == "IN_PROGRESS"
                and len(p_reports) == 0
                and len(p_logs) == 0
                and (stage5_elapsed is None or stage5_elapsed >= 0.30)
            )
            if zero_activity_late:
                reasons.append("Chưa có báo cáo tuần & nhật ký HD")

            elapsed_pct_label = int(round(stage5_elapsed * 100)) if stage5_elapsed is not None else None
            milestone_at_risk = (
                stage5_elapsed is not None
                and stage5_elapsed >= 0.65
                and p.status == "IN_PROGRESS"
                and (len(p_reports) == 0 or (task_done_ratio is not None and task_done_ratio < 0.35))
            )
            milestone_behind = (
                stage5_elapsed is not None
                and stage5_elapsed >= 0.25
                and p.status == "IN_PROGRESS"
                and (
                    len(p_reports) < max(1, round(stage5_elapsed * 4))
                    or (task_done_ratio is not None and task_done_ratio < stage5_elapsed * 0.5)
                )
            )
            fallback_behind = stage5_elapsed is None and p.status == "IN_PROGRESS" and len(p_reports) < 2

            if overdue or p.initial_eligibility == "INELIGIBLE" or zero_activity_late or milestone_at_risk:
                risk_level = "AT_RISK"
                if milestone_at_risk and not reasons:
                    reasons.append(f"Đã qua {elapsed_pct_label}% thời gian GĐ5 nhưng tiến độ thực hiện rất thấp")
                at_risk_cnt += 1
            elif p.topic_review_status == "REVISION_REQUIRED" or milestone_behind or fallback_behind:
                risk_level = "BEHIND"
                if not reasons:
                    if milestone_behind and elapsed_pct_label is not None:
                        reasons.append(f"Chậm nhịp mốc GĐ5 ({elapsed_pct_label}% thời gian đã trôi qua)")
                    else:
                        reasons.append("Tiến độ báo cáo tuần còn ít")
                behind_cnt += 1
            else:
                on_track_cnt += 1

            if risk_level in ("AT_RISK", "BEHIND") and p.student:
                risk_alerts.append({
                    "project_id": p.id,
                    "student_reg_no": p.student.registration_no,
                    "student_name": p.student.user.get_full_name() or p.student.user.username,
                    "risk_level": risk_level,
                    "reasons": reasons,
                    "status": p.status,
                })

        sup_todos = _build_milestone_todos(
            current_milestone,
            is_closed=is_batch_closed,
            user_stage_number=None,
            role="supervisor",
        )
        if pending_outlines_cnt > 0:
            sup_todos.append({
                "urgency": "high",
                "title": f"{pending_outlines_cnt} đề cương đang chờ GVHD duyệt",
                "description": "Sinh viên đã nộp đề cương và chờ xác nhận để sang GĐ 4.",
                "action_url": "/supervisor/dashboard?tab=outline_reviews",
            })
        if pending_task_reviews_cnt > 0:
            sup_todos.append({
                "urgency": "high",
                "title": f"{pending_task_reviews_cnt} sản phẩm nhiệm vụ chờ nghiệm thu",
                "description": "Sinh viên đã nộp file/link sản phẩm trên Task Board.",
                "action_url": "/supervisor/dashboard?tab=stage5_supervision",
            })
        if unreviewed_reports_cnt > 0:
            sup_todos.append({
                "urgency": "medium",
                "title": f"{unreviewed_reports_cnt} báo cáo tuần chưa nhận xét",
                "description": "Đánh giá báo cáo tuần giúp cập nhật trạng thái tiến độ của sinh viên.",
                "action_url": "/supervisor/dashboard?tab=weekly_reports",
            })
        if pending_deferrals_cnt > 0:
            sup_todos.append({
                "urgency": "medium",
                "title": f"{pending_deferrals_cnt} đơn xin bảo lưu cần góp ý GVHD",
                "description": "Khoa cần ý kiến xác nhận từ GVHD trước khi duyệt đơn bảo lưu.",
                "action_url": "/supervisor/dashboard?tab=deferrals",
            })

        return Response(
            {
                "role": getattr(user, "user_type", "supervisor"),
                "batch": batch_payload,
                "current_milestone": current_milestone,
                "todos": sup_todos,
                "student_risk_alerts": sorted(risk_alerts, key=lambda x: 0 if x["risk_level"] == "AT_RISK" else 1),
                "risk_summary": {
                    "at_risk": at_risk_cnt,
                    "behind": behind_cnt,
                    "on_track": on_track_cnt,
                    "total_active": at_risk_cnt + behind_cnt + on_track_cnt,
                },
            },
            status=status.HTTP_200_OK,
        )
