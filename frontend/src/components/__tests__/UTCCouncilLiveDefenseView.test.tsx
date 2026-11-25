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
});
