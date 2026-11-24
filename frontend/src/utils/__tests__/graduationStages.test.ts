import { describe, it, expect } from 'vitest';
import { getProjectStageNumber, calculateStageCounts } from '../graduationStages';

describe('graduationStages utility', () => {
  it('returns Stage 2 for newly allocated projects without outline', () => {
    const project = { status: 'ALLOCATED', supervisor_id: 1 };
    expect(getProjectStageNumber(project)).toBe(2);
  });

  it('returns Stage 3 when outline is submitted or pending review', () => {
    const project = { status: 'OUTLINE_PENDING', supervisor_id: 1 };
    expect(getProjectStageNumber(project)).toBe(3);
  });

  it('returns Stage 4 when outline is approved and student is doing weekly reports', () => {
    const project = {
      status: 'OUTLINE_APPROVED',
      tasks: [],
      weekly_reports: [
        {
          id: 1,
          week_number: 1,
          summary_content: 'Báo cáo tuần 1',
          supervisor_rating: 'PENDING',
          supervisor_feedback: '',
        },
      ],
    };
    expect(getProjectStageNumber(project)).toBe(4);
  });

  it('returns Stage 4 when Khoa approved topic outline and outline is uploaded', () => {
    const projectTopicApproved = {
      status: 'TOPIC_DRAFT',
      topic_review_status: 'APPROVED',
      outline_pdf_path: 'outlines/1_signed.pdf',
      tasks: [],
    };
    expect(getProjectStageNumber(projectTopicApproved)).toBe(4);
  });

  it('returns Stage 4 when student is Force Approved (FORCE_APPROVED or is_force_approved)', () => {
    const projectForce = {
      status: 'ALLOCATED',
      initial_eligibility: 'FORCE_APPROVED',
      is_force_approved: true,
      tasks: [],
    };
    expect(getProjectStageNumber(projectForce)).toBe(4);
  });

  it('does NOT jump to Stage 5 when supervisor evaluates weekly report (stays in Stage 4)', () => {
    const project = {
      status: 'OUTLINE_APPROVED',
      tasks: [],
      weekly_reports: [
        {
          id: 1,
          week_number: 1,
          summary_content: 'Báo cáo tuần 1',
          supervisor_rating: 'GOOD',
          supervisor_feedback: 'Làm tốt lắm',
          reviewed_at: '2026-11-24T08:00:00Z',
        },
      ],
    };
    // Must remain Stage 4 because weekly reports run throughout 15 weeks
    expect(getProjectStageNumber(project)).toBe(4);
  });

  it('moves to Stage 5 only when tasks are assigned on Task Board', () => {
    const project = {
      status: 'OUTLINE_APPROVED',
      tasks: [{ id: 1, title: 'Nhiệm vụ 1', is_completed: false }],
      weekly_reports: [],
    };
    expect(getProjectStageNumber(project)).toBe(5);
  });

  it('moves to Stage 6 when defense eligible or defense ready', () => {
    const project = {
      status: 'DEFENSE_READY',
      is_eligible_for_defense: true,
      tasks: [{ id: 1, title: 'Nhiệm vụ 1' }],
    };
    expect(getProjectStageNumber(project)).toBe(6);
  });

  it('calculates stage counts accurately across multiple students', () => {
    const projects = [
      { status: 'ALLOCATED', supervisor_id: 1 }, // stage 2
      { status: 'TOPIC_DRAFT', supervisor_id: 1 }, // stage 2
      { status: 'OUTLINE_PENDING', supervisor_id: 1 }, // stage 3
      {
        status: 'OUTLINE_APPROVED',
        tasks: [],
        weekly_reports: [{ supervisor_rating: 'GOOD', supervisor_feedback: 'ok' }],
      }, // stage 4 (even after supervisor evaluated report!)
      {
        status: 'OUTLINE_APPROVED',
        tasks: [{ id: 1, title: 'Task 1' }],
        weekly_reports: [],
      }, // stage 5
      { status: 'DEFENSE_READY', is_eligible_for_defense: true }, // stage 6
    ];

    const counts = calculateStageCounts(projects);
    expect(counts[1]).toBe(0);
    expect(counts[2]).toBe(2);
    expect(counts[3]).toBe(1);
    expect(counts[4]).toBe(1);
    expect(counts[5]).toBe(1);
    expect(counts[6]).toBe(1);
  });
});
