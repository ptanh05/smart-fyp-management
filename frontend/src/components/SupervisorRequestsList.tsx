import React, { useState } from 'react';
import type { SupervisorOfStudentGroup } from '../types';

interface SupervisorRequestsListProps {
  requests: SupervisorOfStudentGroup[];
  /**
   * View type determines the columns and actions displayed:
   * - 'supervisor': Shows Group ID, Project, Students, Status, Accept/Reject actions (for supervisors)
   * - 'student': Shows Supervisor, Project, Status, Cancel action (for students)
   */
  viewType: 'supervisor' | 'student';
  /**
   * Callback when supervisor accepts a request (supervisor view only)
   */
  onAccept?: (id: number) => void;
  /**
   * Callback when supervisor rejects a request (supervisor view only)
   */
  onReject?: (id: number) => void;
  /**
   * Callback when student cancels a request (student view only)
   */
  onCancel?: (id: number) => void;
  /**
   * Whether to show action buttons (default: true)
   */
  showActions?: boolean;
  /**
   * Custom empty state message
   */
  emptyMessage?: string;
}

const SupervisorRequestsList: React.FC<SupervisorRequestsListProps> = ({
  requests,
  viewType,
  onAccept,
  onReject,
  onCancel,
  showActions = true,
  emptyMessage,
}) => {
  const [expandedProjectId, setExpandedProjectId] = useState<number | null>(null);

  if (requests.length === 0) {
    return (
      <div className="empty-state">
        {emptyMessage || (viewType === 'supervisor' ? 'No requests' : 'No supervisor requests')}
      </div>
    );
  }

  const getStatusBadgeClass = (status: string): string => {
    switch (status) {
      case 'accepted':
        return 'badge-success';
      case 'rejected':
      case 'canceled':
        return 'badge-danger';
      default:
        return 'badge-pending';
    }
  };

  // Supervisor view: Shows requests from students to this supervisor
  if (viewType === 'supervisor') {
    return (
      <table className="table">
        <thead>
          <tr>
            <th>Group ID</th>
            <th>Project</th>
            <th>Students</th>
            <th>Status</th>
            {showActions && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {requests.map((req) => {
            const proj = req.project;
            const showIdea = proj && req.status === 'pending' && expandedProjectId === req.id;
            return (
              <React.Fragment key={req.id}>
                <tr>
                  <td>#{req.group?.id || req.id}</td>
                  <td>
                    {proj?.project_name || 'N/A'}
                    {proj && req.status === 'pending' && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ marginLeft: '8px' }}
                        onClick={() => setExpandedProjectId(showIdea ? null : req.id)}
                      >
                        {showIdea ? 'Hide idea' : 'View idea'}
                      </button>
                    )}
                  </td>
                  <td>
                    {req.group?.student_1_details?.user?.username || 'N/A'} &{' '}
                    {req.group?.student_2_details?.user?.username || 'N/A'}
                  </td>
                  <td>
                    <span className={`badge ${getStatusBadgeClass(req.status)}`}>
                      {req.status}
                    </span>
                  </td>
                  {showActions && (
                    <td>
                      {req.status === 'pending' && onAccept && onReject && (
                        <>
                          <button
                            className="btn btn-success btn-sm"
                            onClick={() => onAccept(req.id)}
                          >
                            Accept
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => onReject(req.id)}
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {req.status !== 'pending' && <span className="text-muted">-</span>}
                    </td>
                  )}
                </tr>
                {showIdea && proj && (
                  <tr className="project-idea-row">
                    <td colSpan={showActions ? 5 : 4} style={{ padding: '12px 16px', verticalAlign: 'top', background: 'var(--bg-secondary)' }}>
                      <div className="project-idea-detail">
                        <p><strong>Description</strong><br />{proj.project_description || '—'}</p>
                        <p><strong>Language</strong> {proj.language || '—'}</p>
                        {proj.functionalities && (
                          <p><strong>Functionalities</strong><br />{proj.functionalities}</p>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    );
  }

  // Student view: Shows requests from this student to supervisors
  return (
    <table className="table">
      <thead>
        <tr>
          <th>Supervisor</th>
          <th>Project</th>
          <th>Status</th>
          {showActions && <th>Actions</th>}
        </tr>
      </thead>
      <tbody>
        {requests.map((req) => (
          <tr key={req.id}>
            <td>{req.supervisor?.user?.username || 'N/A'}</td>
            <td>{req.project?.project_name || 'N/A'}</td>
            <td>
              <span className={`badge ${getStatusBadgeClass(req.status)}`}>
                {req.status}
              </span>
            </td>
            {showActions && (
              <td>
                {req.status === 'pending' && onCancel && (
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => onCancel(req.id)}
                  >
                    Cancel
                  </button>
                )}
                {req.status !== 'pending' && <span className="text-muted">-</span>}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default SupervisorRequestsList;
