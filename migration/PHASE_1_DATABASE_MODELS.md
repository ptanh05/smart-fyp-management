# Phase 1: Database & Models

## Objective
Add External Examiner support to the database by creating new models and updating existing ones.

---

## Task Summary

| Task ID | Task | Priority | Status |
|---------|------|----------|--------|
| 1.1 | Update CustomUser model | HIGH | ✅ Done |
| 1.2 | Create ExternalExaminer model | HIGH | ✅ Done |
| 1.3 | Create ExternalGroup model | HIGH | ✅ Done |
| 1.4 | Create ExternalGroupAssignment model | HIGH | ✅ Done |
| 1.5 | Create ExternalEvaluation model | HIGH | ✅ Done |
| 1.6 | Create EvaluationSchedule model | MEDIUM | ✅ Done |
| 1.7 | Update SupervisorOfStudentGroup model | MEDIUM | ✅ Done |
| 1.8 | Add semester tracking to Student model | MEDIUM | ✅ Done |
| 1.9 | Create and run migrations | HIGH | ✅ Done |
| 1.10 | Update model relationships | MEDIUM | ✅ Done |

---

## Task 1.1: Update CustomUser Model

### File: `backend/app/models.py`

**Current:**
```python
class CustomUser(AbstractUser):
    USER_TYPE_CHOICES = (
        ("student", "Student"),
        ("supervisor", "Supervisor"),
        ("committee_member", "Committee Member"),
    )
    user_type = models.CharField(max_length=50, choices=USER_TYPE_CHOICES)
```

**Updated:**
```python
class CustomUser(AbstractUser):
    USER_TYPE_CHOICES = (
        ("student", "Student"),
        ("supervisor", "Supervisor"),
        ("committee_member", "Committee Member"),
        ("external_examiner", "External Examiner"),  # NEW
    )
    user_type = models.CharField(max_length=50, choices=USER_TYPE_CHOICES)
```

### Acceptance Criteria
- [x] New user_type choice added
- [x] Existing users unaffected
- [ ] Admin can create external examiner users (verify after migration)

---

## Task 1.2: Create ExternalExaminer Model

### File: `backend/app/models.py`

**Add after CommitteeMember model:**

```python
class ExternalExaminer(models.Model):
    """
    External Examiner for 8th semester final project evaluation.
    External examiners are faculty/industry experts from outside the institution.
    """
    DESIGNATION_CHOICES = (
        ("professor", "Professor"),
        ("associate_professor", "Associate Professor"),
        ("assistant_professor", "Assistant Professor"),
        ("industry_expert", "Industry Expert"),
        ("visiting_faculty", "Visiting Faculty"),
    )
    
    user = models.OneToOneField(
        CustomUser,
        on_delete=models.CASCADE,
        related_name="external_examiner_profile"
    )
    external_id = models.CharField(max_length=50, unique=True)
    institution = models.CharField(max_length=200)  # External institution name
    designation = models.CharField(
        max_length=50,
        choices=DESIGNATION_CHOICES,
        default="professor"
    )
    specialization = models.CharField(max_length=200, blank=True, null=True)
    contact_number = models.CharField(max_length=20, blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = "External Examiner"
        verbose_name_plural = "External Examiners"
    
    def __str__(self):
        return f"{self.user.get_full_name()} - {self.institution}"
    
    @property
    def assigned_groups_count(self):
        """Count of student groups assigned to this external."""
        return self.external_groups.aggregate(
            total=models.Count('assignments')
        )['total'] or 0
```

### Acceptance Criteria
- [x] Model created with all required fields
- [x] OneToOne relationship with CustomUser
- [x] Proper Meta class defined
- [x] Helper properties implemented

---

## Task 1.3: Create ExternalGroup Model

### File: `backend/app/models.py`

**Purpose:** Groups multiple student groups under one external examiner for evaluation.

```python
class ExternalGroup(models.Model):
    """
    A grouping of student groups assigned to one external examiner.
    Example: External Examiner Dr. Khan is assigned 7 student groups.
    """
    STATUS_CHOICES = (
        ("pending", "Pending"),
        ("scheduled", "Scheduled"),
        ("in_progress", "In Progress"),
        ("completed", "Completed"),
    )
    
    name = models.CharField(max_length=100)  # e.g., "External Group A - Fall 2025"
    external_examiner = models.ForeignKey(
        ExternalExaminer,
        on_delete=models.CASCADE,
        related_name="external_groups"
    )
    semester = models.CharField(max_length=50)  # e.g., "Fall 2025", "Spring 2026"
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="pending"
    )
    max_groups = models.PositiveIntegerField(default=7)  # Max student groups per external
    evaluation_date = models.DateField(blank=True, null=True)
    evaluation_venue = models.CharField(max_length=200, blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_external_groups"
    )
    
    class Meta:
        verbose_name = "External Group"
        verbose_name_plural = "External Groups"
        ordering = ["-created_at"]
    
    def __str__(self):
        return f"{self.name} - {self.external_examiner.user.get_full_name()}"
    
    @property
    def assigned_count(self):
        """Number of student groups currently assigned."""
        return self.assignments.count()
    
    @property
    def is_full(self):
        """Check if maximum groups have been assigned."""
        return self.assigned_count >= self.max_groups
    
    @property
    def available_slots(self):
        """Number of slots available for assignment."""
        return max(0, self.max_groups - self.assigned_count)
```

### Acceptance Criteria
- [x] Model supports multiple student groups per external
- [x] Maximum group limit enforced
- [x] Status tracking implemented
- [x] Semester and scheduling fields present

---

## Task 1.4: Create ExternalGroupAssignment Model

### File: `backend/app/models.py`

**Purpose:** Links individual student groups (SupervisorOfStudentGroup) to an ExternalGroup.

```python
class ExternalGroupAssignment(models.Model):
    """
    Assignment of a student group to an external evaluation group.
    Links SupervisorOfStudentGroup to ExternalGroup.
    """
    STATUS_CHOICES = (
        ("assigned", "Assigned"),
        ("evaluated", "Evaluated"),
        ("absent", "Absent"),
    )
    
    external_group = models.ForeignKey(
        ExternalGroup,
        on_delete=models.CASCADE,
        related_name="assignments"
    )
    supervisor_group = models.OneToOneField(
        'SupervisorOfStudentGroup',
        on_delete=models.CASCADE,
        related_name="external_assignment"
    )
    slot_number = models.PositiveIntegerField(blank=True, null=True)  # Order in evaluation
    slot_time = models.TimeField(blank=True, null=True)  # Scheduled time
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="assigned"
    )
    assigned_at = models.DateTimeField(auto_now_add=True)
    assigned_by = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        related_name="external_assignments_created"
    )
    
    class Meta:
        verbose_name = "External Group Assignment"
        verbose_name_plural = "External Group Assignments"
        ordering = ["slot_number", "assigned_at"]
        unique_together = ("external_group", "supervisor_group")
    
    def __str__(self):
        students = self.supervisor_group.group
        return f"{students.student_1} & {students.student_2} → {self.external_group.name}"
    
    def save(self, *args, **kwargs):
        # Auto-assign slot number if not provided
        if self.slot_number is None:
            last_slot = ExternalGroupAssignment.objects.filter(
                external_group=self.external_group
            ).aggregate(models.Max('slot_number'))['slot_number__max']
            self.slot_number = (last_slot or 0) + 1
        super().save(*args, **kwargs)
```

### Acceptance Criteria
- [x] OneToOne link to SupervisorOfStudentGroup
- [x] Auto slot assignment working
- [x] Status tracking for evaluation progress
- [x] Unique constraint on external_group + supervisor_group

---

## Task 1.5: Create ExternalEvaluation Model

### File: `backend/app/models.py`

**Purpose:** Store external examiner's evaluation scores and feedback.

```python
class ExternalEvaluation(models.Model):
    """
    External Examiner's evaluation for a student group's final project.
    This is the 8th semester final viva evaluation.
    """
    STATUS_CHOICES = (
        ("pending", "Pending"),
        ("marginal", "Marginal"),
        ("adequate", "Adequate"),
        ("good", "Good"),
        ("excellent", "Excellent"),
    )
    
    assignment = models.OneToOneField(
        ExternalGroupAssignment,
        on_delete=models.CASCADE,
        related_name="evaluation"
    )
    
    # Evaluation Criteria (Total: 100 marks)
    # 1. Project Implementation (30 marks)
    project_completion = models.CharField(
        max_length=15,
        choices=STATUS_CHOICES,
        default="pending",
        help_text="Is the project fully implemented? (10 marks)"
    )
    code_quality = models.CharField(
        max_length=15,
        choices=STATUS_CHOICES,
        default="pending",
        help_text="Quality of code, architecture, best practices (10 marks)"
    )
    functionality = models.CharField(
        max_length=15,
        choices=STATUS_CHOICES,
        default="pending",
        help_text="Does the project work as expected? (10 marks)"
    )
    
    # 2. Technical Knowledge (25 marks)
    understanding_of_technology = models.CharField(
        max_length=15,
        choices=STATUS_CHOICES,
        default="pending",
        help_text="Understanding of technologies used (10 marks)"
    )
    problem_solving = models.CharField(
        max_length=15,
        choices=STATUS_CHOICES,
        default="pending",
        help_text="Ability to solve technical problems (10 marks)"
    )
    innovation = models.CharField(
        max_length=15,
        choices=STATUS_CHOICES,
        default="pending",
        help_text="Innovation and creativity in solution (5 marks)"
    )
    
    # 3. Presentation Skills (20 marks)
    presentation_clarity = models.CharField(
        max_length=15,
        choices=STATUS_CHOICES,
        default="pending",
        help_text="Clarity of presentation (10 marks)"
    )
    communication = models.CharField(
        max_length=15,
        choices=STATUS_CHOICES,
        default="pending",
        help_text="Communication skills (5 marks)"
    )
    time_management = models.CharField(
        max_length=15,
        choices=STATUS_CHOICES,
        default="pending",
        help_text="Presentation time management (5 marks)"
    )
    
    # 4. Documentation Quality (15 marks)
    documentation_completeness = models.CharField(
        max_length=15,
        choices=STATUS_CHOICES,
        default="pending",
        help_text="Is documentation complete? (8 marks)"
    )
    documentation_quality = models.CharField(
        max_length=15,
        choices=STATUS_CHOICES,
        default="pending",
        help_text="Quality of documentation (7 marks)"
    )
    
    # 5. Q&A Response (10 marks)
    qa_response = models.CharField(
        max_length=15,
        choices=STATUS_CHOICES,
        default="pending",
        help_text="Response to questions (10 marks)"
    )
    
    # Additional Fields
    overall_comment = models.TextField(blank=True, null=True)
    strengths = models.TextField(blank=True, null=True)
    areas_of_improvement = models.TextField(blank=True, null=True)
    is_pass = models.BooleanField(default=False)  # Pass/Fail decision
    
    evaluated_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "External Evaluation"
        verbose_name_plural = "External Evaluations"
    
    # Mark percentages mapping
    PERCENTAGES = {
        "pending": 0,
        "marginal": 20,
        "adequate": 50,
        "good": 75,
        "excellent": 95,
    }
    
    def _calculate_marks(self, field_value, max_marks):
        """Calculate marks based on status."""
        percentage = self.PERCENTAGES.get(field_value, 0)
        return (percentage / 100) * max_marks
    
    @property
    def project_implementation_marks(self):
        """Total marks for project implementation (30)"""
        return (
            self._calculate_marks(self.project_completion, 10) +
            self._calculate_marks(self.code_quality, 10) +
            self._calculate_marks(self.functionality, 10)
        )
    
    @property
    def technical_knowledge_marks(self):
        """Total marks for technical knowledge (25)"""
        return (
            self._calculate_marks(self.understanding_of_technology, 10) +
            self._calculate_marks(self.problem_solving, 10) +
            self._calculate_marks(self.innovation, 5)
        )
    
    @property
    def presentation_marks(self):
        """Total marks for presentation skills (20)"""
        return (
            self._calculate_marks(self.presentation_clarity, 10) +
            self._calculate_marks(self.communication, 5) +
            self._calculate_marks(self.time_management, 5)
        )
    
    @property
    def documentation_marks(self):
        """Total marks for documentation (15)"""
        return (
            self._calculate_marks(self.documentation_completeness, 8) +
            self._calculate_marks(self.documentation_quality, 7)
        )
    
    @property
    def qa_marks(self):
        """Total marks for Q&A (10)"""
        return self._calculate_marks(self.qa_response, 10)
    
    @property
    def total_marks(self):
        """Total marks out of 100"""
        return (
            self.project_implementation_marks +
            self.technical_knowledge_marks +
            self.presentation_marks +
            self.documentation_marks +
            self.qa_marks
        )
    
    @property
    def grade(self):
        """Calculate grade based on total marks"""
        marks = self.total_marks
        if marks >= 85:
            return "A"
        elif marks >= 75:
            return "B+"
        elif marks >= 65:
            return "B"
        elif marks >= 55:
            return "C+"
        elif marks >= 50:
            return "C"
        else:
            return "F"
    
    def __str__(self):
        return f"External Eval: {self.assignment} - {self.total_marks}/100"
```

### Acceptance Criteria
- [x] All evaluation criteria fields defined
- [x] Mark calculation properties working
- [x] Grade calculation implemented
- [x] Pass/Fail tracking available

---

## Task 1.6: Create EvaluationSchedule Model

### File: `backend/app/models.py`

**Purpose:** Schedule and track evaluation sessions.

```python
class EvaluationSchedule(models.Model):
    """
    Schedule for evaluation sessions (internal and external).
    """
    EVALUATION_TYPE_CHOICES = (
        ("scope", "Scope Document Evaluation"),
        ("srs", "SRS Evaluation"),
        ("sdd", "SDD Evaluation"),
        ("midterm", "Midterm Evaluation"),
        ("internal_final", "Internal Final Evaluation"),
        ("external_final", "External Final Evaluation"),
    )
    
    STATUS_CHOICES = (
        ("scheduled", "Scheduled"),
        ("in_progress", "In Progress"),
        ("completed", "Completed"),
        ("postponed", "Postponed"),
        ("cancelled", "Cancelled"),
    )
    
    title = models.CharField(max_length=200)
    evaluation_type = models.CharField(max_length=50, choices=EVALUATION_TYPE_CHOICES)
    semester = models.CharField(max_length=50)
    date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    venue = models.CharField(max_length=200)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="scheduled")
    
    # For external evaluations
    external_group = models.ForeignKey(
        ExternalGroup,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="schedules"
    )
    
    # For internal evaluations
    panel = models.ForeignKey(
        'CommitteeMemberPanel',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="schedules"
    )
    
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_schedules"
    )
    
    class Meta:
        verbose_name = "Evaluation Schedule"
        verbose_name_plural = "Evaluation Schedules"
        ordering = ["date", "start_time"]
    
    def __str__(self):
        return f"{self.title} - {self.date}"
```

### Acceptance Criteria
- [x] Schedule model supports both internal and external evaluations
- [x] Date/time/venue tracking
- [x] Status management

---

## Task 1.7: Update SupervisorOfStudentGroup Model

### File: `backend/app/models.py`

**Add field to track if group is ready for external evaluation:**

```python
# Add to SupervisorOfStudentGroup class:

# After evaluation4_committee_member field, add:
is_ready_for_external = models.BooleanField(
    default=False,
    help_text="Set to True when group has completed all internal evaluations"
)
external_evaluation_status = models.CharField(
    max_length=20,
    choices=(
        ("not_applicable", "Not Applicable"),
        ("pending_assignment", "Pending Assignment"),
        ("assigned", "Assigned to External"),
        ("evaluated", "Evaluated"),
    ),
    default="not_applicable"
)
```

### Acceptance Criteria
- [x] External readiness flag added
- [x] External evaluation status tracking
- [x] No breaking changes to existing functionality

---

## Task 1.8: Add Semester Tracking to Student Model

### File: `backend/app/models.py`

**Ensure semester field is properly utilized:**

```python
# Student model already has semester field. Update if needed:

class Student(models.Model):
    SEMESTER_CHOICES = (
        ("semester_6", "Semester 6"),
        ("semester_7", "Semester 7"),
        ("semester_8", "Semester 8"),
    )
    # ... existing fields ...
    
    @property
    def is_final_semester(self):
        """Check if student is in final (8th) semester."""
        return self.semester == "semester_8"
    
    @property
    def is_eligible_for_external(self):
        """Check if student is eligible for external evaluation."""
        return self.is_final_semester
```

### Acceptance Criteria
- [x] Helper properties added
- [x] Semester 8 students identifiable

---

## Task 1.9: Create and Run Migrations

### Commands:

```bash
cd backend

# Create migrations for new models
python manage.py makemigrations app --name add_external_examiner_models

# Review migration file before applying
# Check: backend/app/migrations/XXXX_add_external_examiner_models.py

# Apply migrations
python manage.py migrate

# Verify migration applied
python manage.py showmigrations app
```

### Migration File Should Include:
- [x] CreateModel: ExternalExaminer
- [x] CreateModel: ExternalGroup
- [x] CreateModel: ExternalGroupAssignment
- [x] CreateModel: ExternalEvaluation
- [x] CreateModel: EvaluationSchedule
- [x] AlterField: CustomUser.user_type (add new choice)
- [x] AddField: SupervisorOfStudentGroup.is_ready_for_external
- [x] AddField: SupervisorOfStudentGroup.external_evaluation_status

### Acceptance Criteria
- [x] All migrations created successfully
- [x] Migrations applied without errors
- [x] Database schema updated correctly
- [x] Existing data preserved

---

## Task 1.10: Update Model Relationships

### Verify All Relationships:

```python
# Relationship Map:

CustomUser
├── Student (OneToOne)
├── Supervisor (OneToOne)
├── CommitteeMember (OneToOne)
└── ExternalExaminer (OneToOne)  # NEW

ExternalExaminer
└── ExternalGroup (OneToMany)  # NEW

ExternalGroup
└── ExternalGroupAssignment (OneToMany)  # NEW

ExternalGroupAssignment
├── SupervisorOfStudentGroup (OneToOne)  # NEW link
└── ExternalEvaluation (OneToOne)  # NEW

SupervisorOfStudentGroup
├── existing evaluations...
└── ExternalGroupAssignment (OneToOne reverse)  # NEW
```

### Acceptance Criteria
- [x] All foreign keys properly defined
- [x] Related names accessible
- [x] No circular dependencies
- [x] Cascade deletes appropriate

---

## Testing Checklist

After completing all tasks:

- [ ] Create an external examiner user via Django shell
- [ ] Create an external group
- [ ] Assign a student group to external
- [ ] Create external evaluation record
- [ ] Verify all relationships work
- [ ] Test mark calculations
- [ ] Test grade calculation

### Test Commands:

```python
# Django shell tests
python manage.py shell

from app.models import *

# Create external examiner
user = CustomUser.objects.create_user(
    username='external1',
    password='external123',
    user_type='external_examiner'
)
external = ExternalExaminer.objects.create(
    user=user,
    external_id='EXT-001',
    institution='XYZ University',
    designation='professor'
)

# Create external group
ext_group = ExternalGroup.objects.create(
    name='External Group A - Spring 2026',
    external_examiner=external,
    semester='Spring 2026'
)

# Verify
print(f"External: {external}")
print(f"Group: {ext_group}")
print(f"Assigned groups: {external.assigned_groups_count}")
```

---

## Rollback Plan

If migration fails:

```bash
# Rollback to previous migration
python manage.py migrate app <previous_migration_name>

# Or reset all app migrations (CAUTION: loses data)
python manage.py migrate app zero
python manage.py migrate app
```

---

## Completion Criteria

Phase 1 is complete when:
- [ ] All new models created
- [ ] Migrations applied successfully
- [ ] Basic model tests pass
- [ ] No regressions in existing functionality
- [ ] Database backup taken before and after
