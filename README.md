# Smart FYP UTC — Hệ thống quản lý Đồ án tốt nghiệp

Cổng thông tin quản lý đồ án tốt nghiệp cho **Khoa Công nghệ Thông tin, Trường Đại học Giao thông Vận tải (UTC)**. Hệ thống số hóa toàn bộ vòng đời đồ án, từ xét điều kiện, phân công giảng viên hướng dẫn, duyệt đề tài và đề cương, theo dõi tiến độ, cho tới bảo vệ trước hội đồng và tổng hợp điểm.

Repo này là **User Portal** dành cho sinh viên, giảng viên hướng dẫn, hội đồng và phản biện. Cổng quản trị cho Ban chủ nhiệm Khoa và Giáo vụ nằm ở repo riêng `Smart-Fyp-Admin`. Hai repo dùng chung một cơ sở dữ liệu.

## Mục lục

- [Vai trò người dùng](#vai-trò-người-dùng)
- [Quy trình 6 giai đoạn](#quy-trình-6-giai-đoạn)
- [Kiến trúc và công nghệ](#kiến-trúc-và-công-nghệ)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)
- [Chạy local](#chạy-local)
- [Kiểm thử](#kiểm-thử)
- [Triển khai](#triển-khai)
- [Tài liệu liên quan](#tài-liệu-liên-quan)

---

## Vai trò người dùng

| Vai trò (`user_type`) | Mô tả | Dashboard |
|---|---|---|
| `student` | Sinh viên làm đồ án: đăng ký nguyện vọng, xây dựng đề tài, nộp đề cương, báo cáo tiến độ, chat với GVHD | `/student/dashboard` |
| `supervisor` | Giảng viên hướng dẫn: xác nhận đề tài, duyệt đề cương, giao task, ghi nhật ký gặp mặt, theo dõi nhóm | `/supervisor/dashboard` |
| `committee_member` | Thành viên hội đồng bảo vệ: xem lịch, chấm điểm trực tiếp trong buổi bảo vệ | `/committee_member/dashboard` |
| `external_examiner` | Giảng viên phản biện | `/external_examiner/dashboard` |
| `academic_staff` | Giáo vụ Khoa, thao tác qua Admin Portal | Repo `Smart-Fyp-Admin` |
| `admin` | Quản trị hệ thống | Repo `Smart-Fyp-Admin` và Django Admin |

## Quy trình 6 giai đoạn

Đối tượng trung tâm là `GraduationProject` ([backend/app/models.py](backend/app/models.py)). Mỗi đồ án theo dõi trạng thái chính (`status`) cùng các trục phụ: duyệt đề tài, xét điều kiện ban đầu, xét học vụ cuối và bảo lưu.

| Giai đoạn | Nội dung | Trạng thái liên quan |
|---|---|---|
| **GĐ1** Xét điều kiện | Import bảng điểm, xét đủ điều kiện, Khoa có thể đặc cách | `initial_eligibility`: `PENDING` → `ELIGIBLE` / `INELIGIBLE` / `FORCE_APPROVED` |
| **GĐ2** Phân công GVHD | Theo nguyện vọng sinh viên và quota giảng viên | `status = ALLOCATED` |
| **GĐ3** Xây dựng đề tài | GV và SV soạn, GV xác nhận, Khoa phê duyệt | `topic_review_status`: `DRAFT` → `GV_CONFIRMED` → `APPROVED` / `REVISION_REQUIRED` |
| **GĐ4** Đề cương | Nộp và duyệt đề cương | `OUTLINE_PENDING` → `OUTLINE_REVISION` / `OUTLINE_APPROVED` |
| **GĐ5** Thực hiện | Báo cáo tuần, task, nhật ký hướng dẫn, chat nhóm | `IN_PROGRESS` |
| **GĐ6** Bảo vệ | Xét học vụ cuối, lập hội đồng, xếp lịch, chấm trực tiếp, tổng hợp điểm | `DEFENSE_READY` → `PASSED` / `FAILED` |

Nhánh rẽ có thể xảy ra ở nhiều giai đoạn: bảo lưu (`DEFERRED`, qua `ThesisDeferralRequest`) và loại khỏi đợt (`DISQUALIFIED`).

## Kiến trúc và công nghệ

```
React SPA (Vite) ──HTTP /app/*──▶ Django REST Framework ──▶ PostgreSQL (Neon) / SQLite
        └────────WebSocket /ws/──▶ Django Channels (Daphne) ──▶ Redis
                                    Celery worker ◀── Redis (tác vụ nền)
                                    File: ổ đĩa local hoặc S3 / Cloudflare R2
```

| Tầng | Công nghệ |
|---|---|
| Frontend | React 18, TypeScript, Vite 5, React Router 6, i18next (vi/en), axios, Tailwind 4 |
| Backend | Django 4.x, Django REST Framework, SimpleJWT, django-filter |
| Xác thực | JWT: access token, refresh token trong cookie HttpOnly; Google SSO giới hạn domain trường |
| Thời gian thực | Django Channels, Daphne, channels-redis (chat nhóm GVHD) |
| Tác vụ nền | Celery với Redis |
| Lưu trữ file | Local `backend/media/` hoặc S3 / R2 qua django-storages |
| Database | SQLite khi phát triển, PostgreSQL (Neon) khi production |
| Triển khai | Frontend trên Vercel; backend và Celery worker trên Render |

## Cấu trúc thư mục

```
smart-fyp-management/
├── backend/                  Django project
│   ├── backend/              settings, urls gốc, asgi (Channels), celery
│   ├── app/
│   │   ├── models.py         Model nghiệp vụ UTC (GraduationProject, DefenseCouncil, ...)
│   │   ├── legacy_models.py  Model hệ thống cũ (managed = False), giữ để tương thích
│   │   ├── urls.py           Toàn bộ API dưới tiền tố /app/
│   │   ├── views_utc.py      API nghiệp vụ đồ án UTC
│   │   ├── views*.py         Auth, SSO, media, quản lý nhóm, chat nhóm GVHD
│   │   ├── services.py       Logic nghiệp vụ dùng chung
│   │   ├── permissions.py    Phân quyền theo vai trò và giai đoạn
│   │   ├── validators.py     Kiểm tra file upload
│   │   ├── consumers.py      WebSocket consumer (chat)
│   │   ├── tasks.py          Celery tasks
│   │   ├── management/commands/  seed, backup, đổi mật khẩu, migrate media lên S3
│   │   └── tests/            Unit và integration test
│   └── requirements.txt
├── frontend/                 React SPA
│   ├── src/
│   │   ├── pages/            Login và 4 dashboard theo vai trò
│   │   ├── components/       Màn hình nghiệp vụ (UTC*View), chat, dialog, toast, cookie banner
│   │   ├── contexts/         Auth, Theme (sáng/tối), Toast
│   │   ├── services/api.ts   axios client, tự refresh token
│   │   ├── utils/notify.ts   Thông báo và hộp thoại xác nhận dùng chung
│   │   └── locales/          vi.json, en.json
│   └── e2e/                  Playwright
├── docs/                     Sơ đồ lớp, ERD
├── migration/                Tài liệu các phase chuyển đổi sang hệ thống UTC
├── Test_Data_Package/        Dữ liệu mẫu để kiểm thử import và upload
├── render.yaml               Render Blueprint (web + worker)
└── start_all_local.ps1       Mở 4 terminal chạy cả User Portal và Admin Portal
```

## Chạy local

Yêu cầu: Python 3.12, Node.js 18 trở lên.

### Backend (cổng 8000)

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows; macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
copy example.env .env           # rồi chỉnh SECRET_KEY, DEBUG=True, ALLOWED_HOSTS
python manage.py migrate
python manage.py seed_utc_data       # 33 giảng viên, quota, 8 mảng đề tài, đợt đồ án
python manage.py seed_utc_demo_data  # 25 sinh viên và 8 GVHD demo kèm đồ án
python manage.py runserver 8000
```

- Nếu `.env` **không có** `DATABASE_URL` trỏ tới PostgreSQL, backend dùng `backend/db.sqlite3`.
- **Lưu ý:** nếu `.env` trỏ tới database dùng chung (Neon), mọi thao tác `migrate` hay `seed` sẽ tác động trực tiếp lên dữ liệu thật. Khi phát triển nên dùng SQLite.
- Chat thời gian thực và Celery cần Redis (`REDIS_URL`). Không có Redis thì các chức năng còn lại vẫn chạy.

### Frontend (cổng 3000)

```bash
cd frontend
npm install
npm run dev
```

Vite proxy các đường dẫn `/app`, `/api`, `/media`, `/documents`, `/doc_templates` và `/ws` sang `http://localhost:8000`. Biến môi trường mẫu nằm ở [frontend/.env.example](frontend/.env.example).

### Chạy cả hai portal

```powershell
./start_all_local.ps1
```

Xem cổng, đường dẫn và tài khoản test chi tiết trong [RUN_LOCAL.md](RUN_LOCAL.md) và [DANH_SACH_TAI_KHOAN_TEST.md](DANH_SACH_TAI_KHOAN_TEST.md).

## Kiểm thử

```bash
# Backend: tự động dùng SQLite in-memory khi chạy lệnh test
cd backend
python manage.py test app

# Frontend
cd frontend
npm run test:run     # Vitest (unit / component)
npx tsc --noEmit     # kiểm tra kiểu
npm run test:e2e     # Playwright
```

## Triển khai

- **Backend:** Render, theo [render.yaml](render.yaml). Gồm service web chạy `daphne backend.asgi:application` và service worker chạy Celery.
- **Frontend:** Vercel, root directory `frontend`, output `dist`.
- Hướng dẫn đầy đủ (biến môi trường, CORS/CSRF, lưu trữ S3/R2) nằm trong [DEPLOYMENT.md](DEPLOYMENT.md). Mẫu biến môi trường production ở [.env.example](.env.example).

## Tài liệu liên quan

| Tài liệu | Nội dung |
|---|---|
| [RUN_LOCAL.md](RUN_LOCAL.md) | Chạy local cả hai portal |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Triển khai production |
| [STORAGE_OPERATIONS.md](STORAGE_OPERATIONS.md), [STORAGE_MIGRATION_GUIDE.md](STORAGE_MIGRATION_GUIDE.md) | Lưu trữ file và chuyển sang S3/R2 |
| [DOCUMENTS_AND_TEMPLATES_GUIDE.md](DOCUMENTS_AND_TEMPLATES_GUIDE.md) | Tài liệu và biểu mẫu |
| [FINAL_CROSS_REPO_AUTH_CONTRACT.md](FINAL_CROSS_REPO_AUTH_CONTRACT.md) | Hợp đồng xác thực giữa User Portal và Admin Portal |
| [Thesis_Document.md](Thesis_Document.md) | Tài liệu đồ án |
| [docs/](docs/) | Sơ đồ lớp, ERD |
| [FRONTEND_REMAINING_ISSUES.md](FRONTEND_REMAINING_ISSUES.md) | Các vấn đề frontend còn tồn đọng |

> Một số tài liệu cũ như [PROJECT_FLOW.md](PROJECT_FLOW.md) và [FYP_WORKFLOW.md](FYP_WORKFLOW.md) mô tả luồng của phiên bản trước (nhóm 2 người, `groupmate/request`). Chúng không còn phản ánh hệ thống hiện tại.
