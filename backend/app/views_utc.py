import logging
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.http import HttpResponse
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from .models import (
    CustomUser,
    Student,
    Supervisor,
    SupervisorQuota,
    ProjectTopicArea,
    InternshipInfo,
    GraduationProject,
    OutlineReviewGroup,
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
    SupervisorOfStudentGroup,
)
from .services import NotificationService, CouncilConflictService
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
)
from .validators import validate_uploaded_file
from .concurrency import retry_on_db_lock

logger = logging.getLogger(__name__)


# ==============================================================================
# STUDENT SURVEY & ONBOARDING API
# ==============================================================================

class StudentSurveyAPIView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        user = request.user
        if user.user_type != "student":
            return Response({"detail": "Chỉ dành cho tài khoản sinh viên."}, status=status.HTTP_403_FORBIDDEN)

        student = getattr(user, "student_profile", None)
        if not student:
            return Response({"detail": "Hồ sơ sinh viên không tồn tại."}, status=status.HTTP_404_NOT_FOUND)

        batch = student.academic_batch or AcademicBatch.objects.filter(is_active=True).first()
        topic_areas = ProjectTopicArea.objects.filter(is_active=True)
        supervisors = Supervisor.objects.all().select_related("user").order_by("user__first_name")

        survey = InternshipInfo.objects.filter(student=student).first()
        survey_data = InternshipInfoSerializer(survey).data if survey else None

        return Response({
            "student": {
                "id": student.id,
                "registration_no": student.registration_no,
                "full_name": user.get_full_name() or user.username,
                "email": user.email,
                "phone_number": student.phone_number,
                "department": student.department,
                "course_class": student.course_class.class_name if student.course_class else ""
            },
            "batch": {
                "id": getattr(batch, "id", None) if batch else None,
                "batch_code": getattr(batch, "batch_code", "") if batch else "",
                "batch_name": getattr(batch, "batch_name", "") if batch else ""
            },
            "topic_areas": ProjectTopicAreaSerializer(topic_areas, many=True).data,
            "supervisors": SupervisorBriefSerializer(supervisors, many=True).data,
            "survey": survey_data
        }, status=status.HTTP_200_OK)

    def post(self, request):
        user = request.user
        if user.user_type != "student":
            return Response({"detail": "Chỉ dành cho tài khoản sinh viên."}, status=status.HTTP_403_FORBIDDEN)

        student = getattr(user, "student_profile", None)
        if not student:
            return Response({"detail": "Hồ sơ sinh viên không tồn tại."}, status=status.HTTP_404_NOT_FOUND)

        batch = student.academic_batch or AcademicBatch.objects.filter(is_active=True).first()
        if not batch:
            return Response({"detail": "Không có đợt làm đồ án nào đang hoạt động."}, status=status.HTTP_400_BAD_REQUEST)

        data = request.data
        is_interning = str(data.get("is_interning", "false")).lower() in ["true", "1"]
        company_name = data.get("company_name", "").strip()
        topic_direction_id = data.get("topic_direction")
        preferred_supervisor_id = data.get("preferred_supervisor")
        tentative_title = data.get("tentative_title", "").strip()
        phone_number = data.get("phone_number", "").strip()
        email = data.get("email", "").strip()
        new_password = data.get("new_password", "").strip()

        # Validation
        if is_interning and not company_name:
            return Response({"company_name": ["Vui lòng nhập tên công ty/doanh nghiệp đang thực tập."]}, status=status.HTTP_400_BAD_REQUEST)

        topic_direction = ProjectTopicArea.objects.filter(id=topic_direction_id).first() if topic_direction_id else None
        preferred_supervisor = Supervisor.objects.filter(id=preferred_supervisor_id).first() if preferred_supervisor_id else None

        with transaction.atomic():
            # Update student profile
            if phone_number:
                student.phone_number = phone_number
                student.save(update_fields=["phone_number"])

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
                    "preferred_supervisor": preferred_supervisor,
                    "tentative_title": tentative_title
                }
            )

        return Response({
            "message": "Cập nhật khảo sát và nguyện vọng thành công!",
            "survey": InternshipInfoSerializer(survey).data
        }, status=status.HTTP_200_OK)


# ==============================================================================
# GRADUATION PROJECT & OUTLINE WORKFLOW
# ==============================================================================

class StudentGraduationProjectAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        student = getattr(user, "student_profile", None)
        if not student:
            return Response({"detail": "Hồ sơ sinh viên không tồn tại."}, status=status.HTTP_404_NOT_FOUND)

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
                "message": "Bạn chưa được phân công Đề tài và Giảng viên hướng dẫn."
            }, status=status.HTTP_200_OK)

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
            return Response({"detail": "Hồ sơ sinh viên không tồn tại."}, status=status.HTTP_404_NOT_FOUND)

        project = GraduationProject.objects.filter(student=student).first()
        if not project:
            return Response({"detail": "Chưa được phân công đề tài."}, status=status.HTTP_400_BAD_REQUEST)

        topic_title_vi = request.data.get("topic_title_vi", "").strip()
        topic_title_en = request.data.get("topic_title_en", "").strip()
        outline_file = request.FILES.get("outline_file")

        if not topic_title_vi:
            return Response({"topic_title_vi": ["Vui lòng nhập tên đề tài tiếng Việt."]}, status=status.HTTP_400_BAD_REQUEST)

        # Check for duplicated topic names
        from .models import SupervisorOfStudentGroup
        is_duplicated = (
            GraduationProject.objects.filter(topic_title_vi__iexact=topic_title_vi, status="PASSED").exclude(id=project.id).exists() or
            SupervisorOfStudentGroup.objects.filter(project__project_name__iexact=topic_title_vi, status="accepted").exists()
        )
        if is_duplicated:
            return Response({"topic_title_vi": ["Tên đề tài đã trùng lặp với đề tài đã được nghiệm thu từ các năm trước."]}, status=status.HTTP_400_BAD_REQUEST)

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
            "message": "Nộp đề cương thành công, đang chờ Giảng viên xét duyệt!",
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
            return Response({"detail": "Hồ sơ sinh viên không tồn tại."}, status=status.HTTP_404_NOT_FOUND)

        project = GraduationProject.objects.filter(student=student).first()
        if not project:
            return Response({"detail": "Chưa có đồ án."}, status=status.HTTP_400_BAD_REQUEST)

        reports = WeeklyProgressReport.objects.filter(project=project).order_by("week_number")
        return Response(WeeklyProgressReportSerializer(reports, many=True).data, status=status.HTTP_200_OK)

    @retry_on_db_lock(max_retries=5, initial_delay=0.05, backoff_factor=1.5)
    def post(self, request):
        user = request.user
        student = getattr(user, "student_profile", None)
        if not student:
            return Response({"detail": "Hồ sơ sinh viên không tồn tại."}, status=status.HTTP_404_NOT_FOUND)

        project = GraduationProject.objects.filter(student=student).first()
        if not project:
            return Response({"detail": "Chưa có đồ án."}, status=status.HTTP_400_BAD_REQUEST)

        week_number = request.data.get("week_number")
        summary_content = request.data.get("summary_content", "").strip()
        planned_tasks = request.data.get("planned_tasks", "").strip()
        git_commit_link = request.data.get("git_commit_link", "").strip()
        attached_file = request.FILES.get("attached_file")

        try:
            week_num = int(week_number)
            if week_num < 1 or week_num > 15:
                return Response({"week_number": ["Tuần báo cáo phải từ 1 đến 15."]}, status=status.HTTP_400_BAD_REQUEST)
        except (ValueError, TypeError):
            return Response({"week_number": ["Tuần báo cáo không hợp lệ."]}, status=status.HTTP_400_BAD_REQUEST)

        if not summary_content:
            return Response({"summary_content": ["Vui lòng nhập nội dung tóm tắt kết quả công việc trong tuần."]}, status=status.HTTP_400_BAD_REQUEST)

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
            "message": f"Nộp báo cáo tuần {week_num} thành công!",
            "report": WeeklyProgressReportSerializer(report).data
        }, status=status.HTTP_200_OK)


# ==============================================================================
# STUDENT SUPERVISION LOGS & TASK BOARD APIS
# ==============================================================================

class StudentSupervisionLogsAPIView(APIView):
    """Sinh viên xem danh sách nhật ký các buổi gặp / làm việc từ GVHD"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        student = getattr(user, "student_profile", None)
        if not student:
            return Response({"detail": "Hồ sơ sinh viên không tồn tại."}, status=status.HTTP_404_NOT_FOUND)

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
    """Sinh viên xem danh sách công việc được giao và tiến độ tổng quan"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        student = getattr(user, "student_profile", None)
        if not student:
            return Response({"detail": "Hồ sơ sinh viên không tồn tại."}, status=status.HTTP_404_NOT_FOUND)

        project = GraduationProject.objects.filter(student=student).first()
        if not project:
            return Response({"detail": "Chưa được phân công đề tài."}, status=status.HTTP_400_BAD_REQUEST)

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
    """Sinh viên đánh dấu hoàn thành nhiệm vụ (hoặc bỏ chọn) kèm ghi chú kết quả"""
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        user = request.user
        student = getattr(user, "student_profile", None)
        if not student:
            return Response({"detail": "Hồ sơ sinh viên không tồn tại."}, status=status.HTTP_404_NOT_FOUND)

        project = GraduationProject.objects.filter(student=student).first()
        if not project:
            return Response({"detail": "Chưa được phân công đề tài."}, status=status.HTTP_400_BAD_REQUEST)

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
        if is_completed:
            task.status = "COMPLETED"
            task.completed_at = timezone.now()
        else:
            task.status = "IN_PROGRESS"
            task.completed_at = None
        task.save()

        try:
            status_text = "đã hoàn thành" if is_completed else "đang thực hiện lại"
            NotificationService.create_notification(
                user=project.supervisor.user,
                notification_type="general",
                title=f"[Tiến độ nhiệm vụ] SV {student.user.get_full_name()}",
                message=f"Sinh viên {student.user.get_full_name()} ({student.registration_no}) {status_text} nhiệm vụ: '{task.title}'.",
            )
        except Exception as e:
            logger.warning("Could not send notification for task completion: %s", e)

        all_tasks = SupervisionTask.objects.filter(project=project)
        total = all_tasks.count()
        completed = all_tasks.filter(is_completed=True).count()
        rate = round((completed / total * 100), 1) if total > 0 else 0

        return Response({
            "message": f"Đã cập nhật trạng thái nhiệm vụ: {'Hoàn thành' if is_completed else 'Chưa hoàn thành'}",
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
            return Response({"detail": "Chỉ dành cho Giảng viên hướng dẫn."}, status=status.HTTP_403_FORBIDDEN)

        projects = GraduationProject.objects.filter(supervisor=supervisor).select_related(
            "student__user",
            "topic_category",
            "council",
            "final_grade_summary"
        ).order_by("student__user__last_name")

        return Response(GraduationProjectDetailSerializer(projects, many=True).data, status=status.HTTP_200_OK)


class SupervisorOutlineReviewAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        supervisor = getattr(user, "supervisor_profile", None)
        if not supervisor:
            return Response({"detail": "Chỉ dành cho Giảng viên."}, status=status.HTTP_403_FORBIDDEN)

        project_id = request.data.get("project_id")
        verdict = request.data.get("verdict")  # APPROVED, REVISION_REQUIRED, REJECTED
        comments = request.data.get("comments", "").strip()

        if not project_id or not verdict:
            return Response({"detail": "project_id và verdict là bắt buộc."}, status=status.HTTP_400_BAD_REQUEST)

        project = get_object_or_404(GraduationProject, id=project_id, supervisor=supervisor)
        review, _ = OutlineReview.objects.get_or_create(project=project)

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
            "message": f"Đã cập nhật kết quả duyệt đề cương: {verdict_display}",
            "project": GraduationProjectDetailSerializer(project).data
        }, status=status.HTTP_200_OK)


class SupervisorWeeklyFeedbackAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        supervisor = getattr(user, "supervisor_profile", None)
        if not supervisor:
            return Response({"detail": "Chỉ dành cho Giảng viên."}, status=status.HTTP_403_FORBIDDEN)

        report_id = request.data.get("report_id")
        rating = request.data.get("rating")  # GOOD, ACCEPTABLE, LATE, UNSATISFACTORY
        feedback = request.data.get("feedback", "").strip()

        if not report_id or not rating:
            return Response({"detail": "report_id và rating là bắt buộc."}, status=status.HTTP_400_BAD_REQUEST)

        report = get_object_or_404(WeeklyProgressReport, id=report_id, project__supervisor=supervisor)
        report.supervisor_rating = rating
        report.supervisor_feedback = feedback
        report.reviewed_at = timezone.now()
        report.save()

        return Response({
            "message": "Đã lưu nhận xét và đánh giá tuần!",
            "report": WeeklyProgressReportSerializer(report).data
        }, status=status.HTTP_200_OK)


class SupervisorDefenseEvaluationAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        supervisor = getattr(user, "supervisor_profile", None)
        if not supervisor:
            return Response({"detail": "Chỉ dành cho Giảng viên hướng dẫn."}, status=status.HTTP_403_FORBIDDEN)

        project_id = request.data.get("project_id")
        supervisor_score = request.data.get("supervisor_score")
        supervisor_feedback = request.data.get("supervisor_feedback", "").strip()
        is_eligible = request.data.get("is_eligible_for_defense", True)

        try:
            score = float(supervisor_score)
            if score < 0.0 or score > 10.0:
                return Response({"supervisor_score": ["Điểm hướng dẫn phải từ 0.0 đến 10.0"]}, status=status.HTTP_400_BAD_REQUEST)
        except (ValueError, TypeError):
            return Response({"supervisor_score": ["Điểm số không hợp lệ."]}, status=status.HTTP_400_BAD_REQUEST)

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
                project.save()

                # Update Final Grade
                summary, _ = FinalGradeSummary.objects.get_or_create(project=project)
                summary.supervisor_score = score
                policy = EvaluationPolicy.objects.filter(batch=project.batch).first()
                summary.calculate_and_save(policy=policy)
            else:
                project.save()

        msg = "Đã lưu nháp phiếu đánh giá của Giảng viên hướng dẫn! Điểm chưa công bố cho sinh viên." if is_draft else "Đã lưu và công bố phiếu đánh giá của Giảng viên hướng dẫn!"
        return Response({
            "message": msg,
            "project": GraduationProjectDetailSerializer(project).data
        }, status=status.HTTP_200_OK)


class SupervisorSupervisionLogsAPIView(APIView):
    """Giảng viên xem và tạo nhật ký làm việc / họp với sinh viên"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        supervisor = getattr(user, "supervisor_profile", None)
        if not supervisor:
            return Response({"detail": "Chỉ dành cho Giảng viên."}, status=status.HTTP_403_FORBIDDEN)

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
            return Response({"detail": "Chỉ dành cho Giảng viên."}, status=status.HTTP_403_FORBIDDEN)

        project_id = request.data.get("project_id")
        meeting_date = request.data.get("meeting_date")
        meeting_time = request.data.get("meeting_time", "09:00 - 10:30")
        meeting_type = request.data.get("meeting_type", "OFFLINE")
        location_or_link = request.data.get("location_or_link", "").strip()
        content_discussed = request.data.get("content_discussed", "").strip()
        supervisor_notes = request.data.get("supervisor_notes", "").strip()
        next_meeting_plan = request.data.get("next_meeting_plan", "").strip()

        if not project_id or not meeting_date or not content_discussed:
            return Response({"detail": "project_id, meeting_date và content_discussed là bắt buộc."}, status=status.HTTP_400_BAD_REQUEST)

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

            # Feature 5: Giao việc tuần tới kèm Deadline làm căn cứ đánh giá điểm quá trình
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
                notif_title = f"[Lịch họp trực tuyến] Cuộc hẹn từ GVHD {supervisor_name}"
                notif_msg = f"GVHD đã tạo lịch hẹn gặp trực tuyến lúc {meeting_time} ngày {meeting_date}. Link tham gia: {location_or_link}"
            else:
                notif_title = "[Nhật ký hướng dẫn] GVHD vừa ghi nhận buổi làm việc"
                notif_msg = f"GVHD {supervisor_name} đã cập nhật nhật ký buổi làm việc ngày {meeting_date}."

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
                    title=f"[Nhiệm vụ mới] {task_title}",
                    message=f"GVHD đã giao nhiệm vụ tuần tới: '{task_title}'. Hạn nộp: {created_task.due_date or 'Không có'}. (Lưu làm căn cứ đánh giá điểm quá trình)",
                    action_url="/student/dashboard",
                    send_email=True,
                )
        except Exception as e:
            logger.warning("Could not send notification for meeting log: %s", e)

        return Response({
            "message": "Đã lưu nhật ký hướng dẫn và căn cứ đánh giá điểm quá trình thành công!",
            "log": SupervisionMeetingLogSerializer(log).data
        }, status=status.HTTP_201_CREATED)


class SupervisorTasksAPIView(APIView):
    """Giảng viên xem, giao nhiệm vụ mới, sửa hoặc xóa nhiệm vụ cho sinh viên"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        supervisor = getattr(user, "supervisor_profile", None)
        if not supervisor:
            return Response({"detail": "Chỉ dành cho Giảng viên."}, status=status.HTTP_403_FORBIDDEN)

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
            return Response({"detail": "Chỉ dành cho Giảng viên."}, status=status.HTTP_403_FORBIDDEN)

        project_id = request.data.get("project_id")
        title = request.data.get("title", "").strip()
        description = request.data.get("description", "").strip()
        due_date = request.data.get("due_date") or None
        priority = request.data.get("priority", "MEDIUM")
        meeting_log_id = request.data.get("meeting_log_id")

        if not project_id or not title:
            return Response({"detail": "project_id và title là bắt buộc."}, status=status.HTTP_400_BAD_REQUEST)

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
                title="[Nhiệm vụ mới] GVHD vừa giao việc cho bạn",
                message=f"GVHD {supervisor.user.get_full_name()} đã giao nhiệm vụ: '{title}'. Hạn nộp: {due_date or 'Không'}.",
            )
        except Exception as e:
            logger.warning("Could not send notification for task creation: %s", e)

        return Response({
            "message": f"Đã giao nhiệm vụ '{title}' cho sinh viên!",
            "task": SupervisionTaskSerializer(task).data
        }, status=status.HTTP_201_CREATED)

    def patch(self, request, pk=None):
        user = request.user
        supervisor = getattr(user, "supervisor_profile", None)
        if not supervisor:
            return Response({"detail": "Chỉ dành cho Giảng viên."}, status=status.HTTP_403_FORBIDDEN)

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
            "message": "Đã cập nhật nhiệm vụ thành công!",
            "task": SupervisionTaskSerializer(task).data
        }, status=status.HTTP_200_OK)

    def delete(self, request, pk=None):
        user = request.user
        supervisor = getattr(user, "supervisor_profile", None)
        if not supervisor:
            return Response({"detail": "Chỉ dành cho Giảng viên."}, status=status.HTTP_403_FORBIDDEN)

        task_id = pk or request.query_params.get("task_id") or request.data.get("task_id")
        task = get_object_or_404(SupervisionTask, id=task_id, project__supervisor=supervisor)
        task.delete()
        return Response({"message": "Đã xóa nhiệm vụ thành công!"}, status=status.HTTP_200_OK)


# ==============================================================================
# SUPERVISOR BROADCAST ANNOUNCEMENT (Feature 2)
# ==============================================================================

class SupervisorBroadcastAnnouncementAPIView(APIView):
    """
    Giảng viên gửi tin nhắn thông báo chung cho tất cả các nhóm mình hướng dẫn:
    - Nhập tiêu đề và nội dung thông báo chung
    - Tất cả sinh viên trong các nhóm do GV hướng dẫn nhận được thông báo
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        supervisor = getattr(user, "supervisor_profile", None)
        if not supervisor:
            return Response(
                {"message": "Chỉ dành cho giảng viên hướng dẫn."},
                status=status.HTTP_403_FORBIDDEN,
            )

        title = request.data.get("title", "").strip()
        message = request.data.get("message", "").strip()

        if not title:
            return Response(
                {"message": "Tiêu đề thông báo không được để trống."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not message:
            return Response(
                {"message": "Nội dung thông báo không được để trống."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        recipient_users = set()

        # 1. From accepted supervised groups
        supervised_groups = SupervisorOfStudentGroup.objects.filter(
            supervisor=supervisor, status="accepted"
        ).select_related("group")

        for sg in supervised_groups:
            group = sg.group
            if group:
                for member in group.members.select_related("student__user").all():
                    if member.student and member.student.user:
                        recipient_users.add(member.student.user)
                if group.student_1 and group.student_1.user:
                    recipient_users.add(group.student_1.user)
                if group.student_2 and group.student_2.user:
                    recipient_users.add(group.student_2.user)

        # 2. From individual graduation projects
        grad_projects = GraduationProject.objects.filter(
            supervisor=supervisor
        ).select_related("student__user")

        for gp in grad_projects:
            if gp.student and gp.student.user:
                recipient_users.add(gp.student.user)

        if not recipient_users:
            return Response(
                {"message": "Bạn hiện chưa có sinh viên hoặc nhóm nào được phân công hướng dẫn."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        supervisor_name = supervisor.user.get_full_name() or supervisor.user.username
        full_title = f"[Thông báo GVHD {supervisor_name}] {title}"

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
                "message": f"Đã gửi thông báo chung thành công tới {len(recipient_users)} sinh viên.",
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
            return Response({"detail": "Chỉ dành cho Giảng viên phản biện."}, status=status.HTTP_403_FORBIDDEN)

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
            return Response({"detail": "Chỉ dành cho Giảng viên phản biện."}, status=status.HTTP_403_FORBIDDEN)

        project_id = request.data.get("project_id")
        reviewer_score = request.data.get("reviewer_score")
        reviewer_feedback = request.data.get("reviewer_feedback", "").strip()
        reviewer_verdict = request.data.get("reviewer_verdict", "APPROVED")
        if reviewer_verdict not in ["APPROVED", "CONDITIONAL", "REJECTED"]:
            reviewer_verdict = "APPROVED"

        try:
            score = float(reviewer_score)
            if score < 0.0 or score > 10.0:
                return Response({"reviewer_score": ["Điểm phản biện phải từ 0.0 đến 10.0"]}, status=status.HTTP_400_BAD_REQUEST)
        except (ValueError, TypeError):
            return Response({"reviewer_score": ["Điểm số không hợp lệ."]}, status=status.HTTP_400_BAD_REQUEST)

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
            "message": f"Đã lưu nhận xét và kết luận phản biện ({verdict_text})!",
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
            return Response({"detail": "Bạn không thuộc Hội đồng bảo vệ nào trong kỳ này."}, status=status.HTTP_404_NOT_FOUND)

        council = council_member.council
        all_members = list(council.members.select_related("user", "supervisor").all())

        projects = GraduationProject.objects.filter(council=council).select_related(
            "student__user",
            "supervisor__user",
            "reviewer__user",
            "final_grade_summary"
        ).order_by("student__user__last_name")

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
        for p in projects:
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
        can_lock = role_display in ["Chủ tịch hội đồng", "Ủy viên, Thư ký"] or user.is_staff
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
    permission_classes = [IsAuthenticated]

    @retry_on_db_lock(max_retries=5, initial_delay=0.05, backoff_factor=1.5)
    def post(self, request):
        user = request.user
        council_member = CouncilMember.objects.filter(user=user).first()
        if not council_member:
            return Response({"detail": "Bạn không phải thành viên Hội đồng bảo vệ."}, status=status.HTTP_403_FORBIDDEN)

        if council_member.council and getattr(council_member.council, "is_locked", False):
            return Response(
                {"detail": "Hội đồng đã khóa điểm. Toàn bộ điểm số ở trạng thái chỉ đọc (Read-only), không thể chỉnh sửa."},
                status=status.HTTP_403_FORBIDDEN
            )

        project_id = request.data.get("project_id")
        p_score = float(request.data.get("score_presentation", 0.0))
        c_score = float(request.data.get("score_content", 0.0))
        q_score = float(request.data.get("score_qa", 0.0))
        d_score = float(request.data.get("score_demo", 0.0))
        comments = request.data.get("comments", "").strip()

        # Strict checks: Supervisor cannot grade their own student in council
        project = get_object_or_404(GraduationProject, id=project_id, council=council_member.council)
        if council_member.supervisor and project.supervisor == council_member.supervisor:
            return Response({"detail": "Vi phạm quy chế: Giảng viên hướng dẫn không được chấm điểm Hội đồng cho sinh viên của mình."}, status=status.HTTP_400_BAD_REQUEST)

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
                            title="Chuyên gia ngoài đã nộp phiếu đánh giá",
                            message=f"Chuyên gia ngoài (Ủy viên ngoài trường) {ext_name} đã hoàn tất chấm điểm cho sinh viên {project.student.user.get_full_name()} ({project.student.registration_no}): {live_score.total_score}đ.",
                        )
                # Notify Student
                NotificationService.create_notification(
                    user=project.student.user,
                    notification_type="evaluation_completed",
                    title="Chuyên gia ngoài đã nộp phiếu đánh giá",
                    message=f"Chuyên gia ngoài (Ủy viên ngoài trường) {ext_name} đã nộp phiếu đánh giá bảo vệ cho đồ án của bạn: {live_score.total_score}đ.",
                )

        return Response({
            "message": f"Đã chấm điểm thành công cho SV {project.student.registration_no}: {live_score.total_score}đ (Điểm TB HĐ: {summary.council_avg_score}đ - Tổng kết: {summary.final_score_10}đ)",
            "live_score": CouncilLiveScoreSerializer(live_score).data,
            "final_grade": FinalGradeSummarySerializer(summary).data
        }, status=status.HTTP_200_OK)


class CouncilToggleLockAPIView(APIView):
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
                {"detail": "Chỉ Chủ tịch hoặc Thư ký hội đồng mới có quyền khóa hoặc mở khóa điểm."},
                status=status.HTTP_403_FORBIDDEN
            )

        council.is_locked = bool(lock)
        council.locked_at = timezone.now() if lock else None
        council.locked_by = user if lock else None
        council.save(update_fields=["is_locked", "locked_at", "locked_by"])

        action = "khóa" if lock else "mở khóa"
        return Response({
            "message": f"Đã {action} điểm hội đồng {council.council_name} thành công!",
            "is_locked": council.is_locked,
            "locked_at": council.locked_at,
            "locked_by": user.get_full_name() or user.username if lock else None
        }, status=status.HTTP_200_OK)


class CouncilChairSetDefenseStatusAPIView(APIView):
    """Chủ tịch hội đồng điều hành buổi bảo vệ: Chuyển trạng thái đồ án sang 'Đang bảo vệ' (In Progress / DEFENDING)"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        council_member = CouncilMember.objects.filter(user=user).select_related("council").first()
        if not council_member:
            return Response({"detail": "Bạn không thuộc Hội đồng bảo vệ nào."}, status=status.HTTP_403_FORBIDDEN)

        if council_member.role not in ["CHAIR", "SECRETARY"]:
            return Response({"detail": "Chỉ Chủ tịch hội đồng (hoặc Thư ký) mới có quyền điều hành trạng thái buổi bảo vệ."}, status=status.HTTP_403_FORBIDDEN)

        council = council_member.council
        project_id = request.data.get("project_id")
        defense_status = request.data.get("defense_status", "DEFENDING")  # DEFENDING, DEFENDED, WAITING

        if not project_id:
            return Response({"detail": "project_id là bắt buộc."}, status=status.HTTP_400_BAD_REQUEST)

        project = get_object_or_404(GraduationProject, id=project_id, council=council)

        with transaction.atomic():
            if defense_status == "DEFENDING":
                # If there's another project currently defending in council, mark it DEFENDED
                GraduationProject.objects.filter(council=council, defense_status="DEFENDING").exclude(id=project.id).update(defense_status="DEFENDED")

                project.defense_status = "DEFENDING"
                project.status = "DEFENDING"
                project.save()

                council.current_defending_project = project
                council.save(update_fields=["current_defending_project"])

                status_msg = f"Đã chuyển sinh viên {project.student.user.get_full_name()} ({project.student.registration_no}) sang trạng thái 'Đang bảo vệ'."
            elif defense_status == "DEFENDED":
                project.defense_status = "DEFENDED"
                project.save(update_fields=["defense_status"])

                if council.current_defending_project_id == project.id:
                    council.current_defending_project = None
                    council.save(update_fields=["current_defending_project"])

                status_msg = f"Đã hoàn tất phần bảo vệ cho sinh viên {project.student.user.get_full_name()}."
            else:  # WAITING
                project.defense_status = "WAITING"
                if project.status == "DEFENDING":
                    project.status = "DEFENSE_READY"
                project.save()

                if council.current_defending_project_id == project.id:
                    council.current_defending_project = None
                    council.save(update_fields=["current_defending_project"])

                status_msg = f"Đã đặt lại trạng thái chờ bảo vệ cho sinh viên {project.student.user.get_full_name()}."

            AuditLog.objects.create(
                user=user,
                action_type="evaluation_update",
                description=f"Hội đồng {council.council_name}: {status_msg}"
            )

        return Response({
            "message": status_msg,
            "current_defending_project_id": council.current_defending_project_id,
            "project": GraduationProjectDetailSerializer(project).data
        }, status=status.HTTP_200_OK)


class CouncilSecretaryRemindScoringAPIView(APIView):
    """Thư ký (hoặc Chủ tịch) nhắc nhở các thành viên hội đồng chưa nộp điểm bảo vệ"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        council_member = CouncilMember.objects.filter(user=user).select_related("council").first()
        if not council_member:
            return Response({"detail": "Bạn không phải thành viên Hội đồng bảo vệ."}, status=status.HTTP_403_FORBIDDEN)

        if council_member.role not in ["SECRETARY", "CHAIR"]:
            return Response({"detail": "Chỉ Thư ký hoặc Chủ tịch hội đồng mới có quyền gửi nhắc nhở nộp điểm."}, status=status.HTTP_403_FORBIDDEN)

        council = council_member.council
        project_id = request.data.get("project_id")
        if not project_id:
            if council.current_defending_project_id:
                project_id = council.current_defending_project_id
            else:
                return Response({"detail": "Vui lòng chọn đề tài/sinh viên cần nhắc nộp điểm."}, status=status.HTTP_400_BAD_REQUEST)

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
            title = f"🔔 [Hội đồng #{council.council_number}] Nhắc nhở nộp điểm bảo vệ"
            msg = (
                f"Thư ký Hội đồng {council.council_name} kính nhắc Thầy/Cô {m.user.get_full_name()} "
                f"chưa nộp điểm bảo vệ cho SV {project.student.user.get_full_name()} (MSSV: {project.student.registration_no}) "
                f"- Đề tài: '{project.topic_title_vi}'. Kính đề nghị Thầy/Cô hoàn tất chấm điểm."
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

        names_str = ", ".join(m["name"] for m in reminded_list) if reminded_list else "Không có thành viên nào chưa nộp"
        success_message = (
            f"Đã gửi thông báo nhắc nhở nộp điểm tới {len(reminded_list)} thành viên: {names_str}."
            if reminded_list
            else "Tất cả các thành viên hội đồng đã nộp đủ điểm cho sinh viên này!"
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
    API for Committee / Admin to schedule defense session for a council.
    Updates session_date, session_time, defense_room, and dispatches UTC HTML email
    notifications to students, supervisors, and council members.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, council_id):
        user = request.user
        if not (user.is_staff or getattr(user, "user_type", None) in ["admin", "committee"]):
            return Response({"detail": "Chỉ Ban chủ nhiệm hoặc Admin mới có quyền xếp lịch bảo vệ."}, status=status.HTTP_403_FORBIDDEN)

        council = get_object_or_404(DefenseCouncil, id=council_id)
        session_date = request.data.get("session_date")
        session_time = request.data.get("session_time")
        defense_room = request.data.get("defense_room", "").strip()

        if session_date:
            council.session_date = session_date
        if session_time:
            council.session_time = session_time
        if defense_room:
            council.defense_room = defense_room

        council.save()

        # Send UTC branded email notifications to all parties (students, supervisors, members)
        NotificationService.notify_defense_scheduled_emails(council)

        return Response({
            "message": f"Xếp lịch bảo vệ thành công cho Hội đồng số {council.council_number} và đã kích hoạt email thông báo nhận diện UTC!",
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
    API kiểm tra xung đột lợi ích (Conflict of Interest) trong phân công hội đồng bảo vệ.
    Hỗ trợ kiểm tra toàn bộ hội đồng trong đợt hoặc một hội đồng cụ thể.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        council_id = request.query_params.get("council_id")
        batch_id = request.query_params.get("batch_id")

        if council_id:
            try:
                council_id = int(council_id)
            except ValueError:
                return Response({"detail": "council_id phải là số nguyên."}, status=status.HTTP_400_BAD_REQUEST)

        if batch_id:
            try:
                batch_id = int(batch_id)
            except ValueError:
                return Response({"detail": "batch_id phải là số nguyên."}, status=status.HTTP_400_BAD_REQUEST)

        data = CouncilConflictService.check_council_conflicts(council_id=council_id, batch_id=batch_id)
        return Response(data, status=status.HTTP_200_OK)


class CouncilAssignProjectAPIView(APIView):
    """
    API phân công đề tài vào hội đồng bảo vệ có kiểm tra cảnh báo xung đột lợi ích.
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
            return Response({"detail": "project_id là bắt buộc."}, status=status.HTTP_400_BAD_REQUEST)

        project = get_object_or_404(
            GraduationProject.objects.select_related("student__user", "supervisor__user", "reviewer__user"),
            id=project_id
        )

        # Unassign if council_id is None or 0
        if council_id is None or council_id == "" or council_id == 0:
            old_council_name = project.council.council_name if project.council else "Không"
            project.council = None
            project.save(update_fields=["council"])

            AuditLog.objects.create(
                user=request.user,
                action_type="status_change",
                description=f"Hủy phân công đề tài {project.student.registration_no} khỏi hội đồng {old_council_name}."
            )
            return Response({
                "success": True,
                "message": f"Đã hủy phân công đề tài khỏi hội đồng.",
                "project_id": project.id,
                "council_id": None
            }, status=status.HTTP_200_OK)

        council = get_object_or_404(DefenseCouncil, id=council_id)
        conflicts = CouncilConflictService.check_project_assignment(council, project)

        if conflicts and not force:
            return Response({
                "success": False,
                "has_conflict": True,
                "conflicts_count": len(conflicts),
                "conflicts": conflicts,
                "message": f"Phát hiện {len(conflicts)} cảnh báo xung đột lợi ích (Conflict of Interest) với các thành viên trong {council.council_name}."
            }, status=status.HTTP_400_BAD_REQUEST)

        project.council = council
        project.save(update_fields=["council"])

        AuditLog.objects.create(
            user=request.user,
            action_type="status_change",
            description=f"Phân công đề tài {project.student.registration_no} vào {council.council_name}." +
                        (" (Xác nhận cưỡng chế dù có xung đột lợi ích)" if conflicts else "")
        )

        return Response({
            "success": True,
            "message": f"Đã phân công đề tài của sinh viên {project.student.user.get_full_name()} vào {council.council_name}.",
            "project_id": project.id,
            "council_id": council.id,
            "council_name": council.council_name,
            "has_conflict": len(conflicts) > 0,
            "conflicts": conflicts
        }, status=status.HTTP_200_OK)


class CouncilAssignMemberAPIView(APIView):
    """
    API thêm hoặc cập nhật thành viên vào hội đồng bảo vệ có kiểm tra cảnh báo xung đột lợi ích.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        council_id = request.data.get("council_id")
        user_id = request.data.get("user_id")
        role = request.data.get("role", "MEMBER")
        force = request.data.get("force", False)
        if isinstance(force, str):
            force = force.lower() in ("true", "1")
        else:
            force = bool(force)

        if not council_id or not user_id:
            return Response({"detail": "council_id và user_id là bắt buộc."}, status=status.HTTP_400_BAD_REQUEST)

        council = get_object_or_404(DefenseCouncil, id=council_id)
        user = get_object_or_404(CustomUser, id=user_id)
        supervisor = Supervisor.objects.filter(user=user).first()

        conflicts = CouncilConflictService.check_member_assignment(council, user, supervisor)

        if conflicts and not force:
            return Response({
                "success": False,
                "has_conflict": True,
                "conflicts_count": len(conflicts),
                "conflicts": conflicts,
                "message": f"Phát hiện {len(conflicts)} cảnh báo xung đột lợi ích (Conflict of Interest) giữa giảng viên và các đề tài trong {council.council_name}."
            }, status=status.HTTP_400_BAD_REQUEST)

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
            description=f"{'Thêm' if created else 'Cập nhật'} ủy viên {user.get_full_name()} ({member.get_role_display()}) vào {council.council_name}." +
                        (" (Xác nhận cưỡng chế dù có xung đột lợi ích)" if conflicts else "")
        )

        return Response({
            "success": True,
            "message": f"Đã phân công Thầy/Cô {user.get_full_name()} vào {council.council_name} ({member.get_role_display()}).",
            "member_id": member.id,
            "council_id": council.id,
            "role": member.role,
            "role_display": member.get_role_display(),
            "has_conflict": len(conflicts) > 0,
            "conflicts": conflicts
        }, status=status.HTTP_200_OK)


# ==============================================================================
# GLOBAL SEARCH API
# ==============================================================================

class GlobalSearchAPIView(APIView):
    """
    Thanh tìm kiếm toàn cục (Global Search) ở Top Header.
    Tìm kiếm tức thời đa đối tượng: Đề tài, Sinh viên, Giảng viên, Hội đồng, Biểu mẫu.
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
                    "type_label": "Đồ án Tốt nghiệp",
                    "icon": "🎓",
                    "title": p.topic_title_vi or p.topic_title_en,
                    "subtitle": f"SV: {s_name} ({p.student.registration_no}) • Lớp: {p.student.course_class or 'K62'}",
                    "extra_info": f"HĐ: {p.council.council_name if p.council else 'Chưa gán'} • Trạng thái: {p.get_status_display()}",
                    "action_url": f"/student/dashboard?tab=overview",
                })

            # Standard FYP Projects
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
                    "type_label": "Đề tài FYP",
                    "icon": "📁",
                    "title": p.project_name,
                    "subtitle": f"Ngôn ngữ: {p.language or 'N/A'} • Danh mục: {p.project_category.category_name if p.project_category else 'N/A'}",
                    "extra_info": p.project_description[:80] + "..." if p.project_description and len(p.project_description) > 80 else p.project_description,
                    "action_url": f"/student/dashboard?tab=project",
                })

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
                    "type_label": "Giảng viên",
                    "icon": "👨‍🏫",
                    "title": f"{s.academic_title or 'ThS/TS'}. {name}",
                    "subtitle": f"Bộ môn: {s.department_name or 'CNTT'} • Email: {s.user.email or 'N/A'}",
                    "extra_info": f"Mã GV: {s.supervisor_id}",
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
                    "type_label": "Sinh viên",
                    "icon": "👨‍🎓",
                    "title": name,
                    "subtitle": f"MSSV: {st.registration_no} • Khoa: {st.department or 'CNTT'}",
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
                    "type_label": "Hội đồng Bảo vệ",
                    "icon": "🏛️",
                    "title": f"{c.council_name} (HĐ #{c.council_number})",
                    "subtitle": f"Phòng: {c.defense_room or 'TBA'} • Ngày: {c.session_date or 'TBA'} ({c.session_time})",
                    "extra_info": f"Đợt: {c.batch.batch_code if c.batch else 'Kỳ hiện tại'}",
                    "action_url": f"/committee_member/dashboard?tab=utc_live_defense",
                })

        # 5. Documents & Templates
        if search_type in ["all", "documents"]:
            doc_reqs = DocumentRequirement.objects.filter(
                Q(title__icontains=q) |
                Q(document_type__icontains=q)
            )[:5]

            for d in doc_reqs:
                results.append({
                    "id": f"doc_{d.id}",
                    "item_id": d.id,
                    "type": "document",
                    "type_label": "Biểu mẫu / Tài liệu",
                    "icon": "📄",
                    "title": d.title,
                    "subtitle": f"Loại: {d.get_document_type_display()} • Hạn nộp: {d.deadline.strftime('%d/%m/%Y %H:%M') if d.deadline else 'Không có'}",
                    "extra_info": f"Học kỳ: {d.semester}",
                    "action_url": f"/student/dashboard?tab=documents",
                })

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

