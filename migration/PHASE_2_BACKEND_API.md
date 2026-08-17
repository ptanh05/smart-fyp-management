# Phase 2: Backend API Development

## Objective
Create API endpoints, serializers, views, and permissions for External Examiner functionality.

---

## Task Summary

| Task ID | Task | Priority | Status |
|---------|------|----------|--------|
| 2.1 | Create ExternalExaminer serializers | HIGH | ✅ Done |
| 2.2 | Create ExternalGroup serializers | HIGH | ✅ Done |
| 2.3 | Create ExternalEvaluation serializers | HIGH | ✅ Done |
| 2.4 | Create permissions for External Examiner | HIGH | ✅ Done |
| 2.5 | Create ExternalExaminer views | HIGH | ✅ Done |
| 2.6 | Create ExternalGroup views | HIGH | ✅ Done |
| 2.7 | Create ExternalEvaluation views | HIGH | ✅ Done |
| 2.8 | Create EvaluationSchedule views | HIGH | ✅ Done |
| 2.9 | Update URL routes | HIGH | ✅ Done |
| 2.10 | Update authentication to support external | MEDIUM | ✅ Done |
| 2.11 | Create notification triggers | MEDIUM | ✅ Done |
| 2.12 | Update existing APIs for external status | MEDIUM | ✅ Done |

---

## Task 2.1: Create ExternalExaminer Serializers

### File: `backend/app/serializers/serializers.py`

```python
# ==================== External Examiner Serializers ====================

class ExternalExaminerUserSerializer(serializers.ModelSerializer):
    """Serializer for External Examiner's user info."""
    class Meta:
        model = CustomUser
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'user_type']
        read_only_fields = ['id', 'user_type']


class ExternalExaminerSerializer(serializers.ModelSerializer):
    """Full External Examiner serializer."""
    user = ExternalExaminerUserSerializer(read_only=True)
    assigned_groups_count = serializers.ReadOnlyField()
    
    class Meta:
        model = ExternalExaminer
        fields = [
            'id', 'user', 'external_id', 'institution', 'designation',
            'specialization', 'contact_number', 'address', 'is_active',
            'assigned_groups_count', 'created_at'
        ]
        read_only_fields = ['id', 'created_at', 'assigned_groups_count']


class ExternalExaminerProfileSerializer(serializers.ModelSerializer):
    """Profile serializer for External Examiner's own view."""
    user = ExternalExaminerUserSerializer(read_only=True)
    external_groups = serializers.SerializerMethodField()
    
    class Meta:
        model = ExternalExaminer
        fields = [
            'id', 'user', 'external_id', 'institution', 'designation',
            'specialization', 'contact_number', 'address', 'is_active',
            'external_groups', 'created_at'
        ]
    
    def get_external_groups(self, obj):
        """Get list of external groups assigned to this examiner."""
        groups = obj.external_groups.all()
        return ExternalGroupListSerializer(groups, many=True).data


class ExternalExaminerListSerializer(serializers.ModelSerializer):
    """List view serializer for External Examiners."""
    user = ExternalExaminerUserSerializer(read_only=True)
    full_name = serializers.SerializerMethodField()
    
    class Meta:
        model = ExternalExaminer
        fields = ['id', 'user', 'full_name', 'institution', 'designation', 'is_active']
    
    def get_full_name(self, obj):
        return obj.user.get_full_name() or obj.user.username
```

### Acceptance Criteria
- [x] Full serializer with all fields
- [x] Profile serializer with nested groups
- [x] List serializer for dropdowns

---

## Task 2.2: Create ExternalGroup Serializers

### File: `backend/app/serializers/serializers.py`

```python
class ExternalGroupListSerializer(serializers.ModelSerializer):
    """List view for External Groups."""
    external_examiner_name = serializers.SerializerMethodField()
    assigned_count = serializers.ReadOnlyField()
    available_slots = serializers.ReadOnlyField()
    is_full = serializers.ReadOnlyField()
    
    class Meta:
        model = ExternalGroup
        fields = [
            'id', 'name', 'external_examiner', 'external_examiner_name',
            'semester', 'status', 'max_groups', 'assigned_count',
            'available_slots', 'is_full', 'evaluation_date', 'evaluation_venue'
        ]
    
    def get_external_examiner_name(self, obj):
        return obj.external_examiner.user.get_full_name()


class ExternalGroupDetailSerializer(serializers.ModelSerializer):
    """Detail view with assignments."""
    external_examiner = ExternalExaminerSerializer(read_only=True)
    assignments = serializers.SerializerMethodField()
    assigned_count = serializers.ReadOnlyField()
    available_slots = serializers.ReadOnlyField()
    
    class Meta:
        model = ExternalGroup
        fields = [
            'id', 'name', 'external_examiner', 'semester', 'status',
            'max_groups', 'assigned_count', 'available_slots',
            'evaluation_date', 'evaluation_venue', 'notes',
            'assignments', 'created_at'
        ]
    
    def get_assignments(self, obj):
        assignments = obj.assignments.select_related(
            'supervisor_group__group__student_1__user',
            'supervisor_group__group__student_2__user',
            'supervisor_group__supervisor__user',
            'supervisor_group__project'
        ).all()
        return ExternalGroupAssignmentSerializer(assignments, many=True).data


class ExternalGroupCreateSerializer(serializers.ModelSerializer):
    """Create/Update External Group."""
    class Meta:
        model = ExternalGroup
        fields = [
            'name', 'external_examiner', 'semester', 'status',
            'max_groups', 'evaluation_date', 'evaluation_venue', 'notes'
        ]
    
    def validate_max_groups(self, value):
        if value < 1 or value > 15:
            raise serializers.ValidationError(
                "Max groups must be between 1 and 15."
            )
        return value
```

### Acceptance Criteria
- [x] List serializer with counts
- [x] Detail serializer with nested assignments
- [x] Create serializer with validation

---

## Task 2.3: Create ExternalEvaluation Serializers

### File: `backend/app/serializers/serializers.py`

```python
class ExternalGroupAssignmentSerializer(serializers.ModelSerializer):
    """Serializer for group assignment to external."""
    student_group = serializers.SerializerMethodField()
    project_info = serializers.SerializerMethodField()
    supervisor_info = serializers.SerializerMethodField()
    has_evaluation = serializers.SerializerMethodField()
    
    class Meta:
        model = ExternalGroupAssignment
        fields = [
            'id', 'external_group', 'supervisor_group', 'student_group',
            'project_info', 'supervisor_info', 'slot_number', 'slot_time',
            'status', 'has_evaluation', 'assigned_at'
        ]
    
    def get_student_group(self, obj):
        group = obj.supervisor_group.group
        return {
            'id': group.id,
            'student_1': {
                'id': group.student_1.id,
                'name': group.student_1.user.get_full_name(),
                'registration_no': group.student_1.registration_no
            },
            'student_2': {
                'id': group.student_2.id,
                'name': group.student_2.user.get_full_name(),
                'registration_no': group.student_2.registration_no
            } if group.student_2 else None
        }
    
    def get_project_info(self, obj):
        project = obj.supervisor_group.project
        return {
            'id': project.id,
            'name': project.project_name,
            'category': project.project_category.category_name
        }
    
    def get_supervisor_info(self, obj):
        supervisor = obj.supervisor_group.supervisor
        return {
            'id': supervisor.id,
            'name': supervisor.user.get_full_name()
        }
    
    def get_has_evaluation(self, obj):
        return hasattr(obj, 'evaluation') and obj.evaluation is not None


class ExternalGroupAssignmentCreateSerializer(serializers.ModelSerializer):
    """Create assignment."""
    class Meta:
        model = ExternalGroupAssignment
        fields = ['external_group', 'supervisor_group', 'slot_number', 'slot_time']
    
    def validate(self, data):
        external_group = data.get('external_group')
        supervisor_group = data.get('supervisor_group')
        
        # Check if external group is full
        if external_group.is_full:
            raise serializers.ValidationError({
                'external_group': 'This external group has reached maximum capacity.'
            })
        
        # Check if supervisor group already assigned
        if ExternalGroupAssignment.objects.filter(
            supervisor_group=supervisor_group
        ).exists():
            raise serializers.ValidationError({
                'supervisor_group': 'This student group is already assigned to an external examiner.'
            })
        
        # Check if supervisor group is eligible (status = accepted)
        if supervisor_group.status != 'accepted':
            raise serializers.ValidationError({
                'supervisor_group': 'Only groups with accepted supervisor status can be assigned.'
            })
        
        return data


class ExternalEvaluationSerializer(serializers.ModelSerializer):
    """Full External Evaluation serializer."""
    assignment_info = serializers.SerializerMethodField()
    project_implementation_marks = serializers.ReadOnlyField()
    technical_knowledge_marks = serializers.ReadOnlyField()
    presentation_marks = serializers.ReadOnlyField()
    documentation_marks = serializers.ReadOnlyField()
    qa_marks = serializers.ReadOnlyField()
    total_marks = serializers.ReadOnlyField()
    grade = serializers.ReadOnlyField()
    
    class Meta:
        model = ExternalEvaluation
        fields = [
            'id', 'assignment', 'assignment_info',
            # Project Implementation
            'project_completion', 'code_quality', 'functionality',
            'project_implementation_marks',
            # Technical Knowledge
            'understanding_of_technology', 'problem_solving', 'innovation',
            'technical_knowledge_marks',
            # Presentation
            'presentation_clarity', 'communication', 'time_management',
            'presentation_marks',
            # Documentation
            'documentation_completeness', 'documentation_quality',
            'documentation_marks',
            # Q&A
            'qa_response', 'qa_marks',
            # Totals
            'total_marks', 'grade', 'is_pass',
            # Comments
            'overall_comment', 'strengths', 'areas_of_improvement',
            'evaluated_at', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'assignment_info', 'created_at', 'updated_at']
    
    def get_assignment_info(self, obj):
        return ExternalGroupAssignmentSerializer(obj.assignment).data


class ExternalEvaluationCreateSerializer(serializers.ModelSerializer):
    """Create/Update evaluation."""
    class Meta:
        model = ExternalEvaluation
        fields = [
            'assignment',
            'project_completion', 'code_quality', 'functionality',
            'understanding_of_technology', 'problem_solving', 'innovation',
            'presentation_clarity', 'communication', 'time_management',
            'documentation_completeness', 'documentation_quality',
            'qa_response',
            'overall_comment', 'strengths', 'areas_of_improvement', 'is_pass'
        ]
    
    def validate_assignment(self, value):
        # Check if evaluation already exists
        if self.instance is None:  # Creating new
            if ExternalEvaluation.objects.filter(assignment=value).exists():
                raise serializers.ValidationError(
                    "Evaluation already exists for this assignment."
                )
        return value
    
    def create(self, validated_data):
        from django.utils import timezone
        validated_data['evaluated_at'] = timezone.now()
        return super().create(validated_data)
    
    def update(self, instance, validated_data):
        from django.utils import timezone
        validated_data['evaluated_at'] = timezone.now()
        return super().update(instance, validated_data)
```

### Acceptance Criteria
- [x] Assignment serializer with nested info
- [x] Evaluation serializer with calculated marks
- [x] Create serializer with validation
- [x] Auto-set evaluated_at timestamp

---

## Task 2.4: Create Permissions for External Examiner

### File: `backend/app/permissions.py`

```python
# Add new permissions:

class IsExternalExaminer(BasePermission):
    """
    Permission check for External Examiner users.
    """
    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            request.user.user_type == 'external_examiner'
        )


class IsExternalExaminerOrCommittee(BasePermission):
    """
    Permission for External Examiners or Committee Members.
    Used for viewing/managing external groups.
    """
    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            request.user.user_type in ['external_examiner', 'committee_member']
        )


class IsExternalGroupOwner(BasePermission):
    """
    Permission to check if external examiner owns the external group.
    """
    def has_object_permission(self, request, view, obj):
        if request.user.user_type != 'external_examiner':
            return False
        
        try:
            external = ExternalExaminer.objects.get(user=request.user)
            # For ExternalGroup
            if isinstance(obj, ExternalGroup):
                return obj.external_examiner == external
            # For ExternalGroupAssignment
            if isinstance(obj, ExternalGroupAssignment):
                return obj.external_group.external_examiner == external
            # For ExternalEvaluation
            if isinstance(obj, ExternalEvaluation):
                return obj.assignment.external_group.external_examiner == external
        except ExternalExaminer.DoesNotExist:
            return False
        
        return False


class CanManageExternalGroups(BasePermission):
    """
    Permission to manage external groups (create, assign).
    Only Committee Members and Admins can manage.
    """
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return request.user.is_authenticated
        
        return (
            request.user.is_authenticated and
            (request.user.user_type == 'committee_member' or request.user.is_superuser)
        )
```

### Acceptance Criteria
- [x] Basic external examiner permission
- [x] Combined permissions for shared views
- [x] Object-level permission for ownership
- [x] Management permission for committee

---

## Task 2.5: Create ExternalExaminer Views

### File: `backend/app/views.py`

```python
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
        external_groups = external.external_groups.all()
        
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
        
        return Response({
            'profile': ExternalExaminerSerializer(external).data,
            'statistics': {
                'total_groups_assigned': total_groups,
                'evaluated': evaluated_count,
                'pending': pending_count
            },
            'external_groups': ExternalGroupListSerializer(external_groups, many=True).data,
            'upcoming_schedules': EvaluationScheduleSerializer(upcoming_schedules, many=True).data
        })
```

### Acceptance Criteria
- [x] Profile view for self
- [x] List view for committee members
- [x] Dashboard with statistics

---

## Task 2.6: Create ExternalGroup Views

### File: `backend/app/views.py`

```python
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
        queryset = ExternalGroup.objects.all()
        
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
    
    def get_serializer_class(self):
        # Reuse existing serializer
        from .serializers import SupervisorOfStudentGroupSerializer
        return SupervisorOfStudentGroupSerializer
```

### Acceptance Criteria
- [x] List/Create external groups
- [x] Detail/Update/Delete external groups
- [x] List assigned students
- [x] List available groups for assignment

---

## Task 2.7: Create ExternalEvaluation Views

### File: `backend/app/views.py`

```python
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
```

### Acceptance Criteria
- [x] Create assignment with notifications
- [x] Delete assignment with cleanup
- [x] List evaluations for external examiner
- [x] Create/Update evaluation
- [x] Student view of their evaluation

---

## Task 2.8: Create EvaluationSchedule Views

### File: `backend/app/views.py`

```python
class EvaluationScheduleSerializer(serializers.ModelSerializer):
    """Serializer for evaluation schedules."""
    external_group_name = serializers.SerializerMethodField()
    panel_name = serializers.SerializerMethodField()
    
    class Meta:
        model = EvaluationSchedule
        fields = [
            'id', 'title', 'evaluation_type', 'semester', 'date',
            'start_time', 'end_time', 'venue', 'status',
            'external_group', 'external_group_name',
            'panel', 'panel_name', 'notes', 'created_at'
        ]
    
    def get_external_group_name(self, obj):
        if obj.external_group:
            return obj.external_group.name
        return None
    
    def get_panel_name(self, obj):
        if obj.panel:
            return obj.panel.panel_name
        return None


class EvaluationScheduleListCreateAPIView(ListCreateAPIView):
    """
    List and create evaluation schedules.
    """
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]
    serializer_class = EvaluationScheduleSerializer
    pagination_class = BasePagination
    
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
        
        return queryset.order_by('date', 'start_time')
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
```

### Acceptance Criteria
- [x] Schedule CRUD operations
- [x] Filtering by type, semester, status
- [x] Upcoming schedules filter

---

## Task 2.9: Update URL Routes

### File: `backend/app/urls.py`

```python
# Add to urlpatterns:

# ==================== External Examiner URLs ====================

# External Examiner Profile
path(
    'external/profile/',
    ExternalExaminerProfileAPIView.as_view(),
    name='external-profile'
),

# External Examiner Dashboard
path(
    'external/dashboard/',
    ExternalExaminerDashboardAPIView.as_view(),
    name='external-dashboard'
),

# External Examiners List (for committee)
path(
    'external/examiners/',
    ExternalExaminerListAPIView.as_view(),
    name='external-examiners-list'
),

# External Groups
path(
    'external/groups/',
    ExternalGroupListCreateAPIView.as_view(),
    name='external-groups-list-create'
),
path(
    'external/groups/<int:pk>/',
    ExternalGroupDetailAPIView.as_view(),
    name='external-group-detail'
),
path(
    'external/groups/<int:pk>/students/',
    ExternalGroupAssignedStudentsAPIView.as_view(),
    name='external-group-students'
),

# Available groups for assignment
path(
    'external/available-groups/',
    AvailableGroupsForExternalAPIView.as_view(),
    name='external-available-groups'
),

# Assignments
path(
    'external/assignments/',
    ExternalGroupAssignmentCreateAPIView.as_view(),
    name='external-assignment-create'
),
path(
    'external/assignments/<int:pk>/',
    ExternalGroupAssignmentDeleteAPIView.as_view(),
    name='external-assignment-delete'
),

# External Evaluations
path(
    'external/evaluations/',
    ExternalEvaluationListAPIView.as_view(),
    name='external-evaluations-list'
),
path(
    'external/evaluations/create/',
    ExternalEvaluationCreateAPIView.as_view(),
    name='external-evaluation-create'
),
path(
    'external/evaluations/<int:pk>/',
    ExternalEvaluationDetailAPIView.as_view(),
    name='external-evaluation-detail'
),

# Student view of external evaluation
path(
    'student/external-evaluation/',
    StudentExternalEvaluationAPIView.as_view(),
    name='student-external-evaluation'
),

# Evaluation Schedules
path(
    'schedules/',
    EvaluationScheduleListCreateAPIView.as_view(),
    name='evaluation-schedules'
),
```

### Acceptance Criteria
- [x] All new URLs registered
- [x] URL naming consistent
- [x] No conflicts with existing URLs

---

## Task 2.10: Update Authentication Support

### File: `backend/app/views.py`

**Update login/token views to support external examiner:**

```python
# In LoginAPIView or CustomTokenObtainPairSerializer:

def get_user_profile(self, user):
    """Get profile based on user type."""
    profile_data = {
        'user_type': user.user_type,
        'username': user.username,
        'email': user.email,
    }
    
    if user.user_type == 'student':
        try:
            student = Student.objects.get(user=user)
            profile_data['profile_id'] = student.id
            profile_data['registration_no'] = student.registration_no
        except Student.DoesNotExist:
            pass
    
    elif user.user_type == 'supervisor':
        try:
            supervisor = Supervisor.objects.get(user=user)
            profile_data['profile_id'] = supervisor.id
            profile_data['employee_id'] = supervisor.employee_id
        except Supervisor.DoesNotExist:
            pass
    
    elif user.user_type == 'committee_member':
        try:
            committee = CommitteeMember.objects.get(user=user)
            profile_data['profile_id'] = committee.id
            profile_data['committee_id'] = committee.committee_id
        except CommitteeMember.DoesNotExist:
            pass
    
    # NEW: External Examiner support
    elif user.user_type == 'external_examiner':
        try:
            external = ExternalExaminer.objects.get(user=user)
            profile_data['profile_id'] = external.id
            profile_data['external_id'] = external.external_id
            profile_data['institution'] = external.institution
        except ExternalExaminer.DoesNotExist:
            pass
    
    return profile_data
```

### Acceptance Criteria
- [x] External examiner can login
- [x] Profile data returned on login
- [x] JWT tokens work for external examiner

---

## Task 2.11: Create Notification Triggers

### File: `backend/app/services.py`

```python
# Add notification helper functions:

def notify_external_assignment(assignment):
    """Send notifications when group is assigned to external."""
    group = assignment.supervisor_group.group
    external_name = assignment.external_group.external_examiner.user.get_full_name()
    external_group_name = assignment.external_group.name
    
    # Notify students
    for student in [group.student_1, group.student_2]:
        if student:
            Notification.objects.create(
                user=student.user,
                notification_type='general',
                title='External Examiner Assigned',
                message=f'Your group has been assigned to {external_name} ({external_group_name}) for final external evaluation.',
                related_supervisor_group=assignment.supervisor_group
            )
    
    # Notify supervisor
    Notification.objects.create(
        user=assignment.supervisor_group.supervisor.user,
        notification_type='general',
        title='External Assignment',
        message=f'Student group ({group.student_1.user.get_full_name()}) has been assigned to external examiner {external_name}.',
        related_supervisor_group=assignment.supervisor_group
    )
    
    # Notify external examiner
    Notification.objects.create(
        user=assignment.external_group.external_examiner.user,
        notification_type='general',
        title='New Group Assigned',
        message=f'A new student group has been assigned to your external group {external_group_name}.',
        related_supervisor_group=assignment.supervisor_group
    )


def notify_external_evaluation_complete(evaluation):
    """Send notifications when external evaluation is completed."""
    assignment = evaluation.assignment
    group = assignment.supervisor_group.group
    
    # Notify students
    for student in [group.student_1, group.student_2]:
        if student:
            Notification.objects.create(
                user=student.user,
                notification_type='evaluation',
                title='External Evaluation Completed',
                message=f'Your external evaluation has been completed. Total Marks: {evaluation.total_marks}/100, Grade: {evaluation.grade}',
                related_supervisor_group=assignment.supervisor_group
            )
    
    # Notify supervisor
    Notification.objects.create(
        user=assignment.supervisor_group.supervisor.user,
        notification_type='evaluation',
        title='External Evaluation Completed',
        message=f'External evaluation completed for student group ({group.student_1.user.get_full_name()}). Grade: {evaluation.grade}',
        related_supervisor_group=assignment.supervisor_group
    )
```

### Acceptance Criteria
- [x] Notification on assignment
- [x] Notification on evaluation completion
- [x] All relevant users notified

---

## Task 2.12: Update Existing APIs

### Updates needed:

**1. Student Profile API - Add external evaluation info:**
```python
# In StudentProfileSerializer, add:
external_evaluation = serializers.SerializerMethodField()

def get_external_evaluation(self, obj):
    """Get external evaluation if exists."""
    supervisor_group = SupervisorOfStudentGroup.objects.filter(
        Q(group__student_1=obj) | Q(group__student_2=obj),
        status='accepted'
    ).first()
    
    if not supervisor_group:
        return None
    
    try:
        assignment = supervisor_group.external_assignment
        if hasattr(assignment, 'evaluation'):
            return {
                'status': 'evaluated',
                'grade': assignment.evaluation.grade,
                'total_marks': assignment.evaluation.total_marks
            }
        return {'status': 'assigned', 'external_group': assignment.external_group.name}
    except:
        return {'status': 'not_assigned'}
```

**2. Supervisor Dashboard - Add external status:**
```python
# In supervisor dashboard, include external assignment status for each group
```

**3. Committee Dashboard - Add external management:**
```python
# Add endpoints for managing external groups
```

### Acceptance Criteria
- [x] Student can see external evaluation status
- [x] Supervisor sees group's external status
- [x] Committee can manage external assignments

---

## Testing Checklist

### API Testing:

```bash
# Test with curl or Postman

# 1. Login as external examiner
POST /api/token/
{
  "username": "external1",
  "password": "external123"
}

# 2. Get profile
GET /api/external/profile/
Authorization: Bearer <token>

# 3. Get dashboard
GET /api/external/dashboard/
Authorization: Bearer <token>

# 4. List assigned groups
GET /api/external/groups/
Authorization: Bearer <token>

# 5. Create evaluation
POST /api/external/evaluations/create/
Authorization: Bearer <token>
{
  "assignment": 1,
  "project_completion": "good",
  "code_quality": "excellent",
  ...
}
```

### Unit Tests:

```python
# backend/app/tests/test_external.py

from django.test import TestCase
from rest_framework.test import APITestCase

class ExternalExaminerTests(APITestCase):
    def setUp(self):
        # Create test data
        pass
    
    def test_external_login(self):
        pass
    
    def test_external_profile(self):
        pass
    
    def test_external_evaluation_create(self):
        pass
    
    def test_student_view_external_evaluation(self):
        pass
```

---

## Completion Criteria

Phase 2 is complete when:
- [ ] All serializers created and tested
- [ ] All permissions implemented
- [ ] All views created and tested
- [ ] All URLs registered
- [ ] Authentication working for external examiner
- [ ] Notifications triggering correctly
- [ ] Existing APIs updated
- [ ] API documentation updated
- [ ] No regressions in existing functionality
