# students/admin.py
from typing import Any

from django.contrib import admin
from django.contrib.admin import AdminSite
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.forms import UserChangeForm, UserCreationForm
from django.utils.html import format_html

from .models import (
    Student,
    Supervisor,
    CommitteeMember,
    CustomUser,
    ProjectCategories,
    Group,
    GroupCreationComment,
    Project,
    SupervisorStudentComments,
    SupervisorOfStudentGroup,
    CommitteeMemberPanel,
    ScopeDocumentEvaluationCriteria,
    SRSEvaluationSupervisor,
    SRSEvaluationCommitteeMember,
    SDDEvaluationCommitteeMember,
    SDDEvaluationSupervisor,
    Evaluation3Supervisor,
    Evaluation3CommitteeMember,
    Evaluation4CommitteeMember,
    Evaluation4Supervisor,
    ChatRoom,
    ExternalExaminer,
    ExternalGroup,
    ExternalGroupAssignment,
    ExternalEvaluation,
    EvaluationSchedule,
    Notification,
    DocumentRequirement,
)
from project_lib.admin import ImportableExportableAdmin, Workbook, RecordImportError


# ==================== Custom Admin Site ====================


class FYPAdminSite(AdminSite):
    """Custom admin site with dashboard."""
    
    site_header = 'FYP Management System'
    site_title = 'FYP Admin'
    index_title = 'Dashboard'
    
    def index(self, request, extra_context=None):
        """Custom admin dashboard with statistics."""
        extra_context = extra_context or {}
        
        # Statistics
        extra_context['statistics'] = {
            'total_students': Student.objects.count(),
            'total_supervisors': Supervisor.objects.count(),
            'total_committee': CommitteeMember.objects.count(),
            'total_external': ExternalExaminer.objects.filter(is_active=True).count(),
            'active_groups': SupervisorOfStudentGroup.objects.filter(status='accepted').count(),
            'external_groups': ExternalGroup.objects.count(),
            'pending_evaluations': ExternalGroupAssignment.objects.exclude(
                status='evaluated'
            ).count(),
            'completed_evaluations': ExternalEvaluation.objects.count(),
        }
        
        # Recent activity
        extra_context['recent_evaluations'] = ExternalEvaluation.objects.select_related(
            'assignment__supervisor_group__group__student_1__user',
            'assignment__external_group__external_examiner__user'
        ).order_by('-evaluated_at')[:5]
        
        extra_context['upcoming_schedules'] = EvaluationSchedule.objects.filter(
            status='scheduled'
        ).order_by('date')[:5]
        
        # Recent notifications
        extra_context['recent_notifications'] = Notification.objects.order_by(
            '-created_at'
        )[:5]
        
        return super().index(request, extra_context=extra_context)


# Create custom admin site instance (optional - can be used to replace default admin)
fyp_admin_site = FYPAdminSite(name='fyp_admin')


# ==================== Custom Admin Filters ====================


class SemesterFilter(admin.SimpleListFilter):
    """Filter by semester."""
    title = 'Semester'
    parameter_name = 'semester'
    
    def lookups(self, request, model_admin):
        return [
            ('semester_7', 'Semester 7'),
            ('semester_8', 'Semester 8'),
        ]
    
    def queryset(self, request, queryset):
        if self.value():
            # Filter based on related student semester
            return queryset.filter(
                supervisor_group__group__student_1__semester=self.value()
            )
        return queryset


class EvaluationStatusFilter(admin.SimpleListFilter):
    """Filter by evaluation status."""
    title = 'Evaluation Status'
    parameter_name = 'eval_status'
    
    def lookups(self, request, model_admin):
        return [
            ('evaluated', 'Evaluated'),
            ('pending', 'Pending Evaluation'),
        ]
    
    def queryset(self, request, queryset):
        if self.value() == 'evaluated':
            return queryset.filter(evaluation__isnull=False)
        elif self.value() == 'pending':
            return queryset.filter(evaluation__isnull=True)
        return queryset


class GradeFilter(admin.SimpleListFilter):
    """Filter evaluations by grade."""
    title = 'Grade'
    parameter_name = 'grade'
    
    def lookups(self, request, model_admin):
        return [
            ('A', 'Grade A (85+)'),
            ('B+', 'Grade B+ (75-84)'),
            ('B', 'Grade B (65-74)'),
            ('C+', 'Grade C+ (55-64)'),
            ('C', 'Grade C (50-54)'),
            ('F', 'Grade F (<50)'),
        ]
    
    def queryset(self, request, queryset):
        grade_value = self.value()
        if grade_value:
            return queryset.filter(grade=grade_value)
        return queryset


class ExternalExaminerFilter(admin.SimpleListFilter):
    """Filter by external examiner."""
    title = 'External Examiner'
    parameter_name = 'external_examiner'
    
    def lookups(self, request, model_admin):
        examiners = ExternalExaminer.objects.filter(is_active=True).select_related('user')
        return [(e.id, e.user.get_full_name() or e.user.username) for e in examiners]
    
    def queryset(self, request, queryset):
        if self.value():
            return queryset.filter(external_group__external_examiner_id=self.value())
        return queryset


class PassFailFilter(admin.SimpleListFilter):
    """Filter evaluations by pass/fail status."""
    title = 'Pass/Fail'
    parameter_name = 'pass_status'
    
    def lookups(self, request, model_admin):
        return [
            ('pass', 'Passed'),
            ('fail', 'Failed'),
        ]
    
    def queryset(self, request, queryset):
        if self.value() == 'pass':
            return queryset.filter(is_pass=True)
        elif self.value() == 'fail':
            return queryset.filter(is_pass=False)
        return queryset


# ==================== Admin Classes ====================


@admin.register(CustomUser)
class CustomUserAdmin(BaseUserAdmin):
    """Enhanced User Admin with external examiner support."""
    
    list_display = [
        'username', 'email', 'user_type', 'first_name', 'last_name',
        'get_user_type_display', 'is_active', 'is_staff', 'date_joined'
    ]
    list_filter = ['user_type', 'is_active', 'is_staff', 'date_joined']
    search_fields = ['username', 'email', 'first_name', 'last_name']
    ordering = ['username']
    
    # Fieldsets for editing existing users
    fieldsets = (
        (None, {'fields': ('username', 'password')}),
        ('Personal info', {'fields': ('first_name', 'last_name', 'email')}),
        ('FYP Role', {
            'fields': ('user_type',),
            'description': 'Select the user type: student, supervisor, committee_member, or external_examiner'
        }),
        ('Permissions', {
            'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions'),
        }),
        ('Important dates', {'fields': ('last_login', 'date_joined')}),
    )
    
    # Fieldsets for adding new users
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('username', 'email', 'first_name', 'last_name', 'user_type', 'password1', 'password2'),
        }),
    )
    
    readonly_fields = ['last_login', 'date_joined']
    
    def get_user_type_display(self, obj):
        """Display user type with color coding."""
        type_colors = {
            'student': '#28a745',
            'supervisor': '#007bff',
            'committee_member': '#6f42c1',
            'external_examiner': '#fd7e14',
        }
        color = type_colors.get(obj.user_type, '#6c757d')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 8px; '
            'border-radius: 4px; font-size: 11px;">{}</span>',
            color,
            obj.user_type.replace('_', ' ').title()
        )
    get_user_type_display.short_description = 'Role'
    get_user_type_display.admin_order_field = 'user_type'
    
    actions = ['make_student', 'make_supervisor', 'make_committee', 'make_external']
    
    @admin.action(description='Set user type to Student')
    def make_student(self, request, queryset):
        count = queryset.update(user_type='student')
        self.message_user(request, f'{count} users set to student.')
    
    @admin.action(description='Set user type to Supervisor')
    def make_supervisor(self, request, queryset):
        count = queryset.update(user_type='supervisor')
        self.message_user(request, f'{count} users set to supervisor.')
    
    @admin.action(description='Set user type to Committee Member')
    def make_committee(self, request, queryset):
        count = queryset.update(user_type='committee_member')
        self.message_user(request, f'{count} users set to committee member.')
    
    @admin.action(description='Set user type to External Examiner')
    def make_external(self, request, queryset):
        count = queryset.update(user_type='external_examiner')
        self.message_user(request, f'{count} users set to external examiner.')


admin.site.register(Group)
admin.site.register(GroupCreationComment)
admin.site.register(SupervisorStudentComments)
admin.site.register(ScopeDocumentEvaluationCriteria)
admin.site.register(SRSEvaluationSupervisor)
admin.site.register(SRSEvaluationCommitteeMember)
admin.site.register(SDDEvaluationSupervisor)
admin.site.register(SDDEvaluationCommitteeMember)
admin.site.register(Evaluation3Supervisor)
admin.site.register(Evaluation3CommitteeMember)
admin.site.register(Evaluation4Supervisor)
admin.site.register(Evaluation4CommitteeMember)
admin.site.register(ChatRoom)


@admin.register(DocumentRequirement)
class DocumentRequirementAdmin(admin.ModelAdmin):
    list_display = ["title", "document_type", "deadline", "semester", "created_by", "created_at"]
    list_filter = ["document_type", "semester"]
    search_fields = ["title"]
    readonly_fields = ["created_at", "updated_at"]
    ordering = ["deadline", "document_type"]


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ["project_name", "project_category", "panel", "user"]

    list_filter = ["project_category__category_name", "panel"]
    readonly_fields = ("user",)

    fieldsets = (
        (
            "Project Information",
            {"fields": ("project_name", "project_description", "project_category")},
        ),
        ("Technical Details", {"fields": ("language", "functionalities")}),
        ("Assignment", {"fields": ("panel", "user")}),
    )


@admin.register(SupervisorOfStudentGroup)
class SupervisorOfStudentGroupAdmin(admin.ModelAdmin):
    """Enhanced admin for student groups with external evaluation status."""
    
    list_display = [
        "supervisor", "group", "get_students", "project", "status",
        "is_ready_for_external", "external_evaluation_status", "get_external_assignment"
    ]
    
    list_filter = [
        "status", "project__panel", "is_ready_for_external", "external_evaluation_status"
    ]
    
    search_fields = [
        'supervisor__user__username', 'supervisor__user__first_name',
        'group__student_1__user__first_name', 'group__student_1__user__last_name',
        'group__student_1__registration_no',
        'project__project_name'
    ]
    
    readonly_fields = ['get_students', 'get_external_assignment', 'get_external_evaluation']
    
    fieldsets = (
        ('Assignment', {
            'fields': ('supervisor', 'group', 'project', 'status')
        }),
        ('External Evaluation', {
            'fields': (
                'is_ready_for_external', 'external_evaluation_status',
                'get_external_assignment', 'get_external_evaluation'
            ),
            'description': 'External evaluation status for 8th semester students'
        }),
    )
    
    def get_students(self, obj):
        """Display student names."""
        group = obj.group
        s1 = group.student_1.user.get_full_name() if group.student_1 else 'N/A'
        s2 = group.student_2.user.get_full_name() if group.student_2 else 'N/A'
        return f'{s1} & {s2}'
    get_students.short_description = 'Students'
    
    def get_external_assignment(self, obj):
        """Show external assignment info with link."""
        try:
            assignment = obj.external_assignment
            return format_html(
                '<a href="/admin/app/externalgroupassignment/{}/change/">'
                '<strong>{}</strong></a> (Slot: {})',
                assignment.id,
                assignment.external_group.name,
                assignment.slot_number or '-'
            )
        except Exception:
            return format_html('<span style="color: #999;">Not assigned</span>')
    get_external_assignment.short_description = 'External Assignment'
    
    def get_external_evaluation(self, obj):
        """Show external evaluation status with link."""
        try:
            assignment = obj.external_assignment
            if hasattr(assignment, 'evaluation') and assignment.evaluation:
                eval_obj = assignment.evaluation
                return format_html(
                    '<a href="/admin/app/externalevaluation/{}/change/">'
                    '<span style="color: green; font-weight: bold;">{} - {}/100</span></a>',
                    eval_obj.id,
                    eval_obj.grade,
                    round(eval_obj.total_marks, 1)
                )
            return format_html('<span style="color: orange;">Pending</span>')
        except Exception:
            return format_html('<span style="color: #999;">N/A</span>')
    get_external_evaluation.short_description = 'External Evaluation'
    
    actions = ['mark_ready_for_external', 'mark_not_ready_for_external']
    
    @admin.action(description='Mark as ready for external evaluation')
    def mark_ready_for_external(self, request, queryset):
        count = queryset.update(is_ready_for_external=True)
        self.message_user(request, f'{count} groups marked as ready for external evaluation.')
    
    @admin.action(description='Mark as NOT ready for external evaluation')
    def mark_not_ready_for_external(self, request, queryset):
        count = queryset.update(is_ready_for_external=False)
        self.message_user(request, f'{count} groups marked as not ready for external evaluation.')


@admin.register(Student)
class StudentAdmin(ImportableExportableAdmin):
    list_display = ["user", "registration_no", "department", "semester", "batch_no"]

    def import_parse_and_save_xlsx_data(
        self, extra_params: dict[str, Any], workbook: Workbook
    ) -> tuple[int, int]:
        worksheet = workbook.active

        columns = [
            cell_value
            for row in worksheet.iter_rows(
                max_row=1, max_col=worksheet.max_column, values_only=True
            )
            for cell_value in row
            if cell_value
        ]

        errors: dict[int | str, list] = {}
        records_created = 0
        records_updated = 0

        for row_idx, row in enumerate(
            worksheet.iter_rows(
                min_row=2,
                max_row=worksheet.max_row,
                max_col=len(columns) + 1,
                values_only=True,
            )
        ):
            if not row or all(v is None for v in row):
                break

            record_field_values = {}

            try:
                for col_idx, current_column in enumerate(columns):
                    if current_column not in self.import_related_fields:
                        record_field_values[current_column] = row[col_idx]

                try:
                    semester = (
                        record_field_values.get("semester", "")
                        .lower()
                        .replace(" ", "_")
                    )
                    try:
                        student = Student.objects.get(
                            registration_no=record_field_values.get("registration_no")
                        )
                        student.department = record_field_values.get(
                            "department", student.department
                        )
                        student.semester = semester if semester else student.semester
                        student.batch_no = record_field_values.get(
                            "batch_no", student.batch_no
                        )
                        student.user.username = record_field_values.get(
                            "username", student.user.username
                        )
                        student.user.email = record_field_values.get(
                            "email", student.user.email
                        )
                        student.user.save()
                        student.save()
                        records_updated += 1
                    except Student.DoesNotExist:
                        username = record_field_values.get("username", "")
                        if not username:
                            errors[f"username required, skipping record: {row_idx}"] = [
                                row_idx
                            ]
                            continue
                        try:
                            CustomUser.objects.get(username=username)
                            errors[
                                f"username ({username}) already taken, skipping record: {row_idx}"
                            ] = [row_idx]
                        except CustomUser.DoesNotExist:
                            # Create user with password
                            user = CustomUser.objects.create(
                                username=record_field_values.get("username", ""),
                                email=record_field_values.get("email", ""),
                                user_type="student",
                            )
                            # Set default password (registration_no or fallback)
                            default_password = record_field_values.get("password") or record_field_values.get("registration_no") or "password123"
                            user.set_password(default_password)
                            user.save()
                            
                            Student.objects.create(
                                registration_no=record_field_values.get(
                                    "registration_no", ""
                                ),
                                department=record_field_values.get("department", ""),
                                semester=semester,
                                batch_no=record_field_values.get("batch_no", ""),
                                user=user,
                            )
                            records_created += 1

                except Exception as e:
                    errors[f"Error creating user/student: {str(e)}"] = [row_idx]

            except Exception as e:
                errors[f"Error processing row data: {str(e)}"] = [row_idx]

            except (ValueError, Exception) as ex:
                msg = str(ex)
                if msg not in errors:
                    errors[msg] = []
                errors[msg].append(row_idx + 2)  # type: ignore[union-attr]
        if errors:
            raise RecordImportError(errors)
        else:
            return records_created, records_updated


@admin.register(Supervisor)
class SupervisorAdmin(ImportableExportableAdmin):
    list_display = ["user", "supervisor_id", "research_interest", "academic_background"]

    def import_parse_and_save_xlsx_data(
        self, extra_params: dict[str, Any], workbook: Workbook
    ) -> tuple[int, int]:
        worksheet = workbook.active

        columns = [
            cell_value
            for row in worksheet.iter_rows(
                max_row=1, max_col=worksheet.max_column, values_only=True
            )
            for cell_value in row
            if cell_value
        ]

        errors: dict[int | str, list] = {}
        records_created = 0
        records_updated = 0

        for row_idx, row in enumerate(
            worksheet.iter_rows(
                min_row=2,
                max_row=worksheet.max_row,
                max_col=len(columns) + 1,
                values_only=True,
            )
        ):
            if not row or all(v is None for v in row):
                break

            record_field_values = {}

            try:
                for col_idx, current_column in enumerate(columns):
                    if current_column not in self.import_related_fields:
                        record_field_values[current_column] = row[col_idx]

                try:
                    try:
                        supervisor = Supervisor.objects.get(
                            supervisor_id=record_field_values.get("supervisor_id")
                        )
                        supervisor.research_interest = record_field_values.get(
                            "research_interest", supervisor.research_interest
                        )
                        supervisor.academic_background = record_field_values.get(
                            "academic_background", supervisor.academic_background
                        )
                        supervisor.user.username = record_field_values.get(
                            "username", supervisor.user.username
                        )
                        supervisor.user.email = record_field_values.get(
                            "email", supervisor.user.email
                        )
                        supervisor.user.save()
                        supervisor.save()
                        records_updated += 1
                    except Supervisor.DoesNotExist:
                        username = record_field_values.get("username", "")
                        if not username:
                            errors[f"username required, skipping record: {row_idx}"] = [
                                row_idx
                            ]
                            continue
                        try:
                            CustomUser.objects.get(username=username)
                            errors[
                                f"username ({username}) already taken, skipping record: {row_idx}"
                            ] = [row_idx]
                            continue
                        except CustomUser.DoesNotExist:
                            # Create user with password
                            user = CustomUser.objects.create(
                                username=record_field_values.get("username", ""),
                                email=record_field_values.get("email", ""),
                                user_type="supervisor",
                            )
                            # Set default password (supervisor_id or fallback)
                            default_password = record_field_values.get("password") or record_field_values.get("supervisor_id") or "password123"
                            user.set_password(default_password)
                            user.save()
                            
                            supervisor = Supervisor.objects.create(
                                supervisor_id=record_field_values.get("supervisor_id"),
                                research_interest=record_field_values.get(
                                    "research_interest", ""
                                ),
                                academic_background=record_field_values.get(
                                    "academic_background", ""
                                ).lower(),
                                user=user,
                            )
                            supervisor.save()
                            records_created += 1

                    categories = record_field_values.get("categories", "").split(",")
                    for category in categories:
                        category, _ = ProjectCategories.objects.get_or_create(
                            category_name=category.strip()
                        )
                        supervisor.category.add(category)

                except Exception as e:
                    errors[row_idx] = [
                        f"Error creating user/supervisor: {str(e)}",
                    ]

            except Exception as e:
                errors[row_idx] = [
                    f"Error processing row data: {str(e)}",
                ]

            except (ValueError, Exception) as ex:
                msg = str(ex)
                if msg not in errors:
                    errors[msg] = []
                errors[msg].append(row_idx + 2)  # type: ignore[union-attr]
        if errors:
            raise RecordImportError(errors)
        else:
            return records_created, records_updated


@admin.register(CommitteeMember)
class CommitteeMemberAdmin(ImportableExportableAdmin):
    list_display = ["user", "committee_id", "panel"]

    def import_parse_and_save_xlsx_data(
        self, extra_params: dict[str, Any], workbook: Workbook
    ) -> tuple[int, int]:
        worksheet = workbook.active

        columns = [
            cell_value
            for row in worksheet.iter_rows(
                max_row=1, max_col=worksheet.max_column, values_only=True
            )
            for cell_value in row
            if cell_value
        ]

        errors: dict[int | str, list] = {}
        records_created = 0
        records_updated = 0

        for row_idx, row in enumerate(
            worksheet.iter_rows(
                min_row=2,
                max_row=worksheet.max_row,
                max_col=len(columns) + 1,
                values_only=True,
            )
        ):
            if not row or all(v is None for v in row):
                break

            record_field_values = {}

            try:
                for col_idx, current_column in enumerate(columns):
                    if current_column not in self.import_related_fields:
                        record_field_values[current_column] = row[col_idx]

                try:
                    try:
                        committee = CommitteeMember.objects.get(
                            committee_id=record_field_values.get("committee_id")
                        )
                        committee.panel.name = record_field_values.get(
                            "panel", committee.panel.name
                        )
                        committee.user.username = record_field_values.get(
                            "username", committee.user.username
                        )
                        committee.user.email = record_field_values.get(
                            "email", committee.user.email
                        )
                        committee.user.save()
                        committee.panel.save()
                        committee.save()
                        records_updated += 1
                    except CommitteeMember.DoesNotExist:
                        username = record_field_values.get("username", "")
                        if not username:
                            errors[f"username required, skipping record: {row_idx}"] = [
                                row_idx
                            ]
                            continue
                        try:
                            CustomUser.objects.get(username=username)
                            errors[
                                f"username ({username}) already taken, skipping record: {row_idx}"
                            ] = [row_idx]
                        except CustomUser.DoesNotExist:
                            # Create user with password
                            user = CustomUser.objects.create(
                                username=record_field_values.get("username", ""),
                                email=record_field_values.get("email", ""),
                                user_type="committee_member",  # Fixed: was incorrectly "supervisor"
                            )
                            # Set default password (committee_id or fallback)
                            default_password = record_field_values.get("password") or record_field_values.get("committee_id") or "password123"
                            user.set_password(default_password)
                            user.save()
                            
                            panel, _ = CommitteeMemberPanel.objects.get_or_create(
                                name=record_field_values.get("panel")
                            )
                            committee = CommitteeMember.objects.create(
                                committee_id=record_field_values.get("committee_id"),
                                user=user,
                                panel=panel,
                            )
                            committee.save()
                            records_created += 1

                except Exception as e:
                    errors[row_idx] = [
                        f"Error creating user/Committee Member: {str(e)}",
                    ]

            except Exception as e:
                errors[row_idx] = [
                    f"Error processing row data: {str(e)}",
                ]

            except (ValueError, Exception) as ex:
                msg = str(ex)
                if msg not in errors:
                    errors[msg] = []
                errors[msg].append(row_idx + 2)  # type: ignore[union-attr]
        if errors:
            raise RecordImportError(errors)
        else:
            return records_created, records_updated


@admin.register(ProjectCategories)
class ProjectCategoriesAdmin(ImportableExportableAdmin):
    list_display = [
        "category_name",
    ]

    def import_parse_and_save_xlsx_data(
        self, extra_params: dict[str, Any], workbook: Workbook
    ) -> tuple[int, int]:
        worksheet = workbook.active

        columns = [
            cell_value
            for row in worksheet.iter_rows(
                max_row=1, max_col=worksheet.max_column, values_only=True
            )
            for cell_value in row
            if cell_value
        ]

        errors: dict[int | str, list] = {}
        records_created = 0
        records_updated = 0

        for row_idx, row in enumerate(
            worksheet.iter_rows(
                min_row=2,
                max_row=worksheet.max_row,
                max_col=len(columns) + 1,
                values_only=True,
            )
        ):
            if not row or all(v is None for v in row):
                break

            record_field_values = {}

            try:
                for col_idx, current_column in enumerate(columns):
                    if current_column not in self.import_related_fields:
                        record_field_values[current_column] = row[col_idx]

                try:
                    _, created = ProjectCategories.objects.get_or_create(
                        category_name=record_field_values.get("category_name")
                    )
                    if created:
                        records_created += 1
                    else:
                        records_updated += 1

                except Exception as e:
                    errors[row_idx] = [
                        f"Error creating user/Committee Member: {str(e)}",
                    ]

            except Exception as e:
                errors[row_idx] = [
                    f"Error processing row data: {str(e)}",
                ]

            except (ValueError, Exception) as ex:
                msg = str(ex)
                if msg not in errors:
                    errors[msg] = []
                errors[msg].append(row_idx + 2)  # type: ignore[union-attr]
        if errors:
            raise RecordImportError(errors)
        else:
            return records_created, records_updated


@admin.register(CommitteeMemberPanel)
class CommitteeMemberPanelAdmin(ImportableExportableAdmin):
    list_display = [
        "name",
    ]

    def import_parse_and_save_xlsx_data(
        self, extra_params: dict[str, Any], workbook: Workbook
    ) -> tuple[int, int]:
        worksheet = workbook.active

        columns = [
            cell_value
            for row in worksheet.iter_rows(
                max_row=1, max_col=worksheet.max_column, values_only=True
            )
            for cell_value in row
            if cell_value
        ]

        errors: dict[int | str, list] = {}
        records_created = 0
        records_updated = 0

        for row_idx, row in enumerate(
            worksheet.iter_rows(
                min_row=2,
                max_row=worksheet.max_row,
                max_col=len(columns) + 1,
                values_only=True,
            )
        ):
            if not row or all(v is None for v in row):
                break

            record_field_values = {}

            try:
                for col_idx, current_column in enumerate(columns):
                    if current_column not in self.import_related_fields:
                        record_field_values[current_column] = row[col_idx]

                try:
                    _, created = CommitteeMemberPanel.objects.get_or_create(
                        name=record_field_values.get("name")
                    )
                    if created:
                        records_created += 1
                    else:
                        records_updated += 1

                except Exception as e:
                    errors[row_idx] = [
                        f"Error creating user/Committee Member: {str(e)}",
                    ]

            except Exception as e:
                errors[row_idx] = [
                    f"Error processing row data: {str(e)}",
                ]

            except (ValueError, Exception) as ex:
                msg = str(ex)
                if msg not in errors:
                    errors[msg] = []
                errors[msg].append(row_idx + 2)  # type: ignore[union-attr]
        if errors:
            raise RecordImportError(errors)
        else:
            return records_created, records_updated


# ==================== External Examiner Admin ====================


@admin.register(ExternalExaminer)
class ExternalExaminerAdmin(admin.ModelAdmin):
    """Admin configuration for External Examiner."""
    
    list_display = [
        'get_full_name', 'external_id', 'institution', 
        'designation', 'get_groups_count', 'is_active', 'created_at'
    ]
    list_filter = ['designation', 'institution', 'is_active', 'created_at']
    search_fields = [
        'user__username', 'user__first_name', 'user__last_name',
        'external_id', 'institution', 'specialization'
    ]
    readonly_fields = ['created_at', 'get_groups_count', 'get_total_students']
    ordering = ['-created_at']
    
    fieldsets = (
        ('User Information', {
            'fields': ('user',)
        }),
        ('External Examiner Details', {
            'fields': (
                'external_id', 'institution', 'designation',
                'specialization', 'contact_number', 'address'
            )
        }),
        ('Status', {
            'fields': ('is_active',)
        }),
        ('Statistics', {
            'fields': ('get_groups_count', 'get_total_students'),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at',),
            'classes': ('collapse',)
        }),
    )
    
    def get_full_name(self, obj):
        """Display full name of external examiner."""
        return obj.user.get_full_name() or obj.user.username
    get_full_name.short_description = 'Name'
    get_full_name.admin_order_field = 'user__first_name'
    
    def get_groups_count(self, obj):
        """Count of external groups."""
        count = obj.external_groups.count()
        return format_html(
            '<span style="color: {};">{}</span>',
            'green' if count > 0 else 'gray',
            count
        )
    get_groups_count.short_description = 'External Groups'
    
    def get_total_students(self, obj):
        """Total student groups assigned."""
        count = ExternalGroupAssignment.objects.filter(
            external_group__external_examiner=obj
        ).count()
        return count
    get_total_students.short_description = 'Total Student Groups'
    
    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        """Filter user choices to external examiner type only."""
        if db_field.name == 'user':
            kwargs['queryset'] = CustomUser.objects.filter(
                user_type='external_examiner'
            )
        return super().formfield_for_foreignkey(db_field, request, **kwargs)
    
    actions = ['activate_examiners', 'deactivate_examiners']
    
    @admin.action(description='Activate selected external examiners')
    def activate_examiners(self, request, queryset):
        count = queryset.update(is_active=True)
        self.message_user(request, f'{count} external examiners activated.')
    
    @admin.action(description='Deactivate selected external examiners')
    def deactivate_examiners(self, request, queryset):
        count = queryset.update(is_active=False)
        self.message_user(request, f'{count} external examiners deactivated.')


# ==================== External Group Admin ====================


class ExternalGroupAssignmentInline(admin.TabularInline):
    """Inline for viewing/adding assignments to external group."""
    model = ExternalGroupAssignment
    extra = 0
    readonly_fields = ['get_students', 'get_project', 'status', 'assigned_at']
    fields = ['supervisor_group', 'get_students', 'get_project', 'slot_number', 'slot_time', 'status']
    autocomplete_fields = ['supervisor_group']
    
    def get_students(self, obj):
        if obj.pk:
            group = obj.supervisor_group.group
            s1 = group.student_1.user.get_full_name()
            s2 = group.student_2.user.get_full_name() if group.student_2 else 'N/A'
            return f'{s1} & {s2}'
        return '-'
    get_students.short_description = 'Students'
    
    def get_project(self, obj):
        if obj.pk and obj.supervisor_group.project:
            return obj.supervisor_group.project.project_name
        return '-'
    get_project.short_description = 'Project'


@admin.register(ExternalGroup)
class ExternalGroupAdmin(admin.ModelAdmin):
    """Admin configuration for External Groups."""
    
    list_display = [
        'name', 'external_examiner', 'semester', 'status',
        'get_assignment_count', 'max_groups', 'evaluation_date'
    ]
    list_filter = ['status', 'semester', 'evaluation_date']
    search_fields = [
        'name', 'external_examiner__user__first_name',
        'external_examiner__user__last_name', 'external_examiner__institution'
    ]
    readonly_fields = ['created_at', 'get_assignment_count', 'get_available_slots']
    ordering = ['-created_at']
    date_hierarchy = 'evaluation_date'
    autocomplete_fields = ['external_examiner']
    inlines = [ExternalGroupAssignmentInline]
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('name', 'external_examiner', 'semester')
        }),
        ('Capacity', {
            'fields': ('max_groups', 'get_assignment_count', 'get_available_slots')
        }),
        ('Schedule', {
            'fields': ('evaluation_date', 'evaluation_venue', 'status')
        }),
        ('Notes', {
            'fields': ('notes',),
            'classes': ('collapse',)
        }),
        ('Metadata', {
            'fields': ('created_by', 'created_at'),
            'classes': ('collapse',)
        }),
    )
    
    def get_assignment_count(self, obj):
        """Number of assigned student groups."""
        count = obj.assignments.count()
        max_groups = obj.max_groups
        color = 'red' if count >= max_groups else 'green'
        return format_html(
            '<span style="color: {};">{}/{}</span>',
            color, count, max_groups
        )
    get_assignment_count.short_description = 'Assigned/Max'
    
    def get_available_slots(self, obj):
        """Available slots for assignment."""
        return obj.available_slots
    get_available_slots.short_description = 'Available Slots'
    
    def save_model(self, request, obj, form, change):
        """Auto-set created_by on create."""
        if not change:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)
    
    actions = [
        'mark_as_scheduled', 'mark_as_completed',
        'create_evaluations_for_groups', 'notify_assigned_students', 'generate_report'
    ]
    
    @admin.action(description='Mark selected groups as scheduled')
    def mark_as_scheduled(self, request, queryset):
        count = queryset.update(status='scheduled')
        self.message_user(request, f'{count} groups marked as scheduled.')
    
    @admin.action(description='Mark selected groups as completed')
    def mark_as_completed(self, request, queryset):
        count = queryset.update(status='completed')
        self.message_user(request, f'{count} groups marked as completed.')
    
    @admin.action(description='Create evaluation entries for all assigned groups')
    def create_evaluations_for_groups(self, request, queryset):
        """Bulk create empty evaluation records."""
        created = 0
        for ext_group in queryset:
            for assignment in ext_group.assignments.all():
                if not hasattr(assignment, 'evaluation') or not assignment.evaluation:
                    ExternalEvaluation.objects.create(assignment=assignment)
                    created += 1
        self.message_user(request, f'{created} evaluation records created.')
    
    @admin.action(description='Send notification to all assigned students')
    def notify_assigned_students(self, request, queryset):
        """Send notification to students in selected groups."""
        notified = 0
        for ext_group in queryset:
            for assignment in ext_group.assignments.all():
                group = assignment.supervisor_group.group
                message = f'Reminder: Your external evaluation is scheduled. Group: {ext_group.name}'
                
                for student in [group.student_1, group.student_2]:
                    if student:
                        Notification.objects.create(
                            user=student.user,
                            notification_type='general',
                            title='External Evaluation Reminder',
                            message=message
                        )
                        notified += 1
        
        self.message_user(request, f'{notified} notifications sent.')
    
    @admin.action(description='Generate evaluation report')
    def generate_report(self, request, queryset):
        """Generate CSV report for selected external groups."""
        import csv
        from django.http import HttpResponse
        
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="external_groups_report.csv"'
        
        writer = csv.writer(response)
        writer.writerow([
            'External Group', 'External Examiner', 'Semester', 'Status',
            'Student Group', 'Project', 'Slot', 'Evaluation Status', 'Marks', 'Grade'
        ])
        
        for ext_group in queryset:
            for assignment in ext_group.assignments.all():
                group = assignment.supervisor_group.group
                students = f'{group.student_1.user.get_full_name()}'
                if group.student_2:
                    students += f' & {group.student_2.user.get_full_name()}'
                
                project = assignment.supervisor_group.project
                project_name = project.project_name if project else '-'
                
                # Check evaluation status
                if hasattr(assignment, 'evaluation') and assignment.evaluation:
                    eval_status = 'Evaluated'
                    marks = round(assignment.evaluation.total_marks, 1)
                    grade = assignment.evaluation.grade
                else:
                    eval_status = 'Pending'
                    marks = '-'
                    grade = '-'
                
                writer.writerow([
                    ext_group.name,
                    ext_group.external_examiner.user.get_full_name(),
                    ext_group.semester,
                    ext_group.status,
                    students,
                    project_name,
                    assignment.slot_number or '-',
                    eval_status,
                    marks,
                    grade
                ])
        
        return response


# ==================== External Group Assignment Admin ====================


class ExternalEvaluationInline(admin.StackedInline):
    """Inline for editing evaluation from assignment."""
    model = ExternalEvaluation
    extra = 0
    max_num = 1
    can_delete = False
    
    readonly_fields = ['total_marks', 'grade', 'evaluated_at']
    
    fieldsets = (
        ('Quick Evaluation', {
            'fields': (
                ('project_completion', 'code_quality', 'functionality'),
                ('understanding_of_technology', 'problem_solving', 'innovation'),
                ('presentation_clarity', 'communication', 'time_management'),
                ('documentation_completeness', 'documentation_quality'),
                ('qa_response',),
                ('total_marks', 'grade', 'is_pass'),
                ('overall_comment',)
            )
        }),
    )


@admin.register(ExternalGroupAssignment)
class ExternalGroupAssignmentAdmin(admin.ModelAdmin):
    """Admin configuration for External Group Assignments."""
    
    list_display = [
        'get_external_group', 'get_students', 'get_project',
        'slot_number', 'slot_time', 'status', 'get_evaluation_status'
    ]
    list_filter = [
        'status', 'external_group__semester',
        'external_group__external_examiner',
        SemesterFilter, EvaluationStatusFilter, ExternalExaminerFilter
    ]
    search_fields = [
        'external_group__name',
        'supervisor_group__group__student_1__user__first_name',
        'supervisor_group__group__student_1__user__last_name',
        'supervisor_group__group__student_2__user__first_name',
        'supervisor_group__group__student_2__user__last_name',
        'supervisor_group__project__project_name',
        'external_group__external_examiner__user__first_name',
        'external_group__external_examiner__user__last_name'
    ]
    readonly_fields = ['assigned_at', 'get_students', 'get_project', 'get_evaluation_status']
    ordering = ['external_group', 'slot_number']
    autocomplete_fields = ['external_group', 'supervisor_group']
    inlines = [ExternalEvaluationInline]
    
    fieldsets = (
        ('Assignment', {
            'fields': ('external_group', 'supervisor_group')
        }),
        ('Student Info', {
            'fields': ('get_students', 'get_project'),
        }),
        ('Schedule', {
            'fields': ('slot_number', 'slot_time', 'status')
        }),
        ('Evaluation', {
            'fields': ('get_evaluation_status',)
        }),
        ('Metadata', {
            'fields': ('assigned_by', 'assigned_at'),
            'classes': ('collapse',)
        }),
    )
    
    def get_external_group(self, obj):
        return obj.external_group.name
    get_external_group.short_description = 'External Group'
    get_external_group.admin_order_field = 'external_group__name'
    
    def get_students(self, obj):
        group = obj.supervisor_group.group
        s1 = f'{group.student_1.user.get_full_name()} ({group.student_1.registration_no})'
        s2 = f'{group.student_2.user.get_full_name()} ({group.student_2.registration_no})' if group.student_2 else 'N/A'
        return format_html('{}<br>{}', s1, s2)
    get_students.short_description = 'Students'
    
    def get_project(self, obj):
        project = obj.supervisor_group.project
        if project:
            return f'{project.project_name} ({project.project_category})'
        return '-'
    get_project.short_description = 'Project'
    
    def get_evaluation_status(self, obj):
        if hasattr(obj, 'evaluation') and obj.evaluation:
            eval_obj = obj.evaluation
            return format_html(
                '<span style="color: green;">Evaluated - {} ({}/100)</span>',
                eval_obj.grade, round(eval_obj.total_marks, 1)
            )
        return format_html('<span style="color: orange;">Pending</span>')
    get_evaluation_status.short_description = 'Evaluation'
    
    def save_model(self, request, obj, form, change):
        if not change:
            obj.assigned_by = request.user
        super().save_model(request, obj, form, change)


# ==================== External Evaluation Admin ====================


@admin.register(ExternalEvaluation)
class ExternalEvaluationAdmin(admin.ModelAdmin):
    """Admin configuration for External Evaluations."""
    
    list_display = [
        'get_students', 'get_external_examiner', 'get_total_marks',
        'grade', 'is_pass', 'evaluated_at'
    ]
    list_filter = [
        'is_pass', 'evaluated_at',
        'assignment__external_group__external_examiner',
        'assignment__external_group__semester',
        GradeFilter, PassFailFilter
    ]
    search_fields = [
        'assignment__supervisor_group__group__student_1__user__first_name',
        'assignment__supervisor_group__group__student_1__user__last_name',
        'assignment__supervisor_group__group__student_2__user__first_name',
        'assignment__supervisor_group__group__student_2__user__last_name',
        'assignment__supervisor_group__project__project_name',
        'assignment__external_group__external_examiner__user__first_name',
        'assignment__external_group__external_examiner__user__last_name',
        'overall_comment', 'strengths', 'areas_of_improvement'
    ]
    readonly_fields = [
        'get_students', 'get_project', 'get_external_examiner',
        'project_implementation_marks', 'technical_knowledge_marks',
        'presentation_marks', 'documentation_marks', 'qa_marks',
        'total_marks', 'grade', 'created_at', 'updated_at'
    ]
    date_hierarchy = 'evaluated_at'
    
    fieldsets = (
        ('Assignment Info', {
            'fields': ('assignment', 'get_students', 'get_project', 'get_external_examiner')
        }),
        ('Project Implementation (30 marks)', {
            'fields': (
                'project_completion', 'code_quality', 'functionality',
                'project_implementation_marks'
            )
        }),
        ('Technical Knowledge (25 marks)', {
            'fields': (
                'understanding_of_technology', 'problem_solving', 'innovation',
                'technical_knowledge_marks'
            )
        }),
        ('Presentation Skills (20 marks)', {
            'fields': (
                'presentation_clarity', 'communication', 'time_management',
                'presentation_marks'
            )
        }),
        ('Documentation Quality (15 marks)', {
            'fields': (
                'documentation_completeness', 'documentation_quality',
                'documentation_marks'
            )
        }),
        ('Q&A Response (10 marks)', {
            'fields': ('qa_response', 'qa_marks')
        }),
        ('Total & Grade', {
            'fields': ('total_marks', 'grade', 'is_pass')
        }),
        ('Comments', {
            'fields': ('overall_comment', 'strengths', 'areas_of_improvement'),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('evaluated_at', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def get_students(self, obj):
        group = obj.assignment.supervisor_group.group
        s2 = group.student_2.user.get_full_name() if group.student_2 else "N/A"
        return f'{group.student_1.user.get_full_name()} & {s2}'
    get_students.short_description = 'Students'
    
    def get_project(self, obj):
        project = obj.assignment.supervisor_group.project
        return project.project_name if project else '-'
    get_project.short_description = 'Project'
    
    def get_external_examiner(self, obj):
        return obj.assignment.external_group.external_examiner.user.get_full_name()
    get_external_examiner.short_description = 'External Examiner'
    
    def get_total_marks(self, obj):
        marks = obj.total_marks
        color = 'green' if marks >= 50 else 'red'
        return format_html(
            '<span style="color: {}; font-weight: bold;">{}/100</span>',
            color, round(marks, 1)
        )
    get_total_marks.short_description = 'Total Marks'
    
    actions = ['mark_as_pass', 'mark_as_fail', 'export_evaluations']
    
    @admin.action(description='Mark selected as PASS')
    def mark_as_pass(self, request, queryset):
        count = queryset.update(is_pass=True)
        self.message_user(request, f'{count} evaluations marked as PASS.')
    
    @admin.action(description='Mark selected as FAIL')
    def mark_as_fail(self, request, queryset):
        count = queryset.update(is_pass=False)
        self.message_user(request, f'{count} evaluations marked as FAIL.')
    
    @admin.action(description='Export selected evaluations to CSV')
    def export_evaluations(self, request, queryset):
        import csv
        from django.http import HttpResponse
        
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="external_evaluations.csv"'
        
        writer = csv.writer(response)
        writer.writerow([
            'Students', 'Project', 'External Examiner',
            'Total Marks', 'Grade', 'Pass/Fail', 'Evaluated At'
        ])
        
        for eval_obj in queryset:
            writer.writerow([
                self.get_students(eval_obj),
                self.get_project(eval_obj),
                self.get_external_examiner(eval_obj),
                round(eval_obj.total_marks, 1),
                eval_obj.grade,
                'PASS' if eval_obj.is_pass else 'FAIL',
                eval_obj.evaluated_at
            ])
        
        return response


# ==================== Evaluation Schedule Admin ====================


@admin.register(EvaluationSchedule)
class EvaluationScheduleAdmin(admin.ModelAdmin):
    """Admin configuration for Evaluation Schedules."""
    
    list_display = [
        'title', 'evaluation_type', 'semester', 'date',
        'start_time', 'end_time', 'venue', 'status'
    ]
    list_filter = ['evaluation_type', 'status', 'semester', 'date']
    search_fields = ['title', 'venue', 'notes']
    readonly_fields = ['created_at']
    ordering = ['date', 'start_time']
    date_hierarchy = 'date'
    
    fieldsets = (
        ('Schedule Details', {
            'fields': ('title', 'evaluation_type', 'semester')
        }),
        ('Date & Time', {
            'fields': ('date', 'start_time', 'end_time', 'venue')
        }),
        ('Assignment', {
            'fields': ('external_group', 'panel'),
            'description': 'Assign to External Group OR Panel (not both)'
        }),
        ('Status', {
            'fields': ('status', 'notes')
        }),
        ('Metadata', {
            'fields': ('created_by', 'created_at'),
            'classes': ('collapse',)
        }),
    )
    
    def save_model(self, request, obj, form, change):
        if not change:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)
    
    actions = ['mark_completed', 'mark_postponed']
    
    @admin.action(description='Mark selected as completed')
    def mark_completed(self, request, queryset):
        count = queryset.update(status='completed')
        self.message_user(request, f'{count} schedules marked as completed.')
    
    @admin.action(description='Mark selected as postponed')
    def mark_postponed(self, request, queryset):
        count = queryset.update(status='postponed')
        self.message_user(request, f'{count} schedules marked as postponed.')
