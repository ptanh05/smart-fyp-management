# BACKEND REGRESSION RECOVERY REPORT

Ngày: 2026-11-23. Phạm vi: `smart-fyp-management` (Main) và `Smart-Fyp-Admin` (Admin).

## 1. Executive summary

**Trạng thái: COMPLETE.** Đã xử lý toàn bộ 14 lỗi ban đầu và chạy lại thực tế để xác nhận.

- Admin backend: 153/153 PASS.
- Main backend: 425 test, OK, 1 skipped (test skip này đã có từ trước).
- Admin frontend: tsc 0 lỗi, Vitest 32/32.
- Main frontend: tsc 0 lỗi, Vitest 213/213.

Nguyên nhân: 13/14 lỗi không phải bug production. Ba commit mới đã **cố ý** bổ sung quy tắc nghiệp vụ chặt hơn, nhưng không cập nhật fixture của test cũ:
- `9b266dc`, Admin: điều kiện đóng đợt, chốt điểm hội đồng, thông báo của bộ sinh hội đồng.
- `67aeb03`, Main: cấm GVPB chấm hội đồng, chốt điểm bắt buộc có điểm GVHD/GVPB.
- `4e53768`, Main: đồng bộ thông báo phân công cho giảng viên trên dashboard.

Có 1 lỗi hiệu năng thật trong production (N+1 do `schedule_slot`, Admin) và đã được sửa trong code production.

Không có test nào bị xóa, skip hoặc giảm assertion. Không commit, push hay deploy. Không chạm vào Neon, `.env` hay migration.

## 2. Git status ban đầu và thay đổi được bảo toàn

Trước khi sửa, cả hai repo đều ở branch `main`, working tree sạch (không có thay đổi chưa commit để bảo toàn).

| Repo | HEAD ban đầu | Commit liên quan |
|---|---|---|
| Main | `2fec5e1` | `67aeb03` (22/11), `4e53768` (21/11) |
| Admin | `d4e5b72` | `9b266dc` (22/11). `cac373d` (allocation engine) **không** gây lỗi nào |

Ghi chú về baseline: đề bài ghi "Admin 420/420, Main 146/146". Thực tế ngược lại: Main có khoảng 420 test, Admin có khoảng 146 test.

## 3. 14 lỗi ban đầu

### Admin (9 lỗi)

| # | Test | Triệu chứng |
|---|---|---|
| A1 | test_academic_staff_complete_batch | 400 ≠ 200 |
| A2 | test_close_batch_sets_all_three_flags | 400 ≠ 200 |
| A3 | test_close_batch_writes_audit_log | Không có AuditLog |
| A4 | test_closed_batch_disappears_from_active_list | Đợt vẫn active |
| A5 | test_reopen_batch_restores_active_state | Stage là `PHASE_5_IN_PROGRESS`, mong đợi `PHASE_6_DEFENSE` |
| A6 | test_generate_councils_rejects_empty_batch | Thông báo lỗi không chứa "chưa có đề tài" |
| A7 | test_mixed_batch_query_count_and_data | 7 truy vấn, mong đợi 4 |
| A8 | test_filter_by_status_does_not_append_unassigned | 4 truy vấn, mong đợi 1 |
| A9 | test_phase_6_deferral_decision_and_auto_scheduling_flow | finalize-scores trả 400 |

### Main (5 lỗi)

| # | Test | Triệu chứng |
|---|---|---|
| M1 | test_multiple_projects_zero_n_plus_one_bounded_queries | 8 truy vấn, mong đợi 6 |
| M2 | test_stage2_preferences_batch_fetching | 5 truy vấn, mong đợi 3 |
| M3 | test_council_live_defense_and_conflict_constraint | 403 ≠ 200 |
| M4 | test_chair_set_defense_status_and_secretary_remind_scoring | pending_count là 2, mong đợi 3 |
| M5 | test_tc033_council_finalize_scores_requires_all_members | Câu thông báo khác; sau đó finalize trả 400 |

## 4. Root cause

**A1–A5: quy tắc mới đóng đợt.** Commit `9b266dc` thêm vào `CloseBatchAPIView` và `AcademicStaffCompleteBatchAPIView` (Admin `views.py`) một điều kiện: chỉ đóng đợt khi đã có hội đồng và mọi hội đồng đều `is_finalized`. Fixture không tạo hội đồng nào nên API trả 400. A3, A4, A5 là hệ quả của việc đóng đợt thất bại. Logic mở lại đợt vẫn đúng.

**A6: thông báo bộ sinh hội đồng.** Commit `9b266dc` loại các đề tài đã thuộc hội đồng đã chốt, rồi đổi thông báo thành "không còn đề tài nào chưa chốt…". Câu này dùng chung cho cả đợt trống, nên gây nhầm lẫn. Đây là vấn đề UX thật, đã sửa trong production (xem mục 5).

**A7, A8: N+1 thật.** Commit `9b266dc` thêm `get_schedule_slot_info` vào `GraduationProjectAdminSerializer`. Hàm này truy cập quan hệ ngược một-một `schedule_slot`, trong khi `GraduationProjectsAdminListAPIView` không `select_related` quan hệ này, nên phát sinh 1 truy vấn cho mỗi đồ án. Tác động: danh sách đồ án của đợt lớn sẽ chậm tuyến tính theo số đồ án.

**A9: quy tắc chốt điểm.** Commit `9b266dc` bắt buộc có điểm GVHD, GVPB và điểm hội đồng trước khi chốt. Fixture không có điểm nào.

**M1, M2: chi phí cố định mới.** Commit `4e53768` thêm `NotificationService.sync_student_graduation_notifications` cho giảng viên, gọi đầu mỗi request dashboard. Bước này tốn **2 truy vấn cố định** (đồ án và quota), không phụ thuộc số đồ án. Đây không phải N+1; điều này được chứng minh bằng test mới ở mục 6.

**M3, M4: quy tắc TC-034.** Commit `67aeb03` cấm GVPB chấm hoặc được nhắc chấm hội đồng cho sinh viên mình phản biện (trả 403 với `reviewer_self_scoring_forbidden`). Fixture đặt `sup2` vừa là GVPB vừa là thành viên chấm, nên vi phạm quy tắc mới. Riêng M4 có ghi chú trong test: "cả 3 thành viên đều được chấm".

**M5: TC-033.** Commit `67aeb03` có hai thay đổi:
- Đổi câu thông báo thành "Bắt buộc N/N **thành viên hợp lệ** chấm…" kèm số đã chấm của từng sinh viên, vì số người chấm bắt buộc giờ trừ đi GVHD/GVPB.
- Bắt buộc có `supervisor_score` và `reviewer_score`.

Frontend không so khớp câu thông báo này (đã grep để kiểm tra).

**Chéo Main–Admin:** quy tắc "GVPB không chấm hội đồng" và "chốt điểm cần đủ điểm GVHD/GVPB" nhất quán giữa hai repo.

## 5. File đã sửa

### Production

| File | Thay đổi | Lý do |
|---|---|---|
| Admin `backend/app/views.py` | Thêm `"schedule_slot"` vào `select_related` của `GraduationProjectsAdminListAPIView` | Sửa N+1 (A7, A8) |
| Admin `backend/app/services/council_generator.py` | Đợt không có đề tài trả "Đợt này chưa có đề tài nào để thành lập Hội đồng."; trường hợp còn lại giữ thông báo cũ | Thông báo đúng với từng trường hợp (A6) |

### Test

Chỉ bổ sung fixture cho hợp lệ theo quy tắc mới, hoặc cập nhật theo contract đã đổi. Mỗi chỗ đều có ghi chú commit nguồn.

**Admin:**
- `test_batch_archive_workflow.py`: setUp tạo 1 hội đồng đã chốt.
- `test_academic_staff.py`: tạo 1 hội đồng đã chốt trước khi đóng đợt.
- `test_six_phases_workflow.py`: đồ án có điểm GVHD/GVPB và `council_avg_score`.

**Main:**
- `test_utc_graduation_system.py`: GVPB là giảng viên ngoài hội đồng, áp dụng cho M3 và M4.
- `test_utc_tc029_to_tc038.py`: khớp câu thông báo mới, có thêm assertion `": 4/5)"`; fixture có điểm GVHD/GVPB.
- `test_supervisor_dashboard_performance.py`: ngân sách truy vấn 6→8 và 3→5, có chú thích 2 truy vấn sync. Kèm test mới chứng minh số truy vấn không tăng theo N.

## 6. Regression test bổ sung

| Repo | Test | Kiểm tra |
|---|---|---|
| Admin | `test_close_batch_rejected_without_any_council` | 400, đợt giữ nguyên trạng thái |
| Admin | `test_close_batch_rejected_when_council_not_finalized` | 400, trả đúng danh sách hội đồng chưa chốt, không ghi AuditLog |
| Admin | `test_generate_councils_rejects_batch_when_all_projects_finalized` | Thông báo "không còn…", không tạo hội đồng mới |
| Main | `test_query_count_independent_of_project_count` | Số truy vấn với 3 đồ án bằng với 6 đồ án (không có N+1) |
| Main | `test_tc033b_council_finalize_rejects_missing_supervisor_or_reviewer_score` | Thiếu điểm GVHD hoặc GVPB thì trả 400 và không chốt |

## 7. Kết quả trước và sau sửa (đã chạy thực tế)

| Hạng mục | Trước | Sau |
|---|---|---|
| Admin backend (pytest) | 141 pass / 9 fail | **153 pass / 0 fail** |
| Main backend (manage.py test) | 5 fail (423 test) | **425 OK, 1 skipped** |
| Admin frontend | tsc 0 lỗi, Vitest 32/32 | tsc 0 lỗi, Vitest 32/32 |
| Main frontend | — | tsc 0 lỗi, Vitest 213/213 |
| Main `makemigrations --check` | — | No changes detected |

## 8. So sánh baseline

- **Main:** baseline 420 → 423 test sau các commit mới của nhóm → 425 test sau khi thêm 2 test mới (`test_query_count_independent_of_project_count`, TC-033b).
  - Test skipped là F1–F3, chỉ chạy khi có repo Admin; skip này đã có từ trước.
- **Admin:** baseline 146 → 150 test do các commit mới của nhóm → 153 test sau khi thêm 3 test hồi quy.

## 9. Rủi ro còn tồn tại

- Dashboard giảng viên chạy bước đồng bộ thông báo ở **mọi** request. Chi phí là 2 truy vấn cố định, cộng thêm truy vấn kiểm tra thông báo cho từng đợt đã công bố. Chi phí này chấp nhận được, nhưng có thể chuyển sang tác vụ nền hoặc thêm cache trong tương lai.
- Các quy tắc mới (đóng đợt, chốt điểm, cấm GVPB chấm) làm thay đổi hành vi với người dùng. Nên thông báo cho Khoa và giáo vụ.

## 10. Chưa thể xác minh

- Chưa chạy E2E trên trình duyệt.
- Chưa kiểm thử trên PostgreSQL/Neon; các test chạy trên SQLite.
- Hiệu năng thực tế với dữ liệu lớn chưa được đo; mới xác minh qua số lượng truy vấn.
