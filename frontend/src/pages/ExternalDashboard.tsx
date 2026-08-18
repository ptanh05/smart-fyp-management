import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import type { 
  ExternalDashboardData, 
  ExternalGroup,
  ExternalGroupAssignment
} from '../types';
import Navbar from '../components/Navbar';
import { SkeletonProfile, SkeletonCardGrid } from '../components/SkeletonLoader';
import './Dashboard.css';
import './ExternalDashboard.css';

const ExternalDashboard: React.FC = () => {
  const { logout } = useAuth();
  const [dashboardData, setDashboardData] = useState<ExternalDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'groups' | 'evaluations' | 'schedule'>('overview');
  const [selectedGroup, setSelectedGroup] = useState<ExternalGroup | null>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<ExternalGroupAssignment | null>(null);
  const [groupAssignments, setGroupAssignments] = useState<ExternalGroupAssignment[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiService.getExternalDashboard();
      setDashboardData(data);
    } catch (error: any) {
      console.error('Failed to load dashboard:', error);
      setError(error.response?.data?.detail || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const loadGroupAssignments = async (groupId: number) => {
    try {
      setLoadingAssignments(true);
      const assignments = await apiService.getExternalGroupStudents(groupId);
      setGroupAssignments(assignments);
    } catch (error) {
      console.error('Failed to load assignments:', error);
      setGroupAssignments([]);
    } finally {
      setLoadingAssignments(false);
    }
  };

  const handleSelectGroup = (group: ExternalGroup) => {
    setSelectedGroup(group);
    loadGroupAssignments(group.id);
  };

  const handleBackToGroups = () => {
    setSelectedGroup(null);
    setGroupAssignments([]);
  };

  const handleStartEvaluation = (assignment: ExternalGroupAssignment) => {
    setSelectedAssignment(assignment);
    setActiveTab('evaluations');
  };

  const handleEvaluationComplete = () => {
    setSelectedAssignment(null);
    loadDashboard();
    if (selectedGroup) {
      loadGroupAssignments(selectedGroup.id);
    }
  };

  if (loading) {
    return (
      <div className="dashboard">
        <Navbar user={null} onLogout={logout} />
        <div className="dashboard-content">
          <SkeletonProfile />
          <SkeletonCardGrid count={3} />
        </div>
      </div>
    );
  }

  if (error || !dashboardData) {
    return (
      <div className="dashboard">
        <Navbar user={null} onLogout={logout} />
        <div className="dashboard-content">
          <div className="card error-card">
            <h2>Error Loading Dashboard</h2>
            <p>{error || 'Failed to load your profile. Please try again.'}</p>
            <button className="btn btn-primary" onClick={loadDashboard}>
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { profile, statistics, upcoming_evaluations, recent_evaluations } = dashboardData;

  return (
    <div className="dashboard">
      <Navbar 
        user={{
          id: profile.id,
          user: profile.user,
          external_id: profile.external_id,
          institution: profile.institution,
          designation: profile.designation
        } as any} 
        onLogout={logout} 
      />
      
      <div className="dashboard-content">
        {/* Profile Header */}
        <div className="card profile-card">
          <div className="profile-header">
            <div className="profile-avatar external-avatar">
              {profile.user.first_name?.[0] || profile.user.username[0]}
            </div>
            <div className="profile-info-header">
              <h1>{profile.user.first_name} {profile.user.last_name}</h1>
              <p className="profile-subtitle">External Examiner</p>
              <div className="profile-meta-tags">
                <span className="meta-tag institution">{profile.institution}</span>
                <span className="meta-tag designation">
                  {profile.designation?.replace(/_/g, ' ').toUpperCase()}
                </span>
                {profile.specialization && (
                  <span className="meta-tag specialization">{profile.specialization}</span>
                )}
              </div>
            </div>
          </div>
          
          {/* Statistics */}
          <div className="stats-grid external-stats">
            <div className="stat-card">
              <span className="stat-value">{statistics.total_groups}</span>
              <span className="stat-label">Total Groups</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{statistics.total_students}</span>
              <span className="stat-label">Total Students</span>
            </div>
            <div className="stat-card stat-success">
              <span className="stat-value">{statistics.completed_evaluations}</span>
              <span className="stat-label">Completed</span>
            </div>
            <div className="stat-card stat-warning">
              <span className="stat-value">{statistics.pending_evaluations}</span>
              <span className="stat-label">Pending</span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="tab-navigation">
          <button
            className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => { setActiveTab('overview'); setSelectedGroup(null); }}
          >
            Overview
          </button>
          <button
            className={`tab-btn ${activeTab === 'groups' ? 'active' : ''}`}
            onClick={() => { setActiveTab('groups'); setSelectedAssignment(null); }}
          >
            My Groups ({statistics.total_groups})
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
                {statistics.pending_evaluations === 0 ? (
                  <p className="empty-state">All evaluations completed! Great job!</p>
                ) : (
                  <div className="pending-list">
                    {upcoming_evaluations.slice(0, 5).map(assignment => (
                      <div key={assignment.id} className="pending-item">
                        <div className="pending-info">
                          <span className="student-name">
                            {assignment.supervisor_group_details?.group?.student_1?.name || 'Unknown'}
                            {assignment.supervisor_group_details?.group?.student_2 && 
                              ` & ${assignment.supervisor_group_details.group.student_2.name}`}
                          </span>
                          <span className="project-name">
                            {assignment.supervisor_group_details?.project?.project_name || 'No Project'}
                          </span>
                        </div>
                        <button 
                          className="btn btn-sm btn-primary"
                          onClick={() => handleStartEvaluation(assignment)}
                        >
                          Evaluate
                        </button>
                      </div>
                    ))}
                    {upcoming_evaluations.length > 5 && (
                      <button 
                        className="btn btn-link"
                        onClick={() => setActiveTab('evaluations')}
                      >
                        View all ({upcoming_evaluations.length})
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Recent Evaluations */}
              <div className="card">
                <h3>Recent Evaluations</h3>
                {recent_evaluations.length === 0 ? (
                  <p className="empty-state">No evaluations completed yet</p>
                ) : (
                  <div className="recent-list">
                    {recent_evaluations.slice(0, 5).map(evaluation => (
                      <div key={evaluation.id} className="recent-item">
                        <div className="recent-info">
                          <span className="grade-badge grade-{evaluation.grade?.replace('+', 'plus')}">
                            {evaluation.grade}
                          </span>
                          <span className="marks">{Math.round(evaluation.total_marks)}/100</span>
                        </div>
                        <span className="date">
                          {evaluation.evaluated_at 
                            ? new Date(evaluation.evaluated_at).toLocaleDateString()
                            : 'N/A'}
                        </span>
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
                    onClick={() => setActiveTab('groups')}
                  >
                    View My Groups
                  </button>
                  <button 
                    className="btn btn-secondary"
                    onClick={() => setActiveTab('schedule')}
                  >
                    View Schedule
                  </button>
                  {statistics.pending_evaluations > 0 && (
                    <button 
                      className="btn btn-success"
                      onClick={() => setActiveTab('evaluations')}
                    >
                      Start Evaluating ({statistics.pending_evaluations})
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'groups' && (
          <div className="tab-content">
            {selectedGroup ? (
              <div className="group-detail-view">
                <button className="btn btn-back" onClick={handleBackToGroups}>
                  ← Back to Groups
                </button>
                <div className="card">
                  <div className="group-detail-header">
                    <h2>{selectedGroup.name}</h2>
                    <div className="group-meta">
                      <span className={`status-badge status-${selectedGroup.status}`}>
                        {selectedGroup.status}
                      </span>
                      <span>Semester: {selectedGroup.semester}</span>
                      {selectedGroup.evaluation_date && (
                        <span>Date: {new Date(selectedGroup.evaluation_date).toLocaleDateString()}</span>
                      )}
                      {selectedGroup.evaluation_venue && (
                        <span>Venue: {selectedGroup.evaluation_venue}</span>
                      )}
                    </div>
                  </div>
                  
                  <h3>Assigned Students ({groupAssignments.length})</h3>
                  {loadingAssignments ? (
                    <p>Loading students...</p>
                  ) : groupAssignments.length === 0 ? (
                    <p className="empty-state">No students assigned to this group yet.</p>
                  ) : (
                    <div className="assignments-list">
                      {groupAssignments.map(assignment => (
                        <div key={assignment.id} className="assignment-card">
                          <div className="assignment-info">
                            <div className="student-details">
                              <strong>
                                {assignment.supervisor_group_details?.group?.student_1?.name}
                                {assignment.supervisor_group_details?.group?.student_2 && 
                                  ` & ${assignment.supervisor_group_details.group.student_2.name}`}
                              </strong>
                              <span className="reg-no">
                                {assignment.supervisor_group_details?.group?.student_1?.registration_no}
                              </span>
                            </div>
                            <div className="project-details">
                              <span className="project-name">
                                {assignment.supervisor_group_details?.project?.project_name || 'No Project'}
                              </span>
                              <span className="supervisor-name">
                                Supervisor: {assignment.supervisor_group_details?.supervisor?.name}
                              </span>
                            </div>
                            {assignment.slot_number && (
                              <div className="slot-info">
                                <span>Slot #{assignment.slot_number}</span>
                                {assignment.slot_time && <span>{assignment.slot_time}</span>}
                              </div>
                            )}
                          </div>
                          <div className="assignment-actions">
                            {assignment.evaluation ? (
                              <div className="evaluation-status completed">
                                <span className={`grade-badge grade-${assignment.evaluation.grade?.replace('+', 'plus')}`}>
                                  {assignment.evaluation.grade}
                                </span>
                                <span>{Math.round(assignment.evaluation.total_marks)}/100</span>
                              </div>
                            ) : (
                              <button 
                                className="btn btn-primary"
                                onClick={() => handleStartEvaluation(assignment)}
                              >
                                Evaluate
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="external-groups-grid">
                {statistics.total_groups === 0 ? (
                  <div className="card">
                    <p className="empty-state">No groups assigned to you yet.</p>
                  </div>
                ) : (
                  upcoming_evaluations.length > 0 ? (
                    // Group assignments by external group
                    [...new Map(upcoming_evaluations.map(a => [a.external_group, a])).values()].map(assignment => (
                      <div 
                        key={assignment.external_group} 
                        className="card group-card clickable"
                        onClick={() => {
                          const group: ExternalGroup = {
                            id: assignment.external_group,
                            name: assignment.external_group_name || `Group ${assignment.external_group}`,
                            external_examiner: profile.id,
                            semester: '',
                            max_groups: 7,
                            status: 'scheduled',
                            created_at: ''
                          };
                          handleSelectGroup(group);
                        }}
                      >
                        <h3>{assignment.external_group_name || `Group ${assignment.external_group}`}</h3>
                        <p>Click to view students</p>
                      </div>
                    ))
                  ) : (
                    <div className="card">
                      <p className="empty-state">No pending evaluations in your groups.</p>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'evaluations' && (
          <div className="tab-content">
            {selectedAssignment ? (
              <ExternalEvaluationFormInline
                assignment={selectedAssignment}
                onComplete={handleEvaluationComplete}
                onCancel={() => setSelectedAssignment(null)}
              />
            ) : (
              <div className="card">
                <h3>Pending Evaluations</h3>
                {upcoming_evaluations.length === 0 ? (
                  <p className="empty-state">All evaluations completed! Great job!</p>
                ) : (
                  <div className="evaluations-list">
                    {upcoming_evaluations.map(assignment => (
                      <div key={assignment.id} className="evaluation-item">
                        <div className="evaluation-info">
                          <div className="student-info">
                            <strong>
                              {assignment.supervisor_group_details?.group?.student_1?.name}
                              {assignment.supervisor_group_details?.group?.student_2 && 
                                ` & ${assignment.supervisor_group_details.group.student_2.name}`}
                            </strong>
                            <span>
                              {assignment.supervisor_group_details?.group?.student_1?.registration_no}
                            </span>
                          </div>
                          <div className="project-info">
                            <span>{assignment.supervisor_group_details?.project?.project_name || 'No Project'}</span>
                            <span className="group-name">{assignment.external_group_name}</span>
                          </div>
                        </div>
                        <button 
                          className="btn btn-primary"
                          onClick={() => handleStartEvaluation(assignment)}
                        >
                          Start Evaluation
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {recent_evaluations.length > 0 && (
                  <>
                    <h3 style={{ marginTop: '30px' }}>Completed Evaluations</h3>
                    <div className="evaluations-list completed">
                      {recent_evaluations.map(evaluation => (
                        <div key={evaluation.id} className="evaluation-item completed">
                          <div className="evaluation-info">
                            <span className={`grade-badge grade-${evaluation.grade?.replace('+', 'plus')}`}>
                              {evaluation.grade}
                            </span>
                            <span className="marks">{Math.round(evaluation.total_marks)}/100</span>
                            <span className={`pass-status ${evaluation.is_pass ? 'pass' : 'fail'}`}>
                              {evaluation.is_pass ? 'PASS' : 'FAIL'}
                            </span>
                          </div>
                          <span className="date">
                            {evaluation.evaluated_at 
                              ? new Date(evaluation.evaluated_at).toLocaleDateString()
                              : 'N/A'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'schedule' && (
          <div className="tab-content">
            <div className="card">
              <h3>Evaluation Schedule</h3>
              <p className="empty-state">
                Schedule information will be displayed here once available.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Inline Evaluation Form Component
interface EvaluationFormProps {
  assignment: ExternalGroupAssignment;
  onComplete: () => void;
  onCancel: () => void;
}

const ExternalEvaluationFormInline: React.FC<EvaluationFormProps> = ({ 
  assignment, 
  onComplete, 
  onCancel 
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    // Project Implementation (30 marks)
    project_completion: 0,
    code_quality: 0,
    functionality: 0,
    // Technical Knowledge (25 marks)
    understanding_of_technology: 0,
    problem_solving: 0,
    innovation: 0,
    // Presentation Skills (20 marks)
    presentation_clarity: 0,
    communication: 0,
    time_management: 0,
    // Documentation Quality (15 marks)
    documentation_completeness: 0,
    documentation_quality: 0,
    // Q&A Response (10 marks)
    qa_response: 0,
    // Comments
    overall_comment: '',
    strengths: '',
    areas_of_improvement: ''
  });

  const calculateMarks = () => {
    const projectImplementation = formData.project_completion + formData.code_quality + formData.functionality;
    const technicalKnowledge = formData.understanding_of_technology + formData.problem_solving + formData.innovation;
    const presentationSkills = formData.presentation_clarity + formData.communication + formData.time_management;
    const documentation = formData.documentation_completeness + formData.documentation_quality;
    const qaResponse = formData.qa_response;
    
    return {
      projectImplementation,
      technicalKnowledge,
      presentationSkills,
      documentation,
      qaResponse,
      total: projectImplementation + technicalKnowledge + presentationSkills + documentation + qaResponse
    };
  };

  const getGrade = (total: number) => {
    if (total >= 85) return 'A';
    if (total >= 75) return 'B+';
    if (total >= 65) return 'B';
    if (total >= 55) return 'C+';
    if (total >= 50) return 'C';
    return 'F';
  };

  const handleInputChange = (field: string, value: number | string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      await apiService.createExternalEvaluation({
        assignment: assignment.id,
        ...formData
      });
      alert('Evaluation submitted successfully!');
      onComplete();
    } catch (error: any) {
      console.error('Failed to submit evaluation:', error);
      alert(error.response?.data?.detail || 'Failed to submit evaluation');
    } finally {
      setSubmitting(false);
    }
  };

  const marks = calculateMarks();
  const grade = getGrade(marks.total);

  return (
    <div className="card evaluation-form-card">
      <div className="evaluation-form-header">
        <button className="btn btn-back" onClick={onCancel}>
          ← Back
        </button>
        <h2>External Evaluation</h2>
      </div>
      
      <div className="student-being-evaluated">
        <h3>
          {assignment.supervisor_group_details?.group?.student_1?.name}
          {assignment.supervisor_group_details?.group?.student_2 && 
            ` & ${assignment.supervisor_group_details.group.student_2.name}`}
        </h3>
        <p>{assignment.supervisor_group_details?.project?.project_name || 'No Project'}</p>
      </div>

      <form onSubmit={handleSubmit} className="external-evaluation-form">
        {/* Project Implementation (30 marks) */}
        <div className="criteria-section">
          <h4>Project Implementation (30 marks)</h4>
          <div className="criteria-grid">
            <div className="criteria-item">
              <label>Project Completion (0-10)</label>
              <input 
                type="number" 
                min="0" 
                max="10"
                value={formData.project_completion}
                onChange={(e) => handleInputChange('project_completion', Math.min(10, Math.max(0, parseInt(e.target.value) || 0)))}
              />
            </div>
            <div className="criteria-item">
              <label>Code Quality (0-10)</label>
              <input 
                type="number" 
                min="0" 
                max="10"
                value={formData.code_quality}
                onChange={(e) => handleInputChange('code_quality', Math.min(10, Math.max(0, parseInt(e.target.value) || 0)))}
              />
            </div>
            <div className="criteria-item">
              <label>Functionality (0-10)</label>
              <input 
                type="number" 
                min="0" 
                max="10"
                value={formData.functionality}
                onChange={(e) => handleInputChange('functionality', Math.min(10, Math.max(0, parseInt(e.target.value) || 0)))}
              />
            </div>
          </div>
          <div className="section-total">Subtotal: {marks.projectImplementation}/30</div>
        </div>

        {/* Technical Knowledge (25 marks) */}
        <div className="criteria-section">
          <h4>Technical Knowledge (25 marks)</h4>
          <div className="criteria-grid">
            <div className="criteria-item">
              <label>Understanding of Technology (0-10)</label>
              <input 
                type="number" 
                min="0" 
                max="10"
                value={formData.understanding_of_technology}
                onChange={(e) => handleInputChange('understanding_of_technology', Math.min(10, Math.max(0, parseInt(e.target.value) || 0)))}
              />
            </div>
            <div className="criteria-item">
              <label>Problem Solving (0-10)</label>
              <input 
                type="number" 
                min="0" 
                max="10"
                value={formData.problem_solving}
                onChange={(e) => handleInputChange('problem_solving', Math.min(10, Math.max(0, parseInt(e.target.value) || 0)))}
              />
            </div>
            <div className="criteria-item">
              <label>Innovation (0-5)</label>
              <input 
                type="number" 
                min="0" 
                max="5"
                value={formData.innovation}
                onChange={(e) => handleInputChange('innovation', Math.min(5, Math.max(0, parseInt(e.target.value) || 0)))}
              />
            </div>
          </div>
          <div className="section-total">Subtotal: {marks.technicalKnowledge}/25</div>
        </div>

        {/* Presentation Skills (20 marks) */}
        <div className="criteria-section">
          <h4>Presentation Skills (20 marks)</h4>
          <div className="criteria-grid">
            <div className="criteria-item">
              <label>Presentation Clarity (0-8)</label>
              <input 
                type="number" 
                min="0" 
                max="8"
                value={formData.presentation_clarity}
                onChange={(e) => handleInputChange('presentation_clarity', Math.min(8, Math.max(0, parseInt(e.target.value) || 0)))}
              />
            </div>
            <div className="criteria-item">
              <label>Communication (0-7)</label>
              <input 
                type="number" 
                min="0" 
                max="7"
                value={formData.communication}
                onChange={(e) => handleInputChange('communication', Math.min(7, Math.max(0, parseInt(e.target.value) || 0)))}
              />
            </div>
            <div className="criteria-item">
              <label>Time Management (0-5)</label>
              <input 
                type="number" 
                min="0" 
                max="5"
                value={formData.time_management}
                onChange={(e) => handleInputChange('time_management', Math.min(5, Math.max(0, parseInt(e.target.value) || 0)))}
              />
            </div>
          </div>
          <div className="section-total">Subtotal: {marks.presentationSkills}/20</div>
        </div>

        {/* Documentation Quality (15 marks) */}
        <div className="criteria-section">
          <h4>Documentation Quality (15 marks)</h4>
          <div className="criteria-grid">
            <div className="criteria-item">
              <label>Documentation Completeness (0-8)</label>
              <input 
                type="number" 
                min="0" 
                max="8"
                value={formData.documentation_completeness}
                onChange={(e) => handleInputChange('documentation_completeness', Math.min(8, Math.max(0, parseInt(e.target.value) || 0)))}
              />
            </div>
            <div className="criteria-item">
              <label>Documentation Quality (0-7)</label>
              <input 
                type="number" 
                min="0" 
                max="7"
                value={formData.documentation_quality}
                onChange={(e) => handleInputChange('documentation_quality', Math.min(7, Math.max(0, parseInt(e.target.value) || 0)))}
              />
            </div>
          </div>
          <div className="section-total">Subtotal: {marks.documentation}/15</div>
        </div>

        {/* Q&A Response (10 marks) */}
        <div className="criteria-section">
          <h4>Q&A Response (10 marks)</h4>
          <div className="criteria-grid">
            <div className="criteria-item">
              <label>Q&A Response (0-10)</label>
              <input 
                type="number" 
                min="0" 
                max="10"
                value={formData.qa_response}
                onChange={(e) => handleInputChange('qa_response', Math.min(10, Math.max(0, parseInt(e.target.value) || 0)))}
              />
            </div>
          </div>
          <div className="section-total">Subtotal: {marks.qaResponse}/10</div>
        </div>

        {/* Total and Grade */}
        <div className="total-section">
          <div className="total-display">
            <span className="total-label">Total Marks:</span>
            <span className="total-value">{marks.total}/100</span>
          </div>
          <div className="grade-display">
            <span className="grade-label">Grade:</span>
            <span className={`grade-badge grade-${grade.replace('+', 'plus')}`}>{grade}</span>
          </div>
          <div className="pass-display">
            <span className={`pass-status ${marks.total >= 50 ? 'pass' : 'fail'}`}>
              {marks.total >= 50 ? 'PASS' : 'FAIL'}
            </span>
          </div>
        </div>

        {/* Comments */}
        <div className="comments-section">
          <h4>Comments</h4>
          <div className="comment-field">
            <label>Overall Comment</label>
            <textarea 
              value={formData.overall_comment}
              onChange={(e) => handleInputChange('overall_comment', e.target.value)}
              placeholder="Provide an overall assessment..."
              rows={3}
            />
          </div>
          <div className="comment-field">
            <label>Strengths</label>
            <textarea 
              value={formData.strengths}
              onChange={(e) => handleInputChange('strengths', e.target.value)}
              placeholder="What did the student do well?"
              rows={2}
            />
          </div>
          <div className="comment-field">
            <label>Areas of Improvement</label>
            <textarea 
              value={formData.areas_of_improvement}
              onChange={(e) => handleInputChange('areas_of_improvement', e.target.value)}
              placeholder="What could be improved?"
              rows={2}
            />
          </div>
        </div>

        {/* Submit Button */}
        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Evaluation'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ExternalDashboard;
