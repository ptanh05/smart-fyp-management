import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { GRADUATION_STAGES, type ProjectWorkflow } from '../../utils/graduationStages';

const notifyWarning = vi.fn();
vi.mock('../../utils/notify', () => ({
  notify: { warning: (...args: any[]) => notifyWarning(...args), success: vi.fn(), error: vi.fn(), info: vi.fn() },
  notifyError: vi.fn(),
}));

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const mockUser = { id: 1, registration_no: 'SV001', user: { user_type: 'student' } };
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, logout: vi.fn() }),
}));

function buildWorkflow(current: number): ProjectWorkflow {
  return {
    current_stage_number: current,
    current_stage_key: GRADUATION_STAGES[current - 1].key,
    current_stage_label: GRADUATION_STAGES[current - 1].label,
    overall_percent: Math.round(((current - 1) * 100) / 6),
    project_status: 'OUTLINE_APPROVED',
    batch_status: 'PHASE_4_ELIGIBILITY',
    stages: GRADUATION_STAGES.map((stage) => ({
      number: stage.number,
      key: stage.key,
      label: stage.label,
      status: stage.number < current ? 'completed' : stage.number === current ? 'active' : 'locked',
      accessible: stage.number <= current,
      editable: stage.number === current,
      reason: stage.number > current ? `Cần hoàn thành GĐ${current} trước.` : null,
    })),
  };
}

let profileWorkflow = buildWorkflow(4);
vi.mock('../../services/api', () => ({
  apiService: {
    getStudentProfile: vi.fn(async () => ({
      id: 1,
      registration_no: 'SV001',
      workflow: profileWorkflow,
      graduation_project: { id: 9, status: 'OUTLINE_APPROVED', workflow: profileWorkflow },
    })),
    getStudentSupervisionLogs: vi.fn(async () => []),
  },
}));

// Layout giả: sidebar gọi onTabChange như bản thật.
vi.mock('../../components/UTCAppLayout', () => ({
  default: ({ children, onTabChange, currentStageNumber }: any) => (
    <div>
      <div data-testid="sidebar-stage">{currentStageNumber}</div>
      {GRADUATION_STAGES.map((st) => (
        <button key={st.key} type="button" onClick={() => onTabChange(st.key)}>
          sidebar-{st.key}
        </button>
      ))}
      {children}
    </div>
  ),
}));

// Màn hình giai đoạn giả: hiển thị tab nhận được và cho đổi tab nội bộ.
vi.mock('../../components/UTCStudentGraduationView', () => ({
  UTCStudentGraduationView: ({ initialTab, onSubtabChange }: any) => (
    <div>
      <div data-testid="content-tab">{initialTab}</div>
      <button type="button" onClick={() => onSubtabChange('outline')}>content-outline</button>
      <button type="button" onClick={() => onSubtabChange('weekly')}>content-weekly</button>
    </div>
  ),
}));

vi.mock('../../components/Navbar', () => ({ default: () => null }));
vi.mock('../../components/StudentTemplatesView', () => ({ default: () => null }));
vi.mock('../../components/UTCFypTimeline', () => ({ default: () => null }));
vi.mock('../../components/UTCEvaluationSheetModal', () => ({ default: () => null }));
vi.mock('../../components/UTCSupervisorGroupChatView', () => ({ UTCSupervisorGroupChatView: () => null }));
vi.mock('../../components/SkeletonLoader', () => ({ SkeletonProfile: () => <div>loading</div> }));

import StudentDashboard from '../StudentDashboard';

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.search}</div>;
}

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route
          path="/dashboard"
          element={
            <>
              <StudentDashboard />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

const subtabOf = () => new URLSearchParams(screen.getByTestId('location').textContent || '').get('subtab');

describe('StudentDashboard – URL subtab ↔ giai đoạn backend', () => {
  beforeEach(() => {
    notifyWarning.mockClear();
    profileWorkflow = buildWorkflow(4);
  });

  it('11. reload với subtab hợp lệ giữ đúng tab và URL', async () => {
    renderAt('/dashboard?tab=utc_graduation&subtab=outline');
    await waitFor(() => expect(screen.getByTestId('content-tab').textContent).toBe('outline'));
    expect(subtabOf()).toBe('outline');
    expect(notifyWarning).not.toHaveBeenCalled();
  });

  it('12. URL tới giai đoạn tương lai -> về giai đoạn hiện tại, sửa URL và báo lý do', async () => {
    renderAt('/dashboard?tab=utc_graduation&subtab=grade');
    await waitFor(() => expect(screen.getByTestId('content-tab').textContent).toBe('weekly'));
    await waitFor(() => expect(subtabOf()).toBe('weekly'));
    expect(notifyWarning).toHaveBeenCalledTimes(1);
    expect(String(notifyWarning.mock.calls[0][0])).toContain('GĐ4');
  });

  it('13. chuyển tab: URL và UI luôn khớp, không bật ngược; tab khóa bị từ chối', async () => {
    renderAt('/dashboard?tab=utc_graduation&subtab=weekly');
    await waitFor(() => expect(screen.getByTestId('content-tab').textContent).toBe('weekly'));

    await act(async () => {
      fireEvent.click(screen.getByText('content-outline'));
    });
    await waitFor(() => expect(subtabOf()).toBe('outline'));
    expect(screen.getByTestId('content-tab').textContent).toBe('outline');

    await act(async () => {
      fireEvent.click(screen.getByText('sidebar-survey'));
    });
    await waitFor(() => expect(subtabOf()).toBe('survey'));
    expect(screen.getByTestId('content-tab').textContent).toBe('survey');

    await act(async () => {
      fireEvent.click(screen.getByText('sidebar-supervision'));
    });
    await waitFor(() => expect(subtabOf()).toBe('weekly'));
    expect(screen.getByTestId('content-tab').textContent).toBe('weekly');
    expect(notifyWarning).toHaveBeenCalled();
  });

  it('14. sidebar và nội dung dùng cùng số giai đoạn từ workflow', async () => {
    profileWorkflow = buildWorkflow(3);
    renderAt('/dashboard?tab=utc_graduation');
    await waitFor(() => expect(screen.getByTestId('content-tab').textContent).toBe('outline'));
    expect(screen.getByTestId('sidebar-stage').textContent).toBe('3');
  });
});
