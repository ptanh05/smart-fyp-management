from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("app", "0011_feature_rubric_draft"),
    ]

    operations = [
        migrations.AddField(
            model_name="submissionversion",
            name="supervisor_review_status",
            field=models.CharField(
                choices=[
                    ("PENDING", "Chờ GVHD duyệt"),
                    ("APPROVED", "GVHD đã duyệt"),
                    ("REVISION_REQUIRED", "GVHD yêu cầu sửa"),
                ],
                default="PENDING",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="submissionversion",
            name="supervisor_feedback",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="submissionversion",
            name="reviewed_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="submissionversion",
            name="reviewed_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="reviewed_submission_versions",
                to="app.customuser",
            ),
        ),
    ]
