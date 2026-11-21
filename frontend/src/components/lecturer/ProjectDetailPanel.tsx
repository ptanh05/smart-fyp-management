/**
 * ProjectDetailPanel – lịch sử phiên bản bài nộp + báo cáo tương đồng + nút kiểm tra lại.
 * Dùng cho giảng viên (hướng dẫn / phản biện / hội đồng).
 * Endpoints:
 *   GET  /app/graduation-project/{pk}/submissions/
 *   POST /app/submissions/{id}/similarity-check/
 */
import React, { useCallback, useEffect, useState } from 'react';
import { apiService } from '../../services/api';
import type { LecturerWorkloadItem, SubmissionVersion } from '../../services/api';
import { notify, notifyError } from '../../utils/notify';
import { safeExternalUrl } from '../../utils/safeUrl';

const KIND_LABELS: Record<string, string> = {
  OUTLINE: 'Đề cương',
  REPORT: 'Báo cáo',
  SLIDES: 'Slide',
  SOURCE: 'Mã nguồn',
  OTHER: 'Khác',
};

const SIM_LEVEL_COLORS: Record<string, string> = {
  HIGH: 'text-red-600 bg-red-50',
  MEDIUM: 'text-amber-700 bg-amber-50',
  LOW: 'text-emerald-700 bg-emerald-50',
};

function formatFileSize(bytes: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export interface ProjectDetailPanelProps {
  project: LecturerWorkloadItem;
  onBack: () => void;
  onGradeClick: (project: LecturerWorkloadItem) => void;
}

export const ProjectDetailPanel: React.FC<ProjectDetailPanelProps> = ({
  project,
  onBack,
  onGradeClick,
}) => {
  const [versions, setVersions] = useState<SubmissionVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [recheckingId, setRecheckingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const loadVersions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiService.getSubmissionVersions(project.project_id);
      setVersions(data);
    } catch (err) {
      notifyError('Không tải được lịch sử bài nộp', err);
    } finally {
      setLoading(false);
    }
  }, [project.project_id]);

  useEffect(() => {
    loadVersions();
  }, [loadVersions]);

  const handleRecheck = async (versionId: number) => {
    setRecheckingId(versionId);
    try {
      await apiService.recheckSubmissionSimilarity(versionId);
      notify.success('Đã yêu cầu kiểm tra lại tương đồng. Kết quả sẽ cập nhật sau giây lát.');
      await loadVersions();
    } catch (err) {
      notifyError('Kiểm tra lại tương đồng thất bại', err);
    } finally {
      setRecheckingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="utc-card p-4">
        <div className="flex items-start gap-3">
          <button
            className="mt-0.5 text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1"
            onClick={onBack}
          >
            ← Quay lại danh sách
          </button>
        </div>
        <div className="mt-3">
          <h3 className="font-bold text-base text-slate-800">
            {project.topic_title_vi || <span className="text-slate-400 italic">Chưa có đề tài</span>}
          </h3>
          <div className="flex flex-wrap gap-3 mt-2 text-sm text-slate-600">
            <span><strong>Sinh viên:</strong> {project.student_name} ({project.student_reg_no})</span>
            <span><strong>Đợt:</strong> {project.batch_code}</span>
            <span>
              <strong>Vai trò của tôi:</strong>{' '}
              {project.roles.map((r) => (
                <span key={r} className="inline-block ml-1 px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                  {r === 'SUPERVISOR' ? 'GV hướng dẫn' : r === 'REVIEWER' ? 'GV phản biện' : 'Hội đồng'}
                </span>
              ))}
            </span>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            className="utc-btn"
            onClick={() => onGradeClick(project)}
          >
            Chấm điểm (Rubric)
          </button>
        </div>
      </div>

      {/* Submission versions */}
      <div className="utc-card overflow-hidden">
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
          <span className="font-semibold text-blue-800 text-sm">Lịch sử phiên bản bài nộp</span>
          <button className="text-xs text-blue-600 hover:text-blue-800" onClick={loadVersions}>
            Làm mới
          </button>
        </div>

        {loading ? (
          <div className="p-6 text-center text-sm text-slate-500 animate-pulse">Đang tải...</div>
        ) : versions.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-400 italic">Sinh viên chưa nộp phiên bản nào.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {versions.map((v) => (
              <div key={v.id} className="p-3">
                <div className="flex flex-wrap items-start gap-2 justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Kind badge */}
                    <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[11px] font-semibold">
                      {KIND_LABELS[v.kind] || v.kind}
                    </span>
                    <span className="text-xs text-slate-700 font-medium">
                      v{v.version_no}
                    </span>
                    <span className="text-xs text-slate-500">
                      {v.original_name}
                    </span>
                    <span className="text-xs text-slate-400">
                      {formatFileSize(v.file_size)}
                    </span>
                    <span className="text-xs text-slate-400">
                      {formatDate(v.created_at)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Similarity badge */}
                    {v.similarity_status === 'CHECKED' && v.similarity_score != null && (
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer ${
                          SIM_LEVEL_COLORS[v.similarity_level || 'LOW']
                        }`}
                        onClick={() => setExpandedId(expandedId === v.id ? null : v.id)}
                        title="Nhấn để xem chi tiết"
                      >
                        Tương đồng {v.similarity_score.toFixed(1)}%
                        {expandedId === v.id ? ' ▲' : ' ▼'}
                      </span>
                    )}
                    {v.similarity_status === 'NOT_CHECKED' && (
                      <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-500">
                        Chưa kiểm tra
                      </span>
                    )}
                    {v.similarity_status === 'UNSUPPORTED' && (
                      <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-500">
                        Không hỗ trợ
                      </span>
                    )}
                    {/* Download link */}
                    {v.file_url && (
                      <a
                        href={safeExternalUrl(v.file_url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="utc-btn text-[11px] py-1 px-2"
                        onClick={(e) => !safeExternalUrl(v.file_url) && e.preventDefault()}
                      >
                        Tải về
                      </a>
                    )}
                    {/* Recheck button (supervisor/reviewer only) */}
                    <button
                      className="text-[11px] py-1 px-2 border border-slate-200 rounded hover:bg-slate-50 text-slate-600 disabled:opacity-50"
                      disabled={recheckingId === v.id}
                      onClick={() => handleRecheck(v.id)}
                    >
                      {recheckingId === v.id ? 'Đang kiểm tra...' : 'Kiểm tra lại tương đồng'}
                    </button>
                  </div>
                </div>

                {/* Note */}
                {v.note && (
                  <div className="mt-1 text-xs text-slate-500 italic">Ghi chú: {v.note}</div>
                )}

                {/* Similarity matches expansion */}
                {expandedId === v.id && v.similarity_status === 'CHECKED' && (
                  <div className="mt-3 border border-slate-200 rounded p-3 bg-slate-50 text-xs space-y-2">
                    <div className="font-medium text-slate-700">Chi tiết tương đồng:</div>
                    {/* similarity_matches may be an array of matched project objects */}
                    {Array.isArray((v as any).similarity_matches) && (v as any).similarity_matches.length > 0 ? (
                      <div className="space-y-1">
                        {((v as any).similarity_matches as any[]).map((m: any, idx: number) => (
                          <div key={idx} className="p-2 bg-white rounded border border-slate-100">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-slate-700">
                                {m.topic_title_vi || m.matched_topic || m.project_id || `Đồ án #${idx + 1}`}
                              </span>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                SIM_LEVEL_COLORS[m.level || 'LOW']
                              }`}>
                                {typeof m.similarity === 'number' ? `${m.similarity.toFixed(1)}%` : ''}
                              </span>
                            </div>
                            {/* Matched passage / snippet */}
                            {(m.snippet || m.matched_passage || m.text_excerpt) && (
                              <div className="mt-1 text-slate-500 italic line-clamp-3">
                                "…{m.snippet || m.matched_passage || m.text_excerpt}…"
                              </div>
                            )}
                            {m.batch_code && (
                              <div className="text-slate-400">Đợt: {m.batch_code}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-slate-400 italic">Không có thông tin chi tiết bài trùng.</div>
                    )}
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

export default ProjectDetailPanel;
