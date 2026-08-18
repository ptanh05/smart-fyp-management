# FINAL CROSS-REPOSITORY AUTHENTICATION CONTRACT AUDIT

**Target Systems**: Smart FYP Management — Admin Portal & User Portal  
**Architecture Model**: Shared Backend (Django REST Framework) + Unified Database (PostgreSQL / Neon) + SimpleJWT Token Authentication with HttpOnly Cookies  
**Audit Scope**: End-to-End User Provisioning, Authentication, Role Resolution, Profile Binding, RBAC Enforcement, and Resource Boundary Security.

---

## 1. Executive Summary & Verdict

```
==================================================
FINAL CROSS-REPOSITORY AUTHENTICATION VERDICT:
CROSS_REPO_AUTH = PASS
==================================================
```

All 4 user roles (`STUDENT`, `SUPERVISOR`, `COMMITTEE_MEMBER`, `EXTERNAL_EXAMINER`) adhere to a 100% compatible authentication contract across the Admin Portal and User Portal through the shared backend and database models.

---

## 2. End-to-End Lifecycle Verification

```
ADMIN PORTAL (Admin creates user)
        ↓
SAME NEON POSTGRESQL / SQLite DB (CustomUser + Profile record created)
        ↓
USER PORTAL LOGIN (Role-specific credentials submitted to /login)
        ↓
BACKEND AUTHENTICATION (JWT access token issued + HttpOnly refresh cookie)
        ↓
USER PORTAL ROLE ROUTING (Auto-redirected to role-specific dashboard)
        ↓
RESOURCE & PROFILE ACCESS (Live data loaded; wrong-role & Admin APIs blocked with 403)
```

---

## 3. Detailed Verification by Role

### 1. STUDENT Verification
- **Admin Creation $\rightarrow$ Database**: `CustomUser` (`username="E2E_CROSS_REPO_student"`, `email="E2E_CROSS_REPO_student@sv.utc.edu.vn"`, `user_type="student"`, `is_active=True`) + `Student` profile (`registration_no="E2E_REG_101"`, `semester="semester_8"`).
- **Database Persistence**: Record verified with active status and `user.student_profile` OneToOne relationship.
- **Login API**: `POST /app/student/login/` with `{ "registration_no": "E2E_REG_101", "password": "StudentPassword123!" }` $\rightarrow$ `HTTP 200 OK`.
- **JWT Issuance**: Returned `{ "access": "<jwt_token>" }` and set `HttpOnly` `refresh_token` cookie.
- **Profile Endpoint**: `GET /app/student/profile/` with `Bearer <token>` $\rightarrow$ `HTTP 200 OK`, `registration_no: "E2E_REG_101"`.
- **User Portal Dashboard**: Routes to `/student/dashboard`.
- **RBAC & Security**:
  - Student $\rightarrow$ `/app/supervisor/profile/` $\rightarrow$ `HTTP 403 Forbidden`
  - Student $\rightarrow$ `/app/committee_member/profile/` $\rightarrow$ `HTTP 403 Forbidden`
  - Student $\rightarrow$ `/app/external/profile/` $\rightarrow$ `HTTP 403 Forbidden`
  - Student $\rightarrow$ `/app/admin/users/` $\rightarrow$ `HTTP 403 Forbidden`
  - Student $\rightarrow$ `/app/admin/security-center/` $\rightarrow$ `HTTP 403 Forbidden`
- **Result**: **PASS**

---

### 2. SUPERVISOR Verification
- **Admin Creation $\rightarrow$ Database**: `CustomUser` (`username="E2E_CROSS_REPO_supervisor"`, `email="E2E_CROSS_REPO_supervisor@utc.edu.vn"`, `user_type="supervisor"`, `is_active=True`) + `Supervisor` profile (`supervisor_id="E2E_SUP_201"`).
- **Database Persistence**: Record verified with active status and `user.supervisor_profile` OneToOne relationship.
- **Login API**: `POST /app/supervisor/login/` with `{ "email": "E2E_CROSS_REPO_supervisor@utc.edu.vn", "password": "SupervisorPassword123!" }` $\rightarrow$ `HTTP 200 OK`.
- **JWT Issuance**: Returned `{ "access": "<jwt_token>" }` and set `HttpOnly` `refresh_token` cookie.
- **Profile Endpoint**: `GET /app/supervisor/profile/` with `Bearer <token>` $\rightarrow$ `HTTP 200 OK`, `supervisor_id: "E2E_SUP_201"`.
- **User Portal Dashboard**: Routes to `/supervisor/dashboard`.
- **RBAC & Security**:
  - Supervisor $\rightarrow$ `/app/student/profile/` $\rightarrow$ `HTTP 403 Forbidden`
  - Supervisor $\rightarrow$ `/app/committee_member/profile/` $\rightarrow$ `HTTP 403 Forbidden`
  - Supervisor $\rightarrow$ `/app/external/profile/` $\rightarrow$ `HTTP 403 Forbidden`
  - Supervisor $\rightarrow$ `/app/admin/users/` $\rightarrow$ `HTTP 403 Forbidden`
  - Supervisor $\rightarrow$ `/app/admin/security-center/` $\rightarrow$ `HTTP 403 Forbidden`
- **Result**: **PASS**

---

### 3. COMMITTEE MEMBER Verification
- **Admin Creation $\rightarrow$ Database**: `CustomUser` (`username="E2E_CROSS_REPO_committee"`, `email="E2E_CROSS_REPO_committee@utc.edu.vn"`, `user_type="committee_member"`, `is_active=True`) + `CommitteeMember` profile (`committee_id="E2E_COM_301"`, `panel=panel`).
- **Database Persistence**: Record verified with active status and `user.committee_member_profile` OneToOne relationship.
- **Login API**: `POST /app/committee_member/login/` with `{ "email": "E2E_CROSS_REPO_committee@utc.edu.vn", "password": "CommitteePassword123!" }` $\rightarrow$ `HTTP 200 OK`.
- **JWT Issuance**: Returned `{ "access": "<jwt_token>" }` and set `HttpOnly` `refresh_token` cookie.
- **Profile Endpoint**: `GET /app/committee_member/profile/` with `Bearer <token>` $\rightarrow$ `HTTP 200 OK`, `committee_id: "E2E_COM_301"`.
- **User Portal Dashboard**: Routes to `/committee_member/dashboard`.
- **RBAC & Security**:
  - Committee Member $\rightarrow$ `/app/student/profile/` $\rightarrow$ `HTTP 403 Forbidden`
  - Committee Member $\rightarrow$ `/app/supervisor/profile/` $\rightarrow$ `HTTP 403 Forbidden`
  - Committee Member $\rightarrow$ `/app/external/profile/` $\rightarrow$ `HTTP 403 Forbidden`
  - Committee Member $\rightarrow$ `/app/admin/users/` $\rightarrow$ `HTTP 403 Forbidden`
  - Committee Member $\rightarrow$ `/app/admin/security-center/` $\rightarrow$ `HTTP 403 Forbidden`
- **Result**: **PASS**

---

### 4. EXTERNAL EXAMINER Verification
- **Admin Creation $\rightarrow$ Database**: `CustomUser` (`username="E2E_CROSS_REPO_external"`, `email="E2E_CROSS_REPO_external@partner.edu.vn"`, `user_type="external_examiner"`, `is_active=True`) + `ExternalExaminer` profile (`external_id="E2E_EXT_401"`, `institution="Partner University"`).
- **Database Persistence**: Record verified with active status and `user.external_examiner_profile` OneToOne relationship.
- **Login API**: `POST /app/external/login/` with `{ "email": "E2E_CROSS_REPO_external@partner.edu.vn", "password": "ExternalPassword123!" }` $\rightarrow$ `HTTP 200 OK`.
- **JWT Issuance**: Returned `{ "access": "<jwt_token>" }` and set `HttpOnly` `refresh_token` cookie.
- **Profile Endpoint**: `GET /app/external/profile/` & `GET /app/external/dashboard/` with `Bearer <token>` $\rightarrow$ `HTTP 200 OK`, `external_id: "E2E_EXT_401"`.
- **User Portal Dashboard**: Routes to `/external_examiner/dashboard`.
- **RBAC & Security**:
  - External Examiner $\rightarrow$ `/app/student/profile/` $\rightarrow$ `HTTP 403 Forbidden`
  - External Examiner $\rightarrow$ `/app/supervisor/profile/` $\rightarrow$ `HTTP 403 Forbidden`
  - External Examiner $\rightarrow$ `/app/committee_member/profile/` $\rightarrow$ `HTTP 403 Forbidden`
  - External Examiner $\rightarrow$ `/app/admin/users/` $\rightarrow$ `HTTP 403 Forbidden`
  - External Examiner $\rightarrow$ `/app/admin/security-center/` $\rightarrow$ `HTTP 403 Forbidden`
- **Result**: **PASS**

---

## 4. Security & Access Matrix

| Role | Student Profile | Supervisor Profile | Committee Profile | External Profile | Admin APIs (`/admin/users/`, `/admin/security-center/`) |
|:---|:---:|:---:|:---:|:---:|:---:|
| **Unauthenticated** | `401 Unauthorized` | `401 Unauthorized` | `401 Unauthorized` | `401 Unauthorized` | `401 Unauthorized` |
| **Student** | `200 OK` | `403 Forbidden` | `403 Forbidden` | `403 Forbidden` | `403 Forbidden` |
| **Supervisor** | `403 Forbidden` | `200 OK` | `403 Forbidden` | `403 Forbidden` | `403 Forbidden` |
| **Committee Member** | `403 Forbidden` | `403 Forbidden` | `200 OK` | `403 Forbidden` | `403 Forbidden` |
| **External Examiner** | `403 Forbidden` | `403 Forbidden` | `403 Forbidden` | `200 OK` | `403 Forbidden` |
| **Admin Staff / Superuser** | `403 Forbidden` (non-student) | `200 OK` (if supervisor profile) | `403 Forbidden` (non-committee) | `403 Forbidden` (non-external) | `200 OK` |

---

## 5. Cleanup Verification

- All temporary E2E accounts created during testing were prefixed with `E2E_CROSS_REPO_`.
- Execution of `tearDown()` and automated cleanup purges all `E2E_CROSS_REPO_` users and linked profile objects.
- Verification query confirmed remaining count:
  ```python
  CustomUser.objects.filter(username__startswith="E2E_CROSS_REPO_").count() == 0
  ```
- **Cleanup Status**: **PASS**

---

## 6. Authentication Contract Comparison

| Property | Admin Portal Contract | User Portal Contract | Match Status |
|:---|:---|:---|:---:|
| **Login Endpoint** | Dedicated role login routes | Dedicated role login routes | **MATCH (PASS)** |
| **HTTP Method** | `POST` | `POST` | **MATCH (PASS)** |
| **Request Body** | JSON `{ "registration_no"/"email": ..., "password": ... }` | JSON `{ "registration_no"/"email": ..., "password": ... }` | **MATCH (PASS)** |
| **Access Token Format** | JWT `{ "access": "<token>" }` | JWT `{ "access": "<token>" }` | **MATCH (PASS)** |
| **Refresh Mechanism** | HttpOnly Cookie (`refresh_token`) | HttpOnly Cookie (`refresh_token`) | **MATCH (PASS)** |
| **Authorization Header** | `Authorization: Bearer <access_token>` | `Authorization: Bearer <access_token>` | **MATCH (PASS)** |
| **Role Values** | `student`, `supervisor`, `committee_member`, `external_examiner`, `admin` | `student`, `supervisor`, `committee_member`, `external_examiner`, `admin` | **MATCH (PASS)** |
| **Self-Registration** | Disabled | Disabled (No public `/register`) | **MATCH (PASS)** |
| **Unauthenticated Response** | `HTTP 401 Unauthorized` | `HTTP 401 Unauthorized` | **MATCH (PASS)** |
| **Cross-Role Response** | `HTTP 403 Forbidden` | `HTTP 403 Forbidden` | **MATCH (PASS)** |

---

## 7. Files Modified & Tests Executed

### Files Added / Modified
1. [`backend/app/tests/test_cross_repo_auth.py`](file:///c:/Workspace/Thuc%20hanh%20cac%20mon%20nam%203/N%C4%83m%204/Project_1/smart-fyp-management/backend/app/tests/test_cross_repo_auth.py): Complete 6-phase cross-repository authentication contract test suite.
2. [`FINAL_CROSS_REPO_AUTH_AUDIT.md`](file:///c:/Workspace/Thuc%20hanh%20cac%20mon%20nam%203/N%C4%83m%204/Project_1/smart-fyp-management/FINAL_CROSS_REPO_AUTH_AUDIT.md): This comprehensive audit report.

### Test Execution Results
- `npm run build` $\rightarrow$ **0 errors (Build PASSED)**
- `npx vitest run` $\rightarrow$ **69 / 69 passed (Vitest PASSED)**
- `python manage.py test app.tests.test_cross_repo_auth` $\rightarrow$ **6 / 6 passed (PASSED)**
- `python manage.py test` $\rightarrow$ **92 / 92 passed (Backend Full Suite PASSED)**
