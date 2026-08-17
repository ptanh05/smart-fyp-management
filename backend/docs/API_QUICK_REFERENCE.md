# API Quick Reference Card

## Base URL
```
http://localhost:8000/api/
```

## Authentication Header
```
Authorization: Bearer <access_token>
```

---

## Quick Reference Table

### Authentication

| Action | Method | Endpoint |
|--------|--------|----------|
| Login (Standard) | POST | `/token/` |
| Login (External) | POST | `/external/login/` |
| Refresh Token | POST | `/token/refresh/` |

### External Examiner

| Action | Method | Endpoint |
|--------|--------|----------|
| Get Profile | GET | `/external/profile/` |
| Update Profile | PATCH | `/external/profile/` |
| Get Dashboard | GET | `/external/dashboard/` |
| List Groups | GET | `/external/groups/` |
| Get Group Details | GET | `/external/groups/{id}/` |
| Create Group | POST | `/external/groups/` |
| Update Group | PATCH | `/external/groups/{id}/` |
| Delete Group | DELETE | `/external/groups/{id}/` |
| List Assignments | GET | `/external/assignments/` |
| Create Assignment | POST | `/external/assignments/` |
| Delete Assignment | DELETE | `/external/assignments/{id}/` |
| List Evaluations | GET | `/external/evaluations/` |
| Get Evaluation | GET | `/external/evaluations/{id}/` |
| Create Evaluation | POST | `/external/evaluations/create/` |
| Update Evaluation | PATCH | `/external/evaluations/{id}/` |

### Committee Member

| Action | Method | Endpoint |
|--------|--------|----------|
| List Examiners | GET | `/external/examiners/` |
| Get Available Groups | GET | `/external/available-groups/` |

### Student

| Action | Method | Endpoint |
|--------|--------|----------|
| Get External Evaluation | GET | `/student/external-evaluation/` |

### Common

| Action | Method | Endpoint |
|--------|--------|----------|
| List Schedules | GET | `/external/schedules/` |
| List Notifications | GET | `/notifications/` |
| Get Unread Count | GET | `/notifications/unread-count/` |
| Mark as Read | POST | `/notifications/mark-read/` |
| Delete Notification | DELETE | `/notifications/{id}/` |

---

## Common Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | int | Page number for pagination |
| `page_size` | int | Items per page (default: 20) |
| `search` | string | Search term |

---

## HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 204 | Deleted |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 429 | Rate Limited |

---

## Rating Values

| Value | Label |
|-------|-------|
| 0 | Not Evaluated |
| 20 | Marginal |
| 50 | Adequate |
| 75 | Good |
| 95 | Excellent |

---

## Grade Scale

| Marks | Grade |
|-------|-------|
| 85-100 | A |
| 75-84 | B+ |
| 65-74 | B |
| 55-64 | C+ |
| 50-54 | C |
| 0-49 | F |

---

## Example Requests

### Login
```bash
curl -X POST http://localhost:8000/api/token/ \
  -H "Content-Type: application/json" \
  -d '{"username": "external1", "password": "test123"}'
```

### Get Dashboard
```bash
curl http://localhost:8000/api/external/dashboard/ \
  -H "Authorization: Bearer <token>"
```

### Create Evaluation
```bash
curl -X POST http://localhost:8000/api/external/evaluations/create/ \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "assignment": 1,
    "project_completion": 75,
    "code_quality": 75,
    "functionality": 75,
    "understanding_of_technology": 75,
    "problem_solving": 75,
    "innovation": 50,
    "presentation_clarity": 75,
    "communication": 75,
    "time_management": 75,
    "documentation_completeness": 75,
    "documentation_quality": 75,
    "qa_response": 75
  }'
```

---

## Files

| File | Description |
|------|-------------|
| `API_DOCUMENTATION.md` | Full API documentation |
| `API_QUICK_REFERENCE.md` | This quick reference |
| `postman/External_Evaluation_API.postman_collection.json` | Postman collection |
