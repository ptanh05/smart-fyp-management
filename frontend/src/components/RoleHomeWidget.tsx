import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';

interface RoleHomeWidgetProps {
  role: 'student' | 'supervisor';
  batchId?: number | null;
}

export const RoleHomeWidget: React.FC<RoleHomeWidgetProps> = ({ role, batchId }) => {
  const navigate = useNavigate();
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

  const todos: Array<{ urgency: 'high' | 'medium' | 'info'; title: string; description: string; action_url: string }> =
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

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '14px',
        padding: '18px 20px',
        marginBottom: '20px',
        boxShadow: '0 4px 14px rgba(15, 23, 42, 0.05)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
            {role === 'student' ? '📌 Việc Cần Làm Ngay' : '🧭 Bảng Nhắc Việc & Cảnh Báo Tiến Độ'}
          </h3>
          {summary.batch && (
            <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '2px' }}>
              Đợt <b>{summary.batch.batch_code}</b>
              {summary.batch.supplementary_open ? ' • 🔓 Đang mở ĐK bổ sung' : ''}
            </div>
          )}
        </div>

        {milestone && (
          <div
            style={{
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              color: '#1d4ed8',
              borderRadius: '999px',
              padding: '5px 12px',
              fontSize: '0.8rem',
              fontWeight: 700,
            }}
          >
            ⏳ {milestone.name}
            {typeof milestone.days_left === 'number'
              ? milestone.days_left >= 0
                ? ` • Còn ${milestone.days_left} ngày`
                : ` • Quá hạn ${Math.abs(milestone.days_left)} ngày`
              : ''}
          </div>
        )}
      </div>

      {todos.length === 0 ? (
        <div style={{ fontSize: '0.86rem', color: '#059669', background: '#ecfdf5', padding: '10px 14px', borderRadius: '10px', border: '1px solid #a7f3d0', fontWeight: 600 }}>
          ✅ Hiện tại không có đầu việc gấp hoặc quá hạn nào. Tiến độ đang ổn định!
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px' }}>
          {todos.map((item, idx) => {
            const isHigh = item.urgency === 'high';
            return (
              <button
                key={idx}
                type="button"
                onClick={() => item.action_url && navigate(item.action_url)}
                style={{
                  textAlign: 'left',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: `1px solid ${isHigh ? '#fca5a5' : '#fcd34d'}`,
                  background: isHigh ? '#fef2f2' : '#fffbeb',
                  cursor: 'pointer',
                  transition: 'transform 0.12s ease',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: isHigh ? '#b91c1c' : '#92400e' }}>
                  {isHigh ? '🔥 ' : '⚡ '}
                  {item.title}
                </div>
                <div style={{ fontSize: '0.79rem', color: '#475569', marginTop: '4px', lineHeight: 1.4 }}>
                  {item.description}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {role === 'supervisor' && riskSummary && (
        <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>
              🚦 Phân Loại Rủi Ro Tiến Độ Sinh Viên
            </span>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '0.78rem', fontWeight: 700 }}>
              <span style={{ padding: '2px 8px', borderRadius: '999px', background: '#fee2e2', color: '#b91c1c' }}>
                🔴 Nguy cơ cao (AT_RISK): {riskSummary.at_risk}
              </span>
              <span style={{ padding: '2px 8px', borderRadius: '999px', background: '#fef3c7', color: '#92400e' }}>
                🟡 Chậm nhịp (BEHIND): {riskSummary.behind}
              </span>
              <span style={{ padding: '2px 8px', borderRadius: '999px', background: '#dcfce7', color: '#166534' }}>
                🟢 Đúng tiến độ: {riskSummary.on_track}
              </span>
            </div>
          </div>

          {riskAlerts.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '8px' }}>
              {riskAlerts.slice(0, 6).map((alert) => (
                <div
                  key={alert.project_id}
                  style={{
                    padding: '9px 12px',
                    borderRadius: '8px',
                    background: alert.risk_level === 'AT_RISK' ? '#fff1f2' : '#fefce8',
                    border: `1px solid ${alert.risk_level === 'AT_RISK' ? '#fecdd3' : '#fde68a'}`,
                    fontSize: '0.82rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#0f172a' }}>
                    <span>{alert.student_name} ({alert.student_reg_no})</span>
                    <span style={{ color: alert.risk_level === 'AT_RISK' ? '#dc2626' : '#d97706' }}>{alert.risk_level}</span>
                  </div>
                  <div style={{ color: '#475569', fontSize: '0.77rem', marginTop: '3px' }}>
                    {alert.reasons.join(' • ')}
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
