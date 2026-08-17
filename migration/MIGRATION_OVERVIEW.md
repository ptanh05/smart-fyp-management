# FYP Management System - Migration Plan

## Overview

This document outlines the migration plan from the current system to the enhanced system with **External Examiner** support for 8th semester final evaluations.

---

## Current System Analysis

### Existing User Roles (3)
1. **Student** - Group formation, document upload, view evaluations
2. **Supervisor** - Project management, document review, evaluations
3. **Committee Member** - Panel evaluations, template management

### Existing Models
```
CustomUser (user_type: student, supervisor, committee_member)
├── Student
├── Supervisor  
├── CommitteeMember
├── CommitteeMemberPanel
├── ProjectCategories
├── Project
├── Group
├── SupervisorOfStudentGroup
├── Document
├── DocumentTemplate
├── Evaluation Models (Scope, SRS, SDD, Eval3, Eval4 - Supervisor & Committee)
├── ChatRoom
├── Notification
├── NotificationPreference
└── AuditLog
```

### Existing Frontend Pages
- `LoginPage.tsx`
- `StudentDashboard.tsx`
- `SupervisorDashboard.tsx`
- `CommitteeMemberDashboard.tsx`

---

## Target System (New)

### New User Roles (5)
1. **Admin (Superuser)** - Full system access via Django Admin
2. **Student** - (Enhanced) Semester tracking, external evaluation view
3. **Supervisor** - (Same) No changes needed
4. **Committee Member** - (Enhanced) External group assignment
5. **External Examiner** - (NEW) Final viva evaluation for 8th semester

### New Models Required
```
CustomUser (user_type: + external_examiner)
├── ExternalExaminer (NEW)
├── ExternalGroup (NEW) - Groups multiple student groups for one external
├── ExternalGroupAssignment (NEW) - Links SupervisorOfStudentGroup to ExternalGroup
├── ExternalEvaluation (NEW) - Final external evaluation scores
└── EvaluationSchedule (NEW) - Schedule external viva dates
```

### New Frontend Pages
- `ExternalDashboard.tsx` (NEW)
- Enhanced `CommitteeMemberDashboard.tsx` (External assignment)
- Enhanced `StudentDashboard.tsx` (View external evaluation)

---

## Migration Phases

| Phase | Name | Duration | Priority |
|-------|------|----------|----------|
| 1 | Database & Models | 2-3 days | HIGH |
| 2 | Backend API Development | 3-4 days | HIGH |
| 3 | Admin Panel Configuration | 1-2 days | MEDIUM |
| 4 | Frontend Development | 4-5 days | HIGH |
| 5 | Integration & Testing | 2-3 days | HIGH |
| 6 | Data Migration & Seeding | 1-2 days | MEDIUM |

**Total Estimated Duration: 13-19 days**

---

## Phase Files

| File | Description |
|------|-------------|
| `PHASE_1_DATABASE_MODELS.md` | Database schema changes and model creation |
| `PHASE_2_BACKEND_API.md` | API endpoints, views, serializers, permissions |
| `PHASE_3_ADMIN_PANEL.md` | Django Admin configuration for new models |
| `PHASE_4_FRONTEND.md` | Frontend components and dashboard creation |
| `PHASE_5_INTEGRATION_TESTING.md` | End-to-end testing and bug fixes |
| `PHASE_6_DATA_MIGRATION.md` | Seed script updates and data migration |

---

## Dependencies Between Phases

```
Phase 1 (Database)
    │
    ▼
Phase 2 (Backend API) ──────────► Phase 3 (Admin Panel)
    │
    ▼
Phase 4 (Frontend)
    │
    ▼
Phase 5 (Integration Testing)
    │
    ▼
Phase 6 (Data Migration)
```

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Database migration breaks existing data | HIGH | Create full backup before migration |
| API changes break frontend | MEDIUM | Version API endpoints, test thoroughly |
| External assignment logic complexity | MEDIUM | Clear documentation, unit tests |
| Evaluation form inconsistencies | LOW | Reuse existing evaluation patterns |

---

## Pre-Migration Checklist

- [ ] Full database backup
- [ ] Document current API endpoints
- [ ] Note existing frontend routes
- [ ] Review current evaluation flow
- [ ] Identify data relationships
- [ ] Set up test environment

---

## Post-Migration Checklist

- [ ] All models migrated successfully
- [ ] All API endpoints functional
- [ ] Admin panel configured
- [ ] Frontend dashboards working
- [ ] External evaluation flow tested
- [ ] Seed script updated
- [ ] Documentation updated
- [ ] User acceptance testing complete
