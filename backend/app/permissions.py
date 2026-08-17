"""
Custom permission classes for role-based access control.

This module provides DRF permission classes to restrict access based on user roles:
- Students can only access student-specific endpoints
- Supervisors can only access their assigned groups/data
- Committee members can only evaluate their assigned panels
"""

from rest_framework.permissions import BasePermission

from rest_framework.permissions import SAFE_METHODS
from .models import (
    Student,
    Supervisor,
    CommitteeMember,
    Group,
    SupervisorOfStudentGroup,
    Document,
    ChatRoom,
    ExternalExaminer,
    ExternalGroup,
    ExternalGroupAssignment,
    ExternalEvaluation,
)
from django.db.models import Q


class IsStudent(BasePermission):
    """
    Permission class that allows access only to students.
    """

    message = "You must be a student to access this resource."

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        return hasattr(request.user, 'user_type') and request.user.user_type == 'student'


class IsSupervisor(BasePermission):
    """
    Permission class that allows access only to supervisors.
    """

    message = "You must be a supervisor to access this resource."

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        return hasattr(request.user, 'user_type') and request.user.user_type == 'supervisor'


class IsCommitteeMember(BasePermission):
    """
    Permission class that allows access only to committee members.
    """

    message = "You must be a committee member to access this resource."

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        return hasattr(request.user, 'user_type') and request.user.user_type == 'committee_member'


class IsStudentOrSupervisor(BasePermission):
    """
    Permission class that allows access to both students and supervisors.
    Useful for shared endpoints like chat or comments.
    """

    message = "You must be a student or supervisor to access this resource."

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        return hasattr(request.user, 'user_type') and request.user.user_type in ['student', 'supervisor']


class IsStudentOrSupervisorOrCommitteeMember(BasePermission):
    """
    Permission class that allows access to students, supervisors, and committee members.
    Useful for general authenticated endpoints.
    """

    message = "You must be a student, supervisor, or committee member to access this resource."

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        return hasattr(request.user, 'user_type') and request.user.user_type in [
            'student', 'supervisor', 'committee_member'
        ]


class IsDocumentOwner(BasePermission):
    """
    Permission class that checks if the user owns the document.
    The user must be the student who uploaded the document.
    """

    message = "You do not have permission to access this document."

    def has_object_permission(self, request, view, obj):
        if not request.user.is_authenticated:
            return False

        # Check if the object is a Document
        if not isinstance(obj, Document):
            return False

        # For students, check if they uploaded the document
        try:
            student = Student.objects.get(user=request.user)
            return obj.uploaded_by == student
        except Student.DoesNotExist:
            pass

        # For supervisors, check if the document belongs to one of their groups
        try:
            supervisor = Supervisor.objects.get(user=request.user)
            return obj.group.supervisor == supervisor
        except Supervisor.DoesNotExist:
            pass

        return False


class IsGroupMember(BasePermission):
    """
    Permission class that checks if the user is a member of the group.
    This works for both Group and SupervisorOfStudentGroup objects.
    """

    message = "You are not a member of this group."

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        return True

    def has_object_permission(self, request, view, obj):
        if not request.user.is_authenticated:
            return False

        # Handle SupervisorOfStudentGroup
        if isinstance(obj, SupervisorOfStudentGroup):
            # Check if user is a student in the group
            try:
                student = Student.objects.get(user=request.user)
                if obj.group.student_1 == student or obj.group.student_2 == student:
                    return True
            except Student.DoesNotExist:
                pass

            # Check if user is the supervisor
            try:
                supervisor = Supervisor.objects.get(user=request.user)
                if obj.supervisor == supervisor:
                    return True
            except Supervisor.DoesNotExist:
                pass

            return False

        # Handle Group
        if isinstance(obj, Group):
            try:
                student = Student.objects.get(user=request.user)
                return obj.student_1 == student or obj.student_2 == student
            except Student.DoesNotExist:
                return False

        return False


class IsGroupMemberForChat(BasePermission):
    """
    Permission class specifically for chat operations.
    Allows students in the group and the assigned supervisor.
    """

    message = "You are not authorized to access this chat."

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False

        # Get group_id from query params or request data
        group_id = request.GET.get("group") or request.data.get("group")
        if not group_id:
            return True  # Let the view handle missing group_id

        try:
            group = SupervisorOfStudentGroup.objects.get(id=group_id)
        except SupervisorOfStudentGroup.DoesNotExist:
            return True  # Let the view handle non-existent group

        # Check if user is a student in the group
        try:
            student = Student.objects.get(user=request.user)
            if group.group.student_1 == student or group.group.student_2 == student:
                return True
        except Student.DoesNotExist:
            pass

        # Check if user is the supervisor of the group
        try:
            supervisor = Supervisor.objects.get(user=request.user)
            if group.supervisor == supervisor:
                return True
        except Supervisor.DoesNotExist:
            pass

        return False


class IsChatMessageOwner(BasePermission):
    """
    Permission class that checks if the user sent the chat message.
    """

    message = "You do not have permission to modify this message."

    def has_object_permission(self, request, view, obj):
        if not request.user.is_authenticated:
            return False

        if not isinstance(obj, ChatRoom):
            return False

        # Check if user is the sender
        try:
            student = Student.objects.get(user=request.user)
            if obj.student == student and obj.sent_by == "student":
                return True
        except Student.DoesNotExist:
            pass

        try:
            supervisor = Supervisor.objects.get(user=request.user)
            if obj.supervisor == supervisor and obj.sent_by == "supervisor":
                return True
        except Supervisor.DoesNotExist:
            pass

        return False


class IsSupervisorOfGroup(BasePermission):
    """
    Permission class that checks if the supervisor is assigned to the group.
    For read-only access, allows all authenticated users.
    For write access, requires being the assigned supervisor.
    """

    message = "You are not the supervisor of this group."

    def has_object_permission(self, request, view, obj):
        if not request.user.is_authenticated:
            return False

        # For safe methods (GET, HEAD, OPTIONS), allow broader access
        if request.method in ['GET', 'HEAD', 'OPTIONS']:
            return True

        # For modification, require supervisor of the group
        try:
            supervisor = Supervisor.objects.get(user=request.user)
            if isinstance(obj, SupervisorOfStudentGroup):
                return obj.supervisor == supervisor
            if isinstance(obj, Document):
                return obj.group.supervisor == supervisor
            return False
        except Supervisor.DoesNotExist:
            return False


class IsCommitteeMemberOfPanel(BasePermission):
    """
    Permission class that checks if the committee member belongs to the panel
    assigned to evaluate the project/group.
    """

    message = "You are not authorized to evaluate this group. It is not assigned to your panel."

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        return request.user.user_type == 'committee_member'

    def has_object_permission(self, request, view, obj):
        if not request.user.is_authenticated:
            return False

        try:
            committee_member = CommitteeMember.objects.get(user=request.user)
            panel = committee_member.panel

            # For SupervisorOfStudentGroup - check if project is in the committee member's panel
            if isinstance(obj, SupervisorOfStudentGroup):
                return obj.project and obj.project.panel == panel

            # For evaluation objects, check the supervisor_student_group's project panel
            if hasattr(obj, 'supervisor_student_group'):
                ssg = obj.supervisor_student_group
                return ssg.project and ssg.project.panel == panel

            return False
        except CommitteeMember.DoesNotExist:
            return False


class CanAccessEvaluation(BasePermission):
    """
    Permission class for evaluation endpoints.
    - Supervisors can access evaluations for their groups
    - Committee members can access evaluations for groups in their panel
    """

    message = "You are not authorized to access this evaluation."

    def has_object_permission(self, request, view, obj):
        if not request.user.is_authenticated:
            return False

        # Get the supervisor_student_group from the evaluation object
        if not hasattr(obj, 'supervisor_student_group'):
            return False

        ssg = obj.supervisor_student_group

        # Check if user is the supervisor
        try:
            supervisor = Supervisor.objects.get(user=request.user)
            if ssg.supervisor == supervisor:
                return True
        except Supervisor.DoesNotExist:
            pass

        # Check if user is a committee member in the correct panel
        try:
            committee_member = CommitteeMember.objects.get(user=request.user)
            if ssg.project and ssg.project.panel == committee_member.panel:
                return True
        except CommitteeMember.DoesNotExist:
            pass

        return False


class IsProjectOwner(BasePermission):
    """
    Permission class that checks if the user created the project.
    """

    message = "You do not have permission to modify this project."

    def has_object_permission(self, request, view, obj):
        if not request.user.is_authenticated:
            return False

        # For safe methods, allow access if user can view the project
        if request.method in ['GET', 'HEAD', 'OPTIONS']:
            return True

        # For modifications, only the creator can modify
        return obj.user == request.user


# ==================== External Examiner Permissions ====================


class IsExternalExaminer(BasePermission):
    """
    Permission check for External Examiner users.
    """
    
    message = "You must be an external examiner to access this resource."

    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            request.user.user_type == 'external_examiner'
        )


class IsExternalExaminerOrCommittee(BasePermission):
    """
    Permission for External Examiners or Committee Members.
    Used for viewing/managing external groups.
    """
    
    message = "You must be an external examiner or committee member to access this resource."

    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            request.user.user_type in ['external_examiner', 'committee_member']
        )


class IsExternalGroupOwner(BasePermission):
    """
    Permission to check if external examiner owns the external group.
    """
    
    message = "You do not have permission to access this external group."

    def has_object_permission(self, request, view, obj):
        if not request.user.is_authenticated:
            return False
            
        if request.user.user_type != 'external_examiner':
            return False
        
        try:
            external = ExternalExaminer.objects.get(user=request.user)
            # For ExternalGroup
            if isinstance(obj, ExternalGroup):
                return obj.external_examiner == external
            # For ExternalGroupAssignment
            if isinstance(obj, ExternalGroupAssignment):
                return obj.external_group.external_examiner == external
            # For ExternalEvaluation
            if isinstance(obj, ExternalEvaluation):
                return obj.assignment.external_group.external_examiner == external
        except ExternalExaminer.DoesNotExist:
            return False
        
        return False


class CanManageExternalGroups(BasePermission):
    """
    Permission to manage external groups (create, assign).
    Only Committee Members and Admins can manage.
    """
    
    message = "Only committee members or administrators can manage external groups."

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
            
        if request.method in SAFE_METHODS:
            return True
        
        return (
            request.user.user_type == 'committee_member' or 
            request.user.is_superuser
        )
