import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { apiService } from '../services/api';
import type { ThesisDeferralRequest } from '../types';
import { GRADUATION_STAGES, getProjectStageNumber } from '../utils/graduationStages';
import './UTCStudentGraduationView.css';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/app';


export interface UTCStudentGraduationViewProps {
  initialTab?: 'project' | 'survey' | 'outline' | 'weekly' | 'supervision' | 'grade';
  onSubtabChange?: (tab: 'project' | 'survey' | 'outline' | 'weekly' | 'supervision' | 'grade') => void;
}

export const UTCStudentGraduationView: React.FC<UTCStudentGraduationViewProps> = ({
  initialTab,
  onSubtabChange,
}) => {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'project' | 'survey' | 'outline' | 'weekly' | 'supervision' | 'grade'>(initialTab || 'project');
  const [loading, setLoading] = useState(true);

  // Project Data
  const [projectData, setProjectData] = useState<any>(null);

  const currentStageNum = getProjectStageNumber(projectData);

  const handleSelectTab = (tabKey: 'project' | 'survey' | 'outline' | 'weekly' | 'supervision' | 'grade') => {
    const targetStage = GRADUATION_STAGES.find((s) => s.key === tabKey);
    if (targetStage && targetStage.number > currentStageNum) {
      alert(`⚠️ Bạn hiện đang ở Giai đoạn ${currentStageNum}. Cần được Giảng viên hướng dẫn duyệt các bước trước để mở ${targetStage.label}!`);
      return;
    }
    setActiveTab(tabKey);
    if (onSubtabChange) {
      onSubtabChange(tabKey);
    }
  };

  // Sync subtab from initialTab prop
  useEffect(() => {
    if (initialTab && ['project', 'survey', 'outline', 'weekly', 'supervision', 'grade'].includes(initialTab)) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Sync subtab from searchParams or global event
  useEffect(() => {
    const subtab = searchParams.get('subtab');
    if (subtab && ['project', 'survey', 'outline', 'weekly', 'supervision', 'grade'].includes(subtab)) {
      setActiveTab(subtab as any);
      if (onSubtabChange) onSubtabChange(subtab as any);
    }

    const handleSwitchSubtab = (e: any) => {
      const st = e.detail?.subtab;
      if (st && ['project', 'survey', 'outline', 'weekly', 'supervision', 'grade'].includes(st)) {
        setActiveTab(st as any);
        if (onSubtabChange) onSubtabChange(st as any);
      }
    };

    window.addEventListener('app:switch-subtab', handleSwitchSubtab);
    return () => window.removeEventListener('app:switch-subtab', handleSwitchSubtab);
  }, [searchParams, onSubtabChange]);

  // Survey Data
  const [surveyData, setSurveyData] = useState<any>(null);
  const [isInterning, setIsInterning] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [topicDirectionId, setTopicDirectionId] = useState<number | string>('');
  const [preference1Id, setPreference1Id] = useState<number | string>('');
  const [preference2Id, setPreference2Id] = useState<number | string>('');
  const [preference3Id, setPreference3Id] = useState<number | string>('');
  const [secondaryCriteriaNote, setSecondaryCriteriaNote] = useState('');
  const [tentativeTitle, setTentativeTitle] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [surveySaving, setSurveySaving] = useState(false);

  // Outline Form & Phase 3 Topic Draft / PDF
  const [outlineTitleVi, setOutlineTitleVi] = useState('');
  const [outlineTitleEn, setOutlineTitleEn] = useState('');
  const [outlineFile, setOutlineFile] = useState<File | null>(null);
  const [outlineSubmitting, setOutlineSubmitting] = useState(false);
  const [draftTopicVi, setDraftTopicVi] = useState('');
  const [draftTopicEn, setDraftTopicEn] = useState('');
  const [savingDraftTopic, setSavingDraftTopic] = useState(false);
  const [generatingOutlinePdf, setGeneratingOutlinePdf] = useState(false);
  const [signedOutlineFile, setSignedOutlineFile] = useState<File | null>(null);
  const [uploadingSignedOutline, setUploadingSignedOutline] = useState(false);

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

  // Phase 5: Task Deliverable Submission Modal State
  const [selectedTaskForDeliverable, setSelectedTaskForDeliverable] = useState<any | null>(null);
  const [deliverableFile, setDeliverableFile] = useState<File | null>(null);
  const [deliverableUrl, setDeliverableUrl] = useState('');
  const [deliverableNotes, setDeliverableNotes] = useState('');
  const [submittingDeliverable, setSubmittingDeliverable] = useState(false);

  // Deferral Request Modal (Nhánh bảo lưu)
  const [showDeferralModal, setShowDeferralModal] = useState(false);
  const [deferralReasonCategory, setDeferralReasonCategory] = useState<'HEALTH' | 'ACADEMIC' | 'FINANCIAL' | 'PERSONAL'>('ACADEMIC');
  const [deferralReasonDetails, setDeferralReasonDetails] = useState('');
  const [deferralEvidenceFile, setDeferralEvidenceFile] = useState<File | null>(null);
  const [submittingDeferral, setSubmittingDeferral] = useState(false);
  const [deferralRequests, setDeferralRequests] = useState<ThesisDeferralRequest[]>([]);

  const getHeaders = () => {
    const token = localStorage.getItem('access_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [surveyRes, projRes, weeklyRes, logsRes, tasksRes, deferralRes] = await Promise.all([
        axios.get(`${API_BASE}/student/survey/`, { headers: getHeaders() }).catch(() => null),
        axios.get(`${API_BASE}/student/graduation-project/`, { headers: getHeaders() }).catch(() => null),
        axios.get(`${API_BASE}/student/weekly-reports/`, { headers: getHeaders() }).catch(() => null),
        axios.get(`${API_BASE}/student/supervision-logs/`, { headers: getHeaders() }).catch(() => null),
        axios.get(`${API_BASE}/student/tasks/`, { headers: getHeaders() }).catch(() => null),
        apiService.getStudentDeferralRequests().catch(() => []),
      ]);

      if (surveyRes?.data) {
        setSurveyData(surveyRes.data);
        setPhone(surveyRes.data.student?.phone_number || '');
        setEmail(surveyRes.data.student?.email || '');
        if (surveyRes.data.survey) {
          setIsInterning(surveyRes.data.survey.is_interning);
          setCompanyName(surveyRes.data.survey.company_name || '');
          setTopicDirectionId(surveyRes.data.survey.topic_direction || '');
          const p1 = surveyRes.data.survey.preference_1 || surveyRes.data.survey.preferred_supervisor || '';
          setPreference1Id(p1);
          setPreference2Id(surveyRes.data.survey.preference_2 || '');
          setPreference3Id(surveyRes.data.survey.preference_3 || '');
          setSecondaryCriteriaNote(surveyRes.data.survey.secondary_criteria_note || '');
          setTentativeTitle(surveyRes.data.survey.tentative_title || '');
        }
      }

      if (projRes?.data?.has_project) {
        setProjectData(projRes.data.project);
        setOutlineTitleVi(projRes.data.project.topic_title_vi || '');
        setOutlineTitleEn(projRes.data.project.topic_title_en || '');
        setDraftTopicVi(projRes.data.project.topic_title_vi || '');
        setDraftTopicEn(projRes.data.project.topic_title_en || '');
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

      if (deferralRes) {
        setDeferralRequests(Array.isArray(deferralRes) ? deferralRes : []);
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
          preferred_supervisor: preference1Id || null,
          preference_1: preference1Id || null,
          preference_2: preference2Id || null,
          preference_3: preference3Id || null,
          secondary_criteria_note: secondaryCriteriaNote,
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
      const msg =
        err.response?.data?.error ||
        err.response?.data?.detail ||
        err.response?.data?.preference_1?.[0] ||
        err.response?.data?.company_name?.[0] ||
        JSON.stringify(err.response?.data) ||
        err.message;
      alert('Lỗi: ' + msg);
    } finally {
      setSurveySaving(false);
    }
  };

  const handleSaveDraftTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectData?.id || !draftTopicVi.trim()) {
      alert('Vui lòng nhập tên đề tài tiếng Việt.');
      return;
    }
    try {
      setSavingDraftTopic(true);
      await apiService.submitTopicDraft({
        project_id: projectData.id,
        topic_title_vi: draftTopicVi.trim(),
        topic_title_en: draftTopicEn.trim(),
      });
      alert('Đã cập nhật bản thảo đề tài (Draft)! Đang chờ GVHD xác nhận.');
      fetchData();
    } catch (err: any) {
      alert('Lỗi lưu đề tài: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSavingDraftTopic(false);
    }
  };

  const handleExportOutlinePdf = async () => {
    if (!projectData?.id) return;
    try {
      setGeneratingOutlinePdf(true);
      const blob = await apiService.exportOutlinePdf(projectData.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `De_cuong_DATN_${projectData.student_reg_no || 'UTC'}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Lỗi xuất PDF đề cương: ' + (err.response?.data?.detail || err.message));
    } finally {
      setGeneratingOutlinePdf(false);
    }
  };

  const handleUploadSignedOutline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectData?.id || !signedOutlineFile) {
      alert('Vui lòng chọn file đề cương PDF đã có chữ ký.');
      return;
    }
    try {
      setUploadingSignedOutline(true);
      await apiService.uploadSignedOutline(projectData.id, signedOutlineFile);
      alert('Đã nộp đề cương có chữ ký thành công! Khoa đã lưu hồ sơ.');
      setSignedOutlineFile(null);
      fetchData();
    } catch (err: any) {
      alert('Lỗi nộp hồ sơ đề cương: ' + (err.response?.data?.detail || err.message));
    } finally {
      setUploadingSignedOutline(false);
    }
  };

  const handleSubmitDeliverable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaskForDeliverable) return;
    if (!deliverableFile && !deliverableUrl.trim()) {
      alert('Vui lòng đính kèm file kết quả hoặc nhập link URL sản phẩm (GitHub/Drive/Demo).');
      return;
    }
    try {
      setSubmittingDeliverable(true);
      const fd = new FormData();
      if (deliverableFile) fd.append('deliverable_file', deliverableFile);
      if (deliverableUrl.trim()) fd.append('deliverable_url', deliverableUrl.trim());
      if (deliverableNotes.trim()) fd.append('student_notes', deliverableNotes.trim());

      await apiService.submitTaskDeliverable(selectedTaskForDeliverable.id, fd);
      alert('Đã nộp kết quả thực hiện nhiệm vụ thành công! Đang chờ GVHD đánh giá.');
      setSelectedTaskForDeliverable(null);
      setDeliverableFile(null);
      setDeliverableUrl('');
      setDeliverableNotes('');
      const refreshTasks = await axios.get(`${API_BASE}/student/tasks/`, { headers: getHeaders() }).catch(() => null);
      if (refreshTasks?.data) setTasksData(refreshTasks.data);
    } catch (err: any) {
      alert('Lỗi nộp sản phẩm: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSubmittingDeliverable(false);
    }
  };

  const handleSubmitDeferral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deferralReasonDetails.trim()) {
      alert('Vui lòng nhập lý do chi tiết xin bảo lưu đồ án.');
      return;
    }
    try {
      setSubmittingDeferral(true);
      const fd = new FormData();
      fd.append('reason_category', deferralReasonCategory);
      fd.append('reason_details', deferralReasonDetails.trim());
      if (deferralEvidenceFile) fd.append('evidence_file', deferralEvidenceFile);

      await apiService.submitStudentDeferralRequest(fd);
      alert('Đã gửi đơn xin bảo lưu đồ án thành công! Đang chờ Ban Chủ nhiệm Khoa xem xét.');
      setDeferralReasonDetails('');
      setDeferralEvidenceFile(null);
      setShowDeferralModal(false);
      const deferrals = await apiService.getStudentDeferralRequests().catch(() => []);
      setDeferralRequests(Array.isArray(deferrals) ? deferrals : []);
    } catch (err: any) {
      alert('Lỗi nộp đơn bảo lưu: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSubmittingDeferral(false);
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
      {/* 6-Stage Workflow Stepper Bar */}
      <div className="utc-stepper-bar">
        <div className="utc-stepper-label">
          <span className="utc-stepper-pulse"></span>
          <span>Tiến trình 6 Giai Đoạn ĐATN:</span>
        </div>
        <div className="utc-stepper-group">
          {GRADUATION_STAGES.map((tab) => {
            const isCurrent = tab.number === currentStageNum;
            const isCompleted = tab.number < currentStageNum;
            const isLocked = tab.number > currentStageNum;

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleSelectTab(tab.key)}
                className={`utc-stepper-item ${activeTab === tab.key ? 'active' : ''} ${isLocked ? 'locked' : ''}`}
                style={{
                  cursor: isLocked ? 'not-allowed' : 'pointer',
                  opacity: isLocked ? 0.55 : 1,
                  position: 'relative',
                }}
                title={
                  isLocked
                    ? `Chờ GVHD duyệt để mở Giai đoạn ${tab.number}`
                    : isCurrent
                    ? `Giai đoạn hiện tại (${tab.number}/6) - Đang thực hiện`
                    : `Giai đoạn ${tab.number} (Đã hoàn thành)`
                }
              >
                <span>{isLocked ? '🔒' : tab.icon}</span>
                <span>{tab.shortLabel}</span>
                {isCurrent && (
                  <span
                    style={{
                      background: '#0284c7',
                      color: '#fff',
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      padding: '1px 5px',
                      borderRadius: '8px',
                      marginLeft: '4px',
                    }}
                  >
                    Đang làm
                  </span>
                )}
                {isCompleted && (
                  <span style={{ color: '#10b981', fontSize: '0.75rem', marginLeft: '2px', fontWeight: 'bold' }}>✓</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab 1: Project Overview */}
      {activeTab === 'project' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6 shadow-xl">
          {projectData ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-mono px-2.5 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-semibold">
                      Trạng thái: {projectData.status_display || projectData.status}
                    </span>
                    {/* Phê duyệt đề tài từ Khoa */}
                    {(projectData.topic_review_status === 'APPROVED' || projectData.status === 'TOPIC_APPROVED') && (
                      <span className="text-xs px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                        ✅ Khoa đã phê duyệt đề tài
                      </span>
                    )}
                    {(projectData.topic_review_status === 'REVISION_REQUIRED' || projectData.status === 'TOPIC_REVISION') && (
                      <span className="text-xs px-2.5 py-1 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold animate-pulse">
                        ⚠️ Khoa yêu cầu sửa đề tài
                      </span>
                    )}
                    {projectData.topic_review_status === 'GV_CONFIRMED' && (
                      <span className="text-xs px-2.5 py-1 rounded bg-blue-500/20 text-blue-300 border border-blue-500/40 font-medium">
                        ⏳ Chờ Khoa phê duyệt đề tài
                      </span>
                    )}
                    {/* Xét duyệt điều kiện học vụ */}
                    {(projectData.initial_eligibility === 'FORCE_APPROVED' || projectData.is_force_approved) && (
                      <span className="text-xs px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                        ⚡ Duyệt đặc cách (Force Approved)
                      </span>
                    )}
                    {(projectData.initial_eligibility === 'ELIGIBLE' || projectData.final_academic_eligibility === 'ELIGIBLE' || projectData.academic_clearance_status === 'ELIGIBLE' || projectData.academic_clearance_status === 'CLEARED') && (
                      <span className="text-xs px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                        ✅ Đủ điều kiện học vụ
                      </span>
                    )}
                    {(projectData.initial_eligibility === 'INELIGIBLE' || projectData.final_academic_eligibility === 'INELIGIBLE' || projectData.academic_clearance_status === 'FAILED') && !projectData.is_force_approved && (
                      <span className="text-xs px-2.5 py-1 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold">
                        ⚠️ Chưa đạt điều kiện học vụ
                      </span>
                    )}
                  </div>
                  <h3 className="text-xl font-bold text-slate-100 mt-2">{projectData.topic_title_vi}</h3>
                  {projectData.topic_title_en && (
                    <p className="text-sm text-slate-400 italic mt-0.5">{projectData.topic_title_en}</p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setShowDeferralModal(true)}
                  className="utc-btn utc-btn-deferral"
                  title="Nộp hoặc xem tiến độ đơn xin hoãn / bảo lưu ĐATN"
                >
                  <span>📝</span>
                  <span>Đơn xin bảo lưu</span>
                  <span className="utc-deferral-count">{deferralRequests.length}</span>
                </button>
              </div>

              {/* Action Banner: Khi Khoa yêu cầu sửa đề tài */}
              {(projectData.topic_review_status === 'REVISION_REQUIRED' || projectData.status === 'TOPIC_REVISION') && (
                <div className="utc-action-banner-revision">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🚨</span>
                      <div>
                        <h4 className="font-bold text-sm text-rose-100">Khoa CNTT Yêu Cầu Chỉnh Sửa Lại Đề Tài</h4>
                        <p className="text-xs text-rose-300/80">Bạn cần trao đổi với GVHD, điều chỉnh lại đề tài và nộp lại bản thảo.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSelectTab('outline')}
                      className="utc-btn utc-btn-topic-revision"
                    >
                      <span>✏️ Chỉnh sửa đề tài ngay</span>
                      <span>➔</span>
                    </button>
                  </div>
                  <div className="p-3 mt-3 rounded-lg bg-black/40 border border-rose-500/30 text-rose-200 text-xs">
                    <span className="font-semibold text-rose-300">Ý kiến nhận xét từ Ban Chủ nhiệm Khoa: </span>
                    <strong className="text-white">"{projectData.topic_revision_notes || 'Cần điều chỉnh nội dung theo góp ý của Khoa'}"</strong>
                  </div>
                </div>
              )}

              {/* Action Banner: Khi Khoa đã phê duyệt đề tài */}
              {(projectData.topic_review_status === 'APPROVED' || projectData.status === 'TOPIC_APPROVED') && (
                <div className="utc-action-banner-approved">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🎉</span>
                      <div>
                        <h4 className="font-bold text-sm text-emerald-100">Đề Tài Đã Được Khoa Phê Duyệt Chính Thức</h4>
                        <p className="text-xs text-emerald-300/80">Đề tài đã hoàn tất phê duyệt. Sinh viên tiến hành bước kế tiếp: Xuất & Ký nộp Đề cương.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSelectTab('outline')}
                      className="utc-btn utc-btn-topic-approved"
                    >
                      <span>📄 Xuất Đề Cương & Nộp Bản Ký</span>
                      <span>➔</span>
                    </button>
                  </div>
                  <p className="text-slate-300 text-xs mt-2">
                    Hãy vào mục <b>"3. Đề cương ĐATN"</b> để tải file PDF đề cương chi tiết chuẩn UTC, lấy chữ ký GVHD và tải bản scan lên hệ thống để lưu trữ.
                  </p>
                </div>
              )}

              {/* Notification: Khoa Force Approve đặc cách */}
              {projectData.initial_eligibility === 'FORCE_APPROVED' && (
                <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs space-y-1">
                  <div className="flex items-center gap-2 font-bold text-amber-100">
                    <span>⚡</span>
                    <span>Quyết định Đặc cách (Force Approve) từ Ban Chủ nhiệm Khoa:</span>
                  </div>
                  <p className="text-slate-300">
                    {projectData.ineligibility_reason || 'Khoa phê duyệt đặc cách theo đơn giải trình và cho phép sinh viên tiếp tục làm ĐATN.'}
                  </p>
                </div>
              )}

              {projectData.status === 'DISQUALIFIED' && (
                <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs space-y-1">
                  <h5 className="font-bold text-rose-200 text-sm">❌ Đồ án không đủ điều kiện làm trong đợt này (Bị loại khỏi đợt)</h5>
                  <p>
                    Hồ sơ học vụ chưa đáp ứng tiêu chuẩn tối thiểu (CPA &lt; 2.0 hoặc thiếu điều kiện tiên quyết).
                    Sinh viên có thể nộp <b>Đơn xin bảo lưu</b> bằng nút phía trên để Ban Chủ nhiệm Khoa xem xét bảo lưu kết quả sang đợt kế tiếp.
                  </p>
                </div>
              )}

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
              <div className="flex justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleSelectTab('survey')}
                  className="utc-btn utc-btn-survey-now"
                >
                  <span>📋</span>
                  <span>Điền khảo sát ngay</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeferralModal(true)}
                  className="utc-btn utc-btn-deferral-large"
                >
                  <span>📝</span>
                  <span>Nộp đơn bảo lưu</span>
                  <span className="utc-deferral-count">{deferralRequests.length}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Survey & Preferences */}
      {activeTab === 'survey' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6 shadow-xl max-w-3xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-100">Phiếu Khảo sát Thực tập & Đăng ký Nguyện vọng ĐATN</h3>
              <p className="text-xs text-slate-400">Dữ liệu được dùng để phân GVHD tự động theo chỉ tiêu Quota và nguyện vọng chuyên môn</p>
            </div>
            {surveyData?.student && (
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2.5 py-1 rounded font-bold border ${
                  surveyData.student.degree_program === 'ENGINEER'
                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                    : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                }`}>
                  {surveyData.student.degree_program === 'ENGINEER' ? '⚙️ CT Kỹ sư (Engineer)' : '🎓 CT Cử nhân (Bachelor)'}
                </span>
                {surveyData.student.cpa !== undefined && (
                  <span className="text-xs px-2.5 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                    CPA: <b>{surveyData.student.cpa}</b>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Phase 2: Engineer Degree Requirement Warning */}
          {surveyData?.student?.degree_program === 'ENGINEER' && (
            <div className="p-4 rounded-xl bg-purple-950/40 border border-purple-500/40 text-purple-200 text-xs space-y-1">
              <div className="flex items-center gap-2 font-bold text-sm text-purple-300">
                <span>🛡️</span>
                <span>Ràng buộc học vị tối thiểu đối với Chương trình Kỹ sư:</span>
              </div>
              <p className="leading-relaxed">
                Theo quy định của Trường, sinh viên thuộc chương trình đào tạo <b>Kỹ sư</b> bắt buộc phải đăng ký Giảng viên hướng dẫn có học vị tối thiểu là <b>Tiến sĩ (TS, PGS, GS)</b>.
                Hệ thống đã gắn nhãn <span className="font-semibold text-emerald-400">[TS / Đủ ĐK Kỹ sư]</span> ở danh sách giảng viên hợp lệ.
              </p>
            </div>
          )}

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

            {/* NV1 - Preference 1 */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-medium text-slate-300">
                  Nguyện vọng 1 (NV1 - Trọng số 100 điểm) <span className="text-blue-400">*</span>
                </label>
                <span className="text-[10px] text-slate-400">Ưu tiên cao nhất</span>
              </div>
              <select
                value={preference1Id}
                onChange={(e) => setPreference1Id(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="">-- Chọn GVHD Nguyện vọng 1 --</option>
                {surveyData?.supervisors?.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name} ({s.department}) {s.is_eligible_for_engineer ? '— [TS / Đủ ĐK Kỹ sư]' : '— [ThS]'}
                  </option>
                ))}
              </select>
            </div>

            {/* NV2 - Preference 2 */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-medium text-slate-300">
                  Nguyện vọng 2 (NV2 - Trọng số 70 điểm)
                </label>
                <span className="text-[10px] text-slate-400">Tùy chọn</span>
              </div>
              <select
                value={preference2Id}
                onChange={(e) => setPreference2Id(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="">-- Chọn GVHD Nguyện vọng 2 (Không bắt buộc) --</option>
                {surveyData?.supervisors?.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name} ({s.department}) {s.is_eligible_for_engineer ? '— [TS / Đủ ĐK Kỹ sư]' : '— [ThS]'}
                  </option>
                ))}
              </select>
            </div>

            {/* NV3 - Preference 3 */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-medium text-slate-300">
                  Nguyện vọng 3 (NV3 - Trọng số 40 điểm)
                </label>
                <span className="text-[10px] text-slate-400">Tùy chọn</span>
              </div>
              <select
                value={preference3Id}
                onChange={(e) => setPreference3Id(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="">-- Chọn GVHD Nguyện vọng 3 (Không bắt buộc) --</option>
                {surveyData?.supervisors?.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name} ({s.department}) {s.is_eligible_for_engineer ? '— [TS / Đủ ĐK Kỹ sư]' : '— [ThS]'}
                  </option>
                ))}
              </select>
            </div>

            {/* Secondary Criteria Note */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Tiêu chí phụ & Ghi chú nguyện vọng bổ sung
              </label>
              <textarea
                rows={2}
                placeholder="Ghi chú thêm về năng lực, điểm các học phần chuyên môn cao hoặc mong muốn đề tài gắn với doanh nghiệp..."
                value={secondaryCriteriaNote}
                onChange={(e) => setSecondaryCriteriaNote(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-blue-500"
              />
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
                className="utc-btn utc-btn-survey-submit"
              >
                <span>💾</span>
                <span>{surveySaving ? 'Đang lưu...' : 'Lưu thông tin khảo sát'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab 3: Outline Submission & Phase 3 Topic Draft */}
      {activeTab === 'outline' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6 shadow-xl max-w-3xl">
          <div>
            <h3 className="text-lg font-bold text-slate-100">Xây dựng Đề tài & Nộp Đề cương ĐATN (Giai đoạn 3)</h3>
            <p className="text-xs text-slate-400">Quy trình: Thảo luận Đề tài Draft → GVHD xác nhận → Khoa duyệt → Xuất PDF → Ký nộp lưu hồ sơ</p>
          </div>

          {/* Phase 3: Draft Topic Section */}
          <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-sm font-bold text-slate-200">1. Bản thảo Đề tài (Topic Draft & Approval)</h4>
                <p className="text-[11px] text-slate-400">GV và SV cùng xác định tên đề tài trước khi trình Khoa phê duyệt.</p>
              </div>
              {(() => {
                const isTopicApproved = projectData?.topic_review_status === 'APPROVED' || projectData?.status === 'TOPIC_APPROVED';
                const isTopicRevision = projectData?.topic_review_status === 'REVISION_REQUIRED' || projectData?.status === 'TOPIC_REVISION';
                const isTopicConfirmed = projectData?.topic_review_status === 'GV_CONFIRMED' || projectData?.status === 'TOPIC_CONFIRMED' || projectData?.status === 'PENDING_REVIEW';

                return (
                  <span className={`text-xs px-2.5 py-1 rounded font-bold border ${
                    isTopicApproved ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold' :
                    isTopicRevision ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 font-bold animate-pulse' :
                    isTopicConfirmed ? 'bg-blue-500/20 text-blue-300 border-blue-500/40 font-medium' :
                    'bg-amber-500/20 text-amber-400 border-amber-500/30'
                  }`}>
                    {isTopicApproved ? '✅ Khoa đã phê duyệt đề tài' :
                     isTopicRevision ? '⚠️ Khoa yêu cầu sửa đề tài' :
                     isTopicConfirmed ? '⏳ GV đã xác nhận / Chờ Khoa duyệt' :
                     'Bản thảo (Draft)'}
                  </span>
                );
              })()}
            </div>

            {/* Banner: Khoa yêu cầu sửa đề tài */}
            {(projectData?.topic_review_status === 'REVISION_REQUIRED' || projectData?.status === 'TOPIC_REVISION') && (
              <div className="p-4 rounded-xl bg-gradient-to-r from-rose-950/60 to-slate-900 border border-rose-500/50 text-rose-200 text-xs space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🚨</span>
                  <span className="font-bold text-sm text-rose-100">Khoa CNTT Yêu Cầu Chỉnh Sửa Lại Đề Tài:</span>
                </div>
                <div className="p-2.5 rounded-lg bg-black/40 border border-rose-500/30 text-rose-200 font-mono text-xs">
                  "{projectData?.topic_revision_notes || 'Cần điều chỉnh nội dung nghiên cứu theo góp ý của Khoa'}"
                </div>
                <p className="text-slate-300 text-[11px]">
                  Vui lòng điều chỉnh lại tên đề tài bên dưới, trao đổi với GVHD và bấm <b>"Lưu & Nộp Lại Bản Thảo"</b> để gửi lại cho Khoa xét duyệt.
                </p>
              </div>
            )}

            {/* Banner: Khoa đã duyệt đề tài */}
            {(projectData?.topic_review_status === 'APPROVED' || projectData?.status === 'TOPIC_APPROVED') && (
              <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/60 to-slate-900 border border-emerald-500/50 text-emerald-200 text-xs space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🎉</span>
                  <span className="font-bold text-sm text-emerald-100">Đề Tài Đã Được Khoa Phê Duyệt Chính Thức</span>
                </div>
                <p className="text-slate-300 text-[11px]">
                  Tên đề tài đã được chốt và khóa chỉnh sửa. Vui lòng chuyển xuống <b>Mục 2 (Tải Đề Cương Tự Động)</b> để xuất PDF, in lấy chữ ký GVHD và tải bản scan lên <b>Mục 3 (Ký Nộp Đề Cương)</b>.
                </p>
              </div>
            )}

            {projectData ? (
              <form onSubmit={handleSaveDraftTopic} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Tên đề tài tiếng Việt (Bản thảo) *</label>
                  <input
                    type="text"
                    required
                    value={draftTopicVi}
                    onChange={(e) => setDraftTopicVi(e.target.value)}
                    disabled={projectData?.topic_review_status === 'APPROVED' || projectData?.status === 'TOPIC_APPROVED'}
                    placeholder="VD: Nghiên cứu xây dựng ứng dụng hỗ trợ phân luồng giao thông thông minh..."
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-blue-500 disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Tên đề tài tiếng Anh</label>
                  <input
                    type="text"
                    value={draftTopicEn}
                    onChange={(e) => setDraftTopicEn(e.target.value)}
                    disabled={projectData?.topic_review_status === 'APPROVED' || projectData?.status === 'TOPIC_APPROVED'}
                    placeholder="VD: Research and development of an intelligent traffic routing application..."
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-blue-500 disabled:opacity-60"
                  />
                </div>

                {projectData?.topic_review_status !== 'APPROVED' && projectData?.status !== 'TOPIC_APPROVED' && (
                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={savingDraftTopic}
                      className={
                        projectData?.topic_review_status === 'REVISION_REQUIRED' || projectData?.status === 'TOPIC_REVISION'
                          ? 'utc-btn utc-btn-topic-save-revision'
                          : 'utc-btn utc-btn-topic-save'
                      }
                    >
                      <span>
                        {projectData?.topic_review_status === 'REVISION_REQUIRED' || projectData?.status === 'TOPIC_REVISION'
                          ? '🚀'
                          : '💾'}
                      </span>
                      <span>
                        {savingDraftTopic
                          ? 'Đang lưu...'
                          : projectData?.topic_review_status === 'REVISION_REQUIRED' || projectData?.status === 'TOPIC_REVISION'
                          ? 'Lưu & Nộp Lại Bản Thảo Đề Tài'
                          : 'Lưu Bản Thảo Đề Tài (Draft)'}
                      </span>
                    </button>
                  </div>
                )}
              </form>
            ) : (
              <p className="text-xs text-slate-400 italic">Chưa được khởi tạo đồ án trong đợt.</p>
            )}
          </div>

          {/* Phase 3: Export Outline PDF & Upload Signed Copy */}
          {projectData && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Step 24: Generate Outline PDF */}
              <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-3 text-xs">
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-200 text-sm">2. Sinh đề cương & file PDF tự động</h4>
                  <p className="text-slate-400">
                    Hệ thống tự động xuất biểu mẫu Đề cương chi tiết ĐATN chuẩn UTC dưới định dạng PDF.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleExportOutlinePdf}
                    disabled={generatingOutlinePdf}
                    className="utc-btn utc-btn-export-pdf"
                  >
                    <span>📄</span>
                    <span>{generatingOutlinePdf ? 'Đang xuất PDF...' : 'Tải Đề Cương Tự Động (PDF)'}</span>
                  </button>
                </div>
              </div>

              {/* Step 25: Upload Signed Outline */}
              <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-3 text-xs">
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-200 text-sm">3. Ký nộp & Lưu hồ sơ Đề cương</h4>
                  <p className="text-slate-400">
                    Sau khi in và có đầy đủ chữ ký của SV & GVHD, scan nộp file PDF để Khoa lưu hồ sơ.
                  </p>
                </div>

                {projectData.signed_outline_file && (
                  <div className="p-2 rounded bg-emerald-950/20 border border-emerald-500/20 text-emerald-300 flex items-center justify-between">
                    <span>✅ Đã nộp bản ký:</span>
                    <a
                      href={projectData.signed_outline_file}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline font-semibold text-emerald-400 hover:text-emerald-300"
                    >
                      Xem hồ sơ ↗
                    </a>
                  </div>
                )}

                <form onSubmit={handleUploadSignedOutline} className="space-y-2 pt-1">
                  <input
                    type="file"
                    accept=".pdf"
                    required
                    onChange={(e) => setSignedOutlineFile(e.target.files?.[0] || null)}
                    className="w-full text-slate-400 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-[11px] file:bg-slate-800 file:text-slate-200"
                  />
                  <button
                    type="submit"
                    disabled={uploadingSignedOutline}
                    className="utc-btn utc-btn-upload-outline"
                  >
                    <span>📤</span>
                    <span>{uploadingSignedOutline ? 'Đang tải lên...' : 'Nộp File Đề Cương Đã Ký'}</span>
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Traditional Outline Review Status */}
          {projectData?.outline_review && (
            <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-300">Tình trạng xét duyệt đề cương chi tiết:</span>
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

          <form onSubmit={handleSubmitOutline} className="space-y-4 pt-2 border-t border-slate-800">
            <h4 className="font-bold text-slate-200 text-sm">Nộp / Cập nhật File Tài Liệu Đề Cương Chi Tiết</h4>
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

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={outlineSubmitting}
                className="utc-btn utc-btn-topic-save"
              >
                <span>🚀</span>
                <span>{outlineSubmitting ? 'Đang nộp đề cương...' : 'Nộp Đề cương Chi tiết'}</span>
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
                className="utc-btn utc-btn-weekly-submit"
                style={{ width: '100%' }}
              >
                <span>📊</span>
                <span>{reportSubmitting ? 'Đang nộp...' : `Nộp Báo cáo Tuần ${selectedWeek}`}</span>
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

                            {/* Phase 5: Task Review Verdict Badge */}
                            {task.review_verdict && task.review_verdict !== 'NOT_SUBMITTED' && (
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                                task.review_verdict === 'ACCEPTED' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' :
                                task.review_verdict === 'REVISION_REQUIRED' ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' :
                                'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              }`}>
                                {task.review_verdict === 'ACCEPTED' ? '🎯 Đạt yêu cầu' :
                                 task.review_verdict === 'REVISION_REQUIRED' ? '⚠️ Yêu cầu sửa lại' :
                                 '⏳ Chờ GV đánh giá'}
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

                          {/* Phase 5: Deliverable display */}
                          {(task.deliverable_file || task.deliverable_url) && (
                            <div className="mt-2 p-2.5 rounded bg-slate-900 border border-slate-800 text-xs space-y-1">
                              <span className="font-semibold text-emerald-400">📦 Sản phẩm / Báo cáo kết quả:</span>
                              <div className="flex flex-wrap items-center gap-3">
                                {task.deliverable_file && (
                                  <a href={task.deliverable_file} target="_blank" rel="noreferrer" className="text-blue-400 underline font-medium hover:text-blue-300">
                                    File đính kèm ↗
                                  </a>
                                )}
                                {task.deliverable_url && (
                                  <a href={task.deliverable_url} target="_blank" rel="noreferrer" className="text-blue-400 underline font-medium hover:text-blue-300">
                                    Link sản phẩm (Git/Drive/Demo) ↗
                                  </a>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Phase 5: Supervisor review notes */}
                          {task.supervisor_review_notes && (
                            <div className={`mt-2 p-2.5 rounded border text-xs ${
                              task.review_verdict === 'REVISION_REQUIRED'
                                ? 'bg-rose-950/30 border-rose-500/30 text-rose-200'
                                : 'bg-emerald-950/20 border-emerald-500/20 text-emerald-200'
                            }`}>
                              <span className="font-semibold">
                                {task.review_verdict === 'REVISION_REQUIRED' ? '⚠️ Yêu cầu sửa từ GVHD:' : '💬 Nhận xét từ GVHD:'}
                              </span>{' '}
                              {task.supervisor_review_notes}
                            </div>
                          )}

                          {/* Student Notes Display */}
                          {task.student_notes && (
                            <div className="mt-2 p-2.5 rounded bg-blue-950/20 border border-blue-500/20 text-xs text-blue-200">
                              <span className="font-semibold text-blue-400">📝 Ghi chú SV:</span>{' '}
                              {task.student_notes}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-wrap items-center gap-2 self-end md:self-center">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTaskForDeliverable(task);
                            setDeliverableUrl(task.deliverable_url || '');
                            setDeliverableNotes(task.student_notes || '');
                          }}
                          className="utc-btn utc-btn-deliverable"
                        >
                          <span>📤</span>
                          <span>{task.deliverable_file || task.deliverable_url ? 'Nộp lại sản phẩm' : 'Nộp sản phẩm'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenNotesModal(task)}
                          className="utc-btn utc-btn-task-note"
                        >
                          <span>✏️</span>
                          <span>{task.student_notes ? 'Sửa ghi chú' : 'Ghi chú'}</span>
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

                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          ⭐ Căn cứ điểm quá trình
                        </span>
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                            log.meeting_type === 'ONLINE'
                              ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                              : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          }`}
                        >
                          {log.meeting_type_display || (log.meeting_type === 'ONLINE' ? 'Trực tuyến' : 'Gặp trực tiếp')}
                        </span>
                        {log.location_or_link && (log.meeting_type === 'ONLINE' || log.location_or_link.startsWith('http')) ? (
                          <a
                            href={log.location_or_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition shadow-sm"
                            title="Bấm để tham gia phòng họp trực tuyến Google Meet / Zoom"
                          >
                            <span>📹</span>
                            <span>Tham gia cuộc họp trực tuyến (Google Meet / Zoom) ↗</span>
                          </a>
                        ) : log.location_or_link ? (
                          <span className="text-xs text-slate-300">
                            📍 Địa điểm: <b>{log.location_or_link}</b>
                          </span>
                        ) : null}
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

                      {log.tasks && log.tasks.length > 0 && (
                        <div className="p-3 rounded-lg bg-blue-950/20 border border-blue-500/20 space-y-1.5">
                          <span className="font-bold text-blue-300">📌 Nhiệm vụ GVHD giao tuần tới:</span>
                          {log.tasks.map((t: any) => (
                            <div key={t.id} className="flex items-center justify-between text-slate-200 pl-2">
                              <span>• <b>{t.title}</b> {t.due_date && <span className="text-slate-400">(Hạn nộp: {t.due_date})</span>}</span>
                              <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${t.is_completed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-300'}`}>
                                {t.is_completed ? '✅ Đã xong' : '⏳ Cần làm'}
                              </span>
                            </div>
                          ))}
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

              {/* Deferral Quick Action Banner in Tab 6 */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-slate-950 border border-slate-800">
                <div>
                  <h4 className="text-sm font-bold text-slate-200">Đơn Xin Hoãn / Bảo Lưu Đồ Án Tốt Nghiệp</h4>
                  <p className="text-xs text-slate-400">Trường hợp chưa đủ điều kiện bảo vệ hoặc lý do học vụ cần bảo lưu kết quả sang đợt sau.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDeferralModal(true)}
                  className="utc-btn utc-btn-deferral"
                >
                  <span>📝</span>
                  <span>Đơn xin bảo lưu</span>
                  <span className="utc-deferral-count">{deferralRequests.length}</span>
                </button>
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
        <div className="utc-modal-overlay">
          <div className="utc-modal-card" style={{ maxWidth: 480 }}>
            <div className="utc-modal-header">
              <div>
                <span className="text-xs text-blue-400 font-semibold">Cập nhật tiến độ nhiệm vụ</span>
                <h3 className="utc-modal-title mt-1">{selectedTaskForNotes.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTaskForNotes(null)}
                className="utc-modal-close-btn"
              >
                ✕
              </button>
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
                  className="utc-modal-textarea"
                />
              </div>

              <div className="utc-modal-footer">
                <button
                  type="button"
                  onClick={() => setSelectedTaskForNotes(null)}
                  className="utc-btn utc-btn-ghost"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={savingTaskNote}
                  className="utc-btn utc-btn-topic-save"
                >
                  <span>💾</span>
                  <span>{savingTaskNote ? 'Đang lưu...' : 'Lưu ghi chú'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Nộp sản phẩm / Deliverable cho nhiệm vụ */}
      {selectedTaskForDeliverable && (
        <div className="utc-modal-overlay">
          <div className="utc-modal-card">
            <div className="utc-modal-header">
              <div>
                <span className="text-xs text-emerald-400 font-semibold uppercase tracking-wider">Giai đoạn 5: Nộp kết quả nhiệm vụ</span>
                <h3 className="utc-modal-title mt-1">{selectedTaskForDeliverable.title}</h3>
                <p className="utc-modal-subtitle">Nộp file sản phẩm, mã nguồn nén hoặc link repo Git để GVHD đánh giá.</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTaskForDeliverable(null)}
                className="utc-modal-close-btn"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitDeliverable} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Đính kèm File sản phẩm (Zip, PDF, Docs, tối đa 25MB):
                </label>
                <input
                  type="file"
                  onChange={(e) => setDeliverableFile(e.target.files?.[0] || null)}
                  className="w-full text-slate-400 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:bg-slate-800 file:text-slate-200"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Link sản phẩm trực tuyến (GitHub / GitLab / Google Drive / Demo Web):
                </label>
                <input
                  type="url"
                  value={deliverableUrl}
                  onChange={(e) => setDeliverableUrl(e.target.value)}
                  placeholder="https://github.com/username/project hoặc https://drive.google.com/..."
                  className="utc-modal-input"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Ghi chú tóm tắt kết quả gửi Giảng viên:
                </label>
                <textarea
                  rows={3}
                  value={deliverableNotes}
                  onChange={(e) => setDeliverableNotes(e.target.value)}
                  placeholder="Mô tả tóm tắt tính năng đã chạy, hướng dẫn cài đặt hoặc những điểm lưu ý..."
                  className="utc-modal-textarea"
                />
              </div>

              <div className="utc-modal-footer">
                <button
                  type="button"
                  onClick={() => setSelectedTaskForDeliverable(null)}
                  className="utc-btn utc-btn-ghost"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={submittingDeliverable}
                  className="utc-btn utc-btn-topic-approved"
                >
                  <span>📤</span>
                  <span>{submittingDeliverable ? 'Đang nộp...' : 'Nộp sản phẩm'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Đơn xin bảo lưu đồ án tốt nghiệp */}
      {showDeferralModal && (
        <div className="utc-modal-overlay">
          <div className="utc-modal-card">
            <div className="utc-modal-header">
              <div>
                <h3 className="utc-modal-title">
                  <span>📝</span> Đơn Xin Bảo Lưu Đồ Án Tốt Nghiệp
                </h3>
                <p className="utc-modal-subtitle">
                  Dành cho trường hợp chưa đủ điều kiện học vụ hoặc lý do chính đáng cần bảo lưu kết quả sang đợt tiếp theo.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDeferralModal(false)}
                className="utc-modal-close-btn"
                title="Đóng"
              >
                ✕
              </button>
            </div>

            {/* List of existing requests */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Lịch sử đơn đã nộp</h4>
              {deferralRequests.length === 0 ? (
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 text-xs text-center">
                  Bạn chưa gửi đơn xin bảo lưu nào trong đợt này.
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {deferralRequests.map((req) => (
                    <div key={req.id} className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-200">
                          Lý do: {req.reason_category_display || req.reason_category}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          req.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' :
                          req.status === 'REJECTED' ? 'bg-rose-500/20 text-rose-400 border-rose-500/40' :
                          'bg-amber-500/20 text-amber-400 border-amber-500/40'
                        }`}>
                          {req.status_display || req.status}
                        </span>
                      </div>
                      <p className="text-slate-300 whitespace-pre-line">{req.reason_details}</p>
                      {req.evidence_file && (
                        <p>
                          <a href={req.evidence_file} target="_blank" rel="noreferrer" className="text-blue-400 underline font-medium hover:text-blue-300">
                            Xem minh chứng đính kèm ↗
                          </a>
                        </p>
                      )}
                      {req.faculty_review_notes && (
                        <div className="p-2 rounded bg-slate-900 border border-slate-800 text-slate-300">
                          <span className="font-semibold text-amber-400">Ý kiến Khoa:</span> {req.faculty_review_notes}
                        </div>
                      )}
                      <div className="text-[10px] text-slate-500">
                        Nộp lúc: {new Date(req.created_at).toLocaleString('vi-VN')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Form to submit new request */}
            <form onSubmit={handleSubmitDeferral} className="space-y-3 pt-3 border-t border-slate-800 text-xs">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Nộp đơn xin bảo lưu mới</h4>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Phân loại lý do (*)</label>
                <select
                  value={deferralReasonCategory}
                  onChange={(e) => setDeferralReasonCategory(e.target.value as any)}
                  className="utc-modal-select"
                >
                  <option value="ACADEMIC">Học vụ (Chưa hoàn thành đủ tín chỉ / nợ môn tiên quyết)</option>
                  <option value="HEALTH">Sức khỏe (Có chứng nhận y tế / điều trị)</option>
                  <option value="FINANCIAL">Tài chính (Hoàn cảnh gia đình khó khăn)</option>
                  <option value="PERSONAL">Cá nhân khác (Công tác đột xuất, lý do gia đình)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Chi tiết lý do & Đề xuất (*)</label>
                <textarea
                  rows={3}
                  required
                  value={deferralReasonDetails}
                  onChange={(e) => setDeferralReasonDetails(e.target.value)}
                  placeholder="Trình bày chi tiết lý do và mong muốn được bảo lưu đề tài/kết quả sang đợt tiếp theo..."
                  className="utc-modal-textarea"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">File minh chứng đính kèm (Giấy tờ y tế / xác nhận, PDF/Ảnh):</label>
                <input
                  type="file"
                  onChange={(e) => setDeferralEvidenceFile(e.target.files?.[0] || null)}
                  className="w-full text-slate-400 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-[11px] file:bg-slate-800 file:text-slate-200"
                />
              </div>

              <div className="utc-modal-footer">
                <button
                  type="button"
                  onClick={() => setShowDeferralModal(false)}
                  className="utc-btn utc-btn-ghost"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submittingDeferral}
                  className="utc-btn utc-btn-deferral-submit"
                >
                  <span>{submittingDeferral ? '⏳' : '📨'}</span>
                  <span>{submittingDeferral ? 'Đang gửi...' : 'Gửi đơn bảo lưu'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
