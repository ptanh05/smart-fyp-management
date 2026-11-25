/**
 * BatchProgressBar — Thanh tiến trình 6 giai đoạn của một Đợt đồ án (song ngữ Việt – Anh).
 * Dùng chung cho Admin Portal và Cổng Sinh viên / Giảng viên.
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './BatchProgressBar.css';
import type { ProjectWorkflow } from '../utils/graduationStages';
import { isEnglish, localizeDynamicText, tr } from '../utils/i18nHelper';

export interface BatchStage {
  number: number;
  key: string;
  code?: string;
  label: string;
  short_label: string;
  icon: string;
  description: string;
  role_hint?: string;
  status: 'done' | 'active' | 'pending' | 'locked';
  percent: number;
  stats?: Record<string, string | number>;
  action_hint?: string;
}

export interface BatchMilestoneItem {
  id: number;
  name: string;
  stage_number: number;
  start_date?: string | null;
  end_date?: string | null;
  description?: string;
  order_index?: number;
  status: 'UPCOMING' | 'ACTIVE' | 'EXPIRED' | 'UNSCHEDULED';
  days_left?: number | null;
}

export interface BatchProgressData {
  batch?: {
    id: number;
    batch_code: string;
    batch_name: string;
    program_type: string;
    current_stage: string;
    is_active: boolean;
    is_closed: boolean;
    supplementary_open?: boolean;
    start_date?: string | null;
    end_date?: string | null;
  };
  is_open?: boolean;
  supplementary_open?: boolean;
  current_stage_number: number;
  current_stage?: BatchStage;
  current_stage_key?: string;
  current_stage_label?: string;
  batch_status?: string | null;
  overall_percent: number;
  stages: BatchStage[];
  milestones?: BatchMilestoneItem[];
  current_milestone?: BatchMilestoneItem | null;
  days_left?: number | null;
  next_actions?: string[];
  my_project?: {
    id?: number;
    status?: string;
    topic_title?: string;
    supervisor_name?: string;
    topic_review_status?: string;
    workflow?: ProjectWorkflow;
  };
  /** Tiến trình cá nhân do backend tính (chỉ có với Sinh viên). */
  workflow?: ProjectWorkflow;
}

interface Props {
  data: BatchProgressData | null;
  loading?: boolean;
  showStats?: boolean;
  onStageClick?: (stage: BatchStage) => void;
  onRefresh?: () => void;
  title?: string;
  variant?: 'admin' | 'portal';
}

const shortDateVi = (iso?: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
};

const pickStageMilestone = (milestones: BatchMilestoneItem[] | undefined, stageNumber: number): BatchMilestoneItem | undefined => {
  if (!milestones || milestones.length === 0) return undefined;
  const list = milestones.filter((m) => m.stage_number === stageNumber);
  if (list.length === 0) return undefined;
  return list.find((m) => m.status === 'ACTIVE') || list.find((m) => m.status === 'UPCOMING') || list[0];
};

const formatMilestoneCountdown = (
  daysLeft: number | null | undefined,
  compact: boolean,
  isEn: boolean
): { text: string; cls: string } | null => {
  if (daysLeft === null || daysLeft === undefined) return null;
  if (daysLeft < 0) {
    const abs = Math.abs(daysLeft);
    return {
      text: compact ? tr(isEn, `Quá ${abs}n`, `${abs}d late`) : tr(isEn, `Quá hạn ${abs} ngày`, `Overdue ${abs} days`),
      cls: 'overdue',
    };
  }
  if (daysLeft === 0) {
    return {
      text: compact ? tr(isEn, 'Hôm nay', 'Today') : tr(isEn, 'Hạn hôm nay', 'Due today'),
      cls: 'today',
    };
  }
  return {
    text: compact ? tr(isEn, `Còn ${daysLeft}n`, `${daysLeft}d left`) : tr(isEn, `Còn ${daysLeft} ngày`, `${daysLeft} days left`),
    cls: '',
  };
};

export const BatchProgressBar: React.FC<Props> = ({
  data,
  loading = false,
  showStats = true,
  onStageClick,
  onRefresh,
  title,
  variant = 'portal',
}) => {
  const { i18n } = useTranslation();
  const isEn = isEnglish(i18n?.resolvedLanguage || i18n?.language);
  const [expanded, setExpanded] = useState<number | null>(null);

  const statusLabels: Record<BatchStage['status'], string> = {
    done: tr(isEn, 'Đã hoàn thành', 'Completed'),
    active: tr(isEn, 'Đang thực hiện', 'In Progress'),
    pending: tr(isEn, 'Chưa bắt đầu', 'Not Started'),
    locked: tr(isEn, 'Đang khóa', 'Locked'),
  };

  if (loading) {
    return (
      <div className={`utc-bpb utc-bpb-${variant} utc-bpb-loading`}>
        <div className="utc-bpb-skeleton-line" />
        <div className="utc-bpb-skeleton-steps">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="utc-bpb-skeleton-step" />
          ))}
        </div>
      </div>
    );
  }

  if (!data || !data.stages || data.stages.length === 0) {
    return (
      <div className={`utc-bpb utc-bpb-${variant} utc-bpb-empty`}>
        <div className="utc-bpb-empty-icon">📭</div>
        <div className="utc-bpb-empty-text">
          <strong>{tr(isEn, 'Chưa có đợt đồ án nào đang hoạt động', 'No active thesis batch available')}</strong>
          <span>{tr(isEn, 'Liên hệ Khoa CNTT để được thêm vào đợt đồ án hiện tại.', 'Please contact FIT Faculty to be enrolled in the current thesis batch.')}</span>
        </div>
      </div>
    );
  }

  const currentStage = data.stages.find((s) => s.number === data.current_stage_number);
  const programLabel =
    data.batch?.program_type === 'ENGINEER'
      ? tr(isEn, '⚙️ Hệ Kỹ sư', '⚙️ Engineer Program')
      : data.batch?.program_type === 'BACHELOR'
        ? tr(isEn, '🎓 Hệ Cử nhân', '🎓 Bachelor Program')
        : tr(isEn, '🔄 Cả Cử nhân & Kỹ sư', '🔄 Bachelor & Engineer');

  const resolvedTitle =
    !title || title === 'Tiến Trình Đợt Đồ Án'
      ? tr(isEn, 'Tiến Trình Đợt Đồ Án', 'Thesis Batch Progress')
      : title;

  return (
    <div className={`utc-bpb utc-bpb-${variant}`}>
      {/* ---------- Header ---------- */}
      <div className="utc-bpb-header">
        <div className="utc-bpb-header-left">
          <span className="utc-bpb-title-icon">🚦</span>
          <div className="utc-bpb-title-group">
            <span className="utc-bpb-title">
              {resolvedTitle}
              {data.batch?.batch_code ? (
                <span className="utc-bpb-batch-code">{data.batch.batch_code}</span>
              ) : null}
            </span>
            <span className="utc-bpb-subtitle">
              {data.batch?.batch_name || ''} · {programLabel}
            </span>
          </div>
        </div>

        <div className="utc-bpb-header-right">
          <span
            className={`utc-bpb-status-pill ${data.is_open !== false ? 'open' : 'closed'}`}
            title={
              data.is_open !== false
                ? tr(isEn, 'Đợt đang mở cho sinh viên đăng ký', 'Batch is currently open')
                : tr(isEn, 'Đợt đang đóng / đã kết thúc', 'Batch is closed / completed')
            }
          >
            {data.is_open !== false ? tr(isEn, '🟢 Đợt đang mở', '🟢 Batch Open') : tr(isEn, '🔴 Đợt đã đóng', '🔴 Batch Closed')}
          </span>
          <span className="utc-bpb-percent" title={tr(isEn, 'Tiến độ tổng thể của đợt', 'Overall batch progress')}>
            {Math.round(data.overall_percent || 0)}%
          </span>
          {onRefresh && (
            <button
              type="button"
              className="utc-bpb-refresh"
              onClick={onRefresh}
              title={tr(isEn, 'Làm mới tiến trình', 'Refresh progress')}
            >
              🔄
            </button>
          )}
        </div>
      </div>

      {/* ---------- Thanh % tổng thể ---------- */}
      <div className="utc-bpb-overall-track">
        <div
          className="utc-bpb-overall-fill"
          style={{ width: `${Math.min(100, Math.max(0, data.overall_percent || 0))}%` }}
        />
      </div>

      {/* ---------- 6 bước ---------- */}
      <div className="utc-bpb-steps">
        {data.stages.map((stage) => {
          const isActive = stage.number === data.current_stage_number;
          const isExpanded = expanded === stage.number;
          const localizedShortLabel = localizeDynamicText(stage.short_label, isEn);
          const localizedDesc = localizeDynamicText(stage.description, isEn);

          return (
            <div
              key={stage.number}
              className={`utc-bpb-step ${stage.status} ${isActive ? 'current' : ''}`}
            >
              <button
                type="button"
                className="utc-bpb-step-head"
                onClick={() => {
                  setExpanded(isExpanded ? null : stage.number);
                  if (onStageClick) onStageClick(stage);
                }}
                title={localizedDesc}
              >
                <span className="utc-bpb-step-dot">
                  {stage.status === 'done' ? '✓' : stage.number}
                </span>
                <span className="utc-bpb-step-icon">{stage.icon}</span>
                <span className="utc-bpb-step-body">
                  <span className="utc-bpb-step-label">{localizedShortLabel}</span>
                  <span className="utc-bpb-step-status">{statusLabels[stage.status]}</span>
                  {(() => {
                    const ms = pickStageMilestone(data.milestones, stage.number);
                    if (!ms) return null;
                    const sStr = shortDateVi(ms.start_date);
                    const eStr = shortDateVi(ms.end_date);
                    const dateRange = sStr && eStr ? `${sStr}–${eStr}` : eStr ? `${tr(isEn, 'Hạn', 'Due')} ${eStr}` : sStr ? `${tr(isEn, 'Từ', 'From')} ${sStr}` : '';
                    const badge =
                      stage.status === 'done'
                        ? { text: tr(isEn, '✓ Xong', '✓ Done'), cls: 'done' }
                        : formatMilestoneCountdown(ms.days_left, true, isEn);
                    if (!dateRange && !badge) return null;
                    return (
                      <span className="utc-bpb-step-ms-meta">
                        {dateRange && <span className="utc-bpb-step-ms-dates">{dateRange}</span>}
                        {badge && <span className={`utc-bpb-step-ms-badge ${badge.cls}`}>{badge.text}</span>}
                      </span>
                    );
                  })()}
                </span>
              </button>

              {showStats && isExpanded && (
                <div className="utc-bpb-step-detail">
                  {(() => {
                    const ms = pickStageMilestone(data.milestones, stage.number);
                    if (!ms) return null;
                    const sStr = shortDateVi(ms.start_date);
                    const eStr = shortDateVi(ms.end_date);
                    const rangeText = sStr && eStr ? `${sStr} → ${eStr}` : eStr ? `${tr(isEn, 'Hạn', 'Due')} ${eStr}` : sStr ? `${tr(isEn, 'Từ', 'From')} ${sStr}` : '';
                    const cd = stage.status === 'done' ? null : formatMilestoneCountdown(ms.days_left, false, isEn);
                    return (
                      <p className="utc-bpb-step-ms-detail">
                        🗓️ {localizeDynamicText(ms.name, isEn)}{rangeText ? ` (${rangeText})` : ''}{cd ? ` · ${cd.text}` : ''}
                      </p>
                    );
                  })()}
                  <p className="utc-bpb-step-desc">{localizedDesc}</p>
                  {stage.role_hint && (
                    <p className="utc-bpb-step-role">👤 {tr(isEn, 'Trách nhiệm', 'Responsibility')}: {localizeDynamicText(stage.role_hint, isEn)}</p>
                  )}
                  {stage.action_hint && (
                    <p className="utc-bpb-step-action">👉 {localizeDynamicText(stage.action_hint, isEn)}</p>
                  )}
                  {stage.stats && Object.keys(stage.stats).length > 0 && (
                    <div className="utc-bpb-step-stats">
                      {Object.entries(stage.stats).map(([k, v]) => (
                        <span key={k} className="utc-bpb-stat-chip">
                          {localizeDynamicText(k, isEn)}: <strong>{v}</strong>
                        </span>
                      ))}
                    </div>
                  )}
                  {isActive && stage.percent > 0 && (
                    <div className="utc-bpb-mini-track">
                      <div
                        className="utc-bpb-mini-fill"
                        style={{ width: `${Math.min(100, stage.percent)}%` }}
                      />
                      <span className="utc-bpb-mini-label">{stage.percent}%</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ---------- Hành động tiếp theo ---------- */}
      {currentStage && (
        <div className="utc-bpb-next">
          <span className="utc-bpb-next-label">{tr(isEn, 'Giai đoạn hiện tại:', 'Current stage:')}</span>
          <span className="utc-bpb-next-value">
            {currentStage.icon} {localizeDynamicText(currentStage.label, isEn)}
          </span>
          {data.next_actions && data.next_actions.length > 0 && (
            <span className="utc-bpb-next-hint">· {localizeDynamicText(data.next_actions[0], isEn)}</span>
          )}
          {data.current_milestone && (
            <span className="utc-bpb-next-hint" style={{ fontWeight: 700, color: (data.current_milestone.days_left ?? 1) < 0 ? '#dc2626' : data.current_milestone.days_left === 0 ? '#b45309' : '#0369a1' }}>
              · 🗓️ {localizeDynamicText(data.current_milestone.name, isEn)}
              {data.current_milestone.days_left !== null && data.current_milestone.days_left !== undefined
                ? (data.current_milestone.days_left === 0
                    ? tr(isEn, ' (Hạn hôm nay)', ' (Due today)')
                    : data.current_milestone.days_left > 0
                    ? tr(isEn, ` (Còn ${data.current_milestone.days_left} ngày)`, ` (${data.current_milestone.days_left} days left)`)
                    : tr(isEn, ` (Quá hạn ${Math.abs(data.current_milestone.days_left)} ngày)`, ` (Overdue ${Math.abs(data.current_milestone.days_left)} days)`))
                : ''}
            </span>
          )}
          {(data.supplementary_open || data.batch?.supplementary_open) && (
            <span className="utc-bpb-next-hint" style={{ fontWeight: 700, color: '#b45309' }}>
              · 🔔 {tr(isEn, 'Đang mở ĐK bổ sung', 'Supplementary Reg. Open')}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default BatchProgressBar;
