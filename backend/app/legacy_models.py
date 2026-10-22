import sys
from django.db import models
from django.utils import timezone
from .models import CustomUser, Student, Supervisor, AcademicBatch, GraduationProject

IS_TESTING = ("test" in sys.argv or "pytest" in sys.argv[0])



class PasswordResetCode(models.Model):
    """Model to store 6-digit password reset codes sent via email."""
    user = models.ForeignKey(
        CustomUser, on_delete=models.DO_NOTHING, related_name="password_reset_codes"
    )
    code = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)

    class Meta:
        managed = False
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


class DegreeProgram(models.TextChoices):
    BACHELOR = "BACHELOR", "Cử nhân"
    ENGINEER = "ENGINEER", "Kỹ sư"


class ProjectCategories(models.Model):
    category_name = models.CharField(max_length=100)


    class Meta:
        managed = False

    def __str__(self):
        return self.category_name


class Group(models.Model):
    STATUS_CHOICES = (
        ("pending", "Pending"),
        ("accepted", "Accepted"),
        ("rejected", "Rejected"),
        ("canceled", "Canceled"),
    )
    TOPIC_STATUS_CHOICES = (
        ("NOT_REGISTERED", "Chưa đăng ký đề tài"),
        ("PENDING_REVIEW", "Chờ duyệt đề tài"),
        ("REVISION_REQUESTED", "Yêu cầu chỉnh sửa"),
        ("APPROVED", "Đã phê duyệt chính thức"),
        ("REJECTED", "Từ chối"),
    )

    group_name = models.CharField(max_length=255, null=True, blank=True)
    academic_batch = models.ForeignKey(
        AcademicBatch, on_delete=models.DO_NOTHING, null=True, blank=True, related_name="academic_groups"
    )
    leader = models.ForeignKey(
        Student, on_delete=models.DO_NOTHING, null=True, blank=True, related_name="led_groups"
    )
    max_members = models.PositiveSmallIntegerField(default=3)
    is_recruiting = models.BooleanField(default=True)
    tentative_topic = models.CharField(max_length=500, blank=True, default="")
    tentative_description = models.TextField(blank=True, default="")
    topic_status = models.CharField(
        max_length=30, choices=TOPIC_STATUS_CHOICES, default="NOT_REGISTERED", db_index=True
    )
    topic_revision_notes = models.TextField(blank=True, default="")

    student_1 = models.ForeignKey(
        Student, on_delete=models.DO_NOTHING, related_name="send_request", null=True, blank=True
    )
    student_2 = models.ForeignKey(
        Student, on_delete=models.DO_NOTHING, related_name="receive_request", null=True, blank=True
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending", db_index=True)
    project_category = models.ForeignKey(
        ProjectCategories, on_delete=models.DO_NOTHING, related_name="groupmate_project", null=True, blank=True
    )

    class Meta:
        managed = False
    def current_members_count(self):
        count = self.members.count()
        if count > 0:
            return count
        c = 0
        if self.student_1:
            c += 1
        if self.student_2:
            c += 1
        return c

    @property
    def is_full(self):
        return self.current_members_count >= self.max_members

    def __str__(self):
        name = self.group_name or f"Group #{self.id}"
        return f"{name} ({self.current_members_count}/{self.max_members})"


class GroupMember(models.Model):
    ROLE_CHOICES = (
        ("LEADER", "Trưởng nhóm"),
        ("MEMBER", "Thành viên"),
    )
    group = models.ForeignKey(
        Group, on_delete=models.DO_NOTHING, related_name="members"
    )
    student = models.ForeignKey(
        Student, on_delete=models.DO_NOTHING, related_name="group_memberships"
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="MEMBER")
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
    def __str__(self):
        return f"{self.student} - {self.group.group_name or self.group.id} ({self.role})"


class GroupJoinRequest(models.Model):
    STATUS_CHOICES = (
        ("PENDING", "Chờ duyệt"),
        ("ACCEPTED", "Đã duyệt"),
        ("REJECTED", "Từ chối"),
        ("CANCELED", "Đã hủy"),
    )
    group = models.ForeignKey(
        Group, on_delete=models.DO_NOTHING, related_name="join_requests"
    )
    student = models.ForeignKey(
        Student, on_delete=models.DO_NOTHING, related_name="student_join_requests"
    )
    message = models.TextField(blank=True, default="")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="PENDING")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        managed = False
    def __str__(self):
        return f"{self.student} -> {self.group.group_name or self.group.id} ({self.status})"


class GroupCreationComment(models.Model):
    group = models.ForeignKey(Group, on_delete=models.DO_NOTHING, related_name="comments")
    student = models.ForeignKey(
        Student, on_delete=models.DO_NOTHING, related_name="comments"
    )
    comment = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)


    class Meta:
        managed = False

    def __str__(self):
        return f"{self.student} - {self.comment}"


class CommitteeMemberPanel(models.Model):
    name = models.CharField(max_length=100, blank=True, null=True)


    class Meta:
        managed = False

    def __str__(self):
        return self.name if self.name else "Committee Member Panel"


class Project(models.Model):
    project_category = models.ForeignKey(
        ProjectCategories, on_delete=models.DO_NOTHING, related_name="project_category"
    )
    panel = models.ForeignKey(
        CommitteeMemberPanel,
        on_delete=models.DO_NOTHING,
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
        on_delete=models.DO_NOTHING,
        related_name="projects",
        null=True,
        blank=True,
    )


    class Meta:
        managed = False

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
    is_draft = models.BooleanField(default=False)


    class Meta:
        managed = False

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
    is_draft = models.BooleanField(default=False)

    @staticmethod

    class Meta:
        managed = False

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

    class Meta:
        managed = False

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
    is_draft = models.BooleanField(default=False)

    @staticmethod

    class Meta:
        managed = False

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

    class Meta:
        managed = False

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
    is_draft = models.BooleanField(default=False)

    @staticmethod

    class Meta:
        managed = False

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

    class Meta:
        managed = False

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
    is_draft = models.BooleanField(default=False)

    @staticmethod

    class Meta:
        managed = False

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

    class Meta:
        managed = False

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
        Group, on_delete=models.DO_NOTHING, related_name="supervisor_request"
    )
    supervisor = models.ForeignKey(
        Supervisor, on_delete=models.DO_NOTHING, related_name="group_request"
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    project = models.ForeignKey(
        Project, on_delete=models.DO_NOTHING, related_name="groups"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        Student, on_delete=models.DO_NOTHING, related_name="supervisor_request_created_by"
    )
    Scope_document_evaluation_form = models.OneToOneField(
        ScopeDocumentEvaluationCriteria,
        on_delete=models.DO_NOTHING,
        related_name="scope_document_evaluation_form",
        blank=True,
        null=True,
    )
    srs_evaluation_supervisor = models.OneToOneField(
        SRSEvaluationSupervisor,
        on_delete=models.DO_NOTHING,
        related_name="supervisor_of_students",
        blank=True,
        null=True,
    )
    srs_evaluation_committee_member = models.OneToOneField(
        SRSEvaluationCommitteeMember,
        on_delete=models.DO_NOTHING,
        related_name="supervisor_of_students",
        blank=True,
        null=True,
    )
    sdd_evaluation_supervisor = models.OneToOneField(
        SDDEvaluationSupervisor,
        on_delete=models.DO_NOTHING,
        related_name="supervisor_of_students",
        blank=True,
        null=True,
    )
    sdd_evaluation_committee_member = models.OneToOneField(
        SDDEvaluationCommitteeMember,
        on_delete=models.DO_NOTHING,
        related_name="supervisor_of_students",
        blank=True,
        null=True,
    )
    evaluation3_supervisor = models.OneToOneField(
        Evaluation3Supervisor,
        on_delete=models.DO_NOTHING,
        related_name="supervisor_of_students",
        blank=True,
        null=True,
    )
    evaluation3_committee_member = models.OneToOneField(
        Evaluation3CommitteeMember,
        on_delete=models.DO_NOTHING,
        related_name="supervisor_of_students",
        blank=True,
        null=True,
    )
    evaluation4_supervisor = models.OneToOneField(
        Evaluation4Supervisor,
        on_delete=models.DO_NOTHING,
        related_name="supervisor_of_students",
        blank=True,
        null=True,
    )
    evaluation4_committee_member = models.OneToOneField(
        Evaluation4CommitteeMember,
        on_delete=models.DO_NOTHING,
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
        managed = False
    def __str__(self):
        return f"{self.group} - {self.supervisor} - {self.status}"


class SupervisorStudentComments(models.Model):
    COMMENT_BY_CHOICES = (
        ("student", "Student"),
        ("supervisor", "Supervisor"),
    )
    student = models.ForeignKey(
        Student,
        on_delete=models.DO_NOTHING,
        null=True,
        blank=True,
        related_name="student_comments",
    )
    supervisor = models.ForeignKey(
        Supervisor,
        on_delete=models.DO_NOTHING,
        null=True,
        blank=True,
        related_name="supervisor_comments",
    )
    group = models.ForeignKey(
        Group, on_delete=models.DO_NOTHING, related_name="group_comments"
    )
    comment = models.TextField()
    commented_by = models.CharField(
        max_length=20, choices=COMMENT_BY_CHOICES, default="student"
    )
    created_at = models.DateTimeField(auto_now_add=True)


    class Meta:
        managed = False

    def __str__(self):
        return f"{self.supervisor} - {self.student} - {self.comment}"


class CommitteeMember(models.Model):
    user = models.OneToOneField(
        CustomUser, on_delete=models.DO_NOTHING, related_name="committee_member_profile"
    )
    committee_id = models.CharField(max_length=100, unique=True)
    panel = models.ForeignKey(
        CommitteeMemberPanel, on_delete=models.DO_NOTHING, related_name="committee_member"
    )


    class Meta:
        managed = False

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
        on_delete=models.DO_NOTHING,
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
        managed = False
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
        on_delete=models.DO_NOTHING,
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
        on_delete=models.DO_NOTHING,
        null=True,
        related_name="created_external_groups"
    )
    
    class Meta:
        managed = False
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
        on_delete=models.DO_NOTHING,
        related_name="assignments"
    )
    supervisor_group = models.OneToOneField(
        'SupervisorOfStudentGroup',
        on_delete=models.DO_NOTHING,
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
        on_delete=models.DO_NOTHING,
        null=True,
        related_name="external_assignments_created"
    )
    
    class Meta:
        managed = False
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
        on_delete=models.DO_NOTHING,
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
        managed = False
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
        on_delete=models.DO_NOTHING,
        null=True,
        blank=True,
        related_name="schedules"
    )
    
    # For internal evaluations
    panel = models.ForeignKey(
        'CommitteeMemberPanel',
        on_delete=models.DO_NOTHING,
        null=True,
        blank=True,
        related_name="schedules"
    )
    
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        CustomUser,
        on_delete=models.DO_NOTHING,
        null=True,
        related_name="created_schedules"
    )
    
    class Meta:
        managed = False
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
        SupervisorOfStudentGroup, on_delete=models.DO_NOTHING, related_name="documents"
    )
    uploaded_by = models.ForeignKey(
        Student, on_delete=models.DO_NOTHING, related_name="uploaded_documents"
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
    is_late = models.BooleanField(default=False, help_text="Đánh dấu bài nộp muộn sau deadline")
    late_duration = models.CharField(
        max_length=100, blank=True, null=True, help_text="Thời gian nộp muộn (ví dụ: Trễ 2 giờ 15 phút)"
    )



    class Meta:
        managed = False


class DocumentComment(models.Model):
    document = models.ForeignKey(
        Document, on_delete=models.DO_NOTHING, related_name="comments"
    )
    author = models.ForeignKey(
        CustomUser, on_delete=models.DO_NOTHING, related_name="document_comments"
    )
    section = models.CharField(
        max_length=100, default="general", help_text="Mục nhận xét (general, format, content, requirements,...)"
    )
    comment = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
    def __str__(self):
        return f"{self.author.username} on {self.document.title} ({self.section}): {self.comment[:30]}"


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
        on_delete=models.DO_NOTHING,
        related_name="uploaded_templates",
        blank=True,
        null=True,
    )
    title = models.CharField(max_length=100)
    uploaded_file = models.FileField(upload_to="doc_templates/")
    uploaded_at = models.DateTimeField(auto_now_add=True)



    class Meta:
        managed = False


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
    allow_late_submission = models.BooleanField(
        default=False,
        help_text="Cho phép sinh viên nộp sau deadline (nếu bật: nộp được và gắn nhãn Late; nếu tắt: khóa nộp)",
    )
    semester = models.CharField(
        max_length=20,
        choices=SEMESTER_CHOICES,
        null=True,
        blank=True,
        help_text="If set, only students in this semester see this requirement",
    )
    created_by = models.ForeignKey(
        CommitteeMember,
        on_delete=models.DO_NOTHING,
        related_name="document_requirements",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        managed = False
    def __str__(self):
        return f"{self.get_document_type_display()} — {self.title} (due {self.deadline})"


class ChatRoom(models.Model):
    MESSAGE_BY_CHOICES = (
        ("student", "Student"),
        ("supervisor", "Supervisor"),
    )
    group = models.ForeignKey(
        SupervisorOfStudentGroup, on_delete=models.DO_NOTHING, related_name="chat_messages"
    )
    student = models.ForeignKey(
        Student,
        on_delete=models.DO_NOTHING,
        null=True,
        blank=True,
        related_name="student_messages",
    )
    supervisor = models.ForeignKey(
        Supervisor,
        on_delete=models.DO_NOTHING,
        null=True,
        blank=True,
        related_name="supervisor_messages",
    )
    message = models.TextField(blank=True, default="")
    attachment = models.FileField(upload_to="chat_attachments/", blank=True, null=True)
    attachment_name = models.CharField(max_length=255, blank=True, null=True)
    attachment_type = models.CharField(max_length=100, blank=True, null=True)
    attachment_size = models.PositiveIntegerField(blank=True, null=True)
    sent_by = models.CharField(max_length=20, choices=MESSAGE_BY_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)


    class Meta:
        managed = False

    def __str__(self):
        return f"{self.sent_by}: {self.message[:30]}"


class NotificationPreference(models.Model):
    """User preferences for notifications."""
    
    user = models.OneToOneField(
        CustomUser,
        on_delete=models.DO_NOTHING,
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
    

    class Meta:
        managed = False

    def __str__(self):
        return f"Notification preferences for {self.user.username}"


class ProposedAllocation(models.Model):
    """Bảng đề xuất phân công hướng dẫn đồ án (hệ thống tính toán trước khi Khoa duyệt/override)"""
    batch = models.ForeignKey(
        AcademicBatch, on_delete=models.DO_NOTHING, related_name="proposed_allocations"
    )
    student = models.ForeignKey(
        Student, on_delete=models.DO_NOTHING, related_name="proposed_assignments"
    )
    supervisor = models.ForeignKey(
        Supervisor, on_delete=models.DO_NOTHING, related_name="proposed_students"
    )
    matched_preference = models.IntegerField(default=1, help_text="Khớp NV1 (1), NV2 (2), NV3 (3) hoặc Hệ thống gán (0)")
    match_score = models.FloatField(default=0.0)
    is_overridden = models.BooleanField(default=False)
    override_reason = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = IS_TESTING
        db_table = "app_proposedallocation"
    def __str__(self):
        return f"Đề xuất: SV {self.student.registration_no} -> GV {self.supervisor} (NV{self.matched_preference})"


class SystemBugReport(models.Model):
    """Báo cáo lỗi và phản hồi hệ thống từ người dùng (kèm ảnh chụp màn hình)"""
    STATUS_CHOICES = (
        ("PENDING", "Đang chờ xử lý"),
        ("IN_PROGRESS", "Đang xử lý"),
        ("RESOLVED", "Đã giải quyết"),
        ("CLOSED", "Đã đóng"),
    )
    user = models.ForeignKey(
        CustomUser, on_delete=models.DO_NOTHING, null=True, blank=True, related_name="bug_reports"
    )
    title = models.CharField(max_length=255, blank=True, default="Báo lỗi hệ thống")
    description = models.TextField(help_text="Mô tả chi tiết lỗi gặp phải")
    page_url = models.CharField(max_length=500, blank=True, default="")
    screenshot = models.FileField(upload_to="bug_reports/", null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="PENDING")
    admin_notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        managed = False
    def __str__(self):
        username = self.user.username if self.user else "Khách"
        return f"BugReport #{self.id} từ {username} ({self.get_status_display()})"
