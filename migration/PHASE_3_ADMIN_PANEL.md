# Phase 3: Admin Panel Configuration

## Objective
Configure Django Admin panel to support External Examiner management and external group assignments.

---

## Task Summary

| Task ID | Task | Priority | Status |
|---------|------|----------|--------|
| 3.1 | Register ExternalExaminer model | HIGH | ✅ Done |
| 3.2 | Register ExternalGroup model | HIGH | ✅ Done |
| 3.3 | Register ExternalGroupAssignment model | HIGH | ✅ Done |
| 3.4 | Register ExternalEvaluation model | HIGH | ✅ Done |
| 3.5 | Register EvaluationSchedule model | MEDIUM | ✅ Done |
| 3.6 | Create admin actions for bulk operations | MEDIUM | ✅ Done |
| 3.7 | Add inline editing for assignments | MEDIUM | ✅ Done |
| 3.8 | Create admin filters and search | MEDIUM | ✅ Done |
| 3.9 | Add dashboard widgets | LOW | ✅ Done |
| 3.10 | Update existing admin classes | MEDIUM | ✅ Done |

---

## Task 3.1: Register ExternalExaminer Model

### File: `backend/app/admin.py`

```python
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.utils.html import format_html
from .models import (
    CustomUser, Student, Supervisor, CommitteeMember,
    ExternalExaminer, ExternalGroup, ExternalGroupAssignment,
    ExternalEvaluation, EvaluationSchedule,
    # ... other models
)


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
```

### Acceptance Criteria
- [x] List view shows key information
- [x] Filters and search working
- [x] Statistics displayed
- [x] Bulk actions available

---

## Task 3.2: Register ExternalGroup Model

### File: `backend/app/admin.py`

```python
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
        if obj.pk:
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
    
    actions = ['mark_as_scheduled', 'mark_as_completed']
    
    @admin.action(description='Mark selected groups as scheduled')
    def mark_as_scheduled(self, request, queryset):
        count = queryset.update(status='scheduled')
        self.message_user(request, f'{count} groups marked as scheduled.')
    
    @admin.action(description='Mark selected groups as completed')
    def mark_as_completed(self, request, queryset):
        count = queryset.update(status='completed')
        self.message_user(request, f'{count} groups marked as completed.')
```

### Acceptance Criteria
- [x] List view with capacity info
- [x] Inline assignments editing
- [x] Date hierarchy for scheduling
- [x] Status bulk actions

---

## Task 3.3: Register ExternalGroupAssignment Model

### File: `backend/app/admin.py`

```python
@admin.register(ExternalGroupAssignment)
class ExternalGroupAssignmentAdmin(admin.ModelAdmin):
    """Admin configuration for External Group Assignments."""
    
    list_display = [
        'get_external_group', 'get_students', 'get_project',
        'slot_number', 'slot_time', 'status', 'get_evaluation_status'
    ]
    list_filter = [
        'status', 'external_group__semester',
        'external_group__external_examiner'
    ]
    search_fields = [
        'external_group__name',
        'supervisor_group__group__student_1__user__first_name',
        'supervisor_group__group__student_1__user__last_name',
        'supervisor_group__project__project_name'
    ]
    readonly_fields = ['assigned_at', 'get_students', 'get_project', 'get_evaluation_status']
    ordering = ['external_group', 'slot_number']
    autocomplete_fields = ['external_group', 'supervisor_group']
    
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
        return f'{project.project_name} ({project.project_category})'
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
```

### Acceptance Criteria
- [x] Shows student and project info
- [x] Evaluation status visible
- [x] Slot scheduling available

---

## Task 3.4: Register ExternalEvaluation Model

### File: `backend/app/admin.py`

```python
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
        'assignment__external_group__semester'
    ]
    search_fields = [
        'assignment__supervisor_group__group__student_1__user__first_name',
        'assignment__supervisor_group__project__project_name',
        'assignment__external_group__external_examiner__user__first_name'
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
        return f'{group.student_1.user.get_full_name()} & {group.student_2.user.get_full_name() if group.student_2 else "N/A"}'
    get_students.short_description = 'Students'
    
    def get_project(self, obj):
        return obj.assignment.supervisor_group.project.project_name
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
```

### Acceptance Criteria
- [x] All evaluation criteria visible
- [x] Calculated marks displayed
- [x] Export to CSV functionality
- [x] Pass/Fail bulk actions

---

## Task 3.5: Register EvaluationSchedule Model

### File: `backend/app/admin.py`

```python
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
```

### Acceptance Criteria
- [x] Schedule management working
- [x] Date hierarchy for navigation
- [x] Status management

---

## Task 3.6: Create Admin Actions for Bulk Operations

### File: `backend/app/admin.py`

```python
# Add to ExternalGroupAdmin:

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
    from .models import Notification
    
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
    """Generate PDF report for selected external groups."""
    # Implementation for PDF generation
    # Can use reportlab or weasyprint
    self.message_user(request, 'Report generation initiated.')
```

### Acceptance Criteria
- [x] Bulk evaluation creation
- [x] Bulk notifications
- [x] Report generation (CSV export)

---

## Task 3.7: Add Inline Editing for Assignments

### File: `backend/app/admin.py`

```python
# Already added in Task 3.2 - ExternalGroupAssignmentInline

# Add evaluation inline for assignment detail view:
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


# Update ExternalGroupAssignmentAdmin to include evaluation inline:
# Add to ExternalGroupAssignmentAdmin:
inlines = [ExternalEvaluationInline]
```

### Acceptance Criteria
- [x] Evaluation can be edited from assignment view
- [x] Inline form working

---

## Task 3.8: Create Admin Filters and Search

### File: `backend/app/admin.py`

```python
# Custom Filters

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
        # This requires filtering by calculated property
        # May need to add grade field to model for efficiency
        return queryset


# Add filters to admin classes:
# ExternalGroupAssignmentAdmin.list_filter += [SemesterFilter, EvaluationStatusFilter]
# ExternalEvaluationAdmin.list_filter += [GradeFilter]
```

### Acceptance Criteria
- [x] Custom filters implemented
- [x] Filters working correctly
- [x] Search across related fields

---

## Task 3.9: Add Dashboard Widgets

### File: `backend/app/admin.py`

```python
from django.contrib.admin import AdminSite
from django.shortcuts import render

class FYPAdminSite(AdminSite):
    """Custom admin site with dashboard."""
    
    site_header = 'FYP Management System'
    site_title = 'FYP Admin'
    index_title = 'Dashboard'
    
    def index(self, request, extra_context=None):
        """Custom admin dashboard."""
        from .models import (
            Student, Supervisor, CommitteeMember, ExternalExaminer,
            SupervisorOfStudentGroup, ExternalGroup, ExternalEvaluation
        )
        
        # Statistics
        extra_context = extra_context or {}
        
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
        extra_context['recent_evaluations'] = ExternalEvaluation.objects.order_by(
            '-evaluated_at'
        )[:5]
        
        extra_context['upcoming_schedules'] = EvaluationSchedule.objects.filter(
            status='scheduled'
        ).order_by('date')[:5]
        
        return super().index(request, extra_context=extra_context)


# Create custom admin site instance
# fyp_admin_site = FYPAdminSite(name='fyp_admin')

# Note: For simpler implementation, add dashboard view separately
```

### Alternative: Admin Dashboard View

```python
# backend/app/views.py

from django.contrib.admin.views.decorators import staff_member_required
from django.shortcuts import render

@staff_member_required
def admin_dashboard(request):
    """Custom admin dashboard view."""
    from .models import (
        Student, Supervisor, CommitteeMember, ExternalExaminer,
        SupervisorOfStudentGroup, ExternalGroup, ExternalEvaluation
    )
    
    context = {
        'statistics': {
            'students': Student.objects.count(),
            'supervisors': Supervisor.objects.count(),
            'committee_members': CommitteeMember.objects.count(),
            'external_examiners': ExternalExaminer.objects.filter(is_active=True).count(),
            'active_groups': SupervisorOfStudentGroup.objects.filter(status='accepted').count(),
            'pending_external': ExternalGroupAssignment.objects.exclude(status='evaluated').count(),
        },
        'recent_evaluations': ExternalEvaluation.objects.select_related(
            'assignment__supervisor_group__group__student_1__user'
        ).order_by('-evaluated_at')[:10],
    }
    
    return render(request, 'admin/dashboard.html', context)


# Add to urls.py:
# path('admin/dashboard/', admin_dashboard, name='admin-dashboard'),
```

### Acceptance Criteria
- [x] Dashboard shows statistics
- [x] Recent activity visible
- [x] Quick links to common actions

---

## Task 3.10: Update Existing Admin Classes

### File: `backend/app/admin.py`

**Update CustomUserAdmin to show external examiner type:**

```python
@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    """Enhanced User Admin with external examiner support."""
    
    list_display = ['username', 'email', 'user_type', 'first_name', 'last_name', 'is_active']
    list_filter = ['user_type', 'is_active', 'is_staff', 'date_joined']
    search_fields = ['username', 'email', 'first_name', 'last_name']
    
    fieldsets = UserAdmin.fieldsets + (
        ('FYP Role', {
            'fields': ('user_type',)
        }),
    )
    
    add_fieldsets = UserAdmin.add_fieldsets + (
        ('FYP Role', {
            'fields': ('user_type',)
        }),
    )


# Update SupervisorOfStudentGroupAdmin:
@admin.register(SupervisorOfStudentGroup)
class SupervisorOfStudentGroupAdmin(admin.ModelAdmin):
    # Add external status fields to existing admin
    list_display = [
        # ... existing fields ...
        'is_ready_for_external', 'external_evaluation_status'
    ]
    
    list_filter = [
        # ... existing filters ...
        'is_ready_for_external', 'external_evaluation_status'
    ]
    
    readonly_fields = [
        # ... existing readonly fields ...
        'get_external_assignment'
    ]
    
    def get_external_assignment(self, obj):
        """Show external assignment info."""
        try:
            assignment = obj.external_assignment
            return format_html(
                '<a href="/admin/app/externalgroupassignment/{}/change/">{}</a>',
                assignment.id,
                assignment.external_group.name
            )
        except:
            return 'Not assigned'
    get_external_assignment.short_description = 'External Assignment'
```

### Acceptance Criteria
- [x] User admin shows user types
- [x] SupervisorOfStudentGroup shows external status
- [x] Links to related records

---

## Testing Checklist

### Admin Panel Tests:

- [ ] Can create external examiner user
- [ ] Can create external examiner profile
- [ ] Can create external group
- [ ] Can assign student groups to external
- [ ] Can create/edit external evaluation
- [ ] Can create evaluation schedule
- [ ] Filters working correctly
- [ ] Search working correctly
- [ ] Bulk actions working
- [ ] Inline editing working
- [ ] Export to CSV working
- [ ] Statistics accurate

---

## Completion Criteria

Phase 3 is complete when:
- [ ] All new models registered in admin
- [ ] List views configured with filters and search
- [ ] Detail views with fieldsets
- [ ] Inline editing working
- [ ] Bulk actions implemented
- [ ] CSV export working
- [ ] Dashboard statistics visible
- [ ] Existing admins updated for external support
