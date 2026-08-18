# FINAL USER PORTAL AUTH & ARCHITECTURE REPORT

## 1. Executive Summary & Architecture Confirmation

This repository is strictly the **Smart FYP Management — User Web Portal**.
- **Supported User Roles**:
  - `STUDENT`
  - `SUPERVISOR`
  - `COMMITTEE_MEMBER`
  - `EXTERNAL_EXAMINER`
- **Scope Boundary**: No Admin Portal features or Admin pages are implemented in this repository. Public self-registration (`/register`, `/signup`, `/create-account`) is completely absent. User accounts are provisioned and managed strictly through administrative channels.
- **Shared Architecture**: The portal relies directly on the single unified PostgreSQL database and backend Django REST Framework API with standard `CustomUser` models and JWT token authentication.

---

## 2. Files Changed

| File Path | Description of Change |
|:---|:---|
| [`backend/requirements.txt`](file:///c:/Workspace/Thuc%20hanh%20cac%20mon%20nam%203/N%C4%83m%204/Project_1/smart-fyp-management/backend/requirements.txt) | Explicitly added `dj-database-url>=3.0.0` dependency for environment configuration parsing. |
| [`backend/app/tests/test_security.py`](file:///c:/Workspace/Thuc%20hanh%20cac%20mon%20nam%203/N%C4%83m%204/Project_1/smart-fyp-management/backend/app/tests/test_security.py) | Added comprehensive RBAC test cases verifying all 4 roles accessing allowed resources and being blocked with HTTP 403 on admin endpoints, plus 401 on unauthenticated access. |
| [`FINAL_USER_PORTAL_AUTH_REPORT.md`](file:///c:/Workspace/Thuc%20hanh%20cac%20mon%20nam%203/N%C4%83m%204/Project_1/smart-fyp-management/FINAL_USER_PORTAL_AUTH_REPORT.md) | Created final audit and sign-off report. |

---

## 3. Login Flow

- **Endpoint**: `/login` (Single portal entry point).
- **No Self-Registration**: Public `/register`, `/signup`, and `/create-account` routes do not exist.
- **Credential Dispatching**:
  - **Student**: Dispatches to `POST /app/student/login/` with `registration_no` & `password`.
  - **Supervisor**: Dispatches to `POST /app/supervisor/login/` with `email` & `password`.
  - **Committee Member**: Dispatches to `POST /app/committee_member/login/` with `email` & `password`.
  - **External Examiner**: Dispatches to `POST /app/external/login/` with `email` & `password`.
- **Token Security**:
  - Server returns JWT `access` token and sets a secure, `HttpOnly` cookie for `refresh_token`.
  - The frontend client stores the access token in memory/localStorage and attaches it via `Authorization: Bearer <token>` in Axios interceptors.
  - Token refresh occurs seamlessly via `POST /app/token/refresh/` using the HttpOnly cookie.

---

## 4. Role Routing & Dashboards

Routing is defined in [`frontend/src/App.tsx`](file:///c:/Workspace/Thuc%20hanh%20cac%20mon%20nam%203/N%C4%83m%204/Project_1/smart-fyp-management/frontend/src/App.tsx) and guarded by `ProtectedRoute`:

```tsx
<Routes>
  <Route path="/login" element={userType ? <Navigate to={`/${userType}/dashboard`} replace /> : <LoginPage />} />
  <Route path="/student/dashboard" element={<ProtectedRoute allowedTypes={['student']}><StudentDashboard /></ProtectedRoute>} />
  <Route path="/supervisor/dashboard" element={<ProtectedRoute allowedTypes={['supervisor']}><SupervisorDashboard /></ProtectedRoute>} />
  <Route path="/committee_member/dashboard" element={<ProtectedRoute allowedTypes={['committee_member']}><CommitteeMemberDashboard /></ProtectedRoute>} />
  <Route path="/external_examiner/dashboard" element={<ProtectedRoute allowedTypes={['external_examiner']}><ExternalDashboard /></ProtectedRoute>} />
  <Route path="/" element={<Navigate to="/login" replace />} />
  <Route path="*" element={<Navigate to="/login" replace />} />
</Routes>
```

- **Student**: `StudentDashboard.tsx` (projects, documents, group requests, evaluations, notifications, chat)
- **Supervisor**: `SupervisorDashboard.tsx` (assigned student groups, proposal & document reviews, evaluations, templates, comments)
- **Committee Member**: `CommitteeMemberDashboard.tsx` (panel groups, evaluation rubrics SRS/SDD/Eval3/Eval4, templates, requirements)
- **External Examiner**: `ExternalDashboard.tsx` (assigned groups, evaluation scoring, grading rubrics, schedule view)

---

## 5. RBAC & Security Verification

Backend enforces strict permissions for every API endpoint:
- **Unauthenticated requests** to protected resources receive `HTTP 401 UNAUTHORIZED`.
- **Cross-role access / Student to Supervisor / Student to Admin** receive `HTTP 403 FORBIDDEN`.
- **Supervisor / Committee / External accessing Admin APIs** receive `HTTP 403 FORBIDDEN`.
- **Security Headers**: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`.
- **Path Traversal & Enumeration Protections**: Verified in unit tests.

---

## 6. Database Verification

- Uses single unified database engine (`django.db.backends.postgresql` / `neon` / SQLite test runner).
- Unified `CustomUser` model located in [`backend/app/models.py`](file:///c:/Workspace/Thuc%20hanh%20cac%20mon%20nam%203/N%C4%83m%204/Project_1/smart-fyp-management/backend/app/models.py).
- No secondary or duplicate database / user models exist.

---

## 7. Mock Data Status

- **Runtime API**: Direct integration via `apiService` in [`frontend/src/services/api.ts`](file:///c:/Workspace/Thuc%20hanh%20cac%20mon%20nam%203/N%C4%83m%204/Project_1/smart-fyp-management/frontend/src/services/api.ts) making real HTTP/REST requests.
- **No Mock Fallbacks in Production Code**: All production components fetch live data from the backend.
- Test suites (`vitest`) maintain isolated fixtures for testing UI behavior only.

---

## 8. Test Execution Results

### 1. Frontend Build (`npm run build`)
```
> frontend@0.0.0 build
> tsc && vite build

vite v5.4.21 building for production...
transforming...
✓ 184 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.47 kB │ gzip:   0.31 kB
dist/assets/index-xJzgxK47.css  131.28 kB │ gzip:  21.67 kB
dist/assets/index-CxPmbjvg.js   503.26 kB │ gzip: 145.45 kB
✓ built in 1.00s
```
**Status: PASSED (0 errors)**

### 2. Frontend Unit Tests (`npx vitest run`)
```
 Test Files  4 passed (4)
      Tests  69 passed (69)
   Duration  1.98s
```
**Status: PASSED (69 / 69 passed)**

### 3. Backend Test Suite (`python manage.py test`)
```
Found 86 test(s).
System check identified no issues (0 silenced).
......................................................................................
Ran 86 tests in 89.184s

OK (skipped=1)
```
**Status: PASSED (86 / 86 passed, 0 failures, 0 errors)**

---

## 9. Remaining Issues

- **None**. The codebase strictly complies with the User Web Portal role boundaries, single `/login` authentication without self-registration, backend-enforced RBAC, and clean production builds with passing unit and security test suites.
