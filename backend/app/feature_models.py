"""
Model cho các tính năng mở rộng (tham chiếu các hệ thống quản lý đồ án quốc tế):

- SubmissionVersion: lưu mọi phiên bản bài nộp, không ghi đè (MyCase, final-work-system).
- Rubric / RubricCriterion / RubricScore: chấm theo tiêu chí, phát hiện lệch điểm (ThesisMate, Vireo).
- CalendarFeedToken / DeadlineReminderLog: lịch iCal và nhắc hạn (TU Delft MyCase).
- ThesisArchiveRecord: kho lưu trữ đồ án và embargo (Vireo ETD, KTH DiVA).
"""
import secrets

from django.db import models
from django.utils import timezone

__all__ = [
    "SubmissionVersion", "Rubric", "RubricCriterion", "RubricScore",
    "CalendarFeedToken", "DeadlineReminderLog", "ThesisArchiveRecord",
]

def _submission_upload_to(instance, filename):
    return f"submissions/{instance.project_id}/{instance.kind.lower()}/v{instance.version_no}_{filename}"


class SubmissionVersion(models.Model):
    KIND_CHOICES = (
        ("OUTLINE", "Đề cương"),
        ("REPORT", "Báo cáo / Quyển đồ án"),
        ("SLIDES", "Slide bảo vệ"),
        ("SOURCE", "Mã nguồn"),
        ("OTHER", "Khác"),
    )
    SIMILARITY_STATUS_CHOICES = (
        ("NOT_CHECKED", "Chưa kiểm tra"),
        ("CHECKED", "Đã kiểm tra"),
        ("UNSUPPORTED", "Không trích xuất được nội dung"),
    )

    project = models.ForeignKey("GraduationProject", on_delete=models.CASCADE, related_name="submission_versions")
    kind = models.CharField(max_length=20, choices=KIND_CHOICES, default="REPORT")
    version_no = models.PositiveIntegerField()
    file = models.FileField(upload_to=_submission_upload_to, max_length=500)
    original_name = models.CharField(max_length=255, blank=True, default="")
    file_size = models.PositiveIntegerField(default=0)
    sha256 = models.CharField(max_length=64, blank=True, default="")
    note = models.TextField(blank=True, default="")
    uploaded_by = models.ForeignKey("CustomUser", on_delete=models.SET_NULL, null=True, blank=True, related_name="submission_versions")
    created_at = models.DateTimeField(auto_now_add=True)

    # Kiểm tra tương đồng nội dung (đạo văn) với các bài nộp khác trong hệ thống
    extracted_text = models.TextField(blank=True, default="")
    similarity_status = models.CharField(max_length=20, choices=SIMILARITY_STATUS_CHOICES, default="NOT_CHECKED")
    similarity_score = models.FloatField(null=True, blank=True, help_text="Tỷ lệ % nội dung trùng cao nhất so với bài khác")
    similarity_matches = models.JSONField(default=list, blank=True)
    similarity_checked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "app_submissionversion"
        ordering = ["project_id", "kind", "-version_no"]
        unique_together = ("project", "kind", "version_no")
        verbose_name = "Phiên bản bài nộp"
        verbose_name_plural = "Phiên bản bài nộp"

    def __str__(self):
        return f"{self.project_id} {self.kind} v{self.version_no}"


class Rubric(models.Model):
    ROLE_CHOICES = (
        ("SUPERVISOR", "GV hướng dẫn"),
        ("REVIEWER", "GV phản biện"),
        ("COUNCIL", "Thành viên hội đồng"),
    )
    name = models.CharField(max_length=255)
    evaluator_role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    batch = models.ForeignKey("AcademicBatch", on_delete=models.CASCADE, null=True, blank=True, related_name="rubrics",
                              help_text="Để trống = dùng chung cho mọi đợt")
    description = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "app_rubric"
        ordering = ["evaluator_role", "-created_at"]

    def __str__(self):
        return f"{self.name} ({self.evaluator_role})"

    @property
    def total_max(self):
        return sum(c.max_score for c in self.criteria.all())


class RubricCriterion(models.Model):
    rubric = models.ForeignKey(Rubric, on_delete=models.CASCADE, related_name="criteria")
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    max_score = models.FloatField(default=10.0)
    weight = models.FloatField(null=True, blank=True,
                               help_text="Trọng số tiêu chí (None = dùng max_score làm trọng số)")
    order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "app_rubriccriterion"
        ordering = ["rubric_id", "order", "id"]


class RubricScore(models.Model):
    STATUS_CHOICES = (
        ("DRAFT", "Bản nháp (chưa khóa)"),
        ("SUBMITTED", "Đã nộp (đã khóa)"),
    )
    project = models.ForeignKey("GraduationProject", on_delete=models.CASCADE, related_name="rubric_scores")
    rubric = models.ForeignKey(Rubric, on_delete=models.CASCADE, related_name="scores")
    evaluator = models.ForeignKey("CustomUser", on_delete=models.CASCADE, related_name="rubric_scores")
    criterion_scores = models.JSONField(default=dict, help_text="{criterion_id: điểm}")
    criterion_comments = models.JSONField(default=dict, blank=True,
                                          help_text="{criterion_id: nhận xét từng tiêu chí}")
    total_10 = models.FloatField(default=0.0, help_text="Tổng điểm quy về thang 10")
    comment = models.TextField(blank=True, default="")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="DRAFT",
                               help_text="DRAFT: có thể sửa; SUBMITTED: đã khóa, chỉ admin mới unlock được")
    locked_at = models.DateTimeField(null=True, blank=True,
                                     help_text="Thời điểm giám khảo nộp chính thức (khóa phiếu)")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "app_rubricscore"
        unique_together = ("project", "rubric", "evaluator")
        indexes = [
            models.Index(fields=["project", "status"], name="idx_rs_project_status"),
            models.Index(fields=["evaluator", "status"], name="idx_rs_evaluator_status"),
        ]


class CalendarFeedToken(models.Model):
    user = models.OneToOneField("CustomUser", on_delete=models.CASCADE, related_name="calendar_feed_token")
    token = models.CharField(max_length=64, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "app_calendarfeedtoken"

    @classmethod
    def for_user(cls, user, rotate=False):
        obj, created = cls.objects.get_or_create(user=user, defaults={"token": secrets.token_urlsafe(32)})
        if rotate and not created:
            obj.token = secrets.token_urlsafe(32)
            obj.save(update_fields=["token"])
        return obj


class DeadlineReminderLog(models.Model):
    """Chống gửi trùng nhắc hạn: mỗi (task, user, mốc) chỉ gửi một lần."""
    task = models.ForeignKey("SupervisionTask", on_delete=models.CASCADE, related_name="reminder_logs")
    user = models.ForeignKey("CustomUser", on_delete=models.CASCADE, related_name="deadline_reminders")
    milestone = models.CharField(max_length=20)  # vd. "D-3", "D-1", "OVERDUE"
    sent_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "app_deadlinereminderlog"
        unique_together = ("task", "user", "milestone")


class ThesisArchiveRecord(models.Model):
    VISIBILITY_CHOICES = (
        ("PUBLIC", "Công khai (mọi tài khoản trong trường)"),
        ("INTERNAL", "Nội bộ Khoa"),
        ("EMBARGOED", "Hạn chế công bố (embargo)"),
    )
    project = models.OneToOneField("GraduationProject", on_delete=models.CASCADE, related_name="archive_record")
    title = models.CharField(max_length=500)
    abstract = models.TextField(blank=True, default="")
    keywords = models.CharField(max_length=500, blank=True, default="")
    final_version = models.ForeignKey(SubmissionVersion, on_delete=models.SET_NULL, null=True, blank=True, related_name="archive_records")
    visibility = models.CharField(max_length=20, choices=VISIBILITY_CHOICES, default="PUBLIC")
    embargo_until = models.DateField(null=True, blank=True)
    embargo_reason = models.TextField(blank=True, default="")
    license = models.CharField(max_length=100, blank=True, default="All rights reserved")
    final_score = models.FloatField(null=True, blank=True)
    archived_by = models.ForeignKey("CustomUser", on_delete=models.SET_NULL, null=True, blank=True, related_name="archived_theses")
    archived_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "app_thesisarchiverecord"
        ordering = ["-archived_at"]

    @property
    def is_embargoed(self):
        if self.visibility != "EMBARGOED":
            return False
        return self.embargo_until is None or self.embargo_until > timezone.localdate()
