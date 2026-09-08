import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/app';


export const UTCStudentGraduationView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'project' | 'survey' | 'outline' | 'weekly' | 'supervision' | 'grade'>('project');
  const [loading, setLoading] = useState(true);

  // Survey Data
  const [surveyData, setSurveyData] = useState<any>(null);
  const [isInterning, setIsInterning] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [topicDirectionId, setTopicDirectionId] = useState<number | string>('');
  const [preferredSupervisorId, setPreferredSupervisorId] = useState<number | string>('');
  const [tentativeTitle, setTentativeTitle] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [surveySaving, setSurveySaving] = useState(false);

  // Project Data
  const [projectData, setProjectData] = useState<any>(null);

  // Outline Form
  const [outlineTitleVi, setOutlineTitleVi] = useState('');
  const [outlineTitleEn, setOutlineTitleEn] = useState('');
  const [outlineFile, setOutlineFile] = useState<File | null>(null);
  const [outlineSubmitting, setOutlineSubmitting] = useState(false);

  // Weekly Reports Data
  const [weeklyReports, setWeeklyReports] = useState<any[]>([]);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [weekSummary, setWeekSummary] = useState('');
  const [weekTasks, setWeekTasks] = useState('');
  const [weekGit, setWeekGit] = useState('');
  const [weekFile, setWeekFile] = useState<File | null>(null);
  const [reportSubmitting, setReportSubmitting] = useState(false);

  // Supervision Meeting Logs & Interactive Task Board Data
  const [meetingLogs, setMeetingLogs] = useState<any[]>([]);
  const [tasksData, setTasksData] = useState<{
    stats: { total: number; completed: number; in_progress: number; todo: number; completion_rate: number };
    tasks: any[];
  } | null>(null);
  const [taskFilter, setTaskFilter] = useState<'ALL' | 'TODO' | 'IN_PROGRESS' | 'COMPLETED'>('ALL');
  const [selectedTaskForNotes, setSelectedTaskForNotes] = useState<any | null>(null);
  const [studentNotesInput, setStudentNotesInput] = useState('');
  const [savingTaskNote, setSavingTaskNote] = useState(false);

  const getHeaders = () => {
    const token = localStorage.getItem('access_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [surveyRes, projRes, weeklyRes, logsRes, tasksRes] = await Promise.all([
        axios.get(`${API_BASE}/student/survey/`, { headers: getHeaders() }).catch(() => null),
        axios.get(`${API_BASE}/student/graduation-project/`, { headers: getHeaders() }).catch(() => null),
        axios.get(`${API_BASE}/student/weekly-reports/`, { headers: getHeaders() }).catch(() => null),
        axios.get(`${API_BASE}/student/supervision-logs/`, { headers: getHeaders() }).catch(() => null),
        axios.get(`${API_BASE}/student/tasks/`, { headers: getHeaders() }).catch(() => null),
      ]);

      if (surveyRes?.data) {
        setSurveyData(surveyRes.data);
        setPhone(surveyRes.data.student?.phone_number || '');
        setEmail(surveyRes.data.student?.email || '');
        if (surveyRes.data.survey) {
          setIsInterning(surveyRes.data.survey.is_interning);
          setCompanyName(surveyRes.data.survey.company_name || '');
          setTopicDirectionId(surveyRes.data.survey.topic_direction || '');
          setPreferredSupervisorId(surveyRes.data.survey.preferred_supervisor || '');
          setTentativeTitle(surveyRes.data.survey.tentative_title || '');
        }
      }

      if (projRes?.data?.has_project) {
        setProjectData(projRes.data.project);
        setOutlineTitleVi(projRes.data.project.topic_title_vi || '');
        setOutlineTitleEn(projRes.data.project.topic_title_en || '');
      }

      if (weeklyRes?.data) {
        setWeeklyReports(weeklyRes.data);
      }

      if (logsRes?.data) {
        setMeetingLogs(logsRes.data);
      }

      if (tasksRes?.data) {
        setTasksData(tasksRes.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggleTaskComplete = async (task: any) => {
    try {
      const nextCompleted = !task.is_completed;
      if (tasksData) {
        const updatedTasks = tasksData.tasks.map((t: any) =>
          t.id === task.id ? { ...t, is_completed: nextCompleted, status: nextCompleted ? 'COMPLETED' : 'IN_PROGRESS' } : t
        );
        const completedCount = updatedTasks.filter((t: any) => t.is_completed).length;
        setTasksData({
          ...tasksData,
          stats: {
            ...tasksData.stats,
            completed: completedCount,
            completion_rate: tasksData.stats.total > 0 ? Math.round((completedCount / tasksData.stats.total) * 1000) / 10 : 0,
          },
          tasks: updatedTasks,
        });
      }

      await axios.patch(
        `${API_BASE}/student/tasks/${task.id}/complete/`,
        { is_completed: nextCompleted },
        { headers: getHeaders() }
      );
      const refreshTasks = await axios.get(`${API_BASE}/student/tasks/`, { headers: getHeaders() }).catch(() => null);
      if (refreshTasks?.data) setTasksData(refreshTasks.data);
    } catch (err: any) {
      alert('Lỗi cập nhật nhiệm vụ: ' + (err.response?.data?.detail || err.message));
      const refreshTasks = await axios.get(`${API_BASE}/student/tasks/`, { headers: getHeaders() }).catch(() => null);
      if (refreshTasks?.data) setTasksData(refreshTasks.data);
    }
  };

  const handleOpenNotesModal = (task: any) => {
    setSelectedTaskForNotes(task);
    setStudentNotesInput(task.student_notes || '');
  };

  const handleSaveStudentNotes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaskForNotes) return;
    try {
      setSavingTaskNote(true);
      await axios.patch(
        `${API_BASE}/student/tasks/${selectedTaskForNotes.id}/complete/`,
        { student_notes: studentNotesInput },
        { headers: getHeaders() }
      );
      alert('Đã lưu ghi chú tiến độ nhiệm vụ thành công!');
      setSelectedTaskForNotes(null);
      const refreshTasks = await axios.get(`${API_BASE}/student/tasks/`, { headers: getHeaders() }).catch(() => null);
      if (refreshTasks?.data) setTasksData(refreshTasks.data);
    } catch (err: any) {
      alert('Lỗi lưu ghi chú: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSavingTaskNote(false);
    }
  };

  const handleSaveSurvey = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSurveySaving(true);
      await axios.post(
        `${API_BASE}/student/survey/`,
        {
          is_interning: isInterning,
          company_name: companyName,
          topic_direction: topicDirectionId || null,
          preferred_supervisor: preferredSupervisorId || null,
          tentative_title: tentativeTitle,
          phone_number: phone,
          email: email,
          new_password: newPassword || undefined,
        },
        { headers: getHeaders() }
      );
      alert('Đã lưu thông tin khảo sát và nguyện vọng thành công!');
      fetchData();
    } catch (err: any) {
      alert('Lỗi: ' + (err.response?.data?.company_name?.[0] || JSON.stringify(err.response?.data) || err.message));
    } finally {
      setSurveySaving(false);
    }
  };

  const handleSubmitOutline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!outlineTitleVi) {
      alert('Vui lòng nhập tên đề tài tiếng Việt.');
      return;
    }

    try {
      setOutlineSubmitting(true);
      const fd = new FormData();
      fd.append('topic_title_vi', outlineTitleVi);
      fd.append('topic_title_en', outlineTitleEn);
      if (outlineFile) {
        fd.append('outline_file', outlineFile);
      }

      await axios.post(`${API_BASE}/student/outline/submit/`, fd, {
        headers: { ...getHeaders(), 'Content-Type': 'multipart/form-data' },
      });
      alert('Nộp đề cương thành công, đang chờ GVHD & Nhóm chuyên môn xét duyệt!');
      fetchData();
    } catch (err: any) {
      alert('Lỗi nộp đề cương: ' + (err.response?.data?.outline_file?.[0] || err.message));
    } finally {
      setOutlineSubmitting(false);
    }
  };

  const handleSubmitWeeklyReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!weekSummary) {
      alert('Vui lòng nhập nội dung tóm tắt công việc đã làm trong tuần.');
      return;
    }

    try {
      setReportSubmitting(true);
      const fd = new FormData();
      fd.append('week_number', selectedWeek.toString());
      fd.append('summary_content', weekSummary);
      fd.append('planned_tasks', weekTasks);
      fd.append('git_commit_link', weekGit);
      if (weekFile) {
        fd.append('attached_file', weekFile);
      }

      await axios.post(`${API_BASE}/student/weekly-reports/`, fd, {
        headers: { ...getHeaders(), 'Content-Type': 'multipart/form-data' },
      });
      alert(`Đã nộp báo cáo tiến độ Tuần ${selectedWeek} thành công!`);
      setWeekSummary('');
      setWeekTasks('');
      setWeekGit('');
      setWeekFile(null);
      fetchData();
    } catch (err: any) {
      alert('Lỗi nộp báo cáo: ' + JSON.stringify(err.response?.data || err.message));
    } finally {
      setReportSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-400">Đang tải thông tin học vụ ĐATN...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-700/60 pb-3">
        {[
          { key: 'project', label: '1. Đồ án & GVHD', icon: '🎓' },
          { key: 'survey', label: '2. Khảo sát & Nguyện vọng', icon: '📝' },
          { key: 'outline', label: '3. Đề cương ĐATN', icon: '📄' },
          { key: 'weekly', label: '4. Báo cáo tiến độ tuần', icon: '📅' },
          { key: 'supervision', label: '5. Nhật ký & Task Board', icon: '📋' },
          { key: 'grade', label: '6. Bảng điểm tổng kết UTC', icon: '🏆' },
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

      {/* Tab 1: Project Overview */}
      {activeTab === 'project' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6 shadow-xl">
          {projectData ? (
            <>
              <div className="flex items-start justify-between border-b border-slate-800 pb-4">
                <div>
                  <span className="text-xs font-mono px-2.5 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    Trạng thái: {projectData.status_display || projectData.status}
                  </span>
                  <h3 className="text-xl font-bold text-slate-100 mt-2">{projectData.topic_title_vi}</h3>
                  {projectData.topic_title_en && (
                    <p className="text-sm text-slate-400 italic mt-0.5">{projectData.topic_title_en}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-1">
                  <span className="text-xs text-slate-400 font-medium">Giảng viên hướng dẫn (GVHD)</span>
                  <p className="text-base font-bold text-emerald-400">
                    {projectData.supervisor?.full_name || 'Chưa phân công'}
                  </p>
                  <p className="text-xs text-slate-400">Bộ môn: {projectData.supervisor?.department || 'CNTT'}</p>
                  <p className="text-xs text-slate-400">Email: {projectData.supervisor?.email || 'N/A'}</p>
                </div>

                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-1">
                  <span className="text-xs text-slate-400 font-medium">Giảng viên phản biện (GVPB)</span>
                  <p className="text-base font-bold text-indigo-400">
                    {projectData.reviewer?.full_name || <span className="text-slate-500 italic">Đang phân bổ...</span>}
                  </p>
                  <p className="text-xs text-slate-400">Bộ môn: {projectData.reviewer?.department || 'Khoa CNTT'}</p>
                </div>

                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-1">
                  <span className="text-xs text-slate-400 font-medium">Hội đồng bảo vệ</span>
                  <p className="text-base font-bold text-amber-400">
                    {projectData.council_name || <span className="text-slate-500 italic">Chưa xếp hội đồng</span>}
                  </p>
                  <p className="text-xs text-slate-400">Phòng: {projectData.defense_room || 'TBA'}</p>
                  <p className="text-xs text-slate-400">Thời gian: {projectData.session_date || 'TBA'} ({projectData.session_time || ''})</p>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 text-xs text-slate-300 space-y-2">
                <p className="font-bold text-blue-400">Quy trình thực hiện Đồ án Tốt nghiệp chuẩn UTC:</p>
                <ol className="list-decimal pl-5 space-y-1 text-slate-400">
                  <li>Nộp và duyệt Đề cương chi tiết (Tuần 1 - 3).</li>
                  <li>Báo cáo tiến độ tuần thường xuyên cho GVHD (Tuần 1 - 15).</li>
                  <li>GVHD chấm sơ khảo và đánh giá đủ điều kiện bảo vệ.</li>
                  <li>GVPB chấm nhận xét độc lập và Hội đồng chấm bảo vệ trực tiếp.</li>
                </ol>
              </div>
            </>
          ) : (
            <div className="text-center py-12 space-y-3">
              <div className="text-4xl">⏳</div>
              <h4 className="text-lg font-bold text-slate-200">Bạn chưa được phân công Đề tài & GVHD</h4>
              <p className="text-sm text-slate-400 max-w-md mx-auto">
                Hãy hoàn thành bước <b>"2. Khảo sát & Nguyện vọng"</b> để Ban chủ nhiệm Khoa CNTT tiến hành phân bổ GVHD theo thuật toán tối ưu MCMF.
              </p>
              <button
                onClick={() => setActiveTab('survey')}
                className="mt-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold transition"
              >
                Điền khảo sát ngay
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Survey & Preferences */}
      {activeTab === 'survey' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6 shadow-xl max-w-3xl">
          <div>
            <h3 className="text-lg font-bold text-slate-100">Phiếu Khảo sát Thực tập & Đăng ký Nguyện vọng ĐATN</h3>
            <p className="text-xs text-slate-400">Dữ liệu được dùng để phân GVHD tự động theo chỉ tiêu Quota và nguyện vọng chuyên môn</p>
          </div>

          <form onSubmit={handleSaveSurvey} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Số điện thoại liên hệ</label>
                <input
                  type="text"
                  placeholder="0912345678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Email liên hệ</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isInterning}
                  onChange={(e) => setIsInterning(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700 focus:ring-0"
                />
                <span className="text-sm font-semibold text-slate-200">Hiện tại đang đi thực tập tại Doanh nghiệp / Công ty</span>
              </label>

              {isInterning && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Tên công ty / Doanh nghiệp đang thực tập (*)</label>
                  <input
                    type="text"
                    required={isInterning}
                    placeholder="VD: Viettel, FPT Software, VNPT, VNPAY, Sun Asterisk..."
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Chọn Hướng nghiên cứu / Làm đồ án (8 hướng chuẩn UTC)</label>
              <select
                value={topicDirectionId}
                onChange={(e) => setTopicDirectionId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="">-- Chọn hướng đề tài --</option>
                {surveyData?.topic_areas?.map((t: any) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Giảng viên hướng dẫn mong muốn (Nguyện vọng 1)</label>
              <select
                value={preferredSupervisorId}
                onChange={(e) => setPreferredSupervisorId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="">-- Tùy chọn (Hệ thống tự động xếp theo chuyên môn) --</option>
                {surveyData?.supervisors?.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name} ({s.department})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Tên đề tài dự kiến (nếu đã có)</label>
              <input
                type="text"
                placeholder="VD: Xây dựng hệ thống quản lý chuỗi cung ứng bằng Blockchain..."
                value={tentativeTitle}
                onChange={(e) => setTentativeTitle(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Đổi mật khẩu mới (nếu muốn thay đổi)</label>
              <input
                type="password"
                placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={surveySaving}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold transition shadow-lg shadow-blue-600/30 disabled:opacity-50"
              >
                {surveySaving ? 'Đang lưu...' : 'Lưu thông tin khảo sát'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab 3: Outline Submission */}
      {activeTab === 'outline' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6 shadow-xl max-w-3xl">
          <div>
            <h3 className="text-lg font-bold text-slate-100">Nộp Đề cương Đồ án Tốt nghiệp</h3>
            <p className="text-xs text-slate-400">Nộp file PDF đề cương chi tiết để GVHD và Nhóm chuyên môn duyệt</p>
          </div>

          {projectData?.outline_review && (
            <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-300">Tình trạng xét duyệt đề cương:</span>
                <span className={`px-2.5 py-0.5 rounded font-bold ${
                  projectData.outline_review.verdict === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                  projectData.outline_review.verdict === 'REVISION_REQUIRED' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                  projectData.outline_review.verdict === 'REJECTED' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                  'bg-blue-500/10 text-blue-400'
                }`}>
                  {projectData.outline_review.verdict}
                </span>
              </div>
              {projectData.outline_review.comments && (
                <p className="text-slate-400 mt-1">
                  <b>Nhận xét của GV:</b> {projectData.outline_review.comments}
                </p>
              )}
            </div>
          )}

          <form onSubmit={handleSubmitOutline} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Tên đề tài tiếng Việt (*)</label>
              <input
                type="text"
                required
                value={outlineTitleVi}
                onChange={(e) => setOutlineTitleVi(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Tên đề tài tiếng Anh</label>
              <input
                type="text"
                value={outlineTitleEn}
                onChange={(e) => setOutlineTitleEn(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">File Đề cương PDF (Tối đa 25MB)</label>
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => setOutlineFile(e.target.files?.[0] || null)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-300 text-sm file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500"
              />
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={outlineSubmitting}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold transition shadow-lg shadow-blue-600/30 disabled:opacity-50"
              >
                {outlineSubmitting ? 'Đang nộp đề cương...' : 'Nộp Đề cương'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab 4: Weekly Reports */}
      {activeTab === 'weekly' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Submit form */}
          <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-xl">
            <h3 className="font-bold text-base text-slate-100">Nộp Báo cáo Tuần</h3>
            <form onSubmit={handleSubmitWeeklyReport} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Chọn tuần (1 đến 15)</label>
                <select
                  value={selectedWeek}
                  onChange={(e) => setSelectedWeek(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-blue-500"
                >
                  {Array.from({ length: 15 }, (_, i) => i + 1).map((w) => (
                    <option key={w} value={w}>
                      Tuần {w}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Tóm tắt công việc đã làm (*)</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Mô tả các module, tính năng hoặc nghiên cứu đã hoàn thành trong tuần..."
                  value={weekSummary}
                  onChange={(e) => setWeekSummary(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Kế hoạch tuần tiếp theo</label>
                <textarea
                  rows={2}
                  placeholder="Kế hoạch thực hiện trong tuần tới..."
                  value={weekTasks}
                  onChange={(e) => setWeekTasks(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Link GitHub / GitLab commit</label>
                <input
                  type="url"
                  placeholder="https://github.com/user/repo/commits"
                  value={weekGit}
                  onChange={(e) => setWeekGit(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Đính kèm file (nếu có)</label>
                <input
                  type="file"
                  onChange={(e) => setWeekFile(e.target.files?.[0] || null)}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-300 text-xs file:mr-2 file:py-0.5 file:px-2 file:rounded file:border-0 file:text-xs file:bg-slate-800 file:text-slate-300"
                />
              </div>

              <button
                type="submit"
                disabled={reportSubmitting}
                className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition disabled:opacity-50"
              >
                {reportSubmitting ? 'Đang nộp...' : `Nộp Báo cáo Tuần ${selectedWeek}`}
              </button>
            </form>
          </div>

          {/* List of submitted reports */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-xl">
            <h3 className="font-bold text-base text-slate-100">Lịch sử Báo cáo & Nhận xét của GVHD</h3>
            {weeklyReports.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">Chưa có báo cáo tuần nào được nộp.</div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {weeklyReports.map((r) => (
                  <div key={r.id} className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-blue-400">Tuần {r.week_number}</span>
                      <span className={`px-2 py-0.5 rounded font-semibold ${
                        r.supervisor_rating === 'GOOD' ? 'bg-emerald-500/10 text-emerald-400' :
                        r.supervisor_rating === 'ACCEPTABLE' ? 'bg-blue-500/10 text-blue-400' :
                        r.supervisor_rating === 'LATE' ? 'bg-amber-500/10 text-amber-400' :
                        r.supervisor_rating === 'UNSATISFACTORY' ? 'bg-rose-500/10 text-rose-400' :
                        'bg-slate-800 text-slate-400'
                      }`}>
                        {r.supervisor_rating_display || r.supervisor_rating}
                      </span>
                    </div>

                    <p className="text-slate-200"><b>Nội dung:</b> {r.summary_content}</p>
                    {r.planned_tasks && <p className="text-slate-400"><b>Kế hoạch:</b> {r.planned_tasks}</p>}
                    {r.git_commit_link && (
                      <p className="text-slate-400">
                        <b>Git:</b>{' '}
                        <a href={r.git_commit_link} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">
                          {r.git_commit_link}
                        </a>
                      </p>
                    )}

                    {r.supervisor_feedback && (
                      <div className="mt-2 p-2.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                        <span className="font-bold text-emerald-400">Nhận xét GVHD:</span> {r.supervisor_feedback}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 5: Supervision Meeting Logs & Interactive Task Board */}
      {activeTab === 'supervision' && (
        <div className="space-y-6">
          {/* Header */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <span>📋</span> Ban Nhiệm Vụ Đồ Án (Task Board) & Tiến Độ Hoàn Thành
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Theo dõi danh sách công việc được GVHD giao, đánh dấu hoàn thành và cập nhật kết quả thực hiện.
                </p>
              </div>

              {tasksData?.stats && (
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    Tổng số: {tasksData.stats.total} việc
                  </span>
                  <span className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Đã xong: {tasksData.stats.completed}
                  </span>
                </div>
              )}
            </div>

            {/* Progress Bar */}
            {tasksData?.stats && (
              <div className="space-y-2 bg-slate-950 p-4 rounded-xl border border-slate-800/80">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-300">Tiến độ hoàn thành nhiệm vụ được giao</span>
                  <span className="font-bold text-emerald-400 text-sm">
                    {tasksData.stats.completed} / {tasksData.stats.total} ({tasksData.stats.completion_rate}%)
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 via-teal-400 to-emerald-400 transition-all duration-500"
                    style={{ width: `${tasksData.stats.completion_rate}%` }}
                  />
                </div>
              </div>
            )}

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800">
              <span className="text-xs text-slate-400 font-medium mr-1">Bộ lọc:</span>
              {[
                { key: 'ALL', label: 'Tất cả nhiệm vụ' },
                { key: 'TODO', label: 'Cần làm (Todo)' },
                { key: 'IN_PROGRESS', label: 'Đang thực hiện' },
                { key: 'COMPLETED', label: 'Đã hoàn thành' },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setTaskFilter(f.key as any)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                    taskFilter === f.key
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Task List */}
            <div className="space-y-3 pt-2">
              {(() => {
                const list = tasksData?.tasks || [];
                const filtered = list.filter((t) => {
                  if (taskFilter === 'TODO') return !t.is_completed && t.status === 'TODO';
                  if (taskFilter === 'IN_PROGRESS') return !t.is_completed && t.status === 'IN_PROGRESS';
                  if (taskFilter === 'COMPLETED') return t.is_completed;
                  return true;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="p-8 text-center bg-slate-950 rounded-xl border border-slate-800 text-slate-400 text-xs">
                      {list.length === 0
                        ? 'Chưa có nhiệm vụ nào được giao từ Giảng viên hướng dẫn.'
                        : 'Không có nhiệm vụ nào phù hợp với bộ lọc hiện tại.'}
                    </div>
                  );
                }

                return filtered.map((task) => {
                  const isOverdue = task.due_date && !task.is_completed && new Date(task.due_date) < new Date();
                  return (
                    <div
                      key={task.id}
                      className={`p-4 rounded-xl border transition flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                        task.is_completed
                          ? 'bg-slate-950/60 border-slate-800/80 opacity-80'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700 shadow-md'
                      }`}
                    >
                      <div className="flex items-start gap-3.5 flex-1">
                        {/* Interactive Checkbox */}
                        <div className="pt-0.5">
                          <input
                            type="checkbox"
                            checked={task.is_completed}
                            onChange={() => handleToggleTaskComplete(task)}
                            className="w-5 h-5 rounded border-slate-700 text-emerald-500 focus:ring-emerald-500/20 bg-slate-900 cursor-pointer accent-emerald-500"
                            title="Đánh dấu hoàn thành nhiệm vụ"
                          />
                        </div>

                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`text-sm font-semibold transition ${
                                task.is_completed ? 'line-through text-slate-400' : 'text-slate-100'
                              }`}
                            >
                              {task.title}
                            </span>

                            {/* Priority Badge */}
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                                task.priority === 'URGENT'
                                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                  : task.priority === 'HIGH'
                                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                  : task.priority === 'LOW'
                                  ? 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                                  : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              }`}
                            >
                              {task.priority_display || task.priority}
                            </span>

                            {/* Status Badge */}
                            {task.is_completed ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                ✅ Hoàn thành
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-500/10 text-blue-300">
                                {task.status_display || 'Cần làm'}
                              </span>
                            )}
                          </div>

                          {task.description && (
                            <p className="text-xs text-slate-300 whitespace-pre-line">{task.description}</p>
                          )}

                          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
                            <span>
                              GV giao:{' '}
                              <b className="text-slate-300">{task.assigned_by_name || 'GVHD'}</b>
                            </span>
                            {task.due_date && (
                              <span className={isOverdue ? 'text-rose-400 font-bold' : ''}>
                                ⏰ Hạn chót: <b>{task.due_date}</b> {isOverdue && '(Quá hạn)'}
                              </span>
                            )}
                            {task.completed_at && (
                              <span className="text-emerald-400/80">
                                Hoàn tất lúc: {new Date(task.completed_at).toLocaleDateString('vi-VN')}
                              </span>
                            )}
                          </div>

                          {/* Student Notes Display */}
                          {task.student_notes && (
                            <div className="mt-2 p-2.5 rounded bg-blue-950/20 border border-blue-500/20 text-xs text-blue-200">
                              <span className="font-semibold text-blue-400">📝 Ghi chú / Link kết quả SV:</span>{' '}
                              {task.student_notes}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action: Add notes */}
                      <div className="flex items-center gap-2 self-end md:self-center">
                        <button
                          onClick={() => handleOpenNotesModal(task)}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition flex items-center gap-1.5"
                        >
                          <span>✏️</span>
                          <span>{task.student_notes ? 'Sửa ghi chú SV' : 'Ghi chú / Nộp link'}</span>
                        </button>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          {/* Supervision Meeting Logs Section */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
            <div>
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <span>🗓️</span> Nhật Ký Hướng Dẫn Định Kỳ (Supervision Meeting Logs)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Biên bản ghi nhận các buổi làm việc định kỳ giữa Giảng viên hướng dẫn và Sinh viên.
              </p>
            </div>

            {meetingLogs.length === 0 ? (
              <div className="p-8 text-center bg-slate-950 rounded-xl border border-slate-800 text-slate-400 text-xs">
                Chưa có buổi họp/hướng dẫn nào được ghi nhận từ GVHD.
              </div>
            ) : (
              <div className="space-y-4">
                {meetingLogs.map((log, idx) => (
                  <div
                    key={log.id}
                    className="p-5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                      <div className="flex items-center gap-3">
                        <span className="w-7 h-7 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center text-xs font-bold border border-blue-500/30">
                          #{meetingLogs.length - idx}
                        </span>
                        <div>
                          <span className="text-sm font-bold text-slate-100">Buổi hướng dẫn: {log.meeting_date}</span>
                          <span className="text-xs text-slate-400 ml-2">({log.meeting_time})</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                            log.meeting_type === 'ONLINE'
                              ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                              : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          }`}
                        >
                          {log.meeting_type_display || (log.meeting_type === 'ONLINE' ? 'Trực tuyến' : 'Gặp trực tiếp')}
                        </span>
                        {log.location_or_link && (
                          <span className="text-xs text-slate-300">
                            Địa điểm/Link: <b>{log.location_or_link}</b>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div>
                        <span className="font-semibold text-slate-300">Nội dung trao đổi & tiến độ:</span>
                        <p className="text-slate-200 mt-1 whitespace-pre-line bg-slate-900/60 p-3 rounded-lg border border-slate-800/60">
                          {log.content_discussed}
                        </p>
                      </div>

                      {log.supervisor_notes && (
                        <div>
                          <span className="font-semibold text-emerald-400">Góp ý & Nhận xét của GVHD:</span>
                          <p className="text-emerald-300/90 mt-1 whitespace-pre-line bg-emerald-950/20 p-3 rounded-lg border border-emerald-500/20">
                            {log.supervisor_notes}
                          </p>
                        </div>
                      )}

                      {log.next_meeting_plan && (
                        <div>
                          <span className="font-semibold text-amber-400">Kế hoạch kỳ tới:</span>
                          <p className="text-slate-300 mt-1 whitespace-pre-line bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/60">
                            {log.next_meeting_plan}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 6: Final Grade Summary */}
      {activeTab === 'grade' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6 shadow-xl max-w-3xl">
          <div>
            <h3 className="text-lg font-bold text-slate-100">Bảng Điểm Tổng kết Đồ án Tốt nghiệp</h3>
            <p className="text-xs text-slate-400">Tính toán tự động theo Quy chế tín chỉ UTC (40% GVHD + 20% GVPB + 40% Hội đồng)</p>
          </div>

          {projectData?.final_grade ? (
            <div className="space-y-6">
              {/* Component Scores */}
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <span className="text-xs text-slate-400">Điểm GVHD (40%)</span>
                  <p className="text-2xl font-bold text-emerald-400 mt-1">
                    {projectData.final_grade.supervisor_score !== null ? projectData.final_grade.supervisor_score : '-'}
                  </p>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <span className="text-xs text-slate-400">Điểm GVPB (20%)</span>
                  <p className="text-2xl font-bold text-indigo-400 mt-1">
                    {projectData.final_grade.reviewer_score !== null ? projectData.final_grade.reviewer_score : '-'}
                  </p>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <span className="text-xs text-slate-400">Điểm Hội đồng (40%)</span>
                  <p className="text-2xl font-bold text-blue-400 mt-1">
                    {projectData.final_grade.council_avg_score !== null ? projectData.final_grade.council_avg_score : '-'}
                  </p>
                </div>
              </div>

              {/* Total Final Score Card */}
              <div className="bg-gradient-to-r from-blue-900/40 to-slate-900 p-6 rounded-xl border border-blue-500/30 flex items-center justify-between">
                <div>
                  <span className="text-xs text-blue-300 font-semibold uppercase">Điểm Tổng kết cuối cùng</span>
                  <div className="flex items-baseline gap-3 mt-1">
                    <span className="text-4xl font-extrabold text-white">
                      {projectData.final_grade.final_score_10 !== null ? projectData.final_grade.final_score_10 : '-'}
                    </span>
                    <span className="text-base text-slate-300">/ 10</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Quy đổi Thang 4: <b>{projectData.final_grade.final_score_4 !== null ? projectData.final_grade.final_score_4 : '-'}</b>
                  </p>
                </div>

                <div className="text-right space-y-1">
                  <span className="text-3xl font-black text-amber-400">
                    {projectData.final_grade.final_letter_grade || '-'}
                  </span>
                  <p className="text-xs font-semibold text-slate-300">
                    Xếp loại: {projectData.final_grade.classification || 'Đang cập nhật'}
                  </p>
                  <div>
                    {projectData.final_grade.is_passed ? (
                      <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold">
                        ĐẠT YÊU CẦU
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full bg-slate-800 text-slate-400 text-xs">
                        Đang bảo vệ
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400 text-sm">
              Chưa có dữ liệu điểm tổng kết cho đồ án của bạn.
            </div>
          )}
        </div>
      )}

      {/* Modal: Ghi chú & Nộp link kết quả nhiệm vụ của sinh viên */}
      {selectedTaskForNotes && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl max-w-md w-full shadow-2xl space-y-4">
            <div>
              <span className="text-xs text-blue-400 font-semibold">Cập nhật tiến độ nhiệm vụ</span>
              <h3 className="text-base font-bold text-slate-100 mt-1">{selectedTaskForNotes.title}</h3>
            </div>

            <form onSubmit={handleSaveStudentNotes} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Ghi chú kết quả, link Github Commit hoặc Drive tài liệu:
                </label>
                <textarea
                  rows={4}
                  value={studentNotesInput}
                  onChange={(e) => setStudentNotesInput(e.target.value)}
                  placeholder="Ví dụ: Đã hoàn thành các chức năng theo yêu cầu, link demo: https://... hoặc commit hash: abc1234"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedTaskForNotes(null)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs hover:bg-slate-700"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={savingTaskNote}
                  className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/30 disabled:opacity-50"
                >
                  {savingTaskNote ? 'Đang lưu...' : 'Lưu ghi chú'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
