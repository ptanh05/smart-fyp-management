# Phase 6: Data Migration & Seeding

## Objective
Update the database seeder to include External Examiner data and migrate any existing data to the new structure.

---

## Task Summary

| Task ID | Task | Priority | Status |
|---------|------|----------|--------|
| 6.1 | Update seed_database.py | HIGH | ✅ Done |
| 6.2 | Create external examiner test data | HIGH | ☐ Pending |
| 6.3 | Create external groups test data | HIGH | ☐ Pending |
| 6.4 | Create sample assignments | MEDIUM | ☐ Pending |
| 6.5 | Create sample evaluations | MEDIUM | ☐ Pending |
| 6.6 | Create evaluation schedules | LOW | ☐ Pending |
| 6.7 | Update credentials output | HIGH | ☐ Pending |
| 6.8 | Create data migration script | MEDIUM | ✅ Done |

---

## Task 6.1: Update seed_database.py

### File: `backend/app/management/commands/seed_database.py`

Add new methods to the Command class:

```python
"""
Database seeder for FYP Management System
Creates dummy data for testing purposes
"""
from django.core.management.base import BaseCommand
from django.contrib.auth.hashers import make_password
from django.utils import timezone
from datetime import date, time, timedelta
from app.models import (
    CustomUser,
    Student,
    Supervisor,
    CommitteeMember,
    CommitteeMemberPanel,
    ProjectCategories,
    Group,
    Project,
    SupervisorOfStudentGroup,
    Notification,
    NotificationPreference,
    # NEW: External Examiner models
    ExternalExaminer,
    ExternalGroup,
    ExternalGroupAssignment,
    ExternalEvaluation,
    EvaluationSchedule,
)


class Command(BaseCommand):
    help = "Seeds the database with dummy data for testing"

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING("Starting database seeding..."))

        # Clear existing data
        self.stdout.write("Clearing existing data...")
        self.clear_data()

        # Create data
        self.create_superuser()
        categories = self.create_project_categories()
        panels = self.create_committee_panels()
        students = self.create_students()
        supervisors = self.create_supervisors(categories)
        committee_members = self.create_committee_members(panels)
        
        # NEW: Create external examiners
        external_examiners = self.create_external_examiners()
        
        groups = self.create_groups(students, categories)
        projects = self.create_projects(categories)
        supervisor_groups = self.create_supervisor_student_groups(
            groups, supervisors, projects, students
        )
        
        # NEW: Create external groups and assignments
        external_groups = self.create_external_groups(external_examiners)
        self.create_external_assignments(external_groups, supervisor_groups)
        self.create_sample_external_evaluations()
        self.create_evaluation_schedules(external_groups, panels)

        self.stdout.write(self.style.SUCCESS("\n" + "=" * 60))
        self.stdout.write(self.style.SUCCESS("DATABASE SEEDING COMPLETED SUCCESSFULLY!"))
        self.stdout.write(self.style.SUCCESS("=" * 60))
        self.print_credentials()

    def clear_data(self):
        """Clear all existing data."""
        # NEW: Clear external data first (due to foreign keys)
        ExternalEvaluation.objects.all().delete()
        ExternalGroupAssignment.objects.all().delete()
        ExternalGroup.objects.all().delete()
        ExternalExaminer.objects.all().delete()
        EvaluationSchedule.objects.all().delete()
        
        # Existing clear operations...
        Notification.objects.all().delete()
        NotificationPreference.objects.all().delete()
        SupervisorOfStudentGroup.objects.all().delete()
        Project.objects.all().delete()
        Group.objects.all().delete()
        CommitteeMember.objects.all().delete()
        CommitteeMemberPanel.objects.all().delete()
        Supervisor.objects.all().delete()
        Student.objects.all().delete()
        ProjectCategories.objects.all().delete()
        CustomUser.objects.filter(is_superuser=False).delete()
        self.stdout.write("  [OK] Data cleared")

    # ... existing methods ...

    def create_external_examiners(self):
        """Create external examiner accounts."""
        self.stdout.write("Creating external examiners...")
        
        external_data = [
            {
                'username': 'external1',
                'email': 'external1@external.edu',
                'first_name': 'Dr. Ahmad',
                'last_name': 'Malik',
                'external_id': 'EXT-2026-001',
                'institution': 'Punjab University',
                'designation': 'professor',
                'specialization': 'Software Engineering',
                'contact_number': '+92-300-1234567',
            },
            {
                'username': 'external2',
                'email': 'external2@external.edu',
                'first_name': 'Dr. Fatima',
                'last_name': 'Khan',
                'external_id': 'EXT-2026-002',
                'institution': 'NUST',
                'designation': 'associate_professor',
                'specialization': 'Artificial Intelligence',
                'contact_number': '+92-300-2345678',
            },
            {
                'username': 'external3',
                'email': 'external3@industry.com',
                'first_name': 'Muhammad',
                'last_name': 'Ali',
                'external_id': 'EXT-2026-003',
                'institution': 'Tech Solutions Pvt Ltd',
                'designation': 'industry_expert',
                'specialization': 'Web Development',
                'contact_number': '+92-300-3456789',
            },
            {
                'username': 'external4',
                'email': 'external4@external.edu',
                'first_name': 'Dr. Sara',
                'last_name': 'Ahmed',
                'external_id': 'EXT-2026-004',
                'institution': 'FAST NUCES',
                'designation': 'assistant_professor',
                'specialization': 'Data Science',
                'contact_number': '+92-300-4567890',
            },
        ]
        
        external_examiners = []
        for data in external_data:
            user = CustomUser.objects.create(
                username=data['username'],
                email=data['email'],
                password=make_password('external123'),
                first_name=data['first_name'],
                last_name=data['last_name'],
                user_type='external_examiner',
            )
            
            external = ExternalExaminer.objects.create(
                user=user,
                external_id=data['external_id'],
                institution=data['institution'],
                designation=data['designation'],
                specialization=data['specialization'],
                contact_number=data['contact_number'],
                is_active=True,
            )
            external_examiners.append(external)
            self.stdout.write(f"  [OK] Created external examiner: {data['username']}")
        
        return external_examiners

    def create_external_groups(self, external_examiners):
        """Create external groups for each examiner."""
        self.stdout.write("Creating external groups...")
        
        external_groups = []
        semester = 'Spring 2026'
        base_date = date.today() + timedelta(days=30)  # Evaluation in 30 days
        
        for i, external in enumerate(external_examiners):
            group = ExternalGroup.objects.create(
                name=f'External Group {chr(65 + i)} - {semester}',
                external_examiner=external,
                semester=semester,
                status='scheduled',
                max_groups=7,
                evaluation_date=base_date + timedelta(days=i),
                evaluation_venue=f'Room {101 + i}, FYP Lab',
                notes=f'External evaluation group for {external.user.get_full_name()}',
            )
            external_groups.append(group)
            self.stdout.write(f"  [OK] Created external group: {group.name}")
        
        return external_groups

    def create_external_assignments(self, external_groups, supervisor_groups):
        """Assign student groups to external examiners."""
        self.stdout.write("Creating external assignments...")
        
        # Filter groups that are ready for external evaluation
        eligible_groups = [
            sg for sg in supervisor_groups 
            if sg.status == 'accepted'
        ]
        
        # Distribute groups among externals
        assignments_created = 0
        for i, supervisor_group in enumerate(eligible_groups):
            external_group = external_groups[i % len(external_groups)]
            
            # Check if external group has capacity
            if external_group.assigned_count < external_group.max_groups:
                # Mark group as ready for external
                supervisor_group.is_ready_for_external = True
                supervisor_group.external_evaluation_status = 'assigned'
                supervisor_group.save()
                
                # Create assignment
                slot_number = external_group.assigned_count + 1
                slot_time = time(9 + slot_number - 1, 0)  # 9 AM, 10 AM, etc.
                
                ExternalGroupAssignment.objects.create(
                    external_group=external_group,
                    supervisor_group=supervisor_group,
                    slot_number=slot_number,
                    slot_time=slot_time,
                    status='assigned',
                )
                assignments_created += 1
        
        self.stdout.write(f"  [OK] Created {assignments_created} external assignments")

    def create_sample_external_evaluations(self):
        """Create sample external evaluations for some assignments."""
        self.stdout.write("Creating sample external evaluations...")
        
        # Get first few assignments and create evaluations
        assignments = ExternalGroupAssignment.objects.all()[:2]  # First 2 only
        
        sample_ratings = [
            # Evaluation 1: Good student
            {
                'project_completion': 'good',
                'code_quality': 'good',
                'functionality': 'excellent',
                'understanding_of_technology': 'good',
                'problem_solving': 'good',
                'innovation': 'adequate',
                'presentation_clarity': 'excellent',
                'communication': 'good',
                'time_management': 'good',
                'documentation_completeness': 'good',
                'documentation_quality': 'adequate',
                'qa_response': 'good',
                'overall_comment': 'Good project with solid implementation.',
                'strengths': 'Strong technical implementation and presentation.',
                'areas_of_improvement': 'Documentation could be more detailed.',
                'is_pass': True,
            },
            # Evaluation 2: Excellent student
            {
                'project_completion': 'excellent',
                'code_quality': 'excellent',
                'functionality': 'excellent',
                'understanding_of_technology': 'excellent',
                'problem_solving': 'good',
                'innovation': 'excellent',
                'presentation_clarity': 'excellent',
                'communication': 'excellent',
                'time_management': 'good',
                'documentation_completeness': 'excellent',
                'documentation_quality': 'good',
                'qa_response': 'excellent',
                'overall_comment': 'Outstanding project with innovative approach.',
                'strengths': 'Excellent innovation and technical depth.',
                'areas_of_improvement': 'Minor improvements in time management.',
                'is_pass': True,
            },
        ]
        
        for i, assignment in enumerate(assignments):
            if i < len(sample_ratings):
                rating = sample_ratings[i]
                ExternalEvaluation.objects.create(
                    assignment=assignment,
                    **rating,
                    evaluated_at=timezone.now(),
                )
                
                # Update assignment status
                assignment.status = 'evaluated'
                assignment.save()
                
                # Update supervisor group status
                assignment.supervisor_group.external_evaluation_status = 'evaluated'
                assignment.supervisor_group.save()
                
        self.stdout.write(f"  [OK] Created {len(assignments)} sample evaluations")

    def create_evaluation_schedules(self, external_groups, panels):
        """Create evaluation schedules."""
        self.stdout.write("Creating evaluation schedules...")
        
        semester = 'Spring 2026'
        base_date = date.today() + timedelta(days=30)
        
        # Create external evaluation schedules
        for i, ext_group in enumerate(external_groups):
            EvaluationSchedule.objects.create(
                title=f'External Evaluation - {ext_group.name}',
                evaluation_type='external_final',
                semester=semester,
                date=ext_group.evaluation_date or (base_date + timedelta(days=i)),
                start_time=time(9, 0),
                end_time=time(17, 0),
                venue=ext_group.evaluation_venue or f'Room {101 + i}',
                status='scheduled',
                external_group=ext_group,
            )
        
        # Create internal evaluation schedules
        for j, panel in enumerate(panels):
            # Midterm
            EvaluationSchedule.objects.create(
                title=f'Midterm Evaluation - {panel.panel_name}',
                evaluation_type='midterm',
                semester=semester,
                date=base_date - timedelta(days=60),
                start_time=time(9, 0),
                end_time=time(13, 0),
                venue=f'Seminar Hall {j + 1}',
                status='completed',
                panel=panel,
            )
            
            # Internal Final
            EvaluationSchedule.objects.create(
                title=f'Internal Final - {panel.panel_name}',
                evaluation_type='internal_final',
                semester=semester,
                date=base_date - timedelta(days=7),
                start_time=time(9, 0),
                end_time=time(17, 0),
                venue=f'FYP Lab {j + 1}',
                status='scheduled',
                panel=panel,
            )
        
        self.stdout.write(f"  [OK] Created evaluation schedules")

    def print_credentials(self):
        """Print all test credentials."""
        self.stdout.write("\n")
        self.stdout.write("=" * 70)
        self.stdout.write(" TEST CREDENTIALS")
        self.stdout.write("=" * 70)
        
        # Admin
        self.stdout.write("\n[ADMIN]")
        self.stdout.write("-" * 40)
        self.stdout.write("| Username: admin")
        self.stdout.write("| Password: admin123")
        self.stdout.write("| URL: /admin/")
        self.stdout.write("-" * 40)
        
        # Students
        self.stdout.write("\n[STUDENTS]")
        self.stdout.write("-" * 40)
        for i in range(1, 7):
            self.stdout.write(f"| student{i} / student123")
        self.stdout.write("-" * 40)
        
        # Supervisors
        self.stdout.write("\n[SUPERVISORS]")
        self.stdout.write("-" * 40)
        for i in range(1, 4):
            self.stdout.write(f"| supervisor{i} / supervisor123")
        self.stdout.write("-" * 40)
        
        # Committee Members
        self.stdout.write("\n[COMMITTEE MEMBERS]")
        self.stdout.write("-" * 40)
        for i in range(1, 4):
            self.stdout.write(f"| committee{i} / committee123")
        self.stdout.write("-" * 40)
        
        # External Examiners (NEW)
        self.stdout.write("\n[EXTERNAL EXAMINERS]")
        self.stdout.write("-" * 40)
        self.stdout.write("| external1 / external123 (Dr. Ahmad Malik - Punjab University)")
        self.stdout.write("| external2 / external123 (Dr. Fatima Khan - NUST)")
        self.stdout.write("| external3 / external123 (Muhammad Ali - Tech Solutions)")
        self.stdout.write("| external4 / external123 (Dr. Sara Ahmed - FAST NUCES)")
        self.stdout.write("-" * 40)
        
        self.stdout.write("\n[FRONTEND URL]")
        self.stdout.write("-" * 40)
        self.stdout.write("| http://localhost:3000")
        self.stdout.write("-" * 40)
        
        self.stdout.write("\n")
```

### Acceptance Criteria
- [x] Seed script updated with external data
- [x] All relationships created correctly
- [x] Sample evaluations created
- [x] Credentials printed correctly

---

## Task 6.2-6.6: Test Data Creation

These are handled within the updated seed script above.

---

## Task 6.7: Update Credentials Output

Ensure the credentials output includes:

```
================================================================================
                              TEST CREDENTIALS
================================================================================

[ADMIN]
----------------------------------------
| Username: admin
| Password: admin123
| URL: /admin/
----------------------------------------

[STUDENTS] (6 students in 3 groups)
----------------------------------------
| student1 / student123 - Ahmed Khan (2021-CS-001) - Group with student2
| student2 / student123 - Fatima Ali (2021-CS-002) - Group with student1
| student3 / student123 - Usman Ahmed (2021-CS-003) - Group with student4
| student4 / student123 - Ayesha Malik (2021-CS-004) - Group with student3
| student5 / student123 - Hassan Raza (2021-CS-005) - Group with student6
| student6 / student123 - Zainab Shah (2021-CS-006) - Group with student5
----------------------------------------

[SUPERVISORS] (3 supervisors)
----------------------------------------
| supervisor1 / supervisor123 - Dr. Muhammad Imran (Web Development)
| supervisor2 / supervisor123 - Dr. Saira Khan (AI/ML)
| supervisor3 / supervisor123 - Dr. Ali Hassan (Mobile Development)
----------------------------------------

[COMMITTEE MEMBERS] (3 members in 3 panels)
----------------------------------------
| committee1 / committee123 - Dr. Asim Mahmood (Panel A)
| committee2 / committee123 - Dr. Hina Farooq (Panel B)
| committee3 / committee123 - Dr. Kamran Malik (Panel C)
----------------------------------------

[EXTERNAL EXAMINERS] (4 examiners) *NEW*
----------------------------------------
| external1 / external123 - Dr. Ahmad Malik (Punjab University)
| external2 / external123 - Dr. Fatima Khan (NUST)
| external3 / external123 - Muhammad Ali (Tech Solutions - Industry)
| external4 / external123 - Dr. Sara Ahmed (FAST NUCES)
----------------------------------------

[TEST DATA SUMMARY]
----------------------------------------
| Groups: 3 (all with accepted supervisors)
| External Groups: 4 (7 slots each)
| Sample Evaluations: 2 completed
| Schedules: 12 (internal + external)
----------------------------------------

[URLS]
----------------------------------------
| Frontend: http://localhost:3000
| Backend API: http://localhost:8000/api/
| Admin Panel: http://localhost:8000/admin/
----------------------------------------
```

---

## Task 6.8: Create Data Migration Script

### File: `backend/app/management/commands/migrate_external_data.py`

For existing deployments, create a migration script:

```python
"""
Data migration script for adding external evaluation support to existing data.
Run this after applying the new model migrations.
"""
from django.core.management.base import BaseCommand
from django.db import transaction
from app.models import (
    SupervisorOfStudentGroup,
    Student,
)


class Command(BaseCommand):
    help = "Migrates existing data for external evaluation support"

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Run migration without making changes',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        
        self.stdout.write(self.style.WARNING(
            f"Starting data migration {'(DRY RUN)' if dry_run else ''}..."
        ))
        
        with transaction.atomic():
            # 1. Update all 8th semester students' groups for external readiness
            self.update_external_readiness(dry_run)
            
            # 2. Set default external_evaluation_status
            self.set_default_external_status(dry_run)
            
            if dry_run:
                self.stdout.write(self.style.WARNING(
                    "\nDRY RUN complete. No changes made."
                ))
                # Rollback by raising exception in dry run
                raise Exception("Dry run rollback")
        
        self.stdout.write(self.style.SUCCESS("\nMigration completed successfully!"))

    def update_external_readiness(self, dry_run):
        """
        Mark groups as ready for external if they have completed internal evaluations.
        """
        self.stdout.write("Updating external readiness flags...")
        
        # Find all accepted supervisor groups with 8th semester students
        groups = SupervisorOfStudentGroup.objects.filter(
            status='accepted'
        ).select_related('group__student_1', 'group__student_2')
        
        updated = 0
        for group in groups:
            # Check if any student is in 8th semester
            is_8th_semester = (
                (group.group.student_1 and 
                 group.group.student_1.semester == 'semester_8') or
                (group.group.student_2 and 
                 group.group.student_2.semester == 'semester_8')
            )
            
            # Check if internal evaluations are complete
            has_eval4 = (
                group.evaluation4_supervisor is not None and
                group.evaluation4_committee_member is not None
            )
            
            if is_8th_semester and has_eval4:
                if not dry_run:
                    group.is_ready_for_external = True
                    group.save(update_fields=['is_ready_for_external'])
                updated += 1
        
        self.stdout.write(f"  {'Would update' if dry_run else 'Updated'} {updated} groups")

    def set_default_external_status(self, dry_run):
        """
        Set default external_evaluation_status for all groups.
        """
        self.stdout.write("Setting default external evaluation status...")
        
        # Groups not ready for external
        not_ready = SupervisorOfStudentGroup.objects.filter(
            is_ready_for_external=False
        )
        count_not_applicable = not_ready.count()
        
        if not dry_run:
            not_ready.update(external_evaluation_status='not_applicable')
        
        # Groups ready but not assigned
        ready_not_assigned = SupervisorOfStudentGroup.objects.filter(
            is_ready_for_external=True,
            external_assignment__isnull=True
        )
        count_pending = ready_not_assigned.count()
        
        if not dry_run:
            ready_not_assigned.update(external_evaluation_status='pending_assignment')
        
        self.stdout.write(
            f"  {'Would set' if dry_run else 'Set'} {count_not_applicable} as not_applicable"
        )
        self.stdout.write(
            f"  {'Would set' if dry_run else 'Set'} {count_pending} as pending_assignment"
        )
```

### Running Migration

```bash
# First, dry run to see what will change
python manage.py migrate_external_data --dry-run

# Then run for real
python manage.py migrate_external_data
```

---

## Running the Complete Seeder

```bash
cd backend

# Activate virtual environment
.venv\Scripts\activate  # Windows
source .venv/bin/activate  # Linux/Mac

# Run seeder
python manage.py seed_database
```

---

## Verification Steps

After seeding, verify:

1. **Admin Panel Check:**
   - Login to `/admin/`
   - Verify External Examiners exist (4 records)
   - Verify External Groups exist (4 records)
   - Verify Assignments exist
   - Verify Evaluations exist (2 records)

2. **API Check:**
   ```bash
   # Get token for external examiner
   curl -X POST http://localhost:8000/api/token/ \
     -H "Content-Type: application/json" \
     -d '{"username": "external1", "password": "external123"}'
   
   # Get dashboard
   curl http://localhost:8000/api/external/dashboard/ \
     -H "Authorization: Bearer <token>"
   ```

3. **Frontend Check:**
   - Login as `external1` / `external123`
   - Verify dashboard loads
   - Verify statistics are correct
   - Verify groups are visible

---

## Completion Criteria

Phase 6 is complete when:
- [ ] Seed script updated with all external data
- [ ] External examiners created (4 records)
- [ ] External groups created (4 records)
- [ ] Assignments distributed correctly
- [ ] Sample evaluations created (2 records)
- [ ] Evaluation schedules created
- [ ] Credentials printed correctly
- [ ] Data migration script tested
- [ ] All verification steps pass
- [ ] Documentation updated with new credentials
