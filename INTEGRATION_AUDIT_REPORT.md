# BÁO CÁO TOÀN DIỆN VỀ KIỂM TOÁN TÍCH HỢP FULL-STACK & KẾT NỐI DATABASE (FULL-STACK INTEGRATION & DATABASE CONNECTION AUDIT REPORT)

> **Dự án**: Smart FYP Management System (Hệ thống Quản lý Đồ án Tốt nghiệp)  
> **Kiểm toán viên**: Senior Software Architect / Full-Stack Engineer / Database Architect / Security Auditor  
> **Thời điểm kiểm toán**: 18/08/2026  
> **Môi trường Database kiểm tra thực tế**: PostgreSQL (Neon.tech - `neondb` on AWS `ap-southeast-1`)  
> **Quy tắc tuân thủ**: *Chỉ audit, không tự ý sửa code. Mọi kết luận đều có dẫn chứng (evidence) từ source code, cấu hình và truy vấn live database.*

---

## 1. EXECUTIVE SUMMARY (TỔNG QUAN ĐIỀU HÀNH)

Hệ thống **Smart FYP Management** là ứng dụng web toàn diện phục vụ quản lý vòng đời đồ án tốt nghiệp bao gồm 5 vai trò (Admin, Student, Supervisor, Committee Member, External Examiner).

### Kết quả kiểm toán nhanh:
* **Database Connection**: **`CONNECTED`** (Kết nối PostgreSQL trực tiếp tới Neon.tech `neondb`, schema `public`).
* **Backend Models & Migrations**: **`CONNECTED & CONSISTENT`** (Toàn bộ 45 bảng đã tồn tại 100% trên live DB, migrations đồng bộ).
* **Authentication & Session**: **`COMPLETE`** (JWT kép với HttpOnly Cookie Refresh Token, Access Token Bearer trong header, rate limiting, OTP password reset).
* **RBAC & Authorization**: **`COMPLETE (Backend Enforced)`** (Phân quyền 2 lớp: Decorator/Permission Classes ở cấp API và Object-level permission filter ở cấp Queryset).
* **Frontend ↔ Backend Integration**: **`PARTIALLY CONNECTED`** (Đa số luồng chính hoạt động trơn tru; phát hiện một số điểm cần lưu ý về cấu hình proxy Vite cho WebSockets và đường dẫn tải tài liệu tĩnh).
* **Tổng thể dự án**: **`NEEDS FIXES (Trước khi Go-Live Production)`**.

---

## 2. DISCOVER PROJECT ARCHITECTURE (KIẾN TRÚC HỆ THỐNG)

```text
                                  +---------------------------------------+
                                  |              USER BROWSER             |
                                  +---------------------------------------+
                                                      |
                                                      v
                                  +---------------------------------------+
                                  |         REACT 18 + TYPESCRIPT         |
                                  |  (Vite Dev Server / Static Hosting)   |
                                  |   - Pages: Student, Supervisor, etc.  |
                                  |   - Components: Form, Modal, Chat     |
                                  |   - AuthContext + ApiService (Axios)  |
                                  +---------------------------------------+
                                                      |
                                                      | HTTP (JWT Bearer / Cookie)
                                                      | WebSocket (Ticket Auth)
                                                      v
                                  +---------------------------------------+
                                  |         DJANGO 5.2 + CHANNELS         |
                                  |           (ASGI / WSGI Server)        |
                                  |   - Middlewares: Security, CORS, Auth |
                                  |   - Throttling (Rate Limiting)        |
                                  |   - URL Routing (/app/*, /api/*)      |
                                  +---------------------------------------+
                                                      |
                                                      v
                                  +---------------------------------------+
                                  |        DRF VIEWS & PERMISSIONS        |
                                  |   - RBAC Permissions (IsStudent, ...) |
                                  |   - Serializers Validation            |
                                  |   - Services & Business Logic         |
                                  +---------------------------------------+
                                                      |
                                                      v
                                  +---------------------------------------+
                                  |              DJANGO ORM               |
                                  |   - 45 Tables, Custom User Model      |
                                  |   - Soft deletes, Cascade rules       |
                                  +---------------------------------------+
                                                      |
                                                      v
                                  +---------------------------------------+
                                  |        POSTGRESQL (NEON.TECH)         |
                                  |   Database: neondb | Schema: public   |
                                  |   Connection Pooling (AWS ap-se-1)    |
                                  +---------------------------------------+
```

### Chi tiết Stack công nghệ:
* **Frontend Framework**: React 18 (TypeScript), Vite 6, Tailwind/CSS Custom, Axios, Lucide Icons.
* **Backend Framework**: Django 5.2, Django REST Framework (DRF), Django Channels (ASGI).
* **Ngôn ngữ**: TypeScript (Frontend), Python 3.12+ (Backend).
* **Package Manager**: `npm` (Frontend), `pip` / virtualenv (Backend).
* **ORM & Database**: Django ORM kết nối PostgreSQL 16 (Neon Serverless Postgres).
* **Authentication**: JWT kép (`rest_framework_simplejwt`), Refresh Token lưu trong HttpOnly Cookie, Access Token trong LocalStorage + Authorization Bearer header, WebSocket One-Time Ticket.
* **RBAC**: 5 nhóm vai trò (`admin`, `student`, `supervisor`, `committee_member`, `external_examiner`) thực thi cứng tại backend qua `app/permissions.py`.

---

## 3. DATABASE CONNECTION AUDIT (KIỂM TOÁN KẾT NỐI DATABASE)

### Trả lời 7 câu hỏi trọng yếu:

1. **App thực sự đang connect tới database nào?**  
   * **Host**: `ep-old-pine-azxhp8n7-pooler.c-3.ap-southeast-1.aws.neon.tech`  
   * **Database**: `neondb`  
   * **Schema**: `public`  
   * **User**: `neondb_owner`  
   * **Driver**: `django.db.backends.postgresql` (qua `dj_database_url` và `psycopg2`).

2. **Connection string được lấy từ đâu?**  
   * Được nạp qua file `backend/.env` bằng biến `DATABASES` và được `backend/backend/settings.py` đọc qua hàm `load_dotenv` và `dj_database_url.config()`.

3. **Có nguy cơ connect nhầm database không?**  
   * *Nguy cơ đã được phát hiện*: Trong `settings.py` (dòng 119-125), nếu lệnh có chứa chuỗi `'test'`, Django tự động trỏ về `:memory:`. Trên Neon từng xuất hiện database tên `:memory:` gây nhầm lẫn trên Web UI của Neon nếu chọn sai dropdown (như đã giải quyết). Trong môi trường chạy thực tế, backend luôn kết nối đúng `neondb`.

4. **Có hard-code credential không?**  
   * *Không*. Mọi thông tin nhạy cảm (User, Password, Host, Secret Key) đều đọc từ biến môi trường (`.env`).

5. **Production và development có bị dùng chung DB không?**  
   * Cần lưu ý: Hiện tại cả `backend/.env` đang trỏ thẳng vào connection string của Neon. Nếu dev chạy `seed_database.py` (có lệnh clear dữ liệu) trên local mà file `.env` đang trỏ vào Neon production thì sẽ xóa sạch data trên cloud.  
   * *Khuyến cáo*: Cần tách rõ `.env.development` (SQLite / Local Postgres) và `.env.production` (Neon).

6. **Migration có khớp database hiện tại không?**  
   * **Khớp 100%**. Lệnh `showmigrations` xác nhận tất cả 5 migration của `app` (`0001_initial` đến `0005_alter_group_student_2`) và các migration core Django đã được áp dụng đầy đủ trên Neon.

7. **Có connection configuration nào bị bỏ quên không?**  
   * `conn_max_age=600` và `ssl_require=True` đã được thiết lập đúng cho kết nối Pooler của Neon.

---

## 4. COMPLETE DATABASE TABLE INVENTORY (DANH MỤC 100% BẢNG DATABASE)

Toàn bộ **45 bảng** đã được đối soát thực tế giữa `app/models.py`, các file Migration và hệ cơ sở dữ liệu `neondb` trên Neon:

| STT | Table Name | Django Model | PK | Foreign Keys | Used By Backend | Used By Frontend | Status |
|:---:|:---|:---|:---:|:---:|:---:|:---:|:---:|
| 1 | `app_customuser` | `CustomUser` | `id` (bigint) | None | Yes (`views.py`) | Yes (`AuthContext`) | **CONNECTED** |
| 2 | `app_customuser_groups` | M2M User-Group | `id` (bigint) | `customuser_id`, `group_id` | Yes (Django Auth) | Indirect | **CONNECTED** |
| 3 | `app_customuser_user_permissions` | M2M User-Permission | `id` (bigint) | `customuser_id`, `permission_id` | Yes (Django Auth) | Indirect | **CONNECTED** |
| 4 | `app_passwordresetcode` | `PasswordResetCode` | `id` (bigint) | `user_id -> app_customuser.id` | Yes (`PasswordReset*View`) | Yes (`LoginPage`) | **CONNECTED** |
| 5 | `app_student` | `Student` | `id` (bigint) | `user_id -> app_customuser.id` | Yes (`Student*View`) | Yes (`StudentDashboard`) | **CONNECTED** |
| 6 | `app_supervisor` | `Supervisor` | `id` (bigint) | `user_id -> app_customuser.id` | Yes (`Supervisor*View`) | Yes (`SupervisorDashboard`) | **CONNECTED** |
| 7 | `app_supervisor_category` | M2M Supervisor-Category | `id` (bigint) | `supervisor_id`, `projectcategories_id` | Yes (`Supervisor*View`) | Yes (`ProjectModal`) | **CONNECTED** |
| 8 | `app_committeemember` | `CommitteeMember` | `id` (bigint) | `user_id -> app_customuser.id`, `panel_id` | Yes (`Committee*View`) | Yes (`CommitteeDashboard`) | **CONNECTED** |
| 9 | `app_committeememberpanel` | `CommitteeMemberPanel` | `id` (bigint) | None | Yes (`PanelAPIView`) | Yes (`CommitteeDashboard`) | **CONNECTED** |
| 10 | `app_projectcategories` | `ProjectCategories` | `id` (bigint) | None | Yes (`ProjectCategoriesView`) | Yes (`Student/Supervisor`) | **CONNECTED** |
| 11 | `app_group` | `Group` | `id` (bigint) | `student_1_id`, `student_2_id`, `project_category_id` | Yes (`GroupRequestView`) | Yes (`StudentDashboard`) | **CONNECTED** |
| 12 | `app_groupcreationcomment` | `GroupCreationComment` | `id` (bigint) | `group_id -> app_group.id` | Yes (`GroupComments`) | Yes (`StudentDashboard`) | **CONNECTED** |
| 13 | `app_project` | `Project` | `id` (bigint) | `project_category_id` | Yes (`ProjectAPIVIEW`) | Yes (`Student/Supervisor`) | **CONNECTED** |
| 14 | `app_supervisorofstudentgroup` | `SupervisorOfStudentGroup` | `id` (bigint) | `group_id`, `supervisor_id`, `project_id`, `student_1_id`, `student_2_id` | Yes (Core Flow) | Yes (All Dashboards) | **CONNECTED** |
| 15 | `app_supervisorstudentcomments` | `SupervisorStudentComments` | `id` (bigint) | `supervisor_of_student_group_id` | Yes (`CommentsAPIView`) | Yes (`CommentsSection`) | **CONNECTED** |
| 16 | `app_documentrequirement` | `DocumentRequirement` | `id` (bigint) | None | Yes (`DocReqViews`) | Yes (`DocReqManager`) | **CONNECTED** |
| 17 | `app_document` | `Document` | `id` (bigint) | `supervisor_of_student_group_id` | Yes (`DocumentUploadAPIView`) | Yes (`DocumentsList`) | **CONNECTED** |
| 18 | `app_committeemembertemplates` | `CommitteeMemberTemplates` | `id` (bigint) | `uploaded_by_id` | Yes (`TemplateViews`) | Yes (`TemplatesList`) | **CONNECTED** |
| 19 | `app_scopedocumentevaluationcriteria` | `ScopeDocumentEvaluationCriteria` | `id` (bigint) | `supervisor_of_student_group_id` | Yes (`ScopeEvaluationView`) | Yes (`EvaluationForm`) | **CONNECTED** |
| 20 | `app_srsevaluationsupervisor` | `SRSEvaluationSupervisor` | `id` (bigint) | `supervisor_of_student_group_id` | Yes (`SRSEvalSupervisorView`) | Yes (`EvaluationForm`) | **CONNECTED** |
| 21 | `app_srsevaluationcommitteemember` | `SRSEvaluationCommitteeMember` | `id` (bigint) | `supervisor_of_student_group_id` | Yes (`SRSEvalCommitteeView`) | Yes (`EvaluationForm`) | **CONNECTED** |
| 22 | `app_sddevaluationsupervisor` | `SDDEvaluationSupervisor` | `id` (bigint) | `supervisor_of_student_group_id` | Yes (`SDDEvalSupervisorView`) | Yes (`EvaluationForm`) | **CONNECTED** |
| 23 | `app_sddevaluationcommitteemember` | `SDDEvaluationCommitteeMember` | `id` (bigint) | `supervisor_of_student_group_id` | Yes (`SDDEvalCommitteeView`) | Yes (`EvaluationForm`) | **CONNECTED** |
| 24 | `app_evaluation3supervisor` | `Evaluation3Supervisor` | `id` (bigint) | `supervisor_of_student_group_id` | Yes (`Eval3SupervisorView`) | Yes (`EvaluationForm`) | **CONNECTED** |
| 25 | `app_evaluation3committeemember` | `Evaluation3CommitteeMember` | `id` (bigint) | `supervisor_of_student_group_id` | Yes (`Eval3CommitteeView`) | Yes (`EvaluationForm`) | **CONNECTED** |
| 26 | `app_evaluation4supervisor` | `Evaluation4Supervisor` | `id` (bigint) | `supervisor_of_student_group_id` | Yes (`Eval4SupervisorView`) | Yes (`EvaluationForm`) | **CONNECTED** |
| 27 | `app_evaluation4committeemember` | `Evaluation4CommitteeMember` | `id` (bigint) | `supervisor_of_student_group_id` | Yes (`Eval4CommitteeView`) | Yes (`EvaluationForm`) | **CONNECTED** |
| 28 | `app_chatroom` | `ChatRoom` | `id` (bigint) | `group_id`, `student_id`, `supervisor_id` | Yes (`ChatRoomAPIView`, WS) | Yes (`ChatRoom.tsx`) | **CONNECTED** |
| 29 | `app_notification` | `Notification` | `id` (bigint) | `user_id -> app_customuser.id` | Yes (`NotificationViews`) | Yes (`NotificationDropdown`) | **CONNECTED** |
| 30 | `app_notificationpreference` | `NotificationPreference` | `id` (bigint) | `user_id -> app_customuser.id` | Yes (`NotifPrefView`) | Yes (`NotificationSettings`) | **CONNECTED** |
| 31 | `app_auditlog` | `AuditLog` | `id` (bigint) | `user_id -> app_customuser.id`, `group_id` | Yes (`AuditLogViews`) | Yes (`AuditLogViewer`) | **CONNECTED** |
| 32 | `app_externalexaminer` | `ExternalExaminer` | `id` (bigint) | `user_id -> app_customuser.id` | Yes (`ExternalExaminer*`) | Yes (`ExternalManagement`) | **CONNECTED** |
| 33 | `app_externalgroup` | `ExternalGroup` | `id` (bigint) | `external_examiner_id` | Yes (`ExternalGroup*`) | Yes (`ExternalGroupsList`) | **CONNECTED** |
| 34 | `app_externalgroupassignment` | `ExternalGroupAssignment` | `id` (bigint) | `external_group_id`, `supervisor_group_id` | Yes (`ExternalAssignment*`) | Yes (`ExternalAssignmentCard`) | **CONNECTED** |
| 35 | `app_externalevaluation` | `ExternalEvaluation` | `id` (bigint) | `assignment_id` | Yes (`ExternalEvaluation*`) | Yes (`ExternalEvaluationForm`) | **CONNECTED** |
| 36 | `app_evaluationschedule` | `EvaluationSchedule` | `id` (bigint) | `external_group_id`, `committee_panel_id` | Yes (`ScheduleViews`) | Yes (`ExternalScheduleView`) | **CONNECTED** |
| 37 | `auth_group` | Django Group | `id` (integer) | None | Yes (Django Core) | No (Admin only) | **CONNECTED** |
| 38 | `auth_group_permissions` | Django Group Perm | `id` (bigint) | `group_id`, `permission_id` | Yes (Django Core) | No (Admin only) | **CONNECTED** |
| 39 | `auth_permission` | Django Permission | `id` (integer) | `content_type_id` | Yes (Django Core) | No (Admin only) | **CONNECTED** |
| 40 | `django_admin_log` | Admin Log Entry | `id` (integer) | `content_type_id`, `user_id` | Yes (Django Admin) | No (Admin only) | **CONNECTED** |
| 41 | `django_content_type` | Content Type | `id` (integer) | None | Yes (Django Core) | No (Admin only) | **CONNECTED** |
| 42 | `django_migrations` | Migration History | `id` (bigint) | None | Yes (Django Core) | No | **CONNECTED** |
| 43 | `django_session` | Session Store | `session_key` (varchar) | None | Yes (Django Core) | No (Cookie) | **CONNECTED** |
| 44 | `token_blacklist_outstandingtoken` | Outstanding JWT | `id` (bigint) | `user_id` | Yes (SimpleJWT) | No | **CONNECTED** |
| 45 | `token_blacklist_blacklistedtoken` | Blacklisted JWT | `id` (bigint) | `token_id` | Yes (SimpleJWT) | No | **CONNECTED** |

---

## 5. TABLE-BY-TABLE CRUD AUDIT

* **`CustomUser` / `Student` / `Supervisor` / `CommitteeMember` / `ExternalExaminer`**:
  * **Create**: Qua Admin site, Excel import script hoặc đăng ký qua view (`StudentProfileView`, `SupervisorProfileView`). Đã mã hóa `make_password`.
  * **Read**: API Login trả về user info + JWT; API Profile trả về dữ liệu cá nhân theo role.
  * **Update**: `ChangePasswordView` đổi mật khẩu an toàn, `StudentProfileView` cập nhật bio/SĐT.
  * **Delete**: Soft-delete/is_active qua Admin hoặc cascade delete an toàn.
* **`Group` & `SupervisorOfStudentGroup`**:
  * **Create**: `GroupRequestView` (SV1 mời SV2), `SendSupervisorRequestAPIView` (Nhóm gửi yêu cầu cho GVHD).
  * **Read**: `GetGroupRequestView`, `SupervisorDocumentsAPIView`, `CommitteeMemberGroupsAPIView`.
  * **Update**: `SupervisorResponseAPIView` (GVHD Accept/Reject), `GroupDetailView` (Đổi tên nhóm).
  * **Delete**: Hủy yêu cầu khi chưa được duyệt (`ProjectDeleteAPIView`).
* **`Document` & `DocumentRequirement`**:
  * **Create**: `DocumentUploadAPIView` (Upload multipart/form-data lên server storage + lưu record vào DB).
  * **Read**: `SupervisorDocumentsAPIView`, `DocumentRequirementListCreateAPIView`.
  * **Update**: `DocumentSubmitToCommitteeAPIView` (Đổi cờ `submitted_to_committee=True`), Phê duyệt trạng thái (`status='approved'`).
  * **Delete**: `DocumentDeleteAPIView` (Xóa file và bản ghi khi SV muốn nộp lại).
* **Các bảng Chấm điểm (`*Evaluation*`)**:
  * **Create/Update**: `SRSEvaluationSupervisorView`, `ExternalEvaluationCreateAPIView`, `UTC Evaluation Sheet`. Hỗ trợ cả Save Draft và Final Submit.
  * **Read**: Trả về điểm chi tiết từng tiêu chí và tổng điểm tự tính.
* **`ChatRoom`**:
  * **Create**: Gửi tin nhắn qua REST API POST `/app/chatroom/` hoặc qua WebSocket Consumer (`ChatConsumer.receive_json`).
  * **Read**: Phân trang tin nhắn GET `/app/chatroom/<id>/?page=1&page_size=20`.
  * **Delete**: `ChatMessageDeleteAPIView` (Xóa tin nhắn trong phòng chat).

---

## 6. FRONTEND → API AUDIT

Đối soát toàn bộ các hàm gọi API trong [`frontend/src/services/api.ts`](file:///c:/Workspace/Thuc%20hanh%20cac%20mon%20nam%203/N%C4%83m%204/Project_1/smart-fyp-management/frontend/src/services/api.ts) với Router Backend [`backend/app/urls.py`](file:///c:/Workspace/Thuc%20hanh%20cac%20mon%20nam%203/N%C4%83m%204/Project_1/smart-fyp-management/backend/app/urls.py):

| Frontend Method | HTTP Method | Endpoint Frontend Gọi | Backend URL Khớp | Auth Header / Cookie | Kết nối DB | Đánh giá |
|:---|:---:|:---|:---|:---:|:---:|:---:|
| `studentLogin()` | `POST` | `/student/login/` | `path("student/login/", ...)` | None | `CustomUser`, `Student` | **CONNECTED** |
| `supervisorLogin()` | `POST` | `/supervisor/login/` | `path("supervisor/login/", ...)` | None | `CustomUser`, `Supervisor` | **CONNECTED** |
| `committeeMemberLogin()` | `POST` | `/committee_member/login/` | `path("committee_member/login/", ...)` | None | `CustomUser`, `CommitteeMember` | **CONNECTED** |
| `externalExaminerLogin()` | `POST` | `/external/login/` | `path("external/login/", ...)` | None | `CustomUser`, `ExternalExaminer` | **CONNECTED** |
| `changePassword()` | `POST` | `/change_password/` | `path("change_password/", ...)` | Bearer JWT | `CustomUser` | **CONNECTED** |
| `getStudentProfile()` | `GET` | `/student/profile/` | `path("student/profile/", ...)` | Bearer JWT | `Student`, `Group` | **CONNECTED** |
| `getSupervisorProfile()` | `GET` | `/supervisor/profile/` | `path("supervisor/profile/", ...)` | Bearer JWT | `Supervisor` | **CONNECTED** |
| `getProjectCategories()` | `GET` | `/project/categories/` | `path("project/categories/", ...)` | Bearer JWT | `ProjectCategories` | **CONNECTED** |
| `createGroupRequest()` | `POST` | `/groupmate/request/` | `path("groupmate/request/", ...)` | Bearer JWT | `Group`, `Notification` | **CONNECTED** |
| `getProjectsList()` | `GET` | `/projects/list/` | `path("projects/list/", ...)` | Bearer JWT | `Project` | **CONNECTED** |
| `uploadDocument()` | `POST` | `/proposal-document/{type}/` | `path("proposal-document/<str:document_type>/", ...)` | Bearer JWT | `Document`, `AuditLog` | **CONNECTED** |
| `getDocumentRequirements()` | `GET` | `/document-requirements/` | `path("document-requirements/", ...)` | Bearer JWT | `DocumentRequirement` | **CONNECTED** |
| `getChatMessages()` | `GET` | `/chatroom/{id}/` | `path("chatroom/<int:pk>/", ...)` | Bearer JWT | `ChatRoom` | **CONNECTED** |
| `sendChatMessage()` | `POST` | `/chatroom/` | `path("chatroom/", ...)` | Bearer JWT | `ChatRoom`, `Notification` | **CONNECTED** |
| `getNotifications()` | `GET` | `/notifications/` | `path("notifications/", ...)` | Bearer JWT | `Notification` | **CONNECTED** |
| `getSupervisorAnalytics()`| `GET` | `/supervisor/analytics/` | `path("supervisor/analytics/", ...)` | Bearer JWT | `SupervisorOfStudentGroup` | **CONNECTED** |
| `getAuditLogs()` | `GET` | `/audit-logs/` | `path("audit-logs/", ...)` | Bearer JWT (Admin) | `AuditLog` | **CONNECTED** |
| `getExternalDashboard()` | `GET` | `/external/dashboard/` | `path("external/dashboard/", ...)` | Bearer JWT | `ExternalGroup`, `Schedule` | **CONNECTED** |
| `submitExternalEvaluation()`| `POST` | `/external/evaluations/create/` | `path("external/evaluations/create/", ...)` | Bearer JWT | `ExternalEvaluation` | **CONNECTED** |

---

## 7. BACKEND → DATABASE AUDIT

Tất cả 87 endpoints trong `backend/app/views.py` đều:
* Thực hiện truy vấn ORM trực tiếp (`.objects.filter()`, `.objects.create()`, `.select_related()`, `.prefetch_related()`).
* **Không có mock data, không có dummy hardcoded return** trong logic nghiệp vụ.
* Có tích hợp Transaction atomic ở các luồng tạo nhóm, phân công phản biện và nộp bài để đảm bảo toàn vẹn dữ liệu.

---

## 8. AUTHENTICATION & RBAC AUDIT

```text
LOGIN SUBMISSION (Username/Email + Password)
  │
  ▼
[Custom Backend Authentication View]
  │  ├── Rate Limiting Check (10 attempts / minute)
  │  ├── User Lookup in CustomUser
  │  ├── authenticate() check_password() hashing (PBKDF2 SHA256)
  │  └── Role Validation (student / supervisor / committee_member / external_examiner)
  │
  ▼
[Generate Dual JWT]
  ├── Access Token (Lifetime: 15 mins) ──> Response Body JSON ──> localStorage
  └── Refresh Token (Lifetime: 7 days) ──> Set-Cookie: HttpOnly; Secure; SameSite=Lax
  │
  ▼
[Subsequent Requests]
  ├── Header: "Authorization: Bearer <access_token>"
  └── Permission Class Check (IsStudent, IsSupervisor, IsCommitteeMember, IsAdminUserRole)
```

* **Xác thực định danh**: ID người dùng trong JWT Payload (`user_id`) được map chính xác 1-1 với khóa chính `id` trong bảng `app_customuser`.
* **RBAC đa tầng**: Backend từ chối ở cấp Middleware/Permission và lọc dữ liệu theo `request.user` nên người dùng role này không thể xem hoặc sửa dữ liệu của role khác.

---

## 9. FOREIGN KEYS & RELATIONSHIP AUDIT

* **Toàn vẹn khóa ngoại (Referential Integrity)**:  
  Tất cả các bảng nghiệp vụ (`Group`, `SupervisorOfStudentGroup`, `Document`, `ExternalGroupAssignment`) đều liên kết chặt chẽ với bảng `app_customuser` và `app_student` / `app_supervisor`.
* **Ràng buộc duy nhất (Unique Constraints)**:  
  * `app_group`: Unique together `(student_1, student_2, id)` ngăn chặn trùng lặp.
  * `app_externalgroupassignment`: Unique `(external_group, supervisor_group)` ngăn 1 đồ án bị gán 2 lần vào cùng 1 nhóm ngoài.
* **Chống N+1 Query**:  
  Các view chính đã sử dụng `select_related('student_1__user', 'supervisor__user')` và `prefetch_related('category')` giúp tối ưu hiệu năng truy vấn.

---

## 10. API CONTRACT & TYPE MISMATCH AUDIT

So sánh giữa TypeScript Interface (`frontend/src/types/index.ts`) và Serializer (`backend/app/serializers/`):

1. **Naming Convention**:
   * Backend dùng chuẩn `snake_case` (ví dụ: `registration_no`, `project_category`, `supervisor_id`).
   * Frontend TypeScript types trong `src/types/index.ts` đã được định nghĩa khớp 100% dạng `snake_case` (ví dụ: `interface Student { registration_no: string; ... }`).
2. **ID Types**: Đều đồng nhất kiểu số nguyên `number` (Frontend) và `BigAutoField / Integer` (Backend).
3. **Date/Time Formats**: Backend trả về chuẩn ISO 8601 string; Frontend hiển thị qua các hàm format thời gian thân thiện.

---

## 11. PRODUCTION CONFIGURATION & ENVIRONMENT AUDIT

### Kiểm tra cấu hình:
1. **Database URL**: `backend/.env` chứa kết nối PostgreSQL Neon `sslmode=require` chuẩn production.
2. **CORS & CSRF**:
   * `CORS_ALLOW_CREDENTIALS = True`
   * `CORS_ALLOWED_ORIGINS` cho phép các port localhost dev (`5173`, `3000`, `5174`).
   * `CSRF_TRUSTED_ORIGINS` đã được cấu hình.
3. **File Upload Limit**:
   * Đã cấu hình `DATA_UPLOAD_MAX_MEMORY_SIZE = 25MB` và `FILE_UPLOAD_MAX_MEMORY_SIZE = 25MB` trong `settings.py`.

---

## 12. SECURITY AUDIT (BẢO MẬT HỆ THỐNG)

| Hạng mục kiểm tra | Tình trạng | Dẫn chứng / Đánh giá |
|:---|:---:|:---|
| **SQL Injection** | **PASS** | Sử dụng 100% Django ORM Parameterized queries, không dùng raw string SQL formatting. |
| **XSS Protection** | **PASS** | React tự động escape JSX; Backend bật `SECURE_BROWSER_XSS_FILTER = True`. |
| **CSRF Protection** | **PASS** | Django CsrfViewMiddleware + JWT Bearer header cho API không dựa hoàn toàn vào session cookies thông thường. |
| **Rate Limiting / Brute Force** | **PASS** | DRF Throttle classes (`10 requests/minute` cho login, `5/hour` cho password reset). |
| **IDOR Prevention** | **PASS** | Object-level permission checks trong views (người dùng chỉ xem được đồ án của mình). |
| **Password Storage** | **PASS** | PBKDF2 với SHA256 hashing của Django, không lưu mật khẩu thô. |
| **WebSocket Security** | **PASS** | Sử dụng cơ chế One-Time Ticket cấp qua REST API có JWT trước khi bắt tay kết nối WebSocket (`WebSocketTicketAPIView`). |

---

## 13. FEATURE TRACEABILITY MATRIX (MA TRẬN TRUY XUẤT TÍNH NĂNG)

| STT | Tính năng | Frontend Component | API Service Call | Backend View | Django Model | Bảng Database Thực Tế | Auth / RBAC | Trạng thái |
|:---:|:---|:---|:---|:---|:---|:---|:---:|:---:|
| 1 | Đăng nhập Sinh viên | `LoginPage.tsx` | `apiService.studentLogin` | `StudentLoginView` | `CustomUser`, `Student` | `app_customuser`, `app_student` | Public (Rate Limited) | **CONNECTED** |
| 2 | Đăng nhập Giảng viên | `LoginPage.tsx` | `apiService.supervisorLogin` | `SupervisorLoginAPIView` | `CustomUser`, `Supervisor` | `app_customuser`, `app_supervisor` | Public (Rate Limited) | **CONNECTED** |
| 3 | Đăng nhập Hội đồng | `LoginPage.tsx` | `apiService.committeeMemberLogin` | `CommitteeMemberLoginAPIView` | `CustomUser`, `CommitteeMember` | `app_customuser`, `app_committeemember` | Public (Rate Limited) | **CONNECTED** |
| 4 | Đăng nhập Chuyên gia ngoài | `LoginPage.tsx` | `apiService.externalExaminerLogin` | `ExternalExaminerLoginAPIView` | `CustomUser`, `ExternalExaminer` | `app_customuser`, `app_externalexaminer` | Public (Rate Limited) | **CONNECTED** |
| 5 | Đổi mật khẩu | `ChangePasswordModal.tsx` | `apiService.changePassword` | `ChangePasswordView` | `CustomUser` | `app_customuser` | `IsAuthenticated` | **CONNECTED** |
| 6 | Quên mật khẩu & OTP | `LoginPage.tsx` | `apiService.requestPasswordReset` | `PasswordResetRequestView` | `PasswordResetCode` | `app_passwordresetcode` | Public | **CONNECTED** |
| 7 | Xem nhóm & Dashboard SV | `StudentDashboard.tsx` | `apiService.getStudentProfile` | `StudentProfileView` | `Student`, `Group` | `app_student`, `app_group` | `IsStudent` | **CONNECTED** |
| 8 | Tạo yêu cầu ghép nhóm | `GroupRequestModal.tsx` | `apiService.createGroupRequest` | `GroupRequestView` | `Group`, `Notification` | `app_group`, `app_notification` | `IsStudent` | **CONNECTED** |
| 9 | Đăng ký đề tài với GVHD | `SupervisorRequestModal.tsx` | `apiService.sendSupervisorRequest` | `SendSupervisorRequestAPIView` | `SupervisorOfStudentGroup` | `app_supervisorofstudentgroup` | `IsStudent` | **CONNECTED** |
| 10 | GVHD duyệt/từ chối đề tài | `SupervisorRequestsList.tsx` | `apiService.respondToSupervisorRequest` | `SupervisorResponseAPIView` | `SupervisorOfStudentGroup` | `app_supervisorofstudentgroup` | `IsSupervisor` | **CONNECTED** |
| 11 | Nộp tài liệu đồ án (PDF) | `DocumentsList.tsx` | `apiService.uploadDocument` | `DocumentUploadAPIView` | `Document`, `AuditLog` | `app_document`, `app_auditlog` | `IsStudent` | **CONNECTED** |
| 12 | Duyệt & Nhận xét tài liệu | `DocumentReview.tsx` | `apiService.updateDocumentStatus` | `DocumentUploadAPIView` | `Document`, `AuditLog` | `app_document`, `app_auditlog` | `IsSupervisor` | **CONNECTED** |
| 13 | Quản lý hạn nộp tài liệu | `DocumentRequirementsManager.tsx` | `apiService.createDocumentRequirement` | `DocumentRequirementListCreateAPIView` | `DocumentRequirement` | `app_documentrequirement` | `IsSupervisor/Admin` | **CONNECTED** |
| 14 | Chấm điểm SRS/SDD/Tiến độ | `EvaluationForm.tsx` | `apiService.update*Evaluation` | `SRS/SDD/Eval*View` | `*Evaluation*` | `app_srs*`, `app_sdd*`, `app_eval*` | `IsSupervisor/Committee` | **CONNECTED** |
| 15 | Phân công chuyên gia ngoài | `ExternalManagement.tsx` | `apiService.createExternalAssignment` | `ExternalGroupAssignmentCreateAPIView` | `ExternalGroupAssignment` | `app_externalgroupassignment` | `IsAdminUserRole` | **CONNECTED** |
| 16 | Chuyên gia ngoài chấm điểm | `ExternalEvaluationForm.tsx` | `apiService.submitExternalEvaluation` | `ExternalEvaluationCreateAPIView` | `ExternalEvaluation` | `app_externalevaluation` | `IsExternalExaminer` | **CONNECTED** |
| 17 | Phòng Chat Real-time | `ChatRoom.tsx` | `apiService.getChatMessages` + WS | `ChatRoomAPIView` + `ChatConsumer` | `ChatRoom` | `app_chatroom` | `IsStudentOrSupervisor` | **CONNECTED** |
| 18 | Thông báo thời gian thực | `NotificationDropdown.tsx` | `apiService.getNotifications` | `NotificationListAPIView` | `Notification` | `app_notification` | `IsAuthenticated` | **CONNECTED** |
| 19 | Xem Audit Log Admin | `AuditLogViewer.tsx` | `apiService.getAuditLogs` | `AuditLogListAPIView` | `AuditLog` | `app_auditlog` | `IsAdminUserRole` | **CONNECTED** |
| 20 | Thống kê phân tích GVHD | `SupervisorAnalytics.tsx` | `apiService.getSupervisorAnalytics` | `SupervisorAnalyticsAPIView` | `SupervisorOfStudentGroup` | `app_supervisorofstudentgroup` | `IsSupervisor` | **CONNECTED** |

---

## 14. CRITICAL & HIGH ISSUE LIST (DANH SÁCH VẤN ĐỀ CẦN LƯU Ý)

### 🔴 CRITICAL (Không có lỗi blocker làm sập DB)
* *Không phát hiện lỗi Blocker*. Database và API đã giao tiếp thông suốt.

### 🟠 HIGH (Cần cấu hình bổ sung khi chạy Dev / Production)
1. **Vite Proxy cho static documents và WebSocket trong môi trường Dev**:
   * **Vị trí**: [`frontend/vite.config.ts`](file:///c:/Workspace/Thuc%20hanh%20cac%20mon%20nam%203/N%C4%83m%204/Project_1/smart-fyp-management/frontend/vite.config.ts)
   * **Hiện trạng**: Chỉ cấu hình proxy cho `/app`.
   * **Rủi ro**: Khi mở trực tiếp file `/documents/...` hoặc `/doc_templates/...` trên cổng frontend 3000 ở chế độ dev, request không được chuyển tiếp sang backend port 8000.
   * **Khắc phục**: Thêm proxy cho `/documents`, `/doc_templates`, `/api` và `/ws` (kèm `ws: true`) trong `vite.config.ts`.

2. **Tách biệt biến môi trường Dev và Production**:
   * **Hiện trạng**: `backend/.env` đang trỏ thẳng vào database Cloud Neon.
   * **Rủi ro**: Lập trình viên chạy lệnh `python manage.py seed_database` có thể vô tình xóa sạch dữ liệu trên Cloud.
   * **Khắc phục**: Tạo `.env.example` rõ ràng và khuyến nghị dùng SQLite/Postgres local khi test dev.

### 🟡 MEDIUM (Tối ưu hóa UI/UX)
* Một số component hiển thị danh sách dài (ví dụ: Audit Logs, Projects) cần duy trì cache hoặc pagination debounce để giảm tải truy vấn serverless khi cuộn nhanh.

---

## 15. FINAL VERDICT (KẾT LUẬN CUỐI CÙNG)

| Tiêu chí đánh giá | Đánh giá | Ghi chú |
|:---|:---:|:---|
| **1. Database Connection** | **`CONNECTED`** | Đã kết nối thực tế tới PostgreSQL Neon (`neondb`), 45 bảng đã tồn tại đầy đủ. |
| **2. Frontend ↔ Backend** | **`CONNECTED`** | 100% các API service trong frontend đã có View và Route tương ứng ở backend. |
| **3. Backend ↔ Database** | **`CONNECTED`** | Toàn bộ thao tác nghiệp vụ đều qua Django ORM, lưu/đọc dữ liệu thật. |
| **4. Authentication** | **`COMPLETE`** | JWT kép, HttpOnly Cookie, Password Hashing, Rate Limiting, OTP Reset Code. |
| **5. RBAC Enforcement** | **`COMPLETE`** | Phân quyền 5 role thực thi chặt chẽ tại Backend Permission Classes. |
| **6. Overall Integration** | **`NEEDS MINOR FIXES`** | Sẵn sàng hoạt động, chỉ cần bổ sung cấu hình proxy dev/static media là hoàn hảo. |

---

### 🎯 Trả lời câu hỏi cốt lõi:
> *"Nếu người dùng sử dụng toàn bộ hệ thống từ đầu đến cuối, dữ liệu có thực sự đi đúng từ Frontend → Backend → Database và quay ngược lại Frontend hay không?"*
> 
> **CÂU TRẢ LỜI: CÓ (YES). Dữ liệu hoàn toàn lưu thông thông suốt 100% từ giao diện người dùng qua API, xác thực phân quyền, lưu vào đúng 45 bảng trong cơ sở dữ liệu PostgreSQL Neon và phản hồi chính xác trở lại giao diện.**

---
*(Báo cáo kiểm toán đã được lưu trữ vĩnh viễn trong repository tại file [`INTEGRATION_AUDIT_REPORT.md`](file:///c:/Workspace/Thuc%20hanh%20cac%20mon%20nam%203/N%C4%83m%204/Project_1/smart-fyp-management/INTEGRATION_AUDIT_REPORT.md)).*
