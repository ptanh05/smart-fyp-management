from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from app.models import (
    Student,
    Supervisor,
    AcademicBatch,
    Group,
    GroupMember,
    GraduationProject,
    SupervisionMeetingLog,
    SupervisionTask,
    Notification,
)

User = get_user_model()


class GroupAndSupervisionNewFeaturesTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.batch = AcademicBatch.objects.create(
            batch_code="K61-TEST", batch_name="Kỳ 1 2026-2027", is_active=True
        )

        # Leader student
        self.user_leader = User.objects.create_user(
            username="leader_std", password="password123", user_type="student", first_name="Minh", last_name="Tran"
        )
        self.student_leader = Student.objects.create(
            user=self.user_leader, registration_no="SV010", batch_no="K61", academic_batch=self.batch
        )

        # Member student
        self.user_member = User.objects.create_user(
            username="member_std", password="password123", user_type="student", first_name="Lan", last_name="Nguyen"
        )
        self.student_member = Student.objects.create(
            user=self.user_member, registration_no="SV011", batch_no="K61", academic_batch=self.batch
        )

        # Another group leader for conflict testing
        self.user_other = User.objects.create_user(
            username="other_std", password="password123", user_type="student", first_name="Dung", last_name="Le"
        )
        self.student_other = Student.objects.create(
            user=self.user_other, registration_no="SV012", batch_no="K61", academic_batch=self.batch
        )

        # Supervisor
        self.user_sup = User.objects.create_user(
            username="supervisor_utc", password="password123", user_type="supervisor", first_name="Thay", last_name="Hung"
        )
        self.supervisor = Supervisor.objects.create(
            user=self.user_sup, supervisor_id="GV099", academic_title="PGS.TS"
        )

        # Create Group
        self.group = Group.objects.create(
            group_name="Nhóm Đồ Án 1",
            academic_batch=self.batch,
            leader=self.student_leader,
            student_1=self.student_leader,
            is_recruiting=True,
            max_members=3,
        )
        GroupMember.objects.create(group=self.group, student=self.student_leader, role="LEADER")
        GroupMember.objects.create(group=self.group, student=self.student_member, role="MEMBER")

        # Create Another Group in same batch
        self.group2 = Group.objects.create(
            group_name="Nhóm Đồ Án 2",
            academic_batch=self.batch,
            leader=self.student_other,
            student_1=self.student_other,
            is_recruiting=True,
            max_members=3,
        )
        GroupMember.objects.create(group=self.group2, student=self.student_other, role="LEADER")

        # Create Graduation Project for student_leader
        self.grad_project = GraduationProject.objects.create(
            student=self.student_leader,
            supervisor=self.supervisor,
            batch=self.batch,
            topic_title_vi="Hệ thống quản lý đồ án thông minh Smart FYP",
            status="IN_PROGRESS",
        )

    # --------------------------------------------------------------------------
    # Feature 1: Trưởng nhóm cập nhật lại tên nhóm đồ án
    # --------------------------------------------------------------------------
    def test_leader_rename_group_success(self):
        """Trưởng nhóm nhập tên nhóm mới hợp lệ -> Lưu -> Tên nhóm cập nhật trên toàn hệ thống."""
        self.client.force_authenticate(user=self.user_leader)
        res = self.client.post("/app/student-groups/rename/", {"name": "Nhóm Vô Địch CNTT"})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.group.refresh_from_db()
        self.assertEqual(self.group.group_name, "Nhóm Vô Địch CNTT")

        # Check member received notification
        notif = Notification.objects.filter(user=self.user_member, title="Nhóm đổi tên").first()
        self.assertIsNotNone(notif)
        self.assertIn("Nhóm Vô Địch CNTT", notif.message)

    def test_member_cannot_rename_group(self):
        """Thành viên bình thường không có quyền đổi tên nhóm."""
        self.client.force_authenticate(user=self.user_member)
        res = self.client.post("/app/student-groups/rename/", {"name": "Tên Bất Hợp Pháp"})
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.group.refresh_from_db()
        self.assertEqual(self.group.group_name, "Nhóm Đồ Án 1")

    def test_rename_group_invalid_name(self):
        """Tên nhóm rỗng hoặc dưới 3 ký tự bị từ chối."""
        self.client.force_authenticate(user=self.user_leader)
        res = self.client.post("/app/student-groups/rename/", {"name": "   "})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

        res2 = self.client.post("/app/student-groups/rename/", {"name": "AB"})
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)

    def test_rename_group_duplicate_name_rejected(self):
        """Tên nhóm trùng với nhóm khác trong cùng đợt bị từ chối."""
        self.client.force_authenticate(user=self.user_leader)
        res = self.client.post("/app/student-groups/rename/", {"name": "Nhóm Đồ Án 2"})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("đã tồn tại", res.data["message"])

    # --------------------------------------------------------------------------
    # Feature 2: Giảng viên gửi thông báo chung cho tất cả các nhóm mình hướng dẫn
    # --------------------------------------------------------------------------
    def test_supervisor_broadcast_announcement(self):
        """Giảng viên gửi thông báo chung -> Toàn bộ sinh viên nhận được thông báo."""
        self.client.force_authenticate(user=self.user_sup)
        res = self.client.post(
            "/app/supervisor/broadcast-announcement/",
            {
                "title": "Hạn chót nộp đề cương bản nháp",
                "message": "Các nhóm chú ý nộp đề cương trước ngày thứ Sáu tuần này để thầy duyệt.",
            },
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(res.data["recipient_count"], 1)

        # Verify student received notification
        notif = Notification.objects.filter(
            user=self.user_leader,
            title__contains="Hạn chót nộp đề cương",
        ).first()
        self.assertIsNotNone(notif)
        self.assertIn("thứ Sáu tuần này", notif.message)

    def test_supervisor_broadcast_validation(self):
        """Tiêu đề hoặc nội dung để trống bị từ chối."""
        self.client.force_authenticate(user=self.user_sup)
        res = self.client.post("/app/supervisor/broadcast-announcement/", {"title": "", "message": ""})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    # --------------------------------------------------------------------------
    # Feature 3, 4, 5: Online Meeting Link & Supervision Meeting Log with Tasks
    # --------------------------------------------------------------------------
    def test_supervisor_create_online_meeting_and_task(self):
        """
        Giảng viên tạo lịch gặp trực tuyến (Google Meet) và ghi chú nhật ký hướng dẫn kèm giao việc tuần tới.
        Sinh viên xem được link cuộc họp và nhiệm vụ.
        """
        self.client.force_authenticate(user=self.user_sup)
        res = self.client.post(
            "/app/supervisor/supervision-logs/",
            {
                "project_id": self.grad_project.id,
                "meeting_date": "2026-09-15",
                "meeting_time": "09:00 - 10:30",
                "meeting_type": "ONLINE",
                "location_or_link": "https://meet.google.com/abc-defg-hij",
                "content_discussed": "Rà soát biểu đồ Use Case và thiết kế cơ sở dữ liệu",
                "supervisor_notes": "Sinh viên nắm chắc yêu cầu, cần cải thiện hiệu năng truy vấn",
                "next_meeting_plan": "Kiểm thử API và báo cáo tiến độ tuần sau",
                "task_title": "Hoàn thiện 5 API xác thực và tài liệu Postman",
                "task_description": "Viết unit test cho phân hệ auth và tài liệu Swagger",
                "task_due_date": "2026-09-22",
                "task_priority": "HIGH",
            },
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertIn("log", res.data)
        log_data = res.data["log"]
        self.assertEqual(log_data["meeting_type"], "ONLINE")
        self.assertEqual(log_data["location_or_link"], "https://meet.google.com/abc-defg-hij")

        # Verify task was created linked to the log
        task = SupervisionTask.objects.filter(project=self.grad_project, title__contains="5 API xác thực").first()
        self.assertIsNotNone(task)
        self.assertEqual(task.priority, "HIGH")
        self.assertEqual(str(task.due_date), "2026-09-22")

        # Verify student notification contains meeting link
        meet_notif = Notification.objects.filter(
            user=self.user_leader,
            title__contains="Lịch họp trực tuyến",
        ).first()
        self.assertIsNotNone(meet_notif)
        self.assertIn("https://meet.google.com/abc-defg-hij", meet_notif.message)

        # Student queries meeting logs
        self.client.force_authenticate(user=self.user_leader)
        student_res = self.client.get("/app/student/supervision-logs/")
        self.assertEqual(student_res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(student_res.data), 1)
        self.assertEqual(student_res.data[0]["location_or_link"], "https://meet.google.com/abc-defg-hij")
        self.assertEqual(student_res.data[0]["meeting_type"], "ONLINE")
        self.assertEqual(len(student_res.data[0]["tasks"]), 1)
        self.assertEqual(student_res.data[0]["tasks"][0]["title"], "Hoàn thiện 5 API xác thực và tài liệu Postman")
