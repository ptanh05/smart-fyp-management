import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import type { 
  ExternalGroupAssignment, 
  ExternalEvaluation, 
  ExternalEvaluationCreate 
} from '../types';
import { validateEvaluationForm } from '../utils/validation';
import ErrorMessage from './ErrorMessage';
import './ExternalEvaluationForm.css';

interface ExternalEvaluationFormProps {
  assignmentId: number;
  existingEvaluation?: ExternalEvaluation;
  onComplete: () => void;
  onCancel: () => void;
  /** Optional toast function for notifications */
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

interface RatingOption {
  value: number;
  label: string;
  description: string;
}

const RATING_OPTIONS: RatingOption[] = [
  { value: 0, label: 'Not Evaluated', description: '0%' },
  { value: 20, label: 'Marginal', description: '20%' },
  { value: 50, label: 'Adequate', description: '50%' },
  { value: 75, label: 'Good', description: '75%' },
  { value: 95, label: 'Excellent', description: '95%' },
];

type RatingField = 
  | 'project_completion'
  | 'code_quality'
  | 'functionality'
  | 'understanding_of_technology'
  | 'problem_solving'
  | 'innovation'
  | 'presentation_clarity'
  | 'communication'
  | 'time_management'
  | 'documentation_completeness'
  | 'documentation_quality'
  | 'qa_response';

const ExternalEvaluationForm: React.FC<ExternalEvaluationFormProps> = ({
  assignmentId,
  existingEvaluation,
  onComplete,
  onCancel,
  showToast
}) => {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [assignment, setAssignment] = useState<ExternalGroupAssignment | null>(null);
  const [formData, setFormData] = useState<ExternalEvaluationCreate>({
    assignment: assignmentId,
    // Project Implementation
    project_completion: 0,
    code_quality: 0,
    functionality: 0,
    // Technical Knowledge
    understanding_of_technology: 0,
    problem_solving: 0,
    innovation: 0,
    // Presentation
    presentation_clarity: 0,
    communication: 0,
    time_management: 0,
    // Documentation
    documentation_completeness: 0,
    documentation_quality: 0,
    // Q&A
    qa_response: 0,
    // Comments
    overall_comment: '',
    strengths: '',
    areas_of_improvement: ''
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
        areas_of_improvement: existingEvaluation.areas_of_improvement || ''
      });
    }
  }, [existingEvaluation]);

  useEffect(() => {
    loadAssignment();
  }, [assignmentId]);

  const loadAssignment = async () => {
    try {
      setLoading(true);
      setError(null);
      // Try to get assignment details from external groups
      const groups = await apiService.getExternalGroups();
      let found = false;
      for (const group of groups.results) {
        const groupDetail = await apiService.getExternalGroup(group.id);
        const assignmentData = groupDetail?.assignments?.find(a => a.id === assignmentId);
        if (assignmentData) {
          setAssignment(assignmentData);
          found = true;
          break;
        }
      }
      if (!found) {
        setError('Assignment not found. It may have been deleted or you may not have permission to access it.');
      }
    } catch (error: unknown) {
      console.error('Failed to load assignment:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('Network') || errorMessage.includes('fetch')) {
        setError('Unable to connect to the server. Please check your internet connection and try again.');
      } else {
        setError('Failed to load assignment details. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof ExternalEvaluationCreate, value: number | string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleRatingChange = (field: RatingField, value: string) => {
    handleChange(field, parseInt(value, 10));
  };

  const calculateMarks = () => {
    // Each rating is a percentage (0, 20, 50, 75, 95)
    // We calculate the actual marks by applying percentage to max marks
    const calc = (rating: number, maxMarks: number) => (rating / 100) * maxMarks;

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

    const total = projectImpl + technical + presentation + documentation + qa;

    return {
      projectImpl: Math.round(projectImpl * 10) / 10,
      technical: Math.round(technical * 10) / 10,
      presentation: Math.round(presentation * 10) / 10,
      documentation: Math.round(documentation * 10) / 10,
      qa: Math.round(qa * 10) / 10,
      total: Math.round(total * 10) / 10
    };
  };

  const getGrade = (total: number): string => {
    if (total >= 85) return 'A';
    if (total >= 75) return 'B+';
    if (total >= 65) return 'B';
    if (total >= 55) return 'C+';
    if (total >= 50) return 'C';
    return 'F';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    const validation = validateEvaluationForm(formData);
    if (!validation.isValid) {
      setValidationErrors(validation.errors);
      const errorMsg = validation.errors.general || 'Please fill in all required fields.';
      if (showToast) {
        showToast(errorMsg, 'warning');
      }
      return;
    }
    
    setValidationErrors({});
    
    try {
      setSubmitting(true);
      setError(null);
      
      if (existingEvaluation) {
        await apiService.updateExternalEvaluation(existingEvaluation.id, formData);
      } else {
        await apiService.createExternalEvaluation(formData);
      }
      
      if (showToast) {
        showToast('Evaluation saved successfully!', 'success');
      }
      onComplete();
    } catch (error: unknown) {
      console.error('Failed to save evaluation:', error);
      let errorMessage = 'Failed to save evaluation. Please try again.';
      
      if (error && typeof error === 'object' && 'response' in error) {
        const response = (error as { response?: { data?: { message?: string; detail?: string } } }).response;
        errorMessage = response?.data?.message || response?.data?.detail || errorMessage;
      } else if (error instanceof Error) {
        if (error.message.includes('Network') || error.message.includes('fetch')) {
          errorMessage = 'Unable to connect to the server. Please check your internet connection.';
        }
      }
      
      setError(errorMessage);
      if (showToast) {
        showToast(errorMessage, 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const marks = calculateMarks();
  const grade = getGrade(marks.total);

  const renderRatingSelect = (
    label: string,
    field: RatingField,
    maxMarks: number
  ) => (
    <div className="rating-field">
      <label>
        {label} <span className="max-marks">({maxMarks} marks)</span>
      </label>
      <select
        value={formData[field]}
        onChange={(e) => handleRatingChange(field, e.target.value)}
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

  if (loading) {
    return (
      <div className="external-evaluation-form">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading assignment details...</p>
        </div>
      </div>
    );
  }

  if (error && !assignment) {
    return (
      <div className="external-evaluation-form">
        <ErrorMessage
          title="Unable to Load Assignment"
          message={error}
          onRetry={loadAssignment}
        />
        <div className="form-actions" style={{ marginTop: '16px' }}>
          <button 
            type="button" 
            className="btn btn-secondary"
            onClick={onCancel}
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="external-evaluation-form">
      <div className="form-header">
        <h2>External Evaluation Form</h2>
        <button className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>

      {assignment && assignment.supervisor_group_details && (
        <div className="assignment-info">
          <h3>Student Group Details</h3>
          <div className="info-grid">
            <div className="info-item">
              <strong>Student(s):</strong>
              <span>
                {assignment.supervisor_group_details.group.student_1.name}
                {assignment.supervisor_group_details.group.student_2 && 
                  ` & ${assignment.supervisor_group_details.group.student_2.name}`}
              </span>
            </div>
            <div className="info-item">
              <strong>Registration No:</strong>
              <span>
                {assignment.supervisor_group_details.group.student_1.registration_no}
                {assignment.supervisor_group_details.group.student_2 && 
                  `, ${assignment.supervisor_group_details.group.student_2.registration_no}`}
              </span>
            </div>
            {assignment.supervisor_group_details.project && (
              <div className="info-item">
                <strong>Project:</strong>
                <span>{assignment.supervisor_group_details.project.project_name}</span>
              </div>
            )}
            <div className="info-item">
              <strong>Supervisor:</strong>
              <span>{assignment.supervisor_group_details.supervisor.name}</span>
            </div>
            {assignment.slot_time && (
              <div className="info-item">
                <strong>Slot Time:</strong>
                <span>{assignment.slot_time}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Error Display */}
        {error && (
          <ErrorMessage
            message={error}
            variant="error"
          />
        )}
        
        {validationErrors.general && (
          <ErrorMessage
            message={validationErrors.general}
            variant="warning"
          />
        )}

        {/* Project Implementation (30 marks) */}
        <fieldset className="evaluation-section">
          <legend>
            <span className="legend-text">Project Implementation</span>
            <span className="section-marks">{marks.projectImpl}/30</span>
          </legend>
          <div className="section-fields">
            {renderRatingSelect('Project Completion', 'project_completion', 10)}
            {renderRatingSelect('Code Quality', 'code_quality', 10)}
            {renderRatingSelect('Functionality', 'functionality', 10)}
          </div>
        </fieldset>

        {/* Technical Knowledge (25 marks) */}
        <fieldset className="evaluation-section">
          <legend>
            <span className="legend-text">Technical Knowledge</span>
            <span className="section-marks">{marks.technical}/25</span>
          </legend>
          <div className="section-fields">
            {renderRatingSelect('Understanding of Technology', 'understanding_of_technology', 10)}
            {renderRatingSelect('Problem Solving', 'problem_solving', 10)}
            {renderRatingSelect('Innovation', 'innovation', 5)}
          </div>
        </fieldset>

        {/* Presentation Skills (20 marks) */}
        <fieldset className="evaluation-section">
          <legend>
            <span className="legend-text">Presentation Skills</span>
            <span className="section-marks">{marks.presentation}/20</span>
          </legend>
          <div className="section-fields">
            {renderRatingSelect('Presentation Clarity', 'presentation_clarity', 10)}
            {renderRatingSelect('Communication', 'communication', 5)}
            {renderRatingSelect('Time Management', 'time_management', 5)}
          </div>
        </fieldset>

        {/* Documentation Quality (15 marks) */}
        <fieldset className="evaluation-section">
          <legend>
            <span className="legend-text">Documentation Quality</span>
            <span className="section-marks">{marks.documentation}/15</span>
          </legend>
          <div className="section-fields">
            {renderRatingSelect('Documentation Completeness', 'documentation_completeness', 8)}
            {renderRatingSelect('Documentation Quality', 'documentation_quality', 7)}
          </div>
        </fieldset>

        {/* Q&A Response (10 marks) */}
        <fieldset className="evaluation-section">
          <legend>
            <span className="legend-text">Q&A Response</span>
            <span className="section-marks">{marks.qa}/10</span>
          </legend>
          <div className="section-fields">
            {renderRatingSelect('Q&A Response Quality', 'qa_response', 10)}
          </div>
        </fieldset>

        {/* Total */}
        <div className="total-marks-display">
          <div className="total-row">
            <h3>Total Marks:</h3>
            <span className={`total-value ${marks.total >= 50 ? 'pass' : 'fail'}`}>
              {marks.total}/100
            </span>
          </div>
          <div className="grade-row">
            <span className="grade-label">Grade:</span>
            <span className={`grade-value grade-${grade.replace('+', '-plus')}`}>
              {grade}
            </span>
            <span className={`pass-status ${marks.total >= 50 ? 'pass' : 'fail'}`}>
              {marks.total >= 50 ? 'PASS' : 'FAIL'}
            </span>
          </div>
        </div>

        {/* Comments */}
        <fieldset className="evaluation-section comments-section">
          <legend>
            <span className="legend-text">Comments</span>
          </legend>
          <div className="comment-fields">
            <div className="comment-field">
              <label htmlFor="overall_comment">Overall Comment</label>
              <textarea
                id="overall_comment"
                value={formData.overall_comment}
                onChange={(e) => handleChange('overall_comment', e.target.value)}
                rows={3}
                disabled={submitting}
                placeholder="Enter your overall assessment of the project and presentation..."
              />
            </div>
            <div className="comment-field">
              <label htmlFor="strengths">Strengths</label>
              <textarea
                id="strengths"
                value={formData.strengths}
                onChange={(e) => handleChange('strengths', e.target.value)}
                rows={2}
                disabled={submitting}
                placeholder="What were the notable strengths of this project?"
              />
            </div>
            <div className="comment-field">
              <label htmlFor="areas_of_improvement">Areas of Improvement</label>
              <textarea
                id="areas_of_improvement"
                value={formData.areas_of_improvement}
                onChange={(e) => handleChange('areas_of_improvement', e.target.value)}
                rows={2}
                disabled={submitting}
                placeholder="What areas could be improved?"
              />
            </div>
          </div>
        </fieldset>

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
            {submitting ? (
              <>
                <span className="btn-spinner"></span>
                Saving...
              </>
            ) : existingEvaluation ? (
              'Update Evaluation'
            ) : (
              'Submit Evaluation'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ExternalEvaluationForm;
