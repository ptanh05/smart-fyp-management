import React from 'react';
import { useBatchProgress } from '../contexts/BatchProgressContext';
import { GRADUATION_STAGES } from '../utils/graduationStages';
import type { BatchMilestoneItem } from './BatchProgressBar';
import './UTCFypTimeline.css';

export interface UTCFypTimelineProps {
  currentStep?: number; // 1 to 6 (fallback) or stage number when milestones present
  milestones?: BatchMilestoneItem[];
  onStageClick?: (stageNumber: number) => void;
}

const formatDateShort = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
};

const formatDaysLeftLabel = (daysLeft?: number | null) => {
  if (daysLeft === null || daysLeft === undefined) return '';
  if (daysLeft < 0) return `Quá hạn ${Math.abs(daysLeft)} ngày`;
  if (daysLeft === 0) return 'Hạn hôm nay';
  return `Còn ${daysLeft} ngày`;
};

const UTCFypTimeline: React.FC<UTCFypTimelineProps> = ({
  currentStep = 1,
  milestones: propMilestones,
  onStageClick,
}) => {
  const { progress } = useBatchProgress();
  const dynamicMilestones: BatchMilestoneItem[] =
    (propMilestones && propMilestones.length > 0 ? propMilestones : progress?.milestones) || [];

  const currentMilestone = progress?.current_milestone;
  const activeStageNumber = progress?.current_stage_number || currentStep;

  if (dynamicMilestones.length > 0) {
    return (
      <div className="utc-timeline-card">
        <div className="utc-timeline-header">
          <h3>📅 Lộ trình mốc thời gian Đồ án Tốt nghiệp (UTC)</h3>
          <span className="utc-timeline-badge">
            {progress?.batch?.batch_code ? `${progress.batch.batch_code} · GĐ ${activeStageNumber}/6` : `Giai đoạn ${activeStageNumber}/6`}
          </span>
        </div>
        <div className="utc-timeline-steps">
          {dynamicMilestones.map((m, idx) => {
            const isActive =
              (currentMilestone && currentMilestone.id === m.id) ||
              (!currentMilestone && m.stage_number === activeStageNumber) ||
              (m.stage_number === activeStageNumber && m.status === 'ACTIVE');
            const stageCompletedInProgress = progress?.stages?.find((s) => s.number === m.stage_number)?.status === 'done';
            const isCompleted = stageCompletedInProgress || (!isActive && m.stage_number < activeStageNumber);
            const cls = isCompleted ? 'completed' : isActive ? 'active' : '';
            const clickableCls = onStageClick ? 'clickable' : '';
            const sStr = formatDateShort(m.start_date);
            const eStr = formatDateShort(m.end_date);
            const dateRange = sStr && eStr ? `${sStr} – ${eStr}` : eStr ? `Hạn ${eStr}` : sStr ? `Từ ${sStr}` : 'Chưa ấn định';
            const daysText = !isCompleted ? formatDaysLeftLabel(m.days_left) : '';

            return (
              <div
                key={m.id || idx}
                className={`utc-step-item ${cls} ${clickableCls}`}
                onClick={onStageClick ? () => onStageClick(m.stage_number) : undefined}
                onKeyDown={onStageClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onStageClick(m.stage_number); } } : undefined}
                role={onStageClick ? 'button' : undefined}
                tabIndex={onStageClick ? 0 : undefined}
                title={m.description || m.name}
              >
                <div className="utc-step-icon">{isCompleted ? '✓' : m.stage_number || idx + 1}</div>
                <div className="utc-step-title">{m.name}</div>
                <div className="utc-step-time">
                  {dateRange}
                  {daysText && (
                    <>
                      <br />
                      <em
                        style={{
                          color: (m.days_left ?? 1) < 0 ? '#dc2626' : m.days_left === 0 ? '#b45309' : undefined,
                          fontWeight: 700,
                        }}
                      >
                        {daysText}
                      </em>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="utc-timeline-card">
      <div className="utc-timeline-header">
        <h3>📅 Lộ trình 6 giai đoạn Đồ án Tốt nghiệp (UTC)</h3>
        <span className="utc-timeline-badge">Theo dõi tiến trình 6 giai đoạn ĐATN</span>
      </div>
      <div className="utc-timeline-steps">
        {GRADUATION_STAGES.map((stage) => {
          const progressStage = progress?.stages?.find((s) => s.number === stage.number);
          const isCompleted = progressStage ? progressStage.status === 'done' : stage.number < activeStageNumber;
          const isActive = progressStage ? progressStage.status === 'active' : stage.number === activeStageNumber;
          const cls = isCompleted ? 'completed' : isActive ? 'active' : '';
          const clickableCls = onStageClick ? 'clickable' : '';

          return (
            <div
              key={stage.key}
              className={`utc-step-item ${cls} ${clickableCls}`}
              onClick={onStageClick ? () => onStageClick(stage.number) : undefined}
              onKeyDown={onStageClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onStageClick(stage.number); } } : undefined}
              role={onStageClick ? 'button' : undefined}
              tabIndex={onStageClick ? 0 : undefined}
              title={stage.description}
            >
              <div className="utc-step-icon">{isCompleted ? '✓' : stage.number}</div>
              <div className="utc-step-title">{stage.shortLabel}</div>
              <div className="utc-step-time">
                {isCompleted ? 'Đã hoàn thành' : isActive ? <em>Đang thực hiện</em> : 'Chưa mở khóa'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default UTCFypTimeline;
