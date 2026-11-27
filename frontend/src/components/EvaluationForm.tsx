import { notify } from '../utils/notify';
import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import './EvaluationForm.css';

// Status choices for evaluations
const STATUS_CHOICES = [
  { value: 'pending', label: 'Chưa đánh giá', color: '#6c757d' },
  { value: 'marginal', label: 'Yếu (15%)', color: '#dc3545' },
  { value: 'adequate', label: 'Đạt yêu cầu (40%)', color: '#ffc107' },
  { value: 'good', label: 'Khá / Tốt (70%)', color: '#17a2b8' },
  { value: 'excellent', label: 'Xuất sắc (95%)', color: '#28a745' },
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
  name: 'Đánh giá Đề cương (Scope Document)',
  totalMaxMarks: 7,
  criteria: [
    { field: 'problem_statement', label: 'Phát biểu bài toán', maxMarks: 1 },
    { field: 'validity_of_he_proposed_solution', label: 'Tính khả thi của giải pháp đề xuất', maxMarks: 1 },
    { field: 'motivation_behind_tools_and_technologies', label: 'Lý do lựa chọn công cụ & công nghệ', maxMarks: 1 },
    { field: 'modules', label: 'Phân rã các mô-đun chức năng', maxMarks: 1 },
    { field: 'task_management', label: 'Kế hoạch & phân công công việc', maxMarks: 1 },
    { field: 'related_system_analysis', label: 'Phân tích hệ thống liên quan', maxMarks: 1 },
    { field: 'document_format', label: 'Hình thức trình bày tài liệu', maxMarks: 1 },
  ],
  getEvaluation: (groupId) => apiService.getScopeDocumentEvaluation(groupId),
  updateEvaluation: (groupId, data) => apiService.updateScopeDocumentEvaluation(groupId, data),
};

// SRS Evaluation Supervisor
const srsEvaluationSupervisorConfig: EvaluationType = {
  id: 'srs_supervisor',
  name: 'Đánh giá Đặc tả yêu cầu - SRS (GVHD)',
  totalMaxMarks: 25,
  criteria: [
    { field: 'regularity', label: 'Tính chuyên cần & báo cáo định kỳ', maxMarks: 5 },
    { field: 'srs_are_frs_mapped_to_the_problem', label: 'Yêu cầu chức năng (FR) gắn với bài toán', maxMarks: 4 },
    { field: 'srs_are_nfr_mapped_to_the_problem', label: 'Yêu cầu phi chức năng (NFR) gắn với bài toán', maxMarks: 1 },
    { field: 'is_srs_storyboarding', label: 'Kịch bản & giao diện minh họa (Storyboard)', maxMarks: 3 },
    { field: 'according_to_requirement', label: 'Mức độ đáp ứng yêu cầu đề bài', maxMarks: 2 },
    { field: 'is_srs_template_followed', label: 'Tuân thủ biểu mẫu SRS', maxMarks: 2 },
    { field: 'is_write_up_correct', label: 'Chất lượng trình bày & văn phong kỹ thuật', maxMarks: 3 },
    { field: 'student_participation', label: 'Mức độ tham gia của sinh viên', maxMarks: 5 },
  ],
  getEvaluation: (groupId) => apiService.getSRSEvaluationSupervisor(groupId),
  updateEvaluation: (groupId, data) => apiService.updateSRSEvaluationSupervisor(groupId, data),
};

// SDD Evaluation Supervisor
const sddEvaluationSupervisorConfig: EvaluationType = {
  id: 'sdd_supervisor',
  name: 'Đánh giá Thiết kế hệ thống - SDD (GVHD)',
  totalMaxMarks: 25,
  criteria: [
    { field: 'data_representation_diagram', label: 'Sơ đồ biểu diễn dữ liệu (ERD/CSDL)', maxMarks: 2 },
    { field: 'process_flow', label: 'Luồng xử lý nghiệp vụ', maxMarks: 2 },
    { field: 'design_models', label: 'Mô hình thiết kế kiến trúc & chi tiết', maxMarks: 4 },
    { field: 'algorithms_defined', label: 'Đặc tả thuật toán chính', maxMarks: 2 },
    { field: 'module_completion_status', label: 'Tiến độ hoàn thành các mô-đun', maxMarks: 5 },
    { field: 'is_sdd_template_followed', label: 'Tuân thủ biểu mẫu SDD', maxMarks: 2 },
    { field: 'is_technical_writeup_correct', label: 'Chất lượng viết tài liệu kỹ thuật', maxMarks: 3 },
    { field: 'regularity', label: 'Tính chuyên cần', maxMarks: 2.5 },
    { field: 'seminar_participation', label: 'Tham gia seminar / báo cáo tiến độ', maxMarks: 2.5 },
  ],
  getEvaluation: (groupId) => apiService.getSDDEvaluationSupervisor(groupId),
  updateEvaluation: (groupId, data) => apiService.updateSDDEvaluationSupervisor(groupId, data),
};

// Evaluation 3 Supervisor
const evaluation3SupervisorConfig: EvaluationType = {
  id: 'eval3_supervisor',
  name: 'Đánh giá Đợt 3 - Triển khai (GVHD)',
  totalMaxMarks: 17.5,
  criteria: [
    { field: 'module_completion', label: 'Mức độ hoàn thiện các mô-đun', maxMarks: 3 },
    { field: 'software_testing', label: 'Kiểm thử phần mềm', maxMarks: 4 },
    { field: 'regularity', label: 'Tính chuyên cần', maxMarks: 3 },
    { field: 'is_template_followed', label: 'Tuân thủ biểu mẫu báo cáo', maxMarks: 2 },
    { field: 'project_domain_knowledge', label: 'Kiến thức chuyên môn về đề tài', maxMarks: 2.5 },
    { field: 'is_writeup_correct', label: 'Chất lượng trình bày báo cáo', maxMarks: 3 },
  ],
  getEvaluation: (groupId) => apiService.getEvaluation3Supervisor(groupId),
  updateEvaluation: (groupId, data) => apiService.updateEvaluation3Supervisor(groupId, data),
};

// Evaluation 4 Supervisor
const evaluation4SupervisorConfig: EvaluationType = {
  id: 'eval4_supervisor',
  name: 'Đánh giá Đợt 4 - Hoàn thiện (GVHD)',
  totalMaxMarks: 15,
  criteria: [
    { field: 'module_completion', label: 'Mức độ hoàn thiện sản phẩm', maxMarks: 5 },
    { field: 'student_participation_seminar', label: 'Tham gia báo cáo & bảo vệ thử', maxMarks: 5 },
    { field: 'is_template_followed', label: 'Tuân thủ biểu mẫu khóa luận', maxMarks: 2 },
    { field: 'is_writeup_correct', label: 'Chất lượng viết khóa luận', maxMarks: 3 },
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
  name: 'Đánh giá Đặc tả yêu cầu - SRS (Hội đồng)',
  totalMaxMarks: 25,
  criteria: [
    { field: 'analysis_of_existing_systems', label: 'Phân tích hệ thống hiện tại', maxMarks: 0.5 },
    { field: 'problem_defined', label: 'Xác định bài toán rõ ràng', maxMarks: 2.5 },
    { field: 'proposed_solution', label: 'Giải pháp đề xuất', maxMarks: 1.5 },
    { field: 'tools_technologies', label: 'Công cụ & Công nghệ sử dụng', maxMarks: 0.5 },
    { field: 'frs_mapped', label: 'Yêu cầu chức năng (FR) đầy đủ', maxMarks: 4 },
    { field: 'nfrs_mapped', label: 'Yêu cầu phi chức năng (NFR) đầy đủ', maxMarks: 2 },
    { field: 'requirements_analysis', label: 'Phân tích yêu cầu hệ thống', maxMarks: 3 },
    { field: 'mocks_defined', label: 'Thiết kế giao diện mẫu (Mockup)', maxMarks: 2 },
    { field: 'srs_template_followed', label: 'Tuân thủ biểu mẫu SRS', maxMarks: 2 },
    { field: 'technical_writeup_correct', label: 'Chất lượng trình bày kỹ thuật', maxMarks: 3 },
    { field: 'domain_knowledge', label: 'Hiểu biết nghiệp vụ đề tài', maxMarks: 1 },
    { field: 'qa_ability', label: 'Khả năng trả lời câu hỏi phản biện', maxMarks: 2 },
    { field: 'presentation_attire', label: 'Kỹ năng thuyết trình & Tác phong', maxMarks: 1 },
  ],
  getEvaluation: (groupId) => apiService.getSRSEvaluationCommitteeMember(groupId),
  updateEvaluation: (groupId, data) => apiService.updateSRSEvaluationCommitteeMember(groupId, data),
};

// SDD Evaluation Committee Member (10 criteria, 25 marks)
const sddEvaluationCommitteeMemberConfig: EvaluationType = {
  id: 'sdd_committee',
  name: 'Đánh giá Thiết kế hệ thống - SDD (Hội đồng)',
  totalMaxMarks: 25,
  criteria: [
    { field: 'data_representation_diagram', label: 'Sơ đồ biểu diễn dữ liệu (ERD/CSDL)', maxMarks: 2 },
    { field: 'process_flow', label: 'Luồng xử lý nghiệp vụ', maxMarks: 2 },
    { field: 'sdd_design_models', label: 'Mô hình thiết kế hệ thống', maxMarks: 5 },
    { field: 'algorithm_defined', label: 'Đặc tả thuật toán', maxMarks: 2 },
    { field: 'modules_completion_status', label: 'Tiến độ hoàn thành các mô-đun', maxMarks: 5 },
    { field: 'sdd_template_followed', label: 'Tuân thủ biểu mẫu SDD', maxMarks: 2 },
    { field: 'technical_writeup_correct', label: 'Chất lượng viết tài liệu kỹ thuật', maxMarks: 3 },
    { field: 'project_domain_knowledge', label: 'Kiến thức chuyên môn đề tài', maxMarks: 1 },
    { field: 'qa_ability', label: 'Khả năng trả lời câu hỏi phản biện', maxMarks: 2 },
    { field: 'proper_attire', label: 'Tác phong & Trình bày', maxMarks: 1 },
  ],
  getEvaluation: (groupId) => apiService.getSDDEvaluationCommitteeMember(groupId),
  updateEvaluation: (groupId, data) => apiService.updateSDDEvaluationCommitteeMember(groupId, data),
};

// Evaluation 3 Committee Member (6 criteria, 15 marks)
const evaluation3CommitteeMemberConfig: EvaluationType = {
  id: 'eval3_committee',
  name: 'Đánh giá Đợt 3 - Triển khai (Hội đồng)',
  totalMaxMarks: 15,
  criteria: [
    { field: 'module_completion', label: 'Mức độ hoàn thành các mô-đun', maxMarks: 4 },
    { field: 'software_testing', label: 'Kiểm thử phần mềm', maxMarks: 4 },
    { field: 'qa_ability', label: 'Khả năng trả lời câu hỏi phản biện', maxMarks: 2.5 },
    { field: 'proper_attire', label: 'Tác phong & Trình bày', maxMarks: 0.5 },
    { field: 'is_template_followed', label: 'Tuân thủ biểu mẫu báo cáo', maxMarks: 1 },
    { field: 'is_writeup_correct', label: 'Chất lượng trình bày báo cáo', maxMarks: 3 },
  ],
  getEvaluation: (groupId) => apiService.getEvaluation3CommitteeMember(groupId),
  updateEvaluation: (groupId, data) => apiService.updateEvaluation3CommitteeMember(groupId, data),
};

// Evaluation 4 Committee Member (6 criteria, 15 marks)
const evaluation4CommitteeMemberConfig: EvaluationType = {
  id: 'eval4_committee',
  name: 'Đánh giá Đợt 4 - Bảo vệ cuối kỳ (Hội đồng)',
  totalMaxMarks: 15,
  criteria: [
    { field: 'module_completion', label: 'Mức độ hoàn thiện sản phẩm', maxMarks: 4 },
    { field: 'software_testing', label: 'Kiểm thử & Đánh giá hệ thống', maxMarks: 4 },
    { field: 'qa_ability', label: 'Khả năng trả lời câu hỏi phản biện', maxMarks: 2.5 },
    { field: 'proper_attire', label: 'Tác phong & Thuyết trình', maxMarks: 0.5 },
    { field: 'is_template_followed', label: 'Tuân thủ biểu mẫu khóa luận', maxMarks: 1 },
    { field: 'is_writeup_correct', label: 'Chất lượng viết khóa luận', maxMarks: 3 },
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
  const [isDraft, setIsDraft] = useState(false);

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
      setIsDraft(!!data.is_draft);
    } catch (err: any) {
      console.error('Failed to load evaluation:', err);
      setError(err.response?.data?.message || err.response?.data?.detail || 'Không thể tải dữ liệu phiếu đánh giá');
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

  const handleSave = async (draftMode: boolean = false) => {
    try {
      setSaving(true);
      setError(null);
      
      const dataToSave = {
        ...formData,
        comment: comment,
        comments: comment, // Some models use 'comments' instead of 'comment'
        is_draft: draftMode,
      };
      
      await evaluationType.updateEvaluation(groupId, dataToSave);
      if (draftMode) {
        notify.success('Đã lưu nháp phiếu chấm điểm thành công! Sinh viên chưa thể xem điểm này cho đến khi bạn hoàn thành & lưu.');
      } else {
        notify.success('Đã hoàn thành và lưu phiếu chấm điểm chính thức thành công!');
      }
      onSaved?.();
      onClose();
    } catch (err: any) {
      console.error('Failed to save evaluation:', err);
      setError(err.response?.data?.message || err.response?.data?.detail || 'Không thể lưu phiếu đánh giá');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="evaluation-form-modal">
        <div className="evaluation-form-content">
          <div className="loading">Đang tải phiếu đánh giá...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="evaluation-form-modal">
      <div className="evaluation-form-content">
        <div className="evaluation-form-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2>{evaluationType.name}</h2>
            {isDraft && (
              <span className="evaluation-draft-badge">
                📝 Bản nháp
              </span>
            )}
          </div>
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
              <span className="label">Tổng điểm:</span>
              <span className="value">{totalMarks.toFixed(2)} / {evaluationType.totalMaxMarks}</span>
            </div>
            <div className="percentage">
              <span className="label">Tỷ lệ đạt:</span>
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
            <label htmlFor="comment">Nhận xét & Đánh giá</label>
            <textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Nhập nhận xét chi tiết cho sinh viên / đồ án..."
              rows={4}
            />
          </div>
        </div>

        <div className="evaluation-form-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Hủy / Đóng
          </button>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-draft-save"
              onClick={() => handleSave(true)}
              disabled={saving}
            >
              {saving ? <><span className="m-spinner" aria-hidden="true" /> Đang lưu...</> : '💾 Lưu nháp'}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => handleSave(false)}
              disabled={saving}
            >
              {saving ? <><span className="m-spinner" aria-hidden="true" /> Đang lưu...</> : '✓ Hoàn thành & Lưu'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EvaluationForm;
