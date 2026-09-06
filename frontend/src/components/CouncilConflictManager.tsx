import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';

interface ConflictItem {
  council_id: number;
  council_name: string;
  council_number: number;
  member_id: number;
  member_user_id: number;
  member_name: string;
  member_role: string;
  project_id: number;
  project_title: string;
  student_name: string;
  student_reg_no: string;
  conflict_type: 'SUPERVISOR' | 'REVIEWER';
  severity: string;
  message: string;
}

interface CouncilSummary {
  council_id: number;
  council_name: string;
  council_number: number;
  total_members: number;
  total_projects: number;
  has_conflict: boolean;
  conflicts_count: number;
  conflicts: ConflictItem[];
}

export const CouncilConflictManager: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    has_conflict: boolean;
    total_conflicts: number;
    conflicts: ConflictItem[];
    councils_summary: CouncilSummary[];
  } | null>(null);
  const [filterOnlyConflicts, setFilterOnlyConflicts] = useState(false);

  const fetchConflicts = async () => {
    setLoading(true);
    try {
      const res = await apiService.getCouncilConflicts();
      setData(res);
    } catch (err) {
      console.error('Failed to load council conflicts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConflicts();
  }, []);

  if (loading) {
    return (
      <div className="card" style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
        <p>⏳ Đang rà soát xung đột lợi ích (Conflict of Interest) trong các hội đồng...</p>
      </div>
    );
  }

  const displayedCouncils = filterOnlyConflicts
    ? data?.councils_summary.filter((c) => c.has_conflict) || []
    : data?.councils_summary || [];

  return (
    <div className="card space-y-5" style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>⚖️ Rà Soát Xung Đột Lợi Ích (Conflict of Interest)</span>
            {data?.has_conflict ? (
              <span style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '9999px', backgroundColor: '#fee2e2', color: '#b91c1c', border: '1px solid #f87171', fontWeight: 700 }}>
                ⚠️ Phát hiện {data.total_conflicts} xung đột
              </span>
            ) : (
              <span style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '9999px', backgroundColor: '#dcfce7', color: '#15803d', border: '1px solid #86efac', fontWeight: 700 }}>
                ✅ Tất cả hội đồng hợp lệ
              </span>
            )}
          </h2>
          <p style={{ margin: '6px 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
            Quy chế bảo vệ ĐATN UTC: Giảng viên hướng dẫn (GVHD) không được chấm điểm Hội đồng cho SV của mình. Khuyến nghị không xếp GVHD cùng hội đồng với sinh viên.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <label style={{ fontSize: '0.82rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={filterOnlyConflicts}
              onChange={(e) => setFilterOnlyConflicts(e.target.checked)}
            />
            Chỉ xem HĐ có xung đột
          </label>

          <button
            onClick={fetchConflicts}
            className="btn btn-outline"
            style={{ padding: '6px 14px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            🔄 Kiểm tra lại
          </button>
        </div>
      </div>

      {/* Global Summary Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div style={{ padding: '16px', borderRadius: '10px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Tổng số Hội đồng</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>{data?.councils_summary.length || 0}</div>
        </div>

        <div style={{ padding: '16px', borderRadius: '10px', backgroundColor: data?.has_conflict ? '#fef2f2' : '#f0fdf4', border: `1px solid ${data?.has_conflict ? '#fecaca' : '#bbf7d0'}` }}>
          <div style={{ fontSize: '0.8rem', color: data?.has_conflict ? '#b91c1c' : '#15803d' }}>
            Số HĐ có vi phạm quy chế
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: data?.has_conflict ? '#dc2626' : '#16a34a' }}>
            {data?.councils_summary.filter((c) => c.has_conflict).length || 0}
          </div>
        </div>

        <div style={{ padding: '16px', borderRadius: '10px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Tổng số vi phạm COI</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: data?.has_conflict ? '#ef4444' : '#10b981' }}>
            {data?.total_conflicts || 0}
          </div>
        </div>
      </div>

      {/* Councils Breakdown */}
      <div style={{ marginTop: '20px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#1e293b', marginBottom: '12px' }}>
          Chi tiết Danh sách Hội đồng & Trạng thái Phân công
        </h3>

        {displayedCouncils.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '8px', color: '#64748b', fontSize: '0.88rem' }}>
            {filterOnlyConflicts ? '🎉 Không có hội đồng nào vi phạm xung đột lợi ích!' : 'Chưa có dữ liệu hội đồng nào trong đợt này.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {displayedCouncils.map((c) => (
              <div
                key={c.council_id}
                style={{
                  padding: '16px',
                  borderRadius: '10px',
                  border: `1.5px solid ${c.has_conflict ? '#f87171' : '#e2e8f0'}`,
                  backgroundColor: c.has_conflict ? '#fff5f5' : '#ffffff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>
                      {c.council_name} (HĐ #{c.council_number})
                    </span>
                    <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                      • {c.total_members} thành viên • {c.total_projects} đề tài
                    </span>
                  </div>

                  <div>
                    {c.has_conflict ? (
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '3px 8px', borderRadius: '4px', backgroundColor: '#fee2e2', color: '#b91c1c', border: '1px solid #f87171' }}>
                        ⚠️ Có {c.conflicts_count} xung đột
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '3px 8px', borderRadius: '4px', backgroundColor: '#dcfce7', color: '#15803d', border: '1px solid #86efac' }}>
                        ✅ Hợp lệ
                      </span>
                    )}
                  </div>
                </div>

                {/* Conflict Items List */}
                {c.has_conflict && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed #fca5a5' }}>
                    {c.conflicts.map((conf, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '6px',
                          backgroundColor: '#fef2f2',
                          border: '1px solid #fecaca',
                          display: 'flex',
                          flexWrap: 'wrap',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '0.82rem',
                        }}
                      >
                        <div>
                          <p style={{ margin: 0, fontWeight: 600, color: '#991b1b' }}>
                            {conf.message}
                          </p>
                          <p style={{ margin: '2px 0 0 0', color: '#64748b', fontSize: '0.75rem' }}>
                            Đề tài: <em>{conf.project_title}</em>
                          </p>
                        </div>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', backgroundColor: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5' }}>
                            {conf.conflict_type}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: '#dc2626', fontStyle: 'italic' }}>
                            Miễn chấm HĐ
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CouncilConflictManager;
