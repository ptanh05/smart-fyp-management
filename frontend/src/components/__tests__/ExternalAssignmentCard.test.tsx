/**
 * Tests for ExternalAssignmentCard Component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ExternalAssignmentCard from '../ExternalAssignmentCard';
import type { ExternalGroupAssignment, ExternalEvaluation } from '../../types';

// Mock CSS import
vi.mock('../ExternalAssignmentCard.css', () => ({}));

describe('ExternalAssignmentCard', () => {
  const mockOnEvaluate = vi.fn();
  const mockOnViewDetails = vi.fn();

  const baseAssignment: ExternalGroupAssignment = {
    id: 1,
    external_group: 1,
    supervisor_group: 1,
    supervisor_group_details: {
      id: 1,
      project: {
        id: 1,
        project_name: 'Test Project',
        project_category: 'Web Development',
      },
      supervisor: {
        id: 1,
        name: 'Dr. Smith',
      },
      group: {
        id: 1,
        student_1: {
          id: 1,
          name: 'John Doe',
          registration_no: '2021-CS-001',
        },
        student_2: {
          id: 2,
          name: 'Jane Doe',
          registration_no: '2021-CS-002',
        },
      },
    },
    slot_number: 1,
    slot_time: '09:00',
    status: 'pending',
    assigned_at: '2026-01-01T10:00:00Z',
  };

  const mockEvaluation: ExternalEvaluation = {
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
    grade: 'B+',
    is_pass: true,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders student names', () => {
      render(
        <ExternalAssignmentCard
          assignment={baseAssignment}
          onEvaluate={mockOnEvaluate}
        />
      );
      
      expect(screen.getByText(/John Doe/)).toBeInTheDocument();
      expect(screen.getByText(/Jane Doe/)).toBeInTheDocument();
    });

    it('renders registration numbers', () => {
      render(
        <ExternalAssignmentCard
          assignment={baseAssignment}
          onEvaluate={mockOnEvaluate}
        />
      );
      
      expect(screen.getByText(/2021-CS-001/)).toBeInTheDocument();
      expect(screen.getByText(/2021-CS-002/)).toBeInTheDocument();
    });

    it('renders project name', () => {
      render(
        <ExternalAssignmentCard
          assignment={baseAssignment}
          onEvaluate={mockOnEvaluate}
        />
      );
      
      expect(screen.getByText(/Test Project/)).toBeInTheDocument();
    });

    it('renders supervisor name', () => {
      render(
        <ExternalAssignmentCard
          assignment={baseAssignment}
          onEvaluate={mockOnEvaluate}
        />
      );
      
      expect(screen.getByText(/Dr. Smith/)).toBeInTheDocument();
    });

    it('renders slot information', () => {
      render(
        <ExternalAssignmentCard
          assignment={baseAssignment}
          onEvaluate={mockOnEvaluate}
        />
      );
      
      expect(screen.getByText(/Slot #1/)).toBeInTheDocument();
    });

    it('renders with only one student', () => {
      const singleStudentAssignment = {
        ...baseAssignment,
        supervisor_group_details: {
          ...baseAssignment.supervisor_group_details!,
          group: {
            ...baseAssignment.supervisor_group_details!.group,
            student_2: null,
          },
        },
      };

      render(
        <ExternalAssignmentCard
          assignment={singleStudentAssignment}
          onEvaluate={mockOnEvaluate}
        />
      );
      
      expect(screen.getByText(/John Doe/)).toBeInTheDocument();
      expect(screen.queryByText(/Jane Doe/)).not.toBeInTheDocument();
    });
  });

  describe('Status Badge', () => {
    it('shows pending status', () => {
      const pendingAssignment = { ...baseAssignment, status: 'pending' as const };
      
      render(
        <ExternalAssignmentCard
          assignment={pendingAssignment}
          onEvaluate={mockOnEvaluate}
        />
      );
      
      expect(screen.getByText(/pending/i)).toBeInTheDocument();
    });

    it('shows scheduled status', () => {
      const scheduledAssignment = { ...baseAssignment, status: 'scheduled' as const };
      
      render(
        <ExternalAssignmentCard
          assignment={scheduledAssignment}
          onEvaluate={mockOnEvaluate}
        />
      );
      
      expect(screen.getByText(/scheduled/i)).toBeInTheDocument();
    });

    it('shows evaluated status', () => {
      const evaluatedAssignment = { ...baseAssignment, status: 'evaluated' as const };
      
      render(
        <ExternalAssignmentCard
          assignment={evaluatedAssignment}
          onEvaluate={mockOnEvaluate}
        />
      );
      
      expect(screen.getByText(/evaluated/i)).toBeInTheDocument();
    });
  });

  describe('Evaluation Display', () => {
    it('shows evaluation details when provided', () => {
      render(
        <ExternalAssignmentCard
          assignment={baseAssignment}
          evaluation={mockEvaluation}
          onEvaluate={mockOnEvaluate}
        />
      );
      
      expect(screen.getByText(/75/)).toBeInTheDocument();
      expect(screen.getByText(/B\+/)).toBeInTheDocument();
      expect(screen.getByText(/PASS/i)).toBeInTheDocument();
    });

    it('shows failing grade when applicable', () => {
      const failingEvaluation = {
        ...mockEvaluation,
        total_marks: 40,
        grade: 'F' as const,
        is_pass: false,
      };
      
      render(
        <ExternalAssignmentCard
          assignment={baseAssignment}
          evaluation={failingEvaluation}
          onEvaluate={mockOnEvaluate}
        />
      );
      
      expect(screen.getByText(/40/)).toBeInTheDocument();
      expect(screen.getByText(/FAIL/i)).toBeInTheDocument();
    });
  });

  describe('Action Buttons', () => {
    it('shows evaluate button for pending assignment', () => {
      render(
        <ExternalAssignmentCard
          assignment={baseAssignment}
          onEvaluate={mockOnEvaluate}
        />
      );
      
      expect(screen.getByText(/Evaluate/i)).toBeInTheDocument();
    });

    it('shows edit button when evaluation exists', () => {
      render(
        <ExternalAssignmentCard
          assignment={baseAssignment}
          evaluation={mockEvaluation}
          onEvaluate={mockOnEvaluate}
        />
      );
      
      expect(screen.getByText(/Edit/i)).toBeInTheDocument();
    });

    it('calls onEvaluate when evaluate button clicked', () => {
      render(
        <ExternalAssignmentCard
          assignment={baseAssignment}
          onEvaluate={mockOnEvaluate}
        />
      );
      
      fireEvent.click(screen.getByText(/Evaluate/i));
      expect(mockOnEvaluate).toHaveBeenCalledWith(baseAssignment);
    });

    it('shows view details button when onViewDetails provided', () => {
      render(
        <ExternalAssignmentCard
          assignment={baseAssignment}
          onEvaluate={mockOnEvaluate}
          onViewDetails={mockOnViewDetails}
        />
      );
      
      expect(screen.getByText(/View Details/i)).toBeInTheDocument();
    });

    it('calls onViewDetails when view details button clicked', () => {
      render(
        <ExternalAssignmentCard
          assignment={baseAssignment}
          onEvaluate={mockOnEvaluate}
          onViewDetails={mockOnViewDetails}
        />
      );
      
      fireEvent.click(screen.getByText(/View Details/i));
      expect(mockOnViewDetails).toHaveBeenCalledWith(baseAssignment);
    });
  });
});
