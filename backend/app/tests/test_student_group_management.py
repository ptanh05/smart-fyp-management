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
    GroupJoinRequest,
    Notification,
)

User = get_user_model()


class StudentGroupManagementTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.batch = AcademicBatch.objects.create(
            batch_code="K61-HK1", batch_name="Kỳ 1 Năm học 2026-2027", is_active=True
        )

        # Create students
        self.user1 = User.objects.create_user(
            username="student1", password="password123", user_type="student", first_name="Nguyen", last_name="An"
        )
        self.student1 = Student.objects.create(
            user=self.user1, registration_no="SV001", batch_no="K61", academic_batch=self.batch
        )

        self.user2 = User.objects.create_user(
            username="student2", password="password123", user_type="student", first_name="Tran", last_name="Binh"
        )
        self.student2 = Student.objects.create(
            user=self.user2, registration_no="SV002", batch_no="K61", academic_batch=self.batch
        )

        self.user3 = User.objects.create_user(
            username="student3", password="password123", user_type="student", first_name="Le", last_name="Cuong"
        )
        self.student3 = Student.objects.create(
            user=self.user3, registration_no="SV003", batch_no="K61", academic_batch=self.batch
        )

        self.user4 = User.objects.create_user(
            username="student4", password="password123", user_type="student", first_name="Pham", last_name="Dung"
        )
        self.student4 = Student.objects.create(
            user=self.user4, registration_no="SV004", batch_no="K61", academic_batch=self.batch
        )

        # Supervisor
        self.user_sup = User.objects.create_user(
            username="supervisor1", password="password123", user_type="supervisor", first_name="Dr", last_name="Hoang"
        )
        self.supervisor = Supervisor.objects.create(
            user=self.user_sup, supervisor_id="GV001", academic_title="TS"
        )

    # -------------------------------------------------------------------------
    # Feature 1: Xem danh sách nhóm đang mở tuyển thành viên
    # -------------------------------------------------------------------------
    def test_feature_01_view_recruiting_groups(self):
        # Create an open group
        group = Group.objects.create(
            group_name="Nhóm Nghiên cứu AI",
            academic_batch=self.batch,
            leader=self.student1,
            student_1=self.student1,
            status="accepted",
            max_members=3,
            is_recruiting=True,
            tentative_topic="Ứng dụng Học sâu trong Phân loại X-Ray",
        )
        GroupMember.objects.create(group=group, student=self.student1, role="LEADER")

        self.client.force_authenticate(user=self.user2)
        res = self.client.get("/app/student-groups/recruiting/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)
        item = res.data[0]
        self.assertEqual(item["group_name"], "Nhóm Nghiên cứu AI")
        self.assertEqual(item["current_members_count"], 1)
        self.assertEqual(item["max_members"], 3)
        self.assertEqual(item["tentative_topic"], "Ứng dụng Học sâu trong Phân loại X-Ray")
        self.assertIsNotNone(item["leader"])

    # -------------------------------------------------------------------------
    # Feature 2: Tạo nhóm mới thành công & trở thành Leader
    # -------------------------------------------------------------------------
    def test_feature_02_create_group_success_becomes_leader(self):
        self.client.force_authenticate(user=self.user1)
        payload = {
            "name": "Nhóm Web Cloud",
            "tentative_topic": "Hệ thống Quản lý Bệnh viện Microservices",
            "tentative_description": "Xây dựng với Spring Boot & React",
            "max_members": 3,
        }
        res = self.client.post("/app/student-groups/create/", payload)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertIn("thành công", res.data["message"])

        group = Group.objects.get(group_name="Nhóm Web Cloud")
        self.assertEqual(group.leader, self.student1)
        self.assertTrue(group.is_recruiting)

        # Member role check
        member = GroupMember.objects.get(group=group, student=self.student1)
        self.assertEqual(member.role, "LEADER")

    # -------------------------------------------------------------------------
    # Feature 3: Tạo nhóm tên để trống hoặc chỉ có khoảng trắng -> Báo lỗi
    # -------------------------------------------------------------------------
    def test_feature_03_create_group_empty_or_whitespace_name_rejected(self):
        self.client.force_authenticate(user=self.user1)

        # Empty name
        res1 = self.client.post("/app/student-groups/create/", {"name": ""})
        self.assertEqual(res1.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Tên nhóm không được để trống", str(res1.data))

        # Whitespace only
        res2 = self.client.post("/app/student-groups/create/", {"name": "     "})
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Tên nhóm không được để trống", str(res2.data))

    # -------------------------------------------------------------------------
    # Feature 4: Tạo nhóm với tên đã tồn tại trong cùng kỳ đồ án -> Báo lỗi
    # -------------------------------------------------------------------------
    def test_feature_04_create_group_duplicate_name_rejected(self):
        Group.objects.create(
            group_name="Nhóm Fintech",
            academic_batch=self.batch,
            leader=self.student1,
            student_1=self.student1,
            status="accepted",
        )
        GroupMember.objects.create(group=Group.objects.get(group_name="Nhóm Fintech"), student=self.student1, role="LEADER")

        self.client.force_authenticate(user=self.user2)
        res = self.client.post("/app/student-groups/create/", {"name": "Nhóm Fintech"})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Tên nhóm đã tồn tại, vui lòng chọn tên khác", res.data["message"])

    # -------------------------------------------------------------------------
    # Feature 5: Sinh viên đã có nhóm cố tình tạo thêm -> Chặn
    # -------------------------------------------------------------------------
    def test_feature_05_student_already_in_group_cannot_create_another(self):
        group = Group.objects.create(
            group_name="Nhóm A", academic_batch=self.batch, leader=self.student1, student_1=self.student1, status="accepted"
        )
        GroupMember.objects.create(group=group, student=self.student1, role="LEADER")

        self.client.force_authenticate(user=self.user1)
        res = self.client.post("/app/student-groups/create/", {"name": "Nhóm B"})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Bạn đã thuộc một nhóm đồ án, không thể tạo thêm", res.data["message"])

    # -------------------------------------------------------------------------
    # Feature 6: Xin gia nhập nhóm đang mở & Trưởng nhóm nhận thông báo
    # -------------------------------------------------------------------------
    def test_feature_06_request_to_join_notifies_leader(self):
        group = Group.objects.create(
            group_name="Nhóm DevOps", academic_batch=self.batch, leader=self.student1, student_1=self.student1, status="accepted", max_members=3
        )
        GroupMember.objects.create(group=group, student=self.student1, role="LEADER")

        self.client.force_authenticate(user=self.user2)
        res = self.client.post(f"/app/student-groups/{group.id}/join-request/", {"message": "Em có kinh nghiệm Docker/K8s"})
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        # Check request in DB
        join_req = GroupJoinRequest.objects.get(group=group, student=self.student2)
        self.assertEqual(join_req.status, "PENDING")

        # Check notification sent to leader
        notif = Notification.objects.filter(user=self.user1, notification_type="group_join_request").first()
        self.assertIsNotNone(notif)
        self.assertIn("xin gia nhập", notif.title)

    # -------------------------------------------------------------------------
    # Feature 7: Trưởng nhóm duyệt yêu cầu -> Thêm thành viên, cập nhật sĩ số
    # -------------------------------------------------------------------------
    def test_feature_07_leader_approves_join_request(self):
        group = Group.objects.create(
            group_name="Nhóm Game", academic_batch=self.batch, leader=self.student1, student_1=self.student1, status="accepted", max_members=2
        )
        GroupMember.objects.create(group=group, student=self.student1, role="LEADER")
        req = GroupJoinRequest.objects.create(group=group, student=self.student2, status="PENDING")

        self.client.force_authenticate(user=self.user1)
        res = self.client.post(f"/app/student-groups/join-requests/{req.id}/approve/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        req.refresh_from_db()
        self.assertEqual(req.status, "ACCEPTED")

        # Member added
        self.assertTrue(GroupMember.objects.filter(group=group, student=self.student2, role="MEMBER").exists())

        # Sĩ số đạt max (2) -> Tự động đóng tuyển
        group.refresh_from_db()
        self.assertEqual(group.current_members_count, 2)
        self.assertFalse(group.is_recruiting)

    # -------------------------------------------------------------------------
    # Feature 8: Trưởng nhóm từ chối yêu cầu gia nhập
    # -------------------------------------------------------------------------
    def test_feature_08_leader_rejects_join_request(self):
        group = Group.objects.create(
            group_name="Nhóm Mobile", academic_batch=self.batch, leader=self.student1, student_1=self.student1, status="accepted"
        )
        GroupMember.objects.create(group=group, student=self.student1, role="LEADER")
        req = GroupJoinRequest.objects.create(group=group, student=self.student2, status="PENDING")

        self.client.force_authenticate(user=self.user1)
        res = self.client.post(f"/app/student-groups/join-requests/{req.id}/reject/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        req.refresh_from_db()
        self.assertEqual(req.status, "REJECTED")

        # Member not added
        self.assertFalse(GroupMember.objects.filter(group=group, student=self.student2).exists())

    # -------------------------------------------------------------------------
    # Feature 9: Giới hạn số lượng thành viên tối đa (Max 2 hoặc 3)
    # -------------------------------------------------------------------------
    def test_feature_09_max_members_limit_blocks_overflow(self):
        # Group with max 2 members, already has 2
        group = Group.objects.create(
            group_name="Nhóm Full", academic_batch=self.batch, leader=self.student1, student_1=self.student1, status="accepted", max_members=2, is_recruiting=False
        )
        GroupMember.objects.create(group=group, student=self.student1, role="LEADER")
        GroupMember.objects.create(group=group, student=self.student2, role="MEMBER")

        # Student 3 tries to send join request
        self.client.force_authenticate(user=self.user3)
        res = self.client.post(f"/app/student-groups/{group.id}/join-request/")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Nhóm đã đủ số lượng thành viên tối đa", res.data["message"])

    # -------------------------------------------------------------------------
    # Feature 10: Trưởng nhóm xóa thành viên (Kick member)
    # -------------------------------------------------------------------------
    def test_feature_10_leader_kicks_member(self):
        group = Group.objects.create(
            group_name="Nhóm IoT", academic_batch=self.batch, leader=self.student1, student_1=self.student1, status="accepted", max_members=3
        )
        GroupMember.objects.create(group=group, student=self.student1, role="LEADER")
        GroupMember.objects.create(group=group, student=self.student2, role="MEMBER")

        self.client.force_authenticate(user=self.user1)
        res = self.client.post("/app/student-groups/kick-member/", {"member_id": self.student2.id})
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        # Student 2 is no longer in group
        self.assertFalse(GroupMember.objects.filter(group=group, student=self.student2).exists())
        group.refresh_from_db()
        self.assertEqual(group.current_members_count, 1)
        self.assertTrue(group.is_recruiting)

    # -------------------------------------------------------------------------
    # Feature 11: Thành viên tự rời nhóm khi chưa chốt đề tài
    # -------------------------------------------------------------------------
    def test_feature_11_member_leaves_group_before_topic_approval(self):
        group = Group.objects.create(
            group_name="Nhóm AI", academic_batch=self.batch, leader=self.student1, student_1=self.student1, status="accepted", topic_status="NOT_REGISTERED"
        )
        GroupMember.objects.create(group=group, student=self.student1, role="LEADER")
        GroupMember.objects.create(group=group, student=self.student2, role="MEMBER")

        self.client.force_authenticate(user=self.user2)
        res = self.client.post("/app/student-groups/leave/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("Rời nhóm thành công", res.data["message"])

        self.assertFalse(GroupMember.objects.filter(group=group, student=self.student2).exists())

    # -------------------------------------------------------------------------
    # Feature 12: Chặn rời nhóm khi đề tài đã được phê duyệt chính thức
    # -------------------------------------------------------------------------
    def test_feature_12_member_cannot_leave_after_topic_approved(self):
        group = Group.objects.create(
            group_name="Nhóm AI", academic_batch=self.batch, leader=self.student1, student_1=self.student1, status="accepted", topic_status="APPROVED"
        )
        GroupMember.objects.create(group=group, student=self.student1, role="LEADER")
        GroupMember.objects.create(group=group, student=self.student2, role="MEMBER")

        self.client.force_authenticate(user=self.user2)
        res = self.client.post("/app/student-groups/leave/")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Đề tài đã được phê duyệt chính thức, không thể tự ý rời nhóm", res.data["message"])

        # Member is still in group
        self.assertTrue(GroupMember.objects.filter(group=group, student=self.student2).exists())

    # -------------------------------------------------------------------------
    # Feature 13: Trưởng nhóm giải tán nhóm khi chưa đăng ký/duyệt đề tài
    # -------------------------------------------------------------------------
    def test_feature_13_leader_disbands_group(self):
        group = Group.objects.create(
            group_name="Nhóm Test Disband", academic_batch=self.batch, leader=self.student1, student_1=self.student1, status="accepted", topic_status="NOT_REGISTERED"
        )
        GroupMember.objects.create(group=group, student=self.student1, role="LEADER")
        GroupMember.objects.create(group=group, student=self.student2, role="MEMBER")

        self.client.force_authenticate(user=self.user1)
        res = self.client.post("/app/student-groups/disband/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("giải tán", res.data["message"])

        # Group deleted and members freed
        self.assertFalse(Group.objects.filter(group_name="Nhóm Test Disband").exists())
        self.assertFalse(GroupMember.objects.filter(student=self.student1).exists())
        self.assertFalse(GroupMember.objects.filter(student=self.student2).exists())

    # -------------------------------------------------------------------------
    # Feature 14: Trưởng nhóm chuyển quyền trưởng nhóm cho thành viên khác
    # -------------------------------------------------------------------------
    def test_feature_14_transfer_leadership(self):
        group = Group.objects.create(
            group_name="Nhóm Transfer", academic_batch=self.batch, leader=self.student1, student_1=self.student1, status="accepted"
        )
        GroupMember.objects.create(group=group, student=self.student1, role="LEADER")
        GroupMember.objects.create(group=group, student=self.student2, role="MEMBER")

        self.client.force_authenticate(user=self.user1)
        res = self.client.post("/app/student-groups/transfer-leadership/", {"new_leader_id": self.student2.id})
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        group.refresh_from_db()
        self.assertEqual(group.leader, self.student2)

        m1 = GroupMember.objects.get(group=group, student=self.student1)
        m2 = GroupMember.objects.get(group=group, student=self.student2)
        self.assertEqual(m1.role, "MEMBER")
        self.assertEqual(m2.role, "LEADER")

    # -------------------------------------------------------------------------
    # Feature 15: Chỉnh sửa đề xuất đề tài khi GVHD yêu cầu sửa -> "Chờ duyệt lại"
    # -------------------------------------------------------------------------
    def test_feature_15_update_topic_proposal_resubmits_to_pending(self):
        group = Group.objects.create(
            group_name="Nhóm BigData",
            academic_batch=self.batch,
            leader=self.student1,
            student_1=self.student1,
            status="accepted",
            tentative_topic="Hệ thống Cũ",
            topic_status="REVISION_REQUESTED",
            topic_revision_notes="Cần bổ sung phạm vi công nghệ Kafka & Flink",
        )
        GroupMember.objects.create(group=group, student=self.student1, role="LEADER")

        self.client.force_authenticate(user=self.user1)
        payload = {
            "topic_title": "Hệ thống Xử lý Dữ liệu Thời gian thực với Apache Kafka & Flink",
            "topic_description": "Đã bổ sung kiến trúc xử lý stream và pipeline Kafka theo yêu cầu của GVHD.",
        }
        res = self.client.post("/app/student-groups/update-topic/", payload)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("Chờ duyệt lại", res.data["message"])

        group.refresh_from_db()
        self.assertEqual(group.topic_status, "PENDING_REVIEW")
        self.assertEqual(group.tentative_topic, "Hệ thống Xử lý Dữ liệu Thời gian thực với Apache Kafka & Flink")
