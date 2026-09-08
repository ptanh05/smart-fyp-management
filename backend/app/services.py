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
        """Check potential conflict if a user/supervisor is added to a council."""
        projects = council.projects.select_related("student__user", "supervisor__user", "reviewer__user").all()
        conflicts = []
        user_id = getattr(user, "id", None)
        sup_id = getattr(supervisor, "id", None) if supervisor else None

        for p in projects:
            s_name = p.student.user.get_full_name()
            if (sup_id and p.supervisor_id == sup_id) or (p.supervisor and p.supervisor.user_id == user_id):
                conflicts.append({
                    "conflict_type": "SUPERVISOR",
                    "project_id": p.id,
                    "student_name": s_name,
                    "message": f"Giảng viên này là GVHD của đề tài sinh viên {s_name} ({p.student.registration_no}) đang trong hội đồng."
                })
            if (sup_id and p.reviewer_id == sup_id) or (p.reviewer and p.reviewer.user_id == user_id):
                conflicts.append({
                    "conflict_type": "REVIEWER",
                    "project_id": p.id,
                    "student_name": s_name,
                    "message": f"Giảng viên này là GVPB của đề tài sinh viên {s_name} ({p.student.registration_no}) đang trong hội đồng."
                })
        return conflicts

