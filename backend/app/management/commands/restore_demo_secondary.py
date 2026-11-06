"""
Khôi phục các bản ghi phụ (task, đơn bảo lưu) đã bị xóa do cascade khi purge GV demo.

Bối cảnh:
    Lệnh `purge_demo_supervisors` xóa hồ sơ `Supervisor` demo. Vì
    `SupervisionTask.assigned_by` và `GraduationProject.supervisor` dùng
    `on_delete=CASCADE` ở tầng Django ORM, các task của GV demo bị xóa theo.
    Tương tự, `ThesisDeferralRequest.project` (CASCADE) mất khi đồ án bị mất.

    Đồ án đã được `restore_demo_projects` khôi phục lại; lệnh này khôi phục
    tiếp các bản ghi con của chúng.

Cách dùng:
    python manage.py restore_demo_secondary            # báo cáo + thực thi
    python manage.py restore_demo_secondary --dry-run  # chỉ báo cáo
    python manage.py restore_demo_secondary --yes       # bỏ qua xác nhận

Lệnh IDEMPOTENT: chạy lại nhiều lần vẫn an toàn.
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from app.models import (
    GraduationProject,
    Student,
    Supervisor,
    SupervisionTask,
    ThesisDeferralRequest,
)


# ---------------------------------------------------------------------------
# Task cần khôi phục: (registration_no, title, description, priority, status)
# ---------------------------------------------------------------------------
LOST_TASKS = [
    (
        "201200001",
        "Viết đề cương chi tiết và đề xuất giải pháp kiến trúc",
        "Mô tả bài toán, phân tích yêu cầu chức năng & phi chức năng, khảo sát 3 hệ thống tương tự.",
        "HIGH",
        "COMPLETED",
    ),
    (
        "201200001",
        "Thiết kế CSDL và lập trình phân quyền",
        "Thiết kế schema PostgreSQL, viết API đăng nhập/refresh token và middleware phân quyền theo vai trò.",
        "HIGH",
        "COMPLETED",
    ),
    (
        "201200001",
        "Xây dựng giao diện quản lý đồ án và báo cáo tiến độ",
        "Dựng dashboard React, biểu đồ tiến độ theo đợt, biểu mẫu nhập kết quả đánh giá GVHD.",
        "MEDIUM",
        "IN_PROGRESS",
    ),
]

# Đơn bảo lưu cần khôi phục: (registration_no, reason, status)
LOST_DEFERRALS = [
    (
        "201200013",
        "Sinh viên xin bảo lưu đồ án đến hết học kỳ 2 năm học 2026-2027 do gặp khó khăn "
        "sức khỏe và công việc thực tập tại doanh nghiệp, đã có thư xác nhận của "
        "giảng viên hướng dẫn.",
        "PENDING",
    ),
]


class Command(BaseCommand):
    help = "Khôi phục task & đơn bảo lưu bị mất khi purge tài khoản GV demo."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Chỉ in báo cáo.")
        parser.add_argument("--yes", action="store_true", help="Bỏ qua xác nhận.")

    # ------------------------------------------------------------------
    def handle(self, *args, **options):
        dry_run = options["dry_run"]

        self.stdout.write("=" * 78)
        self.stdout.write("RESTORE DEMO SECONDARY RECORDS (tasks & deferrals)")
        self.stdout.write("=" * 78)

        reg_nos = {r[0] for r in LOST_TASKS} | {r[0] for r in LOST_DEFERRALS}
        students = {
            s.registration_no: s
            for s in Student.objects.filter(registration_no__in=list(reg_nos)).select_related(
                "user", "academic_batch"
            )
        }
        self.stdout.write(f"Sinh viên tìm thấy: {len(students)} / {len(reg_nos)}")

        projects = {
            p.student.registration_no: p
            for p in GraduationProject.objects.filter(
                student__registration_no__in=list(reg_nos)
            ).select_related("student", "supervisor", "batch")
        }

        existing_task_titles = set(
            SupervisionTask.objects.filter(
                project__student__registration_no__in=list(reg_nos)
            ).values_list("title", flat=True)
        )
        existing_def_students = set(
            ThesisDeferralRequest.objects.filter(
                student__registration_no__in=list(reg_nos)
            ).values_list("student__registration_no", flat=True)
        )

        task_plan = []
        for reg_no, title, desc, priority, status in LOST_TASKS:
            if reg_no not in students:
                self.stdout.write(self.style.WARNING(f"  ! {reg_no}: không có sinh viên, bỏ qua."))
                continue
            if reg_no not in projects:
                self.stdout.write(
                    self.style.WARNING(f"  ! {reg_no}: chưa có đồ án, bỏ qua task '{title}'.")
                )
                continue
            if title in existing_task_titles:
                continue
            task_plan.append((projects[reg_no], title, desc, priority, status))

        deferral_plan = []
        for reg_no, reason, status in LOST_DEFERRALS:
            if reg_no not in students:
                continue
            if reg_no not in projects:
                self.stdout.write(
                    self.style.WARNING(f"  ! {reg_no}: chưa có đồ án, bỏ qua đơn bảo lưu.")
                )
                continue
            if reg_no in existing_def_students:
                continue
            deferral_plan.append((projects[reg_no], students[reg_no], reason, status))

        self.stdout.write(f"Task cần khôi phục: {len(task_plan)}")
        self.stdout.write(f"Đơn bảo lưu cần khôi phục: {len(deferral_plan)}")

        self.stdout.write("")
        self.stdout.write("-" * 78)
        self.stdout.write("KẾ HOẠCH KHÔI PHỤC")
        self.stdout.write("-" * 78)
        for project, title, desc, priority, status in task_plan:
            self.stdout.write(
                f"  TASK  {project.student.registration_no:<14} "
                f"-> {project.supervisor.supervisor_id if project.supervisor_id else '-':<8} "
                f"| {title} [{priority}/{status}]"
            )
        for project, student, reason, status in deferral_plan:
            self.stdout.write(
                f"  DEFER {student.registration_no:<14} "
                f"-> {project.supervisor.supervisor_id if project.supervisor_id else '-':<8} "
                f"| status={status}"
            )
        self.stdout.write("")

        if dry_run:
            self.stdout.write(self.style.WARNING("DRY-RUN: không có thay đổi nào được ghi."))
            return

        if not options["yes"]:
            answer = input("Xac nhan khoi phuc? (yes/no): ").strip().lower()
            if answer not in ("y", "yes"):
                self.stdout.write(self.style.WARNING("Đã hủy."))
                return

        created_tasks = 0
        created_def = 0
        with transaction.atomic():
            for project, title, desc, priority, status in task_plan:
                supervisor = project.supervisor
                if supervisor is None:
                    self.stdout.write(
                        self.style.WARNING(f"  ! Bỏ qua task '{title}': đồ án chưa có GV.")
                    )
                    continue
                SupervisionTask.objects.create(
                    project=project,
                    title=title,
                    description=desc,
                    assigned_by=supervisor,
                    priority=priority,
                    status=status,
                    is_completed=(status == "COMPLETED"),
                    completed_at=timezone.now() if status == "COMPLETED" else None,
                )
                created_tasks += 1

            for project, student, reason, status in deferral_plan:
                ThesisDeferralRequest.objects.create(
                    project=project,
                    student=student,
                    reason=reason,
                    status=status,
                    submitted_at=timezone.now(),
                )
                created_def += 1
                # Đồ án tương ứng phải ở trạng thái bảo lưu
                if project.status in ("ALLOCATED", "IN_PROGRESS", "TOPIC_CONFIRMED", "OUTLINE_PENDING"):
                    project.status = "DEFERRED"
                    project.deferral_status = "PENDING"
                    project.save(update_fields=["status", "deferral_status"])

        self.stdout.write("")
        self.stdout.write(
            self.style.SUCCESS(
                f"✔ Đã khôi phục {created_tasks} task và {created_def} đơn bảo lưu."
            )
        )
