/**
 * Tests for ExternalEvaluationForm Component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExternalEvaluationForm from '../ExternalEvaluationForm';
import { apiService } from '../../services/api';

// Mock API service
vi.mock('../../services/api', () => ({
  apiService: {
    createExternalEvaluation: vi.fn(),
    updateExternalEvaluation: vi.fn(),
    getExternalGroups: vi.fn(),
    getExternalGroup: vi.fn(),
  },
}));

// Mock CSS import
vi.mock('../ExternalEvaluationForm.css', () => ({}));

describe('ExternalEvaluationForm', () => {
  const mockOnComplete = vi.fn();
  const mockOnCancel = vi.fn();
  
  const mockAssignment = {
    id: 1,
    external_group: 1,
    supervisor_group: 1,
    supervisor_group_details: {
      id: 1,
      project: { id: 1, project_name: 'Test Project', project_category: 'Web' },
      supervisor: { id: 1, name: 'Dr. Smith' },
      group: {
        id: 1,
        student_1: { id: 1, name: 'John Doe', registration_no: '2021-CS-001' },
        student_2: { id: 2, name: 'Jane Doe', registration_no: '2021-CS-002' },
      },
    },
    slot_number: 1,
    slot_time: '09:00',
    status: 'pending',
    assigned_at: '2026-01-01T10:00:00Z',
  };

  const mockGroup = {
    id: 1,
    name: 'Group 1',
    semester: 'Spring 2026',
    external_examiner: 1,
    assignments: [mockAssignment],
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiService.getExternalGroups).mockResolvedValue({ results: [mockGroup] as any });
    vi.mocked(apiService.getExternalGroup).mockResolvedValue(mockGroup as any);
  });

  describe('Rendering', () => {
    it('renders all evaluation criteria sections', async () => {
      render(
        <ExternalEvaluationForm
          assignmentId={1}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );
      
      await waitFor(() => {
        expect(screen.getByText(/Project Implementation/i)).toBeInTheDocument();
      });
      
      expect(screen.getByText(/Technical Knowledge/i)).toBeInTheDocument();
      expect(screen.getByText(/Presentation Skills/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Documentation Quality/i)[0]).toBeInTheDocument();
      expect(screen.getAllByText(/Q&A Response/i)[0]).toBeInTheDocument();
    });

    it('renders rating options for each criterion', async () => {
      render(
        <ExternalEvaluationForm
          assignmentId={1}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );
      
      await waitFor(() => {
        // Should have multiple select elements (12 rating fields)
        const selects = screen.getAllByRole('combobox');
        expect(selects.length).toBe(12);
      });
    });

    it('renders comment fields', async () => {
      render(
        <ExternalEvaluationForm
          assignmentId={1}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );
      
      await waitFor(() => {
        expect(screen.getByLabelText(/Overall Comment/i)).toBeInTheDocument();
      });
      
      expect(screen.getByLabelText(/Strengths/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Areas of Improvement/i)).toBeInTheDocument();
    });

    it('renders submit and cancel buttons', async () => {
      render(
        <ExternalEvaluationForm
          assignmentId={1}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );
      
      await waitFor(() => {
        expect(screen.getByText('Submit Evaluation')).toBeInTheDocument();
      });
      
      // There are two cancel buttons (header and footer)
      const cancelButtons = screen.getAllByText('Cancel');
      expect(cancelButtons.length).toBe(2);
    });
  });

  describe('Marks Calculation', () => {
    it('shows 0/100 total marks initially', async () => {
      render(
        <ExternalEvaluationForm
          assignmentId={1}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );
      
      await waitFor(() => {
        expect(screen.getByText('0/100')).toBeInTheDocument();
      });
    });

    it('calculates marks when rating is changed', async () => {
      const user = userEvent.setup();
      
      render(
        <ExternalEvaluationForm
          assignmentId={1}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );
      
      await waitFor(() => {
        expect(screen.getByText('0/100')).toBeInTheDocument();
      });
      
      // Change first rating to 'excellent' (95)
      const selects = screen.getAllByRole('combobox');
      await user.selectOptions(selects[0], '95');
      
      // Should show increased marks (project_completion is 10 marks, 95% = 9.5)
      await waitFor(() => {
        expect(screen.queryByText('0/100')).not.toBeInTheDocument();
        expect(screen.getByText('9.5/100')).toBeInTheDocument();
      });
    });

    it('shows section marks correctly', async () => {
      const user = userEvent.setup();
      
      render(
        <ExternalEvaluationForm
          assignmentId={1}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );
      
      await waitFor(() => {
        // Initially all sections show 0
        expect(screen.getByText('0/30')).toBeInTheDocument(); // Project Implementation
        expect(screen.getByText('0/25')).toBeInTheDocument(); // Technical Knowledge
        expect(screen.getByText('0/20')).toBeInTheDocument(); // Presentation Skills
        expect(screen.getByText('0/15')).toBeInTheDocument(); // Documentation Quality
        expect(screen.getByText('0/10')).toBeInTheDocument(); // Q&A Response
      });
    });

    it('displays correct grade based on marks', async () => {
      render(
        <ExternalEvaluationForm
          assignmentId={1}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );
      
      await waitFor(() => {
        // 0 marks = Grade F
        expect(screen.getByText('F')).toBeInTheDocument();
        expect(screen.getByText('FAIL')).toBeInTheDocument();
      });
    });
  });

  describe('User Interactions', () => {
    it('calls onCancel when cancel button clicked', async () => {
      render(
        <ExternalEvaluationForm
          assignmentId={1}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );
      
      await waitFor(() => {
        const cancelButtons = screen.getAllByText('Cancel');
        fireEvent.click(cancelButtons[0]);
      });
      
      expect(mockOnCancel).toHaveBeenCalled();
    });

    it('updates comment fields when typed', async () => {
      const user = userEvent.setup();
      
      render(
        <ExternalEvaluationForm
          assignmentId={1}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );
      
      await waitFor(() => {
        expect(screen.getByLabelText(/Overall Comment/i)).toBeInTheDocument();
      });
      
      const commentField = screen.getByLabelText(/Overall Comment/i);
      await user.type(commentField, 'Great work!');
      
      expect(commentField).toHaveValue('Great work!');
    });
  });

  describe('Form Submission', () => {
    it('submits evaluation successfully', async () => {
      vi.mocked(apiService.createExternalEvaluation).mockResolvedValue({
        id: 1,
        total_marks: 75,
      });
      
      // Mock window.alert
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
      
      render(
        <ExternalEvaluationForm
          assignmentId={1}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );
      
      await waitFor(() => {
        expect(screen.getByText('Submit Evaluation')).toBeInTheDocument();
      });
      
      fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: '75' } });
      fireEvent.click(screen.getByText('Submit Evaluation'));
      
      await waitFor(() => {
        expect(apiService.createExternalEvaluation).toHaveBeenCalled();
        expect(mockOnComplete).toHaveBeenCalled();
      });
    });

    it('shows error when submission fails', async () => {
      vi.mocked(apiService.createExternalEvaluation).mockRejectedValue({
        response: { data: { message: 'Submission failed' } },
      });
      
      render(
        <ExternalEvaluationForm
          assignmentId={1}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );
      
      await waitFor(() => {
        expect(screen.getByText('Submit Evaluation')).toBeInTheDocument();
      });
      
      fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: '75' } });
      fireEvent.click(screen.getByText('Submit Evaluation'));
      
      await waitFor(() => {
        expect(screen.getByText('Submission failed')).toBeInTheDocument();
      });
    });

    it('updates existing evaluation when provided', async () => {
      vi.mocked(apiService.updateExternalEvaluation).mockResolvedValue({
        id: 1,
        total_marks: 80,
      });
      
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
      
      const existingEvaluation = {
        id: 1,
        assignment: 1,
        project_completion: 75,
        code_quality: 75,
        functionality: 75,
        understanding_of_technology: 75,
        problem_solving: 75,
        innovation: 75,
        presentation_clarity: 75,
        communication: 75,
        time_management: 75,
        documentation_completeness: 75,
        documentation_quality: 75,
        qa_response: 75,
        project_implementation_marks: 22.5,
        technical_knowledge_marks: 18.75,
        presentation_marks: 15,
        documentation_marks: 11.25,
        qa_marks: 7.5,
        total_marks: 75,
        grade: 'B+' as const,
        is_pass: true,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      };
      
      render(
        <ExternalEvaluationForm
          assignmentId={1}
          existingEvaluation={existingEvaluation}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );
      
      await waitFor(() => {
        expect(screen.getByText('Update Evaluation')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByText('Update Evaluation'));
      
      await waitFor(() => {
        expect(apiService.updateExternalEvaluation).toHaveBeenCalledWith(1, expect.any(Object));
        expect(mockOnComplete).toHaveBeenCalled();
      });
      
      alertSpy.mockRestore();
    });
  });

  describe('Existing Evaluation', () => {
    it('populates form with existing evaluation data', async () => {
      const existingEvaluation = {
        id: 1,
        assignment: 1,
        project_completion: 95,
        code_quality: 75,
        functionality: 75,
        understanding_of_technology: 75,
        problem_solving: 50,
        innovation: 75,
        presentation_clarity: 75,
        communication: 75,
        time_management: 75,
        documentation_completeness: 75,
        documentation_quality: 75,
        qa_response: 95,
        project_implementation_marks: 26,
        technical_knowledge_marks: 16.25,
        presentation_marks: 15,
        documentation_marks: 11.25,
        qa_marks: 9.5,
        total_marks: 78,
        grade: 'B+' as const,
        is_pass: true,
        overall_comment: 'Good work overall',
        strengths: 'Strong technical skills',
        areas_of_improvement: 'Documentation could be better',
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      };
      
      render(
        <ExternalEvaluationForm
          assignmentId={1}
          existingEvaluation={existingEvaluation}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );
      
      await waitFor(() => {
        // Check that comment fields are populated
        expect(screen.getByLabelText(/Overall Comment/i)).toHaveValue('Good work overall');
        expect(screen.getByLabelText(/Strengths/i)).toHaveValue('Strong technical skills');
        expect(screen.getByLabelText(/Areas of Improvement/i)).toHaveValue('Documentation could be better');
      });
    });
  });
});
