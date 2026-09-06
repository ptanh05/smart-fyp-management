import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/app';

export const UTCCouncilLiveDefenseView: React.FC = () => {
  const [councilData, setCouncilData] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoSync, setAutoSync] = useState(true);

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

  const getHeaders = () => {
    const token = localStorage.getItem('access_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await axios.get(`${API_BASE}/council/live-session/`, { headers: getHeaders() });
      setCouncilData(res.data.council);
      setProjects(res.data.projects || []);
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Real-time auto sync every 5 seconds
  useEffect(() => {
    if (!autoSync) return;
    const interval = setInterval(() => {
      fetchData(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [autoSync]);

  // Live session timer countdown
  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => Math.max(0, prev - 1));
      }, 1000);
    } else if (timerSeconds === 0 && isTimerRunning) {
      setIsTimerRunning(false);
      alert('⏰ Hết giờ trình bày bảo vệ của sinh viên!');
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
      const res = await axios.post(
        `${API_BASE}/council/set-defense-status/`,
        { project_id: projectId, defense_status: defenseStatus },
        { headers: getHeaders() }
      );
      alert(res.data.message || 'Đã cập nhật trạng thái bảo vệ!');
      if (defenseStatus === 'DEFENDING') {
        setTimerSeconds(15 * 60);
        setIsTimerRunning(true);
      } else if (defenseStatus === 'DEFENDED') {
        setIsTimerRunning(false);
      }
      await fetchData(true);
    } catch (err: any) {
      alert('Lỗi điều hành bảo vệ: ' + (err.response?.data?.detail || err.message));
    } finally {
      setOperatingProjectId(null);
    }
  };

  // Remind scoring (Secretary / Chair)
  const handleRemindScoring = async (projectId: number) => {
    try {
      setRemindingProjectId(projectId);
      const res = await axios.post(
        `${API_BASE}/council/remind-scoring/`,
        { project_id: projectId },
        { headers: getHeaders() }
      );
      const notifiedList = (res.data.notified_members || []).join(', ');
      alert(
        (res.data.message || 'Đã gửi thông báo nhắc nhở nộp điểm!') +
          (notifiedList ? `\n\nĐã nhắc: ${notifiedList}` : '')
      );
      await fetchData(true);
    } catch (err: any) {
      alert('Lỗi gửi nhắc nhở: ' + (err.response?.data?.detail || err.message));
    } finally {
      setRemindingProjectId(null);
    }
  };

  const handleOpenScoreModal = (project: any) => {
    setSelectedProject(project);
    if (project.my_score) {
      setScorePres(project.my_score.score_presentation);
      setScoreContent(project.my_score.score_content);
      setScoreQa(project.my_score.score_qa);
      setScoreDemo(project.my_score.score_demo);
      setScoreComments(project.my_score.comments || '');
    } else {
      setScorePres(2.5);
      setScoreContent(2.5);
      setScoreQa(1.5);
      setScoreDemo(1.5);
      setScoreComments('');
    }
    setShowScoreModal(true);
  };

  const handleScoreSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;

    try {
      setSubmitting(true);
      const res = await axios.post(
        `${API_BASE}/council/submit-score/`,
        {
          project_id: selectedProject.id,
          score_presentation: Number(scorePres),
          score_content: Number(scoreContent),
          score_qa: Number(scoreQa),
          score_demo: Number(scoreDemo),
          comments: scoreComments,
        },
        { headers: getHeaders() }
      );
      alert(res.data.message || 'Đã chấm điểm thành công!');
      setShowScoreModal(false);
      fetchData(true);
    } catch (err: any) {
      alert('Lỗi chấm điểm: ' + (err.response?.data?.detail || JSON.stringify(err.response?.data) || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  const totalPreview =
    (Number(scorePres) || 0) +
    (Number(scoreContent) || 0) +
    (Number(scoreQa) || 0) +
    (Number(scoreDemo) || 0);

  if (loading) {
    return <div className="p-8 text-center text-slate-400">Đang tải phiên bảo vệ trực tiếp của Hội đồng...</div>;
  }

  if (!councilData) {
    return (
      <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-xl space-y-2">
        <h4 className="text-base font-bold text-slate-200">Không tìm thấy phiên bảo vệ</h4>
        <p className="text-xs text-slate-400">Bạn hiện không được phân công vào Hội đồng bảo vệ nào trong đợt này.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Council Info Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
              Hội đồng #{councilData.council_number}
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold">
              Vai trò của bạn: {councilData.my_role}
            </span>
            {isChair && (
              <span className="text-xs px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold">
                👑 Quyền Điều hành
              </span>
            )}
            {isSecretary && (
              <span className="text-xs px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold">
                📝 Quyền Thư ký
              </span>
            )}
          </div>
          <h2 className="text-xl font-bold text-slate-100 mt-1">{councilData.council_name}</h2>
          <div className="text-xs text-slate-400 mt-1 flex items-center gap-4">
            <span>🏛️ Phòng: <b>{councilData.defense_room || 'TBA'}</b></span>
            <span>📅 Ngày: <b>{councilData.session_date || 'TBA'}</b></span>
            <span>⏰ Ca: <b>{councilData.session_time}</b></span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Live Sync Toggle */}
          <button
            onClick={() => setAutoSync(!autoSync)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition ${
              autoSync
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${autoSync ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
            {autoSync ? 'Đang Live Sync (5s)' : 'Tạm dừng Sync'}
          </button>

          <div className="text-right">
            <span className="text-xs text-slate-400">Tổng số đề tài</span>
            <p className="text-2xl font-bold text-emerald-400">{projects.length} SV</p>
          </div>
        </div>
      </div>

      {/* LIVE DEFENSE EXECUTIVE DASHBOARD BANNER */}
      {currentDefendingProject ? (
        <div className="bg-gradient-to-r from-red-950/40 via-slate-900 to-slate-900 border-2 border-red-500/50 rounded-2xl p-6 shadow-2xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-red-500/20 pb-4">
            <div className="flex items-center gap-3">
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
              <span className="text-xs font-extrabold tracking-wider uppercase text-red-400 bg-red-500/10 px-3 py-1 rounded-full border border-red-500/30">
                🔴 LIVE SESSION: Đang bảo vệ trực tiếp
              </span>
            </div>

            {/* Live Presentation Timer */}
            <div className="flex items-center gap-3 bg-slate-950 px-4 py-2 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-400">Thời gian trình bày:</span>
              <span className={`font-mono text-xl font-black ${timerSeconds < 180 ? 'text-red-400 animate-pulse' : 'text-emerald-400'}`}>
                ⏱ {formatTimer(timerSeconds)}
              </span>
              <div className="flex items-center gap-1.5 ml-2 border-l border-slate-800 pl-2">
                <button
                  onClick={() => setIsTimerRunning(!isTimerRunning)}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-xs rounded text-slate-200"
                >
                  {isTimerRunning ? '⏸ Dừng' : '▶️ Chạy'}
                </button>
                <button
                  onClick={() => setTimerSeconds(15 * 60)}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-xs rounded text-slate-300"
                  title="Đặt lại 15 phút"
                >
                  15p
                </button>
                <button
                  onClick={() => setTimerSeconds((prev) => prev + 5 * 60)}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-xs rounded text-slate-300"
                  title="Cộng thêm 5 phút"
                >
                  +5p
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2 max-w-3xl">
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm font-bold text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded border border-blue-500/20">
                  {currentDefendingProject.student_reg_no}
                </span>
                <h3 className="text-lg font-bold text-slate-100">{currentDefendingProject.student_name}</h3>
                <span className="text-xs text-slate-400">Lớp: {currentDefendingProject.student_class}</span>
              </div>

              <h4 className="text-sm font-semibold text-slate-200">
                {currentDefendingProject.topic_title_vi}
              </h4>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
                <span>GVHD: <b className="text-slate-300">{currentDefendingProject.supervisor?.full_name}</b> ({currentDefendingProject.supervisor_score !== null ? `${currentDefendingProject.supervisor_score}đ` : 'Chưa chấm'})</span>
                <span>GVPB: <b className="text-slate-300">{currentDefendingProject.reviewer?.full_name}</b> ({currentDefendingProject.reviewer_score !== null ? `${currentDefendingProject.reviewer_score}đ` : 'Chưa chấm'})</span>
              </div>
            </div>

            {/* Quick Actions for Current Defending Student */}
            <div className="space-y-3 min-w-[240px]">
              {/* Grading Progress */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Tiến độ chấm điểm HĐ:</span>
                  <span className="font-bold text-emerald-400">
                    {currentDefendingProject.scoring_summary?.submitted_count || 0} / {currentDefendingProject.scoring_summary?.total_eligible_members || 0}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
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
                <button
                  onClick={() => handleOpenScoreModal(currentDefendingProject)}
                  className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/30 transition text-center"
                >
                  {currentDefendingProject.my_score ? 'Sửa điểm của bạn' : '✍️ Chấm điểm SV này'}
                </button>

                {canOperateSession && (
                  <button
                    disabled={operatingProjectId === currentDefendingProject.id}
                    onClick={() => handleSetDefenseStatus(currentDefendingProject.id, 'DEFENDED')}
                    className="px-4 py-2 bg-red-600/80 hover:bg-red-600 text-white rounded-xl text-xs font-bold shadow-lg transition"
                  >
                    {operatingProjectId === currentDefendingProject.id ? 'Đang cập nhật...' : '⏹ Kết thúc lượt bảo vệ'}
                  </button>
                )}

                {canOperateSession && (currentDefendingProject.scoring_summary?.pending_count || 0) > 0 && (
                  <button
                    disabled={remindingProjectId === currentDefendingProject.id}
                    onClick={() => handleRemindScoring(currentDefendingProject.id)}
                    className="w-full px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition"
                  >
                    🔔 Nhắc nộp điểm ({currentDefendingProject.scoring_summary.pending_count} thành viên chưa nộp)
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-center space-y-2">
          <p className="text-sm font-semibold text-slate-300">
            Chưa có sinh viên nào đang trong lượt bảo vệ trực tiếp.
          </p>
          {canOperateSession ? (
            <p className="text-xs text-blue-400">
              💡 Chủ tịch / Thư ký hội đồng: Hãy nhấn nút <b>"▶️ Bắt đầu bảo vệ"</b> ở danh sách bên dưới để bắt đầu lượt bảo vệ cho sinh viên.
            </p>
          ) : (
            <p className="text-xs text-slate-500">Đang chờ Chủ tịch hội đồng bắt đầu lượt bảo vệ tiếp theo...</p>
          )}
        </div>
      )}

      {/* Projects Defense List */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-bold text-base text-slate-100">Danh sách Sinh viên bảo vệ trong Hội đồng</h3>
          <span className="text-xs text-slate-400">Trọng số tính điểm: 40% GVHD + 20% GVPB + 40% Hội đồng</span>
        </div>

        <div className="space-y-3">
          {projects.map((p, idx) => {
            const hasMyScore = !!p.my_score;
            const isCurrentlyDefending = p.defense_status === 'DEFENDING';
            const isDefended = p.defense_status === 'DEFENDED';
            const isMatrixOpen = expandedMatrixId === p.id;

            return (
              <div
                key={p.id}
                className={`rounded-xl border transition ${
                  isCurrentlyDefending
                    ? 'bg-slate-950 border-red-500/50 shadow-lg shadow-red-500/5'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="p-4 flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1.5 max-w-2xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-slate-400">{idx + 1}.</span>
                      <span className="font-mono text-xs font-bold text-blue-400">{p.student_reg_no}</span>
                      <span className="font-bold text-sm text-slate-100">{p.student_name}</span>
                      <span className="text-xs text-slate-400">({p.student_class})</span>

                      {/* Defense Status Badge */}
                      {isCurrentlyDefending && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                          Đang bảo vệ
                        </span>
                      )}
                      {isDefended && (
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          🏁 Đã bảo vệ
                        </span>
                      )}
                      {!isCurrentlyDefending && !isDefended && (
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                          ⏳ Chờ bảo vệ
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-200 font-medium">{p.topic_title_vi}</p>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 pt-1">
                      <span>GVHD: <b className="text-slate-300">{p.supervisor?.full_name}</b> ({p.supervisor_score !== null ? `${p.supervisor_score}đ` : 'Chưa điểm'})</span>
                      <span>GVPB: <b className="text-slate-300">{p.reviewer?.full_name}</b> ({p.reviewer_score !== null ? `${p.reviewer_score}đ` : 'Chưa điểm'})</span>
                      {p.final_grade?.final_score_10 !== null && (
                        <span className="text-amber-400 font-bold">
                          Điểm Tổng kết: {p.final_grade.final_score_10}đ ({p.final_grade.final_letter_grade})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions & Status Breakdown */}
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Scoring Progress Summary */}
                    {p.scoring_summary && (
                      <div className="text-right mr-1">
                        <span className="text-xs text-slate-400">Tiến độ HĐ:</span>
                        <p className={`text-xs font-bold ${p.scoring_summary.is_fully_graded ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {p.scoring_summary.submitted_count} / {p.scoring_summary.total_eligible_members} đã nộp
                        </p>
                      </div>
                    )}

                    {/* Member's own score */}
                    {hasMyScore ? (
                      <div className="text-right mr-1">
                        <span className="text-xs text-slate-400">Điểm của Thầy/Cô:</span>
                        <p className="text-base font-bold text-emerald-400">{p.my_score.total_score} / 10đ</p>
                      </div>
                    ) : (
                      <span className="text-xs text-amber-400 italic mr-1">Chưa chấm</span>
                    )}

                    {/* Score Matrix Toggle */}
                    <button
                      onClick={() => setExpandedMatrixId(isMatrixOpen ? null : p.id)}
                      className={`px-3 py-2 rounded-lg text-xs font-medium border transition ${
                        isMatrixOpen
                          ? 'bg-blue-600/20 text-blue-300 border-blue-500/40'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
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
                        className="px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
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
                            className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold transition"
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

                    {/* Grade Button */}
                    <button
                      onClick={() => handleOpenScoreModal(p)}
                      className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
                        hasMyScore
                          ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30'
                      }`}
                    >
                      {hasMyScore ? 'Sửa điểm' : '✍️ Chấm điểm'}
                    </button>
                  </div>
                </div>

                {/* Collapsible Council Scoring Matrix */}
                {isMatrixOpen && (
                  <div className="p-4 bg-slate-900 border-t border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                        📊 Ma trận nộp điểm thành viên Hội đồng cho sinh viên này:
                      </h4>
                      <span className="text-xs text-slate-400">
                        Đã nộp: <b className="text-emerald-400">{p.scoring_summary?.submitted_count}</b> / {p.scoring_summary?.total_eligible_members}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                      {p.scoring_summary?.members_breakdown?.map((m: any) => (
                        <div
                          key={m.member_id}
                          className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
                            m.is_supervisor
                              ? 'bg-slate-950/60 border-slate-800 text-slate-500'
                              : m.has_submitted
                              ? 'bg-emerald-500/5 border-emerald-500/20 text-slate-200'
                              : 'bg-amber-500/5 border-amber-500/20 text-slate-300'
                          }`}
                        >
                          <div>
                            <p className="font-semibold text-slate-200">{m.name}</p>
                            <p className="text-[11px] text-slate-400">
                              {m.role} {m.is_supervisor && '• (GVHD - Không chấm)'}
                            </p>
                          </div>
                          <div>
                            {m.is_supervisor ? (
                              <span className="text-[10px] text-slate-500 italic">Miễn chấm</span>
                            ) : m.has_submitted ? (
                              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold text-xs border border-emerald-500/30">
                                {m.total_score}đ
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-semibold border border-amber-500/30">
                                Chưa nộp
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {canOperateSession && (p.scoring_summary?.pending_count || 0) > 0 && (
                      <div className="pt-2 flex justify-end">
                        <button
                          disabled={remindingProjectId === p.id}
                          onClick={() => handleRemindScoring(p.id)}
                          className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl max-w-lg w-full shadow-2xl space-y-4">
            <div>
              <span className="text-xs font-mono text-blue-400">
                {selectedProject?.student_reg_no} - {selectedProject?.student_name}
              </span>
              <h3 className="text-base font-bold text-slate-100 mt-1">{selectedProject?.topic_title_vi}</h3>
            </div>

            <form onSubmit={handleScoreSubmit} className="space-y-4">
              <div className="space-y-3 p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                <div>
                  <div className="flex justify-between font-medium text-slate-300 mb-1">
                    <span>1. Kỹ năng Thuyết trình & Báo cáo</span>
                    <span className="font-bold text-blue-400">{scorePres} / 3.0đ</span>
                  </div>
                  <input
                    type="range"
                    step="0.1"
                    min="0"
                    max="3.0"
                    value={scorePres}
                    onChange={(e) => setScorePres(e.target.value)}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between font-medium text-slate-300 mb-1">
                    <span>2. Chất lượng nội dung chuyên môn đồ án</span>
                    <span className="font-bold text-blue-400">{scoreContent} / 3.0đ</span>
                  </div>
                  <input
                    type="range"
                    step="0.1"
                    min="0"
                    max="3.0"
                    value={scoreContent}
                    onChange={(e) => setScoreContent(e.target.value)}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between font-medium text-slate-300 mb-1">
                    <span>3. Trả lời câu hỏi phản biện</span>
                    <span className="font-bold text-blue-400">{scoreQa} / 2.0đ</span>
                  </div>
                  <input
                    type="range"
                    step="0.1"
                    min="0"
                    max="2.0"
                    value={scoreQa}
                    onChange={(e) => setScoreQa(e.target.value)}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between font-medium text-slate-300 mb-1">
                    <span>4. Sản phẩm Demo / Ứng dụng thực nghiệm</span>
                    <span className="font-bold text-blue-400">{scoreDemo} / 2.0đ</span>
                  </div>
                  <input
                    type="range"
                    step="0.1"
                    min="0"
                    max="2.0"
                    value={scoreDemo}
                    onChange={(e) => setScoreDemo(e.target.value)}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
                  <span className="font-bold text-sm text-slate-100">Tổng điểm Hội đồng (Thang 10):</span>
                  <span className="text-xl font-extrabold text-emerald-400">{totalPreview.toFixed(1)} / 10.0</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Ý kiến nhận xét & Câu hỏi cho sinh viên
                </label>
                <textarea
                  rows={3}
                  value={scoreComments}
                  onChange={(e) => setScoreComments(e.target.value)}
                  placeholder="Ghi nhận xét và câu hỏi của thành viên hội đồng..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowScoreModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs hover:bg-slate-700"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/30 disabled:opacity-50"
                >
                  {submitting ? 'Đang lưu...' : 'Xác nhận Điểm Chấm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

