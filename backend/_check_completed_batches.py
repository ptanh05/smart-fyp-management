import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")
django.setup()

from app.models import AcademicBatch, GraduationProject, StudentPreference, FinalGradeSummary, DefenseCouncil

print("=== TAT CA BATCH DANG COMPLETED ===")
batches = AcademicBatch.objects.filter(current_stage="COMPLETED")
print(f"Tong: {batches.count()} batch\n")

for b in batches:
    total_projects = GraduationProject.objects.filter(batch=b).count()
    approved = GraduationProject.objects.filter(batch=b, topic_review_status="APPROVED").count()
    prefs = StudentPreference.objects.filter(batch=b).count()
    finalized = FinalGradeSummary.objects.filter(project__batch=b, is_finalized=True).count()
    councils = DefenseCouncil.objects.filter(batch=b).count()
    print(f"ID={b.id} | code={b.batch_code} | active={b.is_active} | closed={b.is_closed}")
    print(f"  projects={total_projects} | approved_topics={approved} | prefs={prefs} | finalized={finalized} | councils={councils}")
    print()