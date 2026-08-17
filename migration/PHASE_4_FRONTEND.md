# Phase 4: Frontend Development

## Objective
Create External Examiner dashboard, components, and integrate external evaluation features into existing dashboards.

---

## Task Summary

| Task ID | Task | Priority | Status |
|---------|------|----------|--------|
| 4.1 | Create API service functions | HIGH | ✅ Done |
| 4.2 | Create TypeScript types | HIGH | ✅ Done |
| 4.3 | Create ExternalDashboard page | HIGH | ✅ Done |
| 4.4 | Create ExternalGroupsList component | HIGH | ✅ Done |
| 4.5 | Create ExternalEvaluationForm component | HIGH | ✅ Done |
| 4.6 | Create ExternalAssignmentCard component | MEDIUM | ✅ Done |
| 4.7 | Update routing for External Examiner | HIGH | ✅ Done |
| 4.8 | Update StudentDashboard for external view | MEDIUM | ✅ Done |
| 4.9 | Update CommitteeMemberDashboard | MEDIUM | ✅ Done |
| 4.10 | Create ExternalScheduleView component | MEDIUM | ✅ Done |
| 4.11 | Add external notifications | MEDIUM | ✅ Done |
| 4.12 | Create CSS styles | HIGH | ✅ Done |

---

## Task 4.1: Create API Service Functions

### File: `frontend/src/services/api.ts`

```typescript
// ==================== External Examiner API ====================

// External Profile
async getExternalProfile(): Promise<ExternalExaminer> {
  const response = await this.api.get<ExternalExaminer>('/external/profile/');
  return response.data;
}

async updateExternalProfile(data: Partial<ExternalExaminer>): Promise<ExternalExaminer> {
  const response = await this.api.patch<ExternalExaminer>('/external/profile/', data);
  return response.data;
}

// External Dashboard
async getExternalDashboard(): Promise<ExternalDashboardData> {
  const response = await this.api.get<ExternalDashboardData>('/external/dashboard/');
  return response.data;
}

// External Examiners List (for committee)
async getExternalExaminers(params?: {
  institution?: string;
  designation?: string;
}): Promise<PaginatedResponse<ExternalExaminerListItem>> {
  const response = await this.api.get('/external/examiners/', { params });
  return response.data;
}

// External Groups
async getExternalGroups(params?: {
  semester?: string;
  status?: string;
  external_examiner?: number;
}): Promise<PaginatedResponse<ExternalGroup>> {
  const response = await this.api.get('/external/groups/', { params });
  return response.data;
}

async getExternalGroup(id: number): Promise<ExternalGroupDetail> {
  const response = await this.api.get<ExternalGroupDetail>(`/external/groups/${id}/`);
  return response.data;
}

async createExternalGroup(data: ExternalGroupCreate): Promise<ExternalGroup> {
  const response = await this.api.post<ExternalGroup>('/external/groups/', data);
  return response.data;
}

async updateExternalGroup(id: number, data: Partial<ExternalGroupCreate>): Promise<ExternalGroup> {
  const response = await this.api.patch<ExternalGroup>(`/external/groups/${id}/`, data);
  return response.data;
}

async deleteExternalGroup(id: number): Promise<void> {
  await this.api.delete(`/external/groups/${id}/`);
}

// External Group Assignments
async getExternalGroupStudents(groupId: number): Promise<ExternalGroupAssignment[]> {
  const response = await this.api.get<ExternalGroupAssignment[]>(
    `/external/groups/${groupId}/students/`
  );
  return response.data;
}

async getAvailableGroupsForExternal(params?: {
  semester?: string;
  completed_internal?: string;
}): Promise<PaginatedResponse<SupervisorOfStudentGroup>> {
  const response = await this.api.get('/external/available-groups/', { params });
  return response.data;
}

async createExternalAssignment(data: {
  external_group: number;
  supervisor_group: number;
  slot_number?: number;
  slot_time?: string;
}): Promise<ExternalGroupAssignment> {
  const response = await this.api.post<ExternalGroupAssignment>(
    '/external/assignments/',
    data
  );
  return response.data;
}

async deleteExternalAssignment(id: number): Promise<void> {
  await this.api.delete(`/external/assignments/${id}/`);
}

// External Evaluations
async getExternalEvaluations(): Promise<ExternalEvaluation[]> {
  const response = await this.api.get<ExternalEvaluation[]>('/external/evaluations/');
  return response.data;
}

async getExternalEvaluation(id: number): Promise<ExternalEvaluation> {
  const response = await this.api.get<ExternalEvaluation>(`/external/evaluations/${id}/`);
  return response.data;
}

async createExternalEvaluation(data: ExternalEvaluationCreate): Promise<ExternalEvaluation> {
  const response = await this.api.post<ExternalEvaluation>(
    '/external/evaluations/create/',
    data
  );
  return response.data;
}

async updateExternalEvaluation(
  id: number,
  data: Partial<ExternalEvaluationCreate>
): Promise<ExternalEvaluation> {
  const response = await this.api.patch<ExternalEvaluation>(
    `/external/evaluations/${id}/`,
    data
  );
  return response.data;
}

// Student External Evaluation View
async getStudentExternalEvaluation(): Promise<ExternalEvaluation> {
  const response = await this.api.get<ExternalEvaluation>('/student/external-evaluation/');
  return response.data;
}

// Evaluation Schedules
async getEvaluationSchedules(params?: {
  type?: string;
  semester?: string;
  status?: string;
  upcoming?: string;
}): Promise<PaginatedResponse<EvaluationSchedule>> {
  const response = await this.api.get('/schedules/', { params });
  return response.data;
}

async createEvaluationSchedule(data: EvaluationScheduleCreate): Promise<EvaluationSchedule> {
  const response = await this.api.post<EvaluationSchedule>('/schedules/', data);
  return response.data;
}
```

### Acceptance Criteria
- [x] All API functions implemented
- [x] Proper TypeScript typing
- [x] Error handling consistent

---

## Task 4.2: Create TypeScript Types

### File: `frontend/src/types/external.ts`

```typescript
// ==================== External Examiner Types ====================

export interface ExternalExaminerUser {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  user_type: 'external_examiner';
}

export interface ExternalExaminer {
  id: number;
  user: ExternalExaminerUser;
  external_id: string;
  institution: string;
  designation: 'professor' | 'associate_professor' | 'assistant_professor' | 'industry_expert' | 'visiting_faculty';
  specialization?: string;
  contact_number?: string;
  address?: string;
  is_active: boolean;
  assigned_groups_count: number;
  created_at: string;
}

export interface ExternalExaminerListItem {
  id: number;
  user: ExternalExaminerUser;
  full_name: string;
  institution: string;
  designation: string;
  is_active: boolean;
}

export interface ExternalGroup {
  id: number;
  name: string;
  external_examiner: number;
  external_examiner_name: string;
  semester: string;
  status: 'pending' | 'scheduled' | 'in_progress' | 'completed';
  max_groups: number;
  assigned_count: number;
  available_slots: number;
  is_full: boolean;
  evaluation_date?: string;
  evaluation_venue?: string;
}

export interface ExternalGroupDetail extends ExternalGroup {
  external_examiner: ExternalExaminer;
  assignments: ExternalGroupAssignment[];
  notes?: string;
  created_at: string;
}

export interface ExternalGroupCreate {
  name: string;
  external_examiner: number;
  semester: string;
  status?: string;
  max_groups?: number;
  evaluation_date?: string;
  evaluation_venue?: string;
  notes?: string;
}

export interface StudentGroupInfo {
  id: number;
  student_1: {
    id: number;
    name: string;
    registration_no: string;
  };
  student_2?: {
    id: number;
    name: string;
    registration_no: string;
  };
}

export interface ProjectInfo {
  id: number;
  name: string;
  category: string;
}

export interface SupervisorInfo {
  id: number;
  name: string;
}

export interface ExternalGroupAssignment {
  id: number;
  external_group: number;
  supervisor_group: number;
  student_group: StudentGroupInfo;
  project_info: ProjectInfo;
  supervisor_info: SupervisorInfo;
  slot_number?: number;
  slot_time?: string;
  status: 'assigned' | 'evaluated' | 'absent';
  has_evaluation: boolean;
  assigned_at: string;
}

export type EvaluationRating = 'pending' | 'marginal' | 'adequate' | 'good' | 'excellent';

export interface ExternalEvaluation {
  id: number;
  assignment: number;
  assignment_info: ExternalGroupAssignment;
  
  // Project Implementation (30 marks)
  project_completion: EvaluationRating;
  code_quality: EvaluationRating;
  functionality: EvaluationRating;
  project_implementation_marks: number;
  
  // Technical Knowledge (25 marks)
  understanding_of_technology: EvaluationRating;
  problem_solving: EvaluationRating;
  innovation: EvaluationRating;
  technical_knowledge_marks: number;
  
  // Presentation Skills (20 marks)
  presentation_clarity: EvaluationRating;
  communication: EvaluationRating;
  time_management: EvaluationRating;
  presentation_marks: number;
  
  // Documentation Quality (15 marks)
  documentation_completeness: EvaluationRating;
  documentation_quality: EvaluationRating;
  documentation_marks: number;
  
  // Q&A Response (10 marks)
  qa_response: EvaluationRating;
  qa_marks: number;
  
  // Totals
  total_marks: number;
  grade: 'A' | 'B+' | 'B' | 'C+' | 'C' | 'F';
  is_pass: boolean;
  
  // Comments
  overall_comment?: string;
  strengths?: string;
  areas_of_improvement?: string;
  
  evaluated_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ExternalEvaluationCreate {
  assignment: number;
  project_completion: EvaluationRating;
  code_quality: EvaluationRating;
  functionality: EvaluationRating;
  understanding_of_technology: EvaluationRating;
  problem_solving: EvaluationRating;
  innovation: EvaluationRating;
  presentation_clarity: EvaluationRating;
  communication: EvaluationRating;
  time_management: EvaluationRating;
  documentation_completeness: EvaluationRating;
  documentation_quality: EvaluationRating;
  qa_response: EvaluationRating;
  overall_comment?: string;
  strengths?: string;
  areas_of_improvement?: string;
  is_pass?: boolean;
}

export interface EvaluationSchedule {
  id: number;
  title: string;
  evaluation_type: 'scope' | 'srs' | 'sdd' | 'midterm' | 'internal_final' | 'external_final';
  semester: string;
  date: string;
  start_time: string;
  end_time: string;
  venue: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'postponed' | 'cancelled';
  external_group?: number;
  external_group_name?: string;
  panel?: number;
  panel_name?: string;
  notes?: string;
  created_at: string;
}

export interface ExternalDashboardData {
  profile: ExternalExaminer;
  statistics: {
    total_groups_assigned: number;
    evaluated: number;
    pending: number;
  };
  external_groups: ExternalGroup[];
  upcoming_schedules: EvaluationSchedule[];
}
```

### Update `frontend/src/types/index.ts`:

```typescript
// Add to existing exports
export * from './external';
```

### Acceptance Criteria
- [x] All types defined
- [x] Types exported properly
- [x] Types match API response

---

## Task 4.3: Create ExternalDashboard Page

### File: `frontend/src/pages/ExternalDashboard.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import type { ExternalExaminer, ExternalDashboardData, ExternalGroup } from '../types';
import Navbar from '../components/Navbar';
import ExternalGroupsList from '../components/ExternalGroupsList';
import ExternalEvaluationForm from '../components/ExternalEvaluationForm';
import ExternalScheduleView from '../components/ExternalScheduleView';
import { SkeletonProfile, SkeletonCardGrid } from '../components/SkeletonLoader';
import './Dashboard.css';

interface ExternalDashboardProps {
  onLogout: () => void;
}

const ExternalDashboard: React.FC<ExternalDashboardProps> = ({ onLogout }) => {
  const [dashboardData, setDashboardData] = useState<ExternalDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'groups' | 'evaluations' | 'schedule'>('overview');
  const [selectedGroup, setSelectedGroup] = useState<ExternalGroup | null>(null);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<number | null>(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const data = await apiService.getExternalDashboard();
      setDashboardData(data);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEvaluationComplete = () => {
    setSelectedAssignmentId(null);
    loadDashboard();
  };

  if (loading) {
    return (
      <div className="dashboard">
        <Navbar user={null} onLogout={onLogout} />
        <div className="dashboard-content">
          <SkeletonProfile />
          <SkeletonCardGrid count={3} />
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="dashboard">
        <Navbar user={null} onLogout={onLogout} />
        <div className="dashboard-content">
          <div className="card error-card">
            <h2>Error Loading Dashboard</h2>
            <p>Failed to load your profile. Please try again.</p>
            <button className="btn btn-primary" onClick={loadDashboard}>
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { profile, statistics, external_groups, upcoming_schedules } = dashboardData;

  return (
    <div className="dashboard">
      <Navbar 
        user={{
          user: profile.user,
          ...profile
        } as any} 
        onLogout={onLogout} 
      />
      
      <div className="dashboard-content">
        {/* Profile Header */}
        <div className="card profile-card">
          <div className="profile-header">
            <div className="profile-avatar">
              {profile.user.first_name?.[0] || profile.user.username[0]}
            </div>
            <div className="profile-info">
              <h1>{profile.user.first_name} {profile.user.last_name}</h1>
              <p className="profile-subtitle">External Examiner</p>
              <p className="profile-meta">{profile.institution}</p>
              <p className="profile-meta">{profile.designation.replace('_', ' ').toUpperCase()}</p>
            </div>
          </div>
          
          {/* Statistics */}
          <div className="stats-grid">
            <div className="stat-card">
              <span className="stat-value">{statistics.total_groups_assigned}</span>
              <span className="stat-label">Total Groups</span>
            </div>
            <div className="stat-card stat-success">
              <span className="stat-value">{statistics.evaluated}</span>
              <span className="stat-label">Evaluated</span>
            </div>
            <div className="stat-card stat-warning">
              <span className="stat-value">{statistics.pending}</span>
              <span className="stat-label">Pending</span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="tab-navigation">
          <button
            className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button
            className={`tab-btn ${activeTab === 'groups' ? 'active' : ''}`}
            onClick={() => setActiveTab('groups')}
          >
            My Groups ({external_groups.length})
          </button>
          <button
            className={`tab-btn ${activeTab === 'evaluations' ? 'active' : ''}`}
            onClick={() => setActiveTab('evaluations')}
          >
            Evaluations
          </button>
          <button
            className={`tab-btn ${activeTab === 'schedule' ? 'active' : ''}`}
            onClick={() => setActiveTab('schedule')}
          >
            Schedule
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="tab-content">
            <div className="cards-grid">
              {/* Pending Evaluations */}
              <div className="card">
                <h3>Pending Evaluations</h3>
                {statistics.pending === 0 ? (
                  <p className="empty-state">All evaluations completed!</p>
                ) : (
                  <div className="pending-list">
                    {external_groups.map(group => (
                      <div key={group.id} className="pending-item">
                        <span>{group.name}</span>
                        <span className="badge badge-pending">
                          {group.assigned_count - (group.assignments?.filter(a => a.has_evaluation).length || 0)} pending
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Upcoming Schedule */}
              <div className="card">
                <h3>Upcoming Evaluations</h3>
                {upcoming_schedules.length === 0 ? (
                  <p className="empty-state">No upcoming evaluations scheduled</p>
                ) : (
                  <div className="schedule-list">
                    {upcoming_schedules.map(schedule => (
                      <div key={schedule.id} className="schedule-item">
                        <div className="schedule-date">
                          {new Date(schedule.date).toLocaleDateString()}
                        </div>
                        <div className="schedule-info">
                          <strong>{schedule.title}</strong>
                          <span>{schedule.start_time} - {schedule.end_time}</span>
                          <span>{schedule.venue}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div className="card">
                <h3>Quick Actions</h3>
                <div className="quick-actions">
                  <button 
                    className="btn btn-primary"
                    onClick={() => setActiveTab('evaluations')}
                  >
                    Start Evaluation
                  </button>
                  <button 
                    className="btn btn-secondary"
                    onClick={() => setActiveTab('schedule')}
                  >
                    View Schedule
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'groups' && (
          <ExternalGroupsList
            groups={external_groups}
            onSelectGroup={setSelectedGroup}
            onRefresh={loadDashboard}
          />
        )}

        {activeTab === 'evaluations' && (
          <div className="tab-content">
            {selectedAssignmentId ? (
              <ExternalEvaluationForm
                assignmentId={selectedAssignmentId}
                onComplete={handleEvaluationComplete}
                onCancel={() => setSelectedAssignmentId(null)}
              />
            ) : (
              <div className="card">
                <h3>Select a Group to Evaluate</h3>
                <div className="evaluation-groups-list">
                  {external_groups.map(group => (
                    <div key={group.id} className="evaluation-group-card">
                      <h4>{group.name}</h4>
                      <p>Semester: {group.semester}</p>
                      <p>Students: {group.assigned_count}</p>
                      <button
                        className="btn btn-primary"
                        onClick={() => setSelectedGroup(group)}
                      >
                        View Students
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'schedule' && (
          <ExternalScheduleView schedules={upcoming_schedules} />
        )}
      </div>
    </div>
  );
};

export default ExternalDashboard;
```

### Acceptance Criteria
- [x] Dashboard loads correctly
- [x] Statistics displayed
- [x] Tab navigation working
- [x] Groups and evaluations accessible

---

## Task 4.4: Create ExternalGroupsList Component

### File: `frontend/src/components/ExternalGroupsList.tsx`

```typescript
import React, { useState } from 'react';
import { apiService } from '../services/api';
import type { ExternalGroup, ExternalGroupAssignment } from '../types';
import './ExternalGroupsList.css';

interface ExternalGroupsListProps {
  groups: ExternalGroup[];
  onSelectGroup: (group: ExternalGroup) => void;
  onRefresh: () => void;
}

const ExternalGroupsList: React.FC<ExternalGroupsListProps> = ({
  groups,
  onSelectGroup,
  onRefresh
}) => {
  const [expandedGroup, setExpandedGroup] = useState<number | null>(null);
  const [assignments, setAssignments] = useState<ExternalGroupAssignment[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);

  const loadAssignments = async (groupId: number) => {
    if (expandedGroup === groupId) {
      setExpandedGroup(null);
      return;
    }

    try {
      setLoadingAssignments(true);
      const data = await apiService.getExternalGroupStudents(groupId);
      setAssignments(data);
      setExpandedGroup(groupId);
    } catch (error) {
      console.error('Failed to load assignments:', error);
    } finally {
      setLoadingAssignments(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusClasses: Record<string, string> = {
      pending: 'badge-pending',
      scheduled: 'badge-info',
      in_progress: 'badge-warning',
      completed: 'badge-success'
    };
    return statusClasses[status] || 'badge-default';
  };

  return (
    <div className="external-groups-list">
      <div className="list-header">
        <h3>My External Groups</h3>
        <button className="btn btn-secondary btn-sm" onClick={onRefresh}>
          Refresh
        </button>
      </div>

      {groups.length === 0 ? (
        <div className="empty-state">
          <p>No external groups assigned yet.</p>
        </div>
      ) : (
        <div className="groups-container">
          {groups.map(group => (
            <div key={group.id} className="group-card">
              <div className="group-header" onClick={() => loadAssignments(group.id)}>
                <div className="group-info">
                  <h4>{group.name}</h4>
                  <p className="group-meta">
                    <span>Semester: {group.semester}</span>
                    <span>Students: {group.assigned_count}/{group.max_groups}</span>
                  </p>
                </div>
                <div className="group-actions">
                  <span className={`badge ${getStatusBadge(group.status)}`}>
                    {group.status}
                  </span>
                  <span className="expand-icon">
                    {expandedGroup === group.id ? '▼' : '▶'}
                  </span>
                </div>
              </div>

              {group.evaluation_date && (
                <div className="group-schedule">
                  <strong>Evaluation:</strong> {new Date(group.evaluation_date).toLocaleDateString()}
                  {group.evaluation_venue && ` at ${group.evaluation_venue}`}
                </div>
              )}

              {expandedGroup === group.id && (
                <div className="group-students">
                  {loadingAssignments ? (
                    <div className="loading">Loading students...</div>
                  ) : assignments.length === 0 ? (
                    <div className="empty-state">No students assigned yet.</div>
                  ) : (
                    <table className="students-table">
                      <thead>
                        <tr>
                          <th>Slot</th>
                          <th>Students</th>
                          <th>Project</th>
                          <th>Supervisor</th>
                          <th>Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {assignments.map(assignment => (
                          <tr key={assignment.id}>
                            <td>{assignment.slot_number || '-'}</td>
                            <td>
                              <div className="student-names">
                                <span>{assignment.student_group.student_1.name}</span>
                                <span className="reg-no">
                                  ({assignment.student_group.student_1.registration_no})
                                </span>
                                {assignment.student_group.student_2 && (
                                  <>
                                    <br />
                                    <span>{assignment.student_group.student_2.name}</span>
                                    <span className="reg-no">
                                      ({assignment.student_group.student_2.registration_no})
                                    </span>
                                  </>
                                )}
                              </div>
                            </td>
                            <td>
                              <div className="project-info">
                                <span>{assignment.project_info.name}</span>
                                <span className="category">
                                  {assignment.project_info.category}
                                </span>
                              </div>
                            </td>
                            <td>{assignment.supervisor_info.name}</td>
                            <td>
                              <span className={`badge ${assignment.has_evaluation ? 'badge-success' : 'badge-warning'}`}>
                                {assignment.has_evaluation ? 'Evaluated' : 'Pending'}
                              </span>
                            </td>
                            <td>
                              <button
                                className={`btn btn-sm ${assignment.has_evaluation ? 'btn-secondary' : 'btn-primary'}`}
                                onClick={() => onSelectGroup(group)}
                              >
                                {assignment.has_evaluation ? 'View' : 'Evaluate'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ExternalGroupsList;
```

### Acceptance Criteria
- [x] Groups displayed with expandable details
- [x] Student list shown on expand
- [x] Evaluation status visible
- [x] Action buttons working

---

## Task 4.5: Create ExternalEvaluationForm Component

### File: `frontend/src/components/ExternalEvaluationForm.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import type { 
  ExternalGroupAssignment, 
  ExternalEvaluation, 
  ExternalEvaluationCreate,
  EvaluationRating 
} from '../types';
import './ExternalEvaluationForm.css';

interface ExternalEvaluationFormProps {
  assignmentId: number;
  existingEvaluation?: ExternalEvaluation;
  onComplete: () => void;
  onCancel: () => void;
}

const RATING_OPTIONS: { value: EvaluationRating; label: string; description: string }[] = [
  { value: 'pending', label: 'Not Evaluated', description: '0%' },
  { value: 'marginal', label: 'Marginal', description: '20%' },
  { value: 'adequate', label: 'Adequate', description: '50%' },
  { value: 'good', label: 'Good', description: '75%' },
  { value: 'excellent', label: 'Excellent', description: '95%' },
];

const ExternalEvaluationForm: React.FC<ExternalEvaluationFormProps> = ({
  assignmentId,
  existingEvaluation,
  onComplete,
  onCancel
}) => {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [assignment, setAssignment] = useState<ExternalGroupAssignment | null>(null);
  const [formData, setFormData] = useState<ExternalEvaluationCreate>({
    assignment: assignmentId,
    // Project Implementation
    project_completion: 'pending',
    code_quality: 'pending',
    functionality: 'pending',
    // Technical Knowledge
    understanding_of_technology: 'pending',
    problem_solving: 'pending',
    innovation: 'pending',
    // Presentation
    presentation_clarity: 'pending',
    communication: 'pending',
    time_management: 'pending',
    // Documentation
    documentation_completeness: 'pending',
    documentation_quality: 'pending',
    // Q&A
    qa_response: 'pending',
    // Comments
    overall_comment: '',
    strengths: '',
    areas_of_improvement: '',
    is_pass: false
  });

  useEffect(() => {
    if (existingEvaluation) {
      setFormData({
        assignment: existingEvaluation.assignment,
        project_completion: existingEvaluation.project_completion,
        code_quality: existingEvaluation.code_quality,
        functionality: existingEvaluation.functionality,
        understanding_of_technology: existingEvaluation.understanding_of_technology,
        problem_solving: existingEvaluation.problem_solving,
        innovation: existingEvaluation.innovation,
        presentation_clarity: existingEvaluation.presentation_clarity,
        communication: existingEvaluation.communication,
        time_management: existingEvaluation.time_management,
        documentation_completeness: existingEvaluation.documentation_completeness,
        documentation_quality: existingEvaluation.documentation_quality,
        qa_response: existingEvaluation.qa_response,
        overall_comment: existingEvaluation.overall_comment || '',
        strengths: existingEvaluation.strengths || '',
        areas_of_improvement: existingEvaluation.areas_of_improvement || '',
        is_pass: existingEvaluation.is_pass
      });
    }
  }, [existingEvaluation]);

  const handleChange = (field: keyof ExternalEvaluationCreate, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const calculateMarks = () => {
    const percentages: Record<EvaluationRating, number> = {
      pending: 0,
      marginal: 20,
      adequate: 50,
      good: 75,
      excellent: 95
    };

    const calc = (rating: EvaluationRating, maxMarks: number) => 
      (percentages[rating] / 100) * maxMarks;

    const projectImpl = calc(formData.project_completion, 10) + 
                        calc(formData.code_quality, 10) + 
                        calc(formData.functionality, 10);
    
    const technical = calc(formData.understanding_of_technology, 10) + 
                      calc(formData.problem_solving, 10) + 
                      calc(formData.innovation, 5);
    
    const presentation = calc(formData.presentation_clarity, 10) + 
                         calc(formData.communication, 5) + 
                         calc(formData.time_management, 5);
    
    const documentation = calc(formData.documentation_completeness, 8) + 
                          calc(formData.documentation_quality, 7);
    
    const qa = calc(formData.qa_response, 10);

    return {
      projectImpl: Math.round(projectImpl * 10) / 10,
      technical: Math.round(technical * 10) / 10,
      presentation: Math.round(presentation * 10) / 10,
      documentation: Math.round(documentation * 10) / 10,
      qa: Math.round(qa * 10) / 10,
      total: Math.round((projectImpl + technical + presentation + documentation + qa) * 10) / 10
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSubmitting(true);
      
      if (existingEvaluation) {
        await apiService.updateExternalEvaluation(existingEvaluation.id, formData);
      } else {
        await apiService.createExternalEvaluation(formData);
      }
      
      alert('Evaluation saved successfully!');
      onComplete();
    } catch (error: any) {
      console.error('Failed to save evaluation:', error);
      alert(error.response?.data?.message || 'Failed to save evaluation. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const marks = calculateMarks();

  const renderRatingSelect = (
    label: string,
    field: keyof ExternalEvaluationCreate,
    maxMarks: number
  ) => (
    <div className="rating-field">
      <label>
        {label} <span className="max-marks">({maxMarks} marks)</span>
      </label>
      <select
        value={formData[field] as string}
        onChange={(e) => handleChange(field, e.target.value)}
        disabled={submitting}
      >
        {RATING_OPTIONS.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label} ({opt.description})
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="external-evaluation-form">
      <div className="form-header">
        <h2>External Evaluation Form</h2>
        <button className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>

      {assignment && (
        <div className="assignment-info">
          <h3>Student Group</h3>
          <p><strong>Students:</strong> {assignment.student_group.student_1.name}
            {assignment.student_group.student_2 && ` & ${assignment.student_group.student_2.name}`}
          </p>
          <p><strong>Project:</strong> {assignment.project_info.name}</p>
          <p><strong>Supervisor:</strong> {assignment.supervisor_info.name}</p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Project Implementation (30 marks) */}
        <fieldset className="evaluation-section">
          <legend>
            Project Implementation 
            <span className="section-marks">{marks.projectImpl}/30</span>
          </legend>
          {renderRatingSelect('Project Completion', 'project_completion', 10)}
          {renderRatingSelect('Code Quality', 'code_quality', 10)}
          {renderRatingSelect('Functionality', 'functionality', 10)}
        </fieldset>

        {/* Technical Knowledge (25 marks) */}
        <fieldset className="evaluation-section">
          <legend>
            Technical Knowledge
            <span className="section-marks">{marks.technical}/25</span>
          </legend>
          {renderRatingSelect('Understanding of Technology', 'understanding_of_technology', 10)}
          {renderRatingSelect('Problem Solving', 'problem_solving', 10)}
          {renderRatingSelect('Innovation', 'innovation', 5)}
        </fieldset>

        {/* Presentation Skills (20 marks) */}
        <fieldset className="evaluation-section">
          <legend>
            Presentation Skills
            <span className="section-marks">{marks.presentation}/20</span>
          </legend>
          {renderRatingSelect('Presentation Clarity', 'presentation_clarity', 10)}
          {renderRatingSelect('Communication', 'communication', 5)}
          {renderRatingSelect('Time Management', 'time_management', 5)}
        </fieldset>

        {/* Documentation Quality (15 marks) */}
        <fieldset className="evaluation-section">
          <legend>
            Documentation Quality
            <span className="section-marks">{marks.documentation}/15</span>
          </legend>
          {renderRatingSelect('Documentation Completeness', 'documentation_completeness', 8)}
          {renderRatingSelect('Documentation Quality', 'documentation_quality', 7)}
        </fieldset>

        {/* Q&A Response (10 marks) */}
        <fieldset className="evaluation-section">
          <legend>
            Q&A Response
            <span className="section-marks">{marks.qa}/10</span>
          </legend>
          {renderRatingSelect('Q&A Response Quality', 'qa_response', 10)}
        </fieldset>

        {/* Total */}
        <div className="total-marks-display">
          <h3>Total Marks: <span className={marks.total >= 50 ? 'pass' : 'fail'}>{marks.total}/100</span></h3>
          <p>Grade: {marks.total >= 85 ? 'A' : marks.total >= 75 ? 'B+' : marks.total >= 65 ? 'B' : marks.total >= 55 ? 'C+' : marks.total >= 50 ? 'C' : 'F'}</p>
        </div>

        {/* Comments */}
        <fieldset className="evaluation-section">
          <legend>Comments</legend>
          <div className="comment-field">
            <label>Overall Comment</label>
            <textarea
              value={formData.overall_comment}
              onChange={(e) => handleChange('overall_comment', e.target.value)}
              rows={3}
              disabled={submitting}
            />
          </div>
          <div className="comment-field">
            <label>Strengths</label>
            <textarea
              value={formData.strengths}
              onChange={(e) => handleChange('strengths', e.target.value)}
              rows={2}
              disabled={submitting}
            />
          </div>
          <div className="comment-field">
            <label>Areas of Improvement</label>
            <textarea
              value={formData.areas_of_improvement}
              onChange={(e) => handleChange('areas_of_improvement', e.target.value)}
              rows={2}
              disabled={submitting}
            />
          </div>
        </fieldset>

        {/* Pass/Fail */}
        <div className="pass-fail-section">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={formData.is_pass}
              onChange={(e) => handleChange('is_pass', e.target.checked)}
              disabled={submitting}
            />
            Mark as PASS
          </label>
        </div>

        {/* Submit */}
        <div className="form-actions">
          <button 
            type="button" 
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </button>
          <button 
            type="submit" 
            className="btn btn-primary"
            disabled={submitting}
          >
            {submitting ? 'Saving...' : existingEvaluation ? 'Update Evaluation' : 'Submit Evaluation'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ExternalEvaluationForm;
```

### Acceptance Criteria
- [ ] Form renders all evaluation criteria
- [ ] Real-time marks calculation
- [ ] Grade display
- [ ] Submit/Update working

---

## Task 4.6: Create ExternalAssignmentCard Component

### File: `frontend/src/components/ExternalAssignmentCard.tsx`

```typescript
import React from 'react';
import type { ExternalGroupAssignment, ExternalEvaluation } from '../types';
import './ExternalAssignmentCard.css';

interface ExternalAssignmentCardProps {
  assignment: ExternalGroupAssignment;
  onEvaluate: (assignmentId: number, existingEvaluation?: ExternalEvaluation) => void;
  onViewDetails?: (assignment: ExternalGroupAssignment) => void;
}

const ExternalAssignmentCard: React.FC<ExternalAssignmentCardProps> = ({
  assignment,
  onEvaluate,
  onViewDetails
}) => {
  const { supervisor_group_details, evaluation, status, slot_time, slot_number } = assignment;
  
  const getStatusBadge = () => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      pending: { label: 'Pending', className: 'status-pending' },
      scheduled: { label: 'Scheduled', className: 'status-scheduled' },
      evaluated: { label: 'Evaluated', className: 'status-evaluated' },
      cancelled: { label: 'Cancelled', className: 'status-cancelled' }
    };
    const config = statusConfig[status] || statusConfig.pending;
    return <span className={`status-badge ${config.className}`}>{config.label}</span>;
  };

  const getGradeBadge = (grade: string) => {
    const gradeClass = `grade-${grade.replace('+', '-plus')}`;
    return <span className={`grade-badge ${gradeClass}`}>{grade}</span>;
  };

  return (
    <div className={`assignment-card ${status}`}>
      <div className="assignment-header">
        <div className="student-info">
          <h4>
            {supervisor_group_details?.group.student_1.name}
            {supervisor_group_details?.group.student_2 && 
              ` & ${supervisor_group_details.group.student_2.name}`}
          </h4>
          <p className="registration-no">
            {supervisor_group_details?.group.student_1.registration_no}
            {supervisor_group_details?.group.student_2 && 
              `, ${supervisor_group_details.group.student_2.registration_no}`}
          </p>
        </div>
        {getStatusBadge()}
      </div>

      <div className="assignment-details">
        {supervisor_group_details?.project && (
          <div className="detail-row">
            <span className="detail-label">Project:</span>
            <span className="detail-value">{supervisor_group_details.project.project_name}</span>
          </div>
        )}
        <div className="detail-row">
          <span className="detail-label">Supervisor:</span>
          <span className="detail-value">{supervisor_group_details?.supervisor.name}</span>
        </div>
        {slot_number && (
          <div className="detail-row">
            <span className="detail-label">Slot:</span>
            <span className="detail-value">#{slot_number}</span>
          </div>
        )}
        {slot_time && (
          <div className="detail-row">
            <span className="detail-label">Time:</span>
            <span className="detail-value">{slot_time}</span>
          </div>
        )}
      </div>

      {evaluation && (
        <div className="evaluation-summary">
          <div className="evaluation-row">
            <span>Total Marks:</span>
            <strong className={evaluation.total_marks >= 50 ? 'pass' : 'fail'}>
              {evaluation.total_marks}/100
            </strong>
          </div>
          <div className="evaluation-row">
            <span>Grade:</span>
            {getGradeBadge(evaluation.grade)}
          </div>
          <div className="evaluation-row">
            <span>Status:</span>
            <span className={`pass-fail ${evaluation.is_pass ? 'pass' : 'fail'}`}>
              {evaluation.is_pass ? 'PASS' : 'FAIL'}
            </span>
          </div>
        </div>
      )}

      <div className="assignment-actions">
        {onViewDetails && (
          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => onViewDetails(assignment)}
          >
            View Details
          </button>
        )}
        <button 
          className="btn btn-primary btn-sm"
          onClick={() => onEvaluate(assignment.id, evaluation || undefined)}
          disabled={status === 'cancelled'}
        >
          {evaluation ? 'Edit Evaluation' : 'Evaluate'}
        </button>
      </div>
    </div>
  );
};

export default ExternalAssignmentCard;
```

### File: `frontend/src/components/ExternalAssignmentCard.css`

```css
/* External Assignment Card Styles */

.assignment-card {
  background: var(--bg-secondary);
  border-radius: 10px;
  border: 1px solid var(--border-color);
  padding: 16px;
  transition: box-shadow 0.2s, border-color 0.2s;
}

.assignment-card:hover {
  box-shadow: var(--card-shadow-hover);
}

.assignment-card.evaluated {
  border-left: 4px solid var(--success-color);
}

.assignment-card.pending {
  border-left: 4px solid var(--warning-color);
}

.assignment-card.scheduled {
  border-left: 4px solid var(--primary-color);
}

.assignment-card.cancelled {
  border-left: 4px solid var(--danger-color);
  opacity: 0.7;
}

/* Header */
.assignment-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color);
}

.student-info h4 {
  margin: 0 0 4px 0;
  font-size: 16px;
  color: var(--text-primary);
}

.student-info .registration-no {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
  font-family: monospace;
}

/* Status Badge */
.status-badge {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
}

.status-badge.status-pending {
  background: rgba(234, 179, 8, 0.1);
  color: #b45309;
}

.status-badge.status-scheduled {
  background: rgba(59, 130, 246, 0.1);
  color: #1d4ed8;
}

.status-badge.status-evaluated {
  background: rgba(16, 185, 129, 0.1);
  color: #047857;
}

.status-badge.status-cancelled {
  background: rgba(239, 68, 68, 0.1);
  color: #b91c1c;
}

/* Details */
.assignment-details {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
}

.detail-label {
  color: var(--text-secondary);
}

.detail-value {
  color: var(--text-primary);
  font-weight: 500;
  text-align: right;
  max-width: 60%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Evaluation Summary */
.evaluation-summary {
  background: var(--bg-tertiary);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
}

.evaluation-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
  margin-bottom: 6px;
}

.evaluation-row:last-child {
  margin-bottom: 0;
}

.evaluation-row span:first-child {
  color: var(--text-secondary);
}

.evaluation-row strong.pass {
  color: var(--success-color);
}

.evaluation-row strong.fail {
  color: var(--danger-color);
}

/* Grade Badge */
.grade-badge {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 700;
  color: white;
}

.grade-badge.grade-A { background: #10b981; }
.grade-badge.grade-B-plus { background: #22c55e; }
.grade-badge.grade-B { background: #84cc16; }
.grade-badge.grade-C-plus { background: #eab308; }
.grade-badge.grade-C { background: #f59e0b; }
.grade-badge.grade-F { background: #ef4444; }

.pass-fail {
  font-weight: 600;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
}

.pass-fail.pass {
  background: rgba(16, 185, 129, 0.1);
  color: var(--success-color);
}

.pass-fail.fail {
  background: rgba(239, 68, 68, 0.1);
  color: var(--danger-color);
}

/* Actions */
.assignment-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-color);
}

.btn-sm {
  padding: 6px 12px;
  font-size: 13px;
}

/* Responsive */
@media (max-width: 480px) {
  .assignment-header {
    flex-direction: column;
    gap: 8px;
  }
  
  .detail-value {
    max-width: 50%;
  }
  
  .assignment-actions {
    flex-direction: column;
  }
  
  .assignment-actions .btn {
    width: 100%;
  }
}
```

### Acceptance Criteria
- [ ] Card displays student info and project details
- [ ] Status badge shows current state
- [ ] Evaluation summary shown when available
- [ ] Action buttons functional

---

## Task 4.7: Update Routing for External Examiner

### File: `frontend/src/App.tsx`

```typescript
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import ErrorBoundary from './components/ErrorBoundary';
import LoginPage from './pages/LoginPage';
import StudentDashboard from './pages/StudentDashboard';
import SupervisorDashboard from './pages/SupervisorDashboard';
import CommitteeMemberDashboard from './pages/CommitteeMemberDashboard';
import ExternalDashboard from './pages/ExternalDashboard';
import './App.css';

const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedTypes: string[] }> = ({
  children,
  allowedTypes,
}) => {
  const { userType, loading } = useAuth();

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!userType || !allowedTypes.includes(userType)) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const AppRoutes: React.FC = () => {
  const { userType, loading } = useAuth();

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={userType ? <Navigate to={`/${userType}/dashboard`} replace /> : <LoginPage />}
      />
      <Route
        path="/student/dashboard"
        element={
          <ProtectedRoute allowedTypes={['student']}>
            <StudentDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/supervisor/dashboard"
        element={
          <ProtectedRoute allowedTypes={['supervisor']}>
            <SupervisorDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/committee_member/dashboard"
        element={
          <ProtectedRoute allowedTypes={['committee_member']}>
            <CommitteeMemberDashboard />
          </ProtectedRoute>
        }
      />
      {/* External Examiner Route */}
      <Route
        path="/external_examiner/dashboard"
        element={
          <ProtectedRoute allowedTypes={['external_examiner']}>
            <ExternalDashboard />
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <Router>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </Router>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;
```

### File: `frontend/src/contexts/AuthContext.tsx` (Update)

Add external examiner login support:

```typescript
// Add to existing AuthContext

const externalLogin = async (email: string, password: string) => {
  try {
    setLoading(true);
    const response = await apiService.externalExaminerLogin(email, password);
    localStorage.setItem('access_token', response.access);
    localStorage.setItem('refresh_token', response.refresh);
    localStorage.setItem('user_type', 'external_examiner');
    setUserType('external_examiner');
    
    const profile = await apiService.getExternalProfile();
    setUser(profile);
    
    return { success: true };
  } catch (error: any) {
    return { 
      success: false, 
      error: error.response?.data?.message || 'Login failed' 
    };
  } finally {
    setLoading(false);
  }
};

// Add to context value
const value = {
  user,
  userType,
  loading,
  studentLogin,
  supervisorLogin,
  committeeMemberLogin,
  externalLogin, // Add this
  logout,
};
```

### File: `frontend/src/pages/LoginPage.tsx` (Update)

Add external examiner tab:

```typescript
// Add to login tabs
<button
  className={`login-tab ${loginType === 'external' ? 'active' : ''}`}
  onClick={() => setLoginType('external')}
>
  External Examiner
</button>

// Add to form handling
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setError('');

  let result;
  switch (loginType) {
    case 'student':
      result = await studentLogin(identifier, password);
      break;
    case 'supervisor':
      result = await supervisorLogin(identifier, password);
      break;
    case 'committee':
      result = await committeeMemberLogin(identifier, password);
      break;
    case 'external':
      result = await externalLogin(identifier, password);
      break;
  }

  if (!result.success) {
    setError(result.error || 'Login failed');
  }
};
```

### Acceptance Criteria
- [ ] External examiner route accessible
- [ ] Login redirects to correct dashboard
- [ ] Protected route works for external_examiner type
- [ ] Logout redirects to login page

---

## Task 4.8: Update StudentDashboard for External Evaluation View

### File: `frontend/src/pages/StudentDashboard.tsx` (Partial Update)

Add external evaluation tab and view:

```typescript
// Add to imports
import ExternalEvaluationView from '../components/ExternalEvaluationView';

// Add to state
const [externalEvaluation, setExternalEvaluation] = useState<ExternalEvaluation | null>(null);
const [externalLoading, setExternalLoading] = useState(false);

// Add function to load external evaluation
const loadExternalEvaluation = async () => {
  try {
    setExternalLoading(true);
    const evaluation = await apiService.getStudentExternalEvaluation();
    setExternalEvaluation(evaluation);
  } catch (error) {
    console.error('Failed to load external evaluation:', error);
    setExternalEvaluation(null);
  } finally {
    setExternalLoading(false);
  }
};

// Add useEffect for external tab
useEffect(() => {
  if (activeTab === 'external' && profile?.semester === '8') {
    loadExternalEvaluation();
  }
}, [activeTab, profile?.semester]);

// Add tab button (show only for 8th semester)
{profile?.semester === '8' && (
  <button
    className={`tab ${activeTab === 'external' ? 'active' : ''}`}
    onClick={() => setActiveTab('external')}
  >
    External Evaluation
  </button>
)}

// Add tab content
{activeTab === 'external' && profile?.semester === '8' && (
  <div className="card">
    <h2>External Evaluation Results</h2>
    {externalLoading ? (
      <div className="loading-state">
        <div className="loading-spinner"></div>
        <p>Loading evaluation...</p>
      </div>
    ) : externalEvaluation ? (
      <ExternalEvaluationView evaluation={externalEvaluation} />
    ) : (
      <div className="empty-state">
        <p>No external evaluation available yet.</p>
        <p className="hint">Your external evaluation will appear here once completed.</p>
      </div>
    )}
  </div>
)}
```

### File: `frontend/src/components/ExternalEvaluationView.tsx`

```typescript
import React from 'react';
import type { ExternalEvaluation } from '../types';
import './ExternalEvaluationView.css';

interface ExternalEvaluationViewProps {
  evaluation: ExternalEvaluation;
}

const ExternalEvaluationView: React.FC<ExternalEvaluationViewProps> = ({ evaluation }) => {
  const getGradeClass = (grade: string) => `grade-${grade.replace('+', '-plus')}`;

  const renderCriteriaRow = (label: string, value: number, maxMarks: number) => {
    const percentage = (value / 100) * maxMarks;
    return (
      <div className="criteria-row">
        <span className="criteria-label">{label}</span>
        <div className="criteria-bar">
          <div 
            className="criteria-fill" 
            style={{ width: `${value}%` }}
          />
        </div>
        <span className="criteria-value">{percentage.toFixed(1)}/{maxMarks}</span>
      </div>
    );
  };

  return (
    <div className="external-evaluation-view">
      {/* Summary Card */}
      <div className="evaluation-summary-card">
        <div className="summary-main">
          <div className="total-marks">
            <span className="label">Total Marks</span>
            <span className={`value ${evaluation.is_pass ? 'pass' : 'fail'}`}>
              {evaluation.total_marks}/100
            </span>
          </div>
          <div className="grade-display">
            <span className="label">Grade</span>
            <span className={`grade ${getGradeClass(evaluation.grade)}`}>
              {evaluation.grade}
            </span>
          </div>
          <div className="pass-status">
            <span className={`status-badge ${evaluation.is_pass ? 'pass' : 'fail'}`}>
              {evaluation.is_pass ? 'PASSED' : 'FAILED'}
            </span>
          </div>
        </div>
        {evaluation.evaluated_at && (
          <p className="evaluated-date">
            Evaluated on: {new Date(evaluation.evaluated_at).toLocaleDateString()}
          </p>
        )}
      </div>

      {/* Detailed Breakdown */}
      <div className="evaluation-breakdown">
        {/* Project Implementation */}
        <div className="breakdown-section">
          <h4>
            Project Implementation
            <span className="section-total">{evaluation.project_implementation_marks}/30</span>
          </h4>
          {renderCriteriaRow('Project Completion', evaluation.project_completion, 10)}
          {renderCriteriaRow('Code Quality', evaluation.code_quality, 10)}
          {renderCriteriaRow('Functionality', evaluation.functionality, 10)}
        </div>

        {/* Technical Knowledge */}
        <div className="breakdown-section">
          <h4>
            Technical Knowledge
            <span className="section-total">{evaluation.technical_knowledge_marks}/25</span>
          </h4>
          {renderCriteriaRow('Understanding of Technology', evaluation.understanding_of_technology, 10)}
          {renderCriteriaRow('Problem Solving', evaluation.problem_solving, 10)}
          {renderCriteriaRow('Innovation', evaluation.innovation, 5)}
        </div>

        {/* Presentation Skills */}
        <div className="breakdown-section">
          <h4>
            Presentation Skills
            <span className="section-total">{evaluation.presentation_marks}/20</span>
          </h4>
          {renderCriteriaRow('Presentation Clarity', evaluation.presentation_clarity, 10)}
          {renderCriteriaRow('Communication', evaluation.communication, 5)}
          {renderCriteriaRow('Time Management', evaluation.time_management, 5)}
        </div>

        {/* Documentation */}
        <div className="breakdown-section">
          <h4>
            Documentation Quality
            <span className="section-total">{evaluation.documentation_marks}/15</span>
          </h4>
          {renderCriteriaRow('Completeness', evaluation.documentation_completeness, 8)}
          {renderCriteriaRow('Quality', evaluation.documentation_quality, 7)}
        </div>

        {/* Q&A */}
        <div className="breakdown-section">
          <h4>
            Q&A Response
            <span className="section-total">{evaluation.qa_marks}/10</span>
          </h4>
          {renderCriteriaRow('Response Quality', evaluation.qa_response, 10)}
        </div>
      </div>

      {/* Comments */}
      {(evaluation.overall_comment || evaluation.strengths || evaluation.areas_of_improvement) && (
        <div className="evaluation-comments">
          <h3>Examiner Comments</h3>
          
          {evaluation.overall_comment && (
            <div className="comment-block">
              <h4>Overall Assessment</h4>
              <p>{evaluation.overall_comment}</p>
            </div>
          )}
          
          {evaluation.strengths && (
            <div className="comment-block strengths">
              <h4>Strengths</h4>
              <p>{evaluation.strengths}</p>
            </div>
          )}
          
          {evaluation.areas_of_improvement && (
            <div className="comment-block improvements">
              <h4>Areas for Improvement</h4>
              <p>{evaluation.areas_of_improvement}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ExternalEvaluationView;
```

### File: `frontend/src/components/ExternalEvaluationView.css`

```css
/* External Evaluation View Styles */

.external-evaluation-view {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* Summary Card */
.evaluation-summary-card {
  background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-color-dark) 100%);
  border-radius: 12px;
  padding: 24px;
  color: white;
}

.summary-main {
  display: flex;
  justify-content: space-around;
  align-items: center;
  flex-wrap: wrap;
  gap: 20px;
}

.total-marks, .grade-display, .pass-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.total-marks .label,
.grade-display .label {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 1px;
  opacity: 0.9;
}

.total-marks .value {
  font-size: 36px;
  font-weight: 700;
}

.total-marks .value.pass {
  color: #a7f3d0;
}

.total-marks .value.fail {
  color: #fca5a5;
}

.grade-display .grade {
  font-size: 32px;
  font-weight: 700;
  padding: 8px 20px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.2);
}

.grade.grade-A { background: #10b981; }
.grade.grade-B-plus { background: #22c55e; }
.grade.grade-B { background: #84cc16; }
.grade.grade-C-plus { background: #eab308; }
.grade.grade-C { background: #f59e0b; }
.grade.grade-F { background: #ef4444; }

.status-badge {
  padding: 8px 20px;
  border-radius: 20px;
  font-weight: 700;
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.status-badge.pass {
  background: rgba(16, 185, 129, 0.3);
  border: 2px solid #10b981;
}

.status-badge.fail {
  background: rgba(239, 68, 68, 0.3);
  border: 2px solid #ef4444;
}

.evaluated-date {
  text-align: center;
  margin-top: 16px;
  font-size: 13px;
  opacity: 0.8;
}

/* Breakdown Section */
.evaluation-breakdown {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}

.breakdown-section {
  background: var(--bg-secondary);
  border-radius: 10px;
  padding: 16px;
  border: 1px solid var(--border-color);
}

.breakdown-section h4 {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 0 0 16px 0;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color);
  color: var(--text-primary);
  font-size: 15px;
}

.section-total {
  font-weight: 700;
  color: var(--primary-color);
}

/* Criteria Row */
.criteria-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.criteria-row:last-child {
  margin-bottom: 0;
}

.criteria-label {
  flex: 0 0 140px;
  font-size: 13px;
  color: var(--text-secondary);
}

.criteria-bar {
  flex: 1;
  height: 8px;
  background: var(--bg-tertiary);
  border-radius: 4px;
  overflow: hidden;
}

.criteria-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--primary-color), var(--success-color));
  border-radius: 4px;
  transition: width 0.3s ease;
}

.criteria-value {
  flex: 0 0 50px;
  text-align: right;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

/* Comments Section */
.evaluation-comments {
  background: var(--bg-secondary);
  border-radius: 10px;
  padding: 20px;
  border: 1px solid var(--border-color);
}

.evaluation-comments h3 {
  margin: 0 0 16px 0;
  color: var(--text-primary);
  font-size: 18px;
}

.comment-block {
  background: var(--bg-tertiary);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
}

.comment-block:last-child {
  margin-bottom: 0;
}

.comment-block h4 {
  margin: 0 0 8px 0;
  font-size: 14px;
  color: var(--text-secondary);
}

.comment-block p {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-primary);
}

.comment-block.strengths {
  border-left: 3px solid var(--success-color);
}

.comment-block.improvements {
  border-left: 3px solid var(--warning-color);
}

/* Responsive */
@media (max-width: 768px) {
  .summary-main {
    flex-direction: column;
  }
  
  .total-marks .value {
    font-size: 28px;
  }
  
  .grade-display .grade {
    font-size: 24px;
  }
  
  .evaluation-breakdown {
    grid-template-columns: 1fr;
  }
  
  .criteria-label {
    flex: 0 0 100px;
    font-size: 12px;
  }
}
```

### Acceptance Criteria
- [ ] External tab visible for 8th semester students
- [ ] Evaluation results displayed with detailed breakdown
- [ ] Grade and pass/fail status clearly shown
- [ ] Comments section displays examiner feedback

---

## Task 4.9: Update CommitteeMemberDashboard for External Management

### File: `frontend/src/pages/CommitteeMemberDashboard.tsx` (Partial Update)

Add external management tab:

```typescript
// Add to imports
import ExternalManagement from '../components/ExternalManagement';

// Add tab button
<button
  className={`tab ${activeTab === 'external' ? 'active' : ''}`}
  onClick={() => setActiveTab('external')}
>
  External Management
</button>

// Add tab content
{activeTab === 'external' && (
  <ExternalManagement />
)}
```

### File: `frontend/src/components/ExternalManagement.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import type { 
  ExternalExaminerListItem, 
  ExternalGroup, 
  ExternalGroupCreate,
  SupervisorOfStudentGroup 
} from '../types';
import './ExternalManagement.css';

const ExternalManagement: React.FC = () => {
  const [activeView, setActiveView] = useState<'examiners' | 'groups' | 'assignments'>('examiners');
  const [examiners, setExaminers] = useState<ExternalExaminerListItem[]>([]);
  const [groups, setGroups] = useState<ExternalGroup[]>([]);
  const [availableGroups, setAvailableGroups] = useState<SupervisorOfStudentGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [selectedExaminer, setSelectedExaminer] = useState<number | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<ExternalGroup | null>(null);

  // Form state for creating group
  const [groupForm, setGroupForm] = useState<ExternalGroupCreate>({
    name: '',
    semester: '8',
    max_groups: 10,
    evaluation_date: '',
    evaluation_venue: '',
    notes: ''
  });

  useEffect(() => {
    loadData();
  }, [activeView]);

  const loadData = async () => {
    try {
      setLoading(true);
      if (activeView === 'examiners') {
        const response = await apiService.getExternalExaminers();
        setExaminers(response.results || []);
      } else if (activeView === 'groups') {
        const response = await apiService.getExternalGroups();
        setGroups(response.results || []);
      } else if (activeView === 'assignments') {
        const [groupsRes, availableRes] = await Promise.all([
          apiService.getExternalGroups(),
          apiService.getAvailableGroupsForExternal()
        ]);
        setGroups(groupsRes.results || []);
        setAvailableGroups(availableRes.results || []);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExaminer) {
      alert('Please select an external examiner');
      return;
    }
    
    try {
      await apiService.createExternalGroup({
        ...groupForm,
        external_examiner: selectedExaminer
      } as any);
      alert('External group created successfully!');
      setShowCreateGroup(false);
      setGroupForm({
        name: '',
        semester: '8',
        max_groups: 10,
        evaluation_date: '',
        evaluation_venue: '',
        notes: ''
      });
      setSelectedExaminer(null);
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to create group');
    }
  };

  const handleAssignStudentGroup = async (externalGroupId: number, supervisorGroupId: number) => {
    try {
      await apiService.createExternalAssignment({
        external_group: externalGroupId,
        supervisor_group: supervisorGroupId
      });
      alert('Student group assigned successfully!');
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to assign group');
    }
  };

  const handleDeleteGroup = async (groupId: number) => {
    if (!confirm('Are you sure you want to delete this external group?')) return;
    
    try {
      await apiService.deleteExternalGroup(groupId);
      alert('Group deleted successfully!');
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to delete group');
    }
  };

  return (
    <div className="external-management">
      <div className="management-header">
        <h2>External Examiner Management</h2>
        <div className="view-tabs">
          <button 
            className={activeView === 'examiners' ? 'active' : ''}
            onClick={() => setActiveView('examiners')}
          >
            Examiners
          </button>
          <button 
            className={activeView === 'groups' ? 'active' : ''}
            onClick={() => setActiveView('groups')}
          >
            External Groups
          </button>
          <button 
            className={activeView === 'assignments' ? 'active' : ''}
            onClick={() => setActiveView('assignments')}
          >
            Assignments
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading...</p>
        </div>
      ) : (
        <>
          {/* Examiners View */}
          {activeView === 'examiners' && (
            <div className="examiners-list">
              <div className="list-header">
                <h3>External Examiners ({examiners.length})</h3>
              </div>
              {examiners.length === 0 ? (
                <div className="empty-state">
                  <p>No external examiners found.</p>
                </div>
              ) : (
                <div className="examiners-grid">
                  {examiners.map(examiner => (
                    <div key={examiner.id} className="examiner-card">
                      <div className="examiner-info">
                        <h4>{examiner.full_name}</h4>
                        <p className="external-id">{examiner.external_id}</p>
                        <p>{examiner.email}</p>
                        <p>{examiner.designation} at {examiner.institution}</p>
                        {examiner.specialization && (
                          <p className="specialization">{examiner.specialization}</p>
                        )}
                      </div>
                      <div className="examiner-stats">
                        <span className={`status ${examiner.is_active ? 'active' : 'inactive'}`}>
                          {examiner.is_active ? 'Active' : 'Inactive'}
                        </span>
                        <span className="groups-count">{examiner.groups_count} groups</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Groups View */}
          {activeView === 'groups' && (
            <div className="groups-view">
              <div className="list-header">
                <h3>External Groups ({groups.length})</h3>
                <button 
                  className="btn btn-primary"
                  onClick={() => setShowCreateGroup(true)}
                >
                  Create New Group
                </button>
              </div>

              {showCreateGroup && (
                <div className="create-group-form">
                  <h4>Create External Group</h4>
                  <form onSubmit={handleCreateGroup}>
                    <div className="form-group">
                      <label>External Examiner *</label>
                      <select 
                        value={selectedExaminer || ''} 
                        onChange={(e) => setSelectedExaminer(Number(e.target.value))}
                        required
                      >
                        <option value="">Select examiner...</option>
                        {examiners.map(ex => (
                          <option key={ex.id} value={ex.id}>
                            {ex.full_name} ({ex.institution})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Group Name *</label>
                      <input
                        type="text"
                        value={groupForm.name}
                        onChange={(e) => setGroupForm({...groupForm, name: e.target.value})}
                        placeholder="e.g., External Batch 2026-A"
                        required
                      />
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Semester</label>
                        <select
                          value={groupForm.semester}
                          onChange={(e) => setGroupForm({...groupForm, semester: e.target.value})}
                        >
                          <option value="7">7th Semester</option>
                          <option value="8">8th Semester</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Max Groups</label>
                        <input
                          type="number"
                          min="1"
                          max="50"
                          value={groupForm.max_groups}
                          onChange={(e) => setGroupForm({...groupForm, max_groups: Number(e.target.value)})}
                        />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Evaluation Date</label>
                        <input
                          type="date"
                          value={groupForm.evaluation_date}
                          onChange={(e) => setGroupForm({...groupForm, evaluation_date: e.target.value})}
                        />
                      </div>
                      <div className="form-group">
                        <label>Venue</label>
                        <input
                          type="text"
                          value={groupForm.evaluation_venue}
                          onChange={(e) => setGroupForm({...groupForm, evaluation_venue: e.target.value})}
                          placeholder="e.g., Room 101"
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Notes</label>
                      <textarea
                        value={groupForm.notes}
                        onChange={(e) => setGroupForm({...groupForm, notes: e.target.value})}
                        rows={2}
                        placeholder="Additional notes..."
                      />
                    </div>
                    <div className="form-actions">
                      <button type="button" className="btn btn-secondary" onClick={() => setShowCreateGroup(false)}>
                        Cancel
                      </button>
                      <button type="submit" className="btn btn-primary">
                        Create Group
                      </button>
                    </div>
                  </form>
                </div>
              )}

              <div className="groups-list">
                {groups.length === 0 ? (
                  <div className="empty-state">
                    <p>No external groups created yet.</p>
                  </div>
                ) : (
                  groups.map(group => (
                    <div key={group.id} className="group-card">
                      <div className="group-header">
                        <h4>{group.name}</h4>
                        <span className={`status-badge status-${group.status}`}>
                          {group.status}
                        </span>
                      </div>
                      <div className="group-details">
                        <p><strong>Examiner:</strong> {group.external_examiner_name}</p>
                        <p><strong>Semester:</strong> {group.semester}</p>
                        {group.evaluation_date && (
                          <p><strong>Date:</strong> {new Date(group.evaluation_date).toLocaleDateString()}</p>
                        )}
                        {group.evaluation_venue && (
                          <p><strong>Venue:</strong> {group.evaluation_venue}</p>
                        )}
                        <p><strong>Capacity:</strong> {group.assignments_count || 0}/{group.max_groups}</p>
                      </div>
                      <div className="group-actions">
                        <button 
                          className="btn btn-secondary btn-sm"
                          onClick={() => setSelectedGroup(group)}
                        >
                          View Assignments
                        </button>
                        <button 
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDeleteGroup(group.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Assignments View */}
          {activeView === 'assignments' && (
            <div className="assignments-view">
              <div className="assignments-grid">
                <div className="available-groups">
                  <h3>Available Student Groups ({availableGroups.length})</h3>
                  <div className="groups-scroll">
                    {availableGroups.length === 0 ? (
                      <p className="empty-hint">No available groups for assignment.</p>
                    ) : (
                      availableGroups.map(sg => (
                        <div key={sg.id} className="available-group-item">
                          <div className="group-info">
                            <strong>{sg.project?.project_name || 'No Project'}</strong>
                            <p>{sg.group?.student_1_details?.user?.username}
                              {sg.group?.student_2_details && ` & ${sg.group.student_2_details.user.username}`}
                            </p>
                            <p className="supervisor">Supervisor: {sg.supervisor?.user?.username}</p>
                          </div>
                          <select 
                            className="assign-select"
                            onChange={(e) => {
                              if (e.target.value) {
                                handleAssignStudentGroup(Number(e.target.value), sg.id);
                                e.target.value = '';
                              }
                            }}
                          >
                            <option value="">Assign to...</option>
                            {groups.filter(g => (g.assignments_count || 0) < g.max_groups).map(g => (
                              <option key={g.id} value={g.id}>
                                {g.name} ({g.assignments_count || 0}/{g.max_groups})
                              </option>
                            ))}
                          </select>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                
                <div className="external-groups-summary">
                  <h3>External Groups Summary</h3>
                  <div className="groups-scroll">
                    {groups.map(group => (
                      <div key={group.id} className="group-summary-card">
                        <h4>{group.name}</h4>
                        <p className="examiner">{group.external_examiner_name}</p>
                        <div className="capacity-bar">
                          <div 
                            className="capacity-fill"
                            style={{ 
                              width: `${((group.assignments_count || 0) / group.max_groups) * 100}%` 
                            }}
                          />
                        </div>
                        <p className="capacity-text">
                          {group.assignments_count || 0} / {group.max_groups} assigned
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ExternalManagement;
```

### File: `frontend/src/components/ExternalManagement.css`

```css
/* External Management Styles */

.external-management {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.management-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}

.management-header h2 {
  margin: 0;
  color: var(--text-primary);
}

.view-tabs {
  display: flex;
  gap: 8px;
}

.view-tabs button {
  padding: 8px 16px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.view-tabs button:hover {
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.view-tabs button.active {
  background: var(--primary-color);
  color: white;
  border-color: var(--primary-color);
}

/* List Header */
.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-color);
}

.list-header h3 {
  margin: 0;
  color: var(--text-primary);
}

/* Loading & Empty States */
.loading-state, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  text-align: center;
  color: var(--text-secondary);
}

/* Examiners Grid */
.examiners-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
  margin-top: 16px;
}

.examiner-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 16px;
}

.examiner-info h4 {
  margin: 0 0 4px 0;
  color: var(--text-primary);
}

.examiner-info .external-id {
  font-family: monospace;
  font-size: 13px;
  color: var(--primary-color);
  margin: 0 0 8px 0;
}

.examiner-info p {
  margin: 4px 0;
  font-size: 14px;
  color: var(--text-secondary);
}

.examiner-info .specialization {
  font-style: italic;
  color: var(--text-tertiary);
}

.examiner-stats {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-color);
}

.examiner-stats .status {
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 4px;
  font-weight: 600;
}

.examiner-stats .status.active {
  background: rgba(16, 185, 129, 0.1);
  color: var(--success-color);
}

.examiner-stats .status.inactive {
  background: rgba(239, 68, 68, 0.1);
  color: var(--danger-color);
}

.examiner-stats .groups-count {
  font-size: 13px;
  color: var(--text-secondary);
}

/* Create Group Form */
.create-group-form {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 20px;
  margin-bottom: 20px;
}

.create-group-form h4 {
  margin: 0 0 16px 0;
  color: var(--text-primary);
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 14px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
}

/* Groups List */
.groups-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 16px;
}

.group-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 16px;
}

.group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.group-header h4 {
  margin: 0;
  color: var(--text-primary);
}

.status-badge {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  text-transform: capitalize;
}

.status-badge.status-pending { background: rgba(234, 179, 8, 0.1); color: #b45309; }
.status-badge.status-scheduled { background: rgba(59, 130, 246, 0.1); color: #1d4ed8; }
.status-badge.status-completed { background: rgba(16, 185, 129, 0.1); color: #047857; }
.status-badge.status-cancelled { background: rgba(239, 68, 68, 0.1); color: #b91c1c; }

.group-details p {
  margin: 4px 0;
  font-size: 14px;
  color: var(--text-secondary);
}

.group-details strong {
  color: var(--text-primary);
}

.group-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-color);
}

/* Assignments View */
.assignments-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.available-groups, .external-groups-summary {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 16px;
}

.available-groups h3, .external-groups-summary h3 {
  margin: 0 0 16px 0;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color);
  color: var(--text-primary);
  font-size: 16px;
}

.groups-scroll {
  max-height: 500px;
  overflow-y: auto;
}

.available-group-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: var(--bg-tertiary);
  border-radius: 8px;
  margin-bottom: 8px;
}

.available-group-item .group-info strong {
  color: var(--text-primary);
  font-size: 14px;
}

.available-group-item .group-info p {
  margin: 4px 0 0 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.available-group-item .supervisor {
  font-size: 12px;
  color: var(--text-tertiary);
}

.assign-select {
  padding: 6px 10px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-primary);
  font-size: 13px;
  cursor: pointer;
}

.group-summary-card {
  padding: 12px;
  background: var(--bg-tertiary);
  border-radius: 8px;
  margin-bottom: 8px;
}

.group-summary-card h4 {
  margin: 0 0 4px 0;
  font-size: 14px;
  color: var(--text-primary);
}

.group-summary-card .examiner {
  margin: 0 0 8px 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.capacity-bar {
  height: 6px;
  background: var(--bg-primary);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 4px;
}

.capacity-fill {
  height: 100%;
  background: var(--primary-color);
  border-radius: 3px;
  transition: width 0.3s;
}

.capacity-text {
  margin: 0;
  font-size: 12px;
  color: var(--text-tertiary);
  text-align: right;
}

/* Responsive */
@media (max-width: 768px) {
  .management-header {
    flex-direction: column;
    align-items: stretch;
  }
  
  .view-tabs {
    flex-wrap: wrap;
  }
  
  .form-row {
    grid-template-columns: 1fr;
  }
  
  .assignments-grid {
    grid-template-columns: 1fr;
  }
  
  .examiners-grid {
    grid-template-columns: 1fr;
  }
}
```

### Acceptance Criteria
- [ ] View list of external examiners
- [ ] Create/delete external groups
- [ ] Assign student groups to external examiners
- [ ] View assignment status and capacity

---

## Task 4.10: Create ExternalScheduleView Component

### File: `frontend/src/components/ExternalScheduleView.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import type { EvaluationSchedule } from '../types';
import './ExternalScheduleView.css';

interface ExternalScheduleViewProps {
  userType?: 'external_examiner' | 'student' | 'committee_member';
}

const ExternalScheduleView: React.FC<ExternalScheduleViewProps> = ({ userType }) => {
  const [schedules, setSchedules] = useState<EvaluationSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [filter, setFilter] = useState({
    type: '',
    status: '',
    upcoming: 'true'
  });

  useEffect(() => {
    loadSchedules();
  }, [filter]);

  const loadSchedules = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (filter.type) params.type = filter.type;
      if (filter.status) params.status = filter.status;
      if (filter.upcoming) params.upcoming = filter.upcoming;
      
      const response = await apiService.getEvaluationSchedules(params);
      setSchedules(response.results || []);
    } catch (error) {
      console.error('Failed to load schedules:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      scheduled: 'var(--primary-color)',
      completed: 'var(--success-color)',
      postponed: 'var(--warning-color)',
      cancelled: 'var(--danger-color)'
    };
    return colors[status] || 'var(--text-secondary)';
  };

  const getTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      internal: '🏠',
      external: '🌐',
      final_defense: '🎓'
    };
    return icons[type] || '📋';
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const groupByDate = (schedules: EvaluationSchedule[]) => {
    const grouped: Record<string, EvaluationSchedule[]> = {};
    schedules.forEach(schedule => {
      const date = schedule.date;
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(schedule);
    });
    return grouped;
  };

  const renderListView = () => {
    const grouped = groupByDate(schedules);
    const dates = Object.keys(grouped).sort();

    return (
      <div className="schedule-list">
        {dates.map(date => (
          <div key={date} className="date-group">
            <div className="date-header">
              <span className="date-day">
                {new Date(date).toLocaleDateString('en-US', { weekday: 'long' })}
              </span>
              <span className="date-full">
                {new Date(date).toLocaleDateString('en-US', { 
                  month: 'long', 
                  day: 'numeric', 
                  year: 'numeric' 
                })}
              </span>
            </div>
            <div className="date-schedules">
              {grouped[date].map(schedule => (
                <div 
                  key={schedule.id} 
                  className="schedule-item"
                  style={{ borderLeftColor: getStatusColor(schedule.status) }}
                >
                  <div className="schedule-time">
                    <span className="time-start">{formatTime(schedule.start_time)}</span>
                    <span className="time-separator">-</span>
                    <span className="time-end">{formatTime(schedule.end_time)}</span>
                  </div>
                  <div className="schedule-details">
                    <h4>
                      {getTypeIcon(schedule.evaluation_type)} {schedule.title}
                    </h4>
                    <p className="venue">📍 {schedule.venue}</p>
                    {schedule.external_group_name && (
                      <p className="group-name">👥 {schedule.external_group_name}</p>
                    )}
                    {schedule.panel_name && (
                      <p className="panel-name">📋 {schedule.panel_name}</p>
                    )}
                    {schedule.notes && (
                      <p className="notes">{schedule.notes}</p>
                    )}
                  </div>
                  <div className="schedule-status">
                    <span 
                      className="status-badge"
                      style={{ 
                        backgroundColor: `${getStatusColor(schedule.status)}20`,
                        color: getStatusColor(schedule.status)
                      }}
                    >
                      {schedule.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderCalendarView = () => {
    // Simple calendar implementation
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const startPadding = firstDay.getDay();
    const totalDays = lastDay.getDate();
    
    const days = [];
    for (let i = 0; i < startPadding; i++) {
      days.push(null);
    }
    for (let i = 1; i <= totalDays; i++) {
      days.push(i);
    }

    const getSchedulesForDay = (day: number) => {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return schedules.filter(s => s.date === dateStr);
    };

    return (
      <div className="calendar-view">
        <div className="calendar-header">
          <h3>
            {new Date(currentYear, currentMonth).toLocaleDateString('en-US', { 
              month: 'long', 
              year: 'numeric' 
            })}
          </h3>
        </div>
        <div className="calendar-grid">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="calendar-day-header">{day}</div>
          ))}
          {days.map((day, index) => (
            <div 
              key={index} 
              className={`calendar-day ${day === today.getDate() ? 'today' : ''} ${day ? '' : 'empty'}`}
            >
              {day && (
                <>
                  <span className="day-number">{day}</span>
                  <div className="day-events">
                    {getSchedulesForDay(day).map(schedule => (
                      <div 
                        key={schedule.id}
                        className="calendar-event"
                        style={{ backgroundColor: getStatusColor(schedule.status) }}
                        title={`${schedule.title} - ${formatTime(schedule.start_time)}`}
                      >
                        {schedule.title.substring(0, 15)}...
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="external-schedule-view">
      <div className="schedule-header">
        <h2>Evaluation Schedule</h2>
        <div className="schedule-controls">
          <div className="view-toggle">
            <button 
              className={viewMode === 'list' ? 'active' : ''}
              onClick={() => setViewMode('list')}
            >
              📋 List
            </button>
            <button 
              className={viewMode === 'calendar' ? 'active' : ''}
              onClick={() => setViewMode('calendar')}
            >
              📅 Calendar
            </button>
          </div>
          <div className="filters">
            <select 
              value={filter.type}
              onChange={(e) => setFilter({...filter, type: e.target.value})}
            >
              <option value="">All Types</option>
              <option value="internal">Internal</option>
              <option value="external">External</option>
              <option value="final_defense">Final Defense</option>
            </select>
            <select 
              value={filter.status}
              onChange={(e) => setFilter({...filter, status: e.target.value})}
            >
              <option value="">All Status</option>
              <option value="scheduled">Scheduled</option>
              <option value="completed">Completed</option>
              <option value="postponed">Postponed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <label className="upcoming-toggle">
              <input 
                type="checkbox"
                checked={filter.upcoming === 'true'}
                onChange={(e) => setFilter({...filter, upcoming: e.target.checked ? 'true' : ''})}
              />
              Upcoming only
            </label>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading schedules...</p>
        </div>
      ) : schedules.length === 0 ? (
        <div className="empty-state">
          <p>No schedules found.</p>
          <p className="hint">Try adjusting your filters.</p>
        </div>
      ) : (
        viewMode === 'list' ? renderListView() : renderCalendarView()
      )}
    </div>
  );
};

export default ExternalScheduleView;
```

### File: `frontend/src/components/ExternalScheduleView.css`

```css
/* External Schedule View Styles */

.external-schedule-view {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.schedule-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 16px;
}

.schedule-header h2 {
  margin: 0;
  color: var(--text-primary);
}

.schedule-controls {
  display: flex;
  gap: 16px;
  align-items: center;
  flex-wrap: wrap;
}

.view-toggle {
  display: flex;
  background: var(--bg-secondary);
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--border-color);
}

.view-toggle button {
  padding: 8px 16px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.view-toggle button.active {
  background: var(--primary-color);
  color: white;
}

.filters {
  display: flex;
  gap: 12px;
  align-items: center;
}

.filters select {
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 14px;
}

.upcoming-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: var(--text-secondary);
  cursor: pointer;
}

/* List View */
.schedule-list {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.date-group {
  background: var(--bg-secondary);
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--border-color);
}

.date-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-color);
}

.date-day {
  font-weight: 600;
  color: var(--text-primary);
}

.date-full {
  font-size: 14px;
  color: var(--text-secondary);
}

.date-schedules {
  padding: 12px;
}

.schedule-item {
  display: flex;
  gap: 16px;
  padding: 16px;
  background: var(--bg-primary);
  border-radius: 8px;
  margin-bottom: 8px;
  border-left: 4px solid;
}

.schedule-item:last-child {
  margin-bottom: 0;
}

.schedule-time {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 80px;
  padding-right: 16px;
  border-right: 1px solid var(--border-color);
}

.time-start, .time-end {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.time-separator {
  font-size: 12px;
  color: var(--text-tertiary);
}

.schedule-details {
  flex: 1;
}

.schedule-details h4 {
  margin: 0 0 8px 0;
  color: var(--text-primary);
  font-size: 16px;
}

.schedule-details p {
  margin: 4px 0;
  font-size: 14px;
  color: var(--text-secondary);
}

.schedule-details .notes {
  font-style: italic;
  color: var(--text-tertiary);
}

.schedule-status {
  display: flex;
  align-items: flex-start;
}

.schedule-status .status-badge {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  text-transform: capitalize;
}

/* Calendar View */
.calendar-view {
  background: var(--bg-secondary);
  border-radius: 12px;
  border: 1px solid var(--border-color);
  overflow: hidden;
}

.calendar-header {
  padding: 16px 20px;
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-color);
}

.calendar-header h3 {
  margin: 0;
  color: var(--text-primary);
  text-align: center;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
}

.calendar-day-header {
  padding: 12px;
  text-align: center;
  font-weight: 600;
  font-size: 13px;
  color: var(--text-secondary);
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-color);
}

.calendar-day {
  min-height: 100px;
  padding: 8px;
  border-right: 1px solid var(--border-color);
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-primary);
}

.calendar-day:nth-child(7n) {
  border-right: none;
}

.calendar-day.empty {
  background: var(--bg-tertiary);
}

.calendar-day.today {
  background: rgba(var(--primary-color-rgb), 0.1);
}

.calendar-day.today .day-number {
  background: var(--primary-color);
  color: white;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.day-number {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.day-events {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.calendar-event {
  padding: 2px 4px;
  border-radius: 3px;
  font-size: 11px;
  color: white;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

/* Loading & Empty States */
.loading-state, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--border-color);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-state p {
  margin: 0;
  color: var(--text-secondary);
}

.empty-state .hint {
  font-size: 14px;
  color: var(--text-tertiary);
  margin-top: 8px;
}

/* Responsive */
@media (max-width: 768px) {
  .schedule-header {
    flex-direction: column;
  }
  
  .schedule-controls {
    width: 100%;
    flex-direction: column;
    align-items: stretch;
  }
  
  .filters {
    flex-direction: column;
  }
  
  .schedule-item {
    flex-direction: column;
  }
  
  .schedule-time {
    flex-direction: row;
    border-right: none;
    border-bottom: 1px solid var(--border-color);
    padding-right: 0;
    padding-bottom: 12px;
    margin-bottom: 12px;
    gap: 8px;
  }
  
  .calendar-day {
    min-height: 60px;
    padding: 4px;
  }
  
  .calendar-event {
    font-size: 9px;
  }
}
```

### Acceptance Criteria
- [ ] List view shows grouped schedules by date
- [ ] Calendar view displays monthly overview
- [ ] Filter by type, status, and upcoming
- [ ] Responsive design for mobile

---

## Task 4.11: Add External Notification Support

### File: `frontend/src/components/NotificationItem.tsx` (Update)

Add handling for external notification types:

```typescript
// Add to getNotificationIcon function
const getNotificationIcon = (type: NotificationType): string => {
  const icons: Record<NotificationType, string> = {
    group_request: '👥',
    group_request_accepted: '✅',
    group_request_rejected: '❌',
    supervisor_request: '👨‍🏫',
    supervisor_request_accepted: '✅',
    supervisor_request_rejected: '❌',
    new_chat_message: '💬',
    document_uploaded: '📄',
    document_approved: '✅',
    document_rejected: '❌',
    evaluation_completed: '📝',
    new_comment: '💭',
    external_assignment: '🌐',      // New
    external_evaluation: '📋',      // New
    external_schedule: '📅',        // New
    general: '🔔'
  };
  return icons[type] || '🔔';
};

// Add to getNotificationColor function
const getNotificationColor = (type: NotificationType): string => {
  const colors: Record<NotificationType, string> = {
    // ... existing colors
    external_assignment: 'var(--primary-color)',
    external_evaluation: 'var(--success-color)',
    external_schedule: 'var(--info-color)',
    general: 'var(--text-secondary)'
  };
  return colors[type] || 'var(--text-secondary)';
};

// Add to getActionUrl for navigation
const handleNotificationClick = (notification: Notification) => {
  // Mark as read
  apiService.markNotificationsAsRead([notification.id]);
  
  // Navigate based on type
  if (notification.action_url) {
    navigate(notification.action_url);
    return;
  }
  
  switch (notification.notification_type) {
    case 'external_assignment':
    case 'external_evaluation':
      if (userType === 'external_examiner') {
        navigate('/external_examiner/dashboard?tab=groups');
      } else if (userType === 'student') {
        navigate('/student/dashboard?tab=external');
      }
      break;
    case 'external_schedule':
      navigate(`/${userType}/dashboard?tab=schedule`);
      break;
    // ... other cases
  }
};
```

### File: `frontend/src/types/index.ts` (Already Updated)

The NotificationType already includes external types:

```typescript
export type NotificationType =
  | 'group_request'
  | 'group_request_accepted'
  | 'group_request_rejected'
  | 'supervisor_request'
  | 'supervisor_request_accepted'
  | 'supervisor_request_rejected'
  | 'new_chat_message'
  | 'document_uploaded'
  | 'document_approved'
  | 'document_rejected'
  | 'evaluation_completed'
  | 'new_comment'
  | 'external_assignment'    // External assignment notification
  | 'external_evaluation'    // External evaluation completed
  | 'external_schedule'      // Schedule update notification
  | 'general';
```

### Acceptance Criteria
- [ ] External notification types displayed correctly
- [ ] Appropriate icons for each type
- [ ] Navigation works for external notifications
- [ ] Read/unread status handled

---

## Task 4.12: Component Integration Checklist

### Files to Create/Update

| File | Action | Description |
|------|--------|-------------|
| `ExternalAssignmentCard.tsx` | Create | Assignment card component |
| `ExternalAssignmentCard.css` | Create | Assignment card styles |
| `ExternalEvaluationView.tsx` | Create | Student evaluation view |
| `ExternalEvaluationView.css` | Create | Evaluation view styles |
| `ExternalManagement.tsx` | Create | Committee management component |
| `ExternalManagement.css` | Create | Management styles |
| `ExternalScheduleView.tsx` | Create | Schedule component |
| `ExternalScheduleView.css` | Create | Schedule styles |
| `App.tsx` | Update | Add external route |
| `AuthContext.tsx` | Update | Add external login |
| `LoginPage.tsx` | Update | Add external tab |
| `StudentDashboard.tsx` | Update | Add external evaluation tab |
| `CommitteeMemberDashboard.tsx` | Update | Add external management tab |
| `NotificationItem.tsx` | Update | Handle external notifications |

### Export Index Update

### File: `frontend/src/components/index.ts` (Create if needed)

```typescript
// External Examiner Components
export { default as ExternalAssignmentCard } from './ExternalAssignmentCard';
export { default as ExternalEvaluationForm } from './ExternalEvaluationForm';
export { default as ExternalEvaluationView } from './ExternalEvaluationView';
export { default as ExternalGroupsList } from './ExternalGroupsList';
export { default as ExternalManagement } from './ExternalManagement';
export { default as ExternalScheduleView } from './ExternalScheduleView';
```

### Acceptance Criteria Summary

| Task | Component | Criteria |
|------|-----------|----------|
| 4.6 | ExternalAssignmentCard | Card displays info, status badge, actions work |
| 4.7 | Routing | External route accessible, login works |
| 4.8 | StudentDashboard | External tab for 8th sem, results displayed |
| 4.9 | CommitteeMemberDashboard | Management tab, CRUD operations work |
| 4.10 | ExternalScheduleView | List/calendar views, filters work |
| 4.11 | Notifications | External types handled, navigation works |
| 4.12 | Integration | All components exported and integrated |

---

## Completion Criteria

Phase 4 is complete when:
- [ ] All API service functions implemented
- [ ] All TypeScript types defined
- [ ] ExternalDashboard page created
- [ ] ExternalGroupsList component working
- [ ] ExternalEvaluationForm component working
- [ ] Routing updated for external examiner
- [ ] StudentDashboard updated for external view
- [ ] CommitteeMemberDashboard updated for external management
- [ ] All CSS styles created
- [ ] No TypeScript errors
- [ ] No runtime errors
- [ ] All features tested manually
