import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from .models import (
    Student,
    Supervisor,
    CustomUser,
    GraduationProject,
    SupervisorGroupChatMessage,
    Notification,
)

logger = logging.getLogger(__name__)


def get_user_supervisor(user):
    """
    Returns the Supervisor object associated with this user:
    - If user is supervisor, returns user.supervisor_profile
    - If user is student, returns student's graduation_project.supervisor
    """
    if getattr(user, "user_type", None) == "supervisor":
        return getattr(user, "supervisor_profile", None)
    
    if getattr(user, "user_type", None) == "student":
        student = getattr(user, "student_profile", None)
        if not student:
            student = Student.objects.filter(user=user).first()
        if student:
            project = getattr(student, "graduation_project", None)
            if not project:
                project = GraduationProject.objects.filter(student=student).first()
            if project and project.supervisor:
                return project.supervisor
    return None


class SupervisorGroupInfoAPIView(APIView):
    """
    Lấy thông tin nhóm đồ án theo Giảng viên hướng dẫn (UTC Cohort).
    Hiển thị thông tin GVHD và toàn bộ sinh viên đang được GVHD này hướng dẫn.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        supervisor = get_user_supervisor(user)

        if not supervisor:
            return Response(
                {
                    "has_group": False,
                    "message": "Bạn chưa được phân công Giảng viên Hướng dẫn. Hãy điền khảo sát hoặc liên hệ Khoa.",
                },
                status=status.HTTP_200_OK,
            )

        # Lấy danh sách toàn bộ đề tài / sinh viên được hướng dẫn bởi GVHD này
        projects = (
            GraduationProject.objects.filter(supervisor=supervisor)
            .select_related("student", "student__user")
            .order_by("student__registration_no")
        )

        members = []
        for p in projects:
            s = p.student
            if not s:
                continue
            u = s.user
            full_name = f"{u.first_name} {u.last_name}".strip() or u.username
            members.append(
                {
                    "student_id": s.id,
                    "user_id": u.id,
                    "username": u.username,
                    "full_name": full_name,
                    "registration_no": s.registration_no,
                    "department": s.department or "Khoa CNTT",
                    "email": u.email,
                    "phone": getattr(s, "phone_number", "") or "",
                    "topic_title": p.topic_title_vi or p.topic_title_en or "Chưa đăng ký đề tài",
                    "status": p.get_status_display() if hasattr(p, "get_status_display") else p.status,
                    "review_status": p.topic_review_status,
                    "is_current_user": (u.id == user.id),
                }
            )

        sup_user = supervisor.user
        sup_name = f"{supervisor.academic_title or 'ThS'} {sup_user.first_name} {sup_user.last_name}".strip() if (sup_user.first_name or sup_user.last_name) else sup_user.username
        if supervisor.academic_title and not sup_name.startswith(supervisor.academic_title):
            sup_name = f"{supervisor.academic_title} {sup_name}"

        return Response(
            {
                "has_group": True,
                "group_name": f"Nhóm Đồ Án - {sup_name}",
                "supervisor": {
                    "id": supervisor.id,
                    "user_id": sup_user.id,
                    "name": sup_name,
                    "academic_title": supervisor.academic_title or "GVHD",
                    "department": supervisor.department_name or "Khoa Công Nghệ Thông Tin",
                    "email": sup_user.email,
                    "research_interest": supervisor.research_interest or "",
                },
                "members": members,
                "total_members": len(members),
            },
            status=status.HTTP_200_OK,
        )


class SupervisorGroupChatMessagesAPIView(APIView):
    """
    Quản lý tin nhắn trong nhóm đồ án chung của GVHD:
    - GET: Danh sách tin nhắn trong nhóm
    - POST: Gửi tin nhắn mới (kèm file nếu có) và tạo thông báo cho các thành viên
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        supervisor = get_user_supervisor(user)

        if not supervisor:
            return Response(
                {"detail": "Bạn không thuộc nhóm GVHD nào để xem đoạn chat."},
                status=status.HTTP_404_NOT_FOUND,
            )

        messages_qs = (
            SupervisorGroupChatMessage.objects.filter(supervisor=supervisor)
            .select_related("sender")
            .order_by("created_at")
        )

        results = []
        for msg in messages_qs:
            sender = msg.sender
            sender_name = f"{sender.first_name} {sender.last_name}".strip() or sender.username
            role = "supervisor" if sender.user_type == "supervisor" else "student"
            role_label = (supervisor.academic_title or "GVHD") if role == "supervisor" else "Sinh viên"

            results.append(
                {
                    "id": msg.id,
                    "sender_id": sender.id,
                    "sender_username": sender.username,
                    "sender_name": sender_name,
                    "sender_role": role,
                    "sender_role_label": role_label,
                    "message": msg.message,
                    "attachment": msg.attachment.url if msg.attachment else None,
                    "attachment_name": msg.attachment_name,
                    "attachment_type": msg.attachment_type,
                    "attachment_size": msg.attachment_size,
                    "created_at": msg.created_at.isoformat(),
                    "is_me": (sender.id == user.id),
                }
            )

        return Response(results, status=status.HTTP_200_OK)

    def post(self, request):
        user = request.user
        supervisor = get_user_supervisor(user)

        if not supervisor:
            return Response(
                {"detail": "Bạn không có quyền gửi tin nhắn vì chưa được gán GVHD."},
                status=status.HTTP_403_FORBIDDEN,
            )

        data = getattr(request, "data", request.POST)
        message_text = data.get("message", "").strip()
        attachment = request.FILES.get("attachment")

        if not message_text and not attachment:
            return Response(
                {"detail": "Nội dung tin nhắn hoặc tệp đính kèm không được để trống."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        attachment_name = None
        attachment_type = None
        attachment_size = None
        if attachment:
            attachment_name = attachment.name
            attachment_size = attachment.size
            attachment_type = getattr(attachment, "content_type", None) or ""

        new_msg = SupervisorGroupChatMessage.objects.create(
            supervisor=supervisor,
            sender=user,
            message=message_text,
            attachment=attachment,
            attachment_name=attachment_name,
            attachment_type=attachment_type,
            attachment_size=attachment_size,
        )

        sender_name = f"{user.first_name} {user.last_name}".strip() or user.username
        role = "supervisor" if user.user_type == "supervisor" else "student"
        role_label = (supervisor.academic_title or "GVHD") if role == "supervisor" else "Sinh viên"

        # Bắn thông báo hệ thống cho các thành viên còn lại
        try:
            summary = message_text[:80] + ("..." if len(message_text) > 80 else "")
            if not summary and attachment_name:
                summary = f"[Đã gửi tệp: {attachment_name}]"

            # 1. Nếu sinh viên gửi -> Thông báo cho GVHD
            if role == "student" and supervisor.user_id != user.id:
                Notification.objects.create(
                    user=supervisor.user,
                    title=f"💬 [Tin nhắn Nhóm ĐATN] {sender_name}",
                    message=f"Sinh viên {sender_name} vừa nhắn trong nhóm đồ án: \"{summary}\"",
                    notification_type="new_chat_message",
                )

            # 2. Thông báo cho các sinh viên khác trong cùng nhóm
            peer_projects = GraduationProject.objects.filter(supervisor=supervisor).select_related("student__user")
            for p in peer_projects:
                peer_user = p.student.user if p.student else None
                if peer_user and peer_user.id != user.id:
                    notif_title = (
                        f"📢 [GVHD Thông báo] {supervisor.academic_title or 'GVHD'} {sender_name}"
                        if role == "supervisor"
                        else f"💬 [Tin nhắn Nhóm ĐATN] {sender_name}"
                    )
                    Notification.objects.create(
                        user=peer_user,
                        title=notif_title,
                        message=f"{role_label} {sender_name} vừa gửi tin nhắn: \"{summary}\"",
                        notification_type="new_chat_message",
                    )
        except Exception as e:
            logger.warning(f"Failed to create chat notifications: {e}")

        return Response(
            {
                "id": new_msg.id,
                "sender_id": user.id,
                "sender_username": user.username,
                "sender_name": sender_name,
                "sender_role": role,
                "sender_role_label": role_label,
                "message": new_msg.message,
                "attachment": new_msg.attachment.url if new_msg.attachment else None,
                "attachment_name": new_msg.attachment_name,
                "attachment_type": new_msg.attachment_type,
                "attachment_size": new_msg.attachment_size,
                "created_at": new_msg.created_at.isoformat(),
                "is_me": True,
            },
            status=status.HTTP_201_CREATED,
        )


class SupervisorGroupChatMessageDeleteAPIView(APIView):
    """Xóa tin nhắn của chính mình hoặc GVHD có quyền xóa tin nhắn trong nhóm."""
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        user = request.user
        supervisor = get_user_supervisor(user)
        if not supervisor:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        try:
            msg = SupervisorGroupChatMessage.objects.get(id=pk, supervisor=supervisor)
        except SupervisorGroupChatMessage.DoesNotExist:
            return Response({"detail": "Tin nhắn không tồn tại."}, status=status.HTTP_404_NOT_FOUND)

        # Chỉ người gửi hoặc GVHD mới được xóa
        is_supervisor = (user.user_type == "supervisor" and supervisor.user_id == user.id)
        if msg.sender_id != user.id and not is_supervisor:
            return Response({"detail": "Bạn không có quyền xóa tin nhắn này."}, status=status.HTTP_403_FORBIDDEN)

        msg.delete()
        return Response({"message": "Đã xóa tin nhắn thành công."}, status=status.HTTP_200_OK)
