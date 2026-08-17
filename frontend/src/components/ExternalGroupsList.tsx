import React, { useState } from 'react';
import { apiService } from '../services/api';
import type { ExternalGroup, ExternalGroupAssignment } from '../types';
import './ExternalGroupsList.css';

interface ExternalGroupsListProps {
  groups: ExternalGroup[];
  onSelectGroup: (group: ExternalGroup) => void;
  onSelectAssignment?: (assignment: ExternalGroupAssignment) => void;
  onRefresh: () => void;
}

const ExternalGroupsList: React.FC<ExternalGroupsListProps> = ({
  groups,
  onSelectGroup,
  onSelectAssignment,
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
      setAssignments([]);
    } finally {
      setLoadingAssignments(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusClasses: Record<string, string> = {
      pending: 'badge-pending',
      scheduled: 'badge-info',
      in_progress: 'badge-warning',
      completed: 'badge-success',
      cancelled: 'badge-danger'
    };
    return statusClasses[status] || 'badge-default';
  };

  const handleEvaluate = (assignment: ExternalGroupAssignment, group: ExternalGroup) => {
    if (onSelectAssignment) {
      onSelectAssignment(assignment);
    } else {
      onSelectGroup(group);
    }
  };

  return (
    <div className="external-groups-list">
      <div className="list-header">
        <h3>My External Groups</h3>
        <button className="btn btn-secondary btn-sm" onClick={onRefresh}>
          <span className="refresh-icon">↻</span> Refresh
        </button>
      </div>

      {groups.length === 0 ? (
        <div className="empty-state-card">
          <div className="empty-icon">📋</div>
          <p>No external groups assigned yet.</p>
          <span className="empty-hint">Groups will appear here once assigned by the committee.</span>
        </div>
      ) : (
        <div className="groups-container">
          {groups.map(group => (
            <div key={group.id} className={`group-card ${expandedGroup === group.id ? 'expanded' : ''}`}>
              <div className="group-header" onClick={() => loadAssignments(group.id)}>
                <div className="group-info">
                  <h4>{group.name}</h4>
                  <div className="group-meta">
                    <span className="meta-item">
                      <span className="meta-icon">📅</span>
                      Semester: {group.semester}
                    </span>
                    <span className="meta-item">
                      <span className="meta-icon">👥</span>
                      Students: {group.assignments_count || 0}/{group.max_groups}
                    </span>
                    {group.available_slots !== undefined && group.available_slots > 0 && (
                      <span className="meta-item slots-available">
                        {group.available_slots} slots available
                      </span>
                    )}
                  </div>
                </div>
                <div className="group-actions">
                  <span className={`badge ${getStatusBadge(group.status)}`}>
                    {group.status.replace('_', ' ')}
                  </span>
                  <span className={`expand-icon ${expandedGroup === group.id ? 'expanded' : ''}`}>
                    ▶
                  </span>
                </div>
              </div>

              {group.evaluation_date && (
                <div className="group-schedule">
                  <span className="schedule-icon">📆</span>
                  <strong>Evaluation:</strong> 
                  <span className="schedule-date">
                    {new Date(group.evaluation_date).toLocaleDateString('en-US', {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </span>
                  {group.evaluation_venue && (
                    <span className="schedule-venue">
                      <span className="venue-icon">📍</span>
                      {group.evaluation_venue}
                    </span>
                  )}
                </div>
              )}

              {expandedGroup === group.id && (
                <div className="group-students">
                  {loadingAssignments ? (
                    <div className="loading-state">
                      <div className="spinner"></div>
                      <span>Loading students...</span>
                    </div>
                  ) : assignments.length === 0 ? (
                    <div className="empty-assignments">
                      <span>No students assigned to this group yet.</span>
                    </div>
                  ) : (
                    <div className="students-table-wrapper">
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
                              <td className="slot-cell">
                                {assignment.slot_number ? (
                                  <span className="slot-number">#{assignment.slot_number}</span>
                                ) : (
                                  <span className="no-slot">-</span>
                                )}
                                {assignment.slot_time && (
                                  <span className="slot-time">{assignment.slot_time}</span>
                                )}
                              </td>
                              <td>
                                <div className="student-names">
                                  <div className="student-row">
                                    <span className="student-name">
                                      {assignment.supervisor_group_details?.group?.student_1?.name || 'Unknown'}
                                    </span>
                                    <span className="reg-no">
                                      ({assignment.supervisor_group_details?.group?.student_1?.registration_no || 'N/A'})
                                    </span>
                                  </div>
                                  {assignment.supervisor_group_details?.group?.student_2 && (
                                    <div className="student-row">
                                      <span className="student-name">
                                        {assignment.supervisor_group_details.group.student_2.name}
                                      </span>
                                      <span className="reg-no">
                                        ({assignment.supervisor_group_details.group.student_2.registration_no})
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td>
                                <div className="project-info">
                                  <span className="project-name">
                                    {assignment.supervisor_group_details?.project?.project_name || 'No Project'}
                                  </span>
                                  {assignment.supervisor_group_details?.project?.project_category && (
                                    <span className="project-category">
                                      {assignment.supervisor_group_details.project.project_category}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td>
                                <span className="supervisor-name">
                                  {assignment.supervisor_group_details?.supervisor?.name || 'N/A'}
                                </span>
                              </td>
                              <td>
                                {assignment.evaluation ? (
                                  <div className="evaluation-result">
                                    <span className={`grade-badge grade-${assignment.evaluation.grade?.replace('+', 'plus')}`}>
                                      {assignment.evaluation.grade}
                                    </span>
                                    <span className="eval-marks">
                                      {Math.round(assignment.evaluation.total_marks)}/100
                                    </span>
                                  </div>
                                ) : (
                                  <span className="badge badge-warning">Pending</span>
                                )}
                              </td>
                              <td>
                                <button
                                  className={`btn btn-sm ${assignment.evaluation ? 'btn-secondary' : 'btn-primary'}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEvaluate(assignment, group);
                                  }}
                                >
                                  {assignment.evaluation ? 'View' : 'Evaluate'}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  
                  {assignments.length > 0 && (
                    <div className="group-summary">
                      <span className="summary-item">
                        <strong>Total:</strong> {assignments.length} student groups
                      </span>
                      <span className="summary-item">
                        <strong>Evaluated:</strong> {assignments.filter(a => a.evaluation).length}
                      </span>
                      <span className="summary-item">
                        <strong>Pending:</strong> {assignments.filter(a => !a.evaluation).length}
                      </span>
                    </div>
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
