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
    Notification
)
from .services import NotificationService
from .serializers.utc_graduation_serializers import (
    ProjectTopicAreaSerializer,
    SupervisorBriefSerializer,
    InternshipInfoSerializer,
    OutlineReviewSerializer,
    WeeklyProgressReportSerializer,
    SupervisionMeetingLogSerializer,
    SupervisionTaskSerializer,
    CouncilLiveScoreSerializer,
    FinalGradeSummarySerializer,
    GraduationProjectDetailSerializer
)

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

        # File validation
        if outline_file:
            if not outline_file.name.lower().endswith(".pdf"):
                return Response({"outline_file": ["Đề cương phải là file định dạng PDF."]}, status=status.HTTP_400_BAD_REQUEST)
            if outline_file.size > 25 * 1024 * 1024:
                return Response({"outline_file": ["Kích thước file không được vượt quá 25MB."]}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            project.topic_title_vi = topic_title_vi
            if topic_title_en:
                project.topic_title_en = topic_title_en
            project.status = "OUTLINE_PENDING"
            project.save()

            review, _ = OutlineReview.objects.get_or_create(project=project)
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

        report, _ = WeeklyProgressReport.objects.update_or_create(
            project=project,
            week_number=week_num,
            defaults={
                "summary_content": summary_content,
                "planned_tasks": planned_tasks,
                "git_commit_link": git_commit_link,
            }
        )
        if attached_file:
            report.attached_file = attached_file
            report.save(update_fields=["attached_file"])

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
            return Response({"detail": "Chưa được phân công đề tài."}, status=status.HTTP_400_BAD_REQUEST)

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

        with transaction.atomic():
            project.supervisor_score = score
            project.supervisor_feedback = supervisor_feedback
            project.is_eligible_for_defense = is_eligible
            if is_eligible:
                project.status = "DEFENSE_READY"
            project.save()

            # Update Final Grade
            summary, _ = FinalGradeSummary.objects.get_or_create(project=project)
            summary.supervisor_score = score
            policy = EvaluationPolicy.objects.filter(batch=project.batch).first()
            summary.calculate_and_save(policy=policy)

        return Response({
            "message": "Đã lưu phiếu đánh giá của Giảng viên hướng dẫn!",
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

        try:
            NotificationService.create_notification(
                user=project.student.user,
                notification_type="general",
                title="[Nhật ký hướng dẫn] GVHD vừa ghi nhận buổi làm việc",
                message=f"GVHD {supervisor.user.get_full_name()} đã cập nhật nhật ký buổi họp ngày {meeting_date}.",
            )
        except Exception as e:
            logger.warning("Could not send notification for meeting log: %s", e)

        return Response({
            "message": "Đã lưu nhật ký hướng dẫn thành công!",
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
            project.save()

            # Update Final Grade
            summary, _ = FinalGradeSummary.objects.get_or_create(project=project)
            summary.reviewer_score = score
            policy = EvaluationPolicy.objects.filter(batch=project.batch).first()
            summary.calculate_and_save(policy=policy)

        return Response({
            "message": "Đã lưu nhận xét và điểm của Giảng viên phản biện!",
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

        return Response({
            "council": {
                "id": getattr(council, "id", None),
                "council_number": council.council_number,
                "council_name": council.council_name,
                "session_date": council.session_date,
                "session_time": session_time_display,
                "defense_room": council.defense_room,
                "my_role": role_display,
                "my_role_code": council_member.role,
                "current_defending_project_id": council.current_defending_project_id,
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

    def post(self, request):
        user = request.user
        council_member = CouncilMember.objects.filter(user=user).first()
        if not council_member:
            return Response({"detail": "Bạn không phải thành viên Hội đồng bảo vệ."}, status=status.HTTP_403_FORBIDDEN)

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
            summary, _ = FinalGradeSummary.objects.get_or_create(project=project)
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
