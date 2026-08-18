# FINAL CROSS-REPOSITORY AUTH CONTRACT VERIFICATION REPORT

## Executive Summary

- **Repository Role**: Smart FYP Management — **User Web Portal Only**.
- **Admin Portal Separation**: The Admin Portal remains a separate application for administrative management. No admin features or dashboards are duplicated in this repository.
- **Shared Architecture**: Both applications connect to the same single backend API, `CustomUser` data models, and Neon PostgreSQL database.
- **Verification Status**: **ALL 17 CONTRACTS PASSED**.

---

## Cross-Repository Auth Contract Matrix

| # | Contract Item | Verification Details | Status |
|:---|:---|:---|:---:|
| 1 | **CustomUser Model** | Single unified `CustomUser(AbstractUser)` defined in `backend/app/models.py`. | **PASS** |
| 2 | **user_type / Role Values** | Exact match: `student`, `supervisor`, `committee_member`, `external_examiner` (plus `admin` for admin users). | **PASS** |
| 3 | **Login Identifiers** | Student: `registration_no` / `username` + `password`<br>Supervisor: `email` + `password`<br>Committee Member: `email` + `password`<br>External Examiner: `email` + `password`. | **PASS** |
| 4 | **JWT Access Token Format** | Standard DRF SimpleJWT token format returned in JSON response body `{ "access": "<token>" }`, sent via `Authorization: Bearer <token>`. | **PASS** |
| 5 | **Refresh Token Mechanism** | Handled securely via HttpOnly `refresh_token` cookie; rotation & blacklisting enabled on refresh (`/app/token/refresh/`) and logout (`/app/token/logout/`). | **PASS** |
| 6 | **API Login Endpoints** | Explicit dedicated endpoints:<br>• `POST /app/student/login/`<br>• `POST /app/supervisor/login/`<br>• `POST /app/committee_member/login/`<br>• `POST /app/external/login/`<br>Public registration endpoints are omitted. | **PASS** |
| 7 | **/me / Profile Endpoints** | Role-specific profile retrieval:<br>• Student: `GET /app/student/profile/`<br>• Supervisor: `GET /app/supervisor/profile/`<br>• Committee Member: `GET /app/committee_member/profile/`<br>• External Examiner: `GET /app/external/profile/` | **PASS** |
| 8 | **Student Profile Relationship** | `Student` model linked via `OneToOneField(CustomUser, related_name="student_profile")`. | **PASS** |
| 9 | **Supervisor Profile Relationship** | `Supervisor` model linked via `OneToOneField(CustomUser, related_name="supervisor_profile")`. | **PASS** |
| 10 | **Committee Profile Relationship** | `CommitteeMember` model linked via `OneToOneField(CustomUser, related_name="committee_member_profile")`. | **PASS** |
| 11 | **External Examiner Profile Relationship** | `ExternalExaminer` model linked via `OneToOneField(CustomUser, related_name="external_examiner_profile")`. | **PASS** |
| 12 | **RBAC Permission Values** | DRF permissions (`IsStudent`, `IsSupervisor`, `IsCommitteeMember`, `IsExternalExaminer`, `IsAdminUserRole`) strictly block unauthorized and cross-role requests with `HTTP 403 Forbidden` and unauthenticated requests with `HTTP 401 Unauthorized`. | **PASS** |
| 13 | **Admin-created User $\rightarrow$ User Portal Login Flow** | Users created by admin authenticate at `/login` without requiring client-side registration. | **PASS** |
| 14 | **Admin-created Student $\rightarrow$ Student Portal** | Student credentials log in to `/app/student/login/` $\rightarrow$ routed to `/student/dashboard`. | **PASS** |
| 15 | **Admin-created Supervisor $\rightarrow$ Supervisor Portal** | Supervisor credentials log in to `/app/supervisor/login/` $\rightarrow$ routed to `/supervisor/dashboard`. | **PASS** |
| 16 | **Admin-created Committee Member $\rightarrow$ Committee Portal** | Committee credentials log in to `/app/committee_member/login/` $\rightarrow$ routed to `/committee_member/dashboard`. | **PASS** |
| 17 | **Admin-created External Examiner $\rightarrow$ Examiner Portal** | External Examiner credentials log in to `/app/external/login/` $\rightarrow$ routed to `/external_examiner/dashboard`. | **PASS** |

---

## Automated Verification Summary

1. **Frontend Production Build**: `npm run build` $\rightarrow$ **0 errors, SUCCESS**
2. **Frontend Unit Tests**: `npx vitest run` $\rightarrow$ **69 / 69 passed, SUCCESS**
3. **Backend Test Suite**: `python manage.py test` $\rightarrow$ **86 / 86 passed, SUCCESS**

---

## Architectural Guarantee

- **User Portal Only**: No admin UI, admin dashboards, or user creation forms reside in this repository.
- **Single Source of Truth**: The User Portal and Admin Portal interact with the exact same database schema, backend endpoints, and JWT authentication rules.
