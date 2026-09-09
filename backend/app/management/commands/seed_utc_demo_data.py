import random
from django.core.management.base import BaseCommand
from django.contrib.auth.hashers import make_password
from app.models import CustomUser, Student, Supervisor, AcademicBatch, GraduationProject

class Command(BaseCommand):
    help = 'Seed UTC Demo Data with 25 Students and 8 Supervisors'

    def handle(self, *args, **options):
        self.stdout.write("Starting UTC Demo Data seeding...")

        # Create a Demo Batch
        batch, created = AcademicBatch.objects.get_or_create(
            batch_code="UTC_K62_CNTT",
            defaults={
                "batch_name": "Đồ án Tốt nghiệp K62 - Khoa CNTT",
                "start_date": "2026-01-01",
                "end_date": "2026-06-30",
                "is_active": True,
            }
        )

        # Pre-defined Supervisors
        supervisors_data = [
            {"username": "gv.nguyenvana", "email": "nguyenvana@utc.edu.vn", "full_name": "PGS.TS Nguyễn Văn A", "title": "PGS.TS", "dept": "Bộ môn Hệ thống thông tin"},
            {"username": "gv.tranvanb", "email": "tranvanb@utc.edu.vn", "full_name": "TS Trần Văn B", "title": "TS", "dept": "Bộ môn Khoa học máy tính"},
            {"username": "gv.lethic", "email": "lethic@utc.edu.vn", "full_name": "TS Lê Thị C", "title": "TS", "dept": "Bộ môn Kỹ thuật phần mềm"},
            {"username": "gv.phamvand", "email": "phamvand@utc.edu.vn", "full_name": "ThS Phạm Văn D", "title": "ThS", "dept": "Bộ môn Mạng máy tính"},
            {"username": "gv.hoangthie", "email": "hoangthie@utc.edu.vn", "full_name": "ThS Hoàng Thị E", "title": "ThS", "dept": "Bộ môn Hệ thống thông tin"},
            {"username": "gv.vuvang", "email": "vuvang@utc.edu.vn", "full_name": "ThS Vũ Văn G", "title": "ThS", "dept": "Bộ môn Kỹ thuật phần mềm"},
            {"username": "gv.dangvanh", "email": "dangvanh@utc.edu.vn", "full_name": "PGS.TS Đặng Văn H", "title": "PGS.TS", "dept": "Bộ môn Khoa học dữ liệu"},
            {"username": "gv.buit", "email": "buit@utc.edu.vn", "full_name": "TS Bùi T", "title": "TS", "dept": "Bộ môn Trí tuệ nhân tạo"},
        ]

        supervisor_objs = []
        for idx, data in enumerate(supervisors_data, start=1):
            user, u_created = CustomUser.objects.get_or_create(
                username=data["username"],
                defaults={
                    "email": data["email"],
                    "password": make_password("UTC@123"),
                    "user_type": "supervisor",
                    "first_name": data["full_name"],
                }
            )
            supervisor, _ = Supervisor.objects.get_or_create(
                user=user,
                defaults={
                    "supervisor_id": f"GV{idx:03d}",
                    "department_name": data["dept"],
                    "academic_title": data["title"],
                    "phone_number": f"0912345{idx:03d}",
                }
            )
            supervisor_objs.append(supervisor)
            if u_created:
                self.stdout.write(f"Created Supervisor: {data['username']}")

        # Pre-defined Students (25)
        topics = [
            "Hệ thống quản lý điểm sinh viên UTC",
            "Ứng dụng điểm danh bằng khuôn mặt sinh viên",
            "Xây dựng website bán sách trực tuyến",
            "Nghiên cứu và ứng dụng Blockchain trong giáo dục",
            "Dự báo giá chứng khoán dùng Machine Learning",
            "Phân tích dữ liệu giao thông tại Hà Nội",
            "Xây dựng ứng dụng quản lý nhà trọ cho sinh viên",
            "Hệ thống hỗ trợ chẩn đoán bệnh da liễu",
            "Mạng xã hội chia sẻ tài liệu học tập UTC",
            "Ứng dụng AI trong nhận diện phương tiện giao thông",
            "Nghiên cứu và phát triển hệ thống Smart Home",
            "Quản lý thư viện số sử dụng công nghệ Cloud",
            "Phát hiện tin giả tiếng Việt trên mạng xã hội",
            "Xây dựng chatbot tư vấn tuyển sinh UTC",
            "Hệ thống đánh giá giảng viên tự động",
            "Phân tích cảm xúc văn bản bằng Deep Learning",
            "Phát triển game giáo dục trên nền tảng di động",
            "Hệ thống gợi ý môn học tự chọn cho sinh viên",
            "Nghiên cứu an toàn thông tin trong IoT",
            "Ứng dụng phân tích dữ liệu bán lẻ đa kênh",
            "Hệ thống giám sát chất lượng không khí",
            "Mô hình học máy dự báo thời tiết cục bộ",
            "Hệ thống định tuyến xe buýt thông minh",
            "Ứng dụng quản lý thời gian và năng suất làm việc",
            "Nền tảng thi trực tuyến chống gian lận"
        ]

        for i in range(1, 26):
            reg_no = f"625105{i:03d}"
            username = f"sv.{reg_no}"
            email = f"sv{reg_no}@st.utc.edu.vn"
            full_name = f"Sinh viên Demo {i}"
            
            user, u_created = CustomUser.objects.get_or_create(
                username=username,
                defaults={
                    "email": email,
                    "password": make_password("UTC@123"),
                    "user_type": "student",
                    "first_name": full_name,
                }
            )
            
            student, _ = Student.objects.get_or_create(
                user=user,
                defaults={
                    "registration_no": reg_no,
                    "department": "CNTT",
                    "semester": "8",
                    "batch_no": "K62",
                    "academic_batch": batch,
                    "phone_number": f"0987654{i:03d}"
                }
            )

            # Assign a topic, supervisor and create GraduationProject
            assigned_supervisor = supervisor_objs[(i - 1) % len(supervisor_objs)]
            GraduationProject.objects.get_or_create(
                student=student,
                batch=batch,
                defaults={
                    "supervisor": assigned_supervisor,
                    "topic_title_vi": topics[i-1],
                    "topic_title_en": f"English Title for {topics[i-1]}",
                    "status": "APPROVED",
                    "defense_status": "WAITING",
                }
            )
            
            if u_created:
                self.stdout.write(f"Created Student: {username} ({reg_no})")

        self.stdout.write(self.style.SUCCESS('Successfully seeded UTC Demo Data!'))
