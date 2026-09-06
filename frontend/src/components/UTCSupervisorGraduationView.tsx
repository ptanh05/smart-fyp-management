import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/app';


export const UTCSupervisorGraduationView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'students' | 'outlines' | 'weekly' | 'eval' | 'reviewer'>('students');
  const [projects, setProjects] = useState<any[]>([]);
  const [reviewerProjects, setReviewerProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Outline Review Modal
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [verdict, setVerdict] = useState<'APPROVED' | 'REVISION_REQUIRED' | 'REJECTED'>('APPROVED');
  const [outlineComments, setOutlineComments] = useState('');
  const [showOutlineModal, setShowOutlineModal] = useState(false);

  // Weekly Feedback Modal
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [weeklyRating, setWeeklyRating] = useState<'GOOD' | 'ACCEPTABLE' | 'LATE' | 'UNSATISFACTORY'>('GOOD');
  const [weeklyFeedback, setWeeklyFeedback] = useState('');
  const [showWeeklyModal, setShowWeeklyModal] = useState(false);

  // Supervisor Defense Evaluation Modal
  const [showEvalModal, setShowEvalModal] = useState(false);
  const [evalScore, setEvalScore] = useState('');
  const [evalFeedback, setEvalFeedback] = useState('');
  const [isEligible, setIsEligible] = useState(true);

  // Reviewer Score Modal
  const [showReviewerModal, setShowReviewerModal] = useState(false);
  const [revScore, setRevScore] = useState('');
  const [revFeedback, setRevFeedback] = useState('');

  // Supervision Meeting Logs & Tasks Modal State
  const [showSupervisionModal, setShowSupervisionModal] = useState(false);
  const [supervisionProject, setSupervisionProject] = useState<any>(null);
  const [supervisionLogs, setSupervisionLogs] = useState<any[]>([]);
  const [supervisionTasks, setSupervisionTasks] = useState<any[]>([]);
  const [supervisionSubTab, setSupervisionSubTab] = useState<'logs' | 'tasks'>('tasks');
  const [loadingSupervision, setLoadingSupervision] = useState(false);

  // New Log Form State
  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().split('T')[0]);
  const [meetingTime, setMeetingTime] = useState('09:00 - 10:30');
  const [meetingType, setMeetingType] = useState<'OFFLINE' | 'ONLINE'>('OFFLINE');
  const [locationOrLink, setLocationOrLink] = useState('');
  const [contentDiscussed, setContentDiscussed] = useState('');
  const [supervisorNotes, setSupervisorNotes] = useState('');
  const [nextMeetingPlan, setNextMeetingPlan] = useState('');
  const [savingLog, setSavingLog] = useState(false);
  const [showAddLogForm, setShowAddLogForm] = useState(false);

  // New Task Form State
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskPriority, setTaskPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM');
  const [savingTask, setSavingTask] = useState(false);
  const [showAddTaskForm, setShowAddTaskForm] = useState(false);

  const getHeaders = () => {
    const token = localStorage.getItem('access_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [projRes, revRes] = await Promise.all([
        axios.get(`${API_BASE}/supervisor/graduation-projects/`, { headers: getHeaders() }).catch(() => null),
        axios.get(`${API_BASE}/reviewer/assigned-projects/`, { headers: getHeaders() }).catch(() => null),
      ]);
      if (projRes?.data) setProjects(projRes.data);
      if (revRes?.data) setReviewerProjects(revRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenSupervision = async (project: any) => {
    setSupervisionProject(project);
    setShowSupervisionModal(true);
    setLoadingSupervision(true);
    setShowAddLogForm(false);
    setShowAddTaskForm(false);
    try {
      const [logsRes, tasksRes] = await Promise.all([
        axios.get(`${API_BASE}/supervisor/supervision-logs/?project_id=${project.id}`, { headers: getHeaders() }).catch(() => null),
        axios.get(`${API_BASE}/supervisor/tasks/?project_id=${project.id}`, { headers: getHeaders() }).catch(() => null),
      ]);
      if (logsRes?.data) setSupervisionLogs(logsRes.data);
      if (tasksRes?.data) setSupervisionTasks(tasksRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSupervision(false);
    }
  };

  const handleCreateMeetingLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supervisionProject || !contentDiscussed) return;
    try {
      setSavingLog(true);
      const res = await axios.post(
        `${API_BASE}/supervisor/supervision-logs/`,
        {
          project_id: supervisionProject.id,
          meeting_date: meetingDate,
          meeting_time: meetingTime,
          meeting_type: meetingType,
          location_or_link: locationOrLink,
          content_discussed: contentDiscussed,
          supervisor_notes: supervisorNotes,
          next_meeting_plan: nextMeetingPlan,
        },
        { headers: getHeaders() }
      );
      alert(res.data?.message || 'Đã lưu nhật ký hướng dẫn thành công!');
      setContentDiscussed('');
      setSupervisorNotes('');
      setNextMeetingPlan('');
      setShowAddLogForm(false);
      const logsRes = await axios.get(`${API_BASE}/supervisor/supervision-logs/?project_id=${supervisionProject.id}`, { headers: getHeaders() });
      if (logsRes?.data) setSupervisionLogs(logsRes.data);
    } catch (err: any) {
      alert('Lỗi lưu nhật ký: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSavingLog(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supervisionProject || !taskTitle) return;
    try {
      setSavingTask(true);
      const res = await axios.post(
        `${API_BASE}/supervisor/tasks/`,
        {
          project_id: supervisionProject.id,
          title: taskTitle,
          description: taskDesc,
          due_date: taskDueDate || null,
          priority: taskPriority,
        },
        { headers: getHeaders() }
      );
      alert(res.data?.message || 'Đã giao nhiệm vụ cho sinh viên!');
      setTaskTitle('');
      setTaskDesc('');
      setTaskDueDate('');
      setShowAddTaskForm(false);
      const tasksRes = await axios.get(`${API_BASE}/supervisor/tasks/?project_id=${supervisionProject.id}`, { headers: getHeaders() });
      if (tasksRes?.data) setSupervisionTasks(tasksRes.data);
    } catch (err: any) {
      alert('Lỗi giao việc: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSavingTask(false);
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    if (!confirm('Bạn có chắc chắn muốn xóa nhiệm vụ này?')) return;
    try {
      await axios.delete(`${API_BASE}/supervisor/tasks/${taskId}/`, { headers: getHeaders() });
      setSupervisionTasks(supervisionTasks.filter((t) => t.id !== taskId));
    } catch (err: any) {
      alert('Lỗi xóa nhiệm vụ: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleReviewOutline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;
    try {
      await axios.post(
        `${API_BASE}/supervisor/outline/review/`,
        {
          project_id: selectedProject.id,
          verdict,
          comments: outlineComments,
        },
        { headers: getHeaders()}
      );
      alert('Đã cập nhật kết quả duyệt đề cương!');
      setShowOutlineModal(false);
      fetchData();
    } catch (err: any) {
      alert('Lỗi: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleFeedbackWeekly = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReport) return;
    try {
      await axios.post(
        `${API_BASE}/supervisor/weekly-feedback/`,
        {
          report_id: selectedReport.id,
          rating: weeklyRating,
          feedback: weeklyFeedback,
        },
        { headers: getHeaders()}
      );
      alert('Đã lưu nhận xét và đánh giá tiến độ tuần!');
      setShowWeeklyModal(false);
      fetchData();
    } catch (err: any) {
      alert('Lỗi: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleSupervisorEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;
    try {
      await axios.post(
        `${API_BASE}/supervisor/defense-evaluation/`,
        {
          project_id: selectedProject.id,
          supervisor_score: Number(evalScore),
          supervisor_feedback: evalFeedback,
          is_eligible_for_defense: isEligible,
        },
        { headers: getHeaders()}
      );
      alert('Đã lưu phiếu đánh giá GVHD thành công!');
      setShowEvalModal(false);
      fetchData();
    } catch (err: any) {
      alert('Lỗi: ' + (err.response?.data?.supervisor_score?.[0] || err.message));
    }
  };

  const handleReviewerEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;
    try {
      await axios.post(
        `${API_BASE}/reviewer/submit-evaluation/`,
        {
          project_id: selectedProject.id,
          reviewer_score: Number(revScore),
          reviewer_feedback: revFeedback,
        },
        { headers: getHeaders()}
      );
      alert('Đã lưu phiếu phản biện thành công!');
      setShowReviewerModal(false);
      fetchData();
    } catch (err: any) {
      alert('Lỗi: ' + (err.response?.data?.reviewer_score?.[0] || err.message));
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-400">Đang tải danh sách sinh viên hướng dẫn...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-700/60 pb-3">
        {[
          { key: 'students', label: `1. Sinh viên hướng dẫn (${projects.length})`, icon: '👨‍🎓' },
          { key: 'outlines', label: '2. Duyệt Đề cương', icon: '📝' },
          { key: 'weekly', label: '3. Báo cáo tuần & Đánh giá', icon: '📅' },
          { key: 'eval', label: '4. Đánh giá sơ khảo GVHD', icon: '⭐' },
          { key: 'reviewer', label: `5. Đồ án Phản biện (${reviewerProjects.length})`, icon: '🔍' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition flex items-center gap-2 ${
              activeTab === tab.key
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab 1: Students List */}
      {activeTab === 'students' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
          <h3 className="font-bold text-base text-slate-100 mb-4">Danh sách Sinh viên đang hướng dẫn ĐATN</h3>
          {projects.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">Chưa có sinh viên nào được phân công.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase font-semibold">
                  <tr>
                    <th className="p-3">MSSV</th>
                    <th className="p-3">Họ và tên</th>
                    <th className="p-3">Lớp / Ngành</th>
                    <th className="p-3">Tên đề tài đồ án</th>
                    <th className="p-3">Điện thoại / Email</th>
                    <th className="p-3">Trạng thái</th>
                    <th className="p-3 text-right">Hướng dẫn & Nhiệm vụ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {projects.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-950/40">
                      <td className="p-3 font-mono font-semibold text-blue-400">{p.student_reg_no}</td>
                      <td className="p-3 font-medium text-slate-100">{p.student_name}</td>
                      <td className="p-3 text-slate-400">{p.student_class}</td>
                      <td className="p-3 font-medium text-slate-200 max-w-xs">{p.topic_title_vi}</td>
                      <td className="p-3 text-slate-400">
                        <div>{p.student_phone || 'N/A'}</div>
                        <div className="text-slate-500">{p.student_email}</div>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs">
                          {p.status_display || p.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => handleOpenSupervision(p)}
                          className="px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-semibold transition inline-flex items-center gap-1.5"
                        >
                          <span>📋</span>
                          <span>Nhật ký & Giao việc</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Outlines Review */}
      {activeTab === 'outlines' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
          <h3 className="font-bold text-base text-slate-100">Xét duyệt Đề cương chi tiết</h3>
          <div className="space-y-3">
            {projects.map((p) => (
              <div key={p.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-blue-400">{p.student_reg_no}</span>
                    <span className="font-semibold text-sm text-slate-100">{p.student_name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                      p.status === 'OUTLINE_APPROVED' ? 'bg-emerald-500/10 text-emerald-400' :
                      p.status === 'OUTLINE_REVISION' ? 'bg-amber-500/10 text-amber-400' :
                      'bg-blue-500/10 text-blue-400'
                    }`}>
                      {p.status_display || p.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300"><b>Đề tài:</b> {p.topic_title_vi}</p>
                </div>

                <button
                  onClick={() => {
                    setSelectedProject(p);
                    setOutlineComments(p.outline_review?.comments || '');
                    setShowOutlineModal(true);
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition"
                >
                  Xét duyệt Đề cương
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Weekly Reports */}
      {activeTab === 'weekly' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
          <h3 className="font-bold text-base text-slate-100">Đánh giá Báo cáo tiến độ tuần (1 - 15)</h3>
          <div className="space-y-4">
            {projects.map((p) => (
              <div key={p.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div>
                    <span className="font-bold text-sm text-slate-100">{p.student_name}</span>
                    <span className="text-xs text-slate-400 ml-2">({p.student_reg_no})</span>
                  </div>
                  <span className="text-xs text-slate-400">Đã nộp: {p.weekly_reports?.length || 0} / 15 tuần</span>
                </div>

                {p.weekly_reports?.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">Sinh viên chưa nộp báo cáo tuần nào.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {p.weekly_reports?.map((r: any) => (
                      <div key={r.id} className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-blue-400">Tuần {r.week_number}</span>
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold">
                            {r.supervisor_rating_display || r.supervisor_rating}
                          </span>
                        </div>
                        <p className="text-slate-300 line-clamp-2">{r.summary_content}</p>
                        {r.supervisor_feedback && (
                          <p className="text-emerald-400 italic">Nhận xét: {r.supervisor_feedback}</p>
                        )}
                        <button
                          onClick={() => {
                            setSelectedReport(r);
                            setWeeklyFeedback(r.supervisor_feedback || '');
                            setShowWeeklyModal(true);
                          }}
                          className="mt-1 text-xs text-blue-400 hover:underline"
                        >
                          ✏️ Đánh giá / Sửa nhận xét
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Final Supervisor Evaluation */}
      {activeTab === 'eval' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
          <h3 className="font-bold text-base text-slate-100">Đánh giá Sơ khảo & Chấm điểm GVHD (40%)</h3>
          <div className="space-y-3">
            {projects.map((p) => (
              <div key={p.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-100">{p.student_name}</span>
                    <span className="text-xs text-slate-400">({p.student_reg_no})</span>
                    {p.is_eligible_for_defense && (
                      <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                        ĐỦ ĐIỀU KIỆN BẢO VỆ
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300"><b>Đề tài:</b> {p.topic_title_vi}</p>
                  <p className="text-xs text-emerald-400 font-semibold">
                    Điểm GVHD: {p.supervisor_score !== null ? `${p.supervisor_score} / 10đ` : 'Chưa chấm'}
                  </p>
                </div>

                <button
                  onClick={() => {
                    setSelectedProject(p);
                    setEvalScore(p.supervisor_score !== null ? p.supervisor_score.toString() : '');
                    setEvalFeedback(p.supervisor_feedback || '');
                    setIsEligible(p.is_eligible_for_defense);
                    setShowEvalModal(true);
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition shadow-md shadow-emerald-600/30"
                >
                  Chấm điểm GVHD
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 5: Reviewer Evaluation */}
      {activeTab === 'reviewer' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
          <h3 className="font-bold text-base text-slate-100">Đồ án được phân công Phản biện độc lập (20%)</h3>
          {reviewerProjects.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">Chưa có đồ án nào được phân công cho Thầy/Cô phản biện.</div>
          ) : (
            <div className="space-y-3">
              {reviewerProjects.map((p) => (
                <div key={p.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-100">{p.student_name}</span>
                      <span className="text-xs text-slate-400">({p.student_reg_no})</span>
                      <span className="text-xs text-slate-400">GVHD: {p.supervisor?.full_name}</span>
                    </div>
                    <p className="text-xs text-slate-300"><b>Đề tài:</b> {p.topic_title_vi}</p>
                    <p className="text-xs text-indigo-400 font-semibold">
                      Điểm GVPB: {p.reviewer_score !== null ? `${p.reviewer_score} / 10đ` : 'Chưa chấm phản biện'}
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedProject(p);
                      setRevScore(p.reviewer_score !== null ? p.reviewer_score.toString() : '');
                      setRevFeedback(p.reviewer_feedback || '');
                      setShowReviewerModal(true);
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition shadow-md shadow-indigo-600/30"
                  >
                    Chấm Phản biện
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal Outline Review */}
      {showOutlineModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl max-w-md w-full shadow-2xl">
            <h3 className="text-base font-bold text-slate-100 mb-2">Xét duyệt Đề cương ĐATN</h3>
            <p className="text-xs text-slate-400 mb-4">{selectedProject?.student_name} - {selectedProject?.topic_title_vi}</p>
            <form onSubmit={handleReviewOutline} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Kết luận xét duyệt</label>
                <select
                  value={verdict}
                  onChange={(e) => setVerdict(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                >
                  <option value="APPROVED">ĐẠT YÊU CẦU (Phê duyệt thực hiện)</option>
                  <option value="REVISION_REQUIRED">YÊU CẦU CHỈNH SỬA LẠI</option>
                  <option value="REJECTED">KHÔNG ĐẠT / HỦY ĐỀ TÀI</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Ý kiến & Nhận xét</label>
                <textarea
                  rows={3}
                  value={outlineComments}
                  onChange={(e) => setOutlineComments(e.target.value)}
                  placeholder="Ghi chú chi tiết cho sinh viên chỉnh sửa..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowOutlineModal(false)}
                  className="px-4 py-2 rounded bg-slate-800 text-slate-300 text-xs hover:bg-slate-700"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-blue-600 text-white text-xs font-semibold hover:bg-blue-500"
                >
                  Lưu kết quả
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Weekly Feedback */}
      {showWeeklyModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl max-w-md w-full shadow-2xl">
            <h3 className="text-base font-bold text-slate-100 mb-4">Đánh giá Báo cáo Tuần {selectedReport?.week_number}</h3>
            <form onSubmit={handleFeedbackWeekly} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Xếp loại tuần</label>
                <select
                  value={weeklyRating}
                  onChange={(e) => setWeeklyRating(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                >
                  <option value="GOOD">Tốt / Đạt tiến độ</option>
                  <option value="ACCEPTABLE">Chấp nhận được</option>
                  <option value="LATE">Chậm tiến độ</option>
                  <option value="UNSATISFACTORY">Không đạt yêu cầu</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Nhận xét của GVHD</label>
                <textarea
                  rows={3}
                  value={weeklyFeedback}
                  onChange={(e) => setWeeklyFeedback(e.target.value)}
                  placeholder="Ghi chú góp ý cho sinh viên..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowWeeklyModal(false)}
                  className="px-4 py-2 rounded bg-slate-800 text-slate-300 text-xs hover:bg-slate-700"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-blue-600 text-white text-xs font-semibold hover:bg-blue-500"
                >
                  Lưu nhận xét
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Supervisor Eval */}
      {showEvalModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl max-w-md w-full shadow-2xl">
            <h3 className="text-base font-bold text-slate-100 mb-2">Phiếu Đánh giá của Giảng viên hướng dẫn</h3>
            <p className="text-xs text-slate-400 mb-4">{selectedProject?.student_name} - {selectedProject?.topic_title_vi}</p>
            <form onSubmit={handleSupervisorEvaluation} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Điểm hướng dẫn (Thang 10, tối đa 10.0đ)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  required
                  placeholder="VD: 8.5"
                  value={evalScore}
                  onChange={(e) => setEvalScore(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer py-1">
                  <input
                    type="checkbox"
                    checked={isEligible}
                    onChange={(e) => setIsEligible(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700"
                  />
                  <span className="text-xs font-bold text-emerald-400">Đồng ý cho sinh viên bảo vệ trước Hội đồng</span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Nhận xét chi tiết về thái độ & kết quả ĐATN</label>
                <textarea
                  rows={3}
                  value={evalFeedback}
                  onChange={(e) => setEvalFeedback(e.target.value)}
                  placeholder="Sinh viên hoàn thành đầy đủ khối lượng công việc, ứng dụng demo chạy tốt..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEvalModal(false)}
                  className="px-4 py-2 rounded bg-slate-800 text-slate-300 text-xs hover:bg-slate-700"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500"
                >
                  Lưu điểm GVHD
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Reviewer Eval */}
      {showReviewerModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl max-w-md w-full shadow-2xl">
            <h3 className="text-base font-bold text-slate-100 mb-2">Phiếu Chấm Giảng viên Phản biện (20%)</h3>
            <p className="text-xs text-slate-400 mb-4">{selectedProject?.student_name} - {selectedProject?.topic_title_vi}</p>
            <form onSubmit={handleReviewerEvaluation} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Điểm phản biện (Thang 10, tối đa 10.0đ)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  required
                  placeholder="VD: 8.0"
                  value={revScore}
                  onChange={(e) => setRevScore(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Nhận xét & Câu hỏi phản biện</label>
                <textarea
                  rows={3}
                  value={revFeedback}
                  onChange={(e) => setRevFeedback(e.target.value)}
                  placeholder="Đề tài có tính ứng dụng cao, câu hỏi phản biện: Phương pháp bảo mật xác thực được thực hiện ra sao?..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReviewerModal(false)}
                  className="px-4 py-2 rounded bg-slate-800 text-slate-300 text-xs hover:bg-slate-700"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500"
                >
                  Lưu điểm Phản biện
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Quản lý Nhật ký & Giao việc cho SV */}
      {showSupervisionModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-5">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-blue-400">
                    {supervisionProject?.student_reg_no}
                  </span>
                  <span className="text-base font-bold text-slate-100">
                    {supervisionProject?.student_name}
                  </span>
                  <span className="text-xs text-slate-400">({supervisionProject?.student_class})</span>
                </div>
                <h4 className="text-xs font-medium text-slate-300 mt-1">
                  <b>Đề tài:</b> {supervisionProject?.topic_title_vi}
                </h4>
              </div>

              <button
                onClick={() => setShowSupervisionModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-sm"
              >
                ✕
              </button>
            </div>

            {/* Sub Tabs */}
            <div className="flex gap-2 border-b border-slate-800 pb-2">
              <button
                onClick={() => setSupervisionSubTab('tasks')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                  supervisionSubTab === 'tasks'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <span>📌</span>
                <span>Nhiệm vụ & Giao việc ({supervisionTasks.length})</span>
              </button>
              <button
                onClick={() => setSupervisionSubTab('logs')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                  supervisionSubTab === 'logs'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <span>🗓️</span>
                <span>Nhật ký họp định kỳ ({supervisionLogs.length})</span>
              </button>
            </div>

            {/* Content: Tasks Sub-Tab */}
            {supervisionSubTab === 'tasks' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="text-sm font-bold text-slate-200">Danh sách công việc giao cho sinh viên</h5>
                    <p className="text-xs text-slate-400">
                      Sinh viên sẽ nhận được thông báo và theo dõi hạn nộp trên Task Board cá nhân.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowAddTaskForm(!showAddTaskForm)}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow transition flex items-center gap-1.5"
                  >
                    <span>{showAddTaskForm ? '✕ Đóng form' : '+ Giao việc mới'}</span>
                  </button>
                </div>

                {/* Add Task Form */}
                {showAddTaskForm && (
                  <form onSubmit={handleCreateTask} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                    <h6 className="text-xs font-bold text-blue-400 uppercase">Thêm nhiệm vụ mới</h6>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Tên nhiệm vụ / công việc *</label>
                      <input
                        type="text"
                        required
                        placeholder="Ví dụ: Hoàn thành thiết kế giao diện Figma cho phân hệ sinh viên"
                        value={taskTitle}
                        onChange={(e) => setTaskTitle(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">Mức độ ưu tiên</label>
                        <select
                          value={taskPriority}
                          onChange={(e) => setTaskPriority(e.target.value as any)}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                        >
                          <option value="LOW">Thấp</option>
                          <option value="MEDIUM">Trung bình</option>
                          <option value="HIGH">Cao</option>
                          <option value="URGENT">Khẩn cấp</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">Hạn nộp (Deadline)</label>
                        <input
                          type="date"
                          value={taskDueDate}
                          onChange={(e) => setTaskDueDate(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                        >
                        </input>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Mô tả chi tiết / Hướng dẫn</label>
                      <textarea
                        rows={2}
                        placeholder="Ghi chú cụ thể các tiêu chuẩn, link tài liệu tham khảo..."
                        value={taskDesc}
                        onChange={(e) => setTaskDesc(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowAddTaskForm(false)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs hover:bg-slate-700"
                      >
                        Hủy
                      </button>
                      <button
                        type="submit"
                        disabled={savingTask}
                        className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow disabled:opacity-50"
                      >
                        {savingTask ? 'Đang lưu...' : 'Giao việc ngay'}
                      </button>
                    </div>
                  </form>
                )}

                {/* Tasks List */}
                {loadingSupervision ? (
                  <div className="py-8 text-center text-slate-400 text-xs">Đang tải danh sách nhiệm vụ...</div>
                ) : supervisionTasks.length === 0 ? (
                  <div className="p-6 text-center bg-slate-950 rounded-xl border border-slate-800 text-slate-400 text-xs">
                    Chưa có nhiệm vụ nào được giao cho sinh viên này. Bấm nút <b>"+ Giao việc mới"</b> ở trên để giao bài.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {supervisionTasks.map((t) => (
                      <div
                        key={t.id}
                        className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-start justify-between gap-3 hover:border-slate-700 transition"
                      >
                        <div className="space-y-1 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`text-xs font-semibold ${t.is_completed ? 'line-through text-slate-400' : 'text-slate-100'}`}>
                              {t.title}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                              t.priority === 'URGENT' ? 'bg-rose-500/10 text-rose-400' :
                              t.priority === 'HIGH' ? 'bg-amber-500/10 text-amber-400' :
                              'bg-blue-500/10 text-blue-400'
                            }`}>
                              {t.priority_display || t.priority}
                            </span>
                            {t.is_completed ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
                                ✅ Đã hoàn thành
                              </span>
                            ) : (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                                ⏳ Chưa xong
                              </span>
                            )}
                          </div>
                          {t.description && <p className="text-xs text-slate-400">{t.description}</p>}
                          <div className="text-[11px] text-slate-400 flex items-center gap-3 pt-0.5">
                            {t.due_date && <span>Hạn: <b>{t.due_date}</b></span>}
                            {t.completed_at && (
                              <span className="text-emerald-400">
                                Hoàn thành lúc: {new Date(t.completed_at).toLocaleDateString('vi-VN')}
                              </span>
                            )}
                          </div>
                          {t.student_notes && (
                            <div className="mt-1 p-2 rounded bg-blue-950/20 border border-blue-500/20 text-[11px] text-blue-200">
                              <span className="font-semibold text-blue-400">📝 Ghi chú từ SV:</span> {t.student_notes}
                            </div>
                          )}
                        </div>

                        <button
                          onClick={() => handleDeleteTask(t.id)}
                          className="px-2 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs transition"
                          title="Xóa nhiệm vụ"
                        >
                          Xóa
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Content: Meeting Logs Sub-Tab */}
            {supervisionSubTab === 'logs' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="text-sm font-bold text-slate-200">Biên bản / Nhật ký các buổi làm việc</h5>
                    <p className="text-xs text-slate-400">
                      Ghi nhận định kỳ nội dung trao đổi, tiến độ và nhận xét của GVHD.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowAddLogForm(!showAddLogForm)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow transition flex items-center gap-1.5"
                  >
                    <span>{showAddLogForm ? '✕ Đóng form' : '+ Thêm nhật ký'}</span>
                  </button>
                </div>

                {/* Add Meeting Log Form */}
                {showAddLogForm && (
                  <form onSubmit={handleCreateMeetingLog} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                    <h6 className="text-xs font-bold text-emerald-400 uppercase">Ghi nhận buổi làm việc mới</h6>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">Ngày làm việc *</label>
                        <input
                          type="date"
                          required
                          value={meetingDate}
                          onChange={(e) => setMeetingDate(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">Thời gian</label>
                        <input
                          type="text"
                          value={meetingTime}
                          onChange={(e) => setMeetingTime(e.target.value)}
                          placeholder="VD: 09:00 - 10:30"
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">Hình thức</label>
                        <select
                          value={meetingType}
                          onChange={(e) => setMeetingType(e.target.value as any)}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                        >
                          <option value="OFFLINE">Gặp trực tiếp</option>
                          <option value="ONLINE">Trực tuyến (Meet/Zoom)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Địa điểm / Link Meet</label>
                      <input
                        type="text"
                        placeholder="VD: Văn phòng bộ môn P405 hoặc https://meet.google.com/..."
                        value={locationOrLink}
                        onChange={(e) => setLocationOrLink(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Nội dung đã trao đổi / Tiến độ *</label>
                      <textarea
                        rows={3}
                        required
                        placeholder="Tóm tắt nội dung sinh viên báo cáo, vấn đề thảo luận..."
                        value={contentDiscussed}
                        onChange={(e) => setContentDiscussed(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Góp ý & Nhận xét của GVHD</label>
                      <textarea
                        rows={2}
                        placeholder="Đánh giá kết quả tuần qua, yêu cầu cần bổ sung chỉnh sửa..."
                        value={supervisorNotes}
                        onChange={(e) => setSupervisorNotes(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Kế hoạch kỳ họp tiếp theo</label>
                      <input
                        type="text"
                        placeholder="VD: Báo cáo kết quả kiểm thử và hoàn thiện báo cáo bản nháp"
                        value={nextMeetingPlan}
                        onChange={(e) => setNextMeetingPlan(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowAddLogForm(false)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs hover:bg-slate-700"
                      >
                        Hủy
                      </button>
                      <button
                        type="submit"
                        disabled={savingLog}
                        className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow disabled:opacity-50"
                      >
                        {savingLog ? 'Đang lưu...' : 'Lưu nhật ký'}
                      </button>
                    </div>
                  </form>
                )}

                {/* Logs List */}
                {loadingSupervision ? (
                  <div className="py-8 text-center text-slate-400 text-xs">Đang tải nhật ký...</div>
                ) : supervisionLogs.length === 0 ? (
                  <div className="p-6 text-center bg-slate-950 rounded-xl border border-slate-800 text-slate-400 text-xs">
                    Chưa có nhật ký buổi họp nào được lưu. Bấm <b>"+ Thêm nhật ký"</b> để tạo buổi đầu tiên.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {supervisionLogs.map((log, idx) => (
                      <div key={log.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-slate-200">
                            #{supervisionLogs.length - idx} - Ngày {log.meeting_date} ({log.meeting_time})
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            {log.meeting_type_display || log.meeting_type}
                          </span>
                        </div>
                        <div className="text-xs text-slate-300 bg-slate-900/50 p-2.5 rounded border border-slate-800/80">
                          <span className="font-semibold text-slate-400">Nội dung:</span> {log.content_discussed}
                        </div>
                        {log.supervisor_notes && (
                          <div className="text-xs text-emerald-300 bg-emerald-950/20 p-2 rounded border border-emerald-500/20">
                            <span className="font-semibold">Nhận xét GV:</span> {log.supervisor_notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
