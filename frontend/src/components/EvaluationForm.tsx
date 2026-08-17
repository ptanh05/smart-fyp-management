import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import './EvaluationForm.css';

// Status choices for evaluations
const STATUS_CHOICES = [
  { value: 'pending', label: 'Pending', color: '#6c757d' },
  { value: 'marginal', label: 'Marginal (15%)', color: '#dc3545' },
  { value: 'adequate', label: 'Adequate (40%)', color: '#ffc107' },
  { value: 'good', label: 'Good (70%)', color: '#17a2b8' },
  { value: 'excellent', label: 'Excellent (95%)', color: '#28a745' },
];

// Evaluation type configurations
export interface EvaluationCriterion {
  field: string;
  label: string;
  maxMarks: number;
}

export interface EvaluationType {
  id: string;
  name: string;
  criteria: EvaluationCriterion[];
  totalMaxMarks: number;
  getEvaluation: (groupId: number) => Promise<any>;
  updateEvaluation: (groupId: number, data: any) => Promise<any>;
}

// Scope Document Evaluation
const scopeDocumentConfig: EvaluationType = {
  id: 'scope',
  name: 'Scope Document Evaluation',
  totalMaxMarks: 7,
  criteria: [
    { field: 'problem_statement', label: 'Problem Statement', maxMarks: 1 },
    { field: 'validity_of_he_proposed_solution', label: 'Validity of Proposed Solution', maxMarks: 1 },
    { field: 'motivation_behind_tools_and_technologies', label: 'Motivation Behind Tools & Technologies', maxMarks: 1 },
    { field: 'modules', label: 'Modules', maxMarks: 1 },
    { field: 'task_management', label: 'Task Management', maxMarks: 1 },
    { field: 'related_system_analysis', label: 'Related System Analysis', maxMarks: 1 },
    { field: 'document_format', label: 'Document Format', maxMarks: 1 },
  ],
  getEvaluation: (groupId) => apiService.getScopeDocumentEvaluation(groupId),
  updateEvaluation: (groupId, data) => apiService.updateScopeDocumentEvaluation(groupId, data),
};

// SRS Evaluation Supervisor
const srsEvaluationSupervisorConfig: EvaluationType = {
  id: 'srs_supervisor',
  name: 'SRS Evaluation (Supervisor)',
  totalMaxMarks: 25,
  criteria: [
    { field: 'regularity', label: 'Regularity', maxMarks: 5 },
    { field: 'srs_are_frs_mapped_to_the_problem', label: 'FRs Mapped to Problem', maxMarks: 4 },
    { field: 'srs_are_nfr_mapped_to_the_problem', label: 'NFRs Mapped to Problem', maxMarks: 1 },
    { field: 'is_srs_storyboarding', label: 'Storyboarding', maxMarks: 3 },
    { field: 'according_to_requirement', label: 'According to Requirement', maxMarks: 2 },
    { field: 'is_srs_template_followed', label: 'Template Followed', maxMarks: 2 },
    { field: 'is_write_up_correct', label: 'Write-up Correct', maxMarks: 3 },
    { field: 'student_participation', label: 'Student Participation', maxMarks: 5 },
  ],
  getEvaluation: (groupId) => apiService.getSRSEvaluationSupervisor(groupId),
  updateEvaluation: (groupId, data) => apiService.updateSRSEvaluationSupervisor(groupId, data),
};

// SDD Evaluation Supervisor
const sddEvaluationSupervisorConfig: EvaluationType = {
  id: 'sdd_supervisor',
  name: 'SDD Evaluation (Supervisor)',
  totalMaxMarks: 25,
  criteria: [
    { field: 'data_representation_diagram', label: 'Data Representation Diagram', maxMarks: 2 },
    { field: 'process_flow', label: 'Process Flow', maxMarks: 2 },
    { field: 'design_models', label: 'Design Models', maxMarks: 4 },
    { field: 'algorithms_defined', label: 'Algorithms Defined', maxMarks: 2 },
    { field: 'module_completion_status', label: 'Module Completion Status', maxMarks: 5 },
    { field: 'is_sdd_template_followed', label: 'Template Followed', maxMarks: 2 },
    { field: 'is_technical_writeup_correct', label: 'Technical Write-up Correct', maxMarks: 3 },
    { field: 'regularity', label: 'Regularity', maxMarks: 2.5 },
    { field: 'seminar_participation', label: 'Seminar Participation', maxMarks: 2.5 },
  ],
  getEvaluation: (groupId) => apiService.getSDDEvaluationSupervisor(groupId),
  updateEvaluation: (groupId, data) => apiService.updateSDDEvaluationSupervisor(groupId, data),
};

// Evaluation 3 Supervisor
const evaluation3SupervisorConfig: EvaluationType = {
  id: 'eval3_supervisor',
  name: 'Evaluation 3 (Supervisor)',
  totalMaxMarks: 17.5,
  criteria: [
    { field: 'module_completion', label: 'Module Completion', maxMarks: 3 },
    { field: 'software_testing', label: 'Software Testing', maxMarks: 4 },
    { field: 'regularity', label: 'Regularity', maxMarks: 3 },
    { field: 'is_template_followed', label: 'Template Followed', maxMarks: 2 },
    { field: 'project_domain_knowledge', label: 'Project Domain Knowledge', maxMarks: 2.5 },
    { field: 'is_writeup_correct', label: 'Write-up Correct', maxMarks: 3 },
  ],
  getEvaluation: (groupId) => apiService.getEvaluation3Supervisor(groupId),
  updateEvaluation: (groupId, data) => apiService.updateEvaluation3Supervisor(groupId, data),
};

// Evaluation 4 Supervisor
const evaluation4SupervisorConfig: EvaluationType = {
  id: 'eval4_supervisor',
  name: 'Evaluation 4 (Supervisor)',
  totalMaxMarks: 15,
  criteria: [
    { field: 'module_completion', label: 'Module Completion', maxMarks: 5 },
    { field: 'student_participation_seminar', label: 'Student Participation (Seminar)', maxMarks: 5 },
    { field: 'is_template_followed', label: 'Template Followed', maxMarks: 2 },
    { field: 'is_writeup_correct', label: 'Write-up Correct', maxMarks: 3 },
  ],
  getEvaluation: (groupId) => apiService.getEvaluation4Supervisor(groupId),
  updateEvaluation: (groupId, data) => apiService.updateEvaluation4Supervisor(groupId, data),
};

// Export all supervisor evaluation configs
export const supervisorEvaluationConfigs: EvaluationType[] = [
  scopeDocumentConfig,
  srsEvaluationSupervisorConfig,
  sddEvaluationSupervisorConfig,
  evaluation3SupervisorConfig,
  evaluation4SupervisorConfig,
];

// ============================================
// COMMITTEE MEMBER EVALUATION CONFIGURATIONS
// ============================================

// SRS Evaluation Committee Member (13 criteria, 25 marks)
const srsEvaluationCommitteeMemberConfig: EvaluationType = {
  id: 'srs_committee',
  name: 'SRS Evaluation (Committee)',
  totalMaxMarks: 25,
  criteria: [
    { field: 'analysis_of_existing_systems', label: 'Analysis of Existing Systems', maxMarks: 0.5 },
    { field: 'problem_defined', label: 'Problem Defined', maxMarks: 2.5 },
    { field: 'proposed_solution', label: 'Proposed Solution', maxMarks: 1.5 },
    { field: 'tools_technologies', label: 'Tools & Technologies', maxMarks: 0.5 },
    { field: 'frs_mapped', label: 'FRs Mapped', maxMarks: 4 },
    { field: 'nfrs_mapped', label: 'NFRs Mapped', maxMarks: 2 },
    { field: 'requirements_analysis', label: 'Requirements Analysis', maxMarks: 3 },
    { field: 'mocks_defined', label: 'Mocks Defined', maxMarks: 2 },
    { field: 'srs_template_followed', label: 'SRS Template Followed', maxMarks: 2 },
    { field: 'technical_writeup_correct', label: 'Technical Writeup Correct', maxMarks: 3 },
    { field: 'domain_knowledge', label: 'Domain Knowledge', maxMarks: 1 },
    { field: 'qa_ability', label: 'Q&A Ability', maxMarks: 2 },
    { field: 'presentation_attire', label: 'Presentation & Attire', maxMarks: 1 },
  ],
  getEvaluation: (groupId) => apiService.getSRSEvaluationCommitteeMember(groupId),
  updateEvaluation: (groupId, data) => apiService.updateSRSEvaluationCommitteeMember(groupId, data),
};

// SDD Evaluation Committee Member (10 criteria, 25 marks)
const sddEvaluationCommitteeMemberConfig: EvaluationType = {
  id: 'sdd_committee',
  name: 'SDD Evaluation (Committee)',
  totalMaxMarks: 25,
  criteria: [
    { field: 'data_representation_diagram', label: 'Data Representation Diagram', maxMarks: 2 },
    { field: 'process_flow', label: 'Process Flow', maxMarks: 2 },
    { field: 'sdd_design_models', label: 'Design Models', maxMarks: 5 },
    { field: 'algorithm_defined', label: 'Algorithm Defined', maxMarks: 2 },
    { field: 'modules_completion_status', label: 'Module Completion Status', maxMarks: 5 },
    { field: 'sdd_template_followed', label: 'SDD Template Followed', maxMarks: 2 },
    { field: 'technical_writeup_correct', label: 'Technical Writeup Correct', maxMarks: 3 },
    { field: 'project_domain_knowledge', label: 'Project Domain Knowledge', maxMarks: 1 },
    { field: 'qa_ability', label: 'Q&A Ability', maxMarks: 2 },
    { field: 'proper_attire', label: 'Proper Attire', maxMarks: 1 },
  ],
  getEvaluation: (groupId) => apiService.getSDDEvaluationCommitteeMember(groupId),
  updateEvaluation: (groupId, data) => apiService.updateSDDEvaluationCommitteeMember(groupId, data),
};

// Evaluation 3 Committee Member (6 criteria, 15 marks)
const evaluation3CommitteeMemberConfig: EvaluationType = {
  id: 'eval3_committee',
  name: 'Evaluation 3 (Committee)',
  totalMaxMarks: 15,
  criteria: [
    { field: 'module_completion', label: 'Module Completion', maxMarks: 4 },
    { field: 'software_testing', label: 'Software Testing', maxMarks: 4 },
    { field: 'qa_ability', label: 'Q&A Ability', maxMarks: 2.5 },
    { field: 'proper_attire', label: 'Proper Attire', maxMarks: 0.5 },
    { field: 'is_template_followed', label: 'Template Followed', maxMarks: 1 },
    { field: 'is_writeup_correct', label: 'Writeup Correct', maxMarks: 3 },
  ],
  getEvaluation: (groupId) => apiService.getEvaluation3CommitteeMember(groupId),
  updateEvaluation: (groupId, data) => apiService.updateEvaluation3CommitteeMember(groupId, data),
};

// Evaluation 4 Committee Member (6 criteria, 15 marks)
const evaluation4CommitteeMemberConfig: EvaluationType = {
  id: 'eval4_committee',
  name: 'Evaluation 4 (Committee)',
  totalMaxMarks: 15,
  criteria: [
    { field: 'module_completion', label: 'Module Completion', maxMarks: 4 },
    { field: 'software_testing', label: 'Software Testing', maxMarks: 4 },
    { field: 'qa_ability', label: 'Q&A Ability', maxMarks: 2.5 },
    { field: 'proper_attire', label: 'Proper Attire', maxMarks: 0.5 },
    { field: 'is_template_followed', label: 'Template Followed', maxMarks: 1 },
    { field: 'is_writeup_correct', label: 'Writeup Correct', maxMarks: 3 },
  ],
  getEvaluation: (groupId) => apiService.getEvaluation4CommitteeMember(groupId),
  updateEvaluation: (groupId, data) => apiService.updateEvaluation4CommitteeMember(groupId, data),
};

// Export all committee member evaluation configs
export const committeeMemberEvaluationConfigs: EvaluationType[] = [
  srsEvaluationCommitteeMemberConfig,
  sddEvaluationCommitteeMemberConfig,
  evaluation3CommitteeMemberConfig,
  evaluation4CommitteeMemberConfig,
];

// Calculate marks based on status
const calculateMarks = (status: string, maxMarks: number): number => {
  const percentages: { [key: string]: number } = {
    pending: 0,
    marginal: 15,
    adequate: 40,
    good: 70,
    excellent: 95,
  };
  return ((percentages[status] || 0) / 100) * maxMarks;
};

interface EvaluationFormProps {
  groupId: number;
  evaluationType: EvaluationType;
  onClose: () => void;
  onSaved?: () => void;
}

const EvaluationForm: React.FC<EvaluationFormProps> = ({
  groupId,
  evaluationType,
  onClose,
  onSaved,
}) => {
  const [formData, setFormData] = useState<{ [key: string]: string }>({});
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalMarks, setTotalMarks] = useState(0);

  useEffect(() => {
    loadEvaluation();
  }, [groupId, evaluationType]);

  useEffect(() => {
    // Calculate total marks whenever form data changes
    let total = 0;
    evaluationType.criteria.forEach((criterion) => {
      const status = formData[criterion.field] || 'pending';
      total += calculateMarks(status, criterion.maxMarks);
    });
    setTotalMarks(total);
  }, [formData, evaluationType.criteria]);

  const loadEvaluation = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await evaluationType.getEvaluation(groupId);
      
      // Initialize form data from response
      const initialData: { [key: string]: string } = {};
      evaluationType.criteria.forEach((criterion) => {
        initialData[criterion.field] = data[criterion.field] || 'pending';
      });
      setFormData(initialData);
      setComment(data.comment || data.comments || '');
    } catch (err: any) {
      console.error('Failed to load evaluation:', err);
      setError(err.response?.data?.message || 'Failed to load evaluation data');
      // Initialize with pending values on error
      const initialData: { [key: string]: string } = {};
      evaluationType.criteria.forEach((criterion) => {
        initialData[criterion.field] = 'pending';
      });
      setFormData(initialData);
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      
      const dataToSave = {
        ...formData,
        comment: comment,
        comments: comment, // Some models use 'comments' instead of 'comment'
      };
      
      await evaluationType.updateEvaluation(groupId, dataToSave);
      alert('Evaluation saved successfully!');
      onSaved?.();
      onClose();
    } catch (err: any) {
      console.error('Failed to save evaluation:', err);
      setError(err.response?.data?.message || 'Failed to save evaluation');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="evaluation-form-modal">
        <div className="evaluation-form-content">
          <div className="loading">Loading evaluation...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="evaluation-form-modal">
      <div className="evaluation-form-content">
        <div className="evaluation-form-header">
          <h2>{evaluationType.name}</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        {error && (
          <div className="alert alert-error">
            {error}
          </div>
        )}

        <div className="evaluation-form-body">
          <div className="evaluation-summary">
            <div className="total-marks">
              <span className="label">Total Marks:</span>
              <span className="value">{totalMarks.toFixed(2)} / {evaluationType.totalMaxMarks}</span>
            </div>
            <div className="percentage">
              <span className="label">Percentage:</span>
              <span className="value">{((totalMarks / evaluationType.totalMaxMarks) * 100).toFixed(1)}%</span>
            </div>
          </div>

          <div className="evaluation-criteria-list">
            {evaluationType.criteria.map((criterion) => {
              const currentStatus = formData[criterion.field] || 'pending';
              const marks = calculateMarks(currentStatus, criterion.maxMarks);
              
              return (
                <div key={criterion.field} className="evaluation-criterion">
                  <div className="criterion-header">
                    <span className="criterion-label">{criterion.label}</span>
                    <span className="criterion-marks">
                      {marks.toFixed(2)} / {criterion.maxMarks}
                    </span>
                  </div>
                  <select
                    className={`criterion-select status-${currentStatus}`}
                    value={currentStatus}
                    onChange={(e) => handleFieldChange(criterion.field, e.target.value)}
                  >
                    {STATUS_CHOICES.map((choice) => (
                      <option key={choice.value} value={choice.value}>
                        {choice.label}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>

          <div className="evaluation-comment">
            <label htmlFor="comment">Comments</label>
            <textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add comments about the evaluation..."
              rows={4}
            />
          </div>
        </div>

        <div className="evaluation-form-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Evaluation'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EvaluationForm;
