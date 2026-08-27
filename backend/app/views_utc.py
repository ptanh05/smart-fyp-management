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

from app.models import (
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
    DefenseCouncil,
    CouncilMember,
    CouncilLiveScore,
    EvaluationPolicy,
    FinalGradeSummary,
    AcademicBatch,
    AuditLog
)
from app.serializers.utc_graduation_serializers import (
    ProjectTopicAreaSerializer,
    SupervisorBriefSerializer,
    InternshipInfoSerializer,
    OutlineReviewSerializer,
    WeeklyProgressReportSerializer,
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
                "id": batch.id if batch else None,
                "batch_code": batch.batch_code if batch else "",
                "batch_name": batch.batch_name if batch else ""
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

        return Response({
            "message": f"Đã cập nhật kết quả duyệt đề cương: {review.get_verdict_display()}",
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
        projects = GraduationProject.objects.filter(council=council).select_related(
            "student__user",
            "supervisor__user",
            "reviewer__user",
            "final_grade_summary"
        ).order_by("student__user__last_name")

        # Get scores submitted by this member
        member_scores = {s.project_id: s for s in CouncilLiveScore.objects.filter(member=council_member)}

        projects_data = []
        for p in projects:
            p_data = GraduationProjectDetailSerializer(p).data
            my_score = member_scores.get(p.id)
            p_data["my_score"] = CouncilLiveScoreSerializer(my_score).data if my_score else None
            projects_data.append(p_data)

        return Response({
            "council": {
                "id": council.id,
                "council_number": council.council_number,
                "council_name": council.council_name,
                "session_date": council.session_date,
                "session_time": council.get_session_time_display(),
                "defense_room": council.defense_room,
                "my_role": council_member.get_role_display()
            },
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
        if council_member.supervisor and project.supervisor_id == council_member.supervisor_id:
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

        return Response({
            "message": f"Đã chấm điểm thành công cho SV {project.student.registration_no}: {live_score.total_score}đ (Điểm TB HĐ: {summary.council_avg_score}đ - Tổng kết: {summary.final_score_10}đ)",
            "live_score": CouncilLiveScoreSerializer(live_score).data,
            "final_grade": FinalGradeSummarySerializer(summary).data
        }, status=status.HTTP_200_OK)
