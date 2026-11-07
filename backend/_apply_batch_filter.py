import re

file_path = "app/views_utc.py"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. SupervisorGraduationProjectsAPIView: thêm batch filter
old1 = '''        from django.db.models import Q, Prefetch

        tasks_qs = SupervisionTask.objects.select_related("assigned_by__user")'''
new1 = '''        from django.db.models import Q, Prefetch

        batch_id = request.query_params.get("batch_id") or request.query_params.get("batch")

        tasks_qs = SupervisionTask.objects.select_related("assigned_by__user")'''
content = content.replace(old1, new1, 1)

# Thêm filter vào query
old2 = '''        projects = GraduationProject.objects.filter(supervisor=supervisor).select_related(
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
        ).order_by("student__user__last_name")'''
new2 = '''        projects_qs = GraduationProject.objects.filter(supervisor=supervisor)
        if batch_id:
            projects_qs = projects_qs.filter(batch_id=batch_id)
        projects = projects_qs.select_related(
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
        ).order_by("student__user__last_name")'''
content = content.replace(old2, new2, 1)

# 2. ReviewerAssignedProjectsAPIView: thêm batch filter
old3 = '''        projects = GraduationProject.objects.filter(reviewer=supervisor).select_related(
            "student__user",
            "supervisor__user",
            "council",
            "final_grade_summary"
        )'''
new3 = '''        batch_id = request.query_params.get("batch_id") or request.query_params.get("batch")
        projects_qs = GraduationProject.objects.filter(reviewer=supervisor)
        if batch_id:
            projects_qs = projects_qs.filter(batch_id=batch_id)
        projects = projects_qs.select_related(
            "student__user",
            "supervisor__user",
            "council",
            "final_grade_summary"
        )'''
content = content.replace(old3, new3, 1)

# 3. SupervisorOutlineGroupReviewListAPIView: thêm batch filter
old4 = '''        from django.db.models import Q
        query = Q(project__supervisor=supervisor)
        if review_groups.exists():
            query |= Q(review_group__in=review_groups)

        reviews = OutlineReview.objects.filter(query).select_related('''
new4 = '''        from django.db.models import Q
        batch_id = request.query_params.get("batch_id") or request.query_params.get("batch")
        query = Q(project__supervisor=supervisor)
        if review_groups.exists():
            query |= Q(review_group__in=review_groups)

        reviews_qs = OutlineReview.objects.filter(query)
        if batch_id:
            reviews_qs = reviews_qs.filter(project__batch_id=batch_id)
        reviews = reviews_qs.select_related('''
content = content.replace(old4, new4, 1)

# 4. Thêm SupervisorMyBatchesAPIView (trước SupervisorGraduationProjectsAPIView)
new_view = '''class SupervisorMyBatchesAPIView(APIView):
    """Trả về danh sách các đợt đồ án mà giảng viên này có tham gia (hướng dẫn hoặc phản biện)"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        supervisor = getattr(user, "supervisor_profile", None)
        if not supervisor:
            return Response({"detail": "Chỉ dành cho Giảng viên."}, status=status.HTTP_403_FORBIDDEN)

        from django.db.models import Q

        # Lấy các batch mà supervisor này có project (hướng dẫn hoặc phản biện)
        batch_ids = GraduationProject.objects.filter(
            Q(supervisor=supervisor) | Q(reviewer=supervisor)
        ).values_list("batch_id", flat=True).distinct()

        batches = AcademicBatch.objects.filter(id__in=batch_ids).order_by("-id")

        from .serializers.utc_graduation_serializers import AcademicBatchSerializer
        return Response(AcademicBatchSerializer(batches, many=True).data, status=status.HTTP_200_OK)


class SupervisorGraduationProjectsAPIView(APIView):'''

content = content.replace("class SupervisorGraduationProjectsAPIView(APIView):", new_view, 1)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("✅ Đã sửa views_utc.py thành công!")
print("   - Thêm SupervisorMyBatchesAPIView")
print("   - Thêm batch_id filter cho SupervisorGraduationProjectsAPIView")
print("   - Thêm batch_id filter cho ReviewerAssignedProjectsAPIView")
print("   - Thêm batch_id filter cho SupervisorOutlineGroupReviewListAPIView")
