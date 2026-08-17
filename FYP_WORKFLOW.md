# FYP Management System - Complete User Workflow

## Overview

This document outlines the complete workflow for the FYP (Final Year Project) Management System based on practical FYP management processes at COMSATS University. The system has **5 user roles**:

1. **Admin (Superuser)** - System administrator who manages users and configurations
2. **Student** - Undergraduate students working on FYP
3. **Supervisor** - Faculty members guiding student projects
4. **Committee Member** - Evaluation panel members who assess projects
5. **External Examiner** - External academic or industry professionals who provide independent evaluations

---

## Phase 1: System Setup (Admin/Superuser)

### 1.1 Initial Configuration
The Admin (Superuser) performs initial system setup through Django Admin panel (`/admin/`).

**Tasks:**
1. **Create Project Categories**
   - Navigate to: Admin Panel > Project Categories
   - Add categories like: Web Development, Mobile App, AI/ML, IoT, Data Science, etc.
   - Each category groups related projects for easier management

2. **Create Committee Panels**
   - Navigate to: Admin Panel > Committee Member Panels
   - Create panels (e.g., Panel A, Panel B, Panel C)
   - Each panel will be assigned to evaluate specific groups

3. **Register Users**
   - **Students**: Create accounts with `user_type = 'student'`
     - Required: username, email, password, registration_no
   - **Supervisors**: Create accounts with `user_type = 'supervisor'`
     - Required: username, email, password, employee_id, project_categories (areas of expertise)
   - **Committee Members**: Create accounts with `user_type = 'committee_member'`
     - Required: username, email, password, committee_id, assigned panel
   - **External Examiners**: Create accounts with `user_type = 'external_examiner'`
     - Required: username, email, password, affiliation, expertise area

### 1.2 Supervisor Project Setup
Supervisors create projects that students can select.

**Tasks:**
1. Login as Supervisor
2. Navigate to "My Projects" or "Create Project"
3. Add project details:
   - Project Name
   - Description
   - Project Category
   - Max groups allowed
4. Projects appear in the student project selection list

---

## Phase 2: Group Formation (Students)

### 2.1 Student Registration & Profile
```
Flow: Student Login → Dashboard → Profile
```

**Steps:**
1. Student logs in with credentials provided by admin
2. Complete profile information:
   - Full name
   - Contact details
   - Academic information
3. Profile must be complete before group formation

### 2.2 Creating a Group (Initiator Student)
```
Flow: Student Dashboard → Groups Tab → Create Group Request
```

**Steps:**
1. Student 1 (Initiator) goes to Groups tab
2. Clicks "Create Group Request"
3. Searches for Student 2 by registration number or name
4. Sends group invitation to Student 2
5. Status: **Pending**

### 2.3 Accepting/Rejecting Group Request (Receiver Student)
```
Flow: Student Dashboard → Groups Tab → Received Requests
```

**Steps:**
1. Student 2 sees pending group request
2. Can view Student 1's profile
3. **Accept**: Group is formed (Status: **Accepted**)
4. **Reject**: Request is declined (Status: **Rejected**)

### 2.4 Group Discussion (Optional)
```
Flow: Student Dashboard → Groups Tab → Comments Section
```

- Students can discuss before finalizing the group
- Comments are visible to both students
- Helps in decision making before acceptance

---

## Phase 3: Supervisor Request & Project Selection (Students)

### 3.1 Browsing Available Projects
```
Flow: Student Dashboard → Projects Tab
```

**Prerequisites:**
- Student must be in an accepted group

**Steps:**
1. View list of available projects
2. Filter by category
3. See project details: title, description, supervisor name
4. Check supervisor's current workload

### 3.2 Sending Supervisor Request
```
Flow: Student Dashboard → Supervisor Tab → Request Supervisor
```

**Steps:**
1. Click "Request Supervisor"
2. Select a project (automatically selects the supervisor)
3. Submit request
4. Status: **Pending**

### 3.3 Supervisor Response
The supervisor can:
- **Accept**: Group is officially assigned (Status: **Accepted**)
- **Reject**: Group must find another supervisor (Status: **Rejected**)

### 3.4 After Acceptance
Once supervisor accepts:
- Group is officially registered for the project
- Students can access:
  - Documents tab (upload documents)
  - Chat tab (communicate with supervisor)
  - Comments section (discuss with supervisor)
- Panel is assigned by committee member for evaluations

---

## Phase 4: Document Submission & Review

### 4.1 Document Types & Submission Order

| # | Document Type | Description | Reviewer |
|---|--------------|-------------|----------|
| 1 | Scope Document | Project scope, objectives, methodology | Supervisor + Committee |
| 2 | SRS Document | Software Requirements Specification | Supervisor + Committee |
| 3 | SDD Document | Software Design Document | Supervisor + Committee |
| 4 | Final Report | Complete project documentation | Supervisor + Committee |
| 5 | Presentation | Final presentation slides | Committee |

### 4.2 Student: Uploading Documents
```
Flow: Student Dashboard → Documents Tab
```

**Steps:**
1. Select document type from dropdown
2. Click "Select File" (PDF, DOC, DOCX, PPT, PPTX allowed, max 25MB)
3. Preview selected file
4. Click "Upload Document"
5. Document appears in list with Status: **Pending**

### 4.3 Document Status Flow
```
Pending → Accepted by Student (partner confirms) → Accepted (supervisor approves)
                                                 → Rejected (supervisor rejects - needs revision)
```

**Status Meanings:**
- **Pending**: Just uploaded, awaiting review
- **Accepted by Student**: Group partner has confirmed the document
- **Accepted**: Supervisor has approved the document
- **Rejected**: Needs revision, student must re-upload

### 4.4 Supervisor: Reviewing Documents
```
Flow: Supervisor Dashboard → Documents Tab
```

**Steps:**
1. View all documents from assigned groups
2. Filter by group, document type, or status
3. Download and review document
4. Mark as **Accepted** or **Rejected**
5. Provide feedback in comments section

---

## Phase 5: Communication & Feedback

### 5.1 Chat System (Student ↔ Supervisor)
```
Flow: Student/Supervisor Dashboard → Chat Tab
```

**Features:**
- Real-time messaging (polling-based)
- Discuss project progress
- Clarify requirements
- Share quick feedback

### 5.2 Comments Section (Supervisor-Student Discussion)
```
Flow: Supervisor Tab → Comments Section
```

**Features:**
- Threaded discussions
- More formal than chat
- Documented feedback trail
- Both supervisor and students can comment

### 5.3 Notifications
```
Flow: Dashboard → Notification Bell Icon
```

**Notification Types:**
- Group request received/accepted/rejected
- Supervisor request status changes
- Document status updates
- New comments/messages
- Evaluation results available

---

## Phase 6: Evaluations

### 6.1 Evaluation Phases

The FYP is evaluated in **5 phases** aligned with document submissions:

| Phase | Evaluation | Evaluators | Based On |
|-------|-----------|------------|----------|
| 1 | Scope Document Evaluation | Committee Member | Scope Document |
| 2 | SRS Evaluation | Supervisor + Committee | SRS Document |
| 3 | SDD Evaluation | Supervisor + Committee | SDD Document |
| 4 | Evaluation 3 (Midterm) | Supervisor + Committee | Progress + Presentation |
| 5 | Evaluation 4 (Final) | Supervisor + Committee | Final Report + Demo |

### 6.2 Evaluation Criteria

Each evaluation uses a rubric with criteria rated as:
- **Pending** (0) - Not yet evaluated
- **Marginal** (1-2) - Below expectations
- **Adequate** (3-4) - Meets basic requirements
- **Good** (5-6) - Above average
- **Excellent** (7-8+) - Outstanding

### 6.3 Committee Member: Conducting Evaluations
```
Flow: Committee Dashboard → Evaluations Tab
```

**Steps:**
1. View assigned groups (based on panel)
2. Select evaluation type (Scope, SRS, SDD, etc.)
3. Review submitted documents
4. Fill evaluation form with scores for each criterion
5. Add comments/feedback
6. Submit evaluation

### 6.4 Supervisor: Conducting Evaluations
```
Flow: Supervisor Dashboard → Evaluations Tab
```

**Steps:**
1. View assigned groups
2. Select evaluation type
3. Review student progress and documents
4. Fill evaluation form
5. Submit scores

### 6.5 Student: Viewing Evaluations
```
Flow: Student Dashboard → Evaluations Tab
```

**What students see:**
- Evaluation scores per phase
- Feedback from evaluators
- Overall progress status
- Areas needing improvement

---

## Phase 7: Committee Member Special Functions

### 7.1 Uploading Evaluation Templates
```
Flow: Committee Dashboard → Templates Tab
```

**Steps:**
1. Select template type (Scope, SRS, SDD, Final Report)
2. Upload template file
3. Set semester/year
4. Templates are available for students to download

### 7.2 Panel Assignment
```
Flow: Admin Panel or Committee Dashboard
```

**Process:**
1. Committee panels are created by admin
2. Committee members are assigned to panels
3. Groups/Projects are assigned to panels
4. Panel members evaluate assigned groups

### 7.3 Generating Reports
```
Flow: Committee Dashboard → Reports
```

**Available Reports:**
- Evaluation summary per group
- Panel-wise evaluation statistics
- Document submission status
- Overall semester progress

---

## Phase 8: Admin Management Functions

### 8.1 User Management
```
Flow: Django Admin → Users
```

**Capabilities:**
- Create/Edit/Delete users
- Assign user types (student, supervisor, committee)
- Reset passwords
- View user activity

### 8.2 Monitoring Workload
```
Flow: Admin Panel → Supervisor Workload
```

**Metrics:**
- Number of groups per supervisor
- Document review pending
- Evaluation completion status

### 8.3 System Configuration
```
Flow: Django Admin → Settings
```

**Configurable Items:**
- Project categories
- Committee panels
- Semester settings
- Notification preferences

---

## Complete Workflow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FYP MANAGEMENT WORKFLOW                           │
└─────────────────────────────────────────────────────────────────────────────┘

ADMIN SETUP
    │
    ├── Create Project Categories
    ├── Create Committee Panels  
    ├── Register Students
    ├── Register Supervisors (assign categories)
    └── Register Committee Members (assign panels)
           │
           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SUPERVISOR: CREATE PROJECTS                         │
│  Supervisor logs in → Creates projects under their categories              │
└─────────────────────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      PHASE 1: GROUP FORMATION (Students)                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  Student 1                          Student 2                               │
│     │                                  │                                    │
│     ├── Login                          ├── Login                            │
│     ├── Complete Profile               ├── Complete Profile                 │
│     └── Send Group Request ──────────► │                                    │
│                                        ├── View Request                     │
│                                        └── Accept/Reject                    │
│                                               │                             │
│                              ┌────────────────┴────────────────┐            │
│                              ▼                                 ▼            │
│                         ACCEPTED                           REJECTED         │
│                     (Group Formed)                    (Find new partner)    │
└─────────────────────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                   PHASE 2: SUPERVISOR REQUEST (Students)                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  Students (as Group)                    Supervisor                          │
│     │                                      │                                │
│     ├── Browse Projects                    │                                │
│     ├── Select Project                     │                                │
│     └── Send Supervisor Request ─────────► │                                │
│                                            ├── View Request                 │
│                                            ├── Review Group Profile         │
│                                            └── Accept/Reject                │
│                                                   │                         │
│                              ┌───────────────────┴────────────────┐         │
│                              ▼                                    ▼         │
│                         ACCEPTED                              REJECTED      │
│                   (Officially Assigned)              (Find another project) │
└─────────────────────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PHASE 3: DOCUMENT SUBMISSION (Students)                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Students                    Supervisor                Committee           │
│      │                           │                         │                │
│      │   ┌─────────────────────────────────────────────────────────────┐    │
│      │   │                  DOCUMENT CYCLE                             │    │
│      │   │  (Repeat for: Scope → SRS → SDD → Final Report → Presentation)  │
│      │   └─────────────────────────────────────────────────────────────┘    │
│      │                           │                         │                │
│      ├── Upload Document         │                         │                │
│      │   (Status: Pending)       │                         │                │
│      │        │                  │                         │                │
│      │        ▼                  │                         │                │
│      ├── Partner Confirms ───────┤                         │                │
│      │   (Status: Accepted       │                         │                │
│      │    by Student)            │                         │                │
│      │        │                  │                         │                │
│      │        └──────────────► Review                      │                │
│      │                           │                         │                │
│      │              ┌────────────┴────────────┐            │                │
│      │              ▼                         ▼            │                │
│      │          ACCEPTED                  REJECTED         │                │
│      │              │                    (Revise &         │                │
│      │              │                     Resubmit)        │                │
│      │              ▼                                      │                │
│      │         Ready for ─────────────────────────────► Evaluation          │
│      │         Evaluation                                  │                │
└─────────────────────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        PHASE 4: EVALUATIONS                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │ EVALUATION 1: Scope Document                                       │     │
│  │   Committee Member → Evaluate Scope Document → Submit Scores       │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                              │                                              │
│                              ▼                                              │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │ EVALUATION 2: SRS Document                                         │     │
│  │   Supervisor → Evaluate SRS → Submit Scores                        │     │
│  │   Committee Member → Evaluate SRS → Submit Scores                  │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                              │                                              │
│                              ▼                                              │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │ EVALUATION 3: SDD Document                                         │     │
│  │   Supervisor → Evaluate SDD → Submit Scores                        │     │
│  │   Committee Member → Evaluate SDD → Submit Scores                  │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                              │                                              │
│                              ▼                                              │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │ EVALUATION 4: Midterm (Evaluation 3)                               │     │
│  │   Supervisor → Evaluate Progress → Submit Scores                   │     │
│  │   Committee Member → Evaluate Presentation → Submit Scores         │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                              │                                              │
│                              ▼                                              │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │ EVALUATION 5: Final (Evaluation 4)                                 │     │
│  │   Supervisor → Final Evaluation → Submit Scores                    │     │
│  │   Committee Member → Final Evaluation → Submit Scores              │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                              │                                              │
│                              ▼                                              │
│                    Students View Results                                    │
│                              │                                              │
└─────────────────────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PROJECT COMPLETION                                  │
│                                                                             │
│   • All documents submitted and approved                                    │
│   • All evaluations completed                                               │
│   • Final grades calculated                                                 │
│   • Project archived for records                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Quick Reference: User Actions by Role

### Student Actions
| Action | Location | Prerequisites |
|--------|----------|---------------|
| Complete Profile | Dashboard → Profile | Logged in |
| Create Group | Dashboard → Groups → Create | Profile complete |
| Accept Group Request | Dashboard → Groups → Received | Pending request exists |
| Browse Projects | Dashboard → Projects | In accepted group |
| Request Supervisor | Dashboard → Supervisor → Request | In accepted group |
| Upload Document | Dashboard → Documents | Supervisor accepted |
| Chat with Supervisor | Dashboard → Chat | Supervisor accepted |
| View Evaluations | Dashboard → Evaluations | Evaluations submitted |

### Supervisor Actions
| Action | Location | Prerequisites |
|--------|----------|---------------|
| Create Project | Dashboard → Projects → Create | Logged in |
| View Requests | Dashboard → Requests | Pending requests exist |
| Accept/Reject Request | Dashboard → Requests | Pending request |
| Review Documents | Dashboard → Documents | Documents submitted |
| Chat with Students | Dashboard → Chat | Groups assigned |
| Conduct Evaluations | Dashboard → Evaluations | Documents approved |

### Committee Member Actions
| Action | Location | Prerequisites |
|--------|----------|---------------|
| Upload Templates | Dashboard → Templates | Logged in |
| Review Documents | Dashboard → Documents | Documents submitted |
| Conduct Evaluations | Dashboard → Evaluations | Groups assigned to panel |
| Assign Panels | Dashboard → Panels | Admin permissions |
| Generate Reports | Dashboard → Reports | Evaluations exist |

### Admin (Superuser) Actions
| Action | Location | Prerequisites |
|--------|----------|---------------|
| Create Users | Admin Panel → Users | Superuser access |
| Create Categories | Admin Panel → Categories | Superuser access |
| Create Panels | Admin Panel → Panels | Superuser access |
| Monitor Workload | Admin Panel → Reports | Superuser access |
| System Settings | Admin Panel → Settings | Superuser access |

---

## Status Codes Reference

### Group Status
- `pending` - Request sent, awaiting response
- `accepted` - Group formed
- `rejected` - Request declined
- `canceled` - Request withdrawn

### Supervisor Request Status
- `pending` - Request sent, awaiting supervisor response
- `accepted_by_student` - Partner student confirmed
- `accepted` - Supervisor approved
- `rejected` - Supervisor declined
- `canceled` - Request withdrawn

### Document Status
- `pending` - Just uploaded
- `accepted_by_student` - Group partner confirmed
- `accepted` - Supervisor approved
- `rejected` - Needs revision

### Evaluation Status
- `pending` - Not yet evaluated
- `marginal` - Below expectations
- `adequate` - Meets requirements
- `good` - Above average
- `excellent` - Outstanding

---

## Timeline (Typical Semester)

| Week | Phase | Activities |
|------|-------|------------|
| 1-2 | Setup | Admin creates users, supervisors create projects |
| 3-4 | Groups | Students form groups |
| 5-6 | Supervisor | Groups request and get supervisors |
| 7-8 | Scope | Submit scope document, Evaluation 1 |
| 9-10 | SRS | Submit SRS document, Evaluation 2 |
| 11-12 | SDD | Submit SDD document, Evaluation 3 |
| 13-14 | Midterm | Midterm evaluation (Evaluation 3) |
| 15-16 | Final | Final report, presentation, Final evaluation |

---

## Notes

1. **Group Size**: Maximum 2 students per group
2. **Supervisor Load**: Each supervisor has a maximum number of groups they can supervise
3. **Panel Assignment**: Each group is assigned to one committee panel for evaluations
4. **Document Sequence**: Documents should ideally be submitted in order, but system allows flexibility
5. **Notifications**: All status changes trigger notifications to relevant users
