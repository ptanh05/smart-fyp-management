import React from 'react';
import type { ExternalEvaluation } from '../types';
import { convertScoreToUTCGrade } from '../utils/utcGradeCalculator';
import './ExternalEvaluationView.css';

interface ExternalEvaluationViewProps {
  evaluation: ExternalEvaluation;
}

const ExternalEvaluationView: React.FC<ExternalEvaluationViewProps> = ({ evaluation }) => {
  const utcResult = convertScoreToUTCGrade(evaluation.total_marks / 10);

  const renderCriteriaRow = (label: string, value: number, maxMarks: number) => {
    const percentage = (value / 100) * maxMarks;
    return (
      <div className="criteria-row">
        <span className="criteria-label">{label}</span>
        <div className="criteria-bar">
          <div 
            className="criteria-fill" 
            style={{ width: `${value}%` }}
          />
        </div>
        <span className="criteria-value">{percentage.toFixed(1)}/{maxMarks}</span>
      </div>
    );
  };

  return (
    <div className="external-evaluation-view">
      {/* Summary Card */}
      <div className="evaluation-summary-card">
        <div className="summary-main">
          <div className="total-marks">
            <span className="label">Total Marks</span>
            <span className={`value ${evaluation.is_pass ? 'pass' : 'fail'}`}>
              {evaluation.total_marks}/100
            </span>
          </div>
          <div className="grade-display">
            <span className="label">UTC Grade (Thang 4)</span>
            <span className="grade" style={{ backgroundColor: utcResult.color, color: '#ffffff', padding: '4px 12px', borderRadius: '12px' }}>
              {utcResult.letterGrade} ({utcResult.gpa4.toFixed(1)})
            </span>
          </div>
          <div className="pass-status">
            <span className={`status-badge ${evaluation.is_pass ? 'pass' : 'fail'}`}>
              {utcResult.classification}
            </span>
          </div>
        </div>
        {evaluation.evaluated_at && (
          <p className="evaluated-date">
            Evaluated on: {new Date(evaluation.evaluated_at).toLocaleDateString()}
          </p>
        )}
      </div>

      {/* Detailed Breakdown */}
      <div className="evaluation-breakdown">
        {/* Project Implementation */}
        <div className="breakdown-section">
          <h4>
            Project Implementation
            <span className="section-total">{evaluation.project_implementation_marks}/30</span>
          </h4>
          {renderCriteriaRow('Project Completion', evaluation.project_completion, 10)}
          {renderCriteriaRow('Code Quality', evaluation.code_quality, 10)}
          {renderCriteriaRow('Functionality', evaluation.functionality, 10)}
        </div>

        {/* Technical Knowledge */}
        <div className="breakdown-section">
          <h4>
            Technical Knowledge
            <span className="section-total">{evaluation.technical_knowledge_marks}/25</span>
          </h4>
          {renderCriteriaRow('Understanding of Technology', evaluation.understanding_of_technology, 10)}
          {renderCriteriaRow('Problem Solving', evaluation.problem_solving, 10)}
          {renderCriteriaRow('Innovation', evaluation.innovation, 5)}
        </div>

        {/* Presentation Skills */}
        <div className="breakdown-section">
          <h4>
            Presentation Skills
            <span className="section-total">{evaluation.presentation_marks}/20</span>
          </h4>
          {renderCriteriaRow('Presentation Clarity', evaluation.presentation_clarity, 10)}
          {renderCriteriaRow('Communication', evaluation.communication, 5)}
          {renderCriteriaRow('Time Management', evaluation.time_management, 5)}
        </div>

        {/* Documentation */}
        <div className="breakdown-section">
          <h4>
            Documentation Quality
            <span className="section-total">{evaluation.documentation_marks}/15</span>
          </h4>
          {renderCriteriaRow('Completeness', evaluation.documentation_completeness, 8)}
          {renderCriteriaRow('Quality', evaluation.documentation_quality, 7)}
        </div>

        {/* Q&A */}
        <div className="breakdown-section">
          <h4>
            Q&A Response
            <span className="section-total">{evaluation.qa_marks}/10</span>
          </h4>
          {renderCriteriaRow('Response Quality', evaluation.qa_response, 10)}
        </div>
      </div>

      {/* Comments */}
      {(evaluation.overall_comment || evaluation.strengths || evaluation.areas_of_improvement) && (
        <div className="evaluation-comments">
          <h3>Examiner Comments</h3>
          
          {evaluation.overall_comment && (
            <div className="comment-block">
              <h4>Overall Assessment</h4>
              <p>{evaluation.overall_comment}</p>
            </div>
          )}
          
          {evaluation.strengths && (
            <div className="comment-block strengths">
              <h4>Strengths</h4>
              <p>{evaluation.strengths}</p>
            </div>
          )}
          
          {evaluation.areas_of_improvement && (
            <div className="comment-block improvements">
              <h4>Areas for Improvement</h4>
              <p>{evaluation.areas_of_improvement}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ExternalEvaluationView;
