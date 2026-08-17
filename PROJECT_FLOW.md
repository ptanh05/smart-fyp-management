# Project Management System - Complete Flow Documentation

## Overview
This is a Django REST Framework backend with React TypeScript frontend for managing student projects, supervisor assignments, and evaluations.

---

## User Types & Roles

1. **Student** - Can form groups, create projects, request supervisors, upload documents
2. **Supervisor** - Can accept/reject student requests, evaluate projects, communicate with students
3. **Committee Member** - Can evaluate projects, upload templates, manage panels

---

## Complete Project Flow

### Phase 1: Student Group Formation

#### Step 1.1: Student Login
- **Endpoint**: `POST /app/student/login/`
- **Input**: Registration number + Password
- **Output**: JWT Access Token + Refresh Token
- **Frontend**: Login page with user type selector

#### Step 1.2: View Available Students
- **Endpoint**: `GET /app/listofstudents/?for_request=true`
- **Purpose**: Get list of students in same batch/department/semester who can be groupmates
- **Frontend**: Student Dashboard → "Find Group" tab

#### Step 1.3: View Project Categories
- **Endpoint**: `GET /app/project/categories/`
- **Purpose**: Get available project categories
- **Frontend**: Used in group request modal

#### Step 1.4: Send Group Request
- **Endpoint**: `POST /app/groupmate/request/`
- **Input**: 
  - `student_2`: ID of student to invite
  - `project_category`: ID of project category
- **Backend Logic**:
  - Automatically sets `student_1` to current logged-in student
  - Creates Group with status "pending"
  - Validates that student_1 ≠ student_2
- **Frontend**: Modal form to select student and category

#### Step 1.5: View Group Requests
- **Endpoint**: `GET /app/groupmate/request/?requested=to` (sent by me)
- **Endpoint**: `GET /app/groupmate/request/?requested=from` (received by me)
- **Frontend**: Lists pending, accepted, rejected requests

#### Step 1.6: Accept/Reject Group Request
- **Endpoint**: `PATCH /app/groupmate/request/?pk={id}`
- **Input**: `{"status": "accepted"}` or `{"status": "rejected"}`
- **Backend Logic**:
  - Only student_2 can accept/reject
  - If accepted, cancels all other pending requests for both students
  - Sets group status to "accepted"
- **Frontend**: Action buttons on group requests list

#### Step 1.7: Add Comments on Group Request
- **Endpoint**: `POST /app/groupmate/{group_id}/comments/`
- **Input**: `{"comment": "text"}`
- **Purpose**: Students can discuss before accepting group
- **Frontend**: Comments section on group request detail

---

### Phase 2: Project Creation

#### Step 2.1: Create Project
- **Endpoint**: `POST /app/projects/list/`
- **Input**:
  - `project_name`: Name of the project
  - `project_description`: Detailed description
  - `project_category`: Category ID
  - `language`: Programming language
  - `functionalities`: List of functionalities
- **Backend Logic**:
  - Links project to current user
  - Deletes any previous project by same user (one project per user)
- **Frontend**: "Create Project" modal in Student Dashboard

#### Step 2.2: View Projects
- **Endpoint**: `GET /app/projects/list/`
- **Optional Query**: `?category_id={id}` to filter by category
- **Frontend**: Projects list in Student Dashboard

---

### Phase 3: Supervisor Assignment

#### Step 3.1: View Available Supervisors
- **Endpoint**: `GET /app/supervisor/list/`
- **Optional Query**: `?category={category_id}` to filter by project category
- **Frontend**: Supervisor request modal

#### Step 3.2: Send Supervisor Request
- **Endpoint**: `POST /app/supervisor/student/request/`
- **Input**:
  - `supervisor`: Supervisor ID
  - `project`: Project ID (or project object to create new)
- **Backend Logic**:
  - Requires active group (status="accepted")
  - Creates SupervisorOfStudentGroup with status="pending"
  - Automatically creates evaluation forms:
    - Scope Document Evaluation
    - SRS Evaluation (Supervisor & Committee Member)
    - SDD Evaluation (Supervisor & Committee Member)
    - Evaluation 3 (Supervisor & Committee Member)
    - Evaluation 4 (Supervisor & Committee Member)
- **Frontend**: Supervisor request modal

#### Step 3.3: Supervisor Views Requests
- **Endpoint**: `GET /app/supervisor/student/request/`
- **Backend Logic**: Returns requests where supervisor is assigned
- **Frontend**: Supervisor Dashboard → "Student Requests" tab

#### Step 3.4: Supervisor Accepts/Rejects Request
- **Endpoint**: `POST /app/supervisor/student/response/`
- **Input**:
  - `supervisor_student_id`: SupervisorOfStudentGroup ID
  - `status`: "accepted" or "rejected"
- **Backend Logic**: Updates SupervisorOfStudentGroup status
- **Frontend**: Action buttons in Supervisor Dashboard

#### Step 3.5: Student Accepts Supervisor (Optional)
- **Endpoint**: `PATCH /app/supervisor/student/request/?pk={id}`
- **Input**: `{"status": "accepted_by_student"}`
- **Purpose**: Student confirms they want this supervisor
- **Frontend**: Student Dashboard → Supervisor tab

---

### Phase 4: Document Management

#### Step 4.1: Upload Document
- **Endpoint**: `POST /app/proposal-document/{document_type}/`
- **Document Types**:
  - `scope_document`
  - `srs_document`
  - `sdd_document`
  - `final_report_document`
  - `presentation_document`
- **Input**: FormData with `title` and `uploaded_file`
- **Backend Logic**:
  - Links to active SupervisorOfStudentGroup
  - Sets status to "pending"
- **Frontend**: Documents tab → Upload button

#### Step 4.2: View Documents
- **Endpoint**: `GET /app/proposal-document/{document_type}/?group={group_id}`
- **Frontend**: Documents list with status badges

#### Step 4.3: Update Document Status
- **Endpoint**: `PATCH /app/proposal-document/{document_type}/?pk={document_id}`
- **Input**: `{"status": "accepted" | "rejected" | "accepted_by_student"}`
- **Who Can Update**:
  - Students: Can set to "accepted_by_student"
  - Supervisors: Can accept/reject
  - Committee Members: Can accept/reject
- **Frontend**: Status update buttons

---

### Phase 5: Evaluations

#### Step 5.1: Scope Document Evaluation (Committee Member)
- **Endpoint**: `GET /app/scope_document_evaluation_criteria/{group_id}/`
- **Endpoint**: `PATCH /app/scope_document_evaluation_criteria/{group_id}/`
- **Criteria**:
  - Problem statement
  - Validity of proposed solution
  - Motivation behind tools/technologies
  - Modules
  - Task management
  - Related system analysis
  - Document format
  - Plagiarism report
- **Status Options**: pending, marginal, adequate, good, excellent
- **Frontend**: Evaluation form in Committee Member Dashboard

#### Step 5.2: SRS Evaluation (Supervisor)
- **Endpoint**: `GET /app/srs-evaluation-supervisor/{group_id}/`
- **Endpoint**: `PATCH /app/srs-evaluation-supervisor/{group_id}/`
- **Criteria**:
  - Regularity (5 marks)
  - SRS FRS mapped (4 marks)
  - SRS NFR mapped (1 mark)
  - SRS storyboarding (3 marks)
  - According to requirement (2 marks)
  - Template followed (2 marks)
  - Write-up correct (3 marks)
  - Student participation (5 marks)
- **Total**: Calculated automatically
- **Frontend**: Evaluation form in Supervisor Dashboard

#### Step 5.3: SRS Evaluation (Committee Member)
- **Endpoint**: `GET /app/srs-evaluation-committee-member/{group_id}/`
- **Endpoint**: `PATCH /app/srs-evaluation-committee-member/{group_id}/`
- **Criteria**: More detailed evaluation with 12 criteria
- **Frontend**: Evaluation form in Committee Member Dashboard

#### Step 5.4: SDD Evaluation (Supervisor & Committee Member)
- Similar structure to SRS evaluations
- **Endpoints**: 
  - `/app/sdd-evaluation-supervisor/{group_id}/`
  - `/app/sdd-evaluation-committee-member/{group_id}/`

#### Step 5.5: Evaluation 3 & 4
- **Endpoints**:
  - `/app/evaluation3-supervisor/{group_id}/`
  - `/app/evaluation3-committee-member/{group_id}/`
  - `/app/evaluation4-supervisor/{group_id}/`
  - `/app/evaluation4-committee-member/{group_id}/`
- **Purpose**: Progressive evaluations throughout project lifecycle

---

### Phase 6: Communication

#### Step 6.1: Chat Room
- **Endpoint**: `GET /app/chatroom/?group={group_id}`
- **Endpoint**: `POST /app/chatroom/`
- **Input**: `{"group": group_id, "message": "text"}`
- **Purpose**: Real-time communication between students and supervisor
- **Frontend**: Chat interface with message polling

#### Step 6.2: Comments
- **Endpoint**: `GET /app/supervisor/student/comments/?group={group_id}`
- **Endpoint**: `POST /app/supervisor/student/comments/`
- **Purpose**: Structured comments between supervisor and students
- **Frontend**: Comments section

---

### Phase 7: Templates & Reports

#### Step 7.1: Upload Templates (Committee Member)
- **Endpoint**: `POST /app/srs_template/{template_type}/`
- **Template Types**:
  - `scope_document_template`
  - `srs_template`
  - `sdd_template`
  - `final_report_template`
- **Input**: FormData with `title`, `uploaded_file`, `semester`
- **Frontend**: Committee Member Dashboard → Templates tab

#### Step 7.2: View Templates
- **Endpoint**: `GET /app/srs_template/{template_type}/?semester={semester}`
- **Frontend**: Template download list

#### Step 7.3: Export Report (Supervisor)
- **Endpoint**: `GET /app/export/report/`
- **Output**: Excel file with all assigned groups and their documents
- **Frontend**: Export button in Supervisor Dashboard

---

## Frontend Navigation Flow

### Student Flow
```
Login → Dashboard
  ├─ Overview (Profile Info)
  ├─ Find Group (if no group)
  │   ├─ Send Group Request
  │   ├─ View Sent Requests
  │   └─ View Received Requests
  ├─ Project (if has group)
  │   ├─ Create Project
  │   └─ View Projects
  ├─ Supervisor (if has group)
  │   ├─ Request Supervisor
  │   └─ View Supervisor Requests
  ├─ Documents (if has supervisor)
  │   ├─ Upload Documents
  │   └─ View Document Status
  └─ Chat (if has supervisor)
      └─ Real-time messaging
```

### Supervisor Flow
```
Login → Dashboard
  ├─ Overview (Profile Info)
  ├─ Student Requests
  │   ├─ Accept/Reject Requests
  │   └─ View Request Details
  ├─ My Groups
  │   ├─ View Assigned Groups
  │   └─ Select Group for Details
  └─ Evaluations
      ├─ SRS Evaluation
      ├─ SDD Evaluation
      ├─ Evaluation 3
      └─ Evaluation 4
```

### Committee Member Flow
```
Login → Dashboard
  ├─ Overview (Profile Info)
  ├─ Evaluations
  │   ├─ Scope Document Evaluation
  │   ├─ SRS Evaluation
  │   ├─ SDD Evaluation
  │   ├─ Evaluation 3
  │   └─ Evaluation 4
  └─ Templates
      ├─ Upload Templates
      └─ View Templates
```

---

## Data Model Relationships

```
CustomUser (Base User)
  ├─ Student (OneToOne)
  │   └─ Group (student_1 or student_2)
  │       └─ SupervisorOfStudentGroup
  │           ├─ Supervisor
  │           ├─ Project
  │           ├─ Documents
  │           ├─ Evaluation Forms
  │           └─ Chat Messages
  ├─ Supervisor (OneToOne)
  │   └─ SupervisorOfStudentGroup (Many)
  └─ CommitteeMember (OneToOne)
      └─ CommitteeMemberPanel
          └─ Projects
```

---

## Key Business Rules

1. **Group Formation**:
   - Student can only be in one active group
   - Group requires 2 students
   - Both students must accept

2. **Project Creation**:
   - One project per user (new project replaces old)
   - Project must have category

3. **Supervisor Assignment**:
   - Requires active group
   - Supervisor can accept/reject
   - Student can confirm acceptance

4. **Document Upload**:
   - Requires active supervisor group
   - Multiple document types
   - Status workflow: pending → accepted_by_student → accepted/rejected

5. **Evaluations**:
   - Created automatically when supervisor is assigned
   - Separate evaluations for supervisor and committee member
   - Marks calculated automatically based on criteria

---

## API Authentication

- **Method**: JWT (JSON Web Tokens)
- **Header**: `Authorization: Bearer {access_token}`
- **Token Lifetime**: 1 day (access), 7 days (refresh)
- **Refresh Endpoint**: `/app/token/refresh/` (if implemented)

---

## Testing Checklist

### Student Flow
- [ ] Login with registration number
- [ ] View available students for group
- [ ] Send group request
- [ ] Accept/reject received group requests
- [ ] Create project
- [ ] Request supervisor
- [ ] Upload documents
- [ ] View document status
- [ ] Send chat messages

### Supervisor Flow
- [ ] Login with email
- [ ] View student requests
- [ ] Accept/reject requests
- [ ] View assigned groups
- [ ] Fill evaluation forms
- [ ] Export reports

### Committee Member Flow
- [ ] Login with email
- [ ] View evaluation forms
- [ ] Fill evaluations
- [ ] Upload templates
- [ ] View templates

---

## Common Issues & Solutions

1. **CORS Errors**: Ensure backend CORS settings allow frontend origin
2. **Token Expiry**: Implement token refresh logic
3. **Group Status**: Check group status before allowing actions
4. **Document Types**: Use exact document type strings
5. **Evaluation IDs**: Use SupervisorOfStudentGroup ID, not Group ID

---

## Next Steps for Development

1. Add token refresh endpoint
2. Implement real-time chat (WebSockets)
3. Add file download endpoints
4. Add pagination to all list views
5. Add search/filter functionality
6. Add email notifications
7. Add project timeline/milestones
8. Add evaluation history tracking
