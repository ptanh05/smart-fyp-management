"""
Notification service for creating and managing notifications.
"""
from django.conf import settings
from django.core.mail import send_mail
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
    def send_email_notification(user, subject, message):
        """Send an email notification to a user."""
        if not user.email:
            return False
        
        try:
            send_mail(
                subject=subject,
                message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=True,
            )
            return True
        except Exception:
            return False
    
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
            NotificationService.create_notification(
                user=student.user,
                notification_type=notification_type,
                title=f"Supervisor Request {status_text.title()}",
                message=f"{supervisor.user.username} has {status_text} your supervisor request.",
                related_supervisor_group=supervisor_group,
                action_url="/student/dashboard?tab=chat",
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
