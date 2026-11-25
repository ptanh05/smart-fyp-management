import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { BatchProgressProvider } from '../../contexts/BatchProgressContext';
import BatchProgressBar, { type BatchProgressData } from '../BatchProgressBar';
import UTCFypTimeline from '../UTCFypTimeline';
import { GRADUATION_STAGES } from '../../utils/graduationStages';

const buildProgressData = (withMilestones = true): BatchProgressData => ({
  batch: {
    id: 10,
    batch_code: 'K65-TEST',
    batch_name: 'Đợt Test K65',
    program_type: 'BACHELOR',
    current_stage: 'PHASE_3_TOPIC',
    is_active: true,
    is_closed: false,
  },
  is_open: true,
  current_stage_number: 3,
  stages: GRADUATION_STAGES.map((st) => ({
    number: st.number,
    key: st.key,
    label: st.label,
    short_label: st.shortLabel,
    icon: st.icon,
    description: st.description,
    status: st.number < 3 ? 'done' : st.number === 3 ? 'active' : 'pending',
    percent: st.number < 3 ? 100 : st.number === 3 ? 50 : 0,
  })),
  milestones: withMilestones
    ? [
        {
          id: 1,
          name: 'Mốc GĐ1 Khởi tạo',
          stage_number: 1,
          start_date: '2026-09-01T08:00:00+07:00',
          end_date: '2026-09-15T23:59:59+07:00',
          status: 'EXPIRED',
          days_left: -10,
        },
        {
          id: 3,
          name: 'Mốc GĐ3 Nộp đề cương',
          stage_number: 3,
          start_date: '2026-10-01T08:00:00+07:00',
          end_date: '2026-10-20T23:59:59+07:00',
          status: 'ACTIVE',
          days_left: 0,
        },
      ]
    : [],
  current_milestone: withMilestones
    ? {
        id: 3,
        name: 'Mốc GĐ3 Nộp đề cương',
        stage_number: 3,
        start_date: '2026-10-01T08:00:00+07:00',
        end_date: '2026-10-20T23:59:59+07:00',
        status: 'ACTIVE',
        days_left: 0,
      }
    : null,
});

describe('BatchProgressBar & UTCFypTimeline milestone sync', () => {
  it('renders per-stage dates, Hạn hôm nay badge, and fires onStageClick', () => {
    const onStageClick = vi.fn();
    render(
      <BatchProgressBar
        data={buildProgressData(true)}
        variant="portal"
        onStageClick={onStageClick}
      />
    );

    expect(screen.getByText('✓ Xong')).toBeInTheDocument();
    expect(screen.getByText('Hôm nay')).toBeInTheDocument();
    expect(screen.getByText(/Hạn hôm nay/)).toBeInTheDocument();

    fireEvent.click(screen.getByText(GRADUATION_STAGES[2].shortLabel));
    expect(onStageClick).toHaveBeenCalledWith(expect.objectContaining({ number: 3 }));
  });

  it('UTCFypTimeline falls back to 6 GRADUATION_STAGES when unseeded and navigates on click', () => {
    const onStageClick = vi.fn();
    render(
      <BatchProgressProvider progress={buildProgressData(false)} loading={false}>
        <UTCFypTimeline currentStep={3} onStageClick={onStageClick} />
      </BatchProgressProvider>
    );

    expect(screen.queryByText(/Tuần 1-2/)).not.toBeInTheDocument();
    for (const st of GRADUATION_STAGES) {
      expect(screen.getByText(st.shortLabel)).toBeInTheDocument();
    }

    fireEvent.click(screen.getByText(GRADUATION_STAGES[4].shortLabel));
    expect(onStageClick).toHaveBeenCalledWith(5);
  });
});
