import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';

const apiGetMock = vi.fn();

vi.mock('../../services/api', () => ({
  API_BASE_URL: '/app',
  apiClient: {
    get: (...args: any[]) => apiGetMock(...args),
    post: vi.fn(),
  },
  apiService: {
    signCouncilMinutes: vi.fn(),
    exportCouncilMinutesPdf: vi.fn(),
  },
}));

vi.mock('../../utils/notify', () => ({
  notify: { success: vi.fn(), warning: vi.fn(), error: vi.fn(), info: vi.fn() },
  notifyError: vi.fn(),
  confirmDialog: vi.fn().mockResolvedValue(true),
}));

import { UTCCouncilLiveDefenseView } from '../UTCCouncilLiveDefenseView';

describe('UTCCouncilLiveDefenseView polling behavior', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    apiGetMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stops 5s auto-sync polling after a 404 (not assigned to a council)', async () => {
    apiGetMock.mockRejectedValue({ response: { status: 404 } });

    render(<UTCCouncilLiveDefenseView batchId={16} />);

    // Wait for initial fetch effect
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(apiGetMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Không tìm thấy phiên bảo vệ/i)).toBeInTheDocument();

    // Advance several 5s intervals; polling must NOT keep firing 404s.
    await act(async () => {
      vi.advanceTimersByTime(20000);
      await Promise.resolve();
    });

    expect(apiGetMock).toHaveBeenCalledTimes(1);
  });

  it('blocks scoring for reviewer (GVPB) conflict of interest', async () => {
    apiGetMock.mockResolvedValue({
      data: {
        council: {
          id: 22,
          council_number: 1,
          council_name: 'Hội đồng 1',
          session_date: '2026-12-01',
          session_time: 'Ca sáng',
          defense_room: 'P301',
          my_role: 'Chủ tịch hội đồng',
          my_role_code: 'CHAIR',
          my_user_id: 509,
          is_locked: false,
          members: [{ member_id: 1, user_id: 509, name: 'Nguyễn Văn Long', role: 'Chủ tịch', role_code: 'CHAIR' }],
        },
        projects: [
          {
            id: 310,
            student_reg_no: '999000001',
            student_name: 'Nguyễn Test Một',
            student_class: '',
            topic_title_vi: 'Đề tài E2E',
            defense_status: 'DEFENDING',
            supervisor: { full_name: 'Vũ Huấn' },
            reviewer: { full_name: 'Nguyễn Văn Long' },
            supervisor_score: 8.5,
            reviewer_score: 8.0,
            scoring_summary: {
              submitted_count: 1,
              total_eligible_members: 4,
              pending_count: 3,
              is_fully_graded: false,
              members_breakdown: [
                {
                  member_id: 1,
                  user_id: 509,
                  name: 'Nguyễn Văn Long',
                  role: 'Chủ tịch',
                  is_supervisor: false,
                  is_reviewer: true,
                  has_submitted: false,
                },
              ],
            },
          },
        ],
      },
    });

    render(<UTCCouncilLiveDefenseView councilId={22} batchId={17} />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const conflictButtons = screen.getAllByText(/🚫 GVPB \(Không chấm HĐ\)/i);
    expect(conflictButtons.length).toBeGreaterThanOrEqual(1);
    conflictButtons.forEach((btn) => expect(btn).toBeDisabled());
  });
});
