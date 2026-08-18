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
                email="admin@utc.edu.vn",
                password="admin123",
                first_name="Admin",
                last_name="UTC",
                user_type="supervisor"
            )
            self.stdout.write(self.style.SUCCESS("  [OK] Created superuser: admin"))
        else:
            self.stdout.write(self.style.WARNING("  - Superuser 'admin' already exists"))

    def create_project_categories(self):
        """Create project categories tailored for UTC faculties"""
        categories_data = [
            "Khoa CNTT - Hệ thống Thông tin & Khoa học Dữ liệu",
            "Khoa CNTT - Công nghệ Phần mềm & Trí tuệ Nhân tạo",
            "Khoa Điện-Điện tử - Tự động hóa Giao thông",
            "Khoa Điện-Điện tử - Hệ thống Điện & Viễn thông",
            "Khoa Cầu đường - Kỹ thuật Hạ tầng Giao thông",
            "Khoa Vận tải Kinh tế - Logistics & Chuỗi Cung ứng",
            "Khoa Cơ khí - Đầu máy Toa xe & Kỹ thuật Ô tô",
            "Khoa Quản lý Dự án Giao thông & Hạ tầng",
        ]
        
        categories = []
        for name in categories_data:
            cat, created = ProjectCategories.objects.get_or_create(category_name=name)
            categories.append(cat)
        
        self.stdout.write(self.style.SUCCESS(f"  [OK] Created {len(categories)} UTC project categories"))
        return categories

    def create_committee_panels(self):
        """Create committee member panels"""
        panels_data = ["Hội đồng A - CNTT & Tự động hóa", "Hội đồng B - Cầu đường & Hạ tầng", "Hội đồng C - Vận tải & Logistics"]
        
        panels = []
        for name in panels_data:
            panel, created = CommitteeMemberPanel.objects.get_or_create(name=name)
            panels.append(panel)
        
        self.stdout.write(self.style.SUCCESS(f"  [OK] Created {len(panels)} committee panels"))
        return panels

    def create_students(self):
        """Create student users with UTC registration numbers and emails"""
        students_data = [
            # (username, email, first_name, last_name, reg_no, department, semester, batch)
            ("student1", "201200101@sv.utc.edu.vn", "Văn A", "Nguyen", "201200101", "Khoa Công nghệ Thông tin", "semester_7", "K61"),
            ("student2", "201200102@sv.utc.edu.vn", "Thị B", "Tran", "201200102", "Khoa Công nghệ Thông tin", "semester_7", "K61"),
            ("student3", "201200103@sv.utc.edu.vn", "Văn C", "Le", "201200103", "Khoa Công nghệ Thông tin", "semester_7", "K61"),
            ("student4", "201200104@sv.utc.edu.vn", "Thị D", "Pham", "201200104", "Khoa Công nghệ Thông tin", "semester_7", "K61"),
            ("student5", "201200105@sv.utc.edu.vn", "Văn E", "Hoang", "201200105", "Khoa Điện - Điện tử", "semester_7", "K61"),
            ("student6", "201200106@sv.utc.edu.vn", "Thị F", "Vu", "201200106", "Khoa Điện - Điện tử", "semester_7", "K61"),
            ("student7", "201200107@sv.utc.edu.vn", "Văn G", "Do", "201200107", "Khoa Cầu đường", "semester_7", "K61"),
            ("student8", "201200108@sv.utc.edu.vn", "Thị H", "Bui", "201200108", "Khoa Cầu đường", "semester_7", "K61"),
            ("student9", "201100109@sv.utc.edu.vn", "Văn I", "Dang", "201100109", "Khoa Vận tải - Kinh tế", "semester_8", "K60"),
            ("student10", "201100110@sv.utc.edu.vn", "Thị K", "Ngo", "201100110", "Khoa Vận tải - Kinh tế", "semester_8", "K60"),
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
        """Create supervisor users with UTC credentials"""
        supervisors_data = [
            # (username, email, first_name, last_name, sup_id, research, academic, category_indices)
            ("supervisor1", "gvc.nguyen@utc.edu.vn", "TS. Nguyễn", "Văn Minh", "UTC-GV-01", 
             "Hệ thống thông tin Giao thông, Khoa học dữ liệu", "Tiến sĩ Khoa học Máy tính", [0, 1]),
            ("supervisor2", "ts.tran@utc.edu.vn", "PGS.TS. Trần", "Thị Mai", "UTC-GV-02", 
             "Trí tuệ nhân tạo, Tự động hóa Giao thông", "Phó Giáo sư Tiến sĩ", [1, 2]),
            ("supervisor3", "ts.le@utc.edu.vn", "TS. Lê", "Hoàng Nam", "UTC-GV-03", 
             "Kỹ thuật Hạ tầng & Cầu đường", "Tiến sĩ Kỹ thuật Cầu đường", [4, 7]),
            ("supervisor4", "ts.pham@utc.edu.vn", "TS. Phạm", "Quang Huy", "UTC-GV-04", 
             "Logistics & Vận tải Đa phương thức", "Tiến sĩ Kinh tế Vận tải", [5, 7]),
            ("supervisor5", "ts.vu@utc.edu.vn", "TS. Vũ", "Đức Anh", "UTC-GV-05", 
             "Cơ khí Đầu máy Toa xe & Kỹ thuật Ô tô", "Tiến sĩ Cơ khí Động lực", [6]),
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
        """Create committee member users with UTC credentials"""
        committee_data = [
            # (username, email, first_name, last_name, committee_id, panel_index)
            ("committee1", "hd.nguyen@utc.edu.vn", "PGS.TS. Nguyễn", "Đức Thắng", "UTC-HD-01", 0),
            ("committee2", "hd.tran@utc.edu.vn", "TS. Trần", "Thanh Hải", "UTC-HD-02", 0),
            ("committee3", "hd.le@utc.edu.vn", "PGS.TS. Lê", "Văn Thành", "UTC-HD-03", 1),
            ("committee4", "hd.pham@utc.edu.vn", "TS. Phạm", "Thị Dung", "UTC-HD-04", 1),
            ("committee5", "hd.hoang@utc.edu.vn", "PGS.TS. Hoàng", "Quốc Bảo", "UTC-HD-05", 2),
            ("committee6", "hd.vu@utc.edu.vn", "TS. Vũ", "Thái Sơn", "UTC-HD-06", 2),
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
            (0, 1, 0, "accepted"),   # Group 1 - Khoa CNTT
            (2, 3, 1, "accepted"),   # Group 2 - Khoa CNTT AI
            (4, 5, 2, "accepted"),   # Group 3 - Khoa Điện - Điện tử
            (6, 7, 4, "accepted"),   # Group 4 - Khoa Cầu đường
            (8, 9, 5, "pending"),    # Group 5 - Khoa Vận tải - Logistics
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
                "Hệ thống Quản lý Đồ án Smart FYP UTC",
                "Hệ thống số hóa quy trình quản lý vòng đời đồ án tốt nghiệp dành cho Trường Đại học Giao thông Vận tải.",
                "Python, Django, React, TypeScript",
                "Xác thực vai trò, Quản lý nhóm đồ án, Duyệt đề tài, Nộp tài liệu, Đánh giá hội đồng",
                0  # Khoa CNTT - Hệ thống Thông tin
            ),
            (
                "Hệ thống Giám sát & Nhận diện Biển số Xe Giao thông",
                "Hệ thống xử lý ảnh và trí tuệ nhân tạo nhận diện biển số xe thông minh phục vụ quản lý giao thông đô thị.",
                "Python, OpenCV, TensorFlow, FastAPI",
                "Nhận diện biển số, Phân tích mật độ xe, Báo cáo thống kê, Cảnh báo vi phạm",
                1  # Khoa CNTT - AI
            ),
            (
                "Hệ thống Điều khiển Đèn Giao thông Thông minh IoT",
                "Giải pháp tự động điều chỉnh chu kỳ đèn giao thông theo mật độ dòng xe thực tế qua cảm biến IoT.",
                "C++, Embedded C, React Native, Python",
                "Thu thập dữ liệu cảm biến, Thuật toán điều phối luồng xe, Giám sát thời gian thực",
                2  # Khoa Điện-Điện tử
            ),
            (
                "Phần mềm Quản lý & Bảo trì Công trình Cầu đường",
                "Ứng dụng quản lý lịch trình bảo dưỡng, kiểm định kết cấu cầu đường và hạ tầng giao thông.",
                "Python, PostgreSQL, React",
                "Quản lý hồ sơ công trình, Cảnh báo hỏng hóc, Lập kế hoạch bảo trì, Xuất báo cáo kỹ thuật",
                4  # Khoa Cầu đường
            ),
            (
                "Hệ thống Quản trị Chuỗi Cung ứng & Logistics Vận tải",
                "Nền tảng tối ưu hóa tuyến đường vận chuyển container và theo dõi hành trình xe tải đường dài.",
                "Python, D3.js, PostgreSQL",
                "Tối ưu tuyến đường, Theo dõi GPS, Quản lý kho bãi, Tính toán chi phí vận tải",
                5  # Khoa Vận tải Kinh tế
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
