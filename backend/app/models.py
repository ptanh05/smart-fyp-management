from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils.translation import gettext_lazy as _
from django.utils import timezone
import random
import string


class CustomUser(AbstractUser):
    USER_TYPE_CHOICES = (
        ("student", "Student"),
        ("supervisor", "Supervisor"),
        ("committee_member", "Committee Member"),
        ("external_examiner", "External Examiner"),
    )
    user_type = models.CharField(max_length=50, choices=USER_TYPE_CHOICES)
    # Password field is inherited from AbstractUser - no need to redefine it
    # Django's UserAdmin will handle password changes properly

    class Meta:
        verbose_name = "User"
        verbose_name_plural = "Users"
        # This ensures the admin shows "Users" instead of "Custom Users"

    def __str__(self):
        return self.username


class PasswordResetCode(models.Model):
    """Model to store 6-digit password reset codes sent via email."""
    user = models.ForeignKey(
        CustomUser, on_delete=models.CASCADE, related_name="password_reset_codes"
    )
    code = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Reset code for {self.user.username}"

    @classmethod
    def generate_code(cls):
        """Generate a random 6-digit code."""
        return "".join(random.choices(string.digits, k=6))

    @classmethod
    def create_for_user(cls, user, expiry_hours=24):
        """Create a new password reset code for the user."""
        # Invalidate any existing unused codes for this user
        cls.objects.filter(user=user, is_used=False).update(is_used=True)
        
        # Create new code
        code = cls.generate_code()
        expires_at = timezone.now() + timezone.timedelta(hours=expiry_hours)
        
        return cls.objects.create(
            user=user,
            code=code,
            expires_at=expires_at
        )

    def is_valid(self):
        """Check if the code is still valid (not expired and not used)."""
        return not self.is_used and timezone.now() < self.expires_at

    def mark_as_used(self):
        """Mark the code as used."""
        self.is_used = True
        self.save()


class AcademicBatch(models.Model):
    """Kỳ học / Đợt làm Đồ án Tốt nghiệp (vd: K60-K63 HK1 2026-2027)"""
    batch_code = models.CharField(max_length=50, unique=True)
    batch_name = models.CharField(max_length=255)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.batch_name} ({self.batch_code})"


class CourseClass(models.Model):
    """Lớp học phần từ cổng đào tạo (vd: CNT04.101, IT1.243.102, IT1.659.103)"""
    PROGRAM_CHOICES = (
        ("VIET_ANH", "Công nghệ thông tin Việt - Anh"),
        ("DAI_TRA", "Công nghệ thông tin Đại trà"),
        ("KHMT", "Khoa học máy tính"),
        ("KHOA_CU", "Sinh viên Khóa cũ"),
    )
    batch = models.ForeignKey(
        AcademicBatch, on_delete=models.CASCADE, related_name="course_classes"
    )
    class_code = models.CharField(max_length=50)
    class_name = models.CharField(max_length=255)
    program_type = models.CharField(
        max_length=50, choices=PROGRAM_CHOICES, default="DAI_TRA"
    )
    class_group = models.CharField(max_length=50, blank=True, null=True)

    class Meta:
        ordering = ["class_code"]

    def __str__(self):
        return f"{self.class_name} - {self.class_code} ({self.class_group})"


class Student(models.Model):
    SEMESTER_CHOICES = (
        ("semester_6", "Semester 6"),
        ("semester_7", "Semester 7"),
        ("semester_8", "Semester 8"),
    )
    user = models.OneToOneField(
        CustomUser, on_delete=models.CASCADE, related_name="student_profile"
    )

    registration_no = models.CharField(max_length=20, unique=True)
    department = models.CharField(max_length=100, blank=True, null=True)
    semester = models.CharField(
        max_length=100, choices=SEMESTER_CHOICES, blank=True, null=True
    )
    batch_no = models.CharField(max_length=100, blank=True, null=True)
    phone_number = models.CharField(max_length=30, blank=True, null=True)
    course_class = models.ForeignKey(
        CourseClass, on_delete=models.SET_NULL, null=True, blank=True, related_name="students"
    )
    academic_batch = models.ForeignKey(
        AcademicBatch, on_delete=models.SET_NULL, null=True, blank=True, related_name="students"
    )

    @property
    def is_final_semester(self):
        """Check if student is in final (8th) semester."""
        return self.semester == "semester_8"
    
    @property
    def is_eligible_for_external(self):
        """Check if student is eligible for external evaluation."""
        return self.is_final_semester

    def __str__(self):
        return f"{self.user.get_full_name() or self.user.username} ({self.registration_no})"


class ProjectCategories(models.Model):
    category_name = models.CharField(max_length=100)

    def __str__(self):
        return self.category_name


class Supervisor(models.Model):
    user = models.OneToOneField(
        CustomUser, on_delete=models.CASCADE, related_name="supervisor_profile"
    )
    supervisor_id = models.CharField(max_length=100, unique=True)
    research_interest = models.CharField(max_length=255, blank=True, null=True)
    academic_background = models.CharField(max_length=255, blank=True, null=True)
    phone_number = models.CharField(max_length=30, blank=True, null=True)
    academic_title = models.CharField(max_length=50, blank=True, null=True)
    department_name = models.CharField(max_length=100, blank=True, null=True)
    is_external = models.BooleanField(default=False)

    category = models.ManyToManyField(
        ProjectCategories, related_name="supervisor", blank=True
    )

    def __str__(self):
        prefix = f"{self.academic_title} " if self.academic_title else ""
        return f"{prefix}{self.user.get_full_name() or self.user.username}"


class Group(models.Model):
    STATUS_CHOICES = (
        ("pending", "Pending"),
        ("accepted", "Accepted"),
        ("rejected", "Rejected"),
        ("canceled", "Canceled"),
    )
    student_1 = models.ForeignKey(
        Student, on_delete=models.CASCADE, related_name="send_request"
    )
    student_2 = models.ForeignKey(
        Student, on_delete=models.CASCADE, related_name="receive_request", null=True, blank=True
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    project_category = models.ForeignKey(
        ProjectCategories, on_delete=models.CASCADE, related_name="groupmate_project"
    )

    class Meta:
        unique_together = ("student_1", "student_2", "id")

    def __str__(self):
        return f"{self.student_1} - {self.student_2} - {self.status}"


class GroupCreationComment(models.Model):
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name="comments")
    student = models.ForeignKey(
        Student, on_delete=models.CASCADE, related_name="comments"
    )
    comment = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.student} - {self.comment}"


class CommitteeMemberPanel(models.Model):
    name = models.CharField(max_length=100, blank=True, null=True)

    def __str__(self):
        return self.name if self.name else "Committee Member Panel"


class Project(models.Model):
    project_category = models.ForeignKey(
        ProjectCategories, on_delete=models.CASCADE, related_name="project_category"
    )
    panel = models.ForeignKey(
        CommitteeMemberPanel,
        on_delete=models.SET_NULL,
        related_name="projects",
        null=True,
        blank=True,
    )
    project_name = models.CharField(max_length=100)
    project_description = models.TextField()
    language = models.CharField(max_length=100)
    functionalities = models.TextField()
    user = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        related_name="projects",
        null=True,
        blank=True,
    )

    def __str__(self):
        return f"{self.project_name} - {self.project_category}"


class ScopeDocumentEvaluationCriteria(models.Model):
    STATUS_CHOICES = (
        ("pending", "Pending"),
        ("marginal", "Marginal"),
        ("adequate", "Adequate"),
        ("good", "Good"),
        ("excellent", "Excellent"),
    )
    problem_statement = models.CharField(
        max_length=100, choices=STATUS_CHOICES, default="pending"
    )
    validity_of_he_proposed_solution = models.CharField(
        max_length=100, choices=STATUS_CHOICES, default="pending"
    )
    motivation_behind_tools_and_technologies = models.CharField(
        max_length=100, choices=STATUS_CHOICES, default="pending"
    )
    modules = models.CharField(
        max_length=100, choices=STATUS_CHOICES, default="pending"
    )
    task_management = models.CharField(
        max_length=100, choices=STATUS_CHOICES, default="pending"
    )
    related_system_analysis = models.CharField(
        max_length=100, choices=STATUS_CHOICES, default="pending"
    )
    document_format = models.CharField(
        max_length=100, choices=STATUS_CHOICES, default="pending"
    )
    plagiarism_report = models.BooleanField(null=True, blank=True)
    comments = models.TextField(blank=True, null=True)
    evaluation_status = models.BooleanField(blank=True, null=True)

    def __str__(self):
        return f"scope_document_{self.id}"


class SRSEvaluationSupervisor(models.Model):
    STATUS_CHOICES = (
        ("pending", "Pending"),
        ("marginal", "Marginal"),
        ("adequate", "Adequate"),
        ("good", "Good"),
        ("excellent", "Excellent"),
    )
    regularity = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default="pending"
    )
    srs_are_frs_mapped_to_the_problem = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default="pending"
    )
    srs_are_nfr_mapped_to_the_problem = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default="pending"
    )
    is_srs_storyboarding = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default="pending"
    )
    according_to_requirement = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default="pending"
    )
    is_srs_template_followed = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default="pending"
    )
    is_write_up_correct = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default="pending"
    )
    student_participation = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default="pending"
    )
    comment = models.CharField(max_length=255, null=True, blank=True)

    @staticmethod
    def percentages_dict() -> dict:
        return {
            "pending": 0,
            "marginal": 15,
            "adequate": 40,
            "good": 70,
            "excellent": 95,
        }

    @classmethod
    def calculate(cls, key, marks) -> float:
        return (cls.percentages_dict().get(key, 0) / 100) * marks

    @property
    def total_marks(self) -> float:
        return (
            self.calculate(self.regularity, 5)
            + self.calculate(self.srs_are_frs_mapped_to_the_problem, 4)
            + self.calculate(self.srs_are_nfr_mapped_to_the_problem, 1)
            + self.calculate(self.is_srs_storyboarding, 3)
            + self.calculate(self.according_to_requirement, 2)
            + self.calculate(self.is_srs_template_followed, 2)
            + self.calculate(self.is_write_up_correct, 3)
            + self.calculate(self.student_participation, 5)
        )

    def __str__(self):
        return f"srs_{self.id}"


class SRSEvaluationCommitteeMember(models.Model):
    STATUS_CHOICES = (
        ("pending", "Pending"),
        ("marginal", "Marginal"),
        ("adequate", "Adequate"),
        ("good", "Good"),
        ("excellent", "Excellent"),
    )
    analysis_of_existing_systems = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default="pending"
    )
    problem_defined = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default="pending"
    )
    proposed_solution = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default="pending"
    )
    tools_technologies = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default="pending"
    )
    frs_mapped = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default="pending"
    )
    nfrs_mapped = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default="pending"
    )
    requirements_analysis = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default="pending"
    )
    mocks_defined = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default="pending"
    )
    srs_template_followed = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default="pending"
    )
    technical_writeup_correct = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default="pending"
    )
    domain_knowledge = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default="pending"
    )
    qa_ability = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default="pending"
    )
    presentation_attire = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default="pending"
    )
    comment = models.CharField(max_length=255, null=True, blank=True)

    @staticmethod
    def percentages_dict() -> dict:
        return {
            "pending": 0,
            "marginal": 15,
            "adequate": 40,
            "good": 70,
            "excellent": 95,
        }

    @classmethod
    def calculate(cls, key, max_marks) -> float:
        return (cls.percentages_dict().get(key, 0) / 100) * max_marks

    @property
    def total_marks(self):
        return (
            self.calculate(self.analysis_of_existing_systems, 0.5)
            + self.calculate(self.problem_defined, 2.5)
            + self.calculate(self.proposed_solution, 1.5)
            + self.calculate(self.tools_technologies, 0.5)
            + self.calculate(self.frs_mapped, 4)
            + self.calculate(self.nfrs_mapped, 2)
            + self.calculate(self.requirements_analysis, 3)
            + self.calculate(self.mocks_defined, 2)
            + self.calculate(self.srs_template_followed, 2)
            + self.calculate(self.technical_writeup_correct, 3)
            + self.calculate(self.domain_knowledge, 1)
            + self.calculate(self.qa_ability, 2)
            + self.calculate(self.presentation_attire, 1)
        )

    def __str__(self):
        return f"srs_{self.id}"


class SDDEvaluationSupervisor(models.Model):
    STATUS_CHOICES = (
        ("pending", "Pending"),
        ("marginal", "Marginal"),
        ("adequate", "Adequate"),
        ("good", "Good"),
        ("excellent", "Excellent"),
    )
    data_representation_diagram = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default="pending"
    )
    process_flow = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default="pending"
    )
    design_models = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default="pending"
    )
    algorithms_defined = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default="pending"
    )
    module_completion_status = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default="pending"
    )
    is_sdd_template_followed = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default="pending"
    )
    is_technical_writeup_correct = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default="pending"
    )
    regularity = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default="pending"
    )
    seminar_participation = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default="pending"
    )
    comment = models.CharField(max_length=255, null=True, blank=True)

    @staticmethod
    def percentages_dict() -> dict:
        return {
            "pending": 0,
            "marginal": 15,
            "adequate": 40,
            "good": 70,
            "excellent": 95,
        }

    @classmethod
    def calculate(cls, key, marks) -> float:
        return (cls.percentages_dict().get(key, 0) / 100) * marks

    @property
    def total_marks(self) -> float:
        return (
            self.calculate(self.data_representation_diagram, 2)
            + self.calculate(self.process_flow, 2)
            + self.calculate(self.design_models, 4)
            + self.calculate(self.algorithms_defined, 2)
            + self.calculate(self.module_completion_status, 5)
            + self.calculate(self.is_sdd_template_followed, 2)
            + self.calculate(self.is_technical_writeup_correct, 3)
            + self.calculate(self.regularity, 2.5)
            + self.calculate(self.seminar_participation, 2.5)
        )

    def __str__(self):
        return f"sdd_{self.id}"


class SDDEvaluationCommitteeMember(models.Model):
    STATUS_CHOICES = (
        ("pending", "Pending"),
        ("marginal", "Marginal"),
        ("adequate", "Adequate"),
        ("good", "Good"),
        ("excellent", "Excellent"),
    )
    data_representation_diagram = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default="pending"
    )
    process_flow = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default="pending"
    )
    sdd_design_models = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default="pending"
    )
    algorithm_defined = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default="pending"
    )
    modules_completion_status = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default="pending"
    )
    sdd_template_followed = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default="pending"
    )
    technical_writeup_correct = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default="pending"
    )
    project_domain_knowledge = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default="pending"
    )
    qa_ability = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default="pending"
    )
    proper_attire = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default="pending"
    )
    comment = models.CharField(max_length=255, null=True, blank=True)

    @staticmethod
    def percentages_dict() -> dict:
        return {
            "pending": 0,
            "marginal": 15,
            "adequate": 40,
            "good": 70,
            "excellent": 95,
        }

    @classmethod
    def calculate(cls, key, marks) -> float:
        return (cls.percentages_dict().get(key, 0) / 100) * marks

    @property
    def total_marks(self) -> float:
        return (
            self.calculate(self.data_representation_diagram, 2)
            + self.calculate(self.process_flow, 2)
            + self.calculate(self.sdd_design_models, 5)
            + self.calculate(self.algorithm_defined, 2)
            + self.calculate(self.modules_completion_status, 5)
            + self.calculate(self.sdd_template_followed, 2)
            + self.calculate(self.technical_writeup_correct, 3)
            + self.calculate(self.project_domain_knowledge, 1)
            + self.calculate(self.qa_ability, 2)
            + self.calculate(self.proper_attire, 1)
        )

    def __str__(self):
        return f"sdd_{self.id}"


class Evaluation3Supervisor(models.Model):
    STATUS_CHOICES = (
        ("pending", "Pending"),
        ("marginal", "Marginal"),
        ("adequate", "Adequate"),
        ("good", "Good"),
        ("excellent", "Excellent"),
    )
    module_completion = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default="pending"
    )
    software_testing = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default="pending"
    )
    regularity = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default="pending"
    )
    is_template_followed = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default="pending"
    )
    project_domain_knowledge = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default="pending"
    )
    is_writeup_correct = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default="pending"
    )

    comment = models.CharField(max_length=255, null=True, blank=True)

    @staticmethod
    def percentages_dict() -> dict:
        return {
            "pending": 0,
            "marginal": 15,
            "adequate": 40,
            "good": 70,
            "excellent": 95,
        }

    @classmethod
    def calculate(cls, key, marks) -> float:
        return (cls.percentages_dict().get(key, 0) / 100) * marks

    @property
    def total_marks(self) -> float:
        return (
            self.calculate(self.module_completion, 3)
            + self.calculate(self.software_testing, 4)
            + self.calculate(self.regularity, 3)
            + self.calculate(self.is_template_followed, 2)
            + self.calculate(self.project_domain_knowledge, 2.5)
            + self.calculate(self.is_writeup_correct, 3)
        )

    def __str__(self):
        return f"supervisor_eval_{self.id}"


class Evaluation3CommitteeMember(models.Model):
    STATUS_CHOICES = (
        ("pending", "Pending"),
        ("marginal", "Marginal"),
        ("adequate", "Adequate"),
        ("good", "Good"),
        ("excellent", "Excellent"),
    )
    module_completion = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default="pending"
    )
    software_testing = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default="pending"
    )
    qa_ability = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default="pending"
    )
    proper_attire = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default="pending"
    )
    is_template_followed = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default="pending"
    )
    is_writeup_correct = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default="pending"
    )

    comment = models.CharField(max_length=255, null=True, blank=True)

    @staticmethod
    def percentages_dict() -> dict:
        return {
            "pending": 0,
            "marginal": 15,
            "adequate": 40,
            "good": 70,
            "excellent": 95,
        }

    @classmethod
    def calculate(cls, key, marks) -> float:
        return (cls.percentages_dict().get(key, 0) / 100) * marks

    @property
    def total_marks(self) -> float:
        return (
            self.calculate(self.module_completion, 4)
            + self.calculate(self.software_testing, 4)
            + self.calculate(self.qa_ability, 2.5)
            + self.calculate(self.proper_attire, 0.5)
            + self.calculate(self.is_template_followed, 1)
            + self.calculate(self.is_writeup_correct, 3)
        )

    def __str__(self):
        return f"committee_member_eval_{self.id}"


class Evaluation4Supervisor(models.Model):
    STATUS_CHOICES = (
        ("pending", "Pending"),
        ("marginal", "Marginal"),
        ("adequate", "Adequate"),
        ("good", "Good"),
        ("excellent", "Excellent"),
    )
    module_completion = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default="pending"
    )
    student_participation_seminar = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default="pending"
    )
    is_template_followed = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default="pending"
    )
    is_writeup_correct = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default="pending"
    )

    comment = models.CharField(max_length=255, null=True, blank=True)

    @staticmethod
    def percentages_dict() -> dict:
        return {
            "pending": 0,
            "marginal": 15,
            "adequate": 40,
            "good": 70,
            "excellent": 95,
        }

    @classmethod
    def calculate(cls, key, marks) -> float:
        return (cls.percentages_dict().get(key, 0) / 100) * marks

    @property
    def total_marks(self) -> float:
        return (
            self.calculate(self.module_completion, 5)
            + self.calculate(self.student_participation_seminar, 5)
            + self.calculate(self.is_template_followed, 2)
            + self.calculate(self.is_writeup_correct, 3)
        )

    def __str__(self):
        return f"supervisor_eval_{self.id}"


class Evaluation4CommitteeMember(models.Model):
    STATUS_CHOICES = (
        ("pending", "Pending"),
        ("marginal", "Marginal"),
        ("adequate", "Adequate"),
        ("good", "Good"),
        ("excellent", "Excellent"),
    )
    module_completion = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default="pending"
    )
    software_testing = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default="pending"
    )
    qa_ability = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default="pending"
    )
    proper_attire = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default="pending"
    )
    is_template_followed = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default="pending"
    )
    is_writeup_correct = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default="pending"
    )

    comment = models.CharField(max_length=255, null=True, blank=True)

    @staticmethod
    def percentages_dict() -> dict:
        return {
            "pending": 0,
            "marginal": 15,
            "adequate": 40,
            "good": 70,
            "excellent": 95,
        }

    @classmethod
    def calculate(cls, key, marks) -> float:
        return (cls.percentages_dict().get(key, 0) / 100) * marks

    @property
    def total_marks(self) -> float:
        return (
            self.calculate(self.module_completion, 4)
            + self.calculate(self.software_testing, 4)
            + self.calculate(self.qa_ability, 2.5)
            + self.calculate(self.proper_attire, 0.5)
            + self.calculate(self.is_template_followed, 1)
            + self.calculate(self.is_writeup_correct, 3)
        )

    def __str__(self):
        return f"committee_member_eval_{self.id}"


class SupervisorOfStudentGroup(models.Model):
    STATUS_CHOICES = (
        ("pending", "Pending"),
        ("accepted_by_student", "Accepted by Student"),
        ("accepted", "Accepted"),
        ("rejected", "Rejected"),
        ("canceled", "Canceled"),
    )
    group = models.ForeignKey(
        Group, on_delete=models.CASCADE, related_name="supervisor_request"
    )
    supervisor = models.ForeignKey(
        Supervisor, on_delete=models.CASCADE, related_name="group_request"
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name="groups"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        Student, on_delete=models.CASCADE, related_name="supervisor_request_created_by"
    )
    Scope_document_evaluation_form = models.OneToOneField(
        ScopeDocumentEvaluationCriteria,
        on_delete=models.CASCADE,
        related_name="scope_document_evaluation_form",
        blank=True,
        null=True,
    )
    srs_evaluation_supervisor = models.OneToOneField(
        SRSEvaluationSupervisor,
        on_delete=models.CASCADE,
        related_name="supervisor_of_students",
        blank=True,
        null=True,
    )
    srs_evaluation_committee_member = models.OneToOneField(
        SRSEvaluationCommitteeMember,
        on_delete=models.CASCADE,
        related_name="supervisor_of_students",
        blank=True,
        null=True,
    )
    sdd_evaluation_supervisor = models.OneToOneField(
        SDDEvaluationSupervisor,
        on_delete=models.CASCADE,
        related_name="supervisor_of_students",
        blank=True,
        null=True,
    )
    sdd_evaluation_committee_member = models.OneToOneField(
        SDDEvaluationCommitteeMember,
        on_delete=models.CASCADE,
        related_name="supervisor_of_students",
        blank=True,
        null=True,
    )
    evaluation3_supervisor = models.OneToOneField(
        Evaluation3Supervisor,
        on_delete=models.CASCADE,
        related_name="supervisor_of_students",
        blank=True,
        null=True,
    )
    evaluation3_committee_member = models.OneToOneField(
        Evaluation3CommitteeMember,
        on_delete=models.CASCADE,
        related_name="supervisor_of_students",
        blank=True,
        null=True,
    )
    evaluation4_supervisor = models.OneToOneField(
        Evaluation4Supervisor,
        on_delete=models.CASCADE,
        related_name="supervisor_of_students",
        blank=True,
        null=True,
    )
    evaluation4_committee_member = models.OneToOneField(
        Evaluation4CommitteeMember,
        on_delete=models.CASCADE,
        related_name="supervisor_of_students",
        blank=True,
        null=True,
    )
    
    # External evaluation tracking
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

    def save(self, *args, **kwargs):
        # Check if this is a status change to "accepted"
        is_new = self.pk is None
        status_changed_to_accepted = False
        
        if not is_new:
            # Get the old status from the database
            try:
                old_instance = SupervisorOfStudentGroup.objects.get(pk=self.pk)
                if old_instance.status != "accepted" and self.status == "accepted":
                    status_changed_to_accepted = True
            except SupervisorOfStudentGroup.DoesNotExist:
                pass
        
        # Only create evaluation forms when status changes to "accepted"
        if status_changed_to_accepted or (is_new and self.status == "accepted"):
            self._create_evaluation_forms()
        
        super().save(*args, **kwargs)
    
    def _create_evaluation_forms(self):
        """Create all evaluation forms for this supervisor-student group."""
        if not self.Scope_document_evaluation_form:
            self.Scope_document_evaluation_form = (
                ScopeDocumentEvaluationCriteria.objects.create()
            )
        if not self.srs_evaluation_supervisor:
            self.srs_evaluation_supervisor = SRSEvaluationSupervisor.objects.create()
        if not self.srs_evaluation_committee_member:
            self.srs_evaluation_committee_member = (
                SRSEvaluationCommitteeMember.objects.create()
            )
        if not self.sdd_evaluation_supervisor:
            self.sdd_evaluation_supervisor = SDDEvaluationSupervisor.objects.create()
        if not self.sdd_evaluation_committee_member:
            self.sdd_evaluation_committee_member = (
                SDDEvaluationCommitteeMember.objects.create()
            )
        if not self.evaluation3_supervisor:
            self.evaluation3_supervisor = Evaluation3Supervisor.objects.create()
        if not self.evaluation3_committee_member:
            self.evaluation3_committee_member = (
                Evaluation3CommitteeMember.objects.create()
            )
        if not self.evaluation4_supervisor:
            self.evaluation4_supervisor = Evaluation4Supervisor.objects.create()
        if not self.evaluation4_committee_member:
            self.evaluation4_committee_member = (
                Evaluation4CommitteeMember.objects.create()
            )
    
    def ensure_evaluation_forms_exist(self):
        """
        Ensure evaluation forms exist for this group.
        Call this method when accessing evaluation forms to ensure they're created.
        Only creates forms if the status is 'accepted'.
        """
        if self.status != "accepted":
            return False
        
        forms_created = False
        if not self.Scope_document_evaluation_form:
            self._create_evaluation_forms()
            self.save(update_fields=[
                'Scope_document_evaluation_form',
                'srs_evaluation_supervisor',
                'srs_evaluation_committee_member',
                'sdd_evaluation_supervisor',
                'sdd_evaluation_committee_member',
                'evaluation3_supervisor',
                'evaluation3_committee_member',
                'evaluation4_supervisor',
                'evaluation4_committee_member',
            ])
            forms_created = True
        
        return forms_created

    class Meta:
        unique_together = ("group", "supervisor")

    def __str__(self):
        return f"{self.group} - {self.supervisor} - {self.status}"


class SupervisorStudentComments(models.Model):
    COMMENT_BY_CHOICES = (
        ("student", "Student"),
        ("supervisor", "Supervisor"),
    )
    student = models.ForeignKey(
        Student,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="student_comments",
    )
    supervisor = models.ForeignKey(
        Supervisor,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="supervisor_comments",
    )
    group = models.ForeignKey(
        Group, on_delete=models.CASCADE, related_name="group_comments"
    )
    comment = models.TextField()
    commented_by = models.CharField(
        max_length=20, choices=COMMENT_BY_CHOICES, default="student"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.supervisor} - {self.student} - {self.comment}"


class CommitteeMember(models.Model):
    user = models.OneToOneField(
        CustomUser, on_delete=models.CASCADE, related_name="committee_member_profile"
    )
    committee_id = models.CharField(max_length=100, unique=True)
    panel = models.ForeignKey(
        CommitteeMemberPanel, on_delete=models.CASCADE, related_name="committee_member"
    )

    def __str__(self):
        return self.user.username


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
    institution = models.CharField(max_length=200)
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
        if not self.pk or not hasattr(self, 'external_groups'):
            return 0
        return self.external_groups.aggregate(
            total=models.Count('assignments')
        )['total'] or 0


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
    
    name = models.CharField(max_length=100)
    external_examiner = models.ForeignKey(
        ExternalExaminer,
        on_delete=models.CASCADE,
        related_name="external_groups"
    )
    semester = models.CharField(max_length=50)
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="pending"
    )
    max_groups = models.PositiveIntegerField(default=7)
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
        if not self.pk or not hasattr(self, 'assignments'):
            return 0
        if hasattr(self, '_state') and 'assignments' in getattr(self._state, 'prefetch_cache', {}):
            return len(self.assignments.all())
        return self.assignments.count()
    
    @property
    def is_full(self):
        """Check if maximum groups have been assigned."""
        return self.assigned_count >= self.max_groups
    
    @property
    def available_slots(self):
        """Number of slots available for assignment."""
        return max(0, self.max_groups - self.assigned_count)


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
    slot_number = models.PositiveIntegerField(blank=True, null=True)
    slot_time = models.TimeField(blank=True, null=True)
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
        s2 = students.student_2 if students.student_2 else "N/A"
        return f"{students.student_1} & {s2} -> {self.external_group.name}"
    
    def save(self, *args, **kwargs):
        # Auto-assign slot number if not provided
        if self.slot_number is None:
            last_slot = ExternalGroupAssignment.objects.filter(
                external_group=self.external_group
            ).aggregate(models.Max('slot_number'))['slot_number__max']
            self.slot_number = (last_slot or 0) + 1
        super().save(*args, **kwargs)


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
    is_pass = models.BooleanField(default=False)
    
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


class Document(models.Model):
    DOCUMENT_TYPE_CHOICES = (
        ("scope_document", "Scope Document"),
        ("srs_document", "SRS Document"),
        ("sdd_document", "SDD Document"),
        ("final_report_document", "Final Report Document"),
        ("presentation_document", "Presentation Document"),
    )
    STATUS_CHOICES = (
        ("pending", "Pending"),
        ("accepted_by_student", "Accepted by Student"),
        ("accepted", "Accepted"),
        ("rejected", "Rejected"),
        ("canceled", "Canceled"),
    )
    group = models.ForeignKey(
        SupervisorOfStudentGroup, on_delete=models.CASCADE, related_name="documents"
    )
    uploaded_by = models.ForeignKey(
        Student, on_delete=models.CASCADE, related_name="uploaded_documents"
    )
    document_type = models.CharField(max_length=50, choices=DOCUMENT_TYPE_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")

    title = models.CharField(max_length=100)
    uploaded_file = models.FileField(upload_to="documents/")
    uploaded_at = models.DateTimeField(auto_now_add=True)

    # After supervisor accepts, student submits this version to committee (before deadline).
    # Committee sees only documents with submitted_to_committee=True; all phases stay between student and supervisor.
    submitted_to_committee = models.BooleanField(default=False)
    submitted_to_committee_at = models.DateTimeField(null=True, blank=True)


class CommitteeMemberTemplates(models.Model):
    TEMPLATE_TYPE_CHOICES = (
        ("scope_documents_template", "Scope Document Template"),
        ("srs_template", "SRS Template"),
        ("sdd_template", "SDD Template"),
        ("final_report_template", "Final Report Template"),
    )
    SEMESTER_CHOICES = (
        ("semester_6", "Semester 6"),
        ("semester_7", "Semester 7"),
        ("semester_8", "Semester 8"),
    )
    semester = models.CharField(max_length=100, choices=SEMESTER_CHOICES)
    template_type = models.CharField(max_length=50, choices=TEMPLATE_TYPE_CHOICES)
    uploaded_by = models.ForeignKey(
        CommitteeMember,
        on_delete=models.CASCADE,
        related_name="uploaded_templates",
        blank=True,
        null=True,
    )
    title = models.CharField(max_length=100)
    uploaded_file = models.FileField(upload_to="doc_templates/")
    uploaded_at = models.DateTimeField(auto_now_add=True)


class DocumentRequirement(models.Model):
    """Committee-defined document requirements and upload deadlines for students."""

    DOCUMENT_TYPE_CHOICES = (
        ("scope_document", "Scope Document"),
        ("srs_document", "SRS Document"),
        ("sdd_document", "SDD Document"),
        ("final_report_document", "Final Report Document"),
        ("presentation_document", "Presentation Document"),
    )
    SEMESTER_CHOICES = (
        ("semester_6", "Semester 6"),
        ("semester_7", "Semester 7"),
        ("semester_8", "Semester 8"),
    )

    document_type = models.CharField(max_length=50, choices=DOCUMENT_TYPE_CHOICES)
    title = models.CharField(max_length=200, help_text="Short label, e.g. 'SRS Submission - Phase 1'")
    deadline = models.DateTimeField(help_text="Upload deadline for this document type")
    semester = models.CharField(
        max_length=20,
        choices=SEMESTER_CHOICES,
        null=True,
        blank=True,
        help_text="If set, only students in this semester see this requirement",
    )
    created_by = models.ForeignKey(
        CommitteeMember,
        on_delete=models.SET_NULL,
        related_name="document_requirements",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["deadline", "document_type"]

    def __str__(self):
        return f"{self.get_document_type_display()} — {self.title} (due {self.deadline})"


class ChatRoom(models.Model):
    MESSAGE_BY_CHOICES = (
        ("student", "Student"),
        ("supervisor", "Supervisor"),
    )
    group = models.ForeignKey(
        SupervisorOfStudentGroup, on_delete=models.CASCADE, related_name="chat_messages"
    )
    student = models.ForeignKey(
        Student,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="student_messages",
    )
    supervisor = models.ForeignKey(
        Supervisor,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="supervisor_messages",
    )
    message = models.TextField()
    sent_by = models.CharField(max_length=20, choices=MESSAGE_BY_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.sent_by}: {self.message[:30]}"


class Notification(models.Model):
    """Model for storing user notifications."""
    
    NOTIFICATION_TYPE_CHOICES = (
        ("group_request", "Group Request"),
        ("group_request_accepted", "Group Request Accepted"),
        ("group_request_rejected", "Group Request Rejected"),
        ("supervisor_request", "Supervisor Request"),
        ("supervisor_request_accepted", "Supervisor Request Accepted"),
        ("supervisor_request_rejected", "Supervisor Request Rejected"),
        ("new_chat_message", "New Chat Message"),
        ("document_uploaded", "Document Uploaded"),
        ("document_approved", "Document Approved"),
        ("document_rejected", "Document Rejected"),
        ("evaluation_completed", "Evaluation Completed"),
        ("new_comment", "New Comment"),
        ("general", "General"),
    )
    
    user = models.ForeignKey(
        CustomUser,
        on_delete=models.CASCADE,
        related_name="notifications"
    )
    notification_type = models.CharField(
        max_length=50,
        choices=NOTIFICATION_TYPE_CHOICES,
        default="general"
    )
    title = models.CharField(max_length=255)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    # Optional reference to related objects
    related_group = models.ForeignKey(
        Group,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="notifications"
    )
    related_supervisor_group = models.ForeignKey(
        SupervisorOfStudentGroup,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="notifications"
    )
    related_document = models.ForeignKey(
        Document,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="notifications"
    )
    
    # URL to redirect to when notification is clicked
    action_url = models.CharField(max_length=255, blank=True, null=True)
    
    class Meta:
        ordering = ["-created_at"]
    
    def __str__(self):
        return f"{self.user.username} - {self.title}"
    
    def mark_as_read(self):
        """Mark the notification as read."""
        if not self.is_read:
            self.is_read = True
            self.save(update_fields=["is_read"])


class NotificationPreference(models.Model):
    """User preferences for notifications."""
    
    user = models.OneToOneField(
        CustomUser,
        on_delete=models.CASCADE,
        related_name="notification_preferences"
    )
    
    # In-app notification preferences
    group_request_notifications = models.BooleanField(default=True)
    supervisor_request_notifications = models.BooleanField(default=True)
    chat_message_notifications = models.BooleanField(default=True)
    document_notifications = models.BooleanField(default=True)
    evaluation_notifications = models.BooleanField(default=True)
    comment_notifications = models.BooleanField(default=True)
    
    # Email notification preferences (for future use)
    email_notifications_enabled = models.BooleanField(default=False)
    email_group_requests = models.BooleanField(default=False)
    email_supervisor_requests = models.BooleanField(default=False)
    email_document_updates = models.BooleanField(default=False)
    email_evaluation_updates = models.BooleanField(default=False)
    
    def __str__(self):
        return f"Notification preferences for {self.user.username}"


class AuditLog(models.Model):
    """Model for tracking changes to evaluation scores and other important data."""
    
    ACTION_TYPE_CHOICES = (
        ("evaluation_update", "Evaluation Update"),
        ("document_status_change", "Document Status Change"),
        ("group_status_change", "Group Status Change"),
        ("supervisor_request_update", "Supervisor Request Update"),
    )
    
    EVALUATION_TYPE_CHOICES = (
        ("scope_document", "Scope Document"),
        ("srs_supervisor", "SRS Supervisor"),
        ("srs_committee", "SRS Committee Member"),
        ("sdd_supervisor", "SDD Supervisor"),
        ("sdd_committee", "SDD Committee Member"),
        ("evaluation3_supervisor", "Evaluation 3 Supervisor"),
        ("evaluation3_committee", "Evaluation 3 Committee Member"),
        ("evaluation4_supervisor", "Evaluation 4 Supervisor"),
        ("evaluation4_committee", "Evaluation 4 Committee Member"),
    )
    
    # Who made the change
    user = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        related_name="audit_logs"
    )
    
    # Type of action
    action_type = models.CharField(
        max_length=50,
        choices=ACTION_TYPE_CHOICES,
        default="evaluation_update"
    )
    
    # For evaluation changes
    evaluation_type = models.CharField(
        max_length=50,
        choices=EVALUATION_TYPE_CHOICES,
        blank=True,
        null=True
    )
    
    # Reference to the affected group
    supervisor_group = models.ForeignKey(
        SupervisorOfStudentGroup,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="audit_logs"
    )
    
    # Description of what changed
    description = models.TextField()
    
    # Field that was changed
    field_name = models.CharField(max_length=100, blank=True, null=True)
    
    # Previous value (stored as JSON string for flexibility)
    old_value = models.TextField(blank=True, null=True)
    
    # New value (stored as JSON string for flexibility)
    new_value = models.TextField(blank=True, null=True)
    
    # When the change was made
    created_at = models.DateTimeField(auto_now_add=True)
    
    # IP address of the user (optional)
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    
    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Audit Log"
        verbose_name_plural = "Audit Logs"
    
    def __str__(self):
        return f"{self.user.username if self.user else 'Unknown'} - {self.action_type} - {self.created_at}"
    
    @classmethod
    def log_evaluation_change(
        cls,
        user,
        evaluation_type,
        supervisor_group,
        field_name,
        old_value,
        new_value,
        ip_address=None
    ):
        """Helper method to create an evaluation change audit log."""
        description = f"Changed {field_name} from '{old_value}' to '{new_value}'"
        return cls.objects.create(
            user=user,
            action_type="evaluation_update",
            evaluation_type=evaluation_type,
            supervisor_group=supervisor_group,
            description=description,
            field_name=field_name,
            old_value=str(old_value) if old_value is not None else None,
            new_value=str(new_value) if new_value is not None else None,
            ip_address=ip_address,
        )
    
    @classmethod
    def log_bulk_evaluation_changes(
        cls,
        user,
        evaluation_type,
        supervisor_group,
        changes,
        ip_address=None
    ):
        """
        Helper method to log multiple field changes in one evaluation.
        changes: list of tuples [(field_name, old_value, new_value), ...]
        """
        logs = []
        for field_name, old_value, new_value in changes:
            if old_value != new_value:
                description = f"Changed {field_name} from '{old_value}' to '{new_value}'"
                logs.append(cls(
                    user=user,
                    action_type="evaluation_update",
                    evaluation_type=evaluation_type,
                    supervisor_group=supervisor_group,
                    description=description,
                    field_name=field_name,
                    old_value=str(old_value) if old_value is not None else None,
                    new_value=str(new_value) if new_value is not None else None,
                    ip_address=ip_address,
                ))
        if logs:
            return cls.objects.bulk_create(logs)
        return []


# ==============================================================================
# UTC GRADUATION THESIS MANAGEMENT MODELS (Khoa CNTT - ĐH GTVT)
# ==============================================================================

class SupervisorQuota(models.Model):
    """Định mức chỉ tiêu hướng dẫn đồ án của Giảng viên theo kỳ"""
    supervisor = models.ForeignKey(
        Supervisor, on_delete=models.CASCADE, related_name="quotas"
    )
    batch = models.ForeignKey(
        AcademicBatch, on_delete=models.CASCADE, related_name="supervisor_quotas"
    )
    department = models.CharField(max_length=100, blank=True, null=True)
    viet_anh_quota = models.IntegerField(default=0, help_text="Chỉ tiêu lớp CLC Việt - Anh")
    general_cntt_quota = models.IntegerField(default=0, help_text="Chỉ tiêu lớp Đại trà & KHMT")
    max_total_quota = models.IntegerField(default=0, help_text="Tổng chỉ tiêu tối đa")
    current_assigned = models.IntegerField(default=0, help_text="Số lượng SV đã được phân")

    class Meta:
        unique_together = ("supervisor", "batch")
        ordering = ["supervisor__user__first_name", "supervisor__user__last_name"]

    def __str__(self):
        return f"{self.supervisor} - Quota: {self.max_total_quota} (VA: {self.viet_anh_quota}, CNTT: {self.general_cntt_quota}) [{self.batch.batch_code}]"


class ProjectTopicArea(models.Model):
    """8 Danh mục hướng nghiên cứu / làm đồ án chuẩn Khoa CNTT UTC"""
    name = models.CharField(max_length=255, unique=True)
    code = models.CharField(max_length=50, unique=True)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return self.name


class InternshipInfo(models.Model):
    """Thông tin khảo sát thực tập & đăng ký nguyện vọng đồ án của Sinh viên"""
    student = models.OneToOneField(
        Student, on_delete=models.CASCADE, related_name="internship_info"
    )
    batch = models.ForeignKey(
        AcademicBatch, on_delete=models.CASCADE, related_name="internship_submissions"
    )
    is_interning = models.BooleanField(default=False)
    company_name = models.CharField(max_length=255, blank=True, null=True)
    topic_direction = models.ForeignKey(
        ProjectTopicArea, on_delete=models.SET_NULL, null=True, blank=True, related_name="internships"
    )
    preferred_supervisor = models.ForeignKey(
        Supervisor, on_delete=models.SET_NULL, null=True, blank=True, related_name="preferred_by_students"
    )
    tentative_title = models.CharField(max_length=500, blank=True, null=True)
    submitted_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Khảo sát: {self.student} - Cty: {self.company_name or 'Chưa đi TT'}"


class DefenseCouncil(models.Model):
    """Hội đồng bảo vệ Đồ án tốt nghiệp"""
    SESSION_CHOICES = (
        ("MORNING", "Ca sáng"),
        ("AFTERNOON", "Ca chiều"),
    )
    batch = models.ForeignKey(
        AcademicBatch, on_delete=models.CASCADE, related_name="defense_councils"
    )
    council_number = models.IntegerField(default=1)
    council_name = models.CharField(max_length=255)
    session_date = models.DateField(null=True, blank=True)
    session_time = models.CharField(max_length=50, choices=SESSION_CHOICES, default="MORNING")
    defense_room = models.CharField(max_length=100, blank=True, null=True)
    current_defending_project = models.ForeignKey(
        "GraduationProject",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="active_defense_councils",
        help_text="Đề tài / Sinh viên đang trên bục bảo vệ trực tiếp"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["batch", "council_number"]

    def __str__(self):
        return f"{self.council_name} (HĐ {self.council_number}) - Phòng {self.defense_room or 'TBA'}"


class CouncilMember(models.Model):
    """Thành viên Hội đồng bảo vệ (Chủ tịch, Thư ký, Ủy viên, Ủy viên ngoài trường)"""
    ROLE_CHOICES = (
        ("CHAIR", "Chủ tịch hội đồng"),
        ("SECRETARY", "Ủy viên, Thư ký"),
        ("MEMBER", "Ủy viên"),
        ("EXTERNAL_MEMBER", "Ủy viên ngoài trường"),
    )
    council = models.ForeignKey(
        DefenseCouncil, on_delete=models.CASCADE, related_name="members"
    )
    supervisor = models.ForeignKey(
        Supervisor, on_delete=models.SET_NULL, null=True, blank=True, related_name="council_memberships"
    )
    user = models.ForeignKey(
        CustomUser, on_delete=models.CASCADE, related_name="council_roles"
    )
    role = models.CharField(max_length=50, choices=ROLE_CHOICES, default="MEMBER")
    external_institution = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        unique_together = ("council", "user")

    def __str__(self):
        return f"{self.user.get_full_name() or self.user.username} - {self.get_role_display()} ({self.council.council_name})"


class GraduationProject(models.Model):
    """Đồ án tốt nghiệp cá nhân (1 Sinh viên / 1 Đề tài / 1 GVHD)"""
    STATUS_CHOICES = (
        ("ALLOCATED", "Đã phân GVHD"),
        ("OUTLINE_PENDING", "Chờ duyệt đề cương"),
        ("OUTLINE_REVISION", "Yêu cầu sửa đề cương"),
        ("OUTLINE_APPROVED", "Đề cương đã duyệt"),
        ("IN_PROGRESS", "Đang thực hiện đồ án"),
        ("DEFENSE_READY", "Đủ điều kiện bảo vệ"),
        ("DEFENDING", "Đang bảo vệ"),
        ("PASSED", "Bảo vệ thành công - Đạt"),
        ("FAILED", "Không đạt"),
        ("DEFERRED", "Bảo lưu đồ án"),
    )
    DEFENSE_STATUS_CHOICES = (
        ("WAITING", "Chờ bảo vệ"),
        ("DEFENDING", "Đang bảo vệ"),
        ("DEFENDED", "Đã bảo vệ"),
    )
    student = models.OneToOneField(
        Student, on_delete=models.CASCADE, related_name="graduation_project"
    )
    supervisor = models.ForeignKey(
        Supervisor, on_delete=models.CASCADE, related_name="supervised_graduation_projects"
    )
    batch = models.ForeignKey(
        AcademicBatch, on_delete=models.CASCADE, related_name="graduation_projects"
    )
    topic_category = models.ForeignKey(
        ProjectTopicArea, on_delete=models.SET_NULL, null=True, blank=True, related_name="projects"
    )
    topic_title_vi = models.CharField(max_length=500)
    topic_title_en = models.CharField(max_length=500, blank=True, null=True)
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default="ALLOCATED")
    defense_status = models.CharField(max_length=50, choices=DEFENSE_STATUS_CHOICES, default="WAITING")
    
    # Reviewer and Council
    reviewer = models.ForeignKey(
        Supervisor, on_delete=models.SET_NULL, null=True, blank=True, related_name="reviewed_graduation_projects"
    )
    council = models.ForeignKey(
        DefenseCouncil, on_delete=models.SET_NULL, null=True, blank=True, related_name="projects"
    )
    
    # Supervisor Evaluation
    supervisor_score = models.FloatField(null=True, blank=True)
    supervisor_feedback = models.TextField(blank=True, null=True)
    is_eligible_for_defense = models.BooleanField(default=False)
    
    # Reviewer Evaluation
    reviewer_score = models.FloatField(null=True, blank=True)
    reviewer_feedback = models.TextField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["student__user__last_name", "student__user__first_name"]

    def __str__(self):
        return f"{self.topic_title_vi} - SV: {self.student.user.get_full_name()} (GVHD: {self.supervisor})"


class OutlineReviewGroup(models.Model):
    """Nhóm Giảng viên chuyên môn xét duyệt đề cương (CNPM, Mạng & HTTT, KHMT)"""
    batch = models.ForeignKey(
        AcademicBatch, on_delete=models.CASCADE, related_name="outline_review_groups"
    )
    name = models.CharField(max_length=255)
    department = models.CharField(max_length=100)
    members = models.ManyToManyField(
        Supervisor, related_name="outline_groups", blank=True
    )

    def __str__(self):
        return f"{self.name} - {self.department} ({self.batch.batch_code})"


class OutlineReview(models.Model):
    """Biên bản xét duyệt đề cương đồ án"""
    VERDICT_CHOICES = (
        ("PENDING", "Chờ xét duyệt"),
        ("APPROVED", "Đạt yêu cầu"),
        ("REVISION_REQUIRED", "Yêu cầu chỉnh sửa"),
        ("REJECTED", "Không đạt / Hủy đề tài"),
    )
    project = models.OneToOneField(
        GraduationProject, on_delete=models.CASCADE, related_name="outline_review"
    )
    review_group = models.ForeignKey(
        OutlineReviewGroup, on_delete=models.SET_NULL, null=True, blank=True, related_name="reviewed_outlines"
    )
    reviewer = models.ForeignKey(
        Supervisor, on_delete=models.SET_NULL, null=True, blank=True, related_name="assigned_outline_reviews"
    )
    outline_file = models.FileField(upload_to="outlines/", null=True, blank=True)
    verdict = models.CharField(max_length=50, choices=VERDICT_CHOICES, default="PENDING")
    comments = models.TextField(blank=True, null=True)
    submitted_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Duyệt đề cương: {self.project.topic_title_vi} -> {self.get_verdict_display()}"


class WeeklyProgressReport(models.Model):
    """Báo cáo tiến độ tuần của Sinh viên (Tuần 1 -> 15)"""
    RATING_CHOICES = (
        ("PENDING", "Chưa đánh giá"),
        ("GOOD", "Tốt / Đạt tiến độ"),
        ("ACCEPTABLE", "Chấp nhận được"),
        ("LATE", "Chậm tiến độ"),
        ("UNSATISFACTORY", "Không đạt yêu cầu"),
    )
    project = models.ForeignKey(
        GraduationProject, on_delete=models.CASCADE, related_name="weekly_reports"
    )
    week_number = models.IntegerField()
    summary_content = models.TextField()
    planned_tasks = models.TextField(blank=True, null=True)
    git_commit_link = models.URLField(max_length=500, blank=True, null=True)
    attached_file = models.FileField(upload_to="weekly_reports/", null=True, blank=True)
    
    supervisor_feedback = models.TextField(blank=True, null=True)
    supervisor_rating = models.CharField(max_length=50, choices=RATING_CHOICES, default="PENDING")
    
    submitted_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ("project", "week_number")
        ordering = ["project", "week_number"]

    def __str__(self):
        return f"{self.project.student.registration_no} - Tuần {self.week_number} ({self.get_supervisor_rating_display()})"


class SupervisionMeetingLog(models.Model):
    """Nhật ký các buổi họp / làm việc định kỳ giữa Giảng viên hướng dẫn và Sinh viên"""
    MEETING_TYPE_CHOICES = (
        ("OFFLINE", "Gặp trực tiếp"),
        ("ONLINE", "Trực tuyến (Meet/Zoom)"),
    )
    project = models.ForeignKey(
        GraduationProject, on_delete=models.CASCADE, related_name="meeting_logs"
    )
    meeting_date = models.DateField()
    meeting_time = models.CharField(max_length=100, blank=True, default="09:00 - 10:30")
    meeting_type = models.CharField(max_length=50, choices=MEETING_TYPE_CHOICES, default="OFFLINE")
    location_or_link = models.CharField(max_length=255, blank=True, null=True)
    content_discussed = models.TextField(help_text="Nội dung đã trao đổi, tiến độ công việc")
    supervisor_notes = models.TextField(blank=True, null=True, help_text="Nhận xét / Góp ý của GVHD")
    next_meeting_plan = models.TextField(blank=True, null=True, help_text="Kế hoạch và mục tiêu cho buổi gặp tiếp theo")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-meeting_date", "-created_at"]

    def __str__(self):
        return f"Nhật ký HD: {self.project.student.registration_no} - {self.meeting_date} ({self.get_meeting_type_display()})"


class SupervisionTask(models.Model):
    """Nhiệm vụ / Công việc được GVHD giao cho Sinh viên theo dõi trên Task Board"""
    PRIORITY_CHOICES = (
        ("LOW", "Thấp"),
        ("MEDIUM", "Trung bình"),
        ("HIGH", "Cao"),
        ("URGENT", "Khẩn cấp"),
    )
    STATUS_CHOICES = (
        ("TODO", "Cần làm"),
        ("IN_PROGRESS", "Đang thực hiện"),
        ("COMPLETED", "Đã hoàn thành"),
    )
    project = models.ForeignKey(
        GraduationProject, on_delete=models.CASCADE, related_name="tasks"
    )
    meeting_log = models.ForeignKey(
        SupervisionMeetingLog, on_delete=models.SET_NULL, null=True, blank=True, related_name="tasks"
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    assigned_by = models.ForeignKey(
        Supervisor, on_delete=models.CASCADE, related_name="assigned_tasks"
    )
    due_date = models.DateField(null=True, blank=True)
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default="MEDIUM")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="TODO")
    is_completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)
    student_notes = models.TextField(blank=True, null=True, help_text="Ghi chú, link commit hoặc báo cáo kết quả của SV")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["is_completed", "due_date", "-created_at"]

    def __str__(self):
        return f"Task: {self.title} -> {self.project.student.registration_no} [{self.get_status_display()}]"


class CouncilLiveScore(models.Model):
    """Điểm chấm trực tiếp của từng thành viên Hội đồng trong buổi bảo vệ"""
    council = models.ForeignKey(
        DefenseCouncil, on_delete=models.CASCADE, related_name="live_scores"
    )
    project = models.ForeignKey(
        GraduationProject, on_delete=models.CASCADE, related_name="council_scores"
    )
    member = models.ForeignKey(
        CouncilMember, on_delete=models.CASCADE, related_name="given_scores"
    )
    score_presentation = models.FloatField(default=0.0, help_text="Kỹ năng thuyết trình & Báo cáo")
    score_content = models.FloatField(default=0.0, help_text="Chất lượng nội dung chuyên môn")
    score_qa = models.FloatField(default=0.0, help_text="Trả lời câu hỏi phản biện")
    score_demo = models.FloatField(default=0.0, help_text="Sản phẩm Demo / Ứng dụng")
    total_score = models.FloatField(default=0.0)
    comments = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("project", "member")

    def save(self, *args, **kwargs):
        # Auto-calculate total score
        self.total_score = round(
            float(self.score_presentation) + float(self.score_content) + float(self.score_qa) + float(self.score_demo), 2
        )
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.member.user.get_full_name()} -> {self.project.student}: {self.total_score}đ"


class EvaluationPolicy(models.Model):
    """Trọng số tính điểm tổng kết bảo vệ theo kỳ học (Mặc định chuẩn UTC: 40% GVHD + 20% GVPB + 40% HĐ)"""
    batch = models.OneToOneField(
        AcademicBatch, on_delete=models.CASCADE, related_name="evaluation_policy"
    )
    weight_supervisor = models.FloatField(default=0.4)
    weight_reviewer = models.FloatField(default=0.2)
    weight_council = models.FloatField(default=0.4)

    def clean(self):
        total = round(self.weight_supervisor + self.weight_reviewer + self.weight_council, 2)
        if total != 1.0:
            from django.core.exceptions import ValidationError
            raise ValidationError("Tổng các trọng số phải bằng 1.0 (100%)")

    def __str__(self):
        return f"Policy {self.batch.batch_code}: GVHD {int(self.weight_supervisor*100)}% - GVPB {int(self.weight_reviewer*100)}% - HĐ {int(self.weight_council*100)}%"


class FinalGradeSummary(models.Model):
    """Bảng điểm tổng hợp cuối cùng của Đồ án Tốt nghiệp"""
    project = models.OneToOneField(
        GraduationProject, on_delete=models.CASCADE, related_name="final_grade_summary"
    )
    supervisor_score = models.FloatField(null=True, blank=True)
    reviewer_score = models.FloatField(null=True, blank=True)
    council_avg_score = models.FloatField(null=True, blank=True)
    final_score_10 = models.FloatField(null=True, blank=True)
    final_score_4 = models.FloatField(null=True, blank=True)
    final_letter_grade = models.CharField(max_length=10, blank=True, null=True)
    classification = models.CharField(max_length=50, blank=True, null=True)
    is_passed = models.BooleanField(default=False)
    is_finalized = models.BooleanField(default=False)
    notes = models.TextField(blank=True, null=True)
    updated_at = models.DateTimeField(auto_now=True)

    def calculate_and_save(self, policy=None):
        """Tính toán quy đổi điểm theo chuẩn UTC"""
        w_sup = policy.weight_supervisor if policy else 0.4
        w_rev = policy.weight_reviewer if policy else 0.2
        w_cou = policy.weight_council if policy else 0.4

        s_sup = self.supervisor_score or 0.0
        s_rev = self.reviewer_score or 0.0
        s_cou = self.council_avg_score or 0.0

        score10 = round((s_sup * w_sup) + (s_rev * w_rev) + (s_cou * w_cou), 2)
        self.final_score_10 = score10

        # Thang 4 & Điểm chữ theo Quy chế UTC
        if score10 >= 9.0:
            self.final_score_4 = 4.0
            self.final_letter_grade = "A+"
            self.classification = "Xuất sắc"
            self.is_passed = True
        elif score10 >= 8.5:
            self.final_score_4 = 4.0
            self.final_letter_grade = "A"
            self.classification = "Giỏi"
            self.is_passed = True
        elif score10 >= 8.0:
            self.final_score_4 = 3.5
            self.final_letter_grade = "B+"
            self.classification = "Khá giỏi"
            self.is_passed = True
        elif score10 >= 7.0:
            self.final_score_4 = 3.0
            self.final_letter_grade = "B"
            self.classification = "Khá"
            self.is_passed = True
        elif score10 >= 6.5:
            self.final_score_4 = 2.5
            self.final_letter_grade = "C+"
            self.classification = "Trung bình khá"
            self.is_passed = True
        elif score10 >= 5.5:
            self.final_score_4 = 2.0
            self.final_letter_grade = "C"
            self.classification = "Trung bình"
            self.is_passed = True
        elif score10 >= 5.0:
            self.final_score_4 = 1.5
            self.final_letter_grade = "D+"
            self.classification = "Trung bình yếu"
            self.is_passed = True
        elif score10 >= 4.0:
            self.final_score_4 = 1.0
            self.final_letter_grade = "D"
            self.classification = "Yếu"
            self.is_passed = True
        else:
            self.final_score_4 = 0.0
            self.final_letter_grade = "F"
            self.classification = "Kém (Không đạt)"
            self.is_passed = False

        self.save()

    def __str__(self):
        return f"Điểm tổng kết: {self.project.student} -> {self.final_score_10}đ ({self.final_letter_grade})"

