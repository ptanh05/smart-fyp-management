import threading
import logging
from django.conf import settings
from django.core.mail import send_mail, EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from .models import (
    Notification,
    NotificationPreference,
    CustomUser,
    Student,
    Supervisor,
    Group,
    SupervisorOfStudentGroup,
    Document,
    AcademicBatch,
    ProposedAllocation,
    GraduationProject,
    ThesisDeferralRequest,
    SupervisorQuota,
    ProjectTopicArea,
    InternshipInfo,
    DefenseCouncil,
    CouncilMember,
)

logger = logging.getLogger(__name__)


class NotificationService:
    """Service class for creating and managing notifications."""
    
    @staticmethod
    def get_user_preferences(user):
        """Get or create notification preferences for a user."""
        preferences, _ = NotificationPreference.objects.get_or_create(user=user)
        return preferences
    
    @staticmethod
    def should_notify(user, notification_type):
        """Check if user should receive a notification based on their preferences."""
        preferences = NotificationService.get_user_preferences(user)
        
        type_to_preference = {
            "group_request": preferences.group_request_notifications,
            "group_request_accepted": preferences.group_request_notifications,
            "group_request_rejected": preferences.group_request_notifications,
            "supervisor_request": preferences.supervisor_request_notifications,
            "supervisor_request_accepted": preferences.supervisor_request_notifications,
            "supervisor_request_rejected": preferences.supervisor_request_notifications,
            "new_chat_message": preferences.chat_message_notifications,
            "document_uploaded": preferences.document_notifications,
            "document_approved": preferences.document_notifications,
            "document_rejected": preferences.document_notifications,
            "evaluation_completed": preferences.evaluation_notifications,
            "new_comment": preferences.comment_notifications,
            "general": True,
        }
        
        return type_to_preference.get(notification_type, True)
    
    @staticmethod
    def create_notification(
        user,
        notification_type,
        title,
        message,
        related_group=None,
        related_supervisor_group=None,
        related_document=None,
        action_url=None,
        send_email=False
    ):
        """Create a notification for a user."""
        # Check user preferences
        if not NotificationService.should_notify(user, notification_type):
            return None
        
        notification = Notification.objects.create(
            user=user,
            notification_type=notification_type,
            title=title,
            message=message,
            related_group=related_group,
            related_supervisor_group=related_supervisor_group,
            related_document=related_document,
            action_url=action_url,
        )
        
        # Send email if enabled
        if send_email:
            preferences = NotificationService.get_user_preferences(user)
            if preferences.email_notifications_enabled:
                NotificationService.send_email_notification(user, title, message)
        
        return notification
    
    @staticmethod
    def send_utc_html_email(
        recipient_email,
        recipient_name,
        subject,
        title,
        intro_text,
        details=None,
        badge_text=None,
        additional_notes=None,
        cta_text=None,
        cta_url=None,
        async_send=True
    ):
        """
        Send a beautifully styled UTC-branded HTML email.
        Uses background threading by default to ensure API requests respond instantaneously (<50ms)
        without being blocked by SMTP network socket roundtrips.
        """
        if not recipient_email:
            return False

        frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:5173")
        if cta_url and not cta_url.startswith("http"):
            cta_url = f"{frontend_url.rstrip('/')}/{cta_url.lstrip('/')}"
        elif not cta_url:
            cta_url = frontend_url

        context = {
            "subject": subject,
            "title": title,
            "recipient_name": recipient_name,
            "intro_text": intro_text,
            "badge_text": badge_text,
            "details": details or [],
            "additional_notes": additional_notes,
            "cta_text": cta_text or "👉 Truy Cập Hệ Thống Đồ Án",
            "cta_url": cta_url,
        }

        try:
            html_content = render_to_string("emails/utc_notification_email.html", context)
            text_content = strip_tags(html_content)
        except Exception as e:
            logger.warning(f"Failed to render UTC HTML email template: {e}")
            text_content = f"{title}\n\nKính gửi {recipient_name},\n{intro_text}\n\nTruy cập hệ thống: {cta_url}"
            html_content = None

        def _send():
            try:
                msg = EmailMultiAlternatives(
                    subject=f"[UTC FYP] {subject}",
                    body=text_content,
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    to=[recipient_email]
                )
                if html_content:
                    msg.attach_alternative(html_content, "text/html")
                msg.send(fail_silently=True)
                logger.info(f"UTC Email sent successfully to {recipient_email}: {subject}")
            except Exception as exc:
                logger.warning(f"Error sending UTC email to {recipient_email}: {exc}")

        if async_send:
            threading.Thread(target=_send, daemon=True).start()
            return True
        else:
            _send()
            return True

    @staticmethod
    def send_email_notification(user, subject, message):
        """Send an email notification to a user using UTC branded template."""
        if not user.email:
            return False
        
        recipient_name = user.get_full_name() or user.username
        return NotificationService.send_utc_html_email(
            recipient_email=user.email,
            recipient_name=recipient_name,
            subject=subject,
            title=subject,
            intro_text=message,
            badge_text="Thông báo hệ thống",
            async_send=True
        )
    
    @staticmethod
    def get_unread_count(user):
        """Get the count of unread notifications for a user."""
        return Notification.objects.filter(user=user, is_read=False).count()
    
    @staticmethod
    def mark_as_read(user, notification_ids=None):
        """Mark notifications as read."""
        queryset = Notification.objects.filter(user=user, is_read=False)
        if notification_ids:
            queryset = queryset.filter(id__in=notification_ids)
        return queryset.update(is_read=True)
    
    @staticmethod
    def mark_all_as_read(user):
        """Mark all notifications as read for a user."""
        return NotificationService.mark_as_read(user)
    
    # ==================== Event-specific notification methods ====================
    
    @staticmethod
    def notify_group_request(sender_student, receiver_student, group):
        """Notify a student about a new group request."""
        NotificationService.create_notification(
            user=receiver_student.user,
            notification_type="group_request",
            title="New Group Request",
            message=f"{sender_student.user.username} has sent you a group request.",
            related_group=group,
            action_url="/student/dashboard?tab=group",
        )
    
    @staticmethod
    def notify_group_request_response(group, accepted=True):
        """Notify both students about group request response."""
        sender = group.student_1
        receiver = group.student_2
        
        notification_type = "group_request_accepted" if accepted else "group_request_rejected"
        status_text = "accepted" if accepted else "rejected"
        
        # Notify the sender
        NotificationService.create_notification(
            user=sender.user,
            notification_type=notification_type,
            title=f"Group Request {status_text.title()}",
            message=f"{receiver.user.username} has {status_text} your group request.",
            related_group=group,
            action_url="/student/dashboard?tab=group",
        )

    @staticmethod
    def notify_group_join_request(student, group):
        """Notify leader about a student requesting to join the group."""
        leader = group.leader or group.student_1
        if leader:
            student_name = student.user.get_full_name() or student.user.username
            NotificationService.create_notification(
                user=leader.user,
                notification_type="group_join_request",
                title="Yêu cầu xin gia nhập nhóm mới",
                message=f"Sinh viên {student_name} ({student.registration_no}) đã gửi yêu cầu xin gia nhập nhóm {group.group_name or f'#{group.id}'}.",
                related_group=group,
                action_url="/student/dashboard?tab=groups",
            )

    @staticmethod
    def notify_group_join_response(join_request, accepted=True):
        """Notify applicant whether their join request was accepted or rejected."""
        student = join_request.student
        group = join_request.group
        group_title = group.group_name or f"Nhóm #{group.id}"
        if accepted:
            NotificationService.create_notification(
                user=student.user,
                notification_type="group_request_accepted",
                title="Yêu cầu gia nhập nhóm được chấp nhận",
                message=f"Chúc mừng! Bạn đã được duyệt tham gia nhóm {group_title}.",
                related_group=group,
                action_url="/student/dashboard?tab=groups",
            )
        else:
            NotificationService.create_notification(
                user=student.user,
                notification_type="group_request_rejected",
                title="Yêu cầu gia nhập nhóm bị từ chối",
                message=f"Yêu cầu xin gia nhập nhóm {group_title} của bạn đã bị từ chối.",
                related_group=group,
                action_url="/student/dashboard?tab=groups",
            )

    @staticmethod
    def notify_group_member_kicked(target_student, group):
        """Notify a student that they were removed from the group."""
        group_title = group.group_name or f"Nhóm #{group.id}"
        NotificationService.create_notification(
            user=target_student.user,
            notification_type="group_kicked",
            title="Bạn đã bị xóa khỏi nhóm đồ án",
            message=f"Trưởng nhóm đã xóa bạn khỏi nhóm {group_title}. Bạn đã trở về trạng thái chưa có nhóm.",
            action_url="/student/dashboard?tab=groups",
        )

    @staticmethod
    def notify_group_member_left(student, group):
        """Notify the leader that a member left the group."""
        leader = group.leader or group.student_1
        if leader and leader != student:
            student_name = student.user.get_full_name() or student.user.username
            NotificationService.create_notification(
                user=leader.user,
                notification_type="group_leave",
                title="Thành viên đã rời nhóm",
                message=f"Thành viên {student_name} ({student.registration_no}) đã tự rời khỏi nhóm {group.group_name or f'#{group.id}'}.",
                related_group=group,
                action_url="/student/dashboard?tab=groups",
            )

    @staticmethod
    def notify_group_disbanded(member_user, group_name):
        """Notify member that the group was disbanded."""
        NotificationService.create_notification(
            user=member_user,
            notification_type="group_disbanded",
            title="Nhóm đồ án đã bị giải tán",
            message=f"Nhóm {group_name} đã được giải tán bởi trưởng nhóm. Bạn hiện ở trạng thái tự do.",
            action_url="/student/dashboard?tab=groups",
        )

    @staticmethod
    def notify_leadership_transferred(old_leader, new_leader, group):
        """Notify members about leadership transfer."""
        group_title = group.group_name or f"Nhóm #{group.id}"
        new_leader_name = new_leader.user.get_full_name() or new_leader.user.username
        # Notify new leader
        NotificationService.create_notification(
            user=new_leader.user,
            notification_type="group_leadership_transferred",
            title="Bạn đã trở thành Trưởng nhóm",
            message=f"Bạn đã được chuyển quyền Trưởng nhóm {group_title}.",
            related_group=group,
            action_url="/student/dashboard?tab=groups",
        )
        # Notify old leader
        NotificationService.create_notification(
            user=old_leader.user,
            notification_type="group_leadership_transferred",
            title="Chuyển quyền Trưởng nhóm thành công",
            message=f"Bạn đã chuyển quyền Trưởng nhóm {group_title} cho {new_leader_name}.",
            related_group=group,
            action_url="/student/dashboard?tab=groups",
        )

    @staticmethod
    def notify_topic_revision_resubmitted(group, supervisor):
        """Notify supervisor that student group updated and resubmitted proposal."""
        group_title = group.group_name or f"Nhóm #{group.id}"
        NotificationService.create_notification(
            user=supervisor.user,
            notification_type="topic_revision_resubmitted",
            title="Đề xuất đề tài đã được cập nhật chỉnh sửa",
            message=f"Nhóm {group_title} đã cập nhật lại nội dung đề tài theo yêu cầu chỉnh sửa và đang chờ duyệt lại.",
            related_group=group,
            action_url="/supervisor/dashboard",
        )
    
    @staticmethod
    def notify_supervisor_request(student, supervisor, supervisor_group):
        """Notify supervisor about a new request from students."""
        NotificationService.create_notification(
            user=supervisor.user,
            notification_type="supervisor_request",
            title="New Supervisor Request",
            message=f"Student {student.user.username} has requested you as their supervisor.",
            related_supervisor_group=supervisor_group,
            action_url="/supervisor/dashboard?tab=requests",
        )
    
    @staticmethod
    def notify_supervisor_request_response(supervisor_group, accepted=True):
        """Notify students about supervisor's response."""
        notification_type = "supervisor_request_accepted" if accepted else "supervisor_request_rejected"
        status_text = "accepted" if accepted else "rejected"
        supervisor = supervisor_group.supervisor
        group = supervisor_group.group
        
        # Notify both students in the group
        for student in [group.student_1, group.student_2]:
            if not student:
                continue
            NotificationService.create_notification(
                user=student.user,
                notification_type=notification_type,
                title=f"Supervisor Request {status_text.title()}",
                message=f"{supervisor.user.username} has {status_text} your supervisor request.",
                related_supervisor_group=supervisor_group,
                action_url="/student/dashboard?tab=chat",
            )
            if accepted and student.user.email:
                NotificationService.send_utc_html_email(
                    recipient_email=student.user.email,
                    recipient_name=student.user.get_full_name() or student.user.username,
                    subject="Thông báo phân công Giảng viên hướng dẫn đồ án tốt nghiệp",
                    title="Phân Công Giảng Viên Hướng Dẫn",
                    intro_text=f"Chúc mừng bạn! Yêu cầu hướng dẫn đồ án tốt nghiệp của nhóm bạn đã được Thầy/Cô {supervisor.user.get_full_name() or supervisor.user.username} chấp thuận.",
                    badge_text="Phân công hướng dẫn",
                    details=[
                        {"label": "Giảng viên hướng dẫn", "value": supervisor.user.get_full_name() or supervisor.user.username},
                        {"label": "Email Giảng viên", "value": supervisor.user.email or "Đang cập nhật"},
                        {"label": "Mã nhóm", "value": str(group.id)},
                        {"label": "Đề tài", "value": getattr(group.project, "project_name", "Chưa cập nhật") if hasattr(group, "project") and group.project else "Đồ án tốt nghiệp"},
                    ],
                    cta_text="👉 Vào Phòng Chat & Trao Đổi Ngay",
                    cta_url="/student/dashboard?tab=chat"
                )

        if accepted and supervisor.user.email:
            st_names = [s.user.get_full_name() or s.user.username for s in [group.student_1, group.student_2] if s]
            NotificationService.send_utc_html_email(
                recipient_email=supervisor.user.email,
                recipient_name=supervisor.user.get_full_name() or supervisor.user.username,
                subject="Xác nhận hướng dẫn nhóm đồ án tốt nghiệp mới",
                title="Xác Nhận Hướng Dẫn Nhóm Đồ Án",
                intro_text="Thầy/Cô đã chấp thuận hướng dẫn nhóm sinh viên thực hiện đồ án tốt nghiệp.",
                badge_text="Nhóm hướng dẫn mới",
                details=[
                    {"label": "Sinh viên thực hiện", "value": ", ".join(st_names)},
                    {"label": "Mã nhóm", "value": str(group.id)},
                    {"label": "Đề tài", "value": getattr(group.project, "project_name", "Chưa cập nhật") if hasattr(group, "project") and group.project else "Đồ án tốt nghiệp"},
                ],
                cta_text="👉 Xem Danh Sách Nhóm Hướng Dẫn",
                cta_url="/supervisor/dashboard?tab=groups"
            )

    @staticmethod
    def notify_defense_scheduled_emails(council):
        """
        Send detailed UTC-branded HTML email notifications when a defense session is scheduled
        to all students in the council, their supervisors, and all council members.
        """
        from .models import GraduationProject, CouncilMember

        session_date_str = str(council.session_date) if council.session_date else "Đang cập nhật"
        session_time_str = getattr(council, "get_session_time_display", lambda: council.session_time)()
        room_str = council.defense_room or "Đang cập nhật"
        council_title = f"Hội đồng bảo vệ số {council.council_number}" if council.council_number else (council.council_name or "Hội đồng bảo vệ tốt nghiệp")

        projects = list(GraduationProject.objects.filter(council=council).select_related("student__user", "supervisor__user"))
        members = list(CouncilMember.objects.filter(council=council).select_related("user"))

        member_names = [f"{m.user.get_full_name() or m.user.username} ({m.get_role_display()})" for m in members]

        # 1. Notify Students
        for proj in projects:
            student = proj.student
            if student and student.user and student.user.email:
                NotificationService.send_utc_html_email(
                    recipient_email=student.user.email,
                    recipient_name=student.user.get_full_name() or student.user.username,
                    subject=f"Thông báo lịch bảo vệ đồ án tốt nghiệp chính thức - {council_title}",
                    title="Lịch Bảo Vệ Đồ Án Tốt Nghiệp Chính Thức",
                    intro_text="Hội đồng Khoa Công nghệ Thông tin thông báo lịch bảo vệ đồ án tốt nghiệp chính thức của bạn như sau:",
                    badge_text="Lịch bảo vệ chính thức",
                    details=[
                        {"label": "Đề tài", "value": proj.topic_title_vi or proj.topic_title_en or "Đồ án tốt nghiệp"},
                        {"label": "Hội đồng", "value": council_title},
                        {"label": "Ngày bảo vệ", "value": session_date_str},
                        {"label": "Buổi bảo vệ", "value": session_time_str},
                        {"label": "Phòng bảo vệ", "value": room_str},
                        {"label": "GVHD", "value": proj.supervisor.user.get_full_name() if proj.supervisor else "Chưa cập nhật"},
                        {"label": "Thành viên HĐ", "value": "; ".join(member_names) if member_names else "Đang cập nhật"},
                    ],
                    additional_notes="Lưu ý: Sinh viên có mặt trước giờ bảo vệ 15 phút, trang phục lịch sự, chuẩn bị slide thuyết trình và bản in báo cáo đầy đủ chữ ký.",
                    cta_text="👉 Xem Chi Tiết Trên Hệ Thống",
                    cta_url="/student/dashboard"
                )

        # 2. Notify Supervisors
        supervisors_notified = set()
        for proj in projects:
            sup = proj.supervisor
            if sup and sup.user and sup.user.email and sup.user.id not in supervisors_notified:
                supervisors_notified.add(sup.user.id)
                NotificationService.send_utc_html_email(
                    recipient_email=sup.user.email,
                    recipient_name=sup.user.get_full_name() or sup.user.username,
                    subject=f"Lịch bảo vệ đồ án của sinh viên hướng dẫn - {council_title}",
                    title="Lịch Bảo Vệ Đồ Án Của Sinh Viên Hướng Dẫn",
                    intro_text=f"Khoa thông báo lịch bảo vệ đồ án tốt nghiệp của sinh viên do Thầy/Cô hướng dẫn tại {council_title}:",
                    badge_text="Lịch bảo vệ sinh viên",
                    details=[
                        {"label": "Hội đồng", "value": council_title},
                        {"label": "Ngày bảo vệ", "value": session_date_str},
                        {"label": "Buổi bảo vệ", "value": session_time_str},
                        {"label": "Phòng bảo vệ", "value": room_str},
                    ],
                    cta_text="👉 Xem Danh Sách Đồ Án Hướng Dẫn",
                    cta_url="/supervisor/dashboard"
                )

        # 3. Notify Council Members
        for m in members:
            if m.user and m.user.email:
                NotificationService.send_utc_html_email(
                    recipient_email=m.user.email,
                    recipient_name=m.user.get_full_name() or m.user.username,
                    subject=f"Lịch làm việc {council_title} - Khóa luận tốt nghiệp",
                    title=f"Lịch Làm Việc {council_title}",
                    intro_text=f"Kính mời Thầy/Cô tham dự điều hành và đánh giá phiên bảo vệ khóa luận tốt nghiệp với vai trò {m.get_role_display()}:",
                    badge_text=m.get_role_display(),
                    details=[
                        {"label": "Hội đồng", "value": council_title},
                        {"label": "Vai trò của Thầy/Cô", "value": m.get_role_display()},
                        {"label": "Ngày làm việc", "value": session_date_str},
                        {"label": "Thời gian", "value": session_time_str},
                        {"label": "Phòng bảo vệ", "value": room_str},
                        {"label": "Số lượng đồ án", "value": f"{len(projects)} đề tài"},
                    ],
                    cta_text="👉 Vào Phòng Hội Đồng Trực Tiếp",
                    cta_url="/committee/dashboard?tab=council"
                )
    
    @staticmethod
    def notify_new_chat_message(sender_user, supervisor_group, message_preview):
        """Notify group members about new chat message (except sender)."""
        group = supervisor_group.group
        supervisor = supervisor_group.supervisor
        
        # Determine who should receive the notification
        recipients = []
        
        # If sender is a student, notify supervisor and other student
        if hasattr(sender_user, 'student_profile'):
            recipients.append(supervisor.user)
            sender_student = sender_user.student_profile
            if group.student_1 != sender_student:
                recipients.append(group.student_1.user)
            if group.student_2 != sender_student:
                recipients.append(group.student_2.user)
        # If sender is supervisor, notify both students
        elif hasattr(sender_user, 'supervisor_profile'):
            recipients.append(group.student_1.user)
            recipients.append(group.student_2.user)
        
        # Truncate message preview
        if len(message_preview) > 50:
            message_preview = message_preview[:47] + "..."
        
        for recipient in recipients:
            NotificationService.create_notification(
                user=recipient,
                notification_type="new_chat_message",
                title="New Chat Message",
                message=f"{sender_user.username}: {message_preview}",
                related_supervisor_group=supervisor_group,
                action_url="/student/dashboard?tab=chat" if hasattr(recipient, 'student_profile') else "/supervisor/dashboard?tab=groups",
            )
    
    @staticmethod
    def notify_document_uploaded(document, supervisor_group):
        """Notify supervisor about new document upload."""
        supervisor = supervisor_group.supervisor
        uploader = document.uploaded_by
        
        NotificationService.create_notification(
            user=supervisor.user,
            notification_type="document_uploaded",
            title="New Document Uploaded",
            message=f"{uploader.user.username} has uploaded a new {document.get_document_type_display()}.",
            related_supervisor_group=supervisor_group,
            related_document=document,
            action_url="/supervisor/dashboard?tab=documents",
        )
    
    @staticmethod
    def notify_document_status_change(document, supervisor_group, approved=True):
        """Notify students about document status change."""
        notification_type = "document_approved" if approved else "document_rejected"
        status_text = "approved" if approved else "rejected"
        group = supervisor_group.group
        supervisor = supervisor_group.supervisor
        
        # Notify both students
        for student in [group.student_1, group.student_2]:
            NotificationService.create_notification(
                user=student.user,
                notification_type=notification_type,
                title=f"Document {status_text.title()}",
                message=f"Your {document.get_document_type_display()} has been {status_text} by {supervisor.user.username}.",
                related_supervisor_group=supervisor_group,
                related_document=document,
                action_url="/student/dashboard?tab=documents",
            )
    
    @staticmethod
    def notify_evaluation_completed(supervisor_group, evaluation_type, evaluator_name):
        """Notify students about completed evaluation."""
        group = supervisor_group.group
        
        # Notify both students
        for student in [group.student_1, group.student_2]:
            NotificationService.create_notification(
                user=student.user,
                notification_type="evaluation_completed",
                title="Evaluation Completed",
                message=f"Your {evaluation_type} evaluation has been completed by {evaluator_name}.",
                related_supervisor_group=supervisor_group,
                action_url="/student/dashboard?tab=evaluations",
            )

    @staticmethod
    def notify_external_evaluation_completed(assignment, evaluation, external_examiner):
        """Notify students, supervisor, and committee panel members when an external evaluation is submitted."""
        supervisor_group = assignment.supervisor_group
        group = supervisor_group.group
        external_name = external_examiner.user.get_full_name() or external_examiner.user.username
        grade_info = f"{evaluation.total_marks}/100 ({evaluation.grade})"

        notifications = []

        # 1. Notify students
        for student in [group.student_1, group.student_2]:
            if student:
                notif = NotificationService.create_notification(
                    user=student.user,
                    notification_type="evaluation_completed",
                    title="External Evaluation Completed",
                    message=f"Chuyên gia ngoài {external_name} đã nộp phiếu đánh giá cho nhóm của bạn. Điểm: {grade_info}.",
                    related_group=group,
                    related_supervisor_group=supervisor_group,
                    action_url="/student/dashboard?tab=evaluations",
                    send_email=True,
                )
                if notif:
                    notifications.append(notif)

        group_label = (hasattr(group, "project") and group.project and group.project.project_name) or str(group.student_1)

        # 2. Notify supervisor
        if supervisor_group.supervisor:
            notif = NotificationService.create_notification(
                user=supervisor_group.supervisor.user,
                notification_type="evaluation_completed",
                title="External Evaluation Completed",
                message=f"Chuyên gia ngoài {external_name} đã nộp phiếu đánh giá cho nhóm {group_label}. Điểm: {grade_info}.",
                related_group=group,
                related_supervisor_group=supervisor_group,
                action_url="/supervisor/dashboard?tab=evaluations",
                send_email=True,
            )
            if notif:
                notifications.append(notif)

        # 3. Notify committee panel members if project has panel
        if hasattr(group, "project") and group.project and group.project.panel:
            for cm in group.project.panel.members.select_related("user").all():
                notif = NotificationService.create_notification(
                    user=cm.user,
                    notification_type="evaluation_completed",
                    title="External Evaluation Completed",
                    message=f"Chuyên gia ngoài {external_name} đã hoàn tất phiếu đánh giá cho nhóm {group_label}. Điểm: {grade_info}.",
                    related_group=group,
                    related_supervisor_group=supervisor_group,
                    action_url="/committee/dashboard?tab=evaluations",
                    send_email=False,
                )
                if notif:
                    notifications.append(notif)

        return notifications
    
    @staticmethod
    def notify_new_comment(commenter, group, supervisor_group=None, comment_preview=""):
        """Notify group members about new comment."""
        # Truncate comment preview
        if len(comment_preview) > 50:
            comment_preview = comment_preview[:47] + "..."
        
        # Notify both students and supervisor
        recipients = [group.student_1.user, group.student_2.user]
        
        if supervisor_group:
            recipients.append(supervisor_group.supervisor.user)
        
        for recipient in recipients:
            # Don't notify the commenter
            if recipient == commenter:
                continue
            
            action_url = "/student/dashboard?tab=group"
            if hasattr(recipient, 'supervisor_profile'):
                action_url = "/supervisor/dashboard?tab=groups"
            
            NotificationService.create_notification(
                user=recipient,
                notification_type="new_comment",
                title="New Comment",
                message=f"{commenter.username}: {comment_preview}",
                related_group=group,
                related_supervisor_group=supervisor_group,
                action_url=action_url,
            )
    
    # ==================== External Examiner Notification Methods ====================
    
    @staticmethod
    def notify_external_assignment(assignment):
        """Send notifications when group is assigned to external examiner."""
        group = assignment.supervisor_group.group
        external_name = assignment.external_group.external_examiner.user.get_full_name()
        external_group_name = assignment.external_group.name
        
        # Notify students
        for student in [group.student_1, group.student_2]:
            if student:
                NotificationService.create_notification(
                    user=student.user,
                    notification_type='general',
                    title='External Examiner Assigned',
                    message=f'Your group has been assigned to {external_name} ({external_group_name}) for final external evaluation.',
                    related_supervisor_group=assignment.supervisor_group,
                    action_url='/student/dashboard?tab=external',
                )
        
        # Notify supervisor
        NotificationService.create_notification(
            user=assignment.supervisor_group.supervisor.user,
            notification_type='general',
            title='External Assignment',
            message=f'Student group ({group.student_1.user.get_full_name()}) has been assigned to external examiner {external_name}.',
            related_supervisor_group=assignment.supervisor_group,
            action_url='/supervisor/dashboard?tab=groups',
        )
        
        # Notify external examiner
        NotificationService.create_notification(
            user=assignment.external_group.external_examiner.user,
            notification_type='general',
            title='New Group Assigned',
            message=f'A new student group has been assigned to your external group {external_group_name}.',
            related_supervisor_group=assignment.supervisor_group,
            action_url='/external/dashboard',
        )
    
    @staticmethod
    def notify_external_evaluation_complete(evaluation):
        """Send notifications when external evaluation is completed."""
        assignment = evaluation.assignment
        group = assignment.supervisor_group.group
        
        # Notify students
        for student in [group.student_1, group.student_2]:
            if student:
                NotificationService.create_notification(
                    user=student.user,
                    notification_type='evaluation',
                    title='External Evaluation Completed',
                    message=f'Your external evaluation has been completed. Total Marks: {evaluation.total_marks}/100, Grade: {evaluation.grade}',
                    related_supervisor_group=assignment.supervisor_group,
                    action_url='/student/dashboard?tab=evaluations',
                )
        
        # Notify supervisor
        NotificationService.create_notification(
            user=assignment.supervisor_group.supervisor.user,
            notification_type='evaluation',
            title='External Evaluation Completed',
            message=f'External evaluation completed for student group ({group.student_1.user.get_full_name()}). Grade: {evaluation.grade}',
            related_supervisor_group=assignment.supervisor_group,
            action_url='/supervisor/dashboard?tab=groups',
        )
    
    @staticmethod
    def notify_external_schedule_created(schedule):
        """Send notifications when external evaluation is scheduled."""
        if not schedule.external_group:
            return
        
        external_examiner = schedule.external_group.external_examiner
        
        # Notify external examiner about their schedule
        NotificationService.create_notification(
            user=external_examiner.user,
            notification_type='general',
            title='Evaluation Scheduled',
            message=f'An evaluation session has been scheduled for {schedule.date} at {schedule.venue}.',
            action_url='/external/dashboard',
        )
        
        # Notify all students assigned to this external group
        for assignment in schedule.external_group.assignments.all():
            group = assignment.supervisor_group.group
            for student in [group.student_1, group.student_2]:
                if student:
                    NotificationService.create_notification(
                        user=student.user,
                        notification_type='general',
                        title='External Evaluation Scheduled',
                        message=f'Your external evaluation is scheduled for {schedule.date} at {schedule.venue}.',
                        related_supervisor_group=assignment.supervisor_group,
                        action_url='/student/dashboard?tab=evaluations',
                    )

    @staticmethod
    def notify_document_comment(comment):
        """Notify group students when supervisor or member comments on a document."""
        document = comment.document
        sup_group = getattr(document, "group", None)
        author_name = comment.author.get_full_name() or comment.author.username
        title = f"Nhận xét mới trên tài liệu: {document.title}"
        msg = f"{author_name} đã thêm nhận xét ({comment.section}): \"{comment.comment[:80]}\""

        if sup_group and sup_group.group:
            grp = sup_group.group
            for student in [grp.student_1, grp.student_2]:
                if student and student.user != comment.author:
                    NotificationService.create_notification(
                        user=student.user,
                        notification_type="new_comment",
                        title=title,
                        message=msg,
                        related_group=grp,
                        related_supervisor_group=sup_group,
                        action_url="/student/dashboard?tab=documents",
                    )


class AuditService:
    """Service class for audit logging."""
    
    # Mapping of evaluation model fields to human-readable names
    FIELD_LABELS = {
        # Scope Document
        "problem_statement": "Problem Statement",
        "validity_of_he_proposed_solution": "Validity of Proposed Solution",
        "motivation_behind_tools_and_technologies": "Motivation Behind Tools",
        "modules": "Modules",
        "task_management": "Task Management",
        "related_system_analysis": "Related System Analysis",
        "document_format": "Document Format",
        "plagiarism_report": "Plagiarism Report",
        "comments": "Comments",
        "evaluation_status": "Evaluation Status",
        # SRS Supervisor
        "regularity": "Regularity",
        "srs_are_frs_mapped_to_the_problem": "FRS Mapped to Problem",
        "srs_are_nfr_mapped_to_the_problem": "NFR Mapped to Problem",
        "is_srs_storyboarding": "SRS Storyboarding",
        "according_to_requirement": "According to Requirement",
        "is_srs_template_followed": "SRS Template Followed",
        "is_write_up_correct": "Write-up Correct",
        "student_participation": "Student Participation",
        "comment": "Comment",
        # SRS Committee
        "analysis_of_existing_systems": "Analysis of Existing Systems",
        "problem_defined": "Problem Defined",
        "proposed_solution": "Proposed Solution",
        "tools_technologies": "Tools & Technologies",
        "frs_mapped": "FRS Mapped",
        "nfrs_mapped": "NFRs Mapped",
        "requirements_analysis": "Requirements Analysis",
        "mocks_defined": "Mocks Defined",
        "srs_template_followed": "SRS Template Followed",
        "technical_writeup_correct": "Technical Write-up Correct",
        "domain_knowledge": "Domain Knowledge",
        "qa_ability": "Q&A Ability",
        "presentation_attire": "Presentation Attire",
        # SDD Supervisor
        "data_representation_diagram": "Data Representation Diagram",
        "process_flow": "Process Flow",
        "design_models": "Design Models",
        "algorithms_defined": "Algorithms Defined",
        "module_completion_status": "Module Completion Status",
        "is_sdd_template_followed": "SDD Template Followed",
        "is_technical_writeup_correct": "Technical Write-up Correct",
        "seminar_participation": "Seminar Participation",
        # SDD Committee
        "sdd_design_models": "SDD Design Models",
        "algorithm_defined": "Algorithm Defined",
        "modules_completion_status": "Modules Completion Status",
        "sdd_template_followed": "SDD Template Followed",
        "project_domain_knowledge": "Project Domain Knowledge",
        "proper_attire": "Proper Attire",
        # Evaluation 3/4
        "module_completion": "Module Completion",
        "software_testing": "Software Testing",
        "is_template_followed": "Template Followed",
        "is_writeup_correct": "Write-up Correct",
        "student_participation_seminar": "Student Participation (Seminar)",
    }
    
    @staticmethod
    def get_field_label(field_name):
        """Get human-readable label for a field name."""
        return AuditService.FIELD_LABELS.get(field_name, field_name.replace("_", " ").title())
    
    @staticmethod
    def get_client_ip(request):
        """Extract client IP address from request."""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0].strip()
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip
    
    @staticmethod
    def log_evaluation_changes(request, evaluation_instance, evaluation_type, supervisor_group, old_data, new_data):
        """
        Log changes made to an evaluation form.
        
        Args:
            request: The HTTP request object
            evaluation_instance: The evaluation model instance
            evaluation_type: Type of evaluation (e.g., 'srs_supervisor')
            supervisor_group: The SupervisorOfStudentGroup instance
            old_data: Dict of field values before update
            new_data: Dict of field values after update
        """
        from .models import AuditLog
        
        changes = []
        ip_address = AuditService.get_client_ip(request)
        
        for field_name, new_value in new_data.items():
            old_value = old_data.get(field_name)
            
            # Skip if values are the same
            if old_value == new_value:
                continue
            
            # Skip internal fields
            if field_name in ['id', 'pk', '_state']:
                continue
            
            changes.append((
                AuditService.get_field_label(field_name),
                old_value,
                new_value
            ))
        
        if changes:
            return AuditLog.log_bulk_evaluation_changes(
                user=request.user,
                evaluation_type=evaluation_type,
                supervisor_group=supervisor_group,
                changes=changes,
                ip_address=ip_address,
            )
        return []
    
    @staticmethod
    def get_evaluation_old_data(evaluation_instance, fields_to_track):
        """
        Get current values of an evaluation instance for tracking changes.
        
        Args:
            evaluation_instance: The evaluation model instance
            fields_to_track: List of field names to track
        """
        old_data = {}
        for field in fields_to_track:
            if hasattr(evaluation_instance, field):
                old_data[field] = getattr(evaluation_instance, field)
        return old_data


class CouncilConflictService:
    """Service to detect and manage Conflict of Interest (COI) in defense council assignments."""

    @staticmethod
    def check_council_conflicts(council_id=None, batch_id=None):
        """
        Check for Conflict of Interest across councils.
        A conflict occurs when:
        1. A council member is the supervisor (GVHD) of an assigned project.
        2. A council member is the reviewer (GVPB) of an assigned project.
        """
        from .models import DefenseCouncil, GraduationProject, CouncilMember

        councils_qs = DefenseCouncil.objects.all().select_related("batch")
        if council_id:
            councils_qs = councils_qs.filter(id=council_id)
        elif batch_id:
            councils_qs = councils_qs.filter(batch_id=batch_id)

        all_conflicts = []
        councils_summary = []

        for council in councils_qs:
            members = list(council.members.select_related("user", "supervisor").all())
            projects = list(council.projects.select_related("student__user", "supervisor__user", "reviewer__user").all())

            council_conflicts = []

            for member in members:
                member_name = member.user.get_full_name() or member.user.username
                member_role_display = member.get_role_display()

                for project in projects:
                    student_name = project.student.user.get_full_name() or project.student.user.username
                    student_reg = project.student.registration_no

                    # 1. Check if member is supervisor
                    is_supervisor = False
                    if member.supervisor_id and project.supervisor_id and member.supervisor_id == project.supervisor_id:
                        is_supervisor = True
                    elif member.user_id and project.supervisor and project.supervisor.user_id == member.user_id:
                        is_supervisor = True

                    if is_supervisor:
                        conflict_item = {
                            "council_id": council.id,
                            "council_name": council.council_name,
                            "council_number": council.council_number,
                            "member_id": member.id,
                            "member_user_id": member.user_id,
                            "member_name": member_name,
                            "member_role": member_role_display,
                            "project_id": project.id,
                            "project_title": project.topic_title_vi or project.topic_title_en,
                            "student_name": student_name,
                            "student_reg_no": student_reg,
                            "conflict_type": "SUPERVISOR",
                            "severity": "HIGH",
                            "message": f"Thành viên {member_name} ({member_role_display}) là Giảng viên hướng dẫn của sinh viên {student_name} ({student_reg}) trong cùng {council.council_name}."
                        }
                        council_conflicts.append(conflict_item)
                        all_conflicts.append(conflict_item)

                    # 2. Check if member is reviewer
                    is_reviewer = False
                    if member.supervisor_id and project.reviewer_id and member.supervisor_id == project.reviewer_id:
                        is_reviewer = True
                    elif member.user_id and project.reviewer and project.reviewer.user_id == member.user_id:
                        is_reviewer = True

                    if is_reviewer:
                        conflict_item = {
                            "council_id": council.id,
                            "council_name": council.council_name,
                            "council_number": council.council_number,
                            "member_id": member.id,
                            "member_user_id": member.user_id,
                            "member_name": member_name,
                            "member_role": member_role_display,
                            "project_id": project.id,
                            "project_title": project.topic_title_vi or project.topic_title_en,
                            "student_name": student_name,
                            "student_reg_no": student_reg,
                            "conflict_type": "REVIEWER",
                            "severity": "MEDIUM",
                            "message": f"Thành viên {member_name} ({member_role_display}) là Giảng viên phản biện của sinh viên {student_name} ({student_reg}) trong cùng {council.council_name}."
                        }
                        council_conflicts.append(conflict_item)
                        all_conflicts.append(conflict_item)

            councils_summary.append({
                "council_id": council.id,
                "council_name": council.council_name,
                "council_number": council.council_number,
                "total_members": len(members),
                "total_projects": len(projects),
                "has_conflict": len(council_conflicts) > 0,
                "conflicts_count": len(council_conflicts),
                "conflicts": council_conflicts,
            })

        return {
            "has_conflict": len(all_conflicts) > 0,
            "total_conflicts": len(all_conflicts),
            "conflicts": all_conflicts,
            "councils_summary": councils_summary
        }

    @staticmethod
    def check_project_assignment(council, project):
        """Check potential conflict if a project is assigned to a council."""
        members = council.members.select_related("user", "supervisor").all()
        conflicts = []
        for m in members:
            m_name = m.user.get_full_name() or m.user.username
            if (m.supervisor_id and m.supervisor_id == project.supervisor_id) or (project.supervisor and m.user_id == project.supervisor.user_id):
                conflicts.append({
                    "conflict_type": "SUPERVISOR",
                    "member_name": m_name,
                    "message": f"Thành viên hội đồng {m_name} ({m.get_role_display()}) là GVHD của sinh viên {project.student.user.get_full_name()}."
                })
            if (m.supervisor_id and m.supervisor_id == project.reviewer_id) or (project.reviewer and m.user_id == project.reviewer.user_id):
                conflicts.append({
                    "conflict_type": "REVIEWER",
                    "member_name": m_name,
                    "message": f"Thành viên hội đồng {m_name} ({m.get_role_display()}) là GVPB của sinh viên {project.student.user.get_full_name()}."
                })
        return conflicts

    @staticmethod
    def check_member_assignment(council, user, supervisor=None):
        """
        Check potential conflict if a user/supervisor is added to a council.
        Quy chế: GV hướng dẫn KHÔNG được nằm trong hội đồng/phản biện của chính SV đó.
        """
        from .models import Supervisor, GraduationProject
        projects = council.projects.select_related("student__user", "supervisor__user", "reviewer__user").all()
        conflicts = []
        user_id = getattr(user, "id", None)
        sup_id = getattr(supervisor, "id", None) if supervisor else None

        # Resolve supervisor if not provided
        if not sup_id and user:
            sup = getattr(user, "supervisor_profile", None)
            if not sup:
                sup = Supervisor.objects.filter(user=user).first()
            if sup:
                sup_id = sup.id
                supervisor = sup

        # Also resolve user if not provided
        if not user_id and supervisor:
            user = getattr(supervisor, "user", None)
            if user:
                user_id = user.id

        for p in projects:
            s_name = p.student.user.get_full_name() or p.student.registration_no

            # 1. Cross-check Supervisor (GVHD):
            # Member being assigned CANNOT be the supervisor of any project in this council
            is_sup = False
            if sup_id and p.supervisor_id and p.supervisor_id == sup_id:
                is_sup = True
            elif user_id and p.supervisor and p.supervisor.user_id == user_id:
                is_sup = True
            elif supervisor and p.supervisor and p.supervisor == supervisor:
                is_sup = True

            if is_sup:
                conflicts.append({
                    "conflict_type": "SUPERVISOR",
                    "project_id": p.id,
                    "student_name": s_name,
                    "student_reg_no": p.student.registration_no,
                    "message": f"Thầy/Cô là GVHD của sinh viên {s_name} ({p.student.registration_no}). Quy chế quy định GVHD không được làm thành viên/phản biện trong hội đồng của chính sinh viên đó."
                })

            # 2. Cross-check Reviewer (GVPB):
            # Member being assigned CANNOT be the reviewer of any project in this council
            is_rev = False
            if sup_id and p.reviewer_id and p.reviewer_id == sup_id:
                is_rev = True
            elif user_id and p.reviewer and p.reviewer.user_id == user_id:
                is_rev = True
            elif supervisor and p.reviewer and p.reviewer == supervisor:
                is_rev = True

            if is_rev:
                conflicts.append({
                    "conflict_type": "REVIEWER",
                    "project_id": p.id,
                    "student_name": s_name,
                    "student_reg_no": p.student.registration_no,
                    "message": f"Giảng viên này là GVPB của đề tài sinh viên {s_name} ({p.student.registration_no}) đang trong hội đồng."
                })

        return conflicts


# ==============================================================================
# GRADUATION THESIS WORKFLOW SERVICES (UTC 6-PHASE SPECIFICATION)
# ==============================================================================

class DegreeEligibilityService:
    """Kiểm tra điều kiện học vị giảng viên theo chương trình đào tạo của Sinh viên"""

    @classmethod
    def is_doctoral_degree(cls, title: str) -> bool:
        """Kiểm tra chức danh/học vị từ Tiến sĩ trở lên (TS, PGS, GS)"""
        if not title:
            return False
        t = title.strip().upper()
        # Checks for standard doctoral markers: TS, TS., PGS, GS, Tiến sĩ, Giáo sư
        doctoral_markers = ["TS", "TIẾN SĨ", "TIEN SI", "PGS", "GS", "GIÁO SƯ", "GIAO SU", "PHÓ GIÁO SƯ"]
        return any(marker in t for marker in doctoral_markers)

    @classmethod
    def validate_preferences_for_student(cls, student, supervisors: list):
        """
        Nút quyết định Giai đoạn 2: SV có thuộc CT Kỹ sư không?
        - Có: chuyển sang bước kiểm tra học vị GV tối thiểu (bắt buộc TS trở lên).
        - Đạt: tiếp tục.
        - Không đạt: báo lỗi yêu cầu chọn lại.
        - Không (Cử nhân): tiếp tục (chấp nhận ThS trở lên).
        """
        if student.degree_program == "ENGINEER":
            ineligible_supervisors = []
            for sup in supervisors:
                if not sup:
                    continue
                title = sup.academic_title or ""
                if not cls.is_doctoral_degree(title):
                    ineligible_supervisors.append(
                        f"{sup.user.get_full_name() or sup.user.username} (Học vị: {title or 'Chưa cập nhật'})"
                    )

            if ineligible_supervisors:
                raise ValueError(
                    f"Sinh viên chương trình Kỹ sư bắt buộc chọn GVHD có học vị từ Tiến sĩ trở lên (TS, PGS, GS). "
                    f"Giảng viên sau không đủ điều kiện: {', '.join(ineligible_supervisors)}. Vui lòng chọn lại!"
                )
        return True


class ThesisAllocationService:
    """
    Thuật toán phân công đề tài/GVHD dựa trên Ràng buộc cứng (Hard) và Ràng buộc mềm (Soft).
    Hard Constraints:
    - Quota/Capacity tối đa của Giảng viên không bị vượt quá (SupervisorQuota.max_total_quota).
    - SV Kỹ sư chỉ gán cho GV có học vị Tiến sĩ trở lên.
    - Mỗi SV chỉ được gán tối đa 1 GV.
    Soft Constraints:
    - Ưu tiên nguyện vọng: NV1 (100đ) > NV2 (70đ) > NV3 (40đ).
    - Cân bằng tải phân bổ giữa các GV.
    - Ưu tiên SV có điểm CPA cao hơn khi xảy ra cạnh tranh quota.
    """

    @classmethod
    def get_capacity_multiplier(cls, supervisor) -> float:
        """
        Quy đổi hệ số Capacity theo học vị / chức danh:
        - Thạc sĩ (ThS): 1.0 (baseline chuẩn)
        - Tiến sĩ (TS): 1.5 (1 Tiến sĩ = 1.5 Thạc sĩ)
        - Phó Giáo sư (PGS) / Giáo sư (GS): 2.0 (1 PGS = 2.0 Thạc sĩ)
        """
        if isinstance(supervisor, str):
            title = supervisor.upper()
        else:
            title = (getattr(supervisor, "academic_title", None) or str(supervisor or "")).upper()
        if any(marker in title for marker in ["PGS", "GS", "GIÁO SƯ", "GIAO SU", "PHÓ GIÁO SƯ"]):
            return 2.0
        elif any(marker in title for marker in ["TS", "TIẾN SĨ", "TIEN SI"]):
            return 1.5
        return 1.0

    @classmethod
    def calculate_capacity(cls, supervisor, base_capacity: int = 6) -> int:
        """
        Tính số lượng sinh viên tối đa theo công thức Capacity (1 TS = 1.5 ThS, 1 PGS = 2.0 ThS).
        Kết quả luôn được làm tròn thành số nguyên int (tránh lỗi ValueError khi lưu vào DB IntegerField).
        """
        mult = cls.get_capacity_multiplier(supervisor)
        return int(round(float(base_capacity) * mult))

    @classmethod
    def run_allocation(cls, batch):
        """Chạy thuật toán đề xuất phân công cho một đợt đồ án"""
        from django.db import transaction

        # 1. Lấy danh sách khảo sát/nguyện vọng của SV trong batch
        surveys = list(
            InternshipInfo.objects.filter(batch=batch)
            .select_related("student__user", "preference_1", "preference_2", "preference_3", "preferred_supervisor", "topic_direction")
            .order_by("-student__cpa", "submitted_at")
        )

        # 2. Lấy định mức Quota của GV trong batch (đảm bảo ép kiểu integer an toàn)
        quotas = {
            q.supervisor_id: {
                "max": int(round(float(q.max_total_quota))),
                "assigned": 0,
                "supervisor": q.supervisor,
            }
            for q in SupervisorQuota.objects.filter(batch=batch).select_related("supervisor__user")
        }

        # Fallback: Nếu GV chưa có SupervisorQuota bản ghi riêng, tính quota theo công thức Capacity
        for s in Supervisor.objects.all():
            if s.id not in quotas:
                calculated_max = cls.calculate_capacity(s, base_capacity=6)
                quotas[s.id] = {
                    "max": calculated_max,
                    "assigned": 0,
                    "supervisor": s,
                }

        results = []
        assigned_students = set()

        def can_assign(student, supervisor):
            if not supervisor or supervisor.id not in quotas:
                return False
            # Hard constraint: Check remaining quota
            q_info = quotas[supervisor.id]
            if q_info["assigned"] >= q_info["max"]:
                return False
            # Hard constraint: Check degree requirement for Engineer students
            if student.degree_program == "ENGINEER":
                if not DegreeEligibilityService.is_doctoral_degree(supervisor.academic_title or ""):
                    return False
            return True

        # Vòng 1: Xét Nguyện vọng 1 (NV1)
        for s in surveys:
            student = s.student
            if student.id in assigned_students:
                continue
            sup1 = s.preference_1 or s.preferred_supervisor
            if can_assign(student, sup1):
                quotas[sup1.id]["assigned"] += 1
                assigned_students.add(student.id)
                results.append({
                    "student": student,
                    "supervisor": sup1,
                    "matched_preference": 1,
                    "match_score": 100.0,
                })

        # Vòng 2: Xét Nguyện vọng 2 (NV2)
        for s in surveys:
            student = s.student
            if student.id in assigned_students:
                continue
            sup2 = s.preference_2
            if can_assign(student, sup2):
                quotas[sup2.id]["assigned"] += 1
                assigned_students.add(student.id)
                results.append({
                    "student": student,
                    "supervisor": sup2,
                    "matched_preference": 2,
                    "match_score": 70.0,
                })

        # Vòng 3: Xét Nguyện vọng 3 (NV3)
        for s in surveys:
            student = s.student
            if student.id in assigned_students:
                continue
            sup3 = s.preference_3
            if can_assign(student, sup3):
                quotas[sup3.id]["assigned"] += 1
                assigned_students.add(student.id)
                results.append({
                    "student": student,
                    "supervisor": sup3,
                    "matched_preference": 3,
                    "match_score": 40.0,
                })

        # Vòng 4: Gán bổ sung theo hướng nghiên cứu cho SV chưa trúng NV nào
        unassigned_surveys = [s for s in surveys if s.student.id not in assigned_students]
        for s in unassigned_surveys:
            student = s.student
            topic = s.topic_direction
            # Tìm GV còn quota và phù hợp điều kiện
            candidates = []
            for sup_id, q_info in quotas.items():
                sup = q_info["supervisor"]
                if can_assign(student, sup):
                    # Ưu tiên GV còn nhiều quota trống nhất để cân bằng tải
                    remaining = q_info["max"] - q_info["assigned"]
                    candidates.append((remaining, sup))

            if candidates:
                candidates.sort(key=lambda x: x[0], reverse=True)
                chosen_sup = candidates[0][1]
                quotas[chosen_sup.id]["assigned"] += 1
                assigned_students.add(student.id)
                results.append({
                    "student": student,
                    "supervisor": chosen_sup,
                    "matched_preference": 0,  # Hệ thống phân bổ tự động
                    "match_score": 10.0,
                })

        # Lưu kết quả vào bảng ProposedAllocation
        with transaction.atomic():
            ProposedAllocation.objects.filter(batch=batch, is_overridden=False).delete()
            created_allocations = []
            for item in results:
                alloc, _ = ProposedAllocation.objects.update_or_create(
                    batch=batch,
                    student=item["student"],
                    defaults={
                        "supervisor": item["supervisor"],
                        "matched_preference": item["matched_preference"],
                        "match_score": item["match_score"],
                        "is_overridden": False,
                    }
                )
                created_allocations.append(alloc)

        # Thống kê kết quả
        total = len(surveys)
        p1_count = sum(1 for r in results if r["matched_preference"] == 1)
        p2_count = sum(1 for r in results if r["matched_preference"] == 2)
        p3_count = sum(1 for r in results if r["matched_preference"] == 3)
        auto_count = sum(1 for r in results if r["matched_preference"] == 0)

        return {
            "total_students": total,
            "allocated_count": len(results),
            "unallocated_count": total - len(results),
            "nv1_matched": p1_count,
            "nv2_matched": p2_count,
            "nv3_matched": p3_count,
            "system_assigned": auto_count,
            "success_rate": round(len(results) / total * 100, 1) if total > 0 else 0,
            "allocations_count": len(created_allocations),
        }

    @classmethod
    def finalize_allocation(cls, batch, user=None):
        """
        Khoa chốt phân công: Chuyển toàn bộ ProposedAllocation thành GraduationProject chính thức.
        Trạng thái chuyển sang ALLOCATED hoặc TOPIC_DRAFT.
        """
        from django.db import transaction

        proposed = ProposedAllocation.objects.filter(batch=batch).select_related("student", "supervisor")
        created_projects = []

        with transaction.atomic():
            for p in proposed:
                # Kiểm tra survey có tentative title hay không
                survey = InternshipInfo.objects.filter(student=p.student, batch=batch).first()
                default_title = (survey.tentative_title.strip() if survey and survey.tentative_title else "") or f"Đề tài đồ án tốt nghiệp - SV {p.student.registration_no}"
                topic_cat = survey.topic_direction if survey else None

                proj, created = GraduationProject.objects.update_or_create(
                    student=p.student,
                    defaults={
                        "supervisor": p.supervisor,
                        "batch": batch,
                        "topic_category": topic_cat,
                        "topic_title_vi": default_title,
                        "status": "TOPIC_DRAFT",
                    }
                )
                created_projects.append(proj)

                # Gửi email / thông báo kết quả phân công
                try:
                    NotificationService.create_notification(
                        user=p.student.user,
                        notification_type="general",
                        title="[Đồ án Tốt nghiệp] Kết quả phân công GVHD",
                        message=f"Bạn đã được phân công Giảng viên hướng dẫn: Thầy/Cô {p.supervisor.user.get_full_name()} ({p.supervisor.academic_title or 'GV'}). Hãy liên hệ GVHD để cùng xác định đề tài (trạng thái Draft).",
                        action_url="/student/dashboard",
                        send_email=True,
                    )
                except Exception as e:
                    logger.warning("Could not send notification for student allocation: %s", e)

        return {
            "batch_code": batch.batch_code,
            "finalized_projects_count": len(created_projects),
            "message": f"Khoa đã chốt phân công thành công {len(created_projects)} đề tài cho đợt {batch.batch_code}!"
        }


class AcademicClearanceService:
    """Xét điều kiện làm đồ án (Giai đoạn 4) & Kiểm tra học vụ cuối trước bảo vệ (Giai đoạn 6)"""

    @staticmethod
    def check_thesis_start_eligibility(project, debt_credits=None, courses_data=None):
        """
        Giai đoạn 4: Xét điều kiện làm ĐA
        - Đủ: Tiếp tục làm đồ án (IN_PROGRESS)
        - Không đủ: Kiểm tra Force Approve
          + Có (is_force_approved=True): Tiếp tục (IN_PROGRESS)
          + Không: Loại khỏi đợt (DISQUALIFIED)
        Boundary: Nợ 10 tín chỉ -> 'Không đủ điều kiện'
        """
        student = project.student
        cpa = getattr(student, "cpa", 0.0)

        # Parse and calculate debt credits if courses_data or debt_credits provided
        total_debt = debt_credits
        if total_debt is None and courses_data:
            total_debt = 0
            try:
                # Handle dict or list of courses
                course_list = courses_data
                if isinstance(courses_data, dict):
                    course_list = courses_data.get("courses") or courses_data.get("mon_hoc") or []
                    electives = courses_data.get("electives") or courses_data.get("tu_chon") or courses_data.get("diem_tu_chon") or []
                    if isinstance(course_list, list) and isinstance(electives, list):
                        course_list = list(course_list) + list(electives)

                if isinstance(course_list, list):
                    for item in course_list:
                        if isinstance(item, dict):
                            cr = item.get("credits") or item.get("tin_chi") or 0
                            passed = item.get("is_passed")
                            score = item.get("score") if item.get("score") is not None else item.get("diem")
                            if passed is False or (score is not None and float(score) < 4.0):
                                total_debt += int(cr)
                        elif isinstance(item, (list, tuple)):
                            if len(item) >= 2:
                                cr = item[1]
                                is_failed = False
                                if len(item) >= 3:
                                    val = item[2]
                                    if isinstance(val, (int, float)) and float(val) < 4.0:
                                        is_failed = True
                                    elif isinstance(val, str) and val.upper() in ["F", "FAIL", "FAILED", "TRƯỢT", "TRUOT"]:
                                        is_failed = True
                                    elif isinstance(val, bool) and not val:
                                        is_failed = True
                                else:
                                    is_failed = True
                                if is_failed:
                                    total_debt += int(cr)
            except (IndexError, ValueError, TypeError, KeyError):
                pass

        # Determine debt credits from student attributes if not provided
        if total_debt is None:
            total_debt = getattr(student, "debt_credits", None) or getattr(student, "credits_debt", 0)

        # Quy chế UTC: Nợ 10 tín chỉ trở lên -> Không đủ điều kiện làm ĐA
        is_debt_ineligible = total_debt is not None and total_debt >= 10

        is_eligible = (
            getattr(student, "is_eligible_for_thesis", True)
            and (cpa is None or cpa >= 2.0)
            and not is_debt_ineligible
        )

        if is_eligible or project.is_force_approved:
            project.status = "IN_PROGRESS"
            project.save(update_fields=["status"])
            return True, "Đủ điều kiện thực hiện đồ án tốt nghiệp"
        else:
            project.status = "DISQUALIFIED"
            project.save(update_fields=["status"])
            if is_debt_ineligible:
                return False, f"Không đủ điều kiện làm đồ án (Nợ {total_debt} tín chỉ, vượt quá/chạm giới hạn cho phép tối đa 10 tín chỉ)"
            return False, "Không đủ điều kiện làm đồ án (CPA < 2.0 hoặc vi phạm quy chế) và không được duyệt đặc cách"

    @staticmethod
    def check_final_academic_clearance(project):
        """
        Giai đoạn 6: Kiểm tra điều kiện học vụ cuối
        - Đủ: Cho phép bảo vệ (DEFENSE_READY)
        - Không đủ: Chuyển sang xét bảo lưu đồ án
        """
        if project.academic_clearance_status == "CLEARED":
            if project.is_eligible_for_defense:
                project.status = "DEFENSE_READY"
                project.save(update_fields=["status"])
                return True, "Đủ điều kiện bảo vệ đồ án tốt nghiệp"
        return False, "Chưa hoàn tất điều kiện học vụ cuối, chuyển sang xét bảo lưu đồ án"


class CouncilStructureService:
    """Xác thực cơ cấu Hội đồng bảo vệ chuẩn UTC: 1 Chủ tịch, 2 Thư ký, 2 Ủy viên (1CT-2TK-2UV)"""

    @staticmethod
    def validate_utc_council_structure(council):
        members = list(council.members.all())
        chairs = [m for m in members if m.role == "CHAIR"]
        secretaries = [m for m in members if m.role == "SECRETARY"]
        regular_members = [m for m in members if m.role in ["MEMBER", "EXTERNAL_MEMBER"]]

        is_valid = (len(chairs) == 1 and len(secretaries) == 2 and len(regular_members) == 2 and len(members) == 5)
        errors = []
        if len(chairs) != 1:
            errors.append(f"Hội đồng cần đúng 1 Chủ tịch (hiện có: {len(chairs)})")
        if len(secretaries) != 2:
            errors.append(f"Hội đồng cần đúng 2 Thư ký (hiện có: {len(secretaries)})")
        if len(regular_members) != 2:
            errors.append(f"Hội đồng cần đúng 2 Ủy viên (hiện có: {len(regular_members)})")

        return {
            "is_valid": is_valid,
            "total_members": len(members),
            "chairs_count": len(chairs),
            "secretaries_count": len(secretaries),
            "members_count": len(regular_members),
            "errors": errors,
            "message": "Cơ cấu hội đồng chuẩn 1CT-2TK-2UV (5 thành viên)" if is_valid else "; ".join(errors)
        }


