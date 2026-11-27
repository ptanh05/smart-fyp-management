/**
 * WorkloadDashboard – hiển thị danh sách đồ án của giảng viên nhóm theo vai trò.
 * Endpoint: GET /app/lecturer/workload/
 * Fallback gracefully nếu 404 (backend chưa triển khai).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { apiService } from '../../services/api';
import type { LecturerWorkloadItem } from '../../services/api';
import { notifyError } from '../../utils/notify';

const ROLE_LABELS: Record<string, string> = {
  SUPERVISOR: 'GV hướng dẫn',
  REVIEWER: 'GV phản biện',
  COUNCIL: 'Hội đồng',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Chờ xử lý',
  TOPIC_DRAFT: 'Thảo đề tài',
  TOPIC_APPROVED: 'Đề tài duyệt',
  IN_PROGRESS: 'Đang thực hiện',
  SUBMITTED: 'Đã nộp',
  DEFENSE_READY: 'Sẵn bảo vệ',
  PASSED: 'Đạt',
  FAILED: 'Không đạt',
  DISQUALIFIED: 'Truất quyền',
  DEFERRED: 'Hoãn',
};

const RUBRIC_STATUS_COLORS: Record<string, string> = {
  MISSING: 'text-red-600 bg-red-50',
  DRAFT: 'text-amber-700 bg-amber-50',
  SUBMITTED: 'text-emerald-700 bg-emerald-50',
};

const RUBRIC_STATUS_LABELS: Record<string, string> = {
  MISSING: 'Chưa chấm',
  DRAFT: 'Nháp',
  SUBMITTED: 'Đã nộp',
};

const SIM_LEVEL_COLORS: Record<string, string> = {
  HIGH: 'text-red-600 bg-red-50',
  MEDIUM: 'text-amber-700 bg-amber-50',
  LOW: 'text-emerald-700 bg-emerald-50',
};

export interface WorkloadDashboardProps {
  onSelectProject: (item: LecturerWorkloadItem) => void;
}

export const WorkloadDashboard: React.FC<WorkloadDashboardProps> = ({ onSelectProject }) => {
  const [items, setItems] = useState<LecturerWorkloadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterRole, setFilterRole] = useState<string>('ALL');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.getLecturerWorkload();
      setItems(data);
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setError('Tính năng tổng quan khối lượng giảng viên đang được triển khai.');
        setItems([]);
      } else {
        notifyError('Không tải được danh sách đồ án', err);
        setError('Không tải được dữ liệu, vui lòng thử lại.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = filterRole === 'ALL'
    ? items
    : items.filter((it) => it.roles.includes(filterRole as any));

  // Group by role
  const grouped: Record<string, LecturerWorkloadItem[]> = {};
  for (const role of ['SUPERVISOR', 'REVIEWER', 'COUNCIL']) {
    const roleItems = filtered.filter((it) => it.roles.includes(role as any));
    if (roleItems.length > 0) grouped[role] = roleItems;
  }

  if (loading) {
    return (
      <div className="utc-card p-6 text-center text-sm text-slate-500">
        <div className="animate-pulse">Đang tải khối lượng công việc...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="utc-card p-6 text-center text-sm text-slate-500">
        <p>{error}</p>
        <button className="utc-btn mt-3" onClick={load}>Thử lại</button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="utc-card p-6 text-center text-sm text-slate-500">
        Bạn chưa được phân công đồ án nào trong hệ thống mới.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter by role */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-sm font-medium text-slate-600">Lọc theo vai trò:</span>
        {['ALL', 'SUPERVISOR', 'REVIEWER', 'COUNCIL'].map((r) => (
          <button
            key={r}
            onClick={() => setFilterRole(r)}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
              filterRole === r
                ? 'bg-blue-700 text-white border-blue-700'
                : 'bg-white text-blue-700 border-blue-300 hover:bg-blue-50'
            }`}
          >
            {r === 'ALL' ? 'Tất cả' : ROLE_LABELS[r]}
            <span className="ml-1 opacity-75">
              ({r === 'ALL' ? items.length : items.filter((it) => it.roles.includes(r as any)).length})
            </span>
          </button>
        ))}
        <button
          className="ml-auto px-3 py-1 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded"
          onClick={load}
        >
          Làm mới
        </button>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Tổng đồ án', value: items.length },
          { label: 'Chưa chấm', value: items.filter((it) => it.my_rubric_status === 'MISSING').length, color: 'text-red-600' },
          { label: 'Nháp', value: items.filter((it) => it.my_rubric_status === 'DRAFT').length, color: 'text-amber-600' },
          { label: 'Cần đối chiếu', value: items.filter((it) => it.needs_reconciliation).length, color: 'text-orange-600' },
        ].map((stat) => (
          <div key={stat.label} className="utc-card p-3 text-center">
            <div className={`text-2xl font-bold ${stat.color || 'text-blue-700'}`}>{stat.value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Grouped table */}
      {Object.entries(grouped).map(([role, roleItems]) => (
        <div key={role} className="utc-card overflow-hidden">
          <div className="px-4 py-2 bg-blue-50 border-b border-blue-100">
            <span className="font-semibold text-blue-800 text-sm">{ROLE_LABELS[role]}</span>
            <span className="ml-2 text-xs text-blue-500">({roleItems.length} đồ án)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="m-stagger w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-3 py-2 font-medium text-slate-600">Sinh viên</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">Đề tài</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600 hidden md:table-cell">Đợt / Trạng thái</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600 hidden lg:table-cell">Bài nộp mới nhất</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">Phiếu chấm</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {roleItems.map((item) => (
                  <tr
                    key={`${item.project_id}-${role}`}
                    className="border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => onSelectProject(item)}
                  >
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-800">{item.student_name}</div>
                      <div className="text-slate-500">{item.student_reg_no}</div>
                    </td>
                    <td className="px-3 py-2 max-w-[200px]">
                      <div className="truncate text-slate-700" title={item.topic_title_vi}>
                        {item.topic_title_vi || <span className="text-slate-400 italic">Chưa có đề tài</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2 hidden md:table-cell">
                      <div className="text-slate-500">{item.batch_code}</div>
                      <div className="text-slate-600 font-medium">{STATUS_LABELS[item.status] || item.status}</div>
                    </td>
                    <td className="px-3 py-2 hidden lg:table-cell">
                      {item.latest_submission ? (
                        <div>
                          <span className="text-slate-600">v{item.latest_submission.version_no} – {item.latest_submission.kind}</span>
                          {item.latest_submission.similarity_score != null && (
                            <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              SIM_LEVEL_COLORS[item.latest_submission.similarity_level || 'LOW']
                            }`}>
                              {item.latest_submission.similarity_score.toFixed(1)}%
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Chưa nộp</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        RUBRIC_STATUS_COLORS[item.my_rubric_status]
                      }`}>
                        {RUBRIC_STATUS_LABELS[item.my_rubric_status]}
                      </span>
                      {item.needs_reconciliation && (
                        <span className="ml-1 px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 text-[10px] font-semibold">
                          Lệch điểm
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        className="utc-btn text-[11px] py-1 px-2"
                        onClick={(e) => { e.stopPropagation(); onSelectProject(item); }}
                      >
                        Xem chi tiết
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
};

export default WorkloadDashboard;
