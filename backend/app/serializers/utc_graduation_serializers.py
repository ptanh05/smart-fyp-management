from rest_framework import serializers
from ..models import (
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
    CourseClass
)

class ProjectTopicAreaSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectTopicArea
        fields = ["id", "name", "code", "description"]


class SupervisorBriefSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    department = serializers.CharField(source="department_name", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.CharField(source="user.email", read_only=True)

    class Meta:
        model = Supervisor
        fields = ["id", "supervisor_id", "full_name", "academic_title", "department", "phone_number", "username", "email", "is_external", "research_interest"]

    def get_full_name(self, obj):
        prefix = f"{obj.academic_title} " if obj.academic_title else ""
        return f"{prefix}{obj.user.get_full_name() or obj.user.username}".strip()


class InternshipInfoSerializer(serializers.ModelSerializer):
    topic_direction_name = serializers.CharField(source="topic_direction.name", read_only=True, default="")
    preferred_supervisor_name = serializers.SerializerMethodField()

    class Meta:
        model = InternshipInfo
        fields = [
            "id",
            "student",
            "batch",
            "is_interning",
            "company_name",
            "topic_direction",
            "topic_direction_name",
            "preferred_supervisor",
            "preferred_supervisor_name",
            "tentative_title",
            "submitted_at"
        ]
        read_only_fields = ["student", "submitted_at"]

    def get_preferred_supervisor_name(self, obj):
        if not obj.preferred_supervisor:
            return ""
        prefix = f"{obj.preferred_supervisor.academic_title} " if obj.preferred_supervisor.academic_title else ""
        return f"{prefix}{obj.preferred_supervisor.user.get_full_name()}".strip()

    def validate(self, data):
        is_interning = data.get("is_interning", False)
        company_name = data.get("company_name", "")
        if is_interning and not company_name:
            raise serializers.ValidationError({"company_name": "Vui lòng nhập tên công ty / doanh nghiệp đang thực tập."})
        return data


class OutlineReviewSerializer(serializers.ModelSerializer):
    reviewer_name = serializers.SerializerMethodField()

    class Meta:
        model = OutlineReview
        fields = [
            "id",
            "project",
            "review_group",
            "reviewer",
            "reviewer_name",
            "outline_file",
            "verdict",
            "comments",
            "submitted_at",
            "reviewed_at"
        ]
        read_only_fields = ["submitted_at", "reviewed_at"]

    def get_reviewer_name(self, obj):
        if not obj.reviewer:
            return ""
        return obj.reviewer.user.get_full_name()


class WeeklyProgressReportSerializer(serializers.ModelSerializer):
    supervisor_rating_display = serializers.CharField(source="get_supervisor_rating_display", read_only=True)

    class Meta:
        model = WeeklyProgressReport
        fields = [
            "id",
            "project",
            "week_number",
            "summary_content",
            "planned_tasks",
            "git_commit_link",
            "attached_file",
            "supervisor_feedback",
            "supervisor_rating",
            "supervisor_rating_display",
            "submitted_at",
            "reviewed_at"
        ]
        read_only_fields = ["submitted_at", "reviewed_at"]

    def validate_week_number(self, value):
        if value < 1 or value > 15:
            raise serializers.ValidationError("Tuần báo cáo phải nằm trong khoảng từ 1 đến 15.")
        return value


class CouncilLiveScoreSerializer(serializers.ModelSerializer):
    member_name = serializers.CharField(source="member.user.get_full_name", read_only=True)
    member_role = serializers.CharField(source="member.get_role_display", read_only=True)

    class Meta:
        model = CouncilLiveScore
        fields = [
            "id",
            "council",
            "project",
            "member",
            "member_name",
            "member_role",
            "score_presentation",
            "score_content",
            "score_qa",
            "score_demo",
            "total_score",
            "comments",
            "created_at"
        ]
        read_only_fields = ["total_score", "created_at"]

    def validate(self, data):
        # Validate that individual component scores do not exceed maximum bounds
        p = float(data.get("score_presentation", 0.0))
        c = float(data.get("score_content", 0.0))
        q = float(data.get("score_qa", 0.0))
        d = float(data.get("score_demo", 0.0))

        if p < 0 or p > 3.0:
            raise serializers.ValidationError({"score_presentation": "Điểm thuyết trình tối đa 3.0 điểm."})
        if c < 0 or c > 3.0:
            raise serializers.ValidationError({"score_content": "Điểm nội dung tối đa 3.0 điểm."})
        if q < 0 or q > 2.0:
            raise serializers.ValidationError({"score_qa": "Điểm trả lời câu hỏi tối đa 2.0 điểm."})
        if d < 0 or d > 2.0:
            raise serializers.ValidationError({"score_demo": "Điểm sản phẩm demo tối đa 2.0 điểm."})

        return data


class FinalGradeSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = FinalGradeSummary
        fields = [
            "id",
            "supervisor_score",
            "reviewer_score",
            "council_avg_score",
            "final_score_10",
            "final_score_4",
            "final_letter_grade",
            "classification",
            "is_passed",
            "is_finalized",
            "notes",
            "updated_at"
        ]


class GraduationProjectDetailSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.user.get_full_name", read_only=True)
    student_reg_no = serializers.CharField(source="student.registration_no", read_only=True)
    student_phone = serializers.CharField(source="student.phone_number", read_only=True)
    student_email = serializers.CharField(source="student.user.email", read_only=True)
    student_class = serializers.CharField(source="student.department", read_only=True)
    supervisor = SupervisorBriefSerializer(read_only=True)
    reviewer = SupervisorBriefSerializer(read_only=True)
    council_name = serializers.CharField(source="council.council_name", read_only=True, default="")
    defense_room = serializers.CharField(source="council.defense_room", read_only=True, default="")
    session_date = serializers.DateField(source="council.session_date", read_only=True, default=None)
    session_time = serializers.CharField(source="council.get_session_time_display", read_only=True, default="")
    topic_category_name = serializers.CharField(source="topic_category.name", read_only=True, default="")
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    outline_review = OutlineReviewSerializer(read_only=True)
    weekly_reports = WeeklyProgressReportSerializer(many=True, read_only=True)
    final_grade = FinalGradeSummarySerializer(source="final_grade_summary", read_only=True)

    class Meta:
        model = GraduationProject
        fields = [
            "id",
            "student",
            "student_name",
            "student_reg_no",
            "student_phone",
            "student_email",
            "student_class",
            "supervisor",
            "reviewer",
            "council",
            "council_name",
            "defense_room",
            "session_date",
            "session_time",
            "batch",
            "topic_category",
            "topic_category_name",
            "topic_title_vi",
            "topic_title_en",
            "status",
            "status_display",
            "supervisor_score",
            "supervisor_feedback",
            "is_eligible_for_defense",
            "reviewer_score",
            "reviewer_feedback",
            "outline_review",
            "weekly_reports",
            "final_grade",
            "created_at",
            "updated_at"
        ]
