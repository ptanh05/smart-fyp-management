import os
import django
import sys

# Setup Django environment
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from app.models import (
    Student, Supervisor, GraduationProject, DefenseCouncil, CouncilMember,
    CustomUser, AcademicBatch
)

def seed_data():
    print("Seeding test data...")
    # Clean up old data
    Student.objects.filter(user__username__startswith="test_").delete()
    Supervisor.objects.filter(user__username__startswith="test_").delete()
    CustomUser.objects.filter(username__startswith="test_").delete()

    batch, _ = AcademicBatch.objects.get_or_create(batch_code="TEST_BATCH", defaults={"is_active": True})

    # Users
    u_ks = CustomUser.objects.create_user(username="test_ks_sv", password="password", user_type="student")
    u_cn = CustomUser.objects.create_user(username="test_cn_sv", password="password", user_type="student")
    u_ts = CustomUser.objects.create_user(username="test_ts_gv", password="password", user_type="supervisor")
    u_ths = CustomUser.objects.create_user(username="test_ths_gv", password="password", user_type="supervisor")

    # Supervisors
    gv_ts = Supervisor.objects.create(user=u_ts, supervisor_id="TEST_TS", academic_title="TS")
    gv_ths = Supervisor.objects.create(user=u_ths, supervisor_id="TEST_THS", academic_title="ThS")

    # Students
    sv_ks = Student.objects.create(user=u_ks, registration_no="TEST_KS_01", degree_program="ENGINEER", credits_accumulated=5)
    sv_cn = Student.objects.create(user=u_cn, registration_no="TEST_CN_01", degree_program="BACHELOR", credits_accumulated=12)

    # Projects
    GraduationProject.objects.create(
        student=sv_ks, supervisor=gv_ts, batch=batch, topic_title_vi="Đề tài KS", is_force_approved=False
    )
    GraduationProject.objects.create(
        student=sv_cn, supervisor=gv_ths, batch=batch, topic_title_vi="Đề tài CN nợ tín chỉ", is_force_approved=True
    )
    
    # Council with 12 limit reached
    council = DefenseCouncil.objects.create(council_name="HĐ TEST MAX 12", batch=batch)
    for i in range(12):
        u_dummy = CustomUser.objects.create_user(username=f"test_dummy_{i}", password="password", user_type="student")
        sv_dummy = Student.objects.create(user=u_dummy, registration_no=f"DUMMY_{i}")
        GraduationProject.objects.create(student=sv_dummy, batch=batch, council=council, topic_title_vi=f"Dummy {i}")

    print("Seed completed successfully!")

def cleanup_data():
    print("Cleaning up test data...")
    CustomUser.objects.filter(username__startswith="test_").delete()
    print("Cleanup completed!")

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "cleanup":
        cleanup_data()
    else:
        seed_data()
