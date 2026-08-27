from django.core.management.base import BaseCommand
from django.db import transaction
from django.contrib.auth import get_user_model
import sys
import unicodedata
import re
from app.models import (
    CustomUser,
    AcademicBatch,
    CourseClass,
    Supervisor,
    SupervisorQuota,
    ProjectTopicArea,
    EvaluationPolicy,
    ProjectCategories
)

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

def clean_vietnamese_slug(text):
    text = unicodedata.normalize('NFD', text)
    text = ''.join([c for c in text if not unicodedata.combining(c)])
    text = text.replace('đ', 'd').replace('Đ', 'D')
    text = re.sub(r'[^a-zA-Z0-9\s]', '', text)
    tokens = text.lower().split()
    if not tokens:
        return "user"
    # Format: nguyenvanan or last name + initials
    if len(tokens) >= 2:
        return f"{tokens[-1]}.{tokens[0]}"
    return tokens[0]

class Command(BaseCommand):
    help = "Seed standard UTC Faculty of IT graduation data (33 Lecturers, Quotas, 8 Topic Areas, Academic Batch)"

    @transaction.atomic
    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS("Starting UTC Graduation Seed Data..."))

        # 1. Academic Batch
        batch, _ = AcademicBatch.objects.update_or_create(
            batch_code="2026_2027_HK1",
            defaults={
                "batch_name": "Đợt Đồ án Tốt nghiệp HK1 (2026-2027) K60-K63",
                "is_active": True,
            }
        )
        self.stdout.write(f"[OK] Academic Batch: {batch}")

        # 2. Evaluation Policy
        policy, _ = EvaluationPolicy.objects.update_or_create(
            batch=batch,
            defaults={
                "weight_supervisor": 0.4,
                "weight_reviewer": 0.2,
                "weight_council": 0.4,
            }
        )
        self.stdout.write(f"[OK] Evaluation Policy: {policy}")

        # 3. Standard 8 Topic Areas
        topic_areas = [
            ("SOFTWARE_DEV", "Phát triển phần mềm và ứng dụng (webApp, MobleApp)"),
            ("AI_DATA", "Dữ liệu và trí tuệ nhân tạo"),
            ("GAME_DEV", "Lập trình Game"),
            ("SOFTWARE_TESTING", "Kiểm thử phần mềm"),
            ("OTHER", "Khác"),
            ("NETWORK_INFRA", "Hệ thống, mạng và hạ tầng CNTT"),
            ("CYBER_SECURITY", "An toàn thông tin và an ninh mạng"),
            ("ALGORITHMS", "Nghiên cứu và ứng dụng thuật toán"),
        ]
        for code, name in topic_areas:
            ProjectTopicArea.objects.update_or_create(
                code=code,
                defaults={"name": name, "is_active": True}
            )
            ProjectCategories.objects.get_or_create(category_name=name)
        self.stdout.write(f"[OK] Created/Updated 8 Standard Topic Areas")

        # 4. Standard Classes for Batch
        classes_data = [
            ("CNT04.101", "Đồ án tốt nghiệp Khóa cũ (K59, K60, K61)", "KHOA_CU", "N41"),
            ("IT1.243.102", "Đồ án tốt nghiệp Cử nhân CNTT & KHMT", "DAI_TRA", "N13"),
            ("IT1.659.103", "Đồ án tốt nghiệp Kỹ sư CNTT", "DAI_TRA", "N02"),
            ("IT1.242.35", "Thực tập tốt nghiệp Cử nhân CNTT", "DAI_TRA", "N12"),
            ("IT1.658.86", "Thực tập tốt nghiệp Kỹ sư CNTT", "DAI_TRA", "N05"),
            ("CNT03.24", "Thực tập tốt nghiệp Khóa cũ", "KHOA_CU", "N40"),
            ("CLC.CNTT.VA", "Đồ án tốt nghiệp Kỹ sư CLC Việt - Anh", "VIET_ANH", "N01"),
        ]
        for code, name, ptype, cgroup in classes_data:
            CourseClass.objects.update_or_create(
                batch=batch,
                class_code=code,
                defaults={
                    "class_name": name,
                    "program_type": ptype,
                    "class_group": cgroup
                }
            )
        self.stdout.write(f"[OK] Created/Updated {len(classes_data)} Course Classes")

        # 5. 33 Lecturers from Phân GVHD.xlsx Ground Truth
        # (STT, Full Name with Title, Title, Name, Dept, Phone, VA Quota, CNTT Quota, Total Quota)
        lecturers_data = [
            (1, "TS. Đào Thị Lệ Thủy", "TS", "Đào Thị Lệ Thủy", "CNPM", "0946921976", 4, 6, 10),
            (2, "TS. Nguyễn Hiếu Cường", "TS", "Nguyễn Hiếu Cường", "CNPM", "0967886712", 4, 6, 10),
            (3, "TS. Nguyễn Đức Dư", "TS", "Nguyễn Đức Dư", "CNPM", "0912363245", 4, 10, 14),
            (4, "ThS. Nguyễn Thu Hường", "ThS", "Nguyễn Thu Hường", "CNPM", "0966047698", 0, 11, 11),
            (5, "TS. Cao Thị Luyên", "TS", "Cao Thị Luyên", "CNPM", "0912403345", 4, 8, 12),
            (6, "TS. Nguyễn Trọng Phúc", "TS", "Nguyễn Trọng Phúc", "CNPM", "0936298608", 3, 6, 9),
            (7, "ThS. Đinh Công Tùng", "ThS", "Đinh Công Tùng", "CNPM", "0363641589", 0, 10, 10),
            (8, "TS. Nguyễn Kim Sao", "TS", "Nguyễn Kim Sao", "Mạng&HTTT", "0905883993", 3, 5, 8),
            (9, "TS. Nguyễn Quốc Tuấn", "TS", "Nguyễn Quốc Tuấn", "Mạng&HTTT", "0912228980", 1, 7, 8),
            (10, "TS. Phạm Thanh Hà", "TS", "Phạm Thanh Hà", "Mạng&HTTT", "0904763604", 0, 8, 8),
            (11, "TS. Lại Mạnh Dũng", "TS", "Lại Mạnh Dũng", "Mạng&HTTT", "0964978112", 4, 7, 11),
            (12, "TS. Bùi Ngọc Dũng", "TS", "Bùi Ngọc Dũng", "Mạng&HTTT", "0913045130", 4, 7, 11),
            (13, "ThS. Nguyễn Trần Hiếu", "ThS", "Nguyễn Trần Hiếu", "Mạng&HTTT", "0912554558", 0, 8, 8),
            (14, "KS. Nguyễn Hữu Luân", "KS", "Nguyễn Hữu Luân", "Mạng&HTTT", "0941070588", 0, 6, 6),
            (15, "ThS. Nguyễn Lê Minh", "ThS", "Nguyễn Lê Minh", "Mạng&HTTT", "0931385579", 0, 6, 6),
            (16, "TS. Hoàng Văn Thông", "TS", "Hoàng Văn Thông", "KHMT", "0988113679", 7, 3, 10),
            (17, "ThS. Nguyễn Việt Hưng", "ThS", "Nguyễn Việt Hưng", "KHMT", "0868004008", 0, 11, 11),
            (18, "ThS. Phạm Xuân Tích", "ThS", "Phạm Xuân Tích", "KHMT", "0973087356", 4, 7, 11),
            (19, "TS. Lương Thái Lê", "TS", "Lương Thái Lê", "KHMT", "0973223450", 3, 7, 10),
            (20, "PGS.TS Nguyễn Văn Long", "PGS.TS", "Nguyễn Văn Long", "KHMT", "0933819869", 0, 11, 11),
            (21, "ThS. Đỗ Văn Đức", "ThS", "Đỗ Văn Đức", "KHMT", "0912324873", 0, 7, 7),
            (22, "TS. Phạm Đình Phong", "TS", "Phạm Đình Phong", "KHMT", "0972481813", 6, 6, 12),
            (23, "KS. Bùi Minh Thảo", "KS", "Bùi Minh Thảo", "KHMT", "0972801796", 0, 7, 7),
            (24, "TS. Nguyễn Đình Dương", "TS", "Nguyễn Đình Dương", "KHMT", "0913066940", 0, 8, 8),
            (25, "ThS. Đào Vũ Hoàng Nam", "ThS", "Đào Vũ Hoàng Nam", "KHMT", "0942390569", 4, 7, 11),
            (26, "TS. Trần Văn Dũng", "TS", "Trần Văn Dũng", "Thỉnh giảng", "0904588833", 3, 7, 10),
            (27, "ThS. Nguyễn Thanh Toàn", "ThS", "Nguyễn Thanh Toàn", "Thỉnh giảng", "0912175955", 0, 6, 6),
            (28, "TS. Phạm Văn Khánh", "TS", "Phạm Văn Khánh", "Thỉnh giảng", "0972907288", 4, 3, 7),
            (29, "ThS. Nguyễn Thị Hồng Hoa", "ThS", "Nguyễn Thị Hồng Hoa", "Thỉnh giảng", "0982108957", 0, 8, 8),
            (30, "ThS. Trịnh Văn Chung", "ThS", "Trịnh Văn Chung", "Thỉnh giảng", "0978611889", 0, 7, 7),
            (31, "TS. Vũ Huấn", "TS", "Vũ Huấn", "Thỉnh giảng", "0988616090", 4, 0, 4),
            (32, "PGS. TS. Trần Thị Ngân", "PGS.TS", "Trần Thị Ngân", "Thỉnh giảng", "0989040454", 0, 0, 0),
            (33, "TS. Nguyễn Quang Trung", "TS", "Nguyễn Quang Trung", "Thỉnh giảng", "0912371565", 0, 2, 2),
        ]

        total_seeded_va = 0
        total_seeded_cntt = 0

        for stt, full_name, title, name, dept, phone, va_q, cntt_q, tot_q in lecturers_data:
            # Generate deterministic username
            slug = clean_vietnamese_slug(name)
            username = f"gv_{slug}_{stt}"
            email = f"{slug}@utc.edu.vn"

            user, _ = CustomUser.objects.update_or_create(
                username=username,
                defaults={
                    "email": email,
                    "user_type": "supervisor",
                    "first_name": name.split()[-1],
                    "last_name": " ".join(name.split()[:-1]),
                    "is_staff": True if dept != "Thỉnh giảng" else False
                }
            )
            user.set_password("utc@123456")
            user.save()

            supervisor, _ = Supervisor.objects.update_or_create(
                user=user,
                defaults={
                    "supervisor_id": f"GV{stt:03d}",
                    "academic_title": title,
                    "department_name": dept,
                    "phone_number": phone,
                    "is_external": True if dept == "Thỉnh giảng" else False,
                    "research_interest": f"Chuyên môn {dept} - {title}. {name}"
                }
            )

            # Quota
            quota, _ = SupervisorQuota.objects.update_or_create(
                supervisor=supervisor,
                batch=batch,
                defaults={
                    "department": dept,
                    "viet_anh_quota": va_q,
                    "general_cntt_quota": cntt_q,
                    "max_total_quota": tot_q,
                }
            )
            total_seeded_va += va_q
            total_seeded_cntt += cntt_q

        self.stdout.write(self.style.SUCCESS(
            f"[OK] Seeded 33 Lecturers. Total Quota Check: VA={total_seeded_va} (Expected 66), CNTT={total_seeded_cntt} (Expected 218), TOTAL={total_seeded_va + total_seeded_cntt} (Expected 284)"
        ))
