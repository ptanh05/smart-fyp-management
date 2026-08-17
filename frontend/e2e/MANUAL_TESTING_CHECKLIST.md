# Manual Testing Checklist - External Evaluation System

## Overview
This document provides a comprehensive checklist for manually testing the External Evaluation functionality.

---

## Pre-requisites
- [ ] Backend server running at `http://localhost:8000`
- [ ] Frontend dev server running at `http://localhost:5173`
- [ ] Test database seeded with sample data
- [ ] Test users available (see Test Credentials below)

### Test Credentials

| Role | Email/Registration | Password |
|------|-------------------|----------|
| External Examiner | external@test.com | test123 |
| Committee Member | committee@test.com | test123 |
| Student (8th sem) | 2021-CS-001 | test123 |
| Supervisor | supervisor@test.com | test123 |

---

## 1. External Examiner Flow

### 1.1 Authentication
- [ ] Navigate to login page
- [ ] Click "External" tab in user type selector
- [ ] Verify email input field is displayed
- [ ] Enter valid external examiner email
- [ ] Enter valid password
- [ ] Click "Login" button
- [ ] Verify redirect to `/external_examiner/dashboard`
- [ ] Verify dashboard loads without errors

### 1.2 Dashboard Overview
- [ ] Verify profile information is displayed
- [ ] Verify statistics cards are visible:
  - [ ] Total Groups
  - [ ] Total Students
  - [ ] Pending Evaluations
  - [ ] Completed Evaluations
- [ ] Verify statistics show correct counts

### 1.3 View Assigned Groups
- [ ] Click "My Groups" or "Groups" tab
- [ ] Verify external groups list is displayed
- [ ] Verify each group card shows:
  - [ ] Group name
  - [ ] Number of assignments
  - [ ] Status (pending/scheduled/completed)
  - [ ] Available slots
- [ ] Click on a group card to expand
- [ ] Verify assigned student groups are displayed

### 1.4 View Student Assignments
- [ ] Expand an external group
- [ ] Verify assignment cards show:
  - [ ] Student name(s)
  - [ ] Registration number(s)
  - [ ] Project name
  - [ ] Supervisor name
  - [ ] Slot number/time (if assigned)
  - [ ] Status badge (pending/evaluated)
- [ ] Verify "Evaluate" button appears for pending assignments
- [ ] Verify "Edit" button appears for evaluated assignments

### 1.5 Create New Evaluation
- [ ] Click "Evaluate" on a pending assignment
- [ ] Verify evaluation form opens
- [ ] Verify student group details are displayed at top
- [ ] Verify all sections are present:
  - [ ] Project Implementation (30 marks)
  - [ ] Technical Knowledge (25 marks)
  - [ ] Presentation Skills (20 marks)
  - [ ] Documentation Quality (15 marks)
  - [ ] Q&A Response (10 marks)
  - [ ] Comments section

### 1.6 Fill Evaluation Criteria
- [ ] For each criterion, verify dropdown options:
  - [ ] Not Evaluated (0%)
  - [ ] Marginal (20%)
  - [ ] Adequate (50%)
  - [ ] Good (75%)
  - [ ] Excellent (95%)
- [ ] Change a rating and verify section marks update
- [ ] Verify total marks updates in real-time
- [ ] Verify grade updates based on total marks:
  - [ ] A: >= 85
  - [ ] B+: >= 75
  - [ ] B: >= 65
  - [ ] C+: >= 55
  - [ ] C: >= 50
  - [ ] F: < 50
- [ ] Verify PASS/FAIL indicator updates correctly

### 1.7 Add Comments
- [ ] Fill "Overall Comment" textarea
- [ ] Fill "Strengths" textarea
- [ ] Fill "Areas of Improvement" textarea

### 1.8 Submit Evaluation
- [ ] Click "Submit Evaluation" button
- [ ] Verify loading state during submission
- [ ] Verify success message appears
- [ ] Verify redirect back to assignments list
- [ ] Verify assignment status changed to "Evaluated"
- [ ] Verify dashboard statistics updated

### 1.9 Edit Existing Evaluation
- [ ] Click "Edit" on an evaluated assignment
- [ ] Verify form is pre-populated with existing values
- [ ] Modify a rating
- [ ] Verify marks recalculate
- [ ] Click "Update Evaluation"
- [ ] Verify success message
- [ ] Verify changes are saved

### 1.10 Cancel Evaluation
- [ ] Open evaluation form
- [ ] Click "Cancel" button
- [ ] Verify return to assignments list
- [ ] Verify no data was saved

---

## 2. Committee Member Flow

### 2.1 Authentication
- [ ] Navigate to login page
- [ ] Click "Committee" tab
- [ ] Enter valid committee member email
- [ ] Enter valid password
- [ ] Click "Login"
- [ ] Verify redirect to `/committee_member/dashboard`

### 2.2 Navigate to External Management
- [ ] Click "External Management" tab
- [ ] Verify External Management interface loads
- [ ] Verify three view options are available:
  - [ ] Examiners
  - [ ] Groups
  - [ ] Assignments

### 2.3 View External Examiners
- [ ] Click "Examiners" view
- [ ] Verify list of external examiners is displayed
- [ ] Verify each examiner card shows:
  - [ ] Name
  - [ ] Institution
  - [ ] Designation
  - [ ] Groups count
  - [ ] Active status

### 2.4 Create External Group
- [ ] Click "Groups" view
- [ ] Verify "Create New Group" form is visible
- [ ] Fill in:
  - [ ] Group name
  - [ ] Semester
  - [ ] Max groups
  - [ ] Select external examiner
  - [ ] Evaluation date (optional)
  - [ ] Evaluation venue (optional)
- [ ] Click "Create Group"
- [ ] Verify group appears in the list
- [ ] Verify capacity indicator shows correctly

### 2.5 View External Groups
- [ ] Verify all created groups are listed
- [ ] Verify each group shows:
  - [ ] Name
  - [ ] External examiner name
  - [ ] Semester
  - [ ] Status
  - [ ] Assignment count / Max capacity
- [ ] Click on a group to view details
- [ ] Verify modal/details view shows assignments

### 2.6 Assign Student Groups
- [ ] Click "Assignments" view
- [ ] Verify available student groups are listed
- [ ] Verify each shows:
  - [ ] Student names
  - [ ] Project name
  - [ ] Supervisor name
  - [ ] Current assignment status
- [ ] Click "Assign" on an available group
- [ ] Select external group from dropdown
- [ ] Confirm assignment
- [ ] Verify assignment created
- [ ] Verify group no longer shows as available

### 2.7 View Group Assignments
- [ ] Return to "Groups" view
- [ ] Click on a group with assignments
- [ ] Verify assigned students are listed
- [ ] Verify slot numbers are assigned

### 2.8 Delete External Group
- [ ] Attempt to delete an empty group
- [ ] Confirm deletion in dialog
- [ ] Verify group is removed from list
- [ ] Verify cannot delete group with assignments (if applicable)

### 2.9 Delete Assignment
- [ ] Navigate to group details
- [ ] Click delete on an assignment
- [ ] Confirm deletion
- [ ] Verify assignment is removed
- [ ] Verify student group becomes available again

---

## 3. Student Flow

### 3.1 Authentication
- [ ] Navigate to login page
- [ ] Verify "Student" tab is default
- [ ] Enter valid registration number (8th semester student)
- [ ] Enter valid password
- [ ] Click "Login"
- [ ] Verify redirect to `/student/dashboard`

### 3.2 Verify External Evaluation Tab Visibility
- [ ] For 8th semester student: Verify "External Evaluation" tab is visible
- [ ] For non-8th semester student: Verify tab is NOT visible

### 3.3 View No Evaluation State
- [ ] Click "External Evaluation" tab
- [ ] If not yet evaluated:
  - [ ] Verify empty state message is displayed
  - [ ] Verify message indicates evaluation pending

### 3.4 View Evaluation Results
- [ ] Click "External Evaluation" tab (when evaluated)
- [ ] Verify summary card displays:
  - [ ] Total marks (X/100)
  - [ ] Grade (A, B+, B, C+, C, F)
  - [ ] Pass/Fail status
- [ ] Verify section breakdown:
  - [ ] Project Implementation marks
  - [ ] Technical Knowledge marks
  - [ ] Presentation Skills marks
  - [ ] Documentation Quality marks
  - [ ] Q&A Response marks
- [ ] Verify each section shows progress bar
- [ ] Verify comments are displayed:
  - [ ] Overall comment
  - [ ] Strengths
  - [ ] Areas of improvement
- [ ] Verify evaluation date is shown

---

## 4. Notification Testing

### 4.1 Assignment Notification
- [ ] Create new assignment (as committee member)
- [ ] Login as assigned student
- [ ] Verify notification received
- [ ] Click notification and verify navigation

### 4.2 Evaluation Notification
- [ ] Complete evaluation (as external examiner)
- [ ] Login as student
- [ ] Verify notification about evaluation completion
- [ ] Click notification and verify navigation

---

## 5. Schedule View Testing

### 5.1 Access Schedule
- [ ] Login as any user type
- [ ] Navigate to Schedule view
- [ ] Verify schedules load

### 5.2 List View
- [ ] Verify schedules grouped by date
- [ ] Verify each schedule shows:
  - [ ] Time
  - [ ] Title
  - [ ] Venue
  - [ ] Type icon
  - [ ] Status badge

### 5.3 Calendar View
- [ ] Switch to Calendar view
- [ ] Verify monthly calendar displays
- [ ] Verify events shown on correct dates
- [ ] Verify current day highlighted

### 5.4 Filters
- [ ] Filter by type (Internal/External/Final Defense)
- [ ] Filter by status (Scheduled/Completed/Postponed/Cancelled)
- [ ] Toggle "Upcoming only" checkbox
- [ ] Verify results update correctly

---

## 6. Responsive Design Testing

### 6.1 Desktop (>1024px)
- [ ] Verify all layouts display correctly
- [ ] Verify side-by-side displays work

### 6.2 Tablet (768px-1024px)
- [ ] Navigate to each page
- [ ] Verify layouts adjust appropriately
- [ ] Verify touch targets are adequate size

### 6.3 Mobile (<768px)
- [ ] Navigate to each page
- [ ] Verify single-column layouts
- [ ] Verify dropdowns/modals work
- [ ] Verify forms are usable

---

## 7. Error Handling

### 7.1 Network Errors
- [ ] Simulate offline mode
- [ ] Verify error messages appear
- [ ] Verify app doesn't crash

### 7.2 Invalid Data
- [ ] Submit form with missing required fields
- [ ] Verify validation messages appear
- [ ] Verify submission is prevented

### 7.3 Unauthorized Access
- [ ] Try accessing external examiner routes as student
- [ ] Verify redirect to login or access denied
- [ ] Try accessing committee routes as supervisor
- [ ] Verify appropriate error handling

---

## 8. Performance Testing

### 8.1 Page Load Times
- [ ] Dashboard loads in < 3 seconds
- [ ] Groups list loads in < 2 seconds
- [ ] Evaluation form loads in < 2 seconds

### 8.2 Large Data Sets
- [ ] Test with 50+ external groups
- [ ] Test with 100+ assignments
- [ ] Verify no significant slowdown

---

## Sign-off

**Tested by:** _________________________

**Date:** _________________________

**Environment:** _________________________

**Notes:**
```
[Add any additional notes or issues found here]
```
