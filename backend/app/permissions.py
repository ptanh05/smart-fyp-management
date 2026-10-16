"""
Custom permission classes for role-based access control (RBAC).
Pure 6-Phase UTC Architecture
"""

from rest_framework.permissions import BasePermission, SAFE_METHODS
from .models import Student, Supervisor, GraduationProject


class IsStudent(BasePermission):
    """Allows access only to students."""
    message = "You must be a student to access this resource."

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        return getattr(request.user, 'user_type', None) == 'student'


class IsSupervisor(BasePermission):
    """Allows access only to supervisors."""
    message = "You must be a supervisor to access this resource."

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        return getattr(request.user, 'user_type', None) == 'supervisor'


class IsCommitteeMember(BasePermission):
    """Allows access to committee members, supervisors, and admins."""
    message = "You must be a committee member to access this resource."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return getattr(request.user, 'user_type', None) in ['committee_member', 'supervisor', 'admin']


class IsExternalExaminer(BasePermission):
    """Allows access only to external examiners."""
    message = "You must be an external examiner to access this resource."

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        return getattr(request.user, 'user_type', None) == 'external_examiner'


class IsAdminUserRole(BasePermission):
    """Allows access only to staff, superuser, or admin role users."""
    message = "You must be an Administrator to access this resource."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return bool(
            request.user.is_staff or 
            request.user.is_superuser or 
            getattr(request.user, 'user_type', None) == 'admin'
        )


class IsStudentOrSupervisor(BasePermission):
    """Allows access to both students and supervisors."""
    message = "You must be a student or supervisor to access this resource."

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        return getattr(request.user, 'user_type', None) in ['student', 'supervisor']


class IsStudentOrSupervisorOrCommitteeMember(BasePermission):
    """Allows access to students, supervisors, and committee members."""
    message = "You must be a student, supervisor, or committee member to access this resource."

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        return getattr(request.user, 'user_type', None) in [
            'student', 'supervisor', 'committee_member'
        ]


class IsSupervisorOrCommitteeMember(BasePermission):
    """Allows access to supervisors, committee members, and admins."""
    message = "You must be a supervisor or committee member to access this resource."

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if request.user.is_staff or request.user.is_superuser:
            return True
        return getattr(request.user, 'user_type', None) in [
            'supervisor', 'committee_member', 'admin'
        ]


class IsProjectOwnerOrSupervisor(BasePermission):
    """Checks if the user is the student owning the graduation project or the assigned supervisor."""
    message = "You do not have permission to access this graduation project."

    def has_object_permission(self, request, view, obj):
        if not request.user.is_authenticated:
            return False
        if request.user.is_staff or request.user.is_superuser or getattr(request.user, 'user_type', None) == 'admin':
            return True

        # Check if obj is a GraduationProject or related object with .project
        project = obj if isinstance(obj, GraduationProject) else getattr(obj, 'project', None)
        if not project:
            return False

        try:
            student = Student.objects.get(user=request.user)
            if project.student == student:
                return True
        except Student.DoesNotExist:
            pass

        try:
            supervisor = Supervisor.objects.get(user=request.user)
            if project.supervisor == supervisor or project.reviewer == supervisor:
                return True
        except Supervisor.DoesNotExist:
            pass

        return False


# Compatibility permission classes for legacy views
class IsDocumentOwner(BasePermission):
    def has_permission(self, request, view): return bool(request.user and request.user.is_authenticated)
    def has_object_permission(self, request, view, obj): return True

class IsGroupMember(BasePermission):
    def has_permission(self, request, view): return bool(request.user and request.user.is_authenticated)
    def has_object_permission(self, request, view, obj): return True

class IsGroupMemberForChat(BasePermission):
    def has_permission(self, request, view): return bool(request.user and request.user.is_authenticated)

class IsChatMessageOwner(BasePermission):
    def has_permission(self, request, view): return bool(request.user and request.user.is_authenticated)

class IsSupervisorOfGroup(BasePermission):
    def has_permission(self, request, view): return bool(request.user and request.user.is_authenticated)

class IsCommitteeMemberOfPanel(BasePermission):
    def has_permission(self, request, view): return bool(request.user and request.user.is_authenticated)

class CanAccessEvaluation(BasePermission):
    def has_permission(self, request, view): return bool(request.user and request.user.is_authenticated)

class IsProjectOwner(BasePermission):
    def has_permission(self, request, view): return bool(request.user and request.user.is_authenticated)

class IsExternalExaminerOrCommittee(BasePermission):
    def has_permission(self, request, view): return bool(request.user and request.user.is_authenticated)

class IsExternalGroupOwner(BasePermission):
    def has_permission(self, request, view): return bool(request.user and request.user.is_authenticated)

class CanManageExternalGroups(BasePermission):
    def has_permission(self, request, view): return bool(request.user and request.user.is_authenticated)
