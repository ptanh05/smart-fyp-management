from .paginators import BasePagination, ChatPagination, CommentsPagination
from rest_framework.status import HTTP_400_BAD_REQUEST
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.generics import (
    ListAPIView,
    RetrieveAPIView,
    CreateAPIView,
    UpdateAPIView,
    DestroyAPIView,
    ListCreateAPIView,
    RetrieveUpdateAPIView,
    RetrieveUpdateDestroyAPIView,
)
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils.html import strip_tags

from rest_framework import status
from rest_framework.exceptions import PermissionDenied, NotFound, ValidationError
from django.http import HttpResponse
from openpyxl import Workbook

from django.shortcuts import get_object_or_404

from django.db.models import Q, Max
from django.db import OperationalError
from datetime import datetime, timedelta
from django.conf import settings
from django.utils import timezone

# Custom permission classes
from .permissions import (
    IsStudent,
    IsSupervisor,
    IsCommitteeMember,
    IsStudentOrSupervisor,
    IsStudentOrSupervisorOrCommitteeMember,
    IsDocumentOwner,
    IsGroupMember,
    IsGroupMemberForChat,
    IsChatMessageOwner,
    IsSupervisorOfGroup,
    IsCommitteeMemberOfPanel,
    CanAccessEvaluation,
    IsProjectOwner,
    IsExternalExaminer,
    IsAdminUserRole,
    IsExternalExaminerOrCommittee,
    IsExternalGroupOwner,
    CanManageExternalGroups,
)

# Custom throttle classes for rate limiting
from .throttles import LoginRateThrottle, PasswordResetRateThrottle
from .models import (
    Student,
    Supervisor,
    CommitteeMember,
    CustomUser,
    GroupCreationComment,
    SupervisorStudentComments,
    ProjectCategories,
    Group,
    Project,
    SupervisorOfStudentGroup,
    Document,
    ScopeDocumentEvaluationCriteria,
    CommitteeMemberPanel,
    CommitteeMemberTemplates,
    DocumentRequirement,
    SRSEvaluationSupervisor,
    SRSEvaluationCommitteeMember,
    SDDEvaluationSupervisor,
    SDDEvaluationCommitteeMember,
    Evaluation3Supervisor,
    Evaluation3CommitteeMember,
    Evaluation4Supervisor,
    Evaluation4CommitteeMember,
    ChatRoom,
    PasswordResetCode,
    Notification,
    NotificationPreference,
    AuditLog,
    ExternalExaminer,
    ExternalGroup,
    ExternalGroupAssignment,
    ExternalEvaluation,
    EvaluationSchedule,
)
from .services import AuditService, NotificationService
from app.serializers.serializers import (
    SupervisorStudentModelCommentsSerializer,
    CommentSerializer,
    ProjectCategoriesSerializer,
    GroupRequestSerializer,
    StudentProfileSerializer,
    GroupStatusSerializer,
    ProjectSerializer,
    SupervisorOfStudentGroupSerializer,
    SupervisorProfileSerializer,
    CommitteeMemberProfileSerializer,
    GroupCategorySerializer,
    DocumentSerializer,
    DocumentStatusUpdateSerializer,
    SupervisorDocumentSerializer,
    ScopeDocumentEvaluationCriteriaSerializer,
    PanelSerializer,
    CommitteeMemberTemplatesSerializer,
    DocumentRequirementSerializer,
    SRSEvaluationSupervisorSerializer,
    SRSEvaluationCommitteeMemberSerializer,
    SDDEvaluationSupervisorSerializer,
    SDDEvaluationCommitteeMemberSerializer,
    Evaluation3SupervisorSerializer,
    Evaluation3CommitteeMemberSerializer,
    Evaluation4SupervisorSerializer,
    Evaluation4CommitteeMemberSerializer,
    ChatRoomSerializer,
    PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer,
    NotificationSerializer,
    NotificationPreferenceSerializer,
    NotificationMarkReadSerializer,
    AuditLogSerializer,
    ExternalExaminerSerializer,
    ExternalExaminerProfileSerializer,
    ExternalExaminerListSerializer,
    ExternalGroupListSerializer,
    ExternalGroupDetailSerializer,
    ExternalGroupCreateSerializer,
    ExternalGroupAssignmentSerializer,
    ExternalGroupAssignmentCreateSerializer,
    ExternalEvaluationSerializer,
    ExternalEvaluationCreateSerializer,
    EvaluationScheduleSerializer,
    EvaluationScheduleCreateSerializer,
)
from .serializers.field_serializers import (
    ChangePasswordDetailSerializer,
    StudentLoginDetailSerializer,
    SupervisorLoginDetailSerializer,
    CommitteeMemberLoginDetailSerializer,
    ExternalExaminerLoginDetailSerializer,
    SupervisorofStudentGroupSerializer,
    SupervisorStudentCommentsSerializer,
)


def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    refresh["user_type"] = user.user_type

    return {
        "refresh": str(refresh),
        "access": str(refresh.access_token),
        "expire_time": datetime.now()
        + settings.SIMPLE_JWT.get("ACCESS_TOKEN_LIFETIME"),
    }


def set_refresh_cookie(response, refresh_token):
    """Set HttpOnly cookie for Refresh Token with production-aware security flags."""
    secure_flag = not getattr(settings, "DEBUG", True)
    response.set_cookie(
        key="refresh_token",
        value=str(refresh_token),
        httponly=True,
        secure=secure_flag,
        samesite="Lax",
        path="/app/",
    )
    return response


def delete_refresh_cookie(response):
    """Clear HttpOnly refresh_token cookie."""
    response.delete_cookie(
        key="refresh_token",
        path="/app/",
    )
    return response


class CookieTokenRefreshAPIView(APIView):
    """
    Refresh Access Token using HttpOnly Cookie.
    Rotates refresh token and blacklists previous refresh token.
    """
    throttle_classes = [LoginRateThrottle]

    def post(self, request):
        raw_refresh = request.COOKIES.get("refresh_token") or request.data.get("refresh")
        if not raw_refresh:
            return Response(
                {"detail": "Refresh token cookie missing."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        try:
            refresh_obj = RefreshToken(raw_refresh)
            new_access_token = str(refresh_obj.access_token)
            
            # SimpleJWT blacklists old token upon rotation when blacklist is enabled
            if settings.SIMPLE_JWT.get("ROTATE_REFRESH_TOKENS", True):
                if settings.SIMPLE_JWT.get("BLACKLIST_AFTER_ROTATION", True):
                    try:
                        refresh_obj.blacklist()
                    except AttributeError:
                        pass
                refresh_obj.set_jti()
                refresh_obj.set_exp()
                refresh_obj.set_iat()
                new_refresh_str = str(refresh_obj)
            else:
                new_refresh_str = raw_refresh

            response = Response({"access": new_access_token}, status=status.HTTP_200_OK)
            set_refresh_cookie(response, new_refresh_str)
            return response
        except Exception:
            response = Response(
                {"detail": "Invalid or expired refresh token."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
            delete_refresh_cookie(response)
            return response


class CookieLogoutAPIView(APIView):
    """
    Revoke server-side Refresh Token and clear HttpOnly cookie.
    """
    def post(self, request):
        raw_refresh = request.COOKIES.get("refresh_token") or request.data.get("refresh")
        if raw_refresh:
            try:
                token_obj = RefreshToken(raw_refresh)
                token_obj.blacklist()
            except Exception:
                pass

        response = Response(
            {"detail": "Logged out successfully."},
            status=status.HTTP_200_OK,
        )
        delete_refresh_cookie(response)
        return response


class WebSocketTicketAPIView(APIView):
    """
    Generate short-lived one-time authentication ticket for WebSocket connections.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        import secrets
        from django.core.cache import cache

        group_id = request.data.get("group_id")
        ticket = secrets.token_urlsafe(32)
        ticket_data = {
            "user_id": request.user.id,
            "group_id": group_id,
        }
        cache.set(f"ws_ticket_{ticket}", ticket_data, timeout=60)
        return Response(
            {"ticket": ticket, "expires_in": 60},
            status=status.HTTP_200_OK,
        )


class ChangePasswordView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        serializer = ChangePasswordDetailSerializer(data=request.data)
        if serializer.is_valid():
            if not user.check_password(serializer.validated_data.get("old_password")):
                return Response(
                    {"message": "Old password is incorrect"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            user.set_password(serializer.validated_data.get("new_password"))
            user.save()
            return Response(
                {"message": "Password changed successfully"}, status=status.HTTP_200_OK
            )
        else:
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PasswordResetRequestView(APIView):
    """
    Request a password reset by providing an email address.
    A 6-digit code will be sent to the email if the account exists.
    """
    throttle_classes = [PasswordResetRateThrottle]

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data["email"]
            user = CustomUser.objects.get(email=email)
            
            # Create a new reset code
            reset_code = PasswordResetCode.create_for_user(user)
            
            # Send email with the code
            subject = "Password Reset Code - Project Management System"
            message = f"""
Hello {user.username},

You have requested to reset your password. Please use the following 6-digit code to reset your password:

    {reset_code.code}

This code will expire in 24 hours.

If you did not request this password reset, please ignore this email.

Best regards,
Project Management System
"""
            try:
                send_mail(
                    subject=subject,
                    message=message,
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[email],
                    fail_silently=False,
                )
                return Response(
                    {
                        "message": "Password reset code has been sent to your email.",
                        "email": email,
                    },
                    status=status.HTTP_200_OK,
                )
            except Exception as e:
                # Log the error but don't expose details to user
                return Response(
                    {"message": "Failed to send email. Please try again later."},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PasswordResetConfirmView(APIView):
    """
    Confirm password reset by providing email, 6-digit code, and new password.
    """
    throttle_classes = [PasswordResetRateThrottle]

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data["email"]
            code = serializer.validated_data["code"]
            new_password = serializer.validated_data["new_password"]
            
            try:
                user = CustomUser.objects.get(email=email)
            except CustomUser.DoesNotExist:
                return Response(
                    {"message": "Invalid email address."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            
            # Find the reset code
            reset_code = PasswordResetCode.objects.filter(
                user=user,
                code=code,
                is_used=False,
            ).first()
            
            if not reset_code:
                return Response(
                    {"message": "Invalid or expired reset code."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            
            if not reset_code.is_valid():
                return Response(
                    {"message": "Reset code has expired. Please request a new one."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            
            # Reset the password
            user.set_password(new_password)
            user.save()
            
            # Mark the code as used
            reset_code.mark_as_used()
            
            return Response(
                {"message": "Password has been reset successfully. You can now login with your new password."},
                status=status.HTTP_200_OK,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class StudentLoginView(APIView):
    throttle_classes = [LoginRateThrottle]

    def post(self, request):
        serializer = StudentLoginDetailSerializer(data=request.data)
        if serializer.is_valid():
            student = Student.objects.filter(
                registration_no=serializer.validated_data.get("registration_no")
            ).first()
            if student and student.user.check_password(
                serializer.validated_data.get("password")
            ):
                token = get_tokens_for_user(student.user)
                refresh_token_str = token.get("refresh")
                response_data = {
                    "access": token.get("access"),
                    "expire_time": token.get("expire_time"),
                }
                response = Response(response_data, status=status.HTTP_200_OK)
                set_refresh_cookie(response, refresh_token_str)
                return response
            else:
                return Response(
                    {
                        "detail": "Invalid registration number or password.",
                        "message": "Invalid registration number or password.",
                    },
                    status=status.HTTP_401_UNAUTHORIZED,
                )
        else:
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class StudentProfileView(RetrieveAPIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsStudent]
    serializer_class = StudentProfileSerializer
    queryset = Student.objects.all()

    def get_object(self):
        return get_object_or_404(self.get_queryset(), user=self.request.user)


class StudentsListView(ListAPIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsStudent]
    serializer_class = StudentProfileSerializer
    queryset = Student.objects.all()
    pagination_class = BasePagination

    def get_queryset(self):
        for_request = self.request.GET.get("for_request")
        search = self.request.GET.get("search")
        student = Student.objects.get(user=self.request.user)
        queryset = (
            super()
            .get_queryset()
            .filter(
                batch_no=student.batch_no,
                department=student.department,
                semester=student.semester,
            )
        )
        if for_request == "true":
            queryset = queryset.exclude(
                id__in=student.send_request.filter(status="accepted").values_list(
                    "student_2", flat=True
                )
            )
            queryset = queryset.exclude(
                id__in=student.receive_request.filter(status="accepted").values_list(
                    "student_1", flat=True
                )
            )
        
        # Search by name or registration number
        if search:
            queryset = queryset.filter(
                Q(user__username__icontains=search) |
                Q(user__first_name__icontains=search) |
                Q(user__last_name__icontains=search) |
                Q(registration_no__icontains=search)
            )
        
        return queryset.order_by('user__username')


class ProjectCategoriesView(ListAPIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsStudentOrSupervisorOrCommitteeMember]
    serializer_class = ProjectCategoriesSerializer
    queryset = ProjectCategories.objects.all()
    pagination_class = BasePagination


class GroupRequestView(CreateAPIView, UpdateAPIView, ListAPIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsStudent]
    serializer_class = GroupRequestSerializer
    queryset = Group.objects.all()
    pagination_class = BasePagination

    def get_queryset(self):
        requested = self.request.GET.get("requested")
        status_filter = self.request.GET.get("status")
        search = self.request.GET.get("search")
        
        queryset = super().get_queryset()
        
        if requested == "to":  # student sent from that student to other student
            queryset = queryset.filter(student_1__user=self.request.user)
        elif requested == "from":  # student received from other student to that student
            queryset = queryset.filter(student_2__user=self.request.user)
        
        # Filter by status
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        # Search by student name or registration number
        if search:
            queryset = queryset.filter(
                Q(student_1__user__username__icontains=search) |
                Q(student_2__user__username__icontains=search) |
                Q(student_1__registration_no__icontains=search) |
                Q(student_2__registration_no__icontains=search)
            )
        
        return queryset.order_by('-id')

    def post(self, request, *args, **kwargs):
        try:
            student_1 = Student.objects.get(user=request.user)
            
            # Check if student_1 already has an accepted group
            if student_1.send_request.filter(status="accepted").exists() or \
               student_1.receive_request.filter(status="accepted").exists():
                return Response(
                    {"message": "You already have an accepted group. Cannot send more requests."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            
            serializer = GroupRequestSerializer(
                data={
                    **request.data,
                    "student_1": student_1.id,
                }
            )
            if serializer.is_valid():
                student_2 = serializer.validated_data.get("student_2")
                
                # Check if student_2 already has an accepted group
                if student_2.receive_request.filter(status="accepted").exists() or \
                   student_2.send_request.filter(status="accepted").exists():
                    return Response(
                        {"message": "The selected student already has an accepted group"},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                
                group = serializer.save()
                NotificationService.notify_group_request(student_1, student_2, group)
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            else:
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Student.DoesNotExist:
            return Response(
                {"message": "Student not found"}, status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {"message": f"An error occurred: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    def update(self, request, *args, **kwargs):
        try:
            grouo_id = request.GET.get("pk")
            group = Group.objects.get(id=grouo_id)
            if group.student_1.user == request.user:
                serializer = GroupCategorySerializer(
                    instance=group, data=request.data, partial=True
                )
            else:
                serializer = GroupStatusSerializer(
                    instance=group, data=request.data, partial=True
                )
                request_status = request.data.get("status")
                if request_status == "accepted":
                    student_1_receive_status = group.student_1.receive_request.filter(
                        status="accepted"
                    ).exists()
                    student_1_send_status = group.student_1.send_request.filter(
                        status="accepted"
                    ).exists()
                    if student_1_receive_status or student_1_send_status:
                        return Response(
                            {
                                "message": "You are too late to accept group mate request"
                            },
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                    student_2_receive_status = group.student_2.receive_request.filter(
                        status="accepted"
                    ).exists()
                    student_2_send_status = group.student_2.send_request.filter(
                        status="accepted"
                    ).exists()
                    if student_2_receive_status or student_2_send_status:
                        return Response(
                            {"message": "someone already choose you as group mate"},
                            status=status.HTTP_400_BAD_REQUEST,
                        )

            if serializer.is_valid():
                serializer.save()
                saved_status = serializer.data.get("status")
                if saved_status in ("accepted", "rejected"):
                    NotificationService.notify_group_request_response(
                        group, accepted=(saved_status == "accepted")
                    )
                if saved_status:
                    Group.objects.filter(
                        ~Q(id=group.id),
                        Q(student_1__user=request.user)
                        | Q(student_2__user=request.user)
                        | Q(student_1=group.student_1)
                        | Q(student_2=group.student_1),
                        status="pending",
                    ).update(status="canceled")
                return Response(serializer.data, status.HTTP_200_OK)
            else:
                return Response(serializer.errors, status.HTTP_400_BAD_REQUEST)
        except Group.DoesNotExist:
            return Response(
                {"message": "Group mate request not found"},
                status=status.HTTP_404_NOT_FOUND,
            )


class GetGroupRequestView(RetrieveAPIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsStudent, IsGroupMember]
    serializer_class = GroupRequestSerializer
    queryset = Group.objects.all()


class GroupDetailView(RetrieveAPIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsStudentOrSupervisor]
    serializer_class = GroupRequestSerializer
    queryset = Group.objects.all()


class GroupComments(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsStudent]
    lookup_url_kwarg = "group"
    lookup_field = "group"

    def post(self, request, group):
        try:
            # Get the student and group instances
            student = Student.objects.get(user=request.user)
            group_instance = Group.objects.get(id=group)
        except Student.DoesNotExist:
            return Response(
                {"message": "Student not found"}, status=status.HTTP_404_NOT_FOUND
            )
        except Group.DoesNotExist:
            return Response(
                {"message": "Group not found"}, status=status.HTTP_404_NOT_FOUND
            )

        # Initialize serializer with request data
        serializer = CommentSerializer(data=request.data)
        if serializer.is_valid():
            # Save with the student and group instances
            serializer.save(student=student, group=group_instance)
            supervisor_group = SupervisorOfStudentGroup.objects.filter(
                group=group_instance
            ).first()
            comment_preview = serializer.validated_data.get("comment", "")[:50]
            NotificationService.notify_new_comment(
                request.user, group_instance, supervisor_group, comment_preview
            )
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def get(self, request, group):
        try:
            group_comments = GroupCreationComment.objects.filter(group=group)
            serializer = CommentSerializer(group_comments, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except GroupCreationComment.DoesNotExist:
            return Response({"message": "No comments found"}, status=404)


class ProjectAPIVIEW(ListAPIView, CreateAPIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsStudentOrSupervisorOrCommitteeMember]
    serializer_class = ProjectSerializer
    queryset = Project.objects.all()
    pagination_class = BasePagination

    def get_queryset(self):
        queryset = super().get_queryset()
        category_id = self.request.GET.get("category_id")
        search = self.request.GET.get("search")
        offered = self.request.GET.get("offered", "").lower() == "true"
        mine_only = self.request.GET.get("mine_only", "").lower() == "true"

        if category_id:
            queryset = queryset.filter(project_category_id=category_id)

        if offered:
            queryset = queryset.filter(user__isnull=True)
        elif mine_only:
            queryset = queryset.filter(user=self.request.user)
        else:
            queryset = queryset.filter(
                Q(user__isnull=True) | Q(user=self.request.user)
            )

        # Search by project name, description, or language
        if search:
            queryset = queryset.filter(
                Q(project_name__icontains=search) |
                Q(project_description__icontains=search) |
                Q(language__icontains=search)
            )

        return queryset.order_by('-id')


class ListSuperisorAPIView(ListAPIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsStudent]
    serializer_class = SupervisorProfileSerializer
    queryset = Supervisor.objects.all()
    pagination_class = BasePagination

    def get_queryset(self):
        category = self.request.GET.get("category")
        search = self.request.GET.get("search")
        queryset = super().get_queryset()
        
        if category:
            queryset = queryset.filter(category__id=category)
        
        # Search by name or research interest
        if search:
            queryset = queryset.filter(
                Q(user__username__icontains=search) |
                Q(user__first_name__icontains=search) |
                Q(user__last_name__icontains=search) |
                Q(research_interest__icontains=search) |
                Q(supervisor_id__icontains=search)
            )
        
        return queryset.order_by('user__username')


class SendSupervisorRequestAPIView(CreateAPIView, ListAPIView, UpdateAPIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsStudentOrSupervisor]
    serializer_class = SupervisorOfStudentGroupSerializer
    queryset = SupervisorOfStudentGroup.objects.all()
    pagination_class = BasePagination

    def get_queryset(self):
        requested = self.request.GET.get("requested")
        try:
            student = Student.objects.get(user=self.request.user)
            group = Group.objects.get(
                Q(student_1=student) | Q(student_2=student), status="accepted"
            )
            query_set = super().get_queryset().filter(group=group.id)
            if requested == "to":
                return query_set.filter(created_by__user=self.request.user)
            elif requested == "from":
                return query_set.exclude(created_by__user=self.request.user)
            else:
                return query_set
        except Group.DoesNotExist:
            pass
        except Student.DoesNotExist:
            pass
        try:
            supervisor = Supervisor.objects.get(user=self.request.user)
            # For supervisors, show all requests (pending, accepted, etc.)
            # Students can filter by 'requested' parameter, but supervisors see all their requests
            queryset = super().get_queryset().filter(supervisor=supervisor)
            # If no specific status filter, show all statuses
            return queryset
        except Supervisor.DoesNotExist:
            pass
        return super().get_queryset()

    def post(self, request, *args, **kwargs):
        data = request.data
        project_data = data.get("project")
        if type(project_data) is dict:
            project_serializer = ProjectSerializer(data=project_data)
            if not project_serializer.is_valid():
                return Response(project_serializer.errors, status=HTTP_400_BAD_REQUEST)
            project_serializer.save()
            project_data = project_serializer.data.get("id")
            data.update({"project": project_data})
        serializer = SupervisorofStudentGroupSerializer(data=data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=HTTP_400_BAD_REQUEST)
        try:
            student = Student.objects.get(user=request.user)
            group = Group.objects.get(
                Q(student_1=student) | Q(student_2=student), status="accepted"
            )
            supervisor = Supervisor.objects.get(
                id=serializer.validated_data["supervisor"]
            )
            project = Project.objects.get(id=serializer.validated_data["project"])
            if SupervisorOfStudentGroup.objects.filter(
                group=group.id, supervisor=supervisor
            ).exists():
                return Response(
                    {"message": "Supervisor already assigned to this group"}, status=400
                )
            supervisor_request = SupervisorOfStudentGroup.objects.create(
                group=group, supervisor=supervisor, project=project, created_by=student
            )
            NotificationService.notify_supervisor_request(
                student, supervisor, supervisor_request
            )
            serializer = SupervisorOfStudentGroupSerializer(supervisor_request)
            return Response(serializer.data, status=201)
        except Group.DoesNotExist:
            return Response({"message": "Group mate not found"}, status=404)
        except Supervisor.DoesNotExist:
            return Response({"message": "Supervisor not found"}, status=404)

    def update(self, request, *args, **kwargs):
        response_student = None
        try:
            id = self.request.GET.get("pk")
            try:
                student = Student.objects.get(user=self.request.user)
            except Student.DoesNotExist:
                student = None
            if student:
                if not id:
                    return Response(
                        {"message": "Supervisor request id not found"}, status=400
                    )
                group = Group.objects.get(
                    Q(student_1__user=self.request.user)
                    | Q(student_2__user=self.request.user),
                    status="accepted",
                )
                if not group:
                    return Response({"message": "Group mate not found"}, status=404)
                if group.student_1.user == self.request.user:
                    response_student = group.student_2
                elif group.student_2.user == self.request.user:
                    response_student = group.student_1
                else:
                    return Response(
                        {"message": "You are not a member of this group"}, status=404
                    )
            supervisor_request = SupervisorOfStudentGroup.objects.get(id=id)
            if student:
                if supervisor_request.created_by.user == self.request.user:
                    return Response(
                        {"message": "You cannot update this request"}, status=400
                    )
                if supervisor_request.created_by != response_student:
                    return Response(
                        {"message": "You cannot update this request"}, status=400
                    )
            serializer = SupervisorOfStudentGroupSerializer(
                instance=supervisor_request, data=request.data, partial=True
            )
            if serializer.is_valid():
                if student:
                    if serializer.validated_data.get("status") != "accepted_by_student":
                        return Response(
                            {"message": "Invalid status"},
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                serializer.save()
                return Response(serializer.data, status=status.HTTP_200_OK)
            else:
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except SupervisorOfStudentGroup.DoesNotExist:
            return Response(
                {"message": "Supervisor request not found"},
                status=status.HTTP_404_NOT_FOUND,
            )


class SendSupervisorRequestDetailAPIView(RetrieveAPIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsStudentOrSupervisor, IsGroupMember]
    serializer_class = SupervisorOfStudentGroupSerializer
    queryset = SupervisorOfStudentGroup.objects.all()
    pagination_class = BasePagination


class SupervisorStudentCommentsAPIView(CreateAPIView, ListAPIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsStudentOrSupervisor]
    serializer_class = SupervisorStudentModelCommentsSerializer
    queryset = SupervisorStudentComments.objects.all()
    pagination_class = CommentsPagination

    def get_queryset(self):
        group_id = self.request.GET.get("group")
        queryset = super().get_queryset().order_by("-created_at")  # Newest first
        if group_id:
            return queryset.filter(group=group_id)
        return queryset

    def post(self, request, *args, **kwargs):
        serializer = SupervisorStudentCommentsSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=HTTP_400_BAD_REQUEST)
        commented_by = None
        try:
            group = Group.objects.get(id=serializer.validated_data["group"])
        except Group.DoesNotExist:
            return Response({"message": "Group not found"}, status=404)
        try:
            student = Student.objects.get(user=request.user)
            commented_by = "student"
        except Student.DoesNotExist:
            student = None
        try:
            supervisor = Supervisor.objects.get(user=request.user)
            commented_by = "supervisor"
        except Supervisor.DoesNotExist:
            supervisor = None
        if not student and not supervisor:
            return Response(
                {"message": "You are not a member of this group"}, status=404
            )
        student_supervisor_comment = SupervisorStudentComments(
            comment=serializer.validated_data["comment"],
            commented_by=commented_by,
            group=group,
            student=student,
            supervisor=supervisor,
        )
        student_supervisor_comment.save()
        supervisor_group = SupervisorOfStudentGroup.objects.filter(group=group).first()
        comment_preview = serializer.validated_data["comment"][:50]
        NotificationService.notify_new_comment(
            request.user, group, supervisor_group, comment_preview
        )
        return Response(
            {"message": "Comment added successfully"}, status=status.HTTP_201_CREATED
        )


class SupervisorResponseAPIView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsSupervisor]

    def post(self, request):
        supervisor_studet_id = request.data.get("supervisor_student_id")
        status = request.data.get("status")

        try:
            supervisor_request = SupervisorOfStudentGroup.objects.get(
                id=supervisor_studet_id
            )
            if status == "accepted":
                supervisor_request.status = "accepted"
            elif status == "rejected":
                supervisor_request.status = "rejected"
            else:
                return Response({"message": "Invalid status"}, status=400)

            supervisor_request.save()
            NotificationService.notify_supervisor_request_response(
                supervisor_request, accepted=(status == "accepted")
            )
            serializer = SupervisorOfStudentGroupSerializer(supervisor_request)
            return Response(serializer.data, status=200)
        except SupervisorOfStudentGroup.DoesNotExist:
            return Response({"message": "Supervisor request not found"}, status=404)


class SupervisorLoginAPIView(APIView):
    throttle_classes = [LoginRateThrottle]

    def post(self, request):
        serializer = SupervisorLoginDetailSerializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data.get("email")
            supervisor = Supervisor.objects.filter(user__email=email).first()
            if supervisor and supervisor.user.check_password(
                serializer.validated_data.get("password")
            ):
                token = get_tokens_for_user(supervisor.user)
                refresh_token_str = token.get("refresh")
                response_data = {
                    "access": token.get("access"),
                    "expire_time": token.get("expire_time"),
                }
                response = Response(response_data, status=status.HTTP_200_OK)
                set_refresh_cookie(response, refresh_token_str)
                return response
            else:
                return Response(
                    {
                        "detail": "Invalid registration number or password.",
                        "message": "Invalid registration number or password.",
                    },
                    status=status.HTTP_401_UNAUTHORIZED,
                )
        else:
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class SupervisorProfileView(RetrieveAPIView, UpdateAPIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsSupervisor]
    serializer_class = SupervisorProfileSerializer
    queryset = Supervisor.objects.all()

    def get_object(self):
        return get_object_or_404(self.get_queryset(), user=self.request.user)


class CommitteeMemberLoginAPIView(APIView):
    throttle_classes = [LoginRateThrottle]

    def post(self, request):
        serializer = CommitteeMemberLoginDetailSerializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data.get("email")
            committee_member = CommitteeMember.objects.filter(user__email=email).first()
            if committee_member and committee_member.user.check_password(
                serializer.validated_data.get("password")
            ):
                token = get_tokens_for_user(committee_member.user)
                refresh_token_str = token.get("refresh")
                response_data = {
                    "access": token.get("access"),
                    "expire_time": token.get("expire_time"),
                }
                response = Response(response_data, status=status.HTTP_200_OK)
                set_refresh_cookie(response, refresh_token_str)
                return response
            else:
                return Response(
                    {
                        "detail": "Invalid registration number or password.",
                        "message": "Invalid registration number or password.",
                    },
                    status=status.HTTP_401_UNAUTHORIZED,
                )
        else:
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ExternalExaminerLoginAPIView(APIView):
    """
    Login endpoint for External Examiners.
    """
    throttle_classes = [LoginRateThrottle]

    def post(self, request):
        serializer = ExternalExaminerLoginDetailSerializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data.get("email")
            external_examiner = ExternalExaminer.objects.filter(
                user__email=email, 
                is_active=True
            ).first()
            
            if external_examiner and external_examiner.user.check_password(
                serializer.validated_data.get("password")
            ):
                token = get_tokens_for_user(external_examiner.user)
                refresh_token_str = token.get("refresh")
                response_data = {
                    "access": token.get("access"),
                    "expire_time": token.get("expire_time"),
                    "profile": {
                        "id": external_examiner.id,
                        "external_id": external_examiner.external_id,
                        "institution": external_examiner.institution,
                        "designation": external_examiner.designation,
                        "full_name": external_examiner.user.get_full_name(),
                    },
                }
                response = Response(response_data, status=status.HTTP_200_OK)
                set_refresh_cookie(response, refresh_token_str)
                return response
            else:
                return Response(
                    {
                        "detail": "Invalid registration number or password.",
                        "message": "Invalid registration number or password.",
                    },
                    status=status.HTTP_401_UNAUTHORIZED,
                )
        else:
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CommitteeMemberProfileView(RetrieveAPIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsCommitteeMember]
    serializer_class = CommitteeMemberProfileSerializer
    queryset = CommitteeMember.objects.all()

    def get_object(self):
        return get_object_or_404(self.get_queryset(), user=self.request.user)


class DocumentUploadAPIView(CreateAPIView, ListAPIView, UpdateAPIView):
    permission_classes = [IsAuthenticated, IsStudentOrSupervisorOrCommitteeMember]
    authentication_classes = [JWTAuthentication]
    serializer_class = DocumentSerializer
    queryset = Document.objects.all()

    def get_queryset(self):
        group = self.request.GET.get("group")
        queryset = (
            super()
            .get_queryset()
            .filter(document_type=self.kwargs.get("document_type"))
        )
        if group:
            try:
                Supervisor.objects.get(user=self.request.user)
                # Supervisor sees all working docs (accepted / accepted_by_student) for the group
                return queryset.filter(
                    group=group, status__in=["accepted", "accepted_by_student"]
                )
            except Supervisor.DoesNotExist:
                try:
                    CommitteeMember.objects.get(user=self.request.user)
                    # Committee sees only documents submitted to them (final versions), not all phases
                    return queryset.filter(group=group, submitted_to_committee=True)
                except CommitteeMember.DoesNotExist:
                    # Student sees all documents (all phases) for their group
                    return queryset.filter(group=group)
        return queryset

    def create(self, request, *args, **kwargs):
        document_type = self.kwargs.get("document_type")
        if document_type not in [
            "scope_document",
            "srs_document",
            "sdd_document",
            "final_report_document",
            "presentation_document",
        ]:
            return Response(
                {"message": "Invalid document type"}, status=status.HTTP_400_BAD_REQUEST
            )
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        student = Student.objects.get(user=self.request.user)
        group = SupervisorOfStudentGroup.objects.get(
            Q(group__student_1=student) | Q(group__student_2=student),
            status="accepted",
        )
        # Block submission after deadline: get latest deadline for this document type (and student's semester)
        requirements = DocumentRequirement.objects.filter(
            document_type=document_type
        ).filter(Q(semester__isnull=True) | Q(semester=student.semester))
        latest_deadline = requirements.aggregate(Max("deadline"))["deadline__max"]
        if latest_deadline is not None and timezone.now() > latest_deadline:
            return Response(
                {"message": "Submission deadline has passed for this document type."},
                status=status.HTTP_403_FORBIDDEN,
            )
        document = serializer.save(
            uploaded_by=student, group=group, document_type=document_type
        )
        NotificationService.notify_document_uploaded(document, group)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        document_id = self.request.GET.get("pk")
        try:
            student = Student.objects.get(user=self.request.user)
            group = SupervisorOfStudentGroup.objects.get(
                Q(group__student_1=student) | Q(group__student_2=student),
                status="accepted",
            )
            document = Document.objects.get(id=document_id, group=group.id)
            serializer = DocumentStatusUpdateSerializer(
                instance=document, data=request.data, partial=True
            )
            if not serializer.is_valid():
                return Response(serializer.errors, status=HTTP_400_BAD_REQUEST)
            if (
                document.uploaded_by == student
                and serializer.validated_data.get("status") == "accepted_by_student"
            ):
                return Response(
                    {"message": "You cannot update this document"}, status=400
                )
            if serializer.validated_data.get("status") == "accepted":
                return Response(
                    {"message": "You cannot update this document"}, status=400
                )
            new_status = serializer.validated_data.get("status")
            serializer.save()
            if new_status in ("accepted", "rejected"):
                NotificationService.notify_document_status_change(
                    document, group, approved=(new_status == "accepted")
                )
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Document.DoesNotExist:
            return Response(
                {"message": "Document not found"}, status=status.HTTP_404_NOT_FOUND
            )
        except Group.DoesNotExist:
            return Response(
                {"message": "Group mate not found"}, status=status.HTTP_404_NOT_FOUND
            )
        except Student.DoesNotExist:
            try:
                supervisor = Supervisor.objects.get(user=self.request.user)
                document = Document.objects.get(
                    id=document_id, group__supervisor=supervisor.id
                )
                serializer = DocumentStatusUpdateSerializer(
                    instance=document, data=request.data, partial=True
                )
                if not serializer.is_valid():
                    return Response(serializer.errors, status=HTTP_400_BAD_REQUEST)
                new_status = serializer.validated_data.get("status")
                serializer.save()
                if new_status in ("accepted", "rejected"):
                    NotificationService.notify_document_status_change(
                        document, document.group, approved=(new_status == "accepted")
                    )
                return Response(serializer.data, status=status.HTTP_200_OK)
            except Document.DoesNotExist:
                return Response(
                    {"message": "Document not found"}, status=status.HTTP_404_NOT_FOUND
                )
            except Supervisor.DoesNotExist:
                return Response(
                    {"message": "Supervisor not found"},
                    status=status.HTTP_404_NOT_FOUND,
                )


class ScopeDocumentEvaluationCriteriaView(RetrieveAPIView, UpdateAPIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsStudentOrSupervisorOrCommitteeMember]
    serializer_class = ScopeDocumentEvaluationCriteriaSerializer
    queryset = ScopeDocumentEvaluationCriteria.objects.all()

    def update(self, request, *args, **kwargs):
        # Only committee members can update evaluations
        if request.user.user_type != 'committee_member':
            return Response(
                {"message": "You are not authorized to update this document"},
                status=status.HTTP_403_FORBIDDEN,
            )
        
        # Get old values for audit logging
        instance = self.get_object()
        old_data = {field: getattr(instance, field) for field in request.data.keys() if hasattr(instance, field)}
        
        response = super().update(request, *args, **kwargs)
        
        # Log changes if update was successful
        if response.status_code == 200:
            # Find the supervisor group that has this evaluation
            supervisor_group = SupervisorOfStudentGroup.objects.filter(
                Scope_document_evaluation_form=instance
            ).first()
            
            new_data = {field: getattr(instance, field) for field in request.data.keys() if hasattr(instance, field)}
            AuditService.log_evaluation_changes(
                request, instance, "scope_document", supervisor_group, old_data, new_data
            )
        
        return response


class SRSEvaluationSupervisorView(RetrieveAPIView, UpdateAPIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsStudentOrSupervisor]
    serializer_class = SRSEvaluationSupervisorSerializer
    queryset = SRSEvaluationSupervisor.objects.all()

    def update(self, request, *args, **kwargs):
        # Only supervisors can update
        if request.user.user_type != 'supervisor':
            return Response(
                {"message": "You are not authorized to update this document"},
                status=status.HTTP_403_FORBIDDEN,
            )
        
        # Get old values for audit logging
        instance = self.get_object()
        old_data = {field: getattr(instance, field) for field in request.data.keys() if hasattr(instance, field)}
        
        response = super().update(request, *args, **kwargs)
        
        # Log changes if update was successful
        if response.status_code == 200:
            supervisor_group = SupervisorOfStudentGroup.objects.filter(
                srs_evaluation_supervisor=instance
            ).first()
            
            new_data = {field: getattr(instance, field) for field in request.data.keys() if hasattr(instance, field)}
            AuditService.log_evaluation_changes(
                request, instance, "srs_supervisor", supervisor_group, old_data, new_data
            )
        
        return response


class SRSEvaluationCommitteeMemberView(RetrieveAPIView, UpdateAPIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsStudentOrSupervisorOrCommitteeMember]
    serializer_class = SRSEvaluationCommitteeMemberSerializer
    queryset = SRSEvaluationCommitteeMember.objects.all()

    def update(self, request, *args, **kwargs):
        # Only committee members can update
        if request.user.user_type != 'committee_member':
            return Response(
                {"message": "You are not authorized to update this document"},
                status=status.HTTP_403_FORBIDDEN,
            )
        
        # Get old values for audit logging
        instance = self.get_object()
        old_data = {field: getattr(instance, field) for field in request.data.keys() if hasattr(instance, field)}
        
        response = super().update(request, *args, **kwargs)
        
        # Log changes if update was successful
        if response.status_code == 200:
            supervisor_group = SupervisorOfStudentGroup.objects.filter(
                srs_evaluation_committee_member=instance
            ).first()
            
            new_data = {field: getattr(instance, field) for field in request.data.keys() if hasattr(instance, field)}
            AuditService.log_evaluation_changes(
                request, instance, "srs_committee", supervisor_group, old_data, new_data
            )
        
        return response


class SDDEvaluationSupervisorView(RetrieveAPIView, UpdateAPIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsStudentOrSupervisor]
    serializer_class = SDDEvaluationSupervisorSerializer
    queryset = SDDEvaluationSupervisor.objects.all()

    def update(self, request, *args, **kwargs):
        # Only supervisors can update
        if request.user.user_type != 'supervisor':
            return Response(
                {"message": "You are not authorized to update this document"},
                status=status.HTTP_403_FORBIDDEN,
            )
        
        # Get old values for audit logging
        instance = self.get_object()
        old_data = {field: getattr(instance, field) for field in request.data.keys() if hasattr(instance, field)}
        
        response = super().update(request, *args, **kwargs)
        
        # Log changes if update was successful
        if response.status_code == 200:
            supervisor_group = SupervisorOfStudentGroup.objects.filter(
                sdd_evaluation_supervisor=instance
            ).first()
            
            new_data = {field: getattr(instance, field) for field in request.data.keys() if hasattr(instance, field)}
            AuditService.log_evaluation_changes(
                request, instance, "sdd_supervisor", supervisor_group, old_data, new_data
            )
        
        return response


class SDDEvaluationCommitteeMemberView(RetrieveAPIView, UpdateAPIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsStudentOrSupervisorOrCommitteeMember]
    serializer_class = SDDEvaluationCommitteeMemberSerializer
    queryset = SDDEvaluationCommitteeMember.objects.all()

    def update(self, request, *args, **kwargs):
        # Only committee members can update
        if request.user.user_type != 'committee_member':
            return Response(
                {"message": "You are not authorized to update this document"},
                status=status.HTTP_403_FORBIDDEN,
            )
        
        # Get old values for audit logging
        instance = self.get_object()
        old_data = {field: getattr(instance, field) for field in request.data.keys() if hasattr(instance, field)}
        
        response = super().update(request, *args, **kwargs)
        
        # Log changes if update was successful
        if response.status_code == 200:
            supervisor_group = SupervisorOfStudentGroup.objects.filter(
                sdd_evaluation_committee_member=instance
            ).first()
            
            new_data = {field: getattr(instance, field) for field in request.data.keys() if hasattr(instance, field)}
            AuditService.log_evaluation_changes(
                request, instance, "sdd_committee", supervisor_group, old_data, new_data
            )
        
        return response


class Evaluation3SupervisorView(RetrieveAPIView, UpdateAPIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsStudentOrSupervisor]
    serializer_class = Evaluation3SupervisorSerializer
    queryset = Evaluation3Supervisor.objects.all()

    def update(self, request, *args, **kwargs):
        # Only supervisors can update
        if request.user.user_type != 'supervisor':
            return Response(
                {"message": "You are not authorized to update this document"},
                status=status.HTTP_403_FORBIDDEN,
            )
        
        # Get old values for audit logging
        instance = self.get_object()
        old_data = {field: getattr(instance, field) for field in request.data.keys() if hasattr(instance, field)}
        
        response = super().update(request, *args, **kwargs)
        
        # Log changes if update was successful
        if response.status_code == 200:
            supervisor_group = SupervisorOfStudentGroup.objects.filter(
                evaluation3_supervisor=instance
            ).first()
            
            new_data = {field: getattr(instance, field) for field in request.data.keys() if hasattr(instance, field)}
            AuditService.log_evaluation_changes(
                request, instance, "evaluation3_supervisor", supervisor_group, old_data, new_data
            )
        
        return response


class Evaluation3CommitteeMemberView(RetrieveAPIView, UpdateAPIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsStudentOrSupervisorOrCommitteeMember]
    serializer_class = Evaluation3CommitteeMemberSerializer
    queryset = Evaluation3CommitteeMember.objects.all()

    def update(self, request, *args, **kwargs):
        # Only committee members can update
        if request.user.user_type != 'committee_member':
            return Response(
                {"message": "You are not authorized to update this document"},
                status=status.HTTP_403_FORBIDDEN,
            )
        
        # Get old values for audit logging
        instance = self.get_object()
        old_data = {field: getattr(instance, field) for field in request.data.keys() if hasattr(instance, field)}
        
        response = super().update(request, *args, **kwargs)
        
        # Log changes if update was successful
        if response.status_code == 200:
            supervisor_group = SupervisorOfStudentGroup.objects.filter(
                evaluation3_committee_member=instance
            ).first()
            
            new_data = {field: getattr(instance, field) for field in request.data.keys() if hasattr(instance, field)}
            AuditService.log_evaluation_changes(
                request, instance, "evaluation3_committee", supervisor_group, old_data, new_data
            )
        
        return response


class Evaluation4SupervisorView(RetrieveAPIView, UpdateAPIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsStudentOrSupervisor]
    serializer_class = Evaluation4SupervisorSerializer
    queryset = Evaluation4Supervisor.objects.all()

    def update(self, request, *args, **kwargs):
        # Only supervisors can update
        if request.user.user_type != 'supervisor':
            return Response(
                {"message": "You are not authorized to update this document"},
                status=status.HTTP_403_FORBIDDEN,
            )
        
        # Get old values for audit logging
        instance = self.get_object()
        old_data = {field: getattr(instance, field) for field in request.data.keys() if hasattr(instance, field)}
        
        response = super().update(request, *args, **kwargs)
        
        # Log changes if update was successful
        if response.status_code == 200:
            supervisor_group = SupervisorOfStudentGroup.objects.filter(
                evaluation4_supervisor=instance
            ).first()
            
            new_data = {field: getattr(instance, field) for field in request.data.keys() if hasattr(instance, field)}
            AuditService.log_evaluation_changes(
                request, instance, "evaluation4_supervisor", supervisor_group, old_data, new_data
            )
        
        return response


class Evaluation4CommitteeMemberView(RetrieveAPIView, UpdateAPIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsStudentOrSupervisorOrCommitteeMember]
    serializer_class = Evaluation4CommitteeMemberSerializer
    queryset = Evaluation4CommitteeMember.objects.all()

    def update(self, request, *args, **kwargs):
        # Only committee members can update
        if request.user.user_type != 'committee_member':
            return Response(
                {"message": "You are not authorized to update this document"},
                status=status.HTTP_403_FORBIDDEN,
            )
        
        # Get old values for audit logging
        instance = self.get_object()
        old_data = {field: getattr(instance, field) for field in request.data.keys() if hasattr(instance, field)}
        
        response = super().update(request, *args, **kwargs)
        
        # Log changes if update was successful
        if response.status_code == 200:
            supervisor_group = SupervisorOfStudentGroup.objects.filter(
                evaluation4_committee_member=instance
            ).first()
            
            new_data = {field: getattr(instance, field) for field in request.data.keys() if hasattr(instance, field)}
            AuditService.log_evaluation_changes(
                request, instance, "evaluation4_committee", supervisor_group, old_data, new_data
            )
        
        return response


class PanelAPIView(RetrieveAPIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsStudentOrSupervisorOrCommitteeMember]
    serializer_class = PanelSerializer
    queryset = CommitteeMemberPanel.objects.all()


class CommitteeMemberPanelDetailAPIView(RetrieveAPIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsCommitteeMember]
    serializer_class = CommitteeMemberProfileSerializer
    queryset = CommitteeMember.objects.all()


class CommitteeMemberGroupsAPIView(ListAPIView):
    """
    Get all groups assigned to the committee member's panel for evaluation.
    Returns groups where the project is assigned to the same panel as the committee member.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsCommitteeMember]
    serializer_class = SupervisorOfStudentGroupSerializer

    def get_queryset(self):
        user = self.request.user
        try:
            committee_member = CommitteeMember.objects.get(user=user)
            panel = committee_member.panel
            # Get all accepted supervisor-student groups where project is in this panel
            return SupervisorOfStudentGroup.objects.filter(
                project__panel=panel,
                status='accepted'
            ).select_related(
                'group', 'supervisor', 'project',
                'group__student_1', 'group__student_2',
                'group__student_1__user', 'group__student_2__user'
            ).order_by('-created_at')
        except CommitteeMember.DoesNotExist:
            return SupervisorOfStudentGroup.objects.none()


class ProjectDetailAPiView(RetrieveAPIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsStudentOrSupervisorOrCommitteeMember]
    serializer_class = ProjectSerializer
    queryset = Project.objects.all()


class SupervisorStudentDetailAPIView(RetrieveAPIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsStudentOrSupervisor]
    serializer_class = SupervisorOfStudentGroupSerializer
    queryset = SupervisorOfStudentGroup.objects.all()


class CommitteeMemberTemplatesAPIView(CreateAPIView, ListAPIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsStudentOrSupervisorOrCommitteeMember]
    serializer_class = CommitteeMemberTemplatesSerializer
    queryset = CommitteeMemberTemplates.objects.all()

    def get_queryset(self):
        queryset = (
            super()
            .get_queryset()
            .filter(template_type=self.kwargs.get("template_type"))
        )
        semester = self.request.GET.get("semester")
        if semester:
            return queryset.filter(semester=semester)
        return queryset

    def create(self, request, *args, **kwargs):
        # Only committee members can create templates
        if request.user.user_type != 'committee_member':
            return Response(
                {"message": "Only committee members can upload templates."},
                status=status.HTTP_403_FORBIDDEN,
            )
        
        template_type = self.kwargs.get("template_type")
        if template_type not in [
            "scope_document_template",
            "srs_template",
            "sdd_template",
            "final_report_template",
        ]:
            return Response(
                {"message": "Invalid template type"}, status=status.HTTP_400_BAD_REQUEST
            )
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        committee_member = CommitteeMember.objects.get(user=self.request.user)
        serializer.save(uploaded_by=committee_member, template_type=template_type)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class DocumentRequirementListCreateAPIView(ListCreateAPIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsStudentOrSupervisorOrCommitteeMember]
    serializer_class = DocumentRequirementSerializer
    queryset = DocumentRequirement.objects.all()
    pagination_class = BasePagination

    def get_queryset(self):
        qs = DocumentRequirement.objects.all().order_by("deadline", "document_type")
        if getattr(self.request.user, "user_type", None) == "student":
            try:
                s = Student.objects.get(user=self.request.user)
                sem = getattr(s, "semester", None)
                if sem:
                    return qs.filter(Q(semester__isnull=True) | Q(semester=sem))
                return qs.filter(semester__isnull=True)
            except Student.DoesNotExist:
                return qs.filter(semester__isnull=True)
        sem = self.request.GET.get("semester")
        if sem:
            return qs.filter(Q(semester__isnull=True) | Q(semester=sem))
        return qs

    def create(self, request, *args, **kwargs):
        if request.user.user_type != "committee_member":
            return Response(
                {"message": "Only committee members can create document requirements."},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            cm = CommitteeMember.objects.get(user=request.user)
        except CommitteeMember.DoesNotExist:
            return Response(
                {"message": "Committee member profile not found."},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            serializer = self.get_serializer(data=request.data)
            if not serializer.is_valid():
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            instance = serializer.save(created_by=cm)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except ValidationError:
            raise
        except OperationalError as e:
            import logging
            logging.getLogger(__name__).exception("DocumentRequirement create failed (database)")
            err = str(e) if str(e) else "Database error"
            hint = " Run: python manage.py migrate app" if "no such table" in err.lower() else ""
            return Response(
                {"message": "Failed to create document requirement.", "detail": err + hint},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            import logging
            logging.getLogger(__name__).exception("DocumentRequirement create failed")
            err = str(e) if str(e) else "Create failed"
            return Response(
                {"message": "Failed to create document requirement.", "detail": err},
                status=status.HTTP_400_BAD_REQUEST,
            )


class AdminUserManagementAPIView(APIView):
    """
    Admin user management: list users, update status/role.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def get(self, request):
        query = request.GET.get("q", "").strip()
        role = request.GET.get("role", "").strip()
        is_active = request.GET.get("is_active", "").strip()

        users = CustomUser.objects.all().order_by("-id")
        if query:
            users = users.filter(Q(username__icontains=query) | Q(email__icontains=query))
        if role:
            users = users.filter(user_type=role)
        if is_active:
            users = users.filter(is_active=(is_active.lower() == "true"))

        user_list = []
        for u in users[:100]:
            user_list.append({
                "id": u.id,
                "username": u.username,
                "email": u.email,
                "user_type": u.user_type,
                "is_active": u.is_active,
                "is_staff": u.is_staff,
                "last_login": u.last_login,
            })
        return Response({"users": user_list, "total": users.count()}, status=status.HTTP_200_OK)

    def patch(self, request, pk):
        target_user = get_object_or_404(CustomUser, pk=pk)
        if "is_active" in request.data:
            target_user.is_active = bool(request.data["is_active"])
        if "user_type" in request.data and request.data["user_type"] in ["student", "supervisor", "committee_member", "external_examiner", "admin"]:
            target_user.user_type = request.data["user_type"]
        target_user.save()
        return Response({
            "message": "User updated successfully.",
            "user": {
                "id": target_user.id,
                "username": target_user.username,
                "user_type": target_user.user_type,
                "is_active": target_user.is_active,
            }
        }, status=status.HTTP_200_OK)


class AdminSecurityCenterAPIView(APIView):
    """
    Security Center Dashboard metrics for Administrators.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def get(self, request):
        total_users = CustomUser.objects.count()
        active_users = CustomUser.objects.filter(is_active=True).count()
        deactivated_users = total_users - active_users
        recent_audit_logs = AuditLog.objects.all().order_by("-created_at")[:15]
        
        audit_data = []
        for log in recent_audit_logs:
            audit_data.append({
                "id": log.id,
                "action": log.get_action_type_display(),
                "actor": log.user.username if log.user else "System",
                "created_at": log.created_at,
                "details": log.description,
            })

        security_metrics = {
            "total_users": total_users,
            "active_users": active_users,
            "deactivated_users": deactivated_users,
            "security_headers": {
                "httponly_cookies": True,
                "content_security_policy": True,
                "hsts_production": True,
                "cors_credentials": True,
                "magic_bytes_file_inspection": True,
                "websocket_one_time_tickets": True,
            },
            "recent_audit_events": audit_data,
        }
        return Response(security_metrics, status=status.HTTP_200_OK)


class DocumentRequirementDetailAPIView(RetrieveUpdateDestroyAPIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsStudentOrSupervisorOrCommitteeMember]
    serializer_class = DocumentRequirementSerializer
    queryset = DocumentRequirement.objects.all()

    def update(self, request, *args, **kwargs):
        if request.user.user_type != "committee_member":
            return Response(
                {"message": "Only committee members can update document requirements."},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            return super().update(request, *args, **kwargs)
        except ValidationError:
            raise
        except Exception as e:
            import logging
            logging.getLogger(__name__).exception("DocumentRequirement update failed")
            err = str(e) if str(e) else "Update failed"
            return Response(
                {"message": "Failed to update document requirement.", "detail": err},
                status=status.HTTP_400_BAD_REQUEST,
            )

    def destroy(self, request, *args, **kwargs):
        if request.user.user_type != "committee_member":
            return Response(
                {"message": "Only committee members can delete document requirements."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().destroy(request, *args, **kwargs)


class ChatRoomAPIView(CreateAPIView, ListAPIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsStudentOrSupervisor, IsGroupMemberForChat]
    serializer_class = ChatRoomSerializer
    queryset = ChatRoom.objects.all()
    pagination_class = ChatPagination

    def get_queryset(self):
        group_id = self.request.GET.get("group")
        last_id = self.request.GET.get("last_id")
        queryset = super().get_queryset().order_by("-created_at")  # Newest first for pagination
        if group_id:
            queryset = queryset.filter(group_id=group_id)
        if last_id:
            queryset = queryset.filter(id__gt=last_id)
        return queryset

    def post(self, request, *args, **kwargs):
        serializer = ChatRoomSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=HTTP_400_BAD_REQUEST)

        sent_by = None
        student = None
        supervisor = None

        try:
            group = SupervisorOfStudentGroup.objects.get(
                id=serializer.validated_data["group"].id
            )
        except SupervisorOfStudentGroup.DoesNotExist:
            return Response(
                {"message": "Group not found"}, status=status.HTTP_404_NOT_FOUND
            )

        try:
            student = Student.objects.get(user=request.user)
            sent_by = "student"
        except Student.DoesNotExist:
            pass

        try:
            supervisor = Supervisor.objects.get(user=request.user)
            sent_by = "supervisor"
        except Supervisor.DoesNotExist:
            pass

        if not student and not supervisor:
            return Response(
                {"message": "You are not part of this group."},
                status=status.HTTP_403_FORBIDDEN,
            )

        message = ChatRoom.objects.create(
            group=group,
            student=student,
            supervisor=supervisor,
            message=serializer.validated_data["message"],
            sent_by=sent_by,
        )
        NotificationService.notify_new_chat_message(
            request.user, group, serializer.validated_data["message"]
        )

        return Response(
            ChatRoomSerializer(message).data, status=status.HTTP_201_CREATED
        )


class ExportReportAPIView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsSupervisor]

    def get(self, request, *args, **kwargs):
        supervisor = Supervisor.objects.get(user=request.user)

        supervisor_groups = supervisor.group_request.filter(status="accepted")

        workbook = Workbook()
        sheet = workbook.active
        sheet.title = "Project Reports"

        # UTC Official Header
        sheet.append(["BỘ GIÁO DỤC VÀ ĐÀO TẠO - TRƯỜNG ĐẠI HỌC GIAO THÔNG VẬN TẢI (UTC)"])
        sheet.append(["BÁO CÁO TỔNG HỢP TIẾN ĐỘ ĐỒ ÁN TỐT NGHIỆP"])
        sheet.append([])

        # Header row
        headers = [
            "Group ID",
            "Student 1 Name",
            "Student 1 Email",
            "Student 1 Reg. No",
            "Student 2 Name",
            "Student 2 Email",
            "Student 2 Reg. No",
            "Project Title",
            "Scope Doc",
            "SRS Doc",
            "SDD Doc",
            "Final Report",
            "Presentation",
            "Status",
        ]
        sheet.append(headers)

        for group in supervisor_groups:
            documents = group.documents.filter(status="accepted")
            row = [
                group.id,
                group.group.student_1.user.username,
                group.group.student_1.user.email,
                group.group.student_1.registration_no,
                group.group.student_2.user.username,
                group.group.student_2.user.email,
                group.group.student_2.registration_no,
                group.project.project_name if group.project else "N/A",
                ",".join(
                    documents.filter(document_type="scope_document").values_list(
                        "uploaded_file", flat=True
                    )
                ),
                ",".join(
                    documents.filter(document_type="srs_document").values_list(
                        "uploaded_file", flat=True
                    )
                ),
                ",".join(
                    documents.filter(document_type="sdd_document").values_list(
                        "uploaded_file", flat=True
                    )
                ),
                ",".join(
                    documents.filter(document_type="final_report_document").values_list(
                        "uploaded_file", flat=True
                    )
                ),
                ",".join(
                    documents.filter(document_type="presentation_document").values_list(
                        "uploaded_file", flat=True
                    )
                ),
                group.status,
            ]
            sheet.append(row)

        # Create HTTP response with Excel file
        response = HttpResponse(
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        response["Content-Disposition"] = 'attachment; filename="project_reports.xlsx"'
        workbook.save(response)
        return response


class ProjectDeleteAPIView(DestroyAPIView):
    """Delete a project. Only the owner (creator) can delete their project."""

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsProjectOwner]
    queryset = Project.objects.all()

    def destroy(self, request, *args, **kwargs):
        project = self.get_object()

        # Check if user is the owner
        if project.user != request.user:
            return Response(
                {"message": "You do not have permission to delete this project."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Check if project is assigned to a panel (may have evaluations)
        if project.panel is not None:
            return Response(
                {"message": "Cannot delete project that is assigned to a panel."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        project.delete()
        return Response(
            {"message": "Project deleted successfully."},
            status=status.HTTP_204_NO_CONTENT,
        )


class DocumentDeleteAPIView(DestroyAPIView):
    """Delete a document. Only the uploader can delete their document."""

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsStudent, IsDocumentOwner]
    queryset = Document.objects.all()

    def destroy(self, request, *args, **kwargs):
        document_type = self.kwargs.get("document_type")

        # Validate document type
        valid_types = [
            "scope_document",
            "srs_document",
            "sdd_document",
            "final_report_document",
            "presentation_document",
        ]
        if document_type not in valid_types:
            return Response(
                {"message": "Invalid document type."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            document = self.get_object()
        except Document.DoesNotExist:
            return Response(
                {"message": "Document not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Verify document type matches
        if document.document_type != document_type:
            return Response(
                {"message": "Document type mismatch."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Check if user is the uploader
        try:
            student = Student.objects.get(user=request.user)
            if document.uploaded_by != student:
                return Response(
                    {"message": "You do not have permission to delete this document."},
                    status=status.HTTP_403_FORBIDDEN,
                )
        except Student.DoesNotExist:
            return Response(
                {"message": "Only the student who uploaded the document can delete it."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Check if document has been accepted (prevent deletion of accepted documents)
        if document.status == "accepted":
            return Response(
                {"message": "Cannot delete a document that has been accepted."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Cannot delete once submitted to committee
        if document.submitted_to_committee:
            return Response(
                {"message": "Cannot delete a document that has been submitted to committee."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Delete the file from storage
        if document.uploaded_file:
            document.uploaded_file.delete(save=False)

        document.delete()
        return Response(
            {"message": "Document deleted successfully."},
            status=status.HTTP_204_NO_CONTENT,
        )


class DocumentSubmitToCommitteeAPIView(APIView):
    """
    Student submits an accepted document to committee (before deadline).
    Only one document per (group, document_type) can be submitted; this marks that version as the final one for committee.
    Committee sees only documents with submitted_to_committee=True.
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsStudent]

    def post(self, request, document_type, pk):
        valid_types = [
            "scope_document",
            "srs_document",
            "sdd_document",
            "final_report_document",
            "presentation_document",
        ]
        if document_type not in valid_types:
            return Response(
                {"message": "Invalid document type."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            student = Student.objects.get(user=request.user)
        except Student.DoesNotExist:
            return Response(
                {"message": "Only students can submit documents to committee."},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            group = SupervisorOfStudentGroup.objects.get(
                Q(group__student_1=student) | Q(group__student_2=student),
                status="accepted",
            )
        except SupervisorOfStudentGroup.DoesNotExist:
            return Response(
                {"message": "You are not in an accepted group."},
                status=status.HTTP_404_NOT_FOUND,
            )
        try:
            document = Document.objects.get(
                pk=pk, group=group, document_type=document_type
            )
        except Document.DoesNotExist:
            return Response(
                {"message": "Document not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        if document.status != "accepted":
            return Response(
                {
                    "message": "Only documents accepted by your supervisor can be submitted to committee."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        # Deadline: must submit before committee requirement deadline
        requirements = DocumentRequirement.objects.filter(
            document_type=document_type
        ).filter(Q(semester__isnull=True) | Q(semester=student.semester))
        latest_deadline = requirements.aggregate(Max("deadline"))["deadline__max"]
        if latest_deadline is not None and timezone.now() > latest_deadline:
            return Response(
                {"message": "Submission deadline has passed for this document type."},
                status=status.HTTP_403_FORBIDDEN,
            )
        # Unset any other document of same (group, document_type) as submitted
        Document.objects.filter(
            group=group, document_type=document_type
        ).exclude(pk=document.pk).update(
            submitted_to_committee=False, submitted_to_committee_at=None
        )
        document.submitted_to_committee = True
        document.submitted_to_committee_at = timezone.now()
        document.save(update_fields=["submitted_to_committee", "submitted_to_committee_at"])
        serializer = DocumentSerializer(document)
        return Response(serializer.data, status=status.HTTP_200_OK)


class ChatMessageDeleteAPIView(DestroyAPIView):
    """Delete a chat message. Only the sender can delete their message."""

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsStudentOrSupervisor, IsChatMessageOwner]
    queryset = ChatRoom.objects.all()

    def destroy(self, request, *args, **kwargs):
        try:
            message = self.get_object()
        except ChatRoom.DoesNotExist:
            return Response(
                {"message": "Message not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Check if user is the sender
        is_owner = False

        try:
            student = Student.objects.get(user=request.user)
            if message.student == student and message.sent_by == "student":
                is_owner = True
        except Student.DoesNotExist:
            pass

        try:
            supervisor = Supervisor.objects.get(user=request.user)
            if message.supervisor == supervisor and message.sent_by == "supervisor":
                is_owner = True
        except Supervisor.DoesNotExist:
            pass

        if not is_owner:
            return Response(
                {"message": "You do not have permission to delete this message."},
                status=status.HTTP_403_FORBIDDEN,
            )

        message.delete()
        return Response(
            {"message": "Message deleted successfully."},
            status=status.HTTP_204_NO_CONTENT,
        )


class SupervisorDocumentsAPIView(ListAPIView):
    """API endpoint for supervisors to view all documents from their assigned groups."""
    permission_classes = [IsAuthenticated, IsSupervisor]
    authentication_classes = [JWTAuthentication]
    serializer_class = SupervisorDocumentSerializer
    pagination_class = BasePagination

    def get_queryset(self):
        try:
            supervisor = Supervisor.objects.get(user=self.request.user)
        except Supervisor.DoesNotExist:
            return Document.objects.none()

        # Get all groups where this supervisor is assigned and accepted
        supervisor_groups = SupervisorOfStudentGroup.objects.filter(
            supervisor=supervisor,
            status="accepted"
        ).values_list("id", flat=True)

        # Get query parameters for filtering
        document_type = self.request.GET.get("document_type")
        status_filter = self.request.GET.get("status")
        group_id = self.request.GET.get("group")

        # Build queryset
        queryset = Document.objects.filter(group__in=supervisor_groups).order_by("-uploaded_at")

        if document_type:
            queryset = queryset.filter(document_type=document_type)

        if status_filter:
            queryset = queryset.filter(status=status_filter)

        if group_id:
            queryset = queryset.filter(group=group_id)

        return queryset

    def list(self, request, *args, **kwargs):
        # Permission class IsSupervisor already validates this
        return super().list(request, *args, **kwargs)


# ==================== Notification Views ====================


class NotificationListAPIView(ListAPIView):
    """List all notifications for the current user."""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = NotificationSerializer
    pagination_class = BasePagination

    def get_queryset(self):
        queryset = Notification.objects.filter(user=self.request.user)
        
        # Filter by read status
        is_read = self.request.GET.get("is_read")
        if is_read is not None:
            if is_read.lower() == "true":
                queryset = queryset.filter(is_read=True)
            elif is_read.lower() == "false":
                queryset = queryset.filter(is_read=False)
        
        # Filter by notification type
        notification_type = self.request.GET.get("type")
        if notification_type:
            queryset = queryset.filter(notification_type=notification_type)
        
        return queryset.order_by("-created_at")


class NotificationUnreadCountAPIView(APIView):
    """Get the count of unread notifications for the current user."""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        unread_count = Notification.objects.filter(
            user=request.user,
            is_read=False
        ).count()
        
        return Response({"unread_count": unread_count})


class NotificationMarkReadAPIView(APIView):
    """Mark notifications as read."""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = NotificationMarkReadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        notification_ids = serializer.validated_data.get("notification_ids", [])
        
        queryset = Notification.objects.filter(user=request.user, is_read=False)
        
        if notification_ids:
            queryset = queryset.filter(id__in=notification_ids)
        
        updated_count = queryset.update(is_read=True)
        
        return Response({
            "message": f"{updated_count} notification(s) marked as read.",
            "updated_count": updated_count
        })


class NotificationDetailAPIView(RetrieveAPIView, DestroyAPIView):
    """Get or delete a specific notification."""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = NotificationSerializer

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        # Mark as read when viewed
        instance.mark_as_read()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    def delete(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.delete()
        return Response(
            {"message": "Notification deleted."},
            status=status.HTTP_204_NO_CONTENT
        )


class NotificationDeleteAllAPIView(APIView):
    """Delete all notifications for the current user."""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def delete(self, request):
        deleted_count, _ = Notification.objects.filter(user=request.user).delete()
        return Response({
            "message": f"{deleted_count} notification(s) deleted.",
            "deleted_count": deleted_count
        })


class NotificationPreferenceAPIView(APIView):
    """Get or update notification preferences."""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        preferences, created = NotificationPreference.objects.get_or_create(
            user=request.user
        )
        serializer = NotificationPreferenceSerializer(preferences)
        return Response(serializer.data)

    def put(self, request):
        preferences, created = NotificationPreference.objects.get_or_create(
            user=request.user
        )
        serializer = NotificationPreferenceSerializer(
            preferences,
            data=request.data,
            partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def patch(self, request):
        return self.put(request)


# ==================== Analytics Views ====================


class SupervisorAnalyticsAPIView(APIView):
    """Get analytics data for supervisors."""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsSupervisor]

    def get(self, request):
        try:
            supervisor = Supervisor.objects.get(user=request.user)
        except Supervisor.DoesNotExist:
            return Response(
                {"error": "Supervisor profile not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        # Get all supervisor-student groups for this supervisor
        supervisor_groups = SupervisorOfStudentGroup.objects.filter(supervisor=supervisor)
        
        # Count groups by status
        total_groups = supervisor_groups.count()
        pending_groups = supervisor_groups.filter(status="pending").count()
        accepted_groups = supervisor_groups.filter(status="accepted").count()
        rejected_groups = supervisor_groups.filter(status="rejected").count()

        # Get accepted groups for evaluation analysis
        accepted_group_objs = supervisor_groups.filter(status="accepted")
        
        # Evaluation progress calculation
        evaluation_stats = {
            "scope_document": {"completed": 0, "pending": 0},
            "srs_supervisor": {"completed": 0, "pending": 0},
            "sdd_supervisor": {"completed": 0, "pending": 0},
            "evaluation3_supervisor": {"completed": 0, "pending": 0},
            "evaluation4_supervisor": {"completed": 0, "pending": 0},
        }
        
        total_marks = {
            "srs_supervisor": [],
            "sdd_supervisor": [],
            "evaluation3_supervisor": [],
            "evaluation4_supervisor": [],
        }
        
        for group in accepted_group_objs:
            # Scope Document - check if any field is not "pending"
            if group.Scope_document_evaluation_form:
                form = group.Scope_document_evaluation_form
                if form.evaluation_status is not None:
                    evaluation_stats["scope_document"]["completed"] += 1
                else:
                    evaluation_stats["scope_document"]["pending"] += 1
            else:
                evaluation_stats["scope_document"]["pending"] += 1
            
            # SRS Evaluation (Supervisor)
            if group.srs_evaluation_supervisor:
                form = group.srs_evaluation_supervisor
                # Check if any field is evaluated (not all pending)
                fields = [form.regularity, form.srs_are_frs_mapped_to_the_problem,
                         form.srs_are_nfr_mapped_to_the_problem, form.is_srs_storyboarding,
                         form.according_to_requirement, form.is_srs_template_followed,
                         form.is_write_up_correct, form.student_participation]
                if any(f != "pending" for f in fields):
                    evaluation_stats["srs_supervisor"]["completed"] += 1
                    total_marks["srs_supervisor"].append(form.total_marks)
                else:
                    evaluation_stats["srs_supervisor"]["pending"] += 1
            else:
                evaluation_stats["srs_supervisor"]["pending"] += 1
            
            # SDD Evaluation (Supervisor)
            if group.sdd_evaluation_supervisor:
                form = group.sdd_evaluation_supervisor
                fields = [form.data_representation_diagram, form.process_flow,
                         form.design_models, form.algorithms_defined,
                         form.module_completion_status, form.is_sdd_template_followed,
                         form.is_technical_writeup_correct, form.regularity,
                         form.seminar_participation]
                if any(f != "pending" for f in fields):
                    evaluation_stats["sdd_supervisor"]["completed"] += 1
                    total_marks["sdd_supervisor"].append(form.total_marks)
                else:
                    evaluation_stats["sdd_supervisor"]["pending"] += 1
            else:
                evaluation_stats["sdd_supervisor"]["pending"] += 1
            
            # Evaluation 3 (Supervisor)
            if group.evaluation3_supervisor:
                form = group.evaluation3_supervisor
                fields = [form.module_completion, form.software_testing,
                         form.regularity, form.is_template_followed,
                         form.project_domain_knowledge, form.is_writeup_correct]
                if any(f != "pending" for f in fields):
                    evaluation_stats["evaluation3_supervisor"]["completed"] += 1
                    total_marks["evaluation3_supervisor"].append(form.total_marks)
                else:
                    evaluation_stats["evaluation3_supervisor"]["pending"] += 1
            else:
                evaluation_stats["evaluation3_supervisor"]["pending"] += 1
            
            # Evaluation 4 (Supervisor)
            if group.evaluation4_supervisor:
                form = group.evaluation4_supervisor
                fields = [form.module_completion, form.student_participation_seminar,
                         form.is_template_followed, form.is_writeup_correct]
                if any(f != "pending" for f in fields):
                    evaluation_stats["evaluation4_supervisor"]["completed"] += 1
                    total_marks["evaluation4_supervisor"].append(form.total_marks)
                else:
                    evaluation_stats["evaluation4_supervisor"]["pending"] += 1
            else:
                evaluation_stats["evaluation4_supervisor"]["pending"] += 1

        # Calculate average marks
        average_marks = {}
        for eval_type, marks_list in total_marks.items():
            if marks_list:
                average_marks[eval_type] = round(sum(marks_list) / len(marks_list), 2)
            else:
                average_marks[eval_type] = 0

        # Document statistics
        total_documents = Document.objects.filter(
            group__in=accepted_group_objs
        ).count()
        pending_documents = Document.objects.filter(
            group__in=accepted_group_objs,
            status="pending"
        ).count()
        approved_documents = Document.objects.filter(
            group__in=accepted_group_objs,
            status="accepted"
        ).count()

        # Recent activity - last 5 documents
        recent_documents = Document.objects.filter(
            group__in=accepted_group_objs
        ).order_by("-uploaded_at")[:5].values(
            "id", "title", "document_type", "status", "uploaded_at"
        )

        return Response({
            "groups": {
                "total": total_groups,
                "pending": pending_groups,
                "accepted": accepted_groups,
                "rejected": rejected_groups,
            },
            "evaluations": evaluation_stats,
            "average_marks": average_marks,
            "documents": {
                "total": total_documents,
                "pending": pending_documents,
                "approved": approved_documents,
            },
            "recent_documents": list(recent_documents),
        })


class CommitteeMemberAnalyticsAPIView(APIView):
    """Get analytics data for committee members."""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsCommitteeMember]

    def get(self, request):
        try:
            committee_member = CommitteeMember.objects.get(user=request.user)
        except CommitteeMember.DoesNotExist:
            return Response(
                {"error": "Committee member profile not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        panel = committee_member.panel
        
        # Get all projects in this panel
        panel_projects = Project.objects.filter(panel=panel)
        
        # Get all groups with these projects (accepted status)
        panel_groups = SupervisorOfStudentGroup.objects.filter(
            project__in=panel_projects,
            status="accepted"
        )
        
        total_groups = panel_groups.count()
        
        # Evaluation progress calculation
        evaluation_stats = {
            "srs_committee": {"completed": 0, "pending": 0},
            "sdd_committee": {"completed": 0, "pending": 0},
            "evaluation3_committee": {"completed": 0, "pending": 0},
            "evaluation4_committee": {"completed": 0, "pending": 0},
        }
        
        total_marks = {
            "srs_committee": [],
            "sdd_committee": [],
            "evaluation3_committee": [],
            "evaluation4_committee": [],
        }
        
        for group in panel_groups:
            # SRS Evaluation (Committee Member)
            if group.srs_evaluation_committee_member:
                form = group.srs_evaluation_committee_member
                fields = [form.analysis_of_existing_systems, form.problem_defined,
                         form.proposed_solution, form.tools_technologies,
                         form.frs_mapped, form.nfrs_mapped, form.requirements_analysis,
                         form.mocks_defined, form.srs_template_followed,
                         form.technical_writeup_correct, form.domain_knowledge,
                         form.qa_ability, form.presentation_attire]
                if any(f != "pending" for f in fields):
                    evaluation_stats["srs_committee"]["completed"] += 1
                    total_marks["srs_committee"].append(form.total_marks)
                else:
                    evaluation_stats["srs_committee"]["pending"] += 1
            else:
                evaluation_stats["srs_committee"]["pending"] += 1
            
            # SDD Evaluation (Committee Member)
            if group.sdd_evaluation_committee_member:
                form = group.sdd_evaluation_committee_member
                fields = [form.data_representation_diagram, form.process_flow,
                         form.sdd_design_models, form.algorithm_defined,
                         form.modules_completion_status, form.sdd_template_followed,
                         form.technical_writeup_correct, form.project_domain_knowledge,
                         form.qa_ability, form.proper_attire]
                if any(f != "pending" for f in fields):
                    evaluation_stats["sdd_committee"]["completed"] += 1
                    total_marks["sdd_committee"].append(form.total_marks)
                else:
                    evaluation_stats["sdd_committee"]["pending"] += 1
            else:
                evaluation_stats["sdd_committee"]["pending"] += 1
            
            # Evaluation 3 (Committee Member)
            if group.evaluation3_committee_member:
                form = group.evaluation3_committee_member
                fields = [form.module_completion, form.software_testing,
                         form.qa_ability, form.proper_attire,
                         form.is_template_followed, form.is_writeup_correct]
                if any(f != "pending" for f in fields):
                    evaluation_stats["evaluation3_committee"]["completed"] += 1
                    total_marks["evaluation3_committee"].append(form.total_marks)
                else:
                    evaluation_stats["evaluation3_committee"]["pending"] += 1
            else:
                evaluation_stats["evaluation3_committee"]["pending"] += 1
            
            # Evaluation 4 (Committee Member)
            if group.evaluation4_committee_member:
                form = group.evaluation4_committee_member
                fields = [form.module_completion, form.software_testing,
                         form.qa_ability, form.proper_attire,
                         form.is_template_followed, form.is_writeup_correct]
                if any(f != "pending" for f in fields):
                    evaluation_stats["evaluation4_committee"]["completed"] += 1
                    total_marks["evaluation4_committee"].append(form.total_marks)
                else:
                    evaluation_stats["evaluation4_committee"]["pending"] += 1
            else:
                evaluation_stats["evaluation4_committee"]["pending"] += 1

        # Calculate average marks
        average_marks = {}
        for eval_type, marks_list in total_marks.items():
            if marks_list:
                average_marks[eval_type] = round(sum(marks_list) / len(marks_list), 2)
            else:
                average_marks[eval_type] = 0

        # Calculate overall completion percentage
        total_evaluations = sum(
            stat["completed"] + stat["pending"] 
            for stat in evaluation_stats.values()
        )
        completed_evaluations = sum(
            stat["completed"] for stat in evaluation_stats.values()
        )
        completion_percentage = (
            round((completed_evaluations / total_evaluations) * 100, 1)
            if total_evaluations > 0 else 0
        )

        # Panel workload - count members and groups per member
        panel_members = CommitteeMember.objects.filter(panel=panel).count()
        groups_per_member = round(total_groups / panel_members, 1) if panel_members > 0 else 0

        # Get panel member list with basic info
        panel_member_list = CommitteeMember.objects.filter(panel=panel).values(
            "id", "user__username", "committee_id"
        )

        return Response({
            "panel": {
                "id": panel.id,
                "name": panel.name,
                "total_members": panel_members,
                "members": list(panel_member_list),
            },
            "groups": {
                "total": total_groups,
                "groups_per_member": groups_per_member,
            },
            "evaluations": evaluation_stats,
            "average_marks": average_marks,
            "completion": {
                "total_evaluations": total_evaluations,
                "completed_evaluations": completed_evaluations,
                "percentage": completion_percentage,
            },
        })


# ==================== Audit Log Views ====================


class AuditLogListAPIView(ListAPIView):
    """List audit logs. Supervisors see logs for their groups, committee members see logs for their panel."""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsStudentOrSupervisorOrCommitteeMember]
    serializer_class = AuditLogSerializer
    pagination_class = BasePagination

    def get_queryset(self):
        user = self.request.user
        queryset = AuditLog.objects.all()

        # Filter based on user type
        if user.user_type == 'supervisor':
            try:
                supervisor = Supervisor.objects.get(user=user)
                # Get groups supervised by this supervisor
                supervisor_groups = SupervisorOfStudentGroup.objects.filter(
                    supervisor=supervisor
                ).values_list('id', flat=True)
                queryset = queryset.filter(supervisor_group__in=supervisor_groups)
            except Supervisor.DoesNotExist:
                return AuditLog.objects.none()
        
        elif user.user_type == 'committee_member':
            try:
                committee_member = CommitteeMember.objects.get(user=user)
                panel = committee_member.panel
                # Get all projects in this panel
                panel_projects = Project.objects.filter(panel=panel)
                # Get groups with these projects
                panel_groups = SupervisorOfStudentGroup.objects.filter(
                    project__in=panel_projects
                ).values_list('id', flat=True)
                queryset = queryset.filter(supervisor_group__in=panel_groups)
            except CommitteeMember.DoesNotExist:
                return AuditLog.objects.none()
        
        else:
            # Students can only see logs for their own group
            try:
                student = Student.objects.get(user=user)
                # Find groups where student is a member
                groups = Group.objects.filter(
                    Q(student_1=student) | Q(student_2=student),
                    status='accepted'
                )
                supervisor_groups = SupervisorOfStudentGroup.objects.filter(
                    group__in=groups
                ).values_list('id', flat=True)
                queryset = queryset.filter(supervisor_group__in=supervisor_groups)
            except Student.DoesNotExist:
                return AuditLog.objects.none()

        # Apply filters from query params
        evaluation_type = self.request.GET.get('evaluation_type')
        if evaluation_type:
            queryset = queryset.filter(evaluation_type=evaluation_type)

        action_type = self.request.GET.get('action_type')
        if action_type:
            queryset = queryset.filter(action_type=action_type)

        group_id = self.request.GET.get('group')
        if group_id:
            queryset = queryset.filter(supervisor_group_id=group_id)

        user_id = self.request.GET.get('user')
        if user_id:
            queryset = queryset.filter(user_id=user_id)

        # Date range filtering
        from_date = self.request.GET.get('from_date')
        if from_date:
            queryset = queryset.filter(created_at__date__gte=from_date)

        to_date = self.request.GET.get('to_date')
        if to_date:
            queryset = queryset.filter(created_at__date__lte=to_date)

        return queryset.order_by('-created_at')


class AuditLogGroupAPIView(ListAPIView):
    """List audit logs for a specific group."""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsStudentOrSupervisorOrCommitteeMember]
    serializer_class = AuditLogSerializer
    pagination_class = BasePagination

    def get_queryset(self):
        group_id = self.kwargs.get('group_id')
        return AuditLog.objects.filter(supervisor_group_id=group_id).order_by('-created_at')


class AuditLogStatsAPIView(APIView):
    """Get audit log statistics for the current user's scope."""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsStudentOrSupervisorOrCommitteeMember]

    def get(self, request):
        user = request.user
        
        # Build base queryset based on user type (same logic as list view)
        if user.user_type == 'supervisor':
            try:
                supervisor = Supervisor.objects.get(user=user)
                supervisor_groups = SupervisorOfStudentGroup.objects.filter(
                    supervisor=supervisor
                ).values_list('id', flat=True)
                queryset = AuditLog.objects.filter(supervisor_group__in=supervisor_groups)
            except Supervisor.DoesNotExist:
                queryset = AuditLog.objects.none()
        
        elif user.user_type == 'committee_member':
            try:
                committee_member = CommitteeMember.objects.get(user=user)
                panel = committee_member.panel
                panel_projects = Project.objects.filter(panel=panel)
                panel_groups = SupervisorOfStudentGroup.objects.filter(
                    project__in=panel_projects
                ).values_list('id', flat=True)
                queryset = AuditLog.objects.filter(supervisor_group__in=panel_groups)
            except CommitteeMember.DoesNotExist:
                queryset = AuditLog.objects.none()
        
        else:
            try:
                student = Student.objects.get(user=user)
                groups = Group.objects.filter(
                    Q(student_1=student) | Q(student_2=student),
                    status='accepted'
                )
                supervisor_groups = SupervisorOfStudentGroup.objects.filter(
                    group__in=groups
                ).values_list('id', flat=True)
                queryset = AuditLog.objects.filter(supervisor_group__in=supervisor_groups)
            except Student.DoesNotExist:
                queryset = AuditLog.objects.none()

        # Count by evaluation type
        evaluation_type_counts = {}
        for choice in AuditLog.EVALUATION_TYPE_CHOICES:
            evaluation_type_counts[choice[0]] = queryset.filter(evaluation_type=choice[0]).count()

        # Count by action type
        action_type_counts = {}
        for choice in AuditLog.ACTION_TYPE_CHOICES:
            action_type_counts[choice[0]] = queryset.filter(action_type=choice[0]).count()

        # Recent activity count (last 7 days)
        from django.utils import timezone
        seven_days_ago = timezone.now() - timedelta(days=7)
        recent_count = queryset.filter(created_at__gte=seven_days_ago).count()

        return Response({
            "total_logs": queryset.count(),
            "recent_logs_7_days": recent_count,
            "by_evaluation_type": evaluation_type_counts,
            "by_action_type": action_type_counts,
        })


# ==================== External Examiner Views ====================


class ExternalExaminerProfileAPIView(RetrieveAPIView, UpdateAPIView):
    """
    GET: Retrieve external examiner's own profile
    PUT/PATCH: Update own profile
    """
    permission_classes = [IsAuthenticated, IsExternalExaminer]
    authentication_classes = [JWTAuthentication]
    serializer_class = ExternalExaminerProfileSerializer
    
    def get_object(self):
        return get_object_or_404(
            ExternalExaminer,
            user=self.request.user
        )


class ExternalExaminerListAPIView(ListAPIView):
    """
    List all external examiners.
    For Committee Members to assign groups.
    """
    permission_classes = [IsAuthenticated, IsExternalExaminerOrCommittee]
    authentication_classes = [JWTAuthentication]
    serializer_class = ExternalExaminerListSerializer
    pagination_class = BasePagination
    
    def get_queryset(self):
        queryset = ExternalExaminer.objects.filter(is_active=True)
        
        # Filter by institution
        institution = self.request.GET.get('institution')
        if institution:
            queryset = queryset.filter(institution__icontains=institution)
        
        # Filter by designation
        designation = self.request.GET.get('designation')
        if designation:
            queryset = queryset.filter(designation=designation)
        
        return queryset.select_related('user')


class ExternalExaminerDashboardAPIView(APIView):
    """
    Dashboard data for external examiner.
    """
    permission_classes = [IsAuthenticated, IsExternalExaminer]
    authentication_classes = [JWTAuthentication]
    
    def get(self, request):
        try:
            external = ExternalExaminer.objects.get(user=request.user)
        except ExternalExaminer.DoesNotExist:
            return Response(
                {'message': 'External examiner profile not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Get external groups
        external_groups = external.external_groups.select_related('external_examiner__user').prefetch_related('assignments')
        
        # Statistics
        total_groups = ExternalGroupAssignment.objects.filter(
            external_group__external_examiner=external
        ).count()
        
        evaluated_count = ExternalGroupAssignment.objects.filter(
            external_group__external_examiner=external,
            status='evaluated'
        ).count()
        
        pending_count = total_groups - evaluated_count
        
        # Upcoming evaluations
        upcoming_schedules = EvaluationSchedule.objects.filter(
            external_group__external_examiner=external,
            status='scheduled',
            date__gte=timezone.now().date()
        ).order_by('date', 'start_time')[:5]
        
        # Serialize upcoming schedules manually since we don't have EvaluationScheduleSerializer yet
        upcoming_data = []
        for schedule in upcoming_schedules:
            upcoming_data.append({
                'id': schedule.id,
                'title': schedule.title,
                'date': schedule.date,
                'start_time': schedule.start_time,
                'end_time': schedule.end_time,
                'venue': schedule.venue,
                'status': schedule.status
            })
        
        return Response({
            'profile': ExternalExaminerSerializer(external).data,
            'statistics': {
                'total_groups_assigned': total_groups,
                'evaluated': evaluated_count,
                'pending': pending_count
            },
            'external_groups': ExternalGroupListSerializer(external_groups, many=True).data,
            'upcoming_schedules': upcoming_data
        })


# ==================== External Group Views ====================


class ExternalGroupListCreateAPIView(ListCreateAPIView):
    """
    GET: List all external groups
    POST: Create new external group (Committee only)
    """
    permission_classes = [IsAuthenticated, CanManageExternalGroups]
    authentication_classes = [JWTAuthentication]
    pagination_class = BasePagination
    
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return ExternalGroupCreateSerializer
        return ExternalGroupListSerializer
    
    def get_queryset(self):
        queryset = ExternalGroup.objects.select_related('external_examiner__user').prefetch_related('assignments')
        
        # External examiner sees only their groups
        if self.request.user.user_type == 'external_examiner':
            try:
                external = ExternalExaminer.objects.get(user=self.request.user)
                queryset = queryset.filter(external_examiner=external)
            except ExternalExaminer.DoesNotExist:
                return ExternalGroup.objects.none()
        
        # Filters
        semester = self.request.GET.get('semester')
        if semester:
            queryset = queryset.filter(semester=semester)
        
        status_filter = self.request.GET.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        external_id = self.request.GET.get('external_examiner')
        if external_id:
            queryset = queryset.filter(external_examiner_id=external_id)
        
        return queryset.select_related('external_examiner__user')
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class ExternalGroupDetailAPIView(RetrieveUpdateDestroyAPIView):
    """
    GET: Retrieve external group details
    PUT/PATCH: Update external group
    DELETE: Delete external group
    """
    permission_classes = [IsAuthenticated, CanManageExternalGroups]
    authentication_classes = [JWTAuthentication]
    queryset = ExternalGroup.objects.all()
    
    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return ExternalGroupCreateSerializer
        return ExternalGroupDetailSerializer
    
    def get_queryset(self):
        return ExternalGroup.objects.select_related(
            'external_examiner__user'
        ).prefetch_related(
            'assignments__supervisor_group__group__student_1__user',
            'assignments__supervisor_group__group__student_2__user',
            'assignments__supervisor_group__supervisor__user',
            'assignments__supervisor_group__project'
        )


class ExternalGroupAssignedStudentsAPIView(ListAPIView):
    """
    Get all student groups assigned to an external group.
    """
    permission_classes = [IsAuthenticated, IsExternalExaminerOrCommittee]
    authentication_classes = [JWTAuthentication]
    serializer_class = ExternalGroupAssignmentSerializer
    
    def get_queryset(self):
        external_group_id = self.kwargs.get('pk')
        return ExternalGroupAssignment.objects.filter(
            external_group_id=external_group_id
        ).select_related(
            'supervisor_group__group__student_1__user',
            'supervisor_group__group__student_2__user',
            'supervisor_group__supervisor__user',
            'supervisor_group__project'
        ).order_by('slot_number')


class AvailableGroupsForExternalAPIView(ListAPIView):
    """
    List student groups available for external assignment.
    Groups must be:
    - Have accepted supervisor
    - In 8th semester
    - Not already assigned to external
    - Completed internal evaluations (optional filter)
    """
    permission_classes = [IsAuthenticated, CanManageExternalGroups]
    authentication_classes = [JWTAuthentication]
    serializer_class = SupervisorOfStudentGroupSerializer
    pagination_class = BasePagination
    
    def get_queryset(self):
        # Get groups not yet assigned to any external
        assigned_groups = ExternalGroupAssignment.objects.values_list(
            'supervisor_group_id', flat=True
        )
        
        queryset = SupervisorOfStudentGroup.objects.filter(
            status='accepted'
        ).exclude(
            id__in=assigned_groups
        )
        
        # Filter by semester (8th semester students)
        semester_filter = self.request.GET.get('semester', 'semester_8')
        if semester_filter:
            queryset = queryset.filter(
                Q(group__student_1__semester=semester_filter) |
                Q(group__student_2__semester=semester_filter)
            )
        
        # Filter by completion status
        completed_only = self.request.GET.get('completed_internal')
        if completed_only == 'true':
            queryset = queryset.filter(is_ready_for_external=True)
        
        return queryset.select_related(
            'group__student_1__user',
            'group__student_2__user',
            'supervisor__user',
            'project'
        )


# ==================== External Group Assignment Views ====================


class ExternalGroupAssignmentCreateAPIView(CreateAPIView):
    """
    Assign a student group to an external group.
    Committee members only.
    """
    permission_classes = [IsAuthenticated, CanManageExternalGroups]
    authentication_classes = [JWTAuthentication]
    serializer_class = ExternalGroupAssignmentCreateSerializer
    
    def perform_create(self, serializer):
        assignment = serializer.save(assigned_by=self.request.user)
        
        # Update supervisor group status
        assignment.supervisor_group.external_evaluation_status = 'assigned'
        assignment.supervisor_group.save()
        
        # Create notification for students
        group = assignment.supervisor_group.group
        external_name = assignment.external_group.external_examiner.user.get_full_name()
        
        for student in [group.student_1, group.student_2]:
            if student:
                Notification.objects.create(
                    user=student.user,
                    notification_type='general',
                    title='External Examiner Assigned',
                    message=f'Your group has been assigned to {external_name} for final external evaluation.'
                )
        
        # Notify supervisor
        Notification.objects.create(
            user=assignment.supervisor_group.supervisor.user,
            notification_type='general',
            title='External Assignment',
            message=f'Your group {group.student_1} has been assigned to external examiner {external_name}.'
        )


class ExternalGroupAssignmentDeleteAPIView(DestroyAPIView):
    """
    Remove a student group from external assignment.
    Committee members only.
    """
    permission_classes = [IsAuthenticated, CanManageExternalGroups]
    authentication_classes = [JWTAuthentication]
    queryset = ExternalGroupAssignment.objects.all()
    
    def perform_destroy(self, instance):
        # Update supervisor group status
        instance.supervisor_group.external_evaluation_status = 'pending_assignment'
        instance.supervisor_group.save()
        
        # Delete any existing evaluation
        if hasattr(instance, 'evaluation'):
            instance.evaluation.delete()
        
        instance.delete()


# ==================== External Evaluation Views ====================


class ExternalEvaluationListAPIView(ListAPIView):
    """
    List evaluations for an external examiner's assigned groups.
    """
    permission_classes = [IsAuthenticated, IsExternalExaminer]
    authentication_classes = [JWTAuthentication]
    serializer_class = ExternalEvaluationSerializer
    
    def get_queryset(self):
        try:
            external = ExternalExaminer.objects.get(user=self.request.user)
        except ExternalExaminer.DoesNotExist:
            return ExternalEvaluation.objects.none()
        
        return ExternalEvaluation.objects.filter(
            assignment__external_group__external_examiner=external
        ).select_related(
            'assignment__supervisor_group__group__student_1__user',
            'assignment__supervisor_group__group__student_2__user',
            'assignment__supervisor_group__project'
        )


class ExternalEvaluationDetailAPIView(RetrieveUpdateAPIView):
    """
    GET: View evaluation details
    PUT/PATCH: Update evaluation (External Examiner only)
    """
    permission_classes = [IsAuthenticated, IsExternalExaminerOrCommittee]
    authentication_classes = [JWTAuthentication]
    
    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return ExternalEvaluationCreateSerializer
        return ExternalEvaluationSerializer
    
    def get_queryset(self):
        queryset = ExternalEvaluation.objects.all()
        
        # External examiner can only access their evaluations
        if self.request.user.user_type == 'external_examiner':
            try:
                external = ExternalExaminer.objects.get(user=self.request.user)
                queryset = queryset.filter(
                    assignment__external_group__external_examiner=external
                )
            except ExternalExaminer.DoesNotExist:
                return ExternalEvaluation.objects.none()
        
        return queryset.select_related(
            'assignment__external_group__external_examiner__user',
            'assignment__supervisor_group__group__student_1__user',
            'assignment__supervisor_group__group__student_2__user'
        )
    
    def perform_update(self, serializer):
        evaluation = serializer.save()
        
        # Update assignment status
        evaluation.assignment.status = 'evaluated'
        evaluation.assignment.save()
        
        # Update supervisor group status
        evaluation.assignment.supervisor_group.external_evaluation_status = 'evaluated'
        evaluation.assignment.supervisor_group.save()
        
        # Notify students
        group = evaluation.assignment.supervisor_group.group
        for student in [group.student_1, group.student_2]:
            if student:
                Notification.objects.create(
                    user=student.user,
                    notification_type='evaluation',
                    title='External Evaluation Completed',
                    message=f'Your external evaluation has been completed. Grade: {evaluation.grade}'
                )


class ExternalEvaluationCreateAPIView(CreateAPIView):
    """
    Create a new external evaluation for an assignment.
    External Examiner only.
    """
    permission_classes = [IsAuthenticated, IsExternalExaminer]
    authentication_classes = [JWTAuthentication]
    serializer_class = ExternalEvaluationCreateSerializer
    
    def perform_create(self, serializer):
        # Verify assignment belongs to this external examiner
        assignment = serializer.validated_data['assignment']
        try:
            external = ExternalExaminer.objects.get(user=self.request.user)
            if assignment.external_group.external_examiner != external:
                raise PermissionDenied("You can only evaluate groups assigned to you.")
        except ExternalExaminer.DoesNotExist:
            raise PermissionDenied("External examiner profile not found.")
        
        evaluation = serializer.save()
        
        # Update statuses
        assignment.status = 'evaluated'
        assignment.save()
        
        assignment.supervisor_group.external_evaluation_status = 'evaluated'
        assignment.supervisor_group.save()


class StudentExternalEvaluationAPIView(RetrieveAPIView):
    """
    Student view of their external evaluation result.
    """
    permission_classes = [IsAuthenticated, IsStudent]
    authentication_classes = [JWTAuthentication]
    serializer_class = ExternalEvaluationSerializer
    
    def get_object(self):
        try:
            student = Student.objects.get(user=self.request.user)
        except Student.DoesNotExist:
            raise NotFound("Student profile not found.")
        
        # Find student's group
        supervisor_group = SupervisorOfStudentGroup.objects.filter(
            Q(group__student_1=student) | Q(group__student_2=student),
            status='accepted'
        ).first()
        
        if not supervisor_group:
            raise NotFound("No accepted group found.")
        
        # Find external assignment
        try:
            assignment = ExternalGroupAssignment.objects.get(
                supervisor_group=supervisor_group
            )
        except ExternalGroupAssignment.DoesNotExist:
            raise NotFound("Group not assigned to external examiner yet.")
        
        # Get evaluation
        try:
            return assignment.evaluation
        except ExternalEvaluation.DoesNotExist:
            raise NotFound("External evaluation not completed yet.")


# ==================== Evaluation Schedule Views ====================


class EvaluationScheduleListCreateAPIView(ListCreateAPIView):
    """
    List and create evaluation schedules.
    """
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]
    pagination_class = BasePagination
    
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return EvaluationScheduleCreateSerializer
        return EvaluationScheduleSerializer
    
    def get_queryset(self):
        queryset = EvaluationSchedule.objects.all()
        
        # Filter by type
        eval_type = self.request.GET.get('type')
        if eval_type:
            queryset = queryset.filter(evaluation_type=eval_type)
        
        # Filter by semester
        semester = self.request.GET.get('semester')
        if semester:
            queryset = queryset.filter(semester=semester)
        
        # Filter by status
        status_filter = self.request.GET.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        # Filter upcoming only
        upcoming = self.request.GET.get('upcoming')
        if upcoming == 'true':
            queryset = queryset.filter(date__gte=timezone.now().date())
        
        # Filter by external group
        external_group = self.request.GET.get('external_group')
        if external_group:
            queryset = queryset.filter(external_group_id=external_group)
        
        # Filter by panel
        panel = self.request.GET.get('panel')
        if panel:
            queryset = queryset.filter(panel_id=panel)
        
        return queryset.select_related('external_group', 'panel').order_by('date', 'start_time')
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class EvaluationScheduleDetailAPIView(RetrieveUpdateDestroyAPIView):
    """
    Retrieve, update, or delete an evaluation schedule.
    """
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]
    queryset = EvaluationSchedule.objects.all()
    
    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return EvaluationScheduleCreateSerializer
        return EvaluationScheduleSerializer


# ==================== Admin Dashboard View ====================


from django.contrib.admin.views.decorators import staff_member_required
from django.shortcuts import render


@staff_member_required
def admin_dashboard(request):
    """Custom admin dashboard view with statistics and recent activity."""
    
    statistics = {
        'students': Student.objects.count(),
        'supervisors': Supervisor.objects.count(),
        'committee_members': CommitteeMember.objects.count(),
        'external_examiners': ExternalExaminer.objects.filter(is_active=True).count(),
        'active_groups': SupervisorOfStudentGroup.objects.filter(status='accepted').count(),
        'external_groups': ExternalGroup.objects.count(),
        'pending_external': ExternalGroupAssignment.objects.exclude(status='evaluated').count(),
        'completed_evaluations': ExternalEvaluation.objects.count(),
    }
    
    # Grade distribution for external evaluations
    grade_distribution = {}
    for grade in ['A', 'B+', 'B', 'C+', 'C', 'F']:
        grade_distribution[grade] = ExternalEvaluation.objects.filter(grade=grade).count()
    
    # Pass/Fail statistics
    pass_count = ExternalEvaluation.objects.filter(is_pass=True).count()
    fail_count = ExternalEvaluation.objects.filter(is_pass=False).count()
    
    context = {
        'statistics': statistics,
        'grade_distribution': grade_distribution,
        'pass_count': pass_count,
        'fail_count': fail_count,
        'recent_evaluations': ExternalEvaluation.objects.select_related(
            'assignment__supervisor_group__group__student_1__user',
            'assignment__supervisor_group__project',
            'assignment__external_group__external_examiner__user'
        ).order_by('-evaluated_at')[:10],
        'upcoming_schedules': EvaluationSchedule.objects.filter(
            status='scheduled'
        ).order_by('date')[:10],
        'recent_external_groups': ExternalGroup.objects.select_related(
            'external_examiner__user'
        ).order_by('-created_at')[:5],
    }
    
    return render(request, 'admin/dashboard.html', context)


class ConsolidatedEvaluationExportAPIView(APIView):
    """
    Export consolidated grade report for student groups including Supervisor, 
    Committee, and External Examiner evaluation scores.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        groups = SupervisorOfStudentGroup.objects.filter(status="accepted").select_related(
            "group__student_1__user",
            "group__student_2__user",
            "project",
            "supervisor__user"
        )

        MAX_EXPORT_ROWS = 1000
        total_count = groups.count()
        if total_count > MAX_EXPORT_ROWS:
            return Response(
                {"detail": f"Export payload size ({total_count} records) exceeds maximum limit of {MAX_EXPORT_ROWS} records. Please apply filtering parameters."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        workbook = Workbook()
        sheet = workbook.active
        sheet.title = "Consolidated Grades"

        # UTC Official Header
        sheet.append(["BỘ GIÁO DỤC VÀ ĐÀO TẠO - TRƯỜNG ĐẠI HỌC GIAO THÔNG VẬN TẢI (UTC)"])
        sheet.append(["BẢNG TỔNG HỢP ĐIỂM VÀ ĐÁNH GIÁ ĐỒ ÁN TỐT NGHIỆP"])
        sheet.append([])

        headers = [
            "Assignment ID",
            "Student 1",
            "Reg No 1",
            "Student 2",
            "Reg No 2",
            "Project Title",
            "Supervisor",
            "External Examiner",
            "External Score",
            "Grade",
            "Status"
        ]
        sheet.append(headers)

        for rel in groups:
            assignment = ExternalGroupAssignment.objects.filter(supervisor_group=rel).first()
            ext_examiner_name = "Unassigned"
            ext_score = "N/A"
            grade = "N/A"
            pass_fail = "Pending"

            if assignment:
                ext_examiner_name = assignment.external_group.external_examiner.user.get_full_name() or assignment.external_group.external_examiner.user.username
                try:
                    eval_obj = ExternalEvaluation.objects.get(assignment=assignment)
                    ext_score = str(eval_obj.total_marks)
                    grade = eval_obj.grade
                    pass_fail = "PASS" if eval_obj.is_pass else "FAIL"
                except ExternalEvaluation.DoesNotExist:
                    pass

            std1_name = rel.group.student_1.user.get_full_name() or rel.group.student_1.user.username if rel.group.student_1 else "N/A"
            std1_reg = rel.group.student_1.registration_no if rel.group.student_1 else "N/A"
            std2_name = rel.group.student_2.user.get_full_name() or rel.group.student_2.user.username if rel.group.student_2 else "N/A"
            std2_reg = rel.group.student_2.registration_no if rel.group.student_2 else "N/A"
            proj_name = rel.project.project_name if rel.project else "N/A"
            sup_name = rel.supervisor.user.get_full_name() or rel.supervisor.user.username

            row = [
                rel.id,
                std1_name,
                std1_reg,
                std2_name,
                std2_reg,
                proj_name,
                sup_name,
                ext_examiner_name,
                ext_score,
                grade,
                pass_fail
            ]
            sheet.append(row)

        response = HttpResponse(
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        response["Content-Disposition"] = 'attachment; filename="consolidated_evaluations.xlsx"'
        workbook.save(response)
        return response

