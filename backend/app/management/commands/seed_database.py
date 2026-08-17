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
    # External Examiner models
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
        
        # Clear existing data (optional - comment out if you want to keep existing data)
        self.stdout.write("Clearing existing data...")
        self.clear_data()
        
        # Create data
        self.create_superuser()
        categories = self.create_project_categories()
        panels = self.create_committee_panels()
        students = self.create_students()
        supervisors = self.create_supervisors(categories)
        committee_members = self.create_committee_members(panels)
        groups = self.create_groups(students, categories)
        projects = self.create_projects(categories)
        supervisor_groups = self.create_supervisor_student_groups(groups, supervisors, projects, students)
        
        # Create External Examiner data
        external_examiners = self.create_external_examiners()
        external_groups = self.create_external_groups(external_examiners)
        self.create_external_assignments(external_groups, supervisor_groups)
        self.create_sample_external_evaluations()
        self.create_evaluation_schedules(external_groups, panels)
        
        self.stdout.write(self.style.SUCCESS("\n" + "=" * 60))
        self.stdout.write(self.style.SUCCESS("DATABASE SEEDING COMPLETED SUCCESSFULLY!"))
        self.stdout.write(self.style.SUCCESS("=" * 60))
        self.print_credentials()

    def clear_data(self):
        """Clear existing data from the database"""
        # Clear external data first (due to foreign key dependencies)
        ExternalEvaluation.objects.all().delete()
        ExternalGroupAssignment.objects.all().delete()
        ExternalGroup.objects.all().delete()
        ExternalExaminer.objects.all().delete()
        EvaluationSchedule.objects.all().delete()
        
        # Clear existing data
        SupervisorOfStudentGroup.objects.all().delete()
        Project.objects.all().delete()
        Group.objects.all().delete()
        CommitteeMember.objects.all().delete()
        Supervisor.objects.all().delete()
        Student.objects.all().delete()
        CustomUser.objects.filter(is_superuser=False).delete()
        CommitteeMemberPanel.objects.all().delete()
        ProjectCategories.objects.all().delete()
        Notification.objects.all().delete()
        NotificationPreference.objects.all().delete()
        self.stdout.write(self.style.SUCCESS("  [OK] Cleared existing data"))

    def create_superuser(self):
        """Create admin superuser"""
        if not CustomUser.objects.filter(username="admin").exists():
            CustomUser.objects.create_superuser(
                username="admin",
                email="admin@fyp.com",
                password="admin123",
                first_name="Admin",
                last_name="User",
                user_type="supervisor"
            )
            self.stdout.write(self.style.SUCCESS("  [OK] Created superuser: admin"))
        else:
            self.stdout.write(self.style.WARNING("  - Superuser 'admin' already exists"))

    def create_project_categories(self):
        """Create project categories"""
        categories_data = [
            "Web Development",
            "Mobile Application",
            "Machine Learning / AI",
            "Data Science",
            "IoT / Embedded Systems",
            "Blockchain",
            "Game Development",
            "Cybersecurity",
            "Cloud Computing",
            "Software Engineering",
        ]
        
        categories = []
        for name in categories_data:
            cat, created = ProjectCategories.objects.get_or_create(category_name=name)
            categories.append(cat)
        
        self.stdout.write(self.style.SUCCESS(f"  [OK] Created {len(categories)} project categories"))
        return categories

    def create_committee_panels(self):
        """Create committee member panels"""
        panels_data = ["Panel A", "Panel B", "Panel C"]
        
        panels = []
        for name in panels_data:
            panel, created = CommitteeMemberPanel.objects.get_or_create(name=name)
            panels.append(panel)
        
        self.stdout.write(self.style.SUCCESS(f"  [OK] Created {len(panels)} committee panels"))
        return panels

    def create_students(self):
        """Create student users"""
        students_data = [
            # (username, email, first_name, last_name, reg_no, department, semester, batch)
            ("student1", "student1@fyp.com", "Ahmed", "Khan", "2021-CS-001", "Computer Science", "semester_7", "2021"),
            ("student2", "student2@fyp.com", "Sara", "Ali", "2021-CS-002", "Computer Science", "semester_7", "2021"),
            ("student3", "student3@fyp.com", "Muhammad", "Hassan", "2021-CS-003", "Computer Science", "semester_7", "2021"),
            ("student4", "student4@fyp.com", "Fatima", "Ahmed", "2021-CS-004", "Computer Science", "semester_7", "2021"),
            ("student5", "student5@fyp.com", "Ali", "Raza", "2021-CS-005", "Computer Science", "semester_7", "2021"),
            ("student6", "student6@fyp.com", "Ayesha", "Malik", "2021-CS-006", "Computer Science", "semester_7", "2021"),
            ("student7", "student7@fyp.com", "Usman", "Shah", "2021-SE-001", "Software Engineering", "semester_7", "2021"),
            ("student8", "student8@fyp.com", "Zainab", "Tariq", "2021-SE-002", "Software Engineering", "semester_7", "2021"),
            ("student9", "student9@fyp.com", "Bilal", "Iqbal", "2020-CS-010", "Computer Science", "semester_8", "2020"),
            ("student10", "student10@fyp.com", "Hira", "Noor", "2020-CS-011", "Computer Science", "semester_8", "2020"),
        ]
        
        students = []
        for username, email, first_name, last_name, reg_no, dept, semester, batch in students_data:
            user, created = CustomUser.objects.get_or_create(
                username=username,
                defaults={
                    "email": email,
                    "first_name": first_name,
                    "last_name": last_name,
                    "password": make_password("student123"),
                    "user_type": "student",
                }
            )
            
            student, created = Student.objects.get_or_create(
                user=user,
                defaults={
                    "registration_no": reg_no,
                    "department": dept,
                    "semester": semester,
                    "batch_no": batch,
                }
            )
            students.append(student)
            
            # Create notification preferences
            NotificationPreference.objects.get_or_create(user=user)
        
        self.stdout.write(self.style.SUCCESS(f"  [OK] Created {len(students)} students"))
        return students

    def create_supervisors(self, categories):
        """Create supervisor users"""
        supervisors_data = [
            # (username, email, first_name, last_name, sup_id, research, academic, category_indices)
            ("supervisor1", "supervisor1@fyp.com", "Dr. Imran", "Ahmed", "SUP-001", 
             "Machine Learning, Deep Learning", "PhD Computer Science", [0, 2, 3]),
            ("supervisor2", "supervisor2@fyp.com", "Dr. Sana", "Malik", "SUP-002", 
             "Web Technologies, Cloud Computing", "PhD Software Engineering", [0, 8, 9]),
            ("supervisor3", "supervisor3@fyp.com", "Dr. Asad", "Khan", "SUP-003", 
             "Mobile Development, IoT", "PhD Information Technology", [1, 4]),
            ("supervisor4", "supervisor4@fyp.com", "Dr. Nadia", "Hassan", "SUP-004", 
             "Cybersecurity, Blockchain", "PhD Computer Science", [5, 7]),
            ("supervisor5", "supervisor5@fyp.com", "Dr. Farhan", "Ali", "SUP-005", 
             "Game Development, Graphics", "PhD Computer Science", [6, 9]),
        ]
        
        supervisors = []
        for username, email, first_name, last_name, sup_id, research, academic, cat_indices in supervisors_data:
            user, created = CustomUser.objects.get_or_create(
                username=username,
                defaults={
                    "email": email,
                    "first_name": first_name,
                    "last_name": last_name,
                    "password": make_password("supervisor123"),
                    "user_type": "supervisor",
                }
            )
            
            supervisor, created = Supervisor.objects.get_or_create(
                user=user,
                defaults={
                    "supervisor_id": sup_id,
                    "research_interest": research,
                    "academic_background": academic,
                }
            )
            
            # Add categories
            for idx in cat_indices:
                if idx < len(categories):
                    supervisor.category.add(categories[idx])
            
            supervisors.append(supervisor)
            
            # Create notification preferences
            NotificationPreference.objects.get_or_create(user=user)
        
        self.stdout.write(self.style.SUCCESS(f"  [OK] Created {len(supervisors)} supervisors"))
        return supervisors

    def create_committee_members(self, panels):
        """Create committee member users"""
        committee_data = [
            # (username, email, first_name, last_name, committee_id, panel_index)
            ("committee1", "committee1@fyp.com", "Prof. Adnan", "Siddiqui", "CM-001", 0),
            ("committee2", "committee2@fyp.com", "Prof. Rabia", "Qureshi", "CM-002", 0),
            ("committee3", "committee3@fyp.com", "Prof. Kashif", "Mahmood", "CM-003", 1),
            ("committee4", "committee4@fyp.com", "Prof. Amna", "Batool", "CM-004", 1),
            ("committee5", "committee5@fyp.com", "Prof. Zahid", "Hussain", "CM-005", 2),
            ("committee6", "committee6@fyp.com", "Prof. Saima", "Nawaz", "CM-006", 2),
        ]
        
        committee_members = []
        for username, email, first_name, last_name, cm_id, panel_idx in committee_data:
            user, created = CustomUser.objects.get_or_create(
                username=username,
                defaults={
                    "email": email,
                    "first_name": first_name,
                    "last_name": last_name,
                    "password": make_password("committee123"),
                    "user_type": "committee_member",
                }
            )
            
            cm, created = CommitteeMember.objects.get_or_create(
                user=user,
                defaults={
                    "committee_id": cm_id,
                    "panel": panels[panel_idx],
                }
            )
            committee_members.append(cm)
            
            # Create notification preferences
            NotificationPreference.objects.get_or_create(user=user)
        
        self.stdout.write(self.style.SUCCESS(f"  [OK] Created {len(committee_members)} committee members"))
        return committee_members

    def create_groups(self, students, categories):
        """Create student groups"""
        groups_data = [
            # (student1_idx, student2_idx, category_idx, status)
            (0, 1, 0, "accepted"),   # Ahmed & Sara - Web Dev
            (2, 3, 2, "accepted"),   # Muhammad & Fatima - ML/AI
            (4, 5, 1, "accepted"),   # Ali & Ayesha - Mobile App
            (6, 7, 9, "accepted"),   # Usman & Zainab - Software Engineering
            (8, 9, 3, "pending"),    # Bilal & Hira - Data Science (pending)
        ]
        
        groups = []
        for s1_idx, s2_idx, cat_idx, status in groups_data:
            group, created = Group.objects.get_or_create(
                student_1=students[s1_idx],
                student_2=students[s2_idx],
                defaults={
                    "project_category": categories[cat_idx],
                    "status": status,
                }
            )
            groups.append(group)
        
        self.stdout.write(self.style.SUCCESS(f"  [OK] Created {len(groups)} student groups"))
        return groups

    def create_projects(self, categories):
        """Create projects"""
        projects_data = [
            # (name, description, language, functionalities, category_idx)
            (
                "Smart Campus Portal",
                "A comprehensive web-based portal for university campus management including attendance, grades, and announcements.",
                "Python, JavaScript, React",
                "User Authentication, Dashboard, Attendance Tracking, Grade Management, Announcements, Notifications",
                0  # Web Development
            ),
            (
                "AI-Powered Plagiarism Detector",
                "Machine learning based system to detect plagiarism in academic documents using NLP techniques.",
                "Python, TensorFlow, Flask",
                "Document Upload, Text Analysis, Similarity Detection, Report Generation, Admin Panel",
                2  # ML/AI
            ),
            (
                "FYP Management Mobile App",
                "Cross-platform mobile application for managing Final Year Projects with supervisor communication.",
                "React Native, Node.js",
                "Project Submission, Supervisor Chat, Document Upload, Progress Tracking, Push Notifications",
                1  # Mobile App
            ),
            (
                "Automated Testing Framework",
                "A software engineering tool for automated testing of web applications with CI/CD integration.",
                "Python, Selenium, Docker",
                "Test Case Management, Automated Execution, Report Generation, CI/CD Integration, Dashboard",
                9  # Software Engineering
            ),
            (
                "Data Analytics Dashboard",
                "Interactive dashboard for visualizing and analyzing large datasets with predictive capabilities.",
                "Python, D3.js, PostgreSQL",
                "Data Import, Visualization, Statistical Analysis, Predictive Models, Export Reports",
                3  # Data Science
            ),
        ]
        
        projects = []
        for name, desc, lang, func, cat_idx in projects_data:
            project, created = Project.objects.get_or_create(
                project_name=name,
                defaults={
                    "project_description": desc,
                    "language": lang,
                    "functionalities": func,
                    "project_category": categories[cat_idx],
                }
            )
            projects.append(project)
        
        self.stdout.write(self.style.SUCCESS(f"  [OK] Created {len(projects)} projects"))
        return projects

    def create_supervisor_student_groups(self, groups, supervisors, projects, students):
        """Create supervisor-student group relationships"""
        # Only create for accepted groups
        accepted_groups = [g for g in groups if g.status == "accepted"]
        
        relationships = [
            # (group_idx, supervisor_idx, project_idx, status)
            (0, 0, 0, "accepted"),  # Group 1 with Supervisor 1, Project 1
            (1, 0, 1, "accepted"),  # Group 2 with Supervisor 1, Project 2
            (2, 2, 2, "accepted"),  # Group 3 with Supervisor 3, Project 3
            (3, 1, 3, "accepted"),  # Group 4 with Supervisor 2, Project 4
        ]
        
        supervisor_groups = []
        created_count = 0
        for g_idx, sup_idx, proj_idx, status in relationships:
            if g_idx < len(accepted_groups) and sup_idx < len(supervisors) and proj_idx < len(projects):
                group = accepted_groups[g_idx]
                
                # Use get_or_create to avoid duplicates
                sos, created = SupervisorOfStudentGroup.objects.get_or_create(
                    group=group,
                    supervisor=supervisors[sup_idx],
                    defaults={
                        "status": status,
                        "project": projects[proj_idx],
                        "created_by": group.student_1,
                    }
                )
                
                supervisor_groups.append(sos)
                if created:
                    created_count += 1
                    # Note: evaluation forms are automatically created when status is "accepted"
                    # due to the save() method override in SupervisorOfStudentGroup
        
        self.stdout.write(self.style.SUCCESS(f"  [OK] Created {created_count} supervisor-student group relationships"))
        return supervisor_groups

    def create_external_examiners(self):
        """Create external examiner accounts"""
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
            user, created = CustomUser.objects.get_or_create(
                username=data['username'],
                defaults={
                    'email': data['email'],
                    'password': make_password('external123'),
                    'first_name': data['first_name'],
                    'last_name': data['last_name'],
                    'user_type': 'external_examiner',
                }
            )
            
            external, ext_created = ExternalExaminer.objects.get_or_create(
                user=user,
                defaults={
                    'external_id': data['external_id'],
                    'institution': data['institution'],
                    'designation': data['designation'],
                    'specialization': data['specialization'],
                    'contact_number': data['contact_number'],
                    'is_active': True,
                }
            )
            external_examiners.append(external)
            
            # Create notification preferences
            NotificationPreference.objects.get_or_create(user=user)
            
            if created:
                self.stdout.write(f"    [OK] Created external examiner: {data['username']}")
        
        self.stdout.write(self.style.SUCCESS(f"  [OK] Created {len(external_examiners)} external examiners"))
        return external_examiners

    def create_external_groups(self, external_examiners):
        """Create external groups for each examiner"""
        self.stdout.write("Creating external groups...")
        
        external_groups = []
        semester = 'Spring 2026'
        base_date = date.today() + timedelta(days=30)  # Evaluation in 30 days
        
        for i, external in enumerate(external_examiners):
            group, created = ExternalGroup.objects.get_or_create(
                name=f'External Group {chr(65 + i)} - {semester}',
                external_examiner=external,
                defaults={
                    'semester': semester,
                    'status': 'scheduled',
                    'max_groups': 7,
                    'evaluation_date': base_date + timedelta(days=i),
                    'evaluation_venue': f'Room {101 + i}, FYP Lab',
                    'notes': f'External evaluation group for {external.user.get_full_name()}',
                }
            )
            external_groups.append(group)
            if created:
                self.stdout.write(f"    [OK] Created external group: {group.name}")
        
        self.stdout.write(self.style.SUCCESS(f"  [OK] Created {len(external_groups)} external groups"))
        return external_groups

    def create_external_assignments(self, external_groups, supervisor_groups):
        """Assign student groups to external examiners"""
        self.stdout.write("Creating external assignments...")
        
        # Filter groups that are ready for external evaluation (accepted status)
        eligible_groups = [
            sg for sg in supervisor_groups 
            if sg.status == 'accepted'
        ]
        
        # Distribute groups among externals
        assignments_created = 0
        for i, supervisor_group in enumerate(eligible_groups):
            external_group = external_groups[i % len(external_groups)]
            
            # Check if external group has capacity
            current_count = ExternalGroupAssignment.objects.filter(
                external_group=external_group
            ).count()
            
            if current_count < external_group.max_groups:
                # Check if assignment already exists
                existing = ExternalGroupAssignment.objects.filter(
                    supervisor_group=supervisor_group
                ).exists()
                
                if not existing:
                    # Mark group as ready for external
                    supervisor_group.is_ready_for_external = True
                    supervisor_group.external_evaluation_status = 'assigned'
                    supervisor_group.save()
                    
                    # Create assignment
                    slot_number = current_count + 1
                    slot_time = time(9 + slot_number - 1, 0)  # 9 AM, 10 AM, etc.
                    
                    ExternalGroupAssignment.objects.create(
                        external_group=external_group,
                        supervisor_group=supervisor_group,
                        slot_number=slot_number,
                        slot_time=slot_time,
                        status='assigned',
                    )
                    assignments_created += 1
        
        self.stdout.write(self.style.SUCCESS(f"  [OK] Created {assignments_created} external assignments"))

    def create_sample_external_evaluations(self):
        """Create sample external evaluations for some assignments"""
        self.stdout.write("Creating sample external evaluations...")
        
        # Get first few assignments and create evaluations
        assignments = list(ExternalGroupAssignment.objects.all()[:2])  # First 2 only
        
        sample_ratings = [
            # Evaluation 1: Good student
            {
                'project_completion': 75,  # good
                'code_quality': 75,  # good
                'functionality': 95,  # excellent
                'understanding_of_technology': 75,  # good
                'problem_solving': 75,  # good
                'innovation': 50,  # adequate
                'presentation_clarity': 95,  # excellent
                'communication': 75,  # good
                'time_management': 75,  # good
                'documentation_completeness': 75,  # good
                'documentation_quality': 50,  # adequate
                'qa_response': 75,  # good
                'overall_comment': 'Good project with solid implementation. The team demonstrated strong technical skills.',
                'strengths': 'Strong technical implementation and excellent presentation skills.',
                'areas_of_improvement': 'Documentation could be more detailed with better code comments.',
            },
            # Evaluation 2: Excellent student
            {
                'project_completion': 95,  # excellent
                'code_quality': 95,  # excellent
                'functionality': 95,  # excellent
                'understanding_of_technology': 95,  # excellent
                'problem_solving': 75,  # good
                'innovation': 95,  # excellent
                'presentation_clarity': 95,  # excellent
                'communication': 95,  # excellent
                'time_management': 75,  # good
                'documentation_completeness': 95,  # excellent
                'documentation_quality': 75,  # good
                'qa_response': 95,  # excellent
                'overall_comment': 'Outstanding project with innovative approach and exceptional execution.',
                'strengths': 'Excellent innovation, technical depth, and professional presentation.',
                'areas_of_improvement': 'Minor improvements in time management during Q&A session.',
            },
        ]
        
        evaluations_created = 0
        for i, assignment in enumerate(assignments):
            if i < len(sample_ratings):
                # Check if evaluation already exists
                existing = ExternalEvaluation.objects.filter(assignment=assignment).exists()
                if not existing:
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
                    
                    evaluations_created += 1
        
        self.stdout.write(self.style.SUCCESS(f"  [OK] Created {evaluations_created} sample evaluations"))

    def create_evaluation_schedules(self, external_groups, panels):
        """Create evaluation schedules"""
        self.stdout.write("Creating evaluation schedules...")
        
        semester = 'Spring 2026'
        base_date = date.today() + timedelta(days=30)
        schedules_created = 0
        
        # Create external evaluation schedules
        for i, ext_group in enumerate(external_groups):
            schedule, created = EvaluationSchedule.objects.get_or_create(
                title=f'External Evaluation - {ext_group.name}',
                external_group=ext_group,
                defaults={
                    'evaluation_type': 'external_final',
                    'semester': semester,
                    'date': ext_group.evaluation_date or (base_date + timedelta(days=i)),
                    'start_time': time(9, 0),
                    'end_time': time(17, 0),
                    'venue': ext_group.evaluation_venue or f'Room {101 + i}',
                    'status': 'scheduled',
                }
            )
            if created:
                schedules_created += 1
        
        # Create internal evaluation schedules
        for j, panel in enumerate(panels):
            # Midterm
            schedule, created = EvaluationSchedule.objects.get_or_create(
                title=f'Midterm Evaluation - {panel.name}',
                panel=panel,
                evaluation_type='midterm',
                defaults={
                    'semester': semester,
                    'date': base_date - timedelta(days=60),
                    'start_time': time(9, 0),
                    'end_time': time(13, 0),
                    'venue': f'Seminar Hall {j + 1}',
                    'status': 'completed',
                }
            )
            if created:
                schedules_created += 1
            
            # Internal Final
            schedule, created = EvaluationSchedule.objects.get_or_create(
                title=f'Internal Final - {panel.name}',
                panel=panel,
                evaluation_type='internal_final',
                defaults={
                    'semester': semester,
                    'date': base_date - timedelta(days=7),
                    'start_time': time(9, 0),
                    'end_time': time(17, 0),
                    'venue': f'FYP Lab {j + 1}',
                    'status': 'scheduled',
                }
            )
            if created:
                schedules_created += 1
        
        self.stdout.write(self.style.SUCCESS(f"  [OK] Created {schedules_created} evaluation schedules"))

    def print_credentials(self):
        """Print login credentials for testing"""
        credentials = """
========================================================================
                        LOGIN CREDENTIALS                             
========================================================================

  ADMIN (Superuser)                                                   
  -----------------                                                   
  Username: admin                                                     
  Password: admin123                                                  
  URL: http://localhost:8000/admin/                                   
                                                                      
========================================================================
                                                                      
  STUDENTS (Password: student123)                                     
  -------------------------------                                     
  student1  - Ahmed Khan     (2021-CS-001)  [Has Group & Supervisor]  
  student2  - Sara Ali       (2021-CS-002)  [Has Group & Supervisor]  
  student3  - Muhammad Hassan(2021-CS-003)  [Has Group & Supervisor]  
  student4  - Fatima Ahmed   (2021-CS-004)  [Has Group & Supervisor]  
  student5  - Ali Raza       (2021-CS-005)  [Has Group & Supervisor]  
  student6  - Ayesha Malik   (2021-CS-006)  [Has Group & Supervisor]  
  student7  - Usman Shah     (2021-SE-001)  [Has Group & Supervisor]  
  student8  - Zainab Tariq   (2021-SE-002)  [Has Group & Supervisor]  
  student9  - Bilal Iqbal    (2020-CS-010)  [Pending Group]           
  student10 - Hira Noor      (2020-CS-011)  [Pending Group]           
                                                                      
========================================================================
                                                                      
  SUPERVISORS (Password: supervisor123)                               
  -------------------------------------                               
  supervisor1 - Dr. Imran Ahmed  [ML/AI, Web Dev]   - 2 groups        
  supervisor2 - Dr. Sana Malik   [Web, Cloud]       - 1 group         
  supervisor3 - Dr. Asad Khan    [Mobile, IoT]      - 1 group         
  supervisor4 - Dr. Nadia Hassan [Security, Blockchain]               
  supervisor5 - Dr. Farhan Ali   [Game Dev, SE]                       
                                                                      
========================================================================
                                                                      
  COMMITTEE MEMBERS (Password: committee123)                          
  ------------------------------------------                          
  committee1 - Prof. Adnan Siddiqui  [Panel A]                        
  committee2 - Prof. Rabia Qureshi   [Panel A]                        
  committee3 - Prof. Kashif Mahmood  [Panel B]                        
  committee4 - Prof. Amna Batool     [Panel B]                        
  committee5 - Prof. Zahid Hussain   [Panel C]                        
  committee6 - Prof. Saima Nawaz     [Panel C]                        
                                                                      
========================================================================
                                                                      
  EXTERNAL EXAMINERS (Password: external123)                          
  ------------------------------------------                          
  external1 - Dr. Ahmad Malik    [Punjab University - Professor]      
              Specialization: Software Engineering                    
              Has: External Group A, assigned students                
                                                                      
  external2 - Dr. Fatima Khan    [NUST - Assoc. Professor]            
              Specialization: Artificial Intelligence                 
              Has: External Group B, assigned students                
                                                                      
  external3 - Muhammad Ali       [Tech Solutions - Industry Expert]   
              Specialization: Web Development                         
              Has: External Group C, assigned students                
                                                                      
  external4 - Dr. Sara Ahmed     [FAST NUCES - Asst. Professor]       
              Specialization: Data Science                            
              Has: External Group D, assigned students                
                                                                      
========================================================================
                                                                      
  TEST DATA SUMMARY                                                   
  -----------------                                                   
  - 4 External Examiners created                                      
  - 4 External Groups created (one per examiner)                      
  - Student groups assigned to external groups                        
  - 2 Sample evaluations created (Groups A & B)                       
  - Evaluation schedules created                                      
                                                                      
========================================================================
                                                                      
  FRONTEND URL: http://localhost:3000/                                
  BACKEND URL:  http://localhost:8000/                                
  ADMIN URL:    http://localhost:8000/admin/                          
  CUSTOM ADMIN: http://localhost:8000/app/admin/dashboard/            
                                                                      
========================================================================
"""
        self.stdout.write(self.style.SUCCESS(credentials))
