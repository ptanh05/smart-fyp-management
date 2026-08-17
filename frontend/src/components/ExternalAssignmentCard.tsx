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
