# External Evaluation System - API Documentation

## Overview

This document provides complete API documentation for the External Evaluation System, including all endpoints, request/response formats, and error codes.

**Base URL:** `http://localhost:8000/api/`

**API Version:** 1.0

---

## Table of Contents

1. [Authentication](#authentication)
2. [External Examiner Endpoints](#external-examiner-endpoints)
3. [Committee Member Endpoints](#committee-member-endpoints)
4. [Student Endpoints](#student-endpoints)
5. [Common Endpoints](#common-endpoints)
6. [Error Codes](#error-codes)
7. [Data Types](#data-types)

---

## Authentication

All API endpoints (except login) require JWT authentication.

### Headers Required

```http
Authorization: Bearer <access_token>
Content-Type: application/json
```

### Token Endpoints

#### Standard Login

```http
POST /api/token/
```

**Request Body:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response (200 OK):**
```json
{
  "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user_type": "student|supervisor|committee_member|external_examiner"
}
```

**Error Response (401 Unauthorized):**
```json
{
  "detail": "No active account found with the given credentials"
}
```

#### External Examiner Login

```http
POST /api/external/login/
```

**Request Body:**
```json
{
  "email": "examiner@university.edu",
  "password": "securePassword123"
}
```

**Response (200 OK):**
```json
{
  "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "examiner@university.edu",
    "user_type": "external_examiner"
  },
  "external_examiner": {
    "id": 1,
    "external_id": "EXT-2026-001",
    "full_name": "Dr. John Smith",
    "institution": "MIT",
    "designation": "professor"
  }
}
```

#### Refresh Token

```http
POST /api/token/refresh/
```

**Request Body:**
```json
{
  "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200 OK):**
```json
{
  "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

## External Examiner Endpoints

### Profile

#### Get Profile

```http
GET /api/external/profile/
```

**Response (200 OK):**
```json
{
  "id": 1,
  "user": {
    "id": 10,
    "username": "ext_jsmith",
    "email": "jsmith@mit.edu",
    "first_name": "John",
    "last_name": "Smith"
  },
  "external_id": "EXT-2026-001",
  "full_name": "Dr. John Smith",
  "institution": "MIT",
  "designation": "professor",
  "specialization": "Machine Learning",
  "phone": "+1-555-0123",
  "is_active": true,
  "created_at": "2026-01-15T10:30:00Z"
}
```

#### Update Profile

```http
PATCH /api/external/profile/
```

**Request Body:**
```json
{
  "phone": "+1-555-9999",
  "specialization": "Deep Learning, Computer Vision"
}
```

**Response (200 OK):**
```json
{
  "id": 1,
  "phone": "+1-555-9999",
  "specialization": "Deep Learning, Computer Vision",
  "updated_at": "2026-01-25T14:20:00Z"
}
```

### Dashboard

#### Get Dashboard Data

```http
GET /api/external/dashboard/
```

**Response (200 OK):**
```json
{
  "profile": {
    "id": 1,
    "external_id": "EXT-2026-001",
    "full_name": "Dr. John Smith",
    "institution": "MIT",
    "designation": "professor"
  },
  "statistics": {
    "total_groups": 3,
    "total_assignments": 15,
    "completed_evaluations": 12,
    "pending_evaluations": 3
  },
  "recent_evaluations": [
    {
      "id": 45,
      "student_name": "Alice Johnson",
      "project_name": "AI Chatbot",
      "total_marks": 78,
      "grade": "B+",
      "evaluated_at": "2026-01-24T16:30:00Z"
    }
  ],
  "upcoming_schedules": [
    {
      "id": 5,
      "date": "2026-01-28",
      "start_time": "10:00:00",
      "end_time": "12:00:00",
      "venue": "Room 101",
      "groups_count": 5
    }
  ]
}
```

### External Groups

#### List External Groups

```http
GET /api/external/groups/
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | integer | Page number (default: 1) |
| `page_size` | integer | Items per page (default: 20) |
| `semester` | string | Filter by semester |
| `status` | string | Filter by status: `active`, `completed` |

**Response (200 OK):**
```json
{
  "count": 3,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": 1,
      "name": "External Batch 2026-A",
      "external_examiner": 1,
      "external_examiner_name": "Dr. John Smith",
      "semester": "Spring 2026",
      "max_groups": 10,
      "assignments_count": 8,
      "status": "active",
      "evaluation_date": "2026-02-15",
      "evaluation_venue": "Room 101",
      "notes": "Morning batch",
      "created_at": "2026-01-10T09:00:00Z"
    }
  ]
}
```

#### Get Group Details

```http
GET /api/external/groups/{id}/
```

**Response (200 OK):**
```json
{
  "id": 1,
  "name": "External Batch 2026-A",
  "external_examiner": 1,
  "external_examiner_name": "Dr. John Smith",
  "semester": "Spring 2026",
  "max_groups": 10,
  "status": "active",
  "evaluation_date": "2026-02-15",
  "evaluation_venue": "Room 101",
  "notes": "Morning batch",
  "assignments": [
    {
      "id": 1,
      "supervisor_group": 5,
      "supervisor_group_details": {
        "id": 5,
        "group": {
          "id": 10,
          "student_1": {
            "id": 1,
            "name": "Alice Johnson",
            "registration_no": "2021-CS-001"
          },
          "student_2": {
            "id": 2,
            "name": "Bob Williams",
            "registration_no": "2021-CS-002"
          }
        },
        "supervisor": {
          "id": 3,
          "name": "Prof. Sarah Brown"
        },
        "project": {
          "id": 15,
          "project_name": "AI Chatbot",
          "project_description": "An intelligent chatbot using NLP"
        }
      },
      "status": "pending",
      "slot_time": "10:00",
      "evaluation": null,
      "assigned_at": "2026-01-12T14:00:00Z"
    }
  ],
  "created_at": "2026-01-10T09:00:00Z",
  "created_by": "committee_admin"
}
```

#### Create External Group (Committee Only)

```http
POST /api/external/groups/
```

**Request Body:**
```json
{
  "name": "External Batch 2026-B",
  "external_examiner": 1,
  "semester": "Spring 2026",
  "max_groups": 10,
  "evaluation_date": "2026-02-20",
  "evaluation_venue": "Room 102",
  "notes": "Afternoon batch"
}
```

**Response (201 Created):**
```json
{
  "id": 2,
  "name": "External Batch 2026-B",
  "external_examiner": 1,
  "external_examiner_name": "Dr. John Smith",
  "semester": "Spring 2026",
  "max_groups": 10,
  "status": "active",
  "evaluation_date": "2026-02-20",
  "evaluation_venue": "Room 102",
  "notes": "Afternoon batch",
  "assignments_count": 0,
  "created_at": "2026-01-25T10:00:00Z"
}
```

**Error Response (400 Bad Request):**
```json
{
  "external_examiner": ["This field is required."],
  "name": ["External group with this name already exists."]
}
```

#### Update External Group

```http
PATCH /api/external/groups/{id}/
```

**Request Body:**
```json
{
  "evaluation_date": "2026-02-22",
  "evaluation_venue": "Room 105",
  "notes": "Updated: Moved to afternoon"
}
```

**Response (200 OK):**
```json
{
  "id": 2,
  "name": "External Batch 2026-B",
  "evaluation_date": "2026-02-22",
  "evaluation_venue": "Room 105",
  "notes": "Updated: Moved to afternoon",
  "updated_at": "2026-01-25T11:30:00Z"
}
```

#### Delete External Group (Committee Only)

```http
DELETE /api/external/groups/{id}/
```

**Response (204 No Content)**

**Error Response (400 Bad Request):**
```json
{
  "detail": "Cannot delete group with existing evaluations."
}
```

### Assignments

#### List Assignments

```http
GET /api/external/assignments/
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `external_group` | integer | Filter by external group ID |
| `status` | string | Filter: `pending`, `evaluated` |

**Response (200 OK):**
```json
{
  "count": 15,
  "next": "/api/external/assignments/?page=2",
  "previous": null,
  "results": [
    {
      "id": 1,
      "external_group": 1,
      "external_group_name": "External Batch 2026-A",
      "supervisor_group": 5,
      "supervisor_group_details": {
        "group": {
          "student_1": {
            "name": "Alice Johnson",
            "registration_no": "2021-CS-001"
          },
          "student_2": {
            "name": "Bob Williams",
            "registration_no": "2021-CS-002"
          }
        },
        "supervisor": {
          "name": "Prof. Sarah Brown"
        },
        "project": {
          "project_name": "AI Chatbot"
        }
      },
      "status": "pending",
      "slot_time": "10:00",
      "evaluation": null,
      "assigned_at": "2026-01-12T14:00:00Z",
      "assigned_by": "committee_admin"
    }
  ]
}
```

#### Create Assignment (Committee Only)

```http
POST /api/external/assignments/
```

**Request Body:**
```json
{
  "external_group": 1,
  "supervisor_group": 5,
  "slot_time": "10:30"
}
```

**Response (201 Created):**
```json
{
  "id": 16,
  "external_group": 1,
  "supervisor_group": 5,
  "status": "pending",
  "slot_time": "10:30",
  "assigned_at": "2026-01-25T12:00:00Z",
  "assigned_by": "committee_admin"
}
```

**Error Response (400 Bad Request):**
```json
{
  "supervisor_group": ["This group is already assigned to an external examiner."]
}
```

#### Delete Assignment (Committee Only)

```http
DELETE /api/external/assignments/{id}/
```

**Response (204 No Content)**

**Error Response (400 Bad Request):**
```json
{
  "detail": "Cannot remove assignment that has been evaluated."
}
```

### Evaluations

#### List Evaluations

```http
GET /api/external/evaluations/
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | integer | Page number |
| `external_group` | integer | Filter by group |
| `is_pass` | boolean | Filter by pass/fail |

**Response (200 OK):**
```json
{
  "count": 12,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": 45,
      "assignment": 1,
      "assignment_details": {
        "student_names": "Alice Johnson & Bob Williams",
        "project_name": "AI Chatbot",
        "supervisor_name": "Prof. Sarah Brown"
      },
      "project_completion": 75,
      "code_quality": 95,
      "functionality": 75,
      "understanding_of_technology": 75,
      "problem_solving": 75,
      "innovation": 50,
      "presentation_clarity": 95,
      "communication": 75,
      "time_management": 75,
      "documentation_completeness": 75,
      "documentation_quality": 75,
      "qa_response": 95,
      "project_implementation_marks": 24.5,
      "technical_knowledge_marks": 18.75,
      "presentation_marks": 18.25,
      "documentation_marks": 11.25,
      "qa_marks": 9.5,
      "total_marks": 82.25,
      "grade": "A",
      "is_pass": true,
      "overall_comment": "Excellent work on the project.",
      "strengths": "Strong technical implementation, good presentation skills.",
      "areas_of_improvement": "Documentation could be more detailed.",
      "evaluated_at": "2026-01-24T16:30:00Z"
    }
  ]
}
```

#### Get Evaluation Details

```http
GET /api/external/evaluations/{id}/
```

**Response (200 OK):**
```json
{
  "id": 45,
  "assignment": 1,
  "assignment_details": {
    "id": 1,
    "external_group_name": "External Batch 2026-A",
    "student_names": "Alice Johnson & Bob Williams",
    "student_registrations": "2021-CS-001, 2021-CS-002",
    "project_name": "AI Chatbot",
    "project_description": "An intelligent chatbot using NLP",
    "supervisor_name": "Prof. Sarah Brown"
  },
  "project_completion": 75,
  "code_quality": 95,
  "functionality": 75,
  "understanding_of_technology": 75,
  "problem_solving": 75,
  "innovation": 50,
  "presentation_clarity": 95,
  "communication": 75,
  "time_management": 75,
  "documentation_completeness": 75,
  "documentation_quality": 75,
  "qa_response": 95,
  "project_implementation_marks": 24.5,
  "technical_knowledge_marks": 18.75,
  "presentation_marks": 18.25,
  "documentation_marks": 11.25,
  "qa_marks": 9.5,
  "total_marks": 82.25,
  "grade": "A",
  "is_pass": true,
  "overall_comment": "Excellent work on the project.",
  "strengths": "Strong technical implementation, good presentation skills.",
  "areas_of_improvement": "Documentation could be more detailed.",
  "evaluated_at": "2026-01-24T16:30:00Z",
  "updated_at": "2026-01-24T16:30:00Z"
}
```

#### Create Evaluation

```http
POST /api/external/evaluations/create/
```

**Request Body:**
```json
{
  "assignment": 1,
  "project_completion": 75,
  "code_quality": 95,
  "functionality": 75,
  "understanding_of_technology": 75,
  "problem_solving": 75,
  "innovation": 50,
  "presentation_clarity": 95,
  "communication": 75,
  "time_management": 75,
  "documentation_completeness": 75,
  "documentation_quality": 75,
  "qa_response": 95,
  "overall_comment": "Excellent work on the project.",
  "strengths": "Strong technical implementation, good presentation skills.",
  "areas_of_improvement": "Documentation could be more detailed."
}
```

**Response (201 Created):**
```json
{
  "id": 46,
  "assignment": 1,
  "project_completion": 75,
  "code_quality": 95,
  "functionality": 75,
  "understanding_of_technology": 75,
  "problem_solving": 75,
  "innovation": 50,
  "presentation_clarity": 95,
  "communication": 75,
  "time_management": 75,
  "documentation_completeness": 75,
  "documentation_quality": 75,
  "qa_response": 95,
  "project_implementation_marks": 24.5,
  "technical_knowledge_marks": 18.75,
  "presentation_marks": 18.25,
  "documentation_marks": 11.25,
  "qa_marks": 9.5,
  "total_marks": 82.25,
  "grade": "A",
  "is_pass": true,
  "overall_comment": "Excellent work on the project.",
  "strengths": "Strong technical implementation, good presentation skills.",
  "areas_of_improvement": "Documentation could be more detailed.",
  "evaluated_at": "2026-01-25T14:30:00Z"
}
```

**Error Response (400 Bad Request):**
```json
{
  "assignment": ["Evaluation already exists for this assignment."]
}
```

**Error Response (403 Forbidden):**
```json
{
  "detail": "You can only evaluate assignments in your own groups."
}
```

#### Update Evaluation

```http
PATCH /api/external/evaluations/{id}/
```

**Request Body:**
```json
{
  "code_quality": 95,
  "overall_comment": "Updated: Added more detailed feedback.",
  "areas_of_improvement": "Consider adding more unit tests."
}
```

**Response (200 OK):**
```json
{
  "id": 46,
  "code_quality": 95,
  "total_marks": 82.25,
  "grade": "A",
  "overall_comment": "Updated: Added more detailed feedback.",
  "areas_of_improvement": "Consider adding more unit tests.",
  "updated_at": "2026-01-25T15:00:00Z"
}
```

---

## Committee Member Endpoints

### List External Examiners

```http
GET /api/external/examiners/
```

**Response (200 OK):**
```json
{
  "count": 5,
  "results": [
    {
      "id": 1,
      "external_id": "EXT-2026-001",
      "full_name": "Dr. John Smith",
      "email": "jsmith@mit.edu",
      "institution": "MIT",
      "designation": "professor",
      "specialization": "Machine Learning",
      "is_active": true,
      "groups_count": 3
    }
  ]
}
```

### Get Available Groups for Assignment

```http
GET /api/external/available-groups/
```

**Response (200 OK):**
```json
{
  "count": 10,
  "results": [
    {
      "id": 5,
      "group": {
        "id": 10,
        "student_1_details": {
          "user": {
            "username": "alice_j",
            "first_name": "Alice",
            "last_name": "Johnson"
          },
          "registration_no": "2021-CS-001"
        },
        "student_2_details": {
          "user": {
            "username": "bob_w",
            "first_name": "Bob",
            "last_name": "Williams"
          },
          "registration_no": "2021-CS-002"
        }
      },
      "supervisor": {
        "user": {
          "username": "prof_brown"
        }
      },
      "project": {
        "project_name": "AI Chatbot",
        "project_description": "An intelligent chatbot"
      },
      "is_ready_for_external": true
    }
  ]
}
```

---

## Student Endpoints

### Get External Evaluation (Student View)

```http
GET /api/student/external-evaluation/
```

**Response (200 OK):**
```json
{
  "id": 45,
  "project_completion": 75,
  "code_quality": 95,
  "functionality": 75,
  "understanding_of_technology": 75,
  "problem_solving": 75,
  "innovation": 50,
  "presentation_clarity": 95,
  "communication": 75,
  "time_management": 75,
  "documentation_completeness": 75,
  "documentation_quality": 75,
  "qa_response": 95,
  "project_implementation_marks": 24.5,
  "technical_knowledge_marks": 18.75,
  "presentation_marks": 18.25,
  "documentation_marks": 11.25,
  "qa_marks": 9.5,
  "total_marks": 82.25,
  "grade": "A",
  "is_pass": true,
  "overall_comment": "Excellent work on the project.",
  "strengths": "Strong technical implementation.",
  "areas_of_improvement": "Documentation could be more detailed.",
  "evaluated_at": "2026-01-24T16:30:00Z",
  "external_examiner_name": "Dr. John Smith",
  "external_examiner_institution": "MIT"
}
```

**Response (404 Not Found):**
```json
{
  "detail": "No external evaluation found for your group."
}
```

---

## Common Endpoints

### Evaluation Schedules

#### List Schedules

```http
GET /api/external/schedules/
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `type` | string | Filter: `internal`, `external`, `final_defense` |
| `status` | string | Filter: `scheduled`, `completed`, `postponed`, `cancelled` |
| `upcoming` | boolean | Show only upcoming schedules |

**Response (200 OK):**
```json
{
  "count": 5,
  "results": [
    {
      "id": 1,
      "title": "External Evaluation - Batch A",
      "evaluation_type": "external",
      "date": "2026-02-15",
      "start_time": "10:00:00",
      "end_time": "13:00:00",
      "venue": "Room 101",
      "status": "scheduled",
      "external_group": 1,
      "external_group_name": "External Batch 2026-A",
      "panel_name": null,
      "notes": "Morning session"
    }
  ]
}
```

### Notifications

#### List Notifications

```http
GET /api/notifications/
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | integer | Page number |
| `is_read` | boolean | Filter by read status |

**Response (200 OK):**
```json
{
  "count": 25,
  "next": "/api/notifications/?page=2",
  "previous": null,
  "results": [
    {
      "id": 100,
      "notification_type": "external_assignment",
      "title": "New Assignment",
      "message": "You have been assigned to evaluate a new student group.",
      "is_read": false,
      "action_url": "/external_examiner/dashboard",
      "created_at": "2026-01-25T09:00:00Z"
    }
  ]
}
```

#### Get Unread Count

```http
GET /api/notifications/unread-count/
```

**Response (200 OK):**
```json
{
  "unread_count": 5
}
```

#### Mark Notifications as Read

```http
POST /api/notifications/mark-read/
```

**Request Body:**
```json
{
  "notification_ids": [100, 101, 102]
}
```

**Response (200 OK):**
```json
{
  "marked_count": 3
}
```

**Mark All as Read:**
```json
{}
```

#### Delete Notification

```http
DELETE /api/notifications/{id}/
```

**Response (204 No Content)**

---

## Error Codes

### HTTP Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | Request successful |
| 201 | Created | Resource created successfully |
| 204 | No Content | Successful deletion |
| 400 | Bad Request | Invalid request data |
| 401 | Unauthorized | Authentication required |
| 403 | Forbidden | Permission denied |
| 404 | Not Found | Resource not found |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |

### Error Response Format

```json
{
  "detail": "Error message describing the issue."
}
```

Or for validation errors:

```json
{
  "field_name": ["Error message for this field."],
  "another_field": ["Another error message."]
}
```

### Common Error Messages

| Error | Description | Solution |
|-------|-------------|----------|
| `"Authentication credentials were not provided."` | Missing JWT token | Include `Authorization: Bearer <token>` header |
| `"Token is invalid or expired"` | JWT expired | Refresh token using `/api/token/refresh/` |
| `"You do not have permission to perform this action."` | Role-based restriction | Check user permissions |
| `"This field is required."` | Missing required field | Include all required fields |
| `"Object not found."` | Invalid ID | Verify the resource exists |

---

## Data Types

### Rating Values

Evaluation ratings are percentage-based:

| Value | Label | Description |
|-------|-------|-------------|
| 0 | Not Evaluated | 0% |
| 20 | Marginal | 20% |
| 50 | Adequate | 50% |
| 75 | Good | 75% |
| 95 | Excellent | 95% |

### Grade Calculation

| Total Marks | Grade |
|-------------|-------|
| 85-100 | A |
| 75-84 | B+ |
| 65-74 | B |
| 55-64 | C+ |
| 50-54 | C |
| 0-49 | F (Fail) |

### Marks Distribution

| Section | Max Marks | Criteria |
|---------|-----------|----------|
| Project Implementation | 30 | Completion (10), Code Quality (10), Functionality (10) |
| Technical Knowledge | 25 | Understanding (10), Problem Solving (10), Innovation (5) |
| Presentation Skills | 20 | Clarity (10), Communication (5), Time Management (5) |
| Documentation | 15 | Completeness (8), Quality (7) |
| Q&A Response | 10 | Response Quality (10) |
| **Total** | **100** | |

### User Types

| Type | Description | Permissions |
|------|-------------|-------------|
| `student` | Student user | View own evaluations |
| `supervisor` | Project supervisor | View supervised groups |
| `committee_member` | FYP committee | Full management access |
| `external_examiner` | External evaluator | Evaluate assigned groups |

### Assignment Status

| Status | Description |
|--------|-------------|
| `pending` | Awaiting evaluation |
| `evaluated` | Evaluation completed |

### Schedule Status

| Status | Description |
|--------|-------------|
| `scheduled` | Upcoming scheduled event |
| `completed` | Event completed |
| `postponed` | Event rescheduled |
| `cancelled` | Event cancelled |

---

## Rate Limiting

API requests are rate-limited to prevent abuse:

| User Type | Limit |
|-----------|-------|
| Anonymous | 100 requests/hour |
| Authenticated | 1000 requests/hour |

**Rate Limit Headers:**
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1706198400
```

---

## Changelog

### Version 1.0 (January 2026)
- Initial API documentation
- External Examiner endpoints
- Evaluation system
- Schedule management
- Notification system

---

## Support

For API issues or questions, contact:
- **Email:** support@fyp-system.edu
- **Documentation:** This file
- **Postman Collection:** See `postman/` directory
