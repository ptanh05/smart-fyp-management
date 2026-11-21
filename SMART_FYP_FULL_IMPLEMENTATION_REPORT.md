# SMART FYP – Báo cáo triển khai, kiểm toán và sẵn sàng đưa lên `main`

Cập nhật: 2026-11-21 · Phạm vi: `smart-fyp-management` (backend Django + frontend SV/GV) và `Smart-Fyp-Admin` (backend + frontend quản trị, dùng chung DB).

> **Chưa có commit/push nào.** Không chạy migration trên Neon, không chạy xoá dữ liệu thật, không deploy. Mọi kiểm thử chạy trên SQLite.

## 1. Tóm tắt

| Hạng mục | Kết quả |
|---|---|
| Backend repo chính | **420/420 đạt** (1 skip có sẵn) — trước: 25 lỗi |
| Backend Admin | **146/146 đạt** — trước: 1 lỗi |
| Frontend repo chính | tsc 0 lỗi · Vitest 213/213 · build OK |
| Frontend Admin | tsc 0 lỗi · Vitest 32/32 · build OK |
| Migration | `makemigrations --check`: No changes detected; forward → reverse (0009) → forward OK trên SQLite |
| Bảo mật | Không còn Critical/High mở; 4 Medium/Low + 2 Info mở (mục 9) |
| E2E | **Chưa chạy** (mục 8) |
| Kết luận | **CONDITIONAL** — xem mục 14 |

## 2. Tính năng hoàn thành

| # | Tính năng | Backend | UI |
|---|---|---|---|
| 1 | Nộp bài nhiều phiên bản | `views_features.py` (SubmissionVersion, SHA-256, không ghi đè) | SV: `SubmissionVersionsPanel`; GV: `ProjectDetailPanel` |
| 2 | Chấm rubric nháp/xác nhận/khoá, cảnh báo lệch điểm | `RubricScore.status` DRAFT/SUBMITTED, 409 khi khoá, admin unlock + audit | GV: `RubricGradingUI` (nhận xét từng tiêu chí); Admin: Rubric Management, score-discrepancy |
| 3 | Trùng đề tài | `feature_services.topic_similarity` | SV: `TopicSimilarityHint` |
| 4 | Tương đồng nội dung (đạo văn nội bộ) | shingle + đoạn trích; chỉ báo **tỷ lệ tương đồng**, không kết luận đạo văn | Huy hiệu %, GV kiểm tra lại |
| 5 | Thống kê Khoa | `faculty_analytics` | Admin: Faculty Analytics |
| 6 | Phân công SPA-S | `services.py` | luồng phân công sẵn có |
| 7 | iCal + nhắc hạn | feed token (đổi/thu hồi), `send_deadline_reminders` (idempotent qua `DeadlineReminderLog` unique) | SV: `CalendarSyncButtons` |
| 8 | Lưu trữ, embargo, lưu giữ dữ liệu | archive + embargo kiểm tra server-side; retention preview → apply (confirm) + audit | Admin: Thesis Archive, Data Retention |
| 9 | Khối lượng GV | `GET lecturer/workload/` | GV: `WorkloadDashboard` |

## 3. Sửa sau audit (đợt này)

| Vấn đề | Mức | Sửa | Bằng chứng |
|---|---|---|---|
| Retention nhận `years<=0` → mốc cắt ở tương lai → xoá dữ liệu mọi đợt đã đóng (cả 2 repo) | **High** | Từ chối `years < DATA_RETENTION_MIN_YEARS` (mặc định 1), giá trị không phải số → 400 | `test_retention_guard.py` (5 test); Admin `TestDataRetention.test_zero_or_negative_years_rejected_and_nothing_deleted` |
| Admin mirror `RubricScore` thiếu cột NOT NULL `criterion_comments`, `status`, `locked_at` (schema drift) | Medium | Bổ sung vào `Smart-Fyp-Admin/backend/app/feature_models.py` | So sánh cột tự động: không còn cột NOT NULL thiếu |
| Admin score-discrepancy tính cả phiếu **nháp** | Medium (nghiệp vụ) | Chỉ lấy `status="SUBMITTED"` | `TestScoreDiscrepancy.test_draft_rubric_scores_do_not_count_as_discrepancy` |
| F7 lộ mã SV trong kết quả tương đồng cho GV/hội đồng | Medium | `serialize_version(is_admin=False)` bỏ `student_code` | `SimilarityMatchesStudentCodePIITest` |
| F14 chạy production với SECRET_KEY mặc định | High | `ImproperlyConfigured` khi `DEBUG=False` + key `django-insecure-` (cả 2 repo) | `ProductionInsecureKeyTest`, `AdminProductionKeyGuardTest` |
| F16 `CanManageExternalGroups` cho mọi user đọc | Medium | SAFE_METHODS chỉ cho `external_examiner` | `CanManageExternalGroupsPermissionTest` |
| F18 throttle login 120/phút khi DEBUG | Medium | Luôn 10/phút | `test_login_throttle_not_relaxed_under_debug` |
| Test F1–F3 kiểm tra code lỗi tự chép trong test | — | Viết lại: đọc mã nguồn thật của Smart-Fyp-Admin | `test_security_audit.py` |

**Đính chính:** báo cáo trước ghi "retention Admin xoá hẳn GraduationProject". Đọc lại code: endpoint **không** xoá đồ án; nó xoá file đính kèm (minh chứng bảo lưu, báo cáo tuần, sản phẩm task), các SubmissionVersion không phải bản lưu trữ, InternshipInfo và StudentPreference của đợt đã đóng quá hạn.

## 4. 19 test fixture

**Repo chính (18):** nguyên nhân chung — fixture không đặt `AcademicBatch.current_stage`, nên các API có chốt giai đoạn (`require_project_batch_stage`, `require_exact_batch_stage` trong `views_utc.py`) trả 409. Sửa bằng cách đặt giai đoạn đúng nghiệp vụ trước mỗi bước (GĐ2 nguyện vọng, GĐ3 đề tài/đề cương, GĐ4 xét điều kiện, GĐ5 thực hiện, GĐ6 bảo vệ). Không sửa code production, không xoá assertion, không skip, không mock.

Các thay đổi ngoài việc đặt giai đoạn (đã rà soát từng chỗ):

| Test | Thay đổi | Lý do hợp lệ |
|---|---|---|
| `test_phase5_task_deliverable_and_review` | kỳ vọng `task.status` `IN_PROGRESS` → `COMPLETED` | Commit `671cb95` (15/11) đã cố ý đổi nghiệp vụ: nộp sản phẩm → COMPLETED + chờ duyệt (`views_utc.py` ~4293). Test chưa cập nhật theo |
| `test_bug_fix_module3_upload_signed_outline_validations` | trạng thái đồ án `OUTLINE_APPROVED` → `TOPIC_CONFIRMED` | Đề cương đã duyệt thì không nộp bản ký nữa; tiền điều kiện đúng là đề tài đã chốt |
| `test_phase2_engineer_supervisor_degree_requirement` | bước 3 dùng SV Kỹ sư thứ hai | Nghiệp vụ "mỗi SV chỉ gửi nguyện vọng một lần"; SV gốc đã gửi ở bước 2 |
| `test_flow23_…`, `test_tc031_…` | thêm `student_notes` | API nộp sản phẩm yêu cầu ghi chú; các assertion chặn file .exe/giả mạo giữ nguyên |
| một test nộp task | tên trường `file` → `deliverable_file`; điền sẵn `deliverable_url` trước bước đánh dấu hoàn thành | Đúng tên trường API hiện tại |

**Admin (1):** `test_excel_import_idempotency_and_duplicate_prevention` — file Excel là lớp "Kỹ sư CNTT K62" nhưng đợt mặc định hệ Cử nhân. Đặt `batch.program_type = "ENGINEER"` trong test; logic import và kiểm tra loại hình giữ nguyên.

## 5. Backend tests

Lệnh: `cd backend && PYTHONIOENCODING=utf-8 DATABASE_URL="sqlite:///:memory:" python manage.py test app` → `Ran 420 tests … OK (skipped=1)`.
Admin: `cd backend && python -m pytest -q` → `146 passed`.

| | Baseline | Hiện tại |
|---|---|---|
| Repo chính | 25 lỗi (4 thiếu reportlab, 2 `IsCommitteeMember`, 1 N+1, 18 fixture) | 0 lỗi / 420 |
| Admin | 1 lỗi fixture | 0 lỗi / 146 |

Không có regression mới.

## 6. Frontend

`npx tsc --noEmit -p .` 0 lỗi (cả 2 repo); Vitest 213/213 (chính), 32/32 (Admin); `vite build` ra `C:/tmp/fyp_web_dist`, `C:/tmp/fyp_admin_dist` (không đụng `dist/`). Các màn hình có trạng thái loading/empty/error; quyền được kiểm tra ở backend (UI chỉ phản ánh), ví dụ chấm điểm khoá trả 409 từ server, endpoint admin dùng `IsAdminUserRole`.

## 7. TypeScript và build — đạt (mục 6).

## 8. Integration / E2E

- Luồng tích hợp được kiểm qua API test: nộp phiên bản → lịch sử; GV chấm nháp → xác nhận → khoá → admin mở khoá; trùng đề tài; tương đồng; phân công; lịch iCal đổi token làm token cũ hết hiệu lực; quyền archive/embargo; retention preview/apply.
- **E2E (Playwright) chưa chạy:** chưa có bộ tài khoản/dữ liệu mẫu riêng cho E2E, chưa xác nhận trình duyệt Playwright, spec gốc dùng đường dẫn `api/v1` cũ. Chưa xác minh trên trình duyệt thật: toàn bộ luồng UI của 3 nhóm người dùng.

## 9. Bảo mật

| ID | Mức | Trạng thái | Bằng chứng |
|---|---|---|---|
| F1 mật khẩu cửa hậu (Admin) | Critical | ✅ | `test_security_audit.AdminBackdoorPasswordTest`, Admin `test_security_fixes` |
| F2 secret đăng ký admin mặc định | Critical | ✅ | `AdminRegistrationSecretTest` |
| F3 MD5 khi import | Critical | ✅ | `MD5PasswordHasherTest` |
| F4/F8 IDOR file bài nộp, embargo | High | ✅ | `SubmissionIDORTest`, `EmbargoBypassTest` |
| F5 zip bomb | High | ✅ | `ZipBombDocxTest` |
| F6 xem điểm người chấm khác | High | ✅ | `BlindScoringIDORTest` |
| F13 `ALLOWED_HOSTS=*` | High | ✅ | `AllowedHostsNoWildcardTest` |
| F14 SECRET_KEY mặc định | High | ✅ (có điều kiện) | Chỉ kích hoạt khi `DEBUG=False`; **`DEBUG` vẫn mặc định True** → bắt buộc đặt `DEBUG=False` khi deploy |
| Retention `years<=0` | High | ✅ | mục 3 |
| F7, F9, F11, F12, F16, F18, F20 | Medium | ✅ | mục 3 và `test_security_audit.py` |
| F10 kiểm tra magic byte khi thiếu libmagic | Medium | ⚠️ Phần lớn | PDF/ZIP/PNG/JPEG có kiểm tra gốc, chặn MZ/ELF; `.rar` chưa có. Khắc phục: cài libmagic hoặc thêm chữ ký `Rar!` |
| F15 trả mật khẩu ban đầu dạng rõ khi tạo/import (Admin) | Medium | ❌ Mở | Cần cho nghiệp vụ phát mật khẩu. Khắc phục: `Cache-Control: no-store`, HTTPS bắt buộc, dài hạn gửi qua email |
| F17 chặn UA `curl/wget/python-requests` | Low | ❌ Mở | Có thể chặn health check của hạ tầng. Khắc phục: miễn trừ `/health`, dựa vào throttle |
| F19 token iCal lưu dạng rõ | Low | ❌ Mở | Cần migration thêm `token_hash`. Đã có đổi/thu hồi token |
| FS1 Google OAuth Client ID trong `Smart-Fyp-Admin/frontend/.env.production` | Info | Mở | Client ID công khai theo thiết kế OAuth |
| FS2 `.env.example` lộ hostname Neon | Info | Mở | Không có mật khẩu; nên thay bằng placeholder |

Đã kiểm thêm: không có `dangerouslySetInnerHTML` với dữ liệu người dùng, URL ngoài qua `safeExternalUrl`; không có raw SQL nhận input; endpoint admin được bảo vệ ở backend (cả 2 repo). Quét secret trong diff và file chưa track: chỉ thấy mật khẩu test và chuỗi xác nhận; không có `.env`, SQLite, dump, build artifact. **Không tuyên bố hệ thống an toàn tuyệt đối.**

## 10. SPA-S

`test_algorithms.py` (51 test) và `test_feature_extensions.py`: phân công ổn định (không có cặp chặn), tôn trọng hạn mức GV, phản ví dụ chứng minh khác greedy (S0:[X], S1:[X,Y], S2:[Y]), kết quả tất định với cùng đầu vào, xử lý thiếu GV/danh sách rỗng, vòng dự phòng chỉ chọn GV `is_active=True`.

## 11. Migration

- Mới: `0010_feature_extensions`, `0011_feature_rubric_draft` — chỉ **thêm** bảng/cột/index.
- SQLite: forward → reverse về 0009 → forward thành công. PostgreSQL: các kiểu dùng (JSONField, CharField, FloatField, index thường) tương thích; **chưa chạy thực tế trên Postgres**.
- Admin: model mirror `managed=False`, không có migration mới; đã đối chiếu cột với schema của repo chính.
- Sự cố trong lúc kiểm tra: lệnh thử migrate đã chạy vào DB dev local `backend/db.sqlite3` (file bị gitignore, tạo trong ngày, 0 user/0 đồ án) thay vì file tạm — không mất dữ liệu, không liên quan Neon.
- Trên staging: tạo branch Neon từ production → `python manage.py migrate` (repo chính) → chạy test khói → kiểm tra Admin đọc/ghi các bảng mới → mới áp dụng production sau sao lưu.

## 12. Dữ liệu cá nhân / Nghị định 13/2023

| Nội dung | Kỹ thuật đã có | Còn thiếu |
|---|---|---|
| Phân quyền, audit log | Có (RBAC server-side, audit cho rubric/archive/retention) | — |
| Thời hạn lưu giữ | Có (preview, xác nhận, audit, chặn `years<1`) | Chính sách được phê duyệt chính thức; quy trình sao lưu trước khi xoá |
| Xin và quản lý sự đồng ý | Không | Cơ chế đồng ý, lưu bằng chứng |
| Quyền truy cập/sửa/xoá của chủ thể dữ liệu | Một phần (xem/sửa hồ sơ) | Endpoint và quy trình tiếp nhận yêu cầu |
| Xử lý sự cố lộ dữ liệu | Không | Quy trình thông báo |
| Đánh giá tác động (DPIA) | Không | Hồ sơ đánh giá |

**Hệ thống chưa đủ căn cứ để tuyên bố tuân thủ Nghị định 13/2023.** Cần bộ phận pháp chế của trường đánh giá và phê duyệt.

## 13. Hạn chế đã biết

- E2E chưa chạy; migration chưa chạy trên Postgres/staging.
- Kiểm tra tương đồng chỉ trong kho nội bộ, không thay thế công cụ chống đạo văn chuyên dụng; chỉ là tín hiệu cho GV xem xét.
- Xoá file trong retention không hoàn tác được; transaction DB rollback không khôi phục file đã xoá → bắt buộc sao lưu storage trước.
- Schema drift giữa 2 repo: nên thêm CI chạy test Admin trên schema mới nhất của repo chính.
- Các finding mở ở mục 9.

## 14. Sẵn sàng production — **CONDITIONAL**

Đạt: 19 test fixture đã xử lý hợp lệ; không regression; không còn Critical/High mở; tsc/build đạt; không có secret trong diff; migration đã đánh giá; hai repo rà soát độc lập.

Điều kiện trước khi deploy production (không chặn việc push code lên `main`):
1. Đặt `DEBUG=False`, `SECRET_KEY`, `ADMIN_REGISTRATION_SECRET` mạnh, `RENDER_EXTERNAL_HOSTNAME`.
2. Chạy migration trên staging trước, sao lưu Neon.
3. Chạy E2E hoặc kiểm thử thủ công trên staging.
4. Quy trình phê duyệt + sao lưu trước khi dùng retention.

## 15. Nhóm commit đề xuất

Mỗi repo commit riêng. Thay đổi UX trước đó (đã có trong baseline `C:/tmp/fyp_baseline/web_uncommitted.diff`) tách thành nhóm riêng. File chứa nhiều nhóm thay đổi được xếp vào nhóm đầu tiên cần nó.

### `smart-fyp-management` (nhánh `main`, đồng bộ `origin/main`, 0 ahead/0 behind)

| # | Commit | Files | Bằng chứng |
|---|---|---|---|
| 1 | `fix(security): media IDOR, filename validation, committee permission, external groups, test-only MD5, login throttle, fail-closed SECRET_KEY` | `backend/app/permissions.py`, `validators.py`, `views_media.py`, `backend/backend/settings.py`, `backend/requirements.txt` | `test_security_audit`, `test_role_authorization` |
| 2 | `feat(db): feature extension models and migrations 0010/0011` | `backend/app/feature_models.py`, `models.py`, `migrations/0010_*.py`, `migrations/0011_*.py` | makemigrations --check; forward/reverse |
| 3 | `feat(api): versions, rubric, similarity, analytics, SPA-S, iCal/reminders, archive/retention, workload` | `feature_services.py`, `feature_validators.py`, `views_features.py`, `urls.py`, `services.py`, `tasks.py`, `views_utc.py`, `serializers/utc_graduation_serializers.py`, `management/commands/*.py` | `test_feature_*`, `test_algorithms`, `test_retention_guard` |
| 4 | `test: stage fixtures for 18 workflow tests + regression suites` | 5 file test đã sửa + `test_algorithms.py`, `test_feature_api_extended.py`, `test_feature_extensions.py`, `test_retention_guard.py`, `test_role_authorization.py`, `test_security_audit.py` | 420/420 |
| 5 | `feat(frontend): student feature extensions and lecturer workload/rubric grading` | `services/api.ts`, `FeatureExtensions.tsx`, `components/lecturer/*`, `components/__tests__/lecturer/*`, `utils/safeUrl.ts` + test, `UTCStudentGraduationView.tsx`, `SupervisorDashboard.tsx` | tsc, Vitest 213/213, build |
| 6 | `feat(ui): UX improvements (chat, search, notifications, council, auth, locales)` | `ChatRoom.tsx`, `GlobalSearchBar.tsx`, `NotificationDropdown.tsx`, `UTCCouncilLiveDefenseView.tsx`, `UTCSupervisorGraduationView.tsx`, `AuthContext.tsx`, `locales/*.json`, `StudentDashboard.tsx` | tsc, Vitest |
| 7 | `docs: full implementation report` | `SMART_FYP_FULL_IMPLEMENTATION_REPORT.md` | — |

Lưu ý: `UTCStudentGraduationView.tsx`, `SupervisorDashboard.tsx`, `api.ts` có thể chứa cả thay đổi UX cũ lẫn tính năng mới; vì không dùng `git add -p` tương tác, các file này đi trọn trong commit 5. Commit 1 dùng `views_features.py` (F7) chưa tồn tại → phần F7 nằm trong commit 3.

### `Smart-Fyp-Admin` (nhánh `main`, đồng bộ `origin/main`, 0 ahead/0 behind)

| # | Commit | Files |
|---|---|---|
| 1 | `security: remove backdoor passwords, default registration secret, MD5 import, wildcard hosts, health user count; fail-closed SECRET_KEY` | `backend/app/views.py`, `backend/backend/settings.py`, `backend/app/services/excel_importer.py` |
| 2 | `feat(api): admin analytics, rubrics, archive/embargo, data retention, feature audit logs` | `backend/app/feature_models.py`, `feature_serializers.py`, `feature_views.py`, `backend/app/urls.py` |
| 3 | `test: SQLite test settings, unmanaged-table fixture, feature/security tests, engineer-batch fixture` | `backend/backend/settings_test.py`, `backend/conftest.py`, `backend/pytest.ini`, `backend/app/tests/test_feature_views.py`, `test_security_fixes.py`, `test_security_audit_new.py`, `test_audit_deep_verification.py` |
| 4 | `feat(frontend): analytics, rubric, archive, retention, audit log pages` | `frontend/src/App.tsx`, `components/layout/AdminLayout.tsx`, `types/index.ts`, `api/features.ts`, `pages/{FacultyAnalytics,RubricManagement,ThesisArchive,DataRetention,FeatureAuditLogs}/*`, `__tests__/features.test.tsx` |

Thứ tự push: **repo chính trước** (sở hữu migration), sau đó Admin.

## 16. Bước tiếp theo

1. Người dùng duyệt danh sách commit → commit → push fast-forward lên `origin/main` (không force).
2. Staging: migration + E2E/kiểm thử thủ công.
3. Xử lý F15, F17, F19, F10 (.rar), thay hostname trong `.env.example`.
4. Pháp chế đánh giá Nghị định 13; quy trình sao lưu trước retention.
