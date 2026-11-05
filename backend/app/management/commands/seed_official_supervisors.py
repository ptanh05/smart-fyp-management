"""
Nạp danh sách giảng viên chính thức của Khoa CNTT - Trường Đại học Giao thông Vận tải UTC.

Mỗi giảng viên được gán các "chuyên ngành" (ProjectTopicArea) tương ứng, dùng để:
  - Lọc danh sách GVHD khi sinh viên chọn chuyên ngành (hướng nghiên cứu)
  - Đề xuất giảng viên phù hợp theo chuyên ngành
  - Hỗ trợ thuật toán phân bổ GVHD (MCMF) ưu tiên GV đúng lĩnh vực

Cách dùng:
    python manage.py seed_official_supervisors            # nạp / cập nhật
    python manage.py seed_official_supervisors --deactivate-legacy
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from app.models import (
    CustomUser,
    Department,
    ProjectTopicArea,
    Supervisor,
    SupervisorQuota,
    SupervisorTopicArea,
    AcademicBatch,
)

# ---------------------------------------------------------------------------
# Chuyên ngành chuẩn (khớp với ProjectTopicArea đã seed trong DB)
# ---------------------------------------------------------------------------
TOPIC_DEFS = [
    ("AI_ML", "Dữ liệu và trí tuệ nhân tạo", "Dữ liệu lớn, học máy, mô hình AI/ML"),
    ("WEB_MOBILE", "Phát triển phần mềm và ứng dụng (webApp, MobleApp)", "WebApp, MobileApp, kiến trúc phần mềm"),
    ("GAME_DEV", "Lập trình Game", "Lập trình game, đồ họa, engine game"),
    ("SOFTWARE_TESTING", "Kiểm thử phần mềm", "Kiểm thử tự động, đảm bảo chất lượng phần mềm"),
    ("CYBER_SEC", "An toàn thông tin và an ninh mạng", "Bảo mật, mật mã, phát hiện tấn công"),
    ("NETWORK_SYS", "Hệ thống, mạng và hạ tầng CNTT", "Hệ thống phân tán, mạng, hạ tầng CNTT"),
    ("ALGO_RESEARCH", "Nghiên cứu và ứng dụng thuật toán", "Thuật toán tối ưu, tìm kiếm không gian"),
]

# Bộ môn tương ứng cho mỗi chuyên ngành (fallback khi DB chưa có bộ môn phù hợp)
TOPIC_DEPARTMENT = {
    "AI_ML": ("KHMT", "Bộ môn Khoa học máy tính và Mạng máy tính"),
    "WEB_MOBILE": ("CNPM", "Bộ môn Công nghệ phần mềm"),
    "GAME_DEV": ("CNPM", "Bộ môn Công nghệ phần mềm"),
    "SOFTWARE_TESTING": ("CNPM", "Bộ môn Công nghệ phần mềm"),
    "CYBER_SEC": ("MMT", "Bộ môn Mạng máy tính & An toàn thông tin"),
    "NETWORK_SYS": ("MMT", "Bộ môn Mạng máy tính & An toàn thông tin"),
    "ALGO_RESEARCH": ("KHMT", "Bộ môn Khoa học máy tính và Mạng máy tính"),
}

# Hệ số học vị & quota gợi ý
TITLE_CONFIG = {
    "PGS.TS": {"multiplier": 1.5, "base_quota": 8},
    "TS": {"multiplier": 1.2, "base_quota": 6},
    "ThS": {"multiplier": 1.0, "base_quota": 5},
    "KS": {"multiplier": 0.8, "base_quota": 3},
}

# ---------------------------------------------------------------------------
# Danh sách giảng viên chính thức
# (học vị, họ tên, [danh sách mã chuyên ngành])
# ---------------------------------------------------------------------------
SUPERVISORS = [
    ("PGS.TS", "Trần Thị Ngân", ["AI_ML", "WEB_MOBILE"]),
    ("PGS.TS", "Nguyễn Văn Long", ["WEB_MOBILE", "GAME_DEV"]),
    ("TS", "Bùi Ngọc Dũng", ["WEB_MOBILE", "GAME_DEV"]),
    ("TS", "Cao Thị Luyên", ["WEB_MOBILE", "SOFTWARE_TESTING"]),
    ("TS", "Đào Thị Lệ Thủy", ["WEB_MOBILE", "SOFTWARE_TESTING", "AI_ML"]),
    ("TS", "Hoàng Văn Thông", ["WEB_MOBILE", "GAME_DEV", "AI_ML"]),
    ("TS", "Lại Mạnh Dũng", ["WEB_MOBILE"]),
    ("TS", "Lương Thái Lê", ["AI_ML", "WEB_MOBILE", "SOFTWARE_TESTING"]),
    ("TS", "Nguyễn Đình Dương", ["WEB_MOBILE"]),
    ("TS", "Nguyễn Đức Dư", ["WEB_MOBILE", "SOFTWARE_TESTING", "AI_ML", "GAME_DEV"]),
    ("TS", "Nguyễn Hiếu Cường", ["WEB_MOBILE"]),
    ("TS", "Nguyễn Kim Sao", ["WEB_MOBILE"]),
    ("TS", "Nguyễn Quang Trung", ["AI_ML", "WEB_MOBILE"]),
    ("TS", "Nguyễn Quốc Tuấn", ["WEB_MOBILE", "AI_ML"]),
    ("TS", "Nguyễn Trọng Phúc", ["SOFTWARE_TESTING", "WEB_MOBILE"]),
    ("TS", "Phạm Đình Phong", ["WEB_MOBILE", "AI_ML"]),
    ("TS", "Phạm Thanh Hà", ["WEB_MOBILE"]),
    ("TS", "Phạm Văn Khánh", ["AI_ML"]),
    ("TS", "Trần Văn Dũng", ["WEB_MOBILE", "GAME_DEV"]),
    ("TS", "Vũ Huấn", ["GAME_DEV", "AI_ML"]),
    ("ThS", "Đào Vũ Hoàng Nam", ["WEB_MOBILE"]),
    ("ThS", "Đinh Công Tùng", ["WEB_MOBILE", "SOFTWARE_TESTING", "AI_ML", "GAME_DEV"]),
    ("ThS", "Đỗ Văn Đức", ["GAME_DEV", "WEB_MOBILE"]),
    ("ThS", "Trịnh Văn Chung", ["WEB_MOBILE"]),
    ("ThS", "Phạm Xuân Tích", ["ALGO_RESEARCH", "WEB_MOBILE", "GAME_DEV"]),
    ("ThS", "Nguyễn Việt Hưng", ["WEB_MOBILE", "GAME_DEV"]),
    ("ThS", "Nguyễn Trần Hiếu", ["NETWORK_SYS", "WEB_MOBILE"]),
    ("ThS", "Nguyễn Thu Hường", ["WEB_MOBILE", "SOFTWARE_TESTING", "AI_ML"]),
    ("ThS", "Nguyễn Thị Hồng Hoa", ["WEB_MOBILE"]),
    ("ThS", "Nguyễn Thanh Toàn", ["NETWORK_SYS", "GAME_DEV"]),
    ("ThS", "Nguyễn Lê Minh", ["CYBER_SEC", "WEB_MOBILE"]),
    ("KS", "Nguyễn Hữu Luân", ["NETWORK_SYS", "WEB_MOBILE"]),
    ("KS", "Bùi Minh Thảo", ["WEB_MOBILE"]),
]


def slugify_username(full_name):
    """Sinh username không dấu, không khoảng trắng từ họ tên."""
    import unicodedata

    normalized = (
        unicodedata.normalize("NFKD", full_name)
        .encode("ASCII", "ignore")
        .decode("utf-8")
        .lower()
    )
    parts = [p for p in "".join(c if c.isalnum() else " " for c in normalized).split() if p]
    return "gv_" + "_".join(parts)


class Command(BaseCommand):
    help = "Nạp danh sách giảng viên chính thức UTC kèm chuyên ngành hướng dẫn."

    def add_arguments(self, parser):
        parser.add_argument(
            "--deactivate-legacy",
            action="store_true",
            help="Đánh dấu ẩn (is_active=False) các giảng viên cũ không có trong danh sách chính thức.",
        )
        parser.add_argument(
            "--reset-password",
            action="store_true",
            help="Đặt lại mật khẩu tài khoản giảng viên về Gv@123456.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        # 1. Đảm bảo các chuyên ngành tồn tại
        topic_map = {}
        for code, name, desc in TOPIC_DEFS:
            obj, _ = ProjectTopicArea.objects.get_or_create(
                code=code,
                defaults={"name": name, "description": desc, "is_active": True},
            )
            # Cập nhật tên nếu DB đang dùng tên cũ
            if obj.name != name:
                obj.name = name
                obj.description = desc
                obj.is_active = True
                obj.save(update_fields=["name", "description", "is_active"])
            topic_map[code] = obj
        self.stdout.write(self.style.SUCCESS(f"[1] Chuyên ngành: {len(topic_map)} mã"))

        # 2. Đảm bảo bộ môn tồn tại
        dept_cache = {d.code: d for d in Department.objects.all()}
        dept_by_code = {}
        for code, (dept_code, dept_name) in TOPIC_DEPARTMENT.items():
            dept = dept_cache.get(dept_code)
            if dept is None:
                dept, _ = Department.objects.get_or_create(
                    code=dept_code,
                    defaults={"name": dept_name},
                )
            dept_by_code[code] = dept
        self.stdout.write(self.style.SUCCESS(f"[2] Bộ môn: {len(dept_by_code)} nhóm"))

        # 3. Đợt đồ án đang hoạt động (để cấp quota)
        batch = (
            AcademicBatch.objects.filter(is_active=True, is_closed=False)
            .exclude(current_stage="COMPLETED")
            .order_by("-created_at")
            .first()
        )

        # 4. Nạp giảng viên
        created_count = 0
        updated_count = 0
        official_names = set()

        for idx, (title, full_name, topic_codes) in enumerate(SUPERVISORS, start=1):
            official_names.add(full_name)
            parts = full_name.split(" ", 1)
            last_name = parts[0]
            first_name = parts[1] if len(parts) > 1 else ""
            username = slugify_username(full_name)
            email = f"{username.replace('gv_', '')}@utc.edu.vn"

            user, created = CustomUser.objects.get_or_create(
                username=username,
                defaults={
                    "email": email,
                    "first_name": first_name,
                    "last_name": last_name,
                    "user_type": "supervisor",
                },
            )
            changed = False
            for field, value in (
                ("email", email),
                ("first_name", first_name),
                ("last_name", last_name),
                ("user_type", "supervisor"),
            ):
                if getattr(user, field) != value:
                    setattr(user, field, value)
                    changed = True
            if options["reset_password"]:
                user.set_password("Gv@123456")
                changed = True
            if changed:
                user.save()
            if user.user_type != "supervisor":
                self.stdout.write(
                    self.style.WARNING(f"  ! Bỏ qua {username}: user_type={user.user_type}")
                )
                continue

            cfg = TITLE_CONFIG.get(title, {"multiplier": 1.0, "base_quota": 5})
            primary_code = topic_codes[0]
            dept = dept_by_code.get(primary_code)

            supervisor, sup_created = Supervisor.objects.get_or_create(
                user=user,
                defaults={
                    "supervisor_id": f"UTC{idx:03d}",
                    "academic_title": title,
                    "department_name": dept.name if dept else "Khoa CNTT",
                    "department_obj": dept,
                    "academic_rank_multiplier": cfg["multiplier"],
                    "research_interest": ", ".join(topic_map[c].name for c in topic_codes),
                    "phone_number": "",
                    "is_external": False,
                    "is_active": True,
                },
            )

            # Cập nhật thông tin nếu đã tồn tại
            if not sup_created:
                supervisor.academic_title = title
                supervisor.department_name = dept.name if dept else supervisor.department_name
                supervisor.department_obj = dept
                supervisor.academic_rank_multiplier = cfg["multiplier"]
                supervisor.research_interest = ", ".join(topic_map[c].name for c in topic_codes)
                supervisor.is_active = True
                supervisor.save()
                updated_count += 1
            else:
                created_count += 1

            # Gán chuyên ngành
            SupervisorTopicArea.objects.filter(supervisor=supervisor).exclude(
                topic_area__in=[topic_map[c] for c in topic_codes]
            ).delete()
            for code in topic_codes:
                SupervisorTopicArea.objects.get_or_create(
                    supervisor=supervisor,
                    topic_area=topic_map[code],
                )

            # Quota cho đợt hiện tại
            if batch:
                quota, q_created = SupervisorQuota.objects.get_or_create(
                    supervisor=supervisor,
                    batch=batch,
                    defaults={
                        "department": supervisor.department_name or "",
                        "base_quota": cfg["base_quota"],
                        "rank_multiplier": cfg["multiplier"],
                        "max_total_quota": cfg["base_quota"],
                        "current_assigned": 0,
                    },
                )
                if not q_created:
                    quota.rank_multiplier = cfg["multiplier"]
                    quota.calculate_capacity()
                    quota.save()

        self.stdout.write(
            self.style.SUCCESS(
                f"[3] Giảng viên: +{created_count} mới, ~{updated_count} cập nhật "
                f"(tổng {len(SUPERVISORS)})"
            )
        )

        # 5. Ẩn các giảng viên legacy không nằm trong danh sách chính thức
        if options["deactivate_legacy"]:
            legacy = Supervisor.objects.exclude(
                user__last_name__in=[n.split(" ", 1)[0] for n in official_names]
            ).filter(is_active=True)
            legacy_count = legacy.count()
            legacy.update(is_active=False)
            self.stdout.write(
                self.style.WARNING(f"[4] Đã ẩn {legacy_count} giảng viên legacy (không chính thức)")
            )
        else:
            self.stdout.write(
                self.style.WARNING(
                    "[4] Bỏ qua bước ẩn giảng viên legacy. Dùng --deactivate-legacy nếu muốn."
                )
            )

        self.stdout.write(self.style.SUCCESS("✔ Hoàn tất nạp danh sách giảng viên UTC."))
