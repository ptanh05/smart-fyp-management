# FYP Management System

A comprehensive web-based platform for managing Final Year Projects at COMSATS University Islamabad, Vehari Campus.

## Table of Contents

- [Overview](#overview)
- [User Roles](#user-roles)
- [System Architecture](#system-architecture)
- [Complete Workflow](#complete-workflow)
- [Installation](#installation)
- [Credentials](#credentials)
- [API Documentation](#api-documentation)

---

## Overview

The FYP Management System digitizes the entire Final Year Project lifecycle, replacing traditional paper-based processes with an efficient, transparent, and NCEAC-compliant platform.

### Key Features

- **Group Formation** - Students form groups of 2
- **Project Selection** - Browse and request supervisor projects
- **Document Management** - Upload, review, and approve project documents
- **Evaluation System** - Multi-phase evaluation with rubrics
- **Real-time Communication** - Chat and comments between students and supervisors
- **External Examination** - 8th semester external evaluator assignment
- **Notifications** - Stay updated on all activities
- **Audit Trail** - Complete logging of all actions

### Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | React.js, TypeScript, CSS |
| Backend | Django, Django REST Framework |
| Database | SQLite (Dev) / PostgreSQL (Prod) |
| Authentication | JWT (JSON Web Tokens) |
| Real-time | Polling-based messaging |

---

## User Roles

The system has **5 user roles** with distinct responsibilities:

### 1. Admin (Superuser)
System administrator with full access to Django Admin panel.

**Responsibilities:**
- Create and manage all user accounts
- Configure project categories
- Set up committee panels and external groups
- Monitor system activities and workload
- Manage evaluation templates

### 2. Student
Undergraduate students working on their Final Year Project.

**Responsibilities:**
- Complete profile information
- Form groups with fellow students
- Select projects and request supervisors
- Upload project documents
- View evaluations and feedback
- Communicate with supervisor

### 3. Supervisor
Faculty members who guide student projects.

**Responsibilities:**
- Create projects under their expertise categories
- Accept/reject student group requests
- Review and approve documents
- Provide feedback and guidance
- Conduct supervisor evaluations (SRS, SDD, Midterm, Final)
- Chat with assigned students

### 4. Committee Member
Evaluation panel members who assess project progress.

**Responsibilities:**
- Upload evaluation templates
- Review project documents
- Conduct committee evaluations
- Assign panels to student groups
- Generate evaluation reports

### 5. External Examiner (8th Semester)
External faculty/industry experts for final project evaluation.

**Responsibilities:**
- Conduct final viva/examination
- Evaluate project implementation and presentation
- Provide external assessment scores
- Submit final evaluation report

---

## External Examiner System (8th Semester)

### How External Assignment Works

In the 8th semester, external examiners are brought in for unbiased final evaluation:

```
┌─────────────────────────────────────────────────────────────────┐
│                    EXTERNAL EXAMINER GROUPING                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   External Examiner 1              External Examiner 2          │
│   (Dr. Ahmed Khan)                 (Dr. Sara Ali)               │
│         │                                │                      │
│         ▼                                ▼                      │
│   ┌───────────┐                    ┌───────────┐                │
│   │ Group 1   │                    │ Group 8   │                │
│   │ Group 2   │                    │ Group 9   │                │
│   │ Group 3   │                    │ Group 10  │                │
│   │ Group 4   │   7 Groups         │ Group 11  │   7 Groups     │
│   │ Group 5   │   Per External     │ Group 12  │   Per External │
│   │ Group 6   │                    │ Group 13  │                │
│   │ Group 7   │                    │ Group 14  │                │
│   └───────────┘                    └───────────┘                │
│                                                                 │
│   External Examiner 3              External Examiner N          │
│   (Industry Expert)                (Prof. XYZ)                  │
│         │                                │                      │
│         ▼                                ▼                      │
│   ┌───────────┐                    ┌───────────┐                │
│   │ Group 15  │                    │ Group N   │                │
│   │ Group 16  │                    │ ...       │                │
│   │ ...       │                    │ ...       │                │
│   └───────────┘                    └───────────┘                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### External Evaluation Process

1. **Admin Setup**: Creates external examiner accounts
2. **Group Assignment**: Assigns 5-7 student groups per external
3. **Schedule**: Sets evaluation dates/slots
4. **Evaluation Day**:
   - Students present their project
   - External asks questions
   - External evaluates based on rubrics
5. **Final Scores**: External submits evaluation

### External Evaluation Criteria

| Criterion | Weight |
|-----------|--------|
| Project Implementation | 30% |
| Technical Knowledge | 25% |
| Presentation Skills | 20% |
| Documentation Quality | 15% |
| Q&A Response | 10% |

---

## Complete Workflow

### Semester Timeline

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           FYP TIMELINE (2 SEMESTERS)                         │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  SEMESTER 7 (Fall)                      SEMESTER 8 (Spring)                  │
│  ─────────────────                      ──────────────────                   │
│                                                                              │
│  Week 1-2: Admin Setup                  Week 1-2: Resume Work                │
│     • Create users                         • Continue development            │
│     • Setup categories                                                       │
│     • Create panels                     Week 3-6: Development                │
│                                            • Complete implementation         │
│  Week 3-4: Group Formation                 • Testing & debugging             │
│     • Students form groups                                                   │
│     • Profile completion                Week 7-8: Final Report               │
│                                            • Submit final documentation      │
│  Week 5-6: Supervisor Request              • Prepare presentation            │
│     • Browse projects                                                        │
│     • Request supervisors               Week 9-10: Internal Final Eval       │
│     • Get approved                         • Evaluation 4 (Supervisor)       │
│                                            • Evaluation 4 (Committee)        │
│  Week 7-8: Scope Document                                                    │
│     • Submit scope                      Week 11-12: External Setup           │
│     • Evaluation 1 (Committee)             • Admin assigns externals         │
│                                            • Groups assigned to externals    │
│  Week 9-10: SRS Document                                                     │
│     • Submit SRS                        Week 13-14: External Evaluation      │
│     • Evaluation 2 (Sup + Com)             • Final viva with external        │
│                                            • External submits scores         │
│  Week 11-12: SDD Document                                                    │
│     • Submit SDD                        Week 15-16: Results                  │
│     • Evaluation 3 (Sup + Com)             • Final grades compiled           │
│                                            • Project archived                │
│  Week 13-14: Midterm Evaluation                                              │
│     • Progress presentation                                                  │
│     • Evaluation 3 (Midterm)                                                 │
│                                                                              │
│  Week 15-16: Continue Development                                            │
│     • Implementation phase                                                   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

### Phase 1: System Setup (Admin)

```
Admin (Superuser) → Django Admin Panel (/admin/)
```

#### 1.1 Create Project Categories
```
Admin Panel → Project Categories → Add
```
Examples: Web Development, Mobile App, AI/ML, IoT, Data Science

#### 1.2 Create Committee Panels
```
Admin Panel → Committee Member Panels → Add
```
Examples: Panel A, Panel B, Panel C (for internal evaluations)

#### 1.3 Create External Groups (8th Semester)
```
Admin Panel → External Groups → Add
```
- Create external examiner groups
- Each group will have 5-7 student groups assigned

#### 1.4 Register Users
```
Admin Panel → Users → Add User
```

| User Type | Required Fields |
|-----------|-----------------|
| Student | username, email, password, registration_no |
| Supervisor | username, email, password, employee_id, categories |
| Committee Member | username, email, password, committee_id, panel |
| External Examiner | username, email, password, external_id, institution |

---

### Phase 2: Project Creation (Supervisor)

```
Supervisor Dashboard → Projects → Create Project
```

**Steps:**
1. Supervisor logs in
2. Navigate to Projects section
3. Click "Create Project"
4. Fill project details:
   - Project Name
   - Description
   - Category
   - Max Groups (usually 1)
5. Submit

**Result:** Project appears in student project list

---

### Phase 3: Group Formation (Students)

```
┌─────────────────────────────────────────────────────────────────┐
│                      GROUP FORMATION FLOW                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Student 1 (Initiator)              Student 2 (Receiver)       │
│         │                                   │                   │
│         ├── Login                           ├── Login           │
│         │                                   │                   │
│         ├── Complete Profile                ├── Complete Profile│
│         │                                   │                   │
│         ├── Go to Groups Tab                │                   │
│         │                                   │                   │
│         ├── Click "Create Group"            │                   │
│         │                                   │                   │
│         ├── Search Student 2                │                   │
│         │   (by reg no or name)             │                   │
│         │                                   │                   │
│         └── Send Request ──────────────────►│                   │
│             (Status: PENDING)               │                   │
│                                             ├── View Request    │
│                                             │                   │
│                                             ├── View Profile    │
│                                             │                   │
│                               ┌─────────────┴─────────────┐     │
│                               │                           │     │
│                               ▼                           ▼     │
│                           ACCEPT                       REJECT   │
│                               │                           │     │
│                               ▼                           ▼     │
│                        GROUP FORMED              Request Declined│
│                     (Status: ACCEPTED)        (Find new partner)│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Group Comments (Optional)
Students can discuss before finalizing:
```
Groups Tab → Comments Section → Add Comment
```

---

### Phase 4: Supervisor Request (Students)

```
┌─────────────────────────────────────────────────────────────────┐
│                    SUPERVISOR REQUEST FLOW                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Students (Group)                        Supervisor            │
│         │                                      │                │
│         ├── Go to Projects Tab                 │                │
│         │                                      │                │
│         ├── Browse Available Projects          │                │
│         │   • Filter by category               │                │
│         │   • View project details             │                │
│         │   • Check supervisor workload        │                │
│         │                                      │                │
│         ├── Select Project                     │                │
│         │                                      │                │
│         ├── Go to Supervisor Tab               │                │
│         │                                      │                │
│         └── Click "Request Supervisor" ───────►│                │
│             (Status: PENDING)                  │                │
│                                                ├── View Request │
│                                                │                │
│                                                ├── Review Group │
│                                                │   Profile      │
│                                                │                │
│                               ┌────────────────┴────────────┐   │
│                               │                             │   │
│                               ▼                             ▼   │
│                           ACCEPT                         REJECT │
│                               │                             │   │
│                               ▼                             ▼   │
│                      OFFICIALLY ASSIGNED          Find Another  │
│                     (Status: ACCEPTED)              Project     │
│                               │                                 │
│                               ▼                                 │
│                    ┌──────────────────────┐                     │
│                    │ UNLOCKED FEATURES:   │                     │
│                    │ • Documents Tab      │                     │
│                    │ • Chat Tab           │                     │
│                    │ • Supervisor Comments│                     │
│                    └──────────────────────┘                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### Phase 5: Document Submission Cycle

#### Document Types & Order

| # | Document | Description | Deadline (Typical) |
|---|----------|-------------|-------------------|
| 1 | Scope Document | Project scope, objectives, methodology | Week 7-8 |
| 2 | SRS Document | Software Requirements Specification | Week 9-10 |
| 3 | SDD Document | Software Design Document | Week 11-12 |
| 4 | Final Report | Complete project documentation | Week 7-8 (Sem 8) |
| 5 | Presentation | Final presentation slides | Week 9-10 (Sem 8) |

#### Document Upload Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     DOCUMENT SUBMISSION FLOW                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Student 1                Student 2              Supervisor    │
│      │                        │                       │         │
│      ├── Go to Documents Tab  │                       │         │
│      │                        │                       │         │
│      ├── Select Document Type │                       │         │
│      │   (Scope/SRS/SDD/etc)  │                       │         │
│      │                        │                       │         │
│      ├── Select File          │                       │         │
│      │   (PDF/DOC/DOCX/PPT)   │                       │         │
│      │   Max: 25MB            │                       │         │
│      │                        │                       │         │
│      ├── Click "Upload"       │                       │         │
│      │                        │                       │         │
│      └── Status: PENDING ─────►                       │         │
│                               │                       │         │
│                               ├── View Document       │         │
│                               │                       │         │
│                               ├── Confirm/Review      │         │
│                               │                       │         │
│                               └── Accept ─────────────►         │
│                                  (Status: ACCEPTED    │         │
│                                   BY STUDENT)         │         │
│                                                       │         │
│                                          ┌────────────┴───────┐ │
│                                          │                    │ │
│                                          ▼                    ▼ │
│                                      APPROVE              REJECT│
│                                          │                    │ │
│                                          ▼                    ▼ │
│                                   Status: ACCEPTED    Status:   │
│                                          │            REJECTED  │
│                                          │            (Revise & │
│                                          ▼            Resubmit) │
│                                   READY FOR                     │
│                                   EVALUATION                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Document Status Reference

| Status | Meaning | Next Action |
|--------|---------|-------------|
| `pending` | Just uploaded | Partner reviews |
| `accepted_by_student` | Partner confirmed | Supervisor reviews |
| `accepted` | Supervisor approved | Ready for evaluation |
| `rejected` | Needs revision | Student re-uploads |

---

### Phase 6: Evaluations

#### Evaluation Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                            EVALUATION PHASES                                 │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  SEMESTER 7                                                                  │
│  ──────────                                                                  │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │ EVALUATION 1: Scope Document                                        │     │
│  │ ─────────────────────────────                                       │     │
│  │ Evaluator: Committee Member                                         │     │
│  │ Based on: Scope Document                                            │     │
│  │ Criteria: Problem definition, objectives, methodology, feasibility │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                              │                                               │
│                              ▼                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │ EVALUATION 2: SRS Document                                          │     │
│  │ ────────────────────────────                                        │     │
│  │ Evaluators: Supervisor + Committee Member                           │     │
│  │ Based on: SRS Document                                              │     │
│  │ Criteria: Requirements clarity, use cases, diagrams, completeness  │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                              │                                               │
│                              ▼                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │ EVALUATION 3: SDD Document                                          │     │
│  │ ────────────────────────────                                        │     │
│  │ Evaluators: Supervisor + Committee Member                           │     │
│  │ Based on: SDD Document                                              │     │
│  │ Criteria: Architecture, design patterns, database design, UML      │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                              │                                               │
│                              ▼                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │ EVALUATION 4: Midterm (Progress Evaluation)                         │     │
│  │ ───────────────────────────────────────────                         │     │
│  │ Evaluators: Supervisor + Committee Member                           │     │
│  │ Based on: Progress Presentation                                     │     │
│  │ Criteria: Implementation progress, demo, technical understanding   │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
│  SEMESTER 8                                                                  │
│  ──────────                                                                  │
│                              │                                               │
│                              ▼                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │ EVALUATION 5: Internal Final                                        │     │
│  │ ────────────────────────────                                        │     │
│  │ Evaluators: Supervisor + Committee Member                           │     │
│  │ Based on: Final Report + Working Demo                               │     │
│  │ Criteria: Completion, quality, documentation, presentation         │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                              │                                               │
│                              ▼                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │ EVALUATION 6: External Final (8th Semester)                         │     │
│  │ ───────────────────────────────────────────                         │     │
│  │ Evaluator: External Examiner                                        │     │
│  │ Based on: Complete Project + Viva                                   │     │
│  │ Criteria: Implementation, knowledge, presentation, Q&A             │     │
│  │                                                                     │     │
│  │ ┌─────────────────────────────────────────────────────────────┐     │     │
│  │ │  External evaluates 5-7 groups assigned to them             │     │     │
│  │ │  Final viva conducted on scheduled date                     │     │     │
│  │ │  External provides unbiased external assessment             │     │     │
│  │ └─────────────────────────────────────────────────────────────┘     │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                              │                                               │
│                              ▼                                               │
│                     FINAL GRADE COMPILATION                                  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Evaluation Criteria Rating Scale

| Rating | Score Range | Description |
|--------|-------------|-------------|
| Pending | 0 | Not yet evaluated |
| Marginal | 1-2 | Below expectations |
| Adequate | 3-4 | Meets basic requirements |
| Good | 5-6 | Above average work |
| Excellent | 7-8+ | Outstanding performance |

#### Committee Member: Conducting Evaluation

```
Committee Dashboard → Evaluations Tab → Select Group → Fill Form → Submit
```

#### Supervisor: Conducting Evaluation

```
Supervisor Dashboard → Evaluations Tab → Select Group → Fill Form → Submit
```

#### External Examiner: Final Evaluation

```
External Dashboard → Assigned Groups → Conduct Viva → Fill Form → Submit
```

---

### Phase 7: Communication

#### Chat System (Real-time Messaging)

```
┌─────────────────────────────────────────────────────────────────┐
│                         CHAT SYSTEM                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Student                              Supervisor               │
│      │                                      │                   │
│      ├── Go to Chat Tab                     │                   │
│      │                                      │                   │
│      ├── Type Message                       │                   │
│      │                                      │                   │
│      └── Send ─────────────────────────────►│                   │
│                                             │                   │
│                                             ├── Notification    │
│                                             │                   │
│                                             ├── View Message    │
│                                             │                   │
│      ◄─────────────────────────────── Reply─┤                   │
│      │                                      │                   │
│      ├── View Reply                         │                   │
│                                                                 │
│   Features:                                                     │
│   • Polling-based updates (every 5 seconds)                     │
│   • Message history preserved                                   │
│   • Timestamps shown                                            │
│   • Read receipts                                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Comments Section (Formal Feedback)

```
Supervisor Tab → Comments Section → Add Comment
```

- More formal than chat
- Documented feedback trail
- Both students and supervisor can comment
- Used for official guidance and feedback

#### Notifications

```
Dashboard → Bell Icon (Top Right)
```

**Notification Types:**
- Group request received/status change
- Supervisor request status change
- Document status update
- New chat message
- New comment
- Evaluation results available
- Deadline reminders

---

### Phase 8: Admin Functions

#### User Management

```
Django Admin → Users → Add/Edit/Delete
```

| Action | Steps |
|--------|-------|
| Add User | Admin → Users → Add → Fill form → Save |
| Edit User | Admin → Users → Select → Edit → Save |
| Reset Password | Admin → Users → Select → Change Password |
| Delete User | Admin → Users → Select → Delete |

#### Monitor Workload

```
Django Admin → Reports → Supervisor Workload
```

**Metrics:**
- Groups per supervisor
- Pending document reviews
- Evaluation completion status

#### External Assignment (8th Semester)

```
Django Admin → External Groups → Assign
```

**Steps:**
1. Create external examiner accounts
2. Create external evaluation groups
3. Assign 5-7 student groups per external
4. Set evaluation schedule
5. External receives notification

---

## Complete System Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        FYP MANAGEMENT SYSTEM FLOW                            │
└──────────────────────────────────────────────────────────────────────────────┘

                                    ADMIN
                                      │
            ┌─────────────────────────┼─────────────────────────┐
            │                         │                         │
            ▼                         ▼                         ▼
     Create Users            Create Categories           Create Panels
            │                         │                         │
            └─────────────────────────┼─────────────────────────┘
                                      │
                                      ▼
                              SUPERVISOR LOGIN
                                      │
                                      ▼
                              Create Projects
                                      │
                                      ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                              STUDENT JOURNEY                                 │
└──────────────────────────────────────────────────────────────────────────────┘
                                      │
    ┌─────────────────────────────────┼─────────────────────────────────┐
    │                                 │                                 │
    ▼                                 ▼                                 ▼
Student 1 Login              Student 2 Login                   Other Students
    │                                 │
    ▼                                 │
Complete Profile                      │
    │                                 │
    ▼                                 │
Create Group Request ────────────────►│
    │                                 │
    │                                 ▼
    │                          Accept Request
    │                                 │
    └────────────────┬────────────────┘
                     │
                     ▼
              GROUP FORMED
                     │
                     ▼
            Browse Projects
                     │
                     ▼
         Request Supervisor ──────────────────────► SUPERVISOR
                     │                                   │
                     │                                   ▼
                     │                            Accept/Reject
                     │                                   │
                     ◄───────────────────────────────────┘
                     │
                     ▼
           SUPERVISOR ASSIGNED
                     │
    ┌────────────────┼────────────────┐
    │                │                │
    ▼                ▼                ▼
Documents         Chat           Comments
    │                │                │
    └────────────────┼────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                           DOCUMENT CYCLE                                     │
│  ┌────────┐   ┌────────┐   ┌────────┐   ┌────────┐   ┌────────────────┐     │
│  │ Scope  │──►│  SRS   │──►│  SDD   │──►│ Final  │──►│ Presentation   │     │
│  │Document│   │Document│   │Document│   │ Report │   │                │     │
│  └────────┘   └────────┘   └────────┘   └────────┘   └────────────────┘     │
│       │            │            │            │               │              │
│       ▼            ▼            ▼            ▼               ▼              │
│   Upload ──► Partner Confirm ──► Supervisor Review ──► Approved            │
└──────────────────────────────────────────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                           EVALUATION CYCLE                                   │
│                                                                              │
│  SEMESTER 7:                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ Eval 1      │  │ Eval 2      │  │ Eval 3      │  │ Eval 4      │         │
│  │ (Scope)     │─►│ (SRS)       │─►│ (SDD)       │─►│ (Midterm)   │         │
│  │ Committee   │  │ Sup + Com   │  │ Sup + Com   │  │ Sup + Com   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                              │               │
│  SEMESTER 8:                                                 │               │
│                                                              ▼               │
│  ┌─────────────┐  ┌─────────────────────────────────────────────────┐       │
│  │ Eval 5      │  │ Eval 6: EXTERNAL FINAL                          │       │
│  │ (Internal   │─►│                                                 │       │
│  │  Final)     │  │  ┌─────────┐  ┌─────────┐  ┌─────────┐         │       │
│  │ Sup + Com   │  │  │External │  │External │  │External │         │       │
│  └─────────────┘  │  │   1     │  │   2     │  │   N     │         │       │
│                   │  │ (7 grps)│  │ (7 grps)│  │ (7 grps)│         │       │
│                   │  └─────────┘  └─────────┘  └─────────┘         │       │
│                   └─────────────────────────────────────────────────┘       │
│                                          │                                   │
└──────────────────────────────────────────┼───────────────────────────────────┘
                                           │
                                           ▼
                                   FINAL GRADES
                                           │
                                           ▼
                                  PROJECT ARCHIVED
```

---

## Quick Reference Tables

### Actions by Role

#### Student Actions

| Action | Location | Prerequisites |
|--------|----------|---------------|
| Complete Profile | Dashboard → Profile | Logged in |
| Create Group | Dashboard → Groups → Create | Profile complete |
| Accept Group | Dashboard → Groups → Received | Pending request |
| Browse Projects | Dashboard → Projects | In accepted group |
| Request Supervisor | Dashboard → Supervisor → Request | In accepted group |
| Upload Document | Dashboard → Documents | Supervisor accepted |
| Chat with Supervisor | Dashboard → Chat | Supervisor accepted |
| View Evaluations | Dashboard → Evaluations | Evaluations exist |

#### Supervisor Actions

| Action | Location | Prerequisites |
|--------|----------|---------------|
| Create Project | Dashboard → Projects → Create | Logged in |
| View Requests | Dashboard → Requests | Requests exist |
| Accept/Reject | Dashboard → Requests → Action | Pending request |
| Review Documents | Dashboard → Documents | Documents exist |
| Chat with Students | Dashboard → Chat | Groups assigned |
| Conduct Evaluation | Dashboard → Evaluations | Document approved |

#### Committee Member Actions

| Action | Location | Prerequisites |
|--------|----------|---------------|
| Upload Templates | Dashboard → Templates | Logged in |
| Review Documents | Dashboard → Documents | Documents exist |
| Conduct Evaluation | Dashboard → Evaluations | Groups in panel |
| Assign Panels | Dashboard → Panels | Admin rights |
| Generate Reports | Dashboard → Reports | Evaluations exist |

#### External Examiner Actions

| Action | Location | Prerequisites |
|--------|----------|---------------|
| View Assigned Groups | Dashboard → Groups | Groups assigned |
| Review Projects | Dashboard → Projects | Groups assigned |
| Conduct Viva | Dashboard → Evaluations | Scheduled |
| Submit Evaluation | Dashboard → Evaluations → Submit | Viva completed |

#### Admin Actions

| Action | Location | Prerequisites |
|--------|----------|---------------|
| Create Users | Admin → Users → Add | Superuser |
| Create Categories | Admin → Categories → Add | Superuser |
| Create Panels | Admin → Panels → Add | Superuser |
| Create External Groups | Admin → External Groups → Add | Superuser |
| Assign Externals | Admin → External Groups → Assign | External created |
| Monitor Workload | Admin → Reports | Superuser |

---

## Status Codes

### Group Status
| Code | Meaning |
|------|---------|
| `pending` | Request sent, awaiting response |
| `accepted` | Group formed successfully |
| `rejected` | Request declined |
| `canceled` | Request withdrawn |

### Supervisor Request Status
| Code | Meaning |
|------|---------|
| `pending` | Awaiting supervisor response |
| `accepted_by_student` | Partner confirmed |
| `accepted` | Supervisor approved |
| `rejected` | Supervisor declined |
| `canceled` | Request withdrawn |

### Document Status
| Code | Meaning |
|------|---------|
| `pending` | Just uploaded |
| `accepted_by_student` | Partner confirmed |
| `accepted` | Supervisor approved |
| `rejected` | Needs revision |

### Evaluation Status
| Code | Score | Meaning |
|------|-------|---------|
| `pending` | 0 | Not evaluated |
| `marginal` | 1-2 | Below expectations |
| `adequate` | 3-4 | Meets requirements |
| `good` | 5-6 | Above average |
| `excellent` | 7-8+ | Outstanding |

---

## Installation

### Prerequisites

- Python 3.11+
- Node.js 18+
- npm or yarn

### Backend Setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate  # Windows
source .venv/bin/activate  # Linux/Mac
pip install -r requirements.txt
python manage.py migrate
# If document requirements fail with "no such table", run: python manage.py migrate app
python manage.py createsuperuser
python manage.py seed_database  # Optional: Add test data
daphne backend.asgi:application
```

> **⚠️ QUAN TRỌNG KHI LÀM VIỆC NHÓM (Team Workflow):**
> Mỗi khi bạn `git pull` code mới từ nhánh chung về máy, nếu có ai đó thêm các trường dữ liệu mới vào model (ví dụ: thêm cột `phone_number`), bạn **BẮT BUỘC** phải chạy lại lệnh `python manage.py migrate` ở backend để cập nhật database local. Nếu không sẽ gặp lỗi 500 (`no such column`).

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### Access URLs

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000/api/ |
| Admin Panel | http://localhost:8000/admin/ |

---

## Test Credentials

After running `python manage.py seed_database`:

| Role | Username | Password |
|------|----------|----------|
| Admin | admin | admin123 |
| Student 1 | student1 | student123 |
| Student 2 | student2 | student123 |
| Supervisor | supervisor1 | supervisor123 |
| Committee | committee1 | committee123 |

---

## API Documentation

### Authentication
- `POST /api/token/` - Get JWT tokens
- `POST /api/token/refresh/` - Refresh access token

### Students
- `GET /api/student/profile/` - Get student profile
- `PUT /api/student/profile/` - Update profile

### Groups
- `GET /api/group/create/` - List groups
- `POST /api/group/create/` - Create group request
- `PATCH /api/group/create/?pk=<id>` - Update group status

### Projects
- `GET /api/projects/` - List all projects
- `POST /api/projects/` - Create project (supervisor)

### Documents
- `GET /api/proposal-document/<type>/` - List documents
- `POST /api/proposal-document/<type>/` - Upload document

### Evaluations
- `GET /api/evaluations/<type>/<group_id>/` - Get evaluation
- `PUT /api/evaluations/<type>/<group_id>/` - Submit evaluation

---

## Support

For issues or questions:
- Create an issue on the repository

---

## License

This project is developed as part of the Final Year Project.

**Version:** 1.0  

