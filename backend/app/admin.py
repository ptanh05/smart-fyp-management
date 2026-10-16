"""
UTC SMART FYP MANAGEMENT - DJANGO ADMIN REGISTRATION
Registers the 25 Core Pure Models for Administration
"""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import (
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
    OutlineReviewGroup,
    OutlineReview,
    ThesisDeferralRequest,
    SupervisionMeetingLog,
    SupervisionTask,
    WeeklyProgressReport,
    DefenseCouncil,
    CouncilMember,
    DefenseScheduleSlot,
    CouncilLiveScore,
    EvaluationPolicy,
    FinalGradeSummary,
    AuditLog,
    Notification,
)


@admin.register(CustomUser)
class CustomUserAdmin(BaseUserAdmin):
    list_display = ["username", "email", "first_name", "last_name", "user_type", "is_staff", "is_active"]
    list_filter = ["user_type", "is_staff", "is_active"]
    search_fields = ["username", "email", "first_name", "last_name"]
    fieldsets = BaseUserAdmin.fieldsets + (
        ("Vai trò hệ thống", {"fields": ("user_type",)}),
    )


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ["code", "name"]
    search_fields = ["code", "name"]


@admin.register(AcademicBatch)
class AcademicBatchAdmin(admin.ModelAdmin):
    list_display = ["batch_code", "batch_name", "program_type", "current_stage", "is_active", "is_closed"]
    list_filter = ["program_type", "current_stage", "is_active", "is_closed"]
    search_fields = ["batch_code", "batch_name"]


@admin.register(CourseClass)
class CourseClassAdmin(admin.ModelAdmin):
    list_display = ["class_code", "class_name", "batch", "program_type", "education_program"]
    list_filter = ["program_type", "education_program", "batch"]
    search_fields = ["class_code", "class_name"]


@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = ["registration_no", "user", "education_program", "course_class", "academic_batch"]
    list_filter = ["education_program", "academic_batch"]
    search_fields = ["registration_no", "user__username", "user__first_name", "user__last_name"]


@admin.register(Supervisor)
class SupervisorAdmin(admin.ModelAdmin):
    list_display = ["supervisor_id", "user", "academic_title", "department_obj", "academic_rank_multiplier"]
    list_filter = ["academic_title", "department_obj"]
    search_fields = ["supervisor_id", "user__username", "user__first_name", "user__last_name"]


@admin.register(SupervisorQuota)
class SupervisorQuotaAdmin(admin.ModelAdmin):
    list_display = ["supervisor", "batch", "base_quota", "rank_multiplier", "max_total_quota", "current_assigned"]
    list_filter = ["batch"]
    search_fields = ["supervisor__user__username", "supervisor__supervisor_id"]


@admin.register(ProjectTopicArea)
class ProjectTopicAreaAdmin(admin.ModelAdmin):
    list_display = ["code", "name", "is_active"]
    search_fields = ["code", "name"]


@admin.register(StudentPreference)
class StudentPreferenceAdmin(admin.ModelAdmin):
    list_display = ["student", "batch", "topic_direction", "preference_1", "preference_2", "preference_3"]
    list_filter = ["batch"]
    search_fields = ["student__registration_no", "student__user__username"]


@admin.register(InternshipInfo)
class InternshipInfoAdmin(admin.ModelAdmin):
    list_display = ["student", "batch", "is_interning", "company_name"]
    list_filter = ["batch", "is_interning"]
    search_fields = ["student__registration_no", "company_name"]


@admin.register(GraduationProject)
class GraduationProjectAdmin(admin.ModelAdmin):
    list_display = ["topic_title_vi", "student", "supervisor", "reviewer", "batch", "status", "initial_eligibility"]
    list_filter = ["status", "initial_eligibility", "topic_review_status", "batch"]
    search_fields = ["topic_title_vi", "student__registration_no", "student__user__username"]


@admin.register(OutlineReviewGroup)
class OutlineReviewGroupAdmin(admin.ModelAdmin):
    list_display = ["name", "department", "batch"]
    list_filter = ["batch"]
    search_fields = ["name", "department"]


@admin.register(OutlineReview)
class OutlineReviewAdmin(admin.ModelAdmin):
    list_display = ["project", "verdict", "reviewer", "submitted_at", "reviewed_at"]
    list_filter = ["verdict"]
    search_fields = ["project__topic_title_vi", "project__student__registration_no"]


@admin.register(ThesisDeferralRequest)
class ThesisDeferralRequestAdmin(admin.ModelAdmin):
    list_display = ["student", "project", "status", "submitted_at"]
    list_filter = ["status"]
    search_fields = ["student__registration_no", "reason"]


@admin.register(SupervisionMeetingLog)
class SupervisionMeetingLogAdmin(admin.ModelAdmin):
    list_display = ["project", "meeting_date", "meeting_type", "meeting_time"]
    list_filter = ["meeting_type", "meeting_date"]
    search_fields = ["project__topic_title_vi", "project__student__registration_no"]


@admin.register(SupervisionTask)
class SupervisionTaskAdmin(admin.ModelAdmin):
    list_display = ["title", "project", "assigned_by", "priority", "status", "is_completed", "due_date"]
    list_filter = ["priority", "status", "is_completed"]
    search_fields = ["title", "project__student__registration_no"]


@admin.register(WeeklyProgressReport)
class WeeklyProgressReportAdmin(admin.ModelAdmin):
    list_display = ["project", "week_number", "supervisor_rating", "submitted_at"]
    list_filter = ["week_number", "supervisor_rating"]
    search_fields = ["project__student__registration_no", "project__topic_title_vi"]


@admin.register(DefenseCouncil)
class DefenseCouncilAdmin(admin.ModelAdmin):
    list_display = ["council_name", "council_number", "batch", "session_date", "session_time", "is_finalized"]
    list_filter = ["batch", "session_time", "is_finalized"]
    search_fields = ["council_name"]


@admin.register(CouncilMember)
class CouncilMemberAdmin(admin.ModelAdmin):
    list_display = ["user", "council", "role", "external_institution"]
    list_filter = ["role", "council"]
    search_fields = ["user__username", "user__first_name", "user__last_name"]


@admin.register(DefenseScheduleSlot)
class DefenseScheduleSlotAdmin(admin.ModelAdmin):
    list_display = ["council", "project", "order_number", "slot_date", "start_time", "end_time"]
    list_filter = ["council", "slot_date"]
    search_fields = ["project__student__registration_no"]


@admin.register(CouncilLiveScore)
class CouncilLiveScoreAdmin(admin.ModelAdmin):
    list_display = ["member", "project", "total_score", "created_at"]
    search_fields = ["project__student__registration_no", "member__user__username"]


@admin.register(EvaluationPolicy)
class EvaluationPolicyAdmin(admin.ModelAdmin):
    list_display = ["batch", "weight_supervisor", "weight_reviewer", "weight_council"]


@admin.register(FinalGradeSummary)
class FinalGradeSummaryAdmin(admin.ModelAdmin):
    list_display = ["project", "final_score_10", "final_score_4", "final_letter_grade", "classification", "is_passed", "is_finalized"]
    list_filter = ["is_passed", "is_finalized", "final_letter_grade"]
    search_fields = ["project__student__registration_no", "project__topic_title_vi"]


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ["action_type", "user", "field_name", "created_at"]
    list_filter = ["action_type"]
    search_fields = ["description", "user__username"]


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ["title", "user", "notification_type", "is_read", "created_at"]
    list_filter = ["is_read", "notification_type"]
    search_fields = ["title", "user__username"]
