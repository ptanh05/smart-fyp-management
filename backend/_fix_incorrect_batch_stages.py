import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")
django.setup()

from app.models import AcademicBatch, GraduationProject, StudentPreference, FinalGradeSummary, DefenseCouncil, SupervisionTask

print("=" * 80)
print("PHÂN TÍCH VÀ SỬA CÁC BATCH BỊ ĐÁNH DẤU NHẦM COMPLETED")
print("=" * 80)

batches = AcademicBatch.objects.filter(current_stage="COMPLETED").order_by("id")

print(f"\nTổng số batch đang COMPLETED: {batches.count()}\n")

# Phân loại batch
truly_completed = []  # Đã hoàn thành thực sự (có điểm final)
incorrect_stages = []  # Bị đánh dấu nhầm

for b in batches:
    total_projects = GraduationProject.objects.filter(batch=b).count()
    approved_topics = GraduationProject.objects.filter(batch=b, topic_review_status="APPROVED").count()
    prefs = StudentPreference.objects.filter(batch=b).count()
    finalized_grades = FinalGradeSummary.objects.filter(project__batch=b, is_finalized=True).count()
    councils = DefenseCouncil.objects.filter(batch=b).count()
    tasks = SupervisionTask.objects.filter(project__batch=b).count()
    
    # Quy tắc phán đoán batch đã hoàn thành thực sự:
    # - Có finalized_grades > 0 (đã chấm điểm xong)
    # - Hoặc có councils > 0 VÀ approved_topics == total_projects (tất cả đề tài đã duyệt)
    is_truly_completed = finalized_grades > 0 or (councils > 0 and total_projects > 0 and approved_topics == total_projects)
    
    info = {
        "batch": b,
        "projects": total_projects,
        "approved": approved_topics,
        "prefs": prefs,
        "finalized": finalized_grades,
        "councils": councils,
        "tasks": tasks,
    }
    
    if is_truly_completed:
        truly_completed.append(info)
    else:
        incorrect_stages.append(info)

print("\n" + "=" * 80)
print(f"BATCH ĐÃ HOÀN THÀNH THỰC SỰ: {len(truly_completed)}")
print("=" * 80)
for info in truly_completed:
    b = info["batch"]
    print(f"✅ ID={b.id} | {b.batch_code} | {b.batch_name}")
    print(f"   projects={info['projects']} | approved={info['approved']} | finalized={info['finalized']} | councils={info['councils']}")
    print()

print("\n" + "=" * 80)
print(f"BATCH BỊ ĐÁNH DẤU NHẦM: {len(incorrect_stages)}")
print("=" * 80)
for info in incorrect_stages:
    b = info["batch"]
    print(f"❌ ID={b.id} | {b.batch_code} | {b.batch_name}")
    print(f"   projects={info['projects']} | approved={info['approved']} | prefs={info['prefs']} | finalized={info['finalized']} | councils={info['councils']}")
    
    # Đoán stage đúng dựa trên dữ liệu
    if info["projects"] == 0:
        suggested = "PHASE_1_SETUP"
        reason = "Chưa có project nào"
    elif info["prefs"] > 0 and info["projects"] == 0:
        suggested = "PHASE_2_ALLOCATING"
        reason = "Có nguyện vọng nhưng chưa phân công"
    elif info["projects"] > 0 and info["approved"] == 0:
        suggested = "PHASE_2_ALLOCATING"
        reason = "Đã phân công nhưng chưa duyệt đề tài nào"
    elif info["approved"] > 0 and info["approved"] < info["projects"]:
        suggested = "PHASE_3_TOPIC"
        reason = "Đang duyệt đề tài"
    elif info["approved"] == info["projects"] and info["finalized"] == 0:
        suggested = "PHASE_5_IN_PROGRESS"
        reason = "Đề tài đã duyệt hết, đang thực hiện"
    else:
        suggested = "PHASE_2_ALLOCATING"
        reason = "Không xác định, mặc định về GĐ2"
    
    info["suggested_stage"] = suggested
    info["reason"] = reason
    print(f"   → Đề xuất: {suggested} ({reason})")
    print()

print("\n" + "=" * 80)
print("BẠN CÓ MUỐN SỬA CÁC BATCH BỊ NHẦM KHÔNG?")
print("=" * 80)
print(f"\nSẽ sửa {len(incorrect_stages)} batch:")
for info in incorrect_stages:
    b = info["batch"]
    print(f"  - ID={b.id} | {b.batch_code} → {info['suggested_stage']}")

print("\n⚠️  LƯU Ý: Script này sẽ:")
print("   1. Đưa batch về stage đúng theo dữ liệu thực tế")
print("   2. Set is_closed=False, is_active=True (mở lại batch)")
print("   3. KHÔNG thay đổi dữ liệu projects/tasks/grades")

import sys

if "--fix" in sys.argv:
    print("\n" + "=" * 80)
    print("🔧 BẮT ĐẦU SỬA DỮ LIỆU...")
    print("=" * 80)
    
    fixed_count = 0
    for info in incorrect_stages:
        b = info["batch"]
        old_stage = b.current_stage
        new_stage = info["suggested_stage"]
        
        b.current_stage = new_stage
        b.is_closed = False
        b.is_active = True
        b.save(update_fields=["current_stage", "is_closed", "is_active"])
        
        print(f"✅ Đã sửa ID={b.id} | {b.batch_code}")
        print(f"   {old_stage} → {new_stage} | active=True | closed=False")
        fixed_count += 1
    
    print(f"\n🎉 HOÀN THÀNH: Đã sửa {fixed_count} batch")
else:
    print("\n✋ Để thực hiện sửa, chạy script với tham số --fix:")
    print("   python _fix_incorrect_batch_stages.py --fix")
