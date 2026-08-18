/**
 * Tests for ExternalEvaluationView Component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ExternalEvaluationView from '../ExternalEvaluationView';
import type { ExternalEvaluation } from '../../types';

// Mock CSS import
vi.mock('../ExternalEvaluationView.css', () => ({}));

describe('ExternalEvaluationView', () => {
  const baseEvaluation: ExternalEvaluation = {
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
    overall_comment: 'Good work overall',
    strengths: 'Strong technical skills',
    areas_of_improvement: 'Documentation could be better',
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  };

  describe('Summary Display', () => {
    it('displays total marks', () => {
      render(<ExternalEvaluationView evaluation={baseEvaluation} />);
      
      expect(screen.getByText(/75\/100/)).toBeInTheDocument();
    });

    it('displays grade', () => {
      const { container } = render(<ExternalEvaluationView evaluation={baseEvaluation} />);
      
      expect(container.querySelector('.grade')?.textContent).toContain('B');
    });

    it('displays pass status', () => {
      const { container } = render(<ExternalEvaluationView evaluation={baseEvaluation} />);
      
      expect(container.querySelector('.status-badge.pass')).toBeInTheDocument();
    });

    it('displays fail status when not passing', () => {
      const failingEvaluation = {
        ...baseEvaluation,
        total_marks: 30,
        grade: 'F' as const,
        is_pass: false,
      };
      
      const { container } = render(<ExternalEvaluationView evaluation={failingEvaluation} />);
      
      expect(container.querySelector('.status-badge.fail')).toBeInTheDocument();
    });
  });

  describe('Section Marks Display', () => {
    it('displays project implementation marks', () => {
      render(<ExternalEvaluationView evaluation={baseEvaluation} />);
      
      expect(screen.getByText(/Project Implementation/i)).toBeInTheDocument();
      expect(screen.getByText(/22.5/)).toBeInTheDocument();
    });

    it('displays technical knowledge marks', () => {
      render(<ExternalEvaluationView evaluation={baseEvaluation} />);
      
      expect(screen.getByText(/Technical Knowledge/i)).toBeInTheDocument();
    });

    it('displays presentation skills marks', () => {
      render(<ExternalEvaluationView evaluation={baseEvaluation} />);
      
      expect(screen.getByText(/Presentation Skills/i)).toBeInTheDocument();
    });

    it('displays documentation quality marks', () => {
      render(<ExternalEvaluationView evaluation={baseEvaluation} />);
      
      expect(screen.getByText(/Documentation Quality/i)).toBeInTheDocument();
    });

    it('displays Q&A marks', () => {
      render(<ExternalEvaluationView evaluation={baseEvaluation} />);
      
      expect(screen.getByText(/Q&A/i)).toBeInTheDocument();
    });
  });

  describe('Comments Display', () => {
    it('displays overall comment', () => {
      render(<ExternalEvaluationView evaluation={baseEvaluation} />);
      
      expect(screen.getByText(/Good work overall/)).toBeInTheDocument();
    });

    it('displays strengths', () => {
      render(<ExternalEvaluationView evaluation={baseEvaluation} />);
      
      expect(screen.getByText(/Strong technical skills/)).toBeInTheDocument();
    });

    it('displays areas for improvement', () => {
      render(<ExternalEvaluationView evaluation={baseEvaluation} />);
      
      expect(screen.getByText(/Documentation could be better/)).toBeInTheDocument();
    });
  });

  describe('Missing Optional Fields', () => {
    it('handles missing comments gracefully', () => {
      const noCommentsEvaluation = {
        ...baseEvaluation,
        comments: undefined,
        strengths: undefined,
        weaknesses: undefined,
      };
      
      render(<ExternalEvaluationView evaluation={noCommentsEvaluation} />);
      
      expect(screen.getByText(/75\/100/)).toBeInTheDocument();
    });
  });

  describe('Grade Styling', () => {
    it('displays A grade correctly', () => {
      const gradeAEvaluation = {
        ...baseEvaluation,
        total_marks: 90,
        grade: 'A' as const,
      };
      
      const { container } = render(<ExternalEvaluationView evaluation={gradeAEvaluation} />);
      
      expect(container.querySelector('.grade')?.textContent).toContain('A');
    });

    it('displays B+ grade correctly', () => {
      const gradeBPlusEvaluation = {
        ...baseEvaluation,
        total_marks: 80,
        grade: 'B+' as const,
      };
      const { container } = render(<ExternalEvaluationView evaluation={gradeBPlusEvaluation} />);
      
      expect(container.querySelector('.grade')?.textContent).toContain('B+');
    });

    it('displays F grade correctly', () => {
      const gradeFEvaluation = {
        ...baseEvaluation,
        total_marks: 30,
        grade: 'F' as const,
        is_pass: false,
      };
      
      const { container } = render(<ExternalEvaluationView evaluation={gradeFEvaluation} />);
      
      expect(container.querySelector('.grade')?.textContent).toContain('F');
    });
  });

  describe('Different Grade Boundaries', () => {
    const gradeTestCases = [
      { marks: 90, expectedGrade: 'A' },
      { marks: 80, expectedGrade: 'B+' },
      { marks: 72, expectedGrade: 'B' },
      { marks: 65, expectedGrade: 'C+' },
      { marks: 58, expectedGrade: 'C' },
      { marks: 30, expectedGrade: 'F' },
    ];

    gradeTestCases.forEach(({ marks, expectedGrade }) => {
      it(`displays ${marks} marks with grade ${expectedGrade}`, () => {
        const evaluation = {
          ...baseEvaluation,
          total_marks: marks,
          grade: expectedGrade as any,
          is_pass: marks >= 40,
        };
        
        const { container } = render(<ExternalEvaluationView evaluation={evaluation} />);
        
        expect(container.querySelector('.grade')?.textContent).toContain(expectedGrade);
      });
    });
  });
});


