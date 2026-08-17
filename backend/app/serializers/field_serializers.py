from rest_framework import serializers


class ChangePasswordDetailSerializer(serializers.Serializer):
    old_password = serializers.CharField(max_length=128, required=True)
    new_password = serializers.CharField(max_length=128, required=True)


class StudentLoginDetailSerializer(serializers.Serializer):
    registration_no = serializers.CharField(max_length=20, required=True)
    password = serializers.CharField(max_length=128, required=True)


class GroupRequestSerializer(serializers.Serializer):
    student_2_id = serializers.IntegerField(required=True)
    project_category = serializers.IntegerField(required=True)


class SupervisorLoginDetailSerializer(serializers.Serializer):
    email = serializers.CharField(max_length=100, required=True)
    password = serializers.CharField(max_length=128, required=True)


class CommitteeMemberLoginDetailSerializer(serializers.Serializer):
    email = serializers.CharField(max_length=100, required=True)
    password = serializers.CharField(max_length=128, required=True)


class ExternalExaminerLoginDetailSerializer(serializers.Serializer):
    email = serializers.CharField(max_length=100, required=True)
    password = serializers.CharField(max_length=128, required=True)


class SupervisorofStudentGroupSerializer(serializers.Serializer):
    supervisor = serializers.IntegerField(required=True)
    project = serializers.IntegerField(required=True)


class SupervisorStudentCommentsSerializer(serializers.Serializer):
    group = serializers.IntegerField(required=True)
    comment = serializers.CharField(max_length=500, required=True)
