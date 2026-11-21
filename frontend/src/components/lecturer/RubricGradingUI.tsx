/**
 * RubricGradingUI – phiếu chấm điểm theo rubric cho giảng viên.
 *
 * Chức năng:
 * - Chọn rubric phù hợp với vai trò của giảng viên trên đồ án này.
 * - Nhập điểm từng tiêu chí (kèm ghi chú riêng mỗi tiêu chí), tổng tính tự động.
 * - "Lưu nháp" và "Xác nhận điểm" (confirm dialog).
 * - Trạng thái khoá: chỉ đọc nếu đã nộp (my_rubric_status === 'SUBMITTED').
 * - Hiển thị cảnh báo lệch điểm nếu needs_reconciliation = true.
 *
 * Endpoints:
 *   GET  /app/rubrics/?evaluator_role=<ROLE>
 *   GET  /app/graduation-project/{pk}/rubric-scores/
 *   POST /app/graduation-project/{pk}/rubric-scores/   { rubric_id, criterion_scores, comment, is_draft? }
 */
import React, { useCallback, useEffect, useState } from 'react';
import { apiService } from '../../services/api';
import type { LecturerWorkloadItem } from '../../services/api';
import { notify, notifyError, confirmDialog } from '../../utils/notify';

interface RubricCriterion {
  id: number;
  name: string;
  description: string;
  max_score: number;
  order: number;
}

interface Rubric {
  id: number;
  name: string;
  evaluator_role: string;
  description: string;
  criteria: RubricCriterion[];
  total_max: number;
}

interface ExistingScore {
  id: number;
  rubric_id: number;
  rubric_name: string;
  evaluator_role: string;
  criterion_scores: Record<string, number>;
  criterion_comments?: Record<string, string>;
  total_10: number;
  comment: string;
  updated_at: string;
}

const ROLE_LABELS: Record<string, string> = {
  SUPERVISOR: 'GV hướng dẫn',
  REVIEWER: 'GV phản biện',
  COUNCIL: 'Hội đồng',
};

export interface RubricGradingUIProps {
  project: LecturerWorkloadItem;
  onBack: () => void;
}

export const RubricGradingUI: React.FC<RubricGradingUIProps> = ({ project, onBack }) => {
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [selectedRubricId, setSelectedRubricId] = useState<number | null>(null);
  const [existingScores, setExistingScores] = useState<ExistingScore[]>([]);
  const [criterionScores, setCriterionScores] = useState<Record<number, string>>({});
  const [comment, setComment] = useState('');
  const [criterionComments, setCriterionComments] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const selectedRubric = rubrics.find((r) => r.id === selectedRubricId) ?? null;

  // Computed total out of 10
  const computedTotal = (() => {
    if (!selectedRubric) return null;
    let totalWeighted = 0;
    let totalMax = 0;
    for (const c of selectedRubric.criteria) {
      const raw = parseFloat(criterionScores[c.id] ?? '');
      const score = isNaN(raw) ? 0 : Math.min(raw, c.max_score);
      totalWeighted += score;
      totalMax += c.max_score;
    }
    if (totalMax === 0) return 0;
    return (totalWeighted / totalMax) * 10;
  })();

  // The existing score for the selected rubric
  const existingForRubric = existingScores.find((s) => s.rubric_id === selectedRubricId) ?? null;

  // Locked if already submitted (backend has no explicit draft flag in current impl;
  // treat my_rubric_status === 'SUBMITTED' as locked for the whole project)
  const isLocked = project.my_rubric_status === 'SUBMITTED';

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load rubrics for each role the lecturer holds on this project
      const allRubrics: Rubric[] = [];
      for (const role of project.roles) {
        try {
          const data = await apiService.getRubrics({ evaluator_role: role });
          allRubrics.push(...data.filter((r: Rubric) => !allRubrics.some((ar) => ar.id === r.id)));
        } catch {
          // ignore per-role failures
        }
      }
      setRubrics(allRubrics);
      if (allRubrics.length > 0) setSelectedRubricId(allRubrics[0].id);

      // Load existing scores
      try {
        const scores = await apiService.getProjectRubricScores(project.project_id);
        setExistingScores(Array.isArray(scores) ? scores : []);
      } catch {
        setExistingScores([]);
      }
    } catch (err) {
      notifyError('Không tải được dữ liệu chấm điểm', err);
    } finally {
      setLoading(false);
    }
  }, [project.project_id, project.roles]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Populate scores from existing when rubric changes
  useEffect(() => {
    if (!selectedRubricId) return;
    const existing = existingScores.find((s) => s.rubric_id === selectedRubricId);
    if (existing) {
      const mapped: Record<number, string> = {};
      for (const [key, val] of Object.entries(existing.criterion_scores)) {
        mapped[Number(key)] = String(val);
      }
      setCriterionScores(mapped);
      const cm: Record<number, string> = {};
      for (const [key, val] of Object.entries(existing.criterion_comments || {})) {
        cm[Number(key)] = String(val ?? '');
      }
      setCriterionComments(cm);
      setComment(existing.comment || '');
    } else {
      setCriterionScores({});
      setCriterionComments({});
      setComment('');
    }
  }, [selectedRubricId, existingScores]);

  const handleSubmit = async (isDraft: boolean) => {
    if (!selectedRubric) return;

    // Validate: all criteria must have values
    const missingCriteria = selectedRubric.criteria.filter(
      (c) => criterionScores[c.id] === undefined || criterionScores[c.id] === ''
    );
    if (missingCriteria.length > 0 && !isDraft) {
      notify.warning('Vui lòng nhập điểm cho tất cả tiêu chí trước khi xác nhận.');
      return;
    }

    // For validation errors (score > max)
    for (const c of selectedRubric.criteria) {
      const raw = parseFloat(criterionScores[c.id] ?? '');
      if (!isNaN(raw) && raw > c.max_score) {
        notify.warning(`Điểm tiêu chí "${c.name}" vượt quá tối đa (${c.max_score}).`);
        return;
      }
      if (!isNaN(raw) && raw < 0) {
        notify.warning(`Điểm tiêu chí "${c.name}" không thể âm.`);
        return;
      }
    }

    if (!isDraft) {
      const confirmed = await confirmDialog(
        `Xác nhận nộp phiếu chấm điểm cho đồ án của ${project.student_name}?\n\nTổng: ${computedTotal?.toFixed(2) ?? '—'}/10\n\nSau khi xác nhận, phiếu chấm sẽ được ghi lại.`,
        { title: 'Xác nhận điểm', confirmText: 'Xác nhận', danger: false }
      );
      if (!confirmed) return;
    }

    const scores: Record<string, number> = {};
    for (const c of selectedRubric.criteria) {
      const raw = parseFloat(criterionScores[c.id] ?? '0');
      scores[String(c.id)] = isNaN(raw) ? 0 : raw;
    }
    const comments: Record<string, string> = {};
    for (const c of selectedRubric.criteria) {
      const text = (criterionComments[c.id] ?? '').trim();
      if (text) comments[String(c.id)] = text;
    }

    setSaving(true);
    try {
      await apiService.submitRubricScore(project.project_id, {
        rubric_id: selectedRubric.id,
        criterion_scores: scores,
        comment,
        criterion_comments: comments,
        is_draft: isDraft,
      });
      notify.success(isDraft ? 'Đã lưu nháp phiếu chấm.' : 'Đã xác nhận phiếu chấm.');
      await loadData();
    } catch (err) {
      notifyError(isDraft ? 'Lưu nháp thất bại' : 'Xác nhận điểm thất bại', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="utc-card p-6 text-center text-sm text-slate-500 animate-pulse">
        Đang tải phiếu chấm...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="utc-card p-4">
        <button
          className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1"
          onClick={onBack}
        >
          ← Quay lại chi tiết đồ án
        </button>
        <div className="mt-3">
          <h3 className="font-bold text-base text-slate-800">Chấm điểm: {project.topic_title_vi || 'Đồ án'}</h3>
          <p className="text-sm text-slate-600">
            {project.student_name} ({project.student_reg_no}) – {project.batch_code}
          </p>
        </div>

        {/* Discrepancy warning */}
        {project.needs_reconciliation && (
          <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded text-sm text-orange-800 font-medium">
            Cảnh báo: điểm giữa các giám khảo có độ lệch lớn, cần đối chiếu lại.
          </div>
        )}

        {/* Locked notice */}
        {isLocked && (
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
            Phiếu chấm đã được xác nhận và khoá. Chế độ chỉ xem.
          </div>
        )}
      </div>

      {/* No rubrics available */}
      {rubrics.length === 0 && (
        <div className="utc-card p-6 text-center text-sm text-slate-500">
          Chưa có rubric nào được thiết lập cho vai trò của bạn ({project.roles.map((r) => ROLE_LABELS[r]).join(', ')}).
          Vui lòng liên hệ Khoa/Giáo vụ để tạo rubric.
        </div>
      )}

      {rubrics.length > 0 && (
        <>
          {/* Rubric selector */}
          {rubrics.length > 1 && (
            <div className="utc-card p-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">Chọn rubric:</label>
              <div className="flex flex-wrap gap-2">
                {rubrics.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedRubricId(r.id)}
                    className={`px-3 py-1.5 rounded border text-sm transition-colors ${
                      selectedRubricId === r.id
                        ? 'bg-blue-700 text-white border-blue-700'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {r.name}
                    <span className="ml-1 text-[11px] opacity-70">({ROLE_LABELS[r.evaluator_role]})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedRubric && (
            <div className="utc-card overflow-hidden">
              <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-blue-800 text-sm">{selectedRubric.name}</span>
                  <span className="ml-2 text-xs text-blue-500">({ROLE_LABELS[selectedRubric.evaluator_role]})</span>
                </div>
                {existingForRubric && (
                  <span className="text-xs text-slate-500">
                    Cập nhật lần cuối:{' '}
                    {new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(
                      new Date(existingForRubric.updated_at)
                    )}
                  </span>
                )}
              </div>

              {selectedRubric.description && (
                <div className="px-4 py-2 text-xs text-slate-500 italic border-b border-slate-100">
                  {selectedRubric.description}
                </div>
              )}

              <div className="p-4 space-y-4">
                {/* Criteria */}
                {[...selectedRubric.criteria]
                  .sort((a, b) => a.order - b.order)
                  .map((c) => {
                    const raw = parseFloat(criterionScores[c.id] ?? '');
                    const isOver = !isNaN(raw) && raw > c.max_score;
                    return (
                      <div key={c.id} className="border border-slate-100 rounded p-3 bg-slate-50/50">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="font-medium text-sm text-slate-800">{c.name}</div>
                            {c.description && (
                              <div className="text-xs text-slate-500 mt-0.5">{c.description}</div>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <input
                              type="number"
                              min={0}
                              max={c.max_score}
                              step={0.5}
                              disabled={isLocked}
                              value={criterionScores[c.id] ?? ''}
                              onChange={(e) =>
                                setCriterionScores((prev) => ({ ...prev, [c.id]: e.target.value }))
                              }
                              placeholder="—"
                              className={`utc-form-input text-sm w-20 text-right ${isOver ? 'border-red-400 bg-red-50' : ''}`}
                            />
                            <span className="text-xs text-slate-500">/ {c.max_score}</span>
                          </div>
                        </div>
                        {isOver && (
                          <div className="text-xs text-red-600 mt-1">
                            Vượt điểm tối đa ({c.max_score})
                          </div>
                        )}
                        <textarea
                          rows={2}
                          disabled={isLocked}
                          value={criterionComments[c.id] ?? ''}
                          onChange={(e) =>
                            setCriterionComments((prev) => ({ ...prev, [c.id]: e.target.value }))
                          }
                          placeholder="Nhận xét cho tiêu chí này (tuỳ chọn)"
                          aria-label={`Nhận xét tiêu chí ${c.name}`}
                          className="utc-form-input text-xs w-full mt-2"
                        />
                      </div>
                    );
                  })}

                {/* Total */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                  <span className="font-semibold text-slate-700">Tổng điểm (quy về /10):</span>
                  <span
                    className={`text-lg font-bold ${
                      computedTotal != null && computedTotal < 5
                        ? 'text-red-600'
                        : computedTotal != null && computedTotal < 7
                        ? 'text-amber-600'
                        : 'text-emerald-700'
                    }`}
                  >
                    {computedTotal != null ? computedTotal.toFixed(2) : '—'} / 10
                  </span>
                </div>

                {/* Overall comment */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Nhận xét chung:
                  </label>
                  <textarea
                    rows={3}
                    disabled={isLocked}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Nhận xét tổng thể về đồ án..."
                    className="utc-form-input w-full text-sm"
                  />
                </div>

                {/* Action buttons */}
                {!isLocked && (
                  <div className="flex flex-wrap gap-3 pt-2">
                    <button
                      className="px-4 py-2 rounded border border-slate-300 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      disabled={saving}
                      onClick={() => handleSubmit(true)}
                    >
                      {saving ? 'Đang lưu...' : 'Lưu nháp'}
                    </button>
                    <button
                      className="utc-btn disabled:opacity-50"
                      disabled={saving}
                      onClick={() => handleSubmit(false)}
                    >
                      {saving ? 'Đang xử lý...' : 'Xác nhận điểm'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default RubricGradingUI;
