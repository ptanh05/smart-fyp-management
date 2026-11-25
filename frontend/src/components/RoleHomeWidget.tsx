import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiService } from '../services/api';
import { isEnglish, localizeDynamicText, tr } from '../utils/i18nHelper';
import './RoleHomeWidget.css';

interface RoleHomeWidgetProps {
  role: 'student' | 'supervisor';
  batchId?: number | null;
  onNavigateTab?: (tabKey: string) => void;
}

export const RoleHomeWidget: React.FC<RoleHomeWidgetProps> = ({ role, batchId, onNavigateTab }) => {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isEn = isEnglish(i18n?.resolvedLanguage || i18n?.language);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        const data = await apiService.getRoleHomeSummary(batchId ?? undefined);
        if (active) setSummary(data);
      } catch {
        if (active) setSummary(null);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [role, batchId]);

  if (loading || !summary) return null;

  const todos: Array<{ urgency: 'high' | 'medium' | 'info'; title: string; description: string; action_url: string; action_tab?: string }> =
    summary.todos || [];
  const milestone = summary.current_milestone;
  const riskAlerts: Array<{
    project_id: number;
    student_reg_no: string;
    student_name: string;
    risk_level: 'AT_RISK' | 'BEHIND' | 'ON_TRACK';
    reasons: string[];
  }> = summary.student_risk_alerts || [];
  const riskSummary = summary.risk_summary;

  const milestoneStateCls =
    typeof milestone?.days_left === 'number'
      ? milestone.days_left < 0
        ? 'overdue'
        : milestone.days_left === 0
        ? 'today'
        : ''
      : '';

  return (
    <div className="utc-rhw-card">
      <div className="utc-rhw-header">
        <div>
          <h3 className="utc-rhw-title">
            {role === 'student'
              ? tr(isEn, '📌 Việc Cần Làm Ngay', '📌 Action Required Now')
              : tr(isEn, '🧭 Bảng Nhắc Việc & Cảnh Báo Tiến Độ', '🧭 Action Items & Progress Risk Alerts')}
          </h3>
          {summary.batch && (
            <div className="utc-rhw-batch-sub">
              {tr(isEn, 'Đợt', 'Batch')} <b>{summary.batch.batch_code}</b>
              {summary.batch.supplementary_open
                ? tr(isEn, ' • 🔓 Đang mở ĐK bổ sung', ' • 🔓 Supplementary Reg. Open')
                : ''}
            </div>
          )}
        </div>

        {milestone && (
          <div className={`utc-rhw-milestone-pill ${milestoneStateCls}`.trim()}>
            ⏳ {localizeDynamicText(milestone.name, isEn)}
            {typeof milestone.days_left === 'number'
              ? milestone.days_left === 0
                ? tr(isEn, ' • Hạn hôm nay', ' • Due today')
                : milestone.days_left > 0
                ? tr(isEn, ` • Còn ${milestone.days_left} ngày`, ` • ${milestone.days_left} days left`)
                : tr(isEn, ` • Quá hạn ${Math.abs(milestone.days_left)} ngày`, ` • Overdue ${Math.abs(milestone.days_left)} days`)
              : ''}
          </div>
        )}
      </div>

      {todos.length === 0 ? (
        <div className="utc-rhw-empty">
          {tr(
            isEn,
            '✅ Hiện tại không có đầu việc gấp hoặc quá hạn nào. Tiến độ đang ổn định!',
            '✅ No urgent or overdue items right now. Your progress is on track!'
          )}
        </div>
      ) : (
        <div className="utc-rhw-todo-grid">
          {todos.map((item, idx) => {
            const isHigh = item.urgency === 'high';
            return (
              <button
                key={idx}
                type="button"
                className={`utc-rhw-todo-btn ${isHigh ? 'high' : ''}`.trim()}
                onClick={() => {
                  if (onNavigateTab && item.action_tab) {
                    onNavigateTab(item.action_tab);
                  } else if (item.action_url) {
                    navigate(item.action_url);
                  }
                }}
              >
                <div className="utc-rhw-todo-title">
                  {isHigh ? '🔥 ' : '⚡ '}
                  {localizeDynamicText(item.title, isEn)}
                </div>
                <div className="utc-rhw-todo-desc">
                  {localizeDynamicText(item.description, isEn)}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {role === 'supervisor' && riskSummary && (
        <div className="utc-rhw-risk-section">
          <div className="utc-rhw-risk-header">
            <span className="utc-rhw-risk-title">
              {tr(isEn, '🚦 Phân Loại Rủi Ro Tiến Độ Sinh Viên', '🚦 Student Progress Risk Breakdown')}
            </span>
            <div className="utc-rhw-risk-pills">
              <span className="utc-rhw-risk-pill at-risk">
                {tr(isEn, '🔴 Nguy cơ cao (AT_RISK):', '🔴 High Risk (AT_RISK):')} {riskSummary.at_risk}
              </span>
              <span className="utc-rhw-risk-pill behind">
                {tr(isEn, '🟡 Chậm nhịp (BEHIND):', '🟡 Behind Schedule (BEHIND):')} {riskSummary.behind}
              </span>
              <span className="utc-rhw-risk-pill on-track">
                {tr(isEn, '🟢 Đúng tiến độ:', '🟢 On Track:')} {riskSummary.on_track}
              </span>
            </div>
          </div>

          {riskAlerts.length > 0 && (
            <div className="utc-rhw-risk-grid">
              {riskAlerts.slice(0, 6).map((alert) => (
                <div
                  key={alert.project_id}
                  className={`utc-rhw-risk-alert ${alert.risk_level === 'AT_RISK' ? 'at-risk' : ''}`.trim()}
                >
                  <div className="utc-rhw-risk-alert-head">
                    <span>{alert.student_name} ({alert.student_reg_no})</span>
                    <span className="utc-rhw-risk-level">{alert.risk_level}</span>
                  </div>
                  <div className="utc-rhw-risk-reasons">
                    {alert.reasons.map((r) => localizeDynamicText(r, isEn)).join(' • ')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RoleHomeWidget;
