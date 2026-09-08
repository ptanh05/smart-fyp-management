import logging
from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from .models import (
    Student,
    Supervisor,
    AcademicBatch,
    Group,
    GroupMember,
    GroupJoinRequest,
    GraduationProject,
)
from .serializers.serializers import (
    ProjectGroupSerializer,
    GroupJoinRequestSerializer,
    GroupMemberSerializer,
)
from .services import NotificationService

logger = logging.getLogger(__name__)


def get_current_student(user):
    """Helper to get student profile from authenticated user."""
    if user.user_type != "student":
        return None
    return getattr(user, "student_profile", None)


# ==============================================================================
# 1. LIST RECRUITING GROUPS (Feature 1, 9)
# ==============================================================================

class RecruitingGroupsAPIView(APIView):
    """
    Sinh viên chưa có nhóm xem danh sách các nhóm đang mở tuyển thành viên.
    Hiển thị: Tên nhóm, số lượng thành viên hiện tại/tối đa, tên trưởng nhóm, đề tài dự kiến.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        search = request.GET.get("search", "").strip()

        student = get_current_student(user)
        queryset = Group.objects.filter(is_recruiting=True).exclude(status="canceled")

        # Filter by student's batch if available
        if student and student.academic_batch:
            queryset = queryset.filter(
                Q(academic_batch=student.academic_batch) | Q(academic_batch__isnull=True)
            )

        # Search filter
        if search:
            queryset = queryset.filter(
                Q(group_name__icontains=search)
                | Q(tentative_topic__icontains=search)
                | Q(tentative_description__icontains=search)
                | Q(leader__user__first_name__icontains=search)
                | Q(leader__user__last_name__icontains=search)
                | Q(leader__registration_no__icontains=search)
            )

        # Only groups that have open slots
        groups = []
        for g in queryset.select_related("leader__user", "academic_batch").prefetch_related("members__student__user"):
            if g.current_members_count < g.max_members:
                groups.append(g)

        serializer = ProjectGroupSerializer(groups, many=True, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)


# ==============================================================================
# 2. CREATE NEW GROUP (Features 2, 3, 4, 5)
# ==============================================================================

class CreateStudentGroupAPIView(APIView):
    """
    Tạo nhóm đồ án mới:
    - Bắt lỗi tên nhóm để trống hoặc chỉ có khoảng trắng (Feature 3)
    - Bắt lỗi tên nhóm đã tồn tại trong cùng kỳ đồ án (Feature 4)
    - Bắt lỗi sinh viên đã có nhóm cố tình tạo thêm (Feature 5)
    - Tạo thành công -> sinh viên trở thành Trưởng nhóm (Leader) (Feature 2)
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        student = get_current_student(user)
        if not student:
            return Response(
                {"message": "Chỉ dành cho tài khoản sinh viên."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Feature 5: Kiểm tra sinh viên đã có nhóm chưa
        already_in_group = (
            GroupMember.objects.filter(student=student).exists()
            or Group.objects.filter(
                Q(student_1=student) | Q(student_2=student), status="accepted"
            ).exists()
        )
        if already_in_group:
            return Response(
                {"message": "Bạn đã thuộc một nhóm đồ án, không thể tạo thêm"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Feature 3: Tên nhóm không được để trống hoặc chỉ có khoảng trắng
        name = request.data.get("name", "").strip()
        if not name:
            return Response(
                {
                    "name": ["Tên nhóm không được để trống"],
                    "message": "Tên nhóm không được để trống",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Batch
        batch = student.academic_batch or AcademicBatch.objects.filter(is_active=True).first()

        # Feature 4: Tên nhóm đã tồn tại trong cùng kỳ đồ án
        dup_filter = Q(group_name__iexact=name)
        if batch:
            dup_filter &= Q(academic_batch=batch)
        if Group.objects.filter(dup_filter).exclude(status="canceled").exists():
            return Response(
                {"message": "Tên nhóm đã tồn tại, vui lòng chọn tên khác"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Feature 9: Sĩ số tối đa (Max 2 hoặc 3 tùy quy định)
        try:
            max_members = int(request.data.get("max_members", 3))
            if max_members not in (2, 3):
                max_members = 3
        except (ValueError, TypeError):
            max_members = 3

        tentative_topic = request.data.get("tentative_topic", "").strip()
        tentative_description = request.data.get("tentative_description", "").strip()

        with transaction.atomic():
            group = Group.objects.create(
                group_name=name,
                academic_batch=batch,
                leader=student,
                student_1=student,
                status="accepted",
                max_members=max_members,
                is_recruiting=True,
                tentative_topic=tentative_topic,
                tentative_description=tentative_description,
                topic_status="NOT_REGISTERED",
            )
            # Sinh viên trở thành Trưởng nhóm (Leader)
            GroupMember.objects.create(group=group, student=student, role="LEADER")

        return Response(
            {
                "message": f"Tạo nhóm '{group.group_name}' thành công! Bạn là Trưởng nhóm.",
                "group": ProjectGroupSerializer(group, context={"request": request}).data,
            },
            status=status.HTTP_201_CREATED,
        )


# ==============================================================================
# 3. GET CURRENT STUDENT'S GROUP (My Group)
# ==============================================================================

class MyStudentGroupAPIView(APIView):
    """Lấy thông tin nhóm hiện tại của sinh viên đang đăng nhập."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        student = get_current_student(user)
        if not student:
            return Response(
                {"message": "Chỉ dành cho tài khoản sinh viên."},
                status=status.HTTP_403_FORBIDDEN,
            )

        membership = GroupMember.objects.filter(student=student).select_related("group").first()
        if not membership:
            # Fallback to legacy group
            legacy_group = Group.objects.filter(
                Q(student_1=student) | Q(student_2=student), status="accepted"
            ).first()
            if not legacy_group:
                return Response(
                    {"has_group": False, "message": "Bạn chưa tham gia nhóm đồ án nào."},
                    status=status.HTTP_200_OK,
                )
            # Auto-migrate legacy members to GroupMember for consistency
            if not legacy_group.members.exists():
                if legacy_group.student_1:
                    GroupMember.objects.get_or_create(
                        group=legacy_group, student=legacy_group.student_1, defaults={"role": "LEADER"}
                    )
                if legacy_group.student_2:
                    GroupMember.objects.get_or_create(
                        group=legacy_group, student=legacy_group.student_2, defaults={"role": "MEMBER"}
                    )
                if not legacy_group.leader:
                    legacy_group.leader = legacy_group.student_1
                    legacy_group.save(update_fields=["leader"])
            group = legacy_group
        else:
            group = membership.group

        return Response(
            {
                "has_group": True,
                "group": ProjectGroupSerializer(group, context={"request": request}).data,
            },
            status=status.HTTP_200_OK,
        )


# ==============================================================================
# 4. REQUEST TO JOIN GROUP (Features 6, 9)
# ==============================================================================

class RequestToJoinGroupAPIView(APIView):
    """
    Sinh viên xin gia nhập một nhóm đang mở (Feature 6):
    - Kiểm tra sinh viên đã có nhóm chưa
    - Kiểm tra nhóm đã đủ sĩ số tối đa chưa (Feature 9)
    - Gửi yêu cầu gia nhập thành công -> Trưởng nhóm nhận được thông báo
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, group_id):
        user = request.user
        student = get_current_student(user)
        if not student:
            return Response(
                {"message": "Chỉ dành cho tài khoản sinh viên."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Check if student already in a group
        already_in_group = (
            GroupMember.objects.filter(student=student).exists()
            or Group.objects.filter(
                Q(student_1=student) | Q(student_2=student), status="accepted"
            ).exists()
        )
        if already_in_group:
            return Response(
                {"message": "Bạn đã thuộc một nhóm đồ án, không thể xin gia nhập nhóm khác"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        group = get_object_or_404(Group, id=group_id)

        # Feature 9: Kiểm tra giới hạn số lượng thành viên tối đa
        if group.members.count() >= group.max_members:
            return Response(
                {"message": "Nhóm đã đủ số lượng thành viên tối đa"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not group.is_recruiting:
            return Response(
                {"message": "Nhóm hiện đang đóng tuyển thành viên"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Check existing pending request
        existing_req = GroupJoinRequest.objects.filter(
            group=group, student=student, status="PENDING"
        ).first()
        if existing_req:
            return Response(
                {"message": "Bạn đã gửi yêu cầu gia nhập nhóm này rồi, vui lòng chờ duyệt."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        message = request.data.get("message", "").strip()
        join_req = GroupJoinRequest.objects.create(
            group=group, student=student, message=message, status="PENDING"
        )

        # Feature 6: Trưởng nhóm nhận thông báo
        NotificationService.notify_group_join_request(student, group)

        return Response(
            {
                "message": "Gửi yêu cầu xin gia nhập thành công! Vui lòng chờ Trưởng nhóm phê duyệt.",
                "request": GroupJoinRequestSerializer(join_req, context={"request": request}).data,
            },
            status=status.HTTP_201_CREATED,
        )


# ==============================================================================
# 5. MY SENT JOIN REQUESTS
# ==============================================================================

class MySentJoinRequestsAPIView(APIView):
    """Danh sách các yêu cầu xin gia nhập mà sinh viên hiện tại đã gửi."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        student = get_current_student(user)
        if not student:
            return Response([], status=status.HTTP_200_OK)

        requests = GroupJoinRequest.objects.filter(student=student).select_related("group").order_by("-created_at")
        return Response(
            GroupJoinRequestSerializer(requests, many=True, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )


# ==============================================================================
# 6. APPROVE JOIN REQUEST (Features 7, 9)
# ==============================================================================

class ApproveJoinRequestAPIView(APIView):
    """
    Trưởng nhóm duyệt yêu cầu xin gia nhập (Feature 7):
    - Sinh viên được thêm vào nhóm với vai trò Member
    - Cập nhật sĩ số thành viên trong nhóm
    - Kiểm tra nhóm đã đủ số lượng tối đa -> tự động đóng tuyển (Feature 9)
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, request_id):
        user = request.user
        student = get_current_student(user)
        if not student:
            return Response({"message": "Chỉ dành cho tài khoản sinh viên."}, status=status.HTTP_403_FORBIDDEN)

        join_req = get_object_or_404(GroupJoinRequest, id=request_id)
        group = join_req.group

        # Check leader permission
        is_leader = (group.leader == student) or (group.student_1 == student)
        if not is_leader:
            return Response(
                {"message": "Chỉ Trưởng nhóm mới có quyền phê duyệt yêu cầu gia nhập."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if join_req.status != "PENDING":
            return Response(
                {"message": f"Yêu cầu này đã ở trạng thái {join_req.get_status_display()}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Feature 9: Kiểm tra giới hạn thành viên tối đa
        if group.members.count() >= group.max_members:
            return Response(
                {"message": "Nhóm đã đủ số lượng thành viên tối đa"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        applicant = join_req.student

        # Check if applicant is already in another group
        applicant_in_group = (
            GroupMember.objects.filter(student=applicant).exists()
            or Group.objects.filter(
                Q(student_1=applicant) | Q(student_2=applicant), status="accepted"
            ).exists()
        )
        if applicant_in_group:
            join_req.status = "CANCELED"
            join_req.save()
            return Response(
                {"message": "Sinh viên này đã tham gia một nhóm khác."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            join_req.status = "ACCEPTED"
            join_req.save()

            GroupMember.objects.create(group=group, student=applicant, role="MEMBER")

            # Update legacy student_2 if empty
            if not group.student_2:
                group.student_2 = applicant

            # Cập nhật sĩ số và đóng tuyển nếu đã đầy
            if group.members.count() >= group.max_members:
                group.is_recruiting = False
            group.save()

            # Hủy các request xin gia nhập khác của sinh viên này
            GroupJoinRequest.objects.filter(student=applicant, status="PENDING").exclude(
                id=join_req.id
            ).update(status="CANCELED")

            # Gửi thông báo đến sinh viên được duyệt
            NotificationService.notify_group_join_response(join_req, accepted=True)

        return Response(
            {
                "message": f"Đã phê duyệt sinh viên {applicant.user.get_full_name() or applicant.user.username} vào nhóm!",
                "group": ProjectGroupSerializer(group, context={"request": request}).data,
            },
            status=status.HTTP_200_OK,
        )


# ==============================================================================
# 7. REJECT JOIN REQUEST (Feature 8)
# ==============================================================================

class RejectJoinRequestAPIView(APIView):
    """
    Trưởng nhóm từ chối yêu cầu xin gia nhập (Feature 8):
    - Sinh viên nhận thông báo bị từ chối
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, request_id):
        user = request.user
        student = get_current_student(user)
        if not student:
            return Response({"message": "Chỉ dành cho tài khoản sinh viên."}, status=status.HTTP_403_FORBIDDEN)

        join_req = get_object_or_404(GroupJoinRequest, id=request_id)
        group = join_req.group

        is_leader = (group.leader == student) or (group.student_1 == student)
        if not is_leader:
            return Response(
                {"message": "Chỉ Trưởng nhóm mới có quyền từ chối yêu cầu gia nhập."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if join_req.status != "PENDING":
            return Response(
                {"message": f"Yêu cầu này đã ở trạng thái {join_req.get_status_display()}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        join_req.status = "REJECTED"
        join_req.save()

        # Sinh viên nhận thông báo bị từ chối
        NotificationService.notify_group_join_response(join_req, accepted=False)

        return Response(
            {"message": "Đã từ chối yêu cầu xin gia nhập."},
            status=status.HTTP_200_OK,
        )


# ==============================================================================
# 8. KICK MEMBER (Feature 10)
# ==============================================================================

class KickGroupMemberAPIView(APIView):
    """
    Trưởng nhóm xóa thành viên khỏi nhóm (Feature 10):
    - Thành viên bị xóa khỏi nhóm, trạng thái trở về chưa có nhóm
    - Sĩ số nhóm giảm đi 1, nhóm mở lại tuyển nếu chưa đầy
    - Sinh viên nhận thông báo
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        student = get_current_student(user)
        if not student:
            return Response({"message": "Chỉ dành cho tài khoản sinh viên."}, status=status.HTTP_403_FORBIDDEN)

        member_id = request.data.get("member_id")
        if not member_id:
            return Response({"message": "Vui lòng chỉ định thành viên cần xóa."}, status=status.HTTP_400_BAD_REQUEST)

        target_student = get_object_or_404(Student, id=member_id)

        # Find the group led by current student
        group = Group.objects.filter(
            Q(leader=student) | Q(student_1=student),
            members__student=student,
            members__role="LEADER",
        ).distinct().first()

        if not group:
            return Response(
                {"message": "Chỉ Trưởng nhóm mới có quyền xóa thành viên."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if target_student == student:
            return Response(
                {"message": "Trưởng nhóm không thể tự xóa chính mình khỏi nhóm."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Check if target is a member
        target_membership = GroupMember.objects.filter(group=group, student=target_student).first()
        if not target_membership:
            return Response(
                {"message": "Thành viên này không thuộc nhóm của bạn."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # If topic approved officially, kicking is locked
        if group.topic_status == "APPROVED":
            return Response(
                {"message": "Đề tài đã được phê duyệt chính thức, không thể xóa thành viên. Vui lòng liên hệ giảng viên/quản trị viên."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            target_membership.delete()

            if group.student_2 == target_student:
                # Replace student_2 with another member if any, or None
                other_member = group.members.exclude(student=student).first()
                group.student_2 = other_member.student if other_member else None

            # Open recruitment if slots available
            if group.members.count() < group.max_members:
                group.is_recruiting = True
            group.save()

            # Thông báo cho thành viên bị kick
            NotificationService.notify_group_member_kicked(target_student, group)

        return Response(
            {
                "message": f"Đã xóa thành viên {target_student.user.get_full_name() or target_student.user.username} khỏi nhóm.",
                "group": ProjectGroupSerializer(group, context={"request": request}).data,
            },
            status=status.HTTP_200_OK,
        )


# ==============================================================================
# 9. LEAVE GROUP (Features 11, 12)
# ==============================================================================

class LeaveGroupAPIView(APIView):
    """
    Thành viên tự rời khỏi nhóm:
    - Feature 11: Khi nhóm chưa chốt đề tài -> Rời nhóm thành công, nhóm giảm sĩ số
    - Feature 12: Khi đề tài đã được phê duyệt chính thức -> Hệ thống chặn và yêu cầu liên hệ GV/Admin
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        student = get_current_student(user)
        if not student:
            return Response({"message": "Chỉ dành cho tài khoản sinh viên."}, status=status.HTTP_403_FORBIDDEN)

        membership = GroupMember.objects.filter(student=student).select_related("group").first()
        if not membership:
            return Response({"message": "Bạn hiện không thuộc nhóm đồ án nào."}, status=status.HTTP_400_BAD_REQUEST)

        group = membership.group

        # Leader cannot use leave group (must transfer leadership or disband)
        if membership.role == "LEADER" or group.leader == student:
            return Response(
                {"message": "Trưởng nhóm không thể tự rời nhóm. Vui lòng chuyển quyền Trưởng nhóm trước hoặc giải tán nhóm."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Feature 12: Chặn rời nhóm khi đề tài đã được phê duyệt chính thức
        if group.topic_status == "APPROVED":
            return Response(
                {"message": "Đề tài đã được phê duyệt chính thức, không thể tự ý rời nhóm. Vui lòng liên hệ giảng viên/quản trị viên để giải quyết."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Feature 11: Rời nhóm thành công khi chưa chốt đề tài
        with transaction.atomic():
            membership.delete()

            if group.student_2 == student:
                group.student_2 = None

            if group.members.count() < group.max_members:
                group.is_recruiting = True
            group.save()

            # Thông báo cho trưởng nhóm
            NotificationService.notify_group_member_left(student, group)

        return Response(
            {"message": "Rời nhóm thành công! Bạn đã trở về trạng thái chưa có nhóm."},
            status=status.HTTP_200_OK,
        )


# ==============================================================================
# 10. DISBAND GROUP (Feature 13)
# ==============================================================================

class DisbandGroupAPIView(APIView):
    """
    Trưởng nhóm giải tán nhóm khi chưa đăng ký đề tài (Feature 13):
    - Tất cả thành viên trở về trạng thái tự do
    - Nhóm bị xóa khỏi hệ thống
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        student = get_current_student(user)
        if not student:
            return Response({"message": "Chỉ dành cho tài khoản sinh viên."}, status=status.HTTP_403_FORBIDDEN)

        membership = GroupMember.objects.filter(student=student, role="LEADER").select_related("group").first()
        if not membership:
            return Response(
                {"message": "Chỉ Trưởng nhóm mới có quyền giải tán nhóm."},
                status=status.HTTP_403_FORBIDDEN,
            )

        group = membership.group

        # Block if topic is approved
        if group.topic_status == "APPROVED":
            return Response(
                {"message": "Đề tài đã được phê duyệt chính thức, không thể giải tán nhóm. Vui lòng liên hệ quản trị viên."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        group_name = group.group_name or f"Nhóm #{group.id}"

        with transaction.atomic():
            # Notify members
            all_members = list(group.members.select_related("student__user").all())
            for m in all_members:
                if m.student != student:
                    NotificationService.notify_group_disbanded(m.student.user, group_name)

            group.join_requests.all().delete()
            group.members.all().delete()
            group.status = "canceled"
            group.is_recruiting = False
            group.delete()

        return Response(
            {"message": f"Nhóm '{group_name}' đã được giải tán. Tất cả thành viên trở về trạng thái tự do."},
            status=status.HTTP_200_OK,
        )


# ==============================================================================
# 11. TRANSFER LEADERSHIP (Feature 14)
# ==============================================================================

class TransferLeadershipAPIView(APIView):
    """
    Trưởng nhóm chuyển quyền trưởng nhóm cho thành viên khác (Feature 14):
    - Quyền Leader cập nhật cho thành viên mới, Leader cũ trở thành Member
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        student = get_current_student(user)
        if not student:
            return Response({"message": "Chỉ dành cho tài khoản sinh viên."}, status=status.HTTP_403_FORBIDDEN)

        new_leader_id = request.data.get("new_leader_id")
        if not new_leader_id:
            return Response({"message": "Vui lòng chọn thành viên để chuyển quyền."}, status=status.HTTP_400_BAD_REQUEST)

        group = Group.objects.filter(
            Q(leader=student) | Q(student_1=student),
            members__student=student,
            members__role="LEADER",
        ).distinct().first()

        if not group:
            return Response(
                {"message": "Chỉ Trưởng nhóm mới có quyền chuyển giao vai trò."},
                status=status.HTTP_403_FORBIDDEN,
            )

        new_leader = get_object_or_404(Student, id=new_leader_id)
        if new_leader == student:
            return Response({"message": "Bạn đã là Trưởng nhóm rồi."}, status=status.HTTP_400_BAD_REQUEST)

        new_leader_membership = GroupMember.objects.filter(group=group, student=new_leader).first()
        if not new_leader_membership:
            return Response({"message": "Thành viên được chọn không thuộc nhóm này."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            # Update roles
            GroupMember.objects.filter(group=group, student=student).update(role="MEMBER")
            new_leader_membership.role = "LEADER"
            new_leader_membership.save()

            group.leader = new_leader
            group.student_1 = new_leader
            group.save(update_fields=["leader", "student_1"])

            # Thông báo
            NotificationService.notify_leadership_transferred(student, new_leader, group)

        return Response(
            {
                "message": f"Chuyển quyền Trưởng nhóm cho {new_leader.user.get_full_name() or new_leader.user.username} thành công!",
                "group": ProjectGroupSerializer(group, context={"request": request}).data,
            },
            status=status.HTTP_200_OK,
        )


# ==============================================================================
# 12. UPDATE / RESUBMIT TOPIC PROPOSAL (Feature 15)
# ==============================================================================

class UpdateTopicProposalAPIView(APIView):
    """
    Chỉnh sửa nội dung đề xuất đề tài khi GVHD yêu cầu chỉnh sửa (Feature 15):
    - Form cho phép sửa các thông tin cần bổ sung
    - Bấm 'Cập nhật đề xuất' -> Trạng thái chuyển về 'Chờ duyệt lại' (PENDING_REVIEW)
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        student = get_current_student(user)
        if not student:
            return Response({"message": "Chỉ dành cho tài khoản sinh viên."}, status=status.HTTP_403_FORBIDDEN)

        membership = GroupMember.objects.filter(student=student).select_related("group").first()
        if not membership:
            return Response({"message": "Bạn chưa có nhóm để cập nhật đề tài."}, status=status.HTTP_400_BAD_REQUEST)

        group = membership.group

        topic_title = request.data.get("topic_title", "").strip()
        topic_description = request.data.get("topic_description", "").strip()

        if not topic_title:
            return Response(
                {"topic_title": ["Vui lòng nhập tên đề tài đề xuất."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            group.tentative_topic = topic_title
            group.tentative_description = topic_description
            # Chuyển trạng thái về Chờ duyệt lại (PENDING_REVIEW)
            group.topic_status = "PENDING_REVIEW"
            group.save(update_fields=["tentative_topic", "tentative_description", "topic_status"])

            # Also sync with individual GraduationProject if existing
            grad_proj = GraduationProject.objects.filter(student=student).first()
            if grad_proj:
                grad_proj.topic_title_vi = topic_title
                grad_proj.status = "OUTLINE_PENDING"
                grad_proj.save(update_fields=["topic_title_vi", "status"])

            # If supervisor is assigned, notify supervisor
            supervisor = getattr(group, "supervisor", None)
            if supervisor:
                NotificationService.notify_topic_revision_resubmitted(group, supervisor)

        return Response(
            {
                "message": "Cập nhật đề xuất đề tài thành công! Trạng thái chuyển về 'Chờ duyệt lại'.",
                "group": ProjectGroupSerializer(group, context={"request": request}).data,
            },
            status=status.HTTP_200_OK,
        )


# ==============================================================================
# 13. SUPERVISOR TOPIC REVIEW (Review & Request Revision)
# ==============================================================================

class SupervisorTopicReviewAPIView(APIView):
    """
    Dành cho GVHD hoặc Quản trị viên xét duyệt đề tài của nhóm:
    - APPROVED: Duyệt đề tài
    - REVISION_REQUESTED: Yêu cầu chỉnh sửa (kèm ghi chú/nhận xét)
    - REJECTED: Từ chối
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, group_id):
        user = request.user
        if user.user_type not in ("supervisor", "committee_member", "admin"):
            return Response({"message": "Không có quyền thực hiện thao tác này."}, status=status.HTTP_403_FORBIDDEN)

        group = get_object_or_404(Group, id=group_id)
        verdict = request.data.get("verdict")  # APPROVED, REVISION_REQUESTED, REJECTED
        notes = request.data.get("notes", "").strip()

        if verdict not in ("APPROVED", "REVISION_REQUESTED", "REJECTED"):
            return Response({"message": "Kết quả xét duyệt không hợp lệ."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            group.topic_status = verdict
            group.topic_revision_notes = notes
            group.save(update_fields=["topic_status", "topic_revision_notes"])

            # Notify group members
            leader = group.leader or group.student_1
            if leader:
                NotificationService.create_notification(
                    user=leader.user,
                    notification_type="general",
                    title="Cập nhật kết quả xét duyệt đề tài",
                    message=f"Đề tài của nhóm bạn đã được cập nhật trạng thái: {group.get_topic_status_display()}.",
                    related_group=group,
                    action_url="/student/dashboard?tab=groups",
                )

        return Response(
            {
                "message": f"Đã cập nhật trạng thái đề tài nhóm: {group.get_topic_status_display()}",
                "group": ProjectGroupSerializer(group, context={"request": request}).data,
            },
            status=status.HTTP_200_OK,
        )
