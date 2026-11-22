import { notify, notifyError, confirmDialog } from '../utils/notify';
import React, { useState, useEffect, useRef } from 'react';
import { useModalGuard } from '../utils/modalHooks';
import { apiService, apiClient } from '../services/api';

import { API_BASE_URL as API_BASE } from '../services/api';

interface UTCCouncilLiveDefenseViewProps {
  councilId?: number | null;
  batchId?: number | null;
}

export const UTCCouncilLiveDefenseView: React.FC<UTCCouncilLiveDefenseViewProps> = ({
  councilId,
  batchId,
}) => {
  const [councilData, setCouncilData] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoSync, setAutoSync] = useState(true);
  const [exportingMinutes, setExportingMinutes] = useState(false);

  // Live Timer State
  const [timerSeconds, setTimerSeconds] = useState(15 * 60); // 15 mins default
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // Action status
  const [operatingProjectId, setOperatingProjectId] = useState<number | null>(null);
  const [remindingProjectId, setRemindingProjectId] = useState<number | null>(null);
  const [expandedMatrixId, setExpandedMatrixId] = useState<number | null>(null);

  // Scoring Form
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [scorePres, setScorePres] = useState<number | string>(2.5);
  const [scoreContent, setScoreContent] = useState<number | string>(2.5);
  const [scoreQa, setScoreQa] = useState<number | string>(1.5);
  const [scoreDemo, setScoreDemo] = useState<number | string>(1.5);
  const [scoreComments, setScoreComments] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [locking, setLocking] = useState(false);

  const initialScoreRef = useRef({
    scorePres: 2.5,
    scoreContent: 2.5,
    scoreQa: 1.5,
    scoreDemo: 1.5,
    scoreComments: '',
  });

  const isScoreDirty =
    showScoreModal &&
    !councilData?.is_locked &&
    (Number(scorePres) !== Number(initialScoreRef.current.scorePres) ||
      Number(scoreContent) !== Number(initialScoreRef.current.scoreContent) ||
      Number(scoreQa) !== Number(initialScoreRef.current.scoreQa) ||
      Number(scoreDemo) !== Number(initialScoreRef.current.scoreDemo) ||
      scoreComments !== initialScoreRef.current.scoreComments);

  const { requestClose: requestCloseScoreModal, handleOverlayClick: handleScoreOverlayClick } = useModalGuard({
    isOpen: showScoreModal,
    onClose: () => setShowScoreModal(false),
    isDirty: isScoreDirty,
    confirmMessage: 'Bạn có điểm số hoặc ý kiến nhận xét chưa lưu. Bạn có chắc muốn đóng không?',
  });

  const getHeaders = () => {
    const token = localStorage.getItem('access_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const params: Record<string, any> = {};
      if (councilId) params.council_id = councilId;
      if (batchId) params.batch_id = batchId;
      const res = await apiClient.get(`${API_BASE}/council/live-session/`, {
        headers: getHeaders(),
        params,
      });
      setCouncilData(res.data.council);
      setProjects(res.data.projects || []);
    } catch (err) {
      console.error(err);
      if (!silent) {
        setCouncilData(null);
        setProjects([]);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [councilId, batchId]);

  // Real-time auto sync every 5 seconds
  useEffect(() => {
    if (!autoSync) return;
    const interval = setInterval(() => {
      fetchData(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [autoSync, councilId, batchId]);

  // Live session timer countdown
  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => Math.max(0, prev - 1));
      }, 1000);
    } else if (timerSeconds === 0 && isTimerRunning) {
      setIsTimerRunning(false);
      notify.warning('⏰ Hết giờ trình bày bảo vệ của sinh viên!');
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timerSeconds]);

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const isChair = councilData?.my_role_code === 'CHAIR';
  const isSecretary = councilData?.my_role_code === 'SECRETARY';
  const canOperateSession = isChair || isSecretary;

  const currentDefendingProject = projects.find(
    (p) => p.defense_status === 'DEFENDING' || p.id === councilData?.current_defending_project_id
  );

  // Set defense status (Chair / Secretary)
  const handleSetDefenseStatus = async (projectId: number, defenseStatus: string) => {
    try {
      setOperatingProjectId(projectId);
      const res = await apiClient.post(
        `${API_BASE}/council/chair/set-defense-status/`,
        {
          council_id: councilData?.id,
          project_id: projectId,
          defense_status: defenseStatus,
        },
        { headers: getHeaders() }
      );
      notify.success(res.data.message || 'Đã cập nhật trạng thái bảo vệ!');
      if (defenseStatus === 'DEFENDING') {
        setTimerSeconds(15 * 60);
        setIsTimerRunning(true);
      } else if (defenseStatus === 'DEFENDED') {
        setIsTimerRunning(false);
      }
      await fetchData(true);
    } catch (err: any) {
      notifyError('Lỗi điều hành bảo vệ', err);
    } finally {
      setOperatingProjectId(null);
    }
  };

  // Remind scoring (Secretary / Chair)
  const handleRemindScoring = async (projectId: number) => {
    try {
      setRemindingProjectId(projectId);
      const res = await apiClient.post(
        `${API_BASE}/council/remind-scoring/`,
        { council_id: councilData?.id, project_id: projectId },
        { headers: getHeaders() }
      );
      const notifiedList = (res.data.notified_members || []).join(', ');
      notify.success(
        (res.data.message || 'Đã gửi thông báo nhắc nhở nộp điểm!') +
          (notifiedList ? `\n\nĐã nhắc: ${notifiedList}` : '')
      );
      await fetchData(true);
    } catch (err: any) {
      notifyError('Lỗi gửi nhắc nhở', err);
    } finally {
      setRemindingProjectId(null);
    }
  };

  const handleOpenScoreModal = (project: any) => {
    setSelectedProject(project);
    const initial = project.my_score
      ? {
          scorePres: project.my_score.score_presentation,
          scoreContent: project.my_score.score_content,
          scoreQa: project.my_score.score_qa,
          scoreDemo: project.my_score.score_demo,
          scoreComments: project.my_score.comments || '',
        }
      : {
          scorePres: 2.5,
          scoreContent: 2.5,
          scoreQa: 1.5,
          scoreDemo: 1.5,
          scoreComments: '',
        };
    setScorePres(initial.scorePres);
    setScoreContent(initial.scoreContent);
    setScoreQa(initial.scoreQa);
    setScoreDemo(initial.scoreDemo);
    setScoreComments(initial.scoreComments);
    initialScoreRef.current = initial;
    setShowScoreModal(true);
  };

  const handleScoreSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;

    try {
      setSubmitting(true);
      const res = await apiClient.post(
        `${API_BASE}/council/submit-score/`,
        {
          council_id: councilData?.id,
          project_id: selectedProject.id,
          score_presentation: Number(scorePres),
          score_content: Number(scoreContent),
          score_qa: Number(scoreQa),
          score_demo: Number(scoreDemo),
          comments: scoreComments,
        },
        { headers: getHeaders() }
      );
      notify.success(res.data.message || 'Đã chấm điểm thành công!');
      setShowScoreModal(false);
      fetchData(true);
    } catch (err: any) {
      notifyError('Lỗi chấm điểm', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleLock = async () => {
    if (!councilData) return;
    const willLock = !councilData.is_locked;
    const confirmPrompt = await confirmDialog(
      willLock
        ? 'Bạn có chắc chắn muốn KHÓA ĐIỂM Hội đồng? Tất cả điểm số sẽ chuyển sang trạng thái Chỉ xem và không thể chỉnh sửa thêm.'
        : 'Bạn có chắc chắn muốn MỞ KHÓA điểm Hội đồng? Thành viên sẽ có thể tiếp tục chấm/sửa điểm.',
      { danger: willLock, confirmText: willLock ? 'Khóa điểm' : 'Mở khóa' }
    );
    if (!confirmPrompt) return;

    try {
      setLocking(true);
      const res = await apiClient.post(
        `${API_BASE}/council/toggle-lock/`,
        {
          council_id: councilData.id,
          lock: willLock,
        },
        { headers: getHeaders() }
      );
      notify.success(res.data.message || (willLock ? 'Đã khóa điểm hội đồng thành công!' : 'Đã mở khóa điểm thành công!'));
      fetchData();
    } catch (err: any) {
      console.error('Toggle lock error:', err);
      notifyError('Lỗi', err);
    } finally {
      setLocking(false);
    }
  };

  const handleExportCouncilMinutes = async () => {
    if (!councilData?.id) return;
    try {
      setExportingMinutes(true);
      const blob = await apiService.exportCouncilMinutesPdf(councilData.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Bien_ban_Hoi_dong_${councilData.council_number || councilData.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      notifyError('Lỗi xuất biên bản hội đồng', err);
    } finally {
      setExportingMinutes(false);
    }
  };

  const totalPreview =
    (Number(scorePres) || 0) +
    (Number(scoreContent) || 0) +
    (Number(scoreQa) || 0) +
    (Number(scoreDemo) || 0);

  const formatConflictType = (conflictType?: string) => {
    const code = (conflictType || '').toUpperCase();
    if (code === 'SUPERVISOR' || code.includes('SUPERVISOR')) return 'GVHD';
    if (code === 'REVIEWER' || code.includes('REVIEWER')) return 'GVPB';
    return conflictType || 'Xung đột';
  };

  const getMyProjectConflict = (project: any) => {
    if (!project || !councilData?.my_user_id) return null;
    const me = project.scoring_summary?.members_breakdown?.find(
      (m: any) => m.user_id === councilData.my_user_id
    );
    if (!me) return null;
    if (me.is_supervisor) return 'GVHD';
    if (me.is_reviewer) return 'GVPB';
    return null;
  };

  if (loading) {
    return <div className="p-8 text-center utc-live-muted">Đang tải phiên bảo vệ trực tiếp của Hội đồng...</div>;
  }

  if (!councilData) {
    return (
      <div className="p-8 text-center utc-live-surface rounded-xl space-y-2">
        <h4 className="text-base font-bold utc-live-title">Không tìm thấy phiên bảo vệ</h4>
        <p className="text-xs utc-live-muted">Bạn hiện không được phân công vào Hội đồng bảo vệ nào trong đợt này.</p>
      </div>
    );
  }

  const currentDefendingConflict = getMyProjectConflict(currentDefendingProject);

  return (
    <div className="space-y-6">
      {/* Council Info Header */}
      <div className="utc-live-surface rounded-xl p-5 shadow-md flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold px-2.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              Hội đồng #{councilData.council_number}
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25 font-semibold">
              Vai trò của bạn: {councilData.my_role}
            </span>
            {councilData.is_locked && (
              <span className="text-xs px-2.5 py-0.5 rounded bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-500/40 font-bold flex items-center gap-1">
                🔒 ĐÃ KHÓA ĐIỂM (CHỈ XEM)
              </span>
            )}
            {isChair && (
              <span className="text-xs px-2 py-0.5 rounded bg-purple-500/15 text-purple-600 dark:text-purple-300 border border-purple-500/30 font-bold">
                👑 Quyền Điều hành
              </span>
            )}
            {isSecretary && (
              <span className="text-xs px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30 font-bold">
                📝 Quyền Thư ký
              </span>
            )}
          </div>
          <h2 className="text-xl font-bold utc-live-title mt-1">{councilData.council_name}</h2>
          <div className="text-xs utc-live-muted mt-1 flex items-center gap-4 flex-wrap">
            <span>🏛️ Phòng: <b>{councilData.defense_room || 'Chưa có'}</b></span>
            <span>📅 Ngày: <b>{councilData.session_date || 'Chưa có'}</b></span>
            <span>⏰ Ca: <b>{councilData.session_time}</b></span>
          </div>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <div className="text-right">
            <span className="text-xs utc-live-muted">Tổng số đề tài bảo vệ</span>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{projects.length} Sinh viên</p>
          </div>
          {councilData.can_lock && (
            <button
              onClick={handleToggleLock}
              disabled={locking}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-md ${
                councilData.is_locked
                  ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/30'
                  : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
              }`}
            >
              {locking
                ? 'Đang xử lý...'
                : councilData.is_locked
                ? '🔓 Mở khóa điểm Hội đồng'
                : '🔒 Khóa điểm Hội đồng'}
            </button>
          )}

          {/* Phase 6: Step 41 - Export Council Minutes PDF */}
          <button
            onClick={handleExportCouncilMinutes}
            disabled={exportingMinutes}
            className="px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-md bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30 disabled:opacity-50"
            title="Xuất biên bản tổng hợp điểm bảo vệ của Hội đồng chuẩn định dạng PDF"
          >
            <span>📄</span>
            <span>{exportingMinutes ? 'Đang xuất PDF...' : 'Xuất Biên Bản Hội Đồng (PDF)'}</span>
          </button>

          {/* Live Sync Toggle */}
          <button
            onClick={() => setAutoSync(!autoSync)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition ${
              autoSync
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                : 'utc-live-btn-neutral'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${autoSync ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
            {autoSync ? 'Đồng bộ trực tiếp (5s)' : 'Tạm dừng đồng bộ'}
          </button>
        </div>
      </div>

      {/* COUNCIL CONFLICT OF INTEREST ALERT BANNER */}
      {councilData?.has_conflict && (
        <div className="utc-live-conflict-banner rounded-xl p-4 shadow-md flex flex-col gap-2">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-bold text-sm flex-wrap">
            <span className="text-base">⚠️</span>
            <span>CẢNH BÁO XUNG ĐỘT LỢI ÍCH</span>
            <span className="bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/30 text-xs px-2 py-0.5 rounded-full font-mono">
              {councilData.total_conflicts} xung đột
            </span>
          </div>
          <p className="text-xs leading-relaxed">
            Hội đồng này có thành viên đồng thời là Giảng viên hướng dẫn hoặc Phản biện của sinh viên trong hội đồng.
            Theo quy chế đào tạo UTC, thành viên có xung đột lợi ích <strong>không được phép chấm điểm Hội đồng</strong> cho đề tài đó.
          </p>
          <div className="mt-1 space-y-1.5">
            {councilData.conflicts?.map((c: any, i: number) => (
              <div key={i} className="utc-live-conflict-item text-xs rounded px-3 py-1.5 flex items-center justify-between gap-2">
                <span>• {c.message}</span>
                <span className="font-mono text-[10px] uppercase px-1.5 py-0.5 rounded bg-red-600/15 text-red-700 dark:text-red-300 border border-red-500/30 font-bold">
                  {formatConflictType(c.conflict_type)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* LIVE DEFENSE EXECUTIVE DASHBOARD BANNER */}
      {currentDefendingProject ? (
        <div className="utc-live-defending-banner rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-red-500/20 pb-4">
            <div className="flex items-center gap-3">
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
              <span className="text-xs font-extrabold tracking-wider uppercase text-red-600 dark:text-red-400 bg-red-500/10 px-3 py-1 rounded-full border border-red-500/30">
                🔴 TRỰC TIẾP: Đang bảo vệ
              </span>
            </div>

            {/* Live Presentation Timer */}
            <div className="flex items-center gap-3 utc-live-subsurface px-4 py-2 rounded-xl">
              <span className="text-xs utc-live-muted">Thời gian trình bày:</span>
              <span className={`font-mono text-xl font-black ${timerSeconds < 180 ? 'text-red-500 animate-pulse' : 'text-emerald-600 dark:text-emerald-400'}`}>
                ⏱ {formatTimer(timerSeconds)}
              </span>
              <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-slate-300 dark:border-slate-700">
                <button
                  onClick={() => setIsTimerRunning(!isTimerRunning)}
                  className="px-2 py-1 utc-live-btn-neutral text-xs rounded"
                >
                  {isTimerRunning ? '⏸ Dừng' : '▶️ Chạy'}
                </button>
                <button
                  onClick={() => setTimerSeconds(15 * 60)}
                  className="px-2 py-1 utc-live-btn-neutral text-xs rounded"
                  title="Đặt lại 15 phút"
                >
                  15p
                </button>
                <button
                  onClick={() => setTimerSeconds((prev) => prev + 5 * 60)}
                  className="px-2 py-1 utc-live-btn-neutral text-xs rounded"
                  title="Cộng thêm 5 phút"
                >
                  +5p
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2 max-w-3xl">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-mono text-sm font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded border border-blue-500/20">
                  {currentDefendingProject.student_reg_no}
                </span>
                <h3 className="text-lg font-bold utc-live-title">{currentDefendingProject.student_name}</h3>
                <span className="text-xs utc-live-muted">Lớp: {currentDefendingProject.student_class}</span>
              </div>

              <h4 className="text-sm font-semibold utc-live-body">
                {currentDefendingProject.topic_title_vi}
              </h4>

              <div className="flex flex-wrap items-center gap-4 text-xs utc-live-muted pt-1">
                <span>GVHD: <b className="utc-live-title">{currentDefendingProject.supervisor?.full_name}</b> ({currentDefendingProject.supervisor_score !== null ? `${currentDefendingProject.supervisor_score}đ` : 'Chưa chấm'})</span>
                <span>GVPB: <b className="utc-live-title">{currentDefendingProject.reviewer?.full_name}</b> ({currentDefendingProject.reviewer_score !== null ? `${currentDefendingProject.reviewer_score}đ` : 'Chưa chấm'})</span>
              </div>
            </div>

            {/* Quick Actions for Current Defending Student */}
            <div className="space-y-3 min-w-[240px]">
              {/* Grading Progress */}
              <div className="p-3 utc-live-subsurface rounded-xl space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="utc-live-muted">Tiến độ chấm điểm HĐ:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {currentDefendingProject.scoring_summary?.submitted_count || 0} / {currentDefendingProject.scoring_summary?.total_eligible_members || 0}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-300"
                    style={{
                      width: `${
                        currentDefendingProject.scoring_summary?.total_eligible_members
                          ? ((currentDefendingProject.scoring_summary.submitted_count /
                              currentDefendingProject.scoring_summary.total_eligible_members) *
                              100)
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {currentDefendingConflict ? (
                  <button
                    disabled
                    className="flex-1 px-4 py-2 bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30 rounded-xl text-xs font-bold cursor-not-allowed text-center"
                    title={`Bạn là ${currentDefendingConflict} của SV này nên không được chấm điểm Hội đồng theo quy chế.`}
                  >
                    🚫 {currentDefendingConflict} (Không chấm HĐ)
                  </button>
                ) : (
                  <button
                    onClick={() => handleOpenScoreModal(currentDefendingProject)}
                    className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/30 transition text-center"
                  >
                    {currentDefendingProject.my_score ? 'Sửa điểm của bạn' : '✍️ Chấm điểm SV này'}
                  </button>
                )}

                {canOperateSession && (
                  <button
                    disabled={operatingProjectId === currentDefendingProject.id}
                    onClick={() => handleSetDefenseStatus(currentDefendingProject.id, 'DEFENDED')}
                    className="px-4 py-2 bg-red-600/90 hover:bg-red-600 text-white rounded-xl text-xs font-bold shadow-lg transition"
                  >
                    {operatingProjectId === currentDefendingProject.id ? 'Đang cập nhật...' : '⏹ Kết thúc lượt bảo vệ'}
                  </button>
                )}

                {canOperateSession && (currentDefendingProject.scoring_summary?.pending_count || 0) > 0 && (
                  <button
                    disabled={remindingProjectId === currentDefendingProject.id}
                    onClick={() => handleRemindScoring(currentDefendingProject.id)}
                    className="w-full px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition"
                  >
                    🔔 Nhắc nộp điểm ({currentDefendingProject.scoring_summary.pending_count} thành viên chưa nộp)
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="utc-live-surface rounded-xl p-5 text-center space-y-2">
          <p className="text-sm font-semibold utc-live-body">
            Chưa có sinh viên nào đang trong lượt bảo vệ trực tiếp.
          </p>
          {canOperateSession ? (
            <p className="text-xs text-blue-600 dark:text-blue-400">
              💡 Chủ tịch / Thư ký hội đồng: Hãy nhấn nút <b>"▶️ Bắt đầu bảo vệ"</b> ở danh sách bên dưới để bắt đầu lượt bảo vệ cho sinh viên.
            </p>
          ) : (
            <p className="text-xs utc-live-muted">Đang chờ Chủ tịch hội đồng bắt đầu lượt bảo vệ tiếp theo...</p>
          )}
        </div>
      )}

      {/* Projects Defense List */}
      <div className="utc-live-surface rounded-xl p-5 shadow-md space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-bold text-base utc-live-title">Danh sách Sinh viên bảo vệ trong Hội đồng</h3>
          <span className="text-xs utc-live-muted">Trọng số tính điểm: 30% GVHD + 20% GVPB + 50% Hội đồng</span>
        </div>

        <div className="space-y-3">
          {projects.map((p, idx) => {
            const hasMyScore = !!p.my_score;
            const isCurrentlyDefending = p.defense_status === 'DEFENDING';
            const isDefended = p.defense_status === 'DEFENDED';
            const isMatrixOpen = expandedMatrixId === p.id;
            const myConflictRole = getMyProjectConflict(p);

            return (
              <div
                key={p.id}
                className={`rounded-xl border transition utc-live-subsurface ${
                  isCurrentlyDefending
                    ? 'border-red-500/60 shadow-lg shadow-red-500/10'
                    : ''
                }`}
              >
                <div className="p-4 flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1.5 max-w-2xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold utc-live-muted">{idx + 1}.</span>
                      <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">{p.student_reg_no}</span>
                      <span className="font-bold text-sm utc-live-title">{p.student_name}</span>
                      <span className="text-xs utc-live-muted">({p.student_class})</span>

                      {/* Defense Status Badge */}
                      {isCurrentlyDefending && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/40 animate-pulse flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                          Đang bảo vệ
                        </span>
                      )}
                      {isDefended && (
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                          🏁 Đã bảo vệ
                        </span>
                      )}
                      {!isCurrentlyDefending && !isDefended && (
                        <span className="px-2 py-0.5 rounded text-xs font-semibold utc-live-btn-neutral">
                          ⏳ Chờ bảo vệ
                        </span>
                      )}

                      {p.has_conflict && (
                        <span
                          className="px-2 py-0.5 rounded text-xs font-bold bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/40 flex items-center gap-1"
                          title={p.conflicts?.map((c: any) => c.message).join('\n')}
                        >
                          ⚠️ Xung đột ({p.conflicts?.length})
                        </span>
                      )}
                    </div>

                    <p className="text-xs utc-live-body font-medium">{p.topic_title_vi}</p>

                    <div className="flex flex-wrap items-center gap-3 text-xs utc-live-muted pt-1">
                      <span>GVHD: <b className="utc-live-title">{p.supervisor?.full_name}</b> ({p.supervisor_score !== null ? `${p.supervisor_score}đ` : 'Chưa điểm'})</span>
                      <span>GVPB: <b className="utc-live-title">{p.reviewer?.full_name}</b> ({p.reviewer_score !== null ? `${p.reviewer_score}đ` : 'Chưa điểm'})</span>
                      {p.final_grade?.final_score_10 != null && (
                        <span className="text-amber-600 dark:text-amber-400 font-bold">
                          Điểm Tổng kết: {p.final_grade.final_score_10}đ ({p.final_grade.final_letter_grade})
                        </span>
                      )}
                    </div>

                    {p.has_conflict && p.conflicts && p.conflicts.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {p.conflicts.map((c: any, ci: number) => (
                          <span key={ci} className="text-[11px] bg-red-500/10 text-red-600 dark:text-red-300 border border-red-500/20 rounded px-2 py-0.5">
                            ⚠️ {c.message}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions & Status Breakdown */}
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Scoring Progress Summary */}
                    {p.scoring_summary && (
                      <div className="text-right mr-1">
                        <span className="text-xs utc-live-muted">Tiến độ HĐ:</span>
                        <p className={`text-xs font-bold ${p.scoring_summary.is_fully_graded ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                          {p.scoring_summary.submitted_count} / {p.scoring_summary.total_eligible_members} đã nộp
                        </p>
                      </div>
                    )}

                    {/* Member's own score */}
                    {hasMyScore ? (
                      <div className="text-right mr-1">
                        <span className="text-xs utc-live-muted">Điểm của Thầy/Cô:</span>
                        <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">{p.my_score.total_score} / 10đ</p>
                      </div>
                    ) : (
                      <span className="text-xs text-amber-600 dark:text-amber-400 italic mr-1">Chưa chấm</span>
                    )}

                    {/* Score Matrix Toggle */}
                    <button
                      onClick={() => setExpandedMatrixId(isMatrixOpen ? null : p.id)}
                      className={`px-3 py-2 rounded-lg text-xs font-medium border transition ${
                        isMatrixOpen
                          ? 'bg-blue-600/15 text-blue-700 dark:text-blue-300 border-blue-500/40'
                          : 'utc-live-btn-neutral'
                      }`}
                      title="Xem chi tiết điểm của các thành viên trong Hội đồng"
                    >
                      👁️ Ma trận điểm
                    </button>

                    {/* Secretary / Chair Reminder Button */}
                    {canOperateSession && (p.scoring_summary?.pending_count || 0) > 0 && (
                      <button
                        disabled={remindingProjectId === p.id}
                        onClick={() => handleRemindScoring(p.id)}
                        className="px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
                        title="Gửi thông báo & email nhắc nhở thành viên chưa nộp điểm"
                      >
                        🔔 Nhắc nộp điểm ({p.scoring_summary.pending_count})
                      </button>
                    )}

                    {/* Chair / Secretary Defense Session Transition Controls */}
                    {canOperateSession && (
                      <>
                        {isCurrentlyDefending ? (
                          <button
                            disabled={operatingProjectId === p.id}
                            onClick={() => handleSetDefenseStatus(p.id, 'DEFENDED')}
                            className="px-3.5 py-2 rounded-lg bg-red-600/90 hover:bg-red-600 text-white text-xs font-semibold transition shadow-md shadow-red-600/20"
                          >
                            ⏹ Kết thúc BV
                          </button>
                        ) : isDefended ? (
                          <button
                            disabled={operatingProjectId === p.id}
                            onClick={() => handleSetDefenseStatus(p.id, 'DEFENDING')}
                            className="px-3.5 py-2 rounded-lg utc-live-btn-neutral text-xs font-semibold transition"
                          >
                            🔄 Mở lại BV
                          </button>
                        ) : (
                          <button
                            disabled={operatingProjectId === p.id}
                            onClick={() => handleSetDefenseStatus(p.id, 'DEFENDING')}
                            className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition shadow-md shadow-blue-600/20"
                          >
                            ▶️ Bắt đầu BV
                          </button>
                        )}
                      </>
                    )}

                    {/* Grade Button - Accurate per-user conflict check (Item 32) */}
                    {myConflictRole ? (
                      <button
                        disabled
                        className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30 cursor-not-allowed opacity-85"
                        title={`Bạn là ${myConflictRole} của SV này nên không được chấm điểm Hội đồng theo quy chế.`}
                      >
                        🚫 {myConflictRole} (Không chấm HĐ)
                      </button>
                    ) : (
                      <button
                        onClick={() => handleOpenScoreModal(p)}
                        className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
                          councilData.is_locked
                            ? 'utc-live-btn-neutral'
                            : hasMyScore
                            ? 'utc-live-btn-neutral'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30'
                        }`}
                      >
                        {councilData.is_locked ? '👁️ Xem điểm' : hasMyScore ? 'Sửa điểm' : '✍️ Chấm điểm bảo vệ'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Collapsible Council Scoring Matrix */}
                {isMatrixOpen && (
                  <div className="p-4 utc-live-surface border-t space-y-3 rounded-b-xl">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold utc-live-body uppercase tracking-wider">
                        📊 Ma trận nộp điểm thành viên Hội đồng cho sinh viên này:
                      </h4>
                      <span className="text-xs utc-live-muted">
                        Đã nộp: <b className="text-emerald-600 dark:text-emerald-400">{p.scoring_summary?.submitted_count}</b> / {p.scoring_summary?.total_eligible_members}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                      {p.scoring_summary?.members_breakdown?.map((m: any) => {
                        const isExempt = Boolean(m.is_supervisor || m.is_reviewer);
                        const exemptLabel = m.is_supervisor ? 'GVHD - Không chấm' : 'GVPB - Không chấm';
                        return (
                          <div
                            key={m.member_id}
                            className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
                              isExempt
                                ? 'utc-live-subsurface opacity-75'
                                : m.has_submitted
                                ? 'bg-emerald-500/10 border-emerald-500/25 utc-live-body'
                                : 'bg-amber-500/10 border-amber-500/25 utc-live-body'
                            }`}
                          >
                            <div>
                              <p className="font-semibold utc-live-title">{m.name}</p>
                              <p className="text-[11px] utc-live-muted">
                                {m.role} {isExempt && `• (${exemptLabel})`}
                              </p>
                            </div>
                            <div>
                              {isExempt ? (
                                <span className="text-[10px] utc-live-muted italic">Miễn chấm</span>
                              ) : m.has_submitted ? (
                                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-bold text-xs border border-emerald-500/30">
                                  {m.total_score}đ
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-400 text-[10px] font-semibold border border-amber-500/30">
                                  Chưa nộp
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {canOperateSession && (p.scoring_summary?.pending_count || 0) > 0 && (
                      <div className="pt-2 flex justify-end">
                        <button
                          disabled={remindingProjectId === p.id}
                          onClick={() => handleRemindScoring(p.id)}
                          className="px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/40 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                        >
                          🔔 Gửi nhắc nhở ngay tới {p.scoring_summary.pending_count} thành viên chưa nộp điểm
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal Live Grading Form */}
      {showScoreModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={handleScoreOverlayClick}>
          <div className="utc-live-surface p-6 rounded-xl max-w-lg w-full shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <div>
              <span className="text-xs font-mono text-blue-600 dark:text-blue-400">
                {selectedProject?.student_reg_no} - {selectedProject?.student_name}
              </span>
              <h3 className="text-base font-bold utc-live-title mt-1">{selectedProject?.topic_title_vi}</h3>
            </div>

            {councilData.is_locked && (
              <div className="p-3 bg-rose-500/15 border border-rose-500/40 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <span>🔒</span>
                <span>
                  Hội đồng đã khóa điểm sau buổi bảo vệ{councilData.locked_by ? ` (bởi ${councilData.locked_by})` : ''}. Tất cả điểm số chuyển sang chế độ Chỉ xem và không thể chỉnh sửa.
                </span>
              </div>
            )}

            <form onSubmit={handleScoreSubmit} className="space-y-4">
              <div className="space-y-3 p-4 utc-live-subsurface rounded-xl text-xs">
                <div>
                  <div className="flex justify-between font-medium utc-live-body mb-1">
                    <span>1. Kỹ năng Thuyết trình & Báo cáo</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400">{scorePres} / 3.0đ</span>
                  </div>
                  <input
                    type="range"
                    step="0.1"
                    min="0"
                    max="3.0"
                    value={scorePres}
                    disabled={councilData.is_locked}
                    onChange={(e) => setScorePres(e.target.value)}
                    className="w-full h-1.5 bg-slate-300 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                  />
                </div>

                <div>
                  <div className="flex justify-between font-medium utc-live-body mb-1">
                    <span>2. Chất lượng nội dung chuyên môn đồ án</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400">{scoreContent} / 3.0đ</span>
                  </div>
                  <input
                    type="range"
                    step="0.1"
                    min="0"
                    max="3.0"
                    value={scoreContent}
                    disabled={councilData.is_locked}
                    onChange={(e) => setScoreContent(e.target.value)}
                    className="w-full h-1.5 bg-slate-300 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                  />
                </div>

                <div>
                  <div className="flex justify-between font-medium utc-live-body mb-1">
                    <span>3. Trả lời câu hỏi phản biện</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400">{scoreQa} / 2.0đ</span>
                  </div>
                  <input
                    type="range"
                    step="0.1"
                    min="0"
                    max="2.0"
                    value={scoreQa}
                    disabled={councilData.is_locked}
                    onChange={(e) => setScoreQa(e.target.value)}
                    className="w-full h-1.5 bg-slate-300 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                  />
                </div>

                <div>
                  <div className="flex justify-between font-medium utc-live-body mb-1">
                    <span>4. Sản phẩm Demo / Ứng dụng thực nghiệm</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400">{scoreDemo} / 2.0đ</span>
                  </div>
                  <input
                    type="range"
                    step="0.1"
                    min="0"
                    max="2.0"
                    value={scoreDemo}
                    disabled={councilData.is_locked}
                    onChange={(e) => setScoreDemo(e.target.value)}
                    className="w-full h-1.5 bg-slate-300 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                  />
                </div>

                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
                  <span className="font-bold text-sm utc-live-title">Tổng điểm Hội đồng (Thang 10):</span>
                  <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">{totalPreview.toFixed(1)} / 10.0</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium utc-live-muted mb-1">
                  Ý kiến nhận xét & Câu hỏi cho sinh viên
                </label>
                <textarea
                  rows={3}
                  value={scoreComments}
                  disabled={councilData.is_locked}
                  onChange={(e) => setScoreComments(e.target.value)}
                  placeholder="Ghi nhận xét và câu hỏi của thành viên hội đồng..."
                  className="w-full px-3 py-2 utc-live-input rounded-lg text-xs focus:outline-none focus:border-blue-500 disabled:opacity-50"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={requestCloseScoreModal}
                  className="px-4 py-2 rounded-lg utc-live-btn-neutral text-xs"
                >
                  {councilData.is_locked ? 'Đóng' : 'Hủy'}
                </button>
                {!councilData.is_locked && (
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/30 disabled:opacity-50"
                  >
                    {submitting ? 'Đang lưu...' : 'Xác nhận Điểm Chấm'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

