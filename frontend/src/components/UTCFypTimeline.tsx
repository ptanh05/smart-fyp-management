import React from 'react';
import { useTranslation } from 'react-i18next';
import { useOptionalBatchProgress } from '../contexts/BatchProgressContext';
import type { BatchMilestoneItem } from './BatchProgressBar';
import './UTCFypTimeline.css';

export interface UTCFypTimelineProps {
  currentStep?: number; // 1 to 5 (fallback) or stage number when milestones present
  milestones?: BatchMilestoneItem[];
}

function formatDateRange(start?: string | null, end?: string | null): string {
  const fmt = (raw?: string | null) => {
    if (!raw) return '';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('vi-VN');
  };
  const s = fmt(start);
  const e = fmt(end);
  if (s && e) return `${s} – ${e}`;
  return s || e || 'Chưa đặt ngày';
}

function formatDaysLeft(days?: number | null): string {
  if (days === null || days === undefined) return '';
  if (days > 0) return `Còn ${days} ngày`;
  if (days === 0) return 'Hạn hôm nay';
  return `Quá hạn ${Math.abs(days)} ngày`;
}

const UTCFypTimeline: React.FC<UTCFypTimelineProps> = ({ currentStep = 3, milestones: propMilestones }) => {
  const { t } = useTranslation();
  const batchCtx = useOptionalBatchProgress();
  const progress = batchCtx?.progress;

  const dynamicMilestones =
    (propMilestones && propMilestones.length > 0 ? propMilestones : progress?.milestones) || [];
  const activeStageNumber = progress?.current_stage_number || currentStep;
  const currentMilestone = progress?.current_milestone;

  if (dynamicMilestones.length > 0) {
    const countdownText = formatDaysLeft(currentMilestone?.days_left ?? progress?.days_left);
    return (
      <div className="utc-timeline-card">
        <div className="utc-timeline-header">
          <h3>📅 {t('dashboard.timelineTitle', 'LỊCH TRÌNH MỐC THỜI GIAN ĐỒ ÁN UTC')}</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {currentMilestone && (
              <span className="utc-timeline-badge">
                GĐ {currentMilestone.stage_number}/6: {currentMilestone.name}
                {countdownText ? ` • ${countdownText}` : ''}
              </span>
            )}
            {progress?.supplementary_open && (
              <span
                className="utc-timeline-badge"
                style={{ background: '#fef3c7', color: '#92400e', borderColor: '#f59e0b' }}
              >
                🔔 Đang mở ĐK bổ sung
              </span>
            )}
          </div>
        </div>

        <div className="utc-timeline-steps">
          {dynamicMilestones.map((m, idx) => {
            const isCompleted = m.stage_number < activeStageNumber || progress?.batch?.current_stage === 'COMPLETED';
            const isActive = !isCompleted && m.stage_number === activeStageNumber;
            const daysText = formatDaysLeft(m.days_left);

            return (
              <div
                key={m.id || idx}
                className={`utc-step-item ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''}`}
              >
                <div className="utc-step-icon">{isCompleted ? '✓' : `GĐ${m.stage_number}`}</div>
                <div>
                  <div className="utc-step-title">{m.name}</div>
                  <div className="utc-step-time">
                    <em>{formatDateRange(m.start_date, m.end_date)}</em>
                    {isActive && daysText ? (
                      <span
                        style={{
                          display: 'block',
                          marginTop: '2px',
                          fontWeight: 700,
                          color: (m.days_left ?? 1) < 0 ? '#dc2626' : '#0369a1',
                        }}
                      >
                        ⏳ {daysText}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const steps = [
    {
      id: 1,
      title: t('timeline.step1', 'Đăng Ký Đề Tài'),
      subtitle: t('timeline.step1Sub', 'Ghép nhóm & Chọn GVHD'),
      time: 'Tuần 1 - 2',
    },
    {
      id: 2,
      title: t('timeline.step2', 'Đề Cương Chi Tiết'),
      subtitle: t('timeline.step2Sub', 'Nộp & Duyệt đề cương'),
      time: 'Tuần 3 - 4',
    },
    {
      id: 3,
      title: t('timeline.step3', 'Đánh Giá Giữa Kỳ'),
      subtitle: t('timeline.step3Sub', 'Báo cáo SDD & Tiến độ'),
      time: 'Tuần 8 - 10',
    },
    {
      id: 4,
      title: t('timeline.step4', 'Nộp Khóa Luận'),
      subtitle: t('timeline.step4Sub', 'Nộp Báo cáo & Mã nguồn'),
      time: 'Tuần 14',
    },
    {
      id: 5,
      title: t('timeline.step5', 'Bảo Vệ UTC'),
      subtitle: t('timeline.step5Sub', 'Chấm điểm Hội đồng'),
      time: 'Tuần 16',
    },
  ];

  return (
    <div className="utc-timeline-card">
      <div className="utc-timeline-header">
        <h3>📅 {t('dashboard.timelineTitle', 'LỊCH TRÌNH TIẾN ĐỘ ĐỒ ÁN TỐT NGHIỆP UTC')}</h3>
        <span className="utc-timeline-badge">
          Step {currentStep}/5 ({steps[currentStep - 1]?.title})
        </span>
      </div>

      <div className="utc-timeline-steps">
        {steps.map((step) => {
          const isCompleted = step.id < currentStep;
          const isActive = step.id === currentStep;

          return (
            <div
              key={step.id}
              className={`utc-step-item ${isCompleted ? 'completed' : ''} ${
                isActive ? 'active' : ''
              }`}
            >
              <div className="utc-step-icon">
                {isCompleted ? '✓' : step.id}
              </div>
              <div>
                <div className="utc-step-title">{step.title}</div>
                <div className="utc-step-time">
                  {step.subtitle} • <em>{step.time}</em>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default UTCFypTimeline;