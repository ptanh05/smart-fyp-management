/**
 * Tests for lecturer workspace components:
 * WorkloadDashboard, ProjectDetailPanel, RubricGradingUI, LecturerWorkspaceTab
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// ---- Mock apiService --------------------------------------------------------
vi.mock('../../../services/api', () => {
  const mockWorkload = [
    {
      project_id: 1,
      student_name: 'Nguyễn Văn A',
      student_reg_no: '20210001',
      topic_title_vi: 'Hệ thống quản lý đồ án thông minh',
      status: 'IN_PROGRESS',
      batch_code: 'HK1-2026',
      roles: ['SUPERVISOR'],
      latest_submission: {
        id: 10,
        kind: 'REPORT',
        version_no: 2,
        created_at: '2026-03-01T10:00:00Z',
        similarity_score: 12.5,
        similarity_level: 'LOW',
      },
      my_rubric_status: 'MISSING',
      needs_reconciliation: false,
    },
    {
      project_id: 2,
      student_name: 'Trần Thị B',
      student_reg_no: '20210002',
      topic_title_vi: 'Ứng dụng AI trong giáo dục',
      status: 'SUBMITTED',
      batch_code: 'HK1-2026',
      roles: ['REVIEWER'],
      latest_submission: null,
      my_rubric_status: 'DRAFT',
      needs_reconciliation: true,
    },
  ];

  const mockVersions = [
    {
      id: 10,
      kind: 'REPORT',
      kind_display: 'Báo cáo',
      version_no: 2,
      original_name: 'report_v2.pdf',
      file_size: 1048576,
      sha256: 'abc123',
      note: 'Bản cập nhật chương 3',
      file_url: 'https://example.com/report.pdf',
      uploaded_by: 'Nguyễn Văn A',
      created_at: '2026-03-01T10:00:00Z',
      similarity_status: 'CHECKED',
      similarity_score: 12.5,
      similarity_level: 'LOW',
      similarity_checked_at: '2026-03-01T10:05:00Z',
      similarity_matches: [
        {
          topic_title_vi: 'Đề tài mẫu 1',
          similarity: 10.0,
          level: 'LOW',
          batch_code: 'HK2-2025',
        },
      ],
    },
  ];

  const mockRubrics = [
    {
      id: 1,
      name: 'Rubric hướng dẫn HK1-2026',
      evaluator_role: 'SUPERVISOR',
      description: 'Phiếu chấm cho GV hướng dẫn',
      is_active: true,
      criteria: [
        { id: 101, name: 'Chất lượng báo cáo', description: '', max_score: 4, order: 0 },
        { id: 102, name: 'Độ hoàn thiện sản phẩm', description: '', max_score: 6, order: 1 },
      ],
      total_max: 10,
    },
  ];

  const mockRubricScores = [
    {
      id: 1,
      rubric_id: 1,
      rubric_name: 'Rubric hướng dẫn HK1-2026',
      evaluator_role: 'SUPERVISOR',
      criterion_scores: { '101': 3.5, '102': 5.0 },
      total_10: 8.5,
      comment: 'Sinh viên làm tốt',
      updated_at: '2026-03-02T09:00:00Z',
    },
  ];

  return {
    apiService: {
      getLecturerWorkload: vi.fn().mockResolvedValue(mockWorkload),
      getSubmissionVersions: vi.fn().mockResolvedValue(mockVersions),
      recheckSubmissionSimilarity: vi.fn().mockResolvedValue(mockVersions[0]),
      getRubrics: vi.fn().mockResolvedValue(mockRubrics),
      getProjectRubricScores: vi.fn().mockResolvedValue(mockRubricScores),
      submitRubricScore: vi.fn().mockResolvedValue({ id: 1, total_10: 8.5, criterion_scores: {} }),
    },
  };
});

// ---- Mock notify utils -------------------------------------------------------
vi.mock('../../../utils/notify', () => ({
  notify: { success: vi.fn(), warning: vi.fn(), error: vi.fn(), info: vi.fn() },
  notifyError: vi.fn(),
  confirmDialog: vi.fn().mockResolvedValue(true),
}));

// ---- Mock safeUrl ------------------------------------------------------------
vi.mock('../../../utils/safeUrl', () => ({
  safeExternalUrl: (url: string) => url,
}));

// ---- Imports -----------------------------------------------------------------
import { WorkloadDashboard } from '../../lecturer/WorkloadDashboard';
import { ProjectDetailPanel } from '../../lecturer/ProjectDetailPanel';
import { RubricGradingUI } from '../../lecturer/RubricGradingUI';
import { LecturerWorkspaceTab } from '../../lecturer/LecturerWorkspaceTab';
import type { LecturerWorkloadItem } from '../../../services/api';
import { apiService } from '../../../services/api';

const mockProject: LecturerWorkloadItem = {
  project_id: 1,
  student_name: 'Nguyễn Văn A',
  student_reg_no: '20210001',
  topic_title_vi: 'Hệ thống quản lý đồ án thông minh',
  status: 'IN_PROGRESS',
  batch_code: 'HK1-2026',
  roles: ['SUPERVISOR'],
  latest_submission: {
    id: 10,
    kind: 'REPORT',
    version_no: 2,
    created_at: '2026-03-01T10:00:00Z',
    similarity_score: 12.5,
    similarity_level: 'LOW',
  },
  my_rubric_status: 'MISSING',
  needs_reconciliation: false,
};

// ==============================================================================
describe('WorkloadDashboard', () => {
  const mockOnSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially then renders project rows', async () => {
    render(<WorkloadDashboard onSelectProject={mockOnSelect} />);
    // Loading state
    expect(screen.getByText(/Đang tải/i)).toBeInTheDocument();
    // After load
    await waitFor(() => expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument());
    expect(screen.getByText('Trần Thị B')).toBeInTheDocument();
  });

  it('groups projects by role', async () => {
    render(<WorkloadDashboard onSelectProject={mockOnSelect} />);
    // Role labels appear in both filter buttons and group headers — use getAllByText
    await waitFor(() => expect(screen.getAllByText('GV hướng dẫn').length).toBeGreaterThan(0));
    expect(screen.getAllByText('GV phản biện').length).toBeGreaterThan(0);
  });

  it('shows discrepancy warning badge', async () => {
    render(<WorkloadDashboard onSelectProject={mockOnSelect} />);
    await waitFor(() => expect(screen.getByText('Lệch điểm')).toBeInTheDocument());
  });

  it('calls onSelectProject when row clicked', async () => {
    render(<WorkloadDashboard onSelectProject={mockOnSelect} />);
    await waitFor(() => expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument());
    fireEvent.click(screen.getAllByText('Xem chi tiết')[0]);
    expect(mockOnSelect).toHaveBeenCalledWith(expect.objectContaining({ project_id: 1 }));
  });

  it('shows empty state when API returns empty array', async () => {
    vi.mocked(apiService.getLecturerWorkload).mockResolvedValueOnce([]);
    render(<WorkloadDashboard onSelectProject={mockOnSelect} />);
    await waitFor(() => expect(screen.getByText(/chưa được phân công/i)).toBeInTheDocument());
  });

  it('shows graceful error when API returns 404', async () => {
    vi.mocked(apiService.getLecturerWorkload).mockRejectedValueOnce({ response: { status: 404 } });
    render(<WorkloadDashboard onSelectProject={mockOnSelect} />);
    await waitFor(() => expect(screen.getByText(/đang được triển khai/i)).toBeInTheDocument());
  });

  it('shows stats summary cards', async () => {
    render(<WorkloadDashboard onSelectProject={mockOnSelect} />);
    // 'Tổng đồ án' should be unique; 'Chưa chấm' also appears in table badges — use getAllByText
    await waitFor(() => expect(screen.getByText('Tổng đồ án')).toBeInTheDocument());
    expect(screen.getAllByText('Chưa chấm').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Nháp').length).toBeGreaterThan(0);
    expect(screen.getByText('Cần đối chiếu')).toBeInTheDocument();
  });

  it('filters by role when button clicked', async () => {
    render(<WorkloadDashboard onSelectProject={mockOnSelect} />);
    await waitFor(() => expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument());
    // Role label appears in both filter button and group header — click the filter button
    const filterButtons = screen.getAllByText('GV phản biện');
    // The filter button is the one rendered as a button role
    const filterBtn = filterButtons.find((el) => el.closest('button') !== null && el.closest('button')?.className?.includes('rounded-full'));
    fireEvent.click(filterBtn?.closest('button') ?? filterButtons[0]);
    // Trần Thị B is REVIEWER, should still be visible
    expect(screen.getByText('Trần Thị B')).toBeInTheDocument();
  });
});

// ==============================================================================
describe('ProjectDetailPanel', () => {
  const mockOnBack = vi.fn();
  const mockOnGrade = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders project title and student info', async () => {
    render(<ProjectDetailPanel project={mockProject} onBack={mockOnBack} onGradeClick={mockOnGrade} />);
    expect(screen.getByText('Hệ thống quản lý đồ án thông minh')).toBeInTheDocument();
    expect(screen.getByText(/Nguyễn Văn A/)).toBeInTheDocument();
    expect(screen.getByText(/20210001/)).toBeInTheDocument();
  });

  it('renders submission versions after loading', async () => {
    render(<ProjectDetailPanel project={mockProject} onBack={mockOnBack} onGradeClick={mockOnGrade} />);
    await waitFor(() => expect(screen.getByText('report_v2.pdf')).toBeInTheDocument());
  });

  it('shows similarity badge for checked version', async () => {
    render(<ProjectDetailPanel project={mockProject} onBack={mockOnBack} onGradeClick={mockOnGrade} />);
    await waitFor(() => expect(screen.getByText(/Tương đồng 12.5%/i)).toBeInTheDocument());
  });

  it('shows download link for version with file_url', async () => {
    render(<ProjectDetailPanel project={mockProject} onBack={mockOnBack} onGradeClick={mockOnGrade} />);
    await waitFor(() => expect(screen.getByText('Tải về')).toBeInTheDocument());
    const link = screen.getByText('Tải về').closest('a');
    expect(link).toHaveAttribute('href', 'https://example.com/report.pdf');
  });

  it('calls onBack when back button clicked', async () => {
    render(<ProjectDetailPanel project={mockProject} onBack={mockOnBack} onGradeClick={mockOnGrade} />);
    fireEvent.click(screen.getByText(/Quay lại danh sách/i));
    expect(mockOnBack).toHaveBeenCalled();
  });

  it('calls onGradeClick when grade button clicked', async () => {
    render(<ProjectDetailPanel project={mockProject} onBack={mockOnBack} onGradeClick={mockOnGrade} />);
    fireEvent.click(screen.getByText(/Chấm điểm/i));
    expect(mockOnGrade).toHaveBeenCalledWith(mockProject);
  });

  it('calls recheckSubmissionSimilarity when recheck button clicked', async () => {
    render(<ProjectDetailPanel project={mockProject} onBack={mockOnBack} onGradeClick={mockOnGrade} />);
    await waitFor(() => expect(screen.getByText('Kiểm tra lại tương đồng')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Kiểm tra lại tương đồng'));
    await waitFor(() => expect(apiService.recheckSubmissionSimilarity).toHaveBeenCalledWith(10));
  });

  it('shows similarity match details on badge click', async () => {
    render(<ProjectDetailPanel project={mockProject} onBack={mockOnBack} onGradeClick={mockOnGrade} />);
    await waitFor(() => expect(screen.getByText(/Tương đồng 12.5%/i)).toBeInTheDocument());
    fireEvent.click(screen.getByText(/Tương đồng 12.5%/i));
    expect(screen.getByText('Đề tài mẫu 1')).toBeInTheDocument();
  });

  it('shows empty state when no submissions', async () => {
    vi.mocked(apiService.getSubmissionVersions).mockResolvedValueOnce([]);
    render(<ProjectDetailPanel project={mockProject} onBack={mockOnBack} onGradeClick={mockOnGrade} />);
    await waitFor(() => expect(screen.getByText(/chưa nộp/i)).toBeInTheDocument());
  });
});

// ==============================================================================
describe('RubricGradingUI', () => {
  const mockOnBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders rubric name after loading', async () => {
    render(<RubricGradingUI project={mockProject} onBack={mockOnBack} />);
    await waitFor(() => expect(screen.getByText('Rubric hướng dẫn HK1-2026')).toBeInTheDocument());
  });

  it('renders criteria with max score', async () => {
    render(<RubricGradingUI project={mockProject} onBack={mockOnBack} />);
    await waitFor(() => expect(screen.getByText('Chất lượng báo cáo')).toBeInTheDocument());
    expect(screen.getByText('Độ hoàn thiện sản phẩm')).toBeInTheDocument();
    expect(screen.getByText('/ 4')).toBeInTheDocument();
    expect(screen.getByText('/ 6')).toBeInTheDocument();
  });

  it('pre-fills scores from existing score data', async () => {
    render(<RubricGradingUI project={mockProject} onBack={mockOnBack} />);
    await waitFor(() => {
      const inputs = screen.getAllByRole('spinbutton') as HTMLInputElement[];
      expect(inputs.some((inp) => inp.value === '3.5')).toBe(true);
    });
  });

  it('calls submitRubricScore with is_draft=true when "Lưu nháp" clicked', async () => {
    render(<RubricGradingUI project={mockProject} onBack={mockOnBack} />);
    await waitFor(() => expect(screen.getByText('Lưu nháp')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Lưu nháp'));
    await waitFor(() =>
      expect(apiService.submitRubricScore).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ is_draft: true })
      )
    );
  });

  it('shows confirm dialog before submitting final score', async () => {
    const { confirmDialog } = await import('../../../utils/notify');
    render(<RubricGradingUI project={mockProject} onBack={mockOnBack} />);
    await waitFor(() => expect(screen.getByText('Xác nhận điểm')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Xác nhận điểm'));
    await waitFor(() => expect(confirmDialog).toHaveBeenCalled());
  });

  it('shows discrepancy warning when needs_reconciliation is true', async () => {
    const projectWithDiscrepancy: LecturerWorkloadItem = {
      ...mockProject,
      needs_reconciliation: true,
    };
    render(<RubricGradingUI project={projectWithDiscrepancy} onBack={mockOnBack} />);
    // Warning text: "điểm giữa các giám khảo có độ lệch lớn, cần đối chiếu lại"
    await waitFor(() => expect(screen.getByText(/đối chiếu lại/i)).toBeInTheDocument());
  });

  it('shows locked / read-only state when rubric_status is SUBMITTED', async () => {
    const lockedProject: LecturerWorkloadItem = {
      ...mockProject,
      my_rubric_status: 'SUBMITTED',
    };
    render(<RubricGradingUI project={lockedProject} onBack={mockOnBack} />);
    await waitFor(() => expect(screen.getByText(/khoá/i)).toBeInTheDocument());
    // Lưu nháp + Xác nhận điểm buttons should NOT appear
    expect(screen.queryByText('Lưu nháp')).not.toBeInTheDocument();
    expect(screen.queryByText('Xác nhận điểm')).not.toBeInTheDocument();
  });

  it('shows no-rubric message when rubrics list is empty', async () => {
    vi.mocked(apiService.getRubrics).mockResolvedValueOnce([]);
    render(<RubricGradingUI project={mockProject} onBack={mockOnBack} />);
    await waitFor(() => expect(screen.getByText(/chưa có rubric/i)).toBeInTheDocument());
  });

  it('calls onBack when back button clicked', async () => {
    render(<RubricGradingUI project={mockProject} onBack={mockOnBack} />);
    // Wait for the back button to appear (it loads immediately in the header)
    await waitFor(() => expect(screen.getByText(/Quay lại chi tiết đồ án/i)).toBeInTheDocument());
    fireEvent.click(screen.getByText(/Quay lại chi tiết đồ án/i));
    expect(mockOnBack).toHaveBeenCalled();
  });
});

// ==============================================================================
describe('LecturerWorkspaceTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders workload list by default', async () => {
    render(<LecturerWorkspaceTab />);
    await waitFor(() => expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument());
  });

  it('navigates to project detail when "Xem chi tiết" clicked', async () => {
    render(<LecturerWorkspaceTab />);
    await waitFor(() => expect(screen.getAllByText('Xem chi tiết').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText('Xem chi tiết')[0]);
    await waitFor(() => expect(screen.getByText('Lịch sử phiên bản bài nộp')).toBeInTheDocument());
  });

  it('navigates from detail to grading when "Chấm điểm" clicked', async () => {
    render(<LecturerWorkspaceTab />);
    await waitFor(() => expect(screen.getAllByText('Xem chi tiết').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText('Xem chi tiết')[0]);
    await waitFor(() => expect(screen.getByText(/Chấm điểm/)).toBeInTheDocument());
    fireEvent.click(screen.getByText(/Chấm điểm \(Rubric\)/));
    await waitFor(() => expect(screen.getByText('Rubric hướng dẫn HK1-2026')).toBeInTheDocument());
  });

  it('navigates back to list from detail', async () => {
    render(<LecturerWorkspaceTab />);
    await waitFor(() => expect(screen.getAllByText('Xem chi tiết').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText('Xem chi tiết')[0]);
    await waitFor(() => expect(screen.getByText(/Quay lại danh sách/i)).toBeInTheDocument());
    fireEvent.click(screen.getByText(/Quay lại danh sách/i));
    await waitFor(() => expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument());
  });

  it('shows breadcrumb with student name in detail view', async () => {
    render(<LecturerWorkspaceTab />);
    await waitFor(() => expect(screen.getAllByText('Xem chi tiết').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText('Xem chi tiết')[0]);
    await waitFor(() => {
      // Breadcrumb should show student name as a button
      const btns = screen.getAllByRole('button');
      expect(btns.some((b) => b.textContent?.includes('Nguyễn Văn A'))).toBe(true);
    });
  });
});
