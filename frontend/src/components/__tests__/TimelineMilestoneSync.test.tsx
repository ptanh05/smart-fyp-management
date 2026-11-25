import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '../../i18n';
import { BatchProgressProvider } from '../../contexts/BatchProgressContext';
import BatchProgressBar, { type BatchProgressData } from '../BatchProgressBar';
import UTCFypTimeline from '../UTCFypTimeline';
import RagUtcChatWidget from '../RagUtcChatWidget';
import { GRADUATION_STAGES } from '../../utils/graduationStages';
import { localizeDynamicText } from '../../utils/i18nHelper';

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

  afterEach(async () => {
    await i18n.changeLanguage('vi');
  });

  it('switches between Vietnamese (vi) and English (en) across timeline, progress bar, and AI widget', async () => {
    await i18n.changeLanguage('en');

    const progress = buildProgressData(true);
    progress.milestones[1].name = 'Xây dựng & Phê duyệt Đề cương ĐATN';
    if (progress.current_milestone) {
      progress.current_milestone.name = 'Xây dựng & Phê duyệt Đề cương ĐATN';
    }

    render(
      <MemoryRouter initialEntries={['/student/dashboard']}>
        <BatchProgressProvider progress={progress} loading={false}>
          <BatchProgressBar data={progress} variant="portal" />
          <UTCFypTimeline currentStep={3} />
          <RagUtcChatWidget />
        </BatchProgressProvider>
      </MemoryRouter>
    );

    expect(screen.getByText('Thesis Batch Progress')).toBeInTheDocument();
    expect(screen.getByText(/Batch Open/)).toBeInTheDocument();
    expect(screen.getByText('✓ Done')).toBeInTheDocument();
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getAllByText(/Due today/).length).toBeGreaterThan(0);
    expect(screen.getByText('3. Thesis Outline')).toBeInTheDocument();
    expect(localizeDynamicText('Duyệt đề cương', true)).toBe('Outline Approval');
    expect(screen.getAllByText(/Thesis Outline Drafting & Approval/).length).toBeGreaterThan(0);
    expect(screen.getByText('Ask AI RAG-UTC')).toBeInTheDocument();
    expect(
      localizeDynamicText('Chưa nộp phiếu khảo sát & nguyện vọng', true)
    ).toBe('Preference survey not submitted yet');
  });
});
