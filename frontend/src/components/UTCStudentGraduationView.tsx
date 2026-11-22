import { notify, notifyError } from '../utils/notify';
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiService, apiClient } from '../services/api';
import { safeExternalUrl } from '../utils/safeUrl';
import type { ThesisDeferralRequest } from '../types';
import { GRADUATION_STAGES, getProjectStageNumber } from '../utils/graduationStages';
import { useBatchProgress } from '../contexts/BatchProgressContext';
import { formatFullName } from '../utils/nameHelper';
import { formatDateVN, getTodayDateStr } from '../utils/dateUtils';
import { isValidEmail, validatePhoneNumber, cleanPhoneNumber } from '../utils/validation';
import './UTCStudentGraduationView.css';

import { API_BASE_URL as API_BASE } from '../services/api';
import { CalendarSyncButtons, SubmissionVersionsPanel, TopicSimilarityHint } from './FeatureExtensions';
import DocumentViewerModal from './DocumentViewerModal';


export interface UTCStudentGraduationViewProps {
  initialTab?: 'project' | 'survey' | 'outline' | 'weekly' | 'supervision' | 'grade';
  onSubtabChange?: (tab: 'project' | 'survey' | 'outline' | 'weekly' | 'supervision' | 'grade') => void;
  initialProjectData?: any;
}

export const UTCStudentGraduationView: React.FC<UTCStudentGraduationViewProps> = ({
  initialTab,
  onSubtabChange,
  initialProjectData,
}) => {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'project' | 'survey' | 'outline' | 'weekly' | 'supervision' | 'grade'>(initialTab || 'project');
  const [loading, setLoading] = useState(true);
  const { progress: batchProgress, loading: batchProgressLoading } = useBatchProgress();

  // Project Data
  const [projectData, setProjectData] = useState<any>(initialProjectData || null);

  // Document Viewer Modal State
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerUrl, setViewerUrl] = useState('');
  const [viewerTitle, setViewerTitle] = useState('');

  const handleOpenViewer = (url: string, title?: string) => {
    if (!url) {
      notify.warning('Không tìm thấy đường dẫn tệp đề cương.');
      return;
    }
    setViewerUrl(url);
    setViewerTitle(title || 'Xem tệp Đề cương ĐATN');
    setViewerOpen(true);
  };

  useEffect(() => {
    if (initialProjectData && !projectData) {
      setProjectData(initialProjectData);
    }
  }, [initialProjectData, projectData]);

  // Sinh viên được quyền truy cập theo tiến độ thực tế cao nhất giữa Đợt chung và Đề tài cá nhân
  const projectStageNum = getProjectStageNumber(projectData || initialProjectData);
  const currentStageNum = Math.max(
    batchProgress?.current_stage_number || 1,
    projectStageNum
  );
  const activeStageNumber = GRADUATION_STAGES.find((stage) => stage.key === activeTab)?.number || 1;
  const isViewingPastStage = activeStageNumber < currentStageNum;
  const submittedOutline = projectData?.outline_review;
  const submittedOutlineUrl = submittedOutline?.outline_file_url || submittedOutline?.outline_file || '';
  const hasSubmittedOutline = Boolean(
    projectData &&
    projectData.status !== 'OUTLINE_REVISION' &&
    (
      ['OUTLINE_PENDING', 'OUTLINE_APPROVED'].includes(projectData.status) ||
      (submittedOutlineUrl && submittedOutline?.submitted_at)
    )
  );
  const submittedOutlineFileName = (() => {
    if (!submittedOutlineUrl) return 'Không có tệp PDF đính kèm';
    try {
      return decodeURIComponent(submittedOutlineUrl.split('/').pop()?.split('?')[0] || 'de-cuong-datn.pdf');
    } catch {
      return 'de-cuong-datn.pdf';
    }
  })();

  const handleSelectTab = (tabKey: 'project' | 'survey' | 'outline' | 'weekly' | 'supervision' | 'grade') => {
    const targetStage = GRADUATION_STAGES.find((s) => s.key === tabKey);
    if (targetStage && targetStage.number > currentStageNum) {
      notify.warning(`Bạn cần hoàn thành GĐ ${currentStageNum} trước khi mở ${targetStage.label}!`);
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

  // URL/thông báo có thể mở thẳng một tab chưa tới giai đoạn. Khi tiến trình đợt
  // tải xong, đưa người dùng về đúng giai đoạn hiện tại thay vì hiển thị sai GĐ6.
  useEffect(() => {
    if (batchProgressLoading || !batchProgress) return;

    const selectedStage = GRADUATION_STAGES.find((stage) => stage.key === activeTab);
    const isLockedStage = selectedStage && selectedStage.number > currentStageNum;

    if (isLockedStage) {
      const currentStage = GRADUATION_STAGES.find((stage) => stage.number === currentStageNum);
      if (currentStage) {
        setActiveTab(currentStage.key);
        onSubtabChange?.(currentStage.key);
      }
    }
  }, [activeTab, batchProgress, batchProgressLoading, currentStageNum, onSubtabChange]);

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
  const [showAllSupervisors, setShowAllSupervisors] = useState(false);
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | undefined>();
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [emailTouched, setEmailTouched] = useState(false);
  const [surveySaving, setSurveySaving] = useState(false);

  // Lọc & đề xuất giảng viên theo chuyên ngành (hướng nghiên cứu) đã chọn
  const selectedTopicArea = (surveyData?.topic_areas || []).find(
    (t: any) => String(t.id) === String(topicDirectionId)
  );
  const allSupervisors: any[] = surveyData?.supervisors || [];
  const topicMatchedSupervisors: any[] = selectedTopicArea
    ? allSupervisors.filter((s: any) =>
        (s.topic_area_ids || []).map(Number).includes(Number(selectedTopicArea.id))
      )
    : [];
  // Mặc định chỉ hiển thị GV đúng chuyên ngành; bật "Xem tất cả" để mở rộng
  const displayedSupervisors: any[] =
    selectedTopicArea && !showAllSupervisors ? topicMatchedSupervisors : allSupervisors;

  // Outline Form & Phase 3 Topic Draft / PDF
  const [outlineTitleVi, setOutlineTitleVi] = useState('');
  const [outlineTitleEn, setOutlineTitleEn] = useState('');
  const [outlineFile, setOutlineFile] = useState<File | null>(null);
  const [outlineSubmitting, setOutlineSubmitting] = useState(false);
  const [generatingOutlinePdf, setGeneratingOutlinePdf] = useState(false);

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
  const [taskToComplete, setTaskToComplete] = useState<any | null>(null);
  const [confirmingTaskComplete, setConfirmingTaskComplete] = useState(false);

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
        apiClient.get(`${API_BASE}/student/survey/`, { headers: getHeaders() }).catch(() => null),
        apiClient.get(`${API_BASE}/student/graduation-project/`, { headers: getHeaders() }).catch(() => null),
        apiClient.get(`${API_BASE}/student/weekly-reports/`, { headers: getHeaders() }).catch(() => null),
        apiClient.get(`${API_BASE}/student/supervision-logs/`, { headers: getHeaders() }).catch(() => null),
        apiClient.get(`${API_BASE}/student/tasks/`, { headers: getHeaders() }).catch(() => null),
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

  const handleRequestTaskCompletion = (task: any) => {
    const hasDeliverable = Boolean(task.deliverable_file || task.deliverable_url);
    const hasNotes = Boolean(task.student_notes?.trim?.());
    if (!hasDeliverable || !hasNotes) {
      notify.warning(
        !hasDeliverable && !hasNotes
          ? 'Bạn phải nộp sản phẩm và nhập ghi chú kết quả trước khi xác nhận hoàn thành nhiệm vụ.'
          : !hasDeliverable
          ? 'Bạn phải nộp file hoặc link sản phẩm trước khi xác nhận hoàn thành nhiệm vụ.'
          : 'Bạn phải nhập ghi chú kết quả trước khi xác nhận hoàn thành nhiệm vụ.'
      );
      setSelectedTaskForDeliverable(task);
      setDeliverableFile(null);
      setDeliverableUrl(task.deliverable_url || '');
      setDeliverableNotes(task.student_notes || '');
      return;
    }
    setTaskToComplete(task);
  };

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

      await apiClient.patch(
        `${API_BASE}/student/tasks/${task.id}/complete/`,
        { is_completed: nextCompleted },
        { headers: getHeaders() }
      );
      const refreshTasks = await apiClient.get(`${API_BASE}/student/tasks/`, { headers: getHeaders() }).catch(() => null);
      if (refreshTasks?.data) setTasksData(refreshTasks.data);
      return true;
    } catch (err: any) {
      notifyError('Lỗi cập nhật nhiệm vụ', err);
      const refreshTasks = await apiClient.get(`${API_BASE}/student/tasks/`, { headers: getHeaders() }).catch(() => null);
      if (refreshTasks?.data) setTasksData(refreshTasks.data);
      return false;
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
      await apiClient.patch(
        `${API_BASE}/student/tasks/${selectedTaskForNotes.id}/complete/`,
        { student_notes: studentNotesInput },
        { headers: getHeaders() }
      );
      notify.success('Đã lưu ghi chú tiến độ nhiệm vụ thành công!');
      setSelectedTaskForNotes(null);
      const refreshTasks = await apiClient.get(`${API_BASE}/student/tasks/`, { headers: getHeaders() }).catch(() => null);
      if (refreshTasks?.data) setTasksData(refreshTasks.data);
    } catch (err: any) {
      notifyError('Lỗi lưu ghi chú', err);
    } finally {
      setSavingTaskNote(false);
    }
  };

  const handleSaveSurvey = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneTouched(true);
    setEmailTouched(true);

    const pError = validatePhoneNumber(phone, true);
    if (pError) {
      setPhoneError(pError);
      notify.error(pError);
      return;
    }
    setPhoneError(undefined);

    if (email && !isValidEmail(email)) {
      const eError = 'Email liên hệ không đúng định dạng';
      setEmailError(eError);
      notify.error(eError);
      return;
    }
    setEmailError(undefined);

    const cleanPhone = cleanPhoneNumber(phone);
    try {
      setSurveySaving(true);
      const res = await apiClient.post(
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
          phone_number: cleanPhone,
          email: email.trim(),
        },
        { headers: getHeaders() }
      );
      const warnings: string[] = res.data?.warnings || [];
      if (warnings.length > 0) {
        notify.warning('Đã lưu thông tin khảo sát và nguyện vọng thành công!\n\n⚠️ Lưu ý:\n- ' + warnings.join('\n- '));
      } else {
        notify.success('Đã lưu thông tin khảo sát và nguyện vọng thành công!');
      }
      fetchData();
    } catch (err: any) {
      const msg =
        err.response?.data?.phone_number?.[0] ||
        err.response?.data?.email?.[0] ||
        err.response?.data?.error ||
        err.response?.data?.detail ||
        err.response?.data?.preference_1?.[0] ||
        err.response?.data?.company_name?.[0] ||
        JSON.stringify(err.response?.data) ||
        err.message;
      notify.error('Lỗi: ' + msg);
    } finally {
      setSurveySaving(false);
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
      notifyError('Lỗi xuất PDF đề cương', err);
    } finally {
      setGeneratingOutlinePdf(false);
    }
  };

  const handleSubmitDeliverable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaskForDeliverable) return;
    if (!deliverableFile && !deliverableUrl.trim()) {
      notify.warning('Vui lòng đính kèm file kết quả hoặc nhập link URL sản phẩm (GitHub/Drive/Demo).');
      return;
    }
    if (!deliverableNotes.trim()) {
      notify.warning('Vui lòng nhập ghi chú tóm tắt kết quả đã thực hiện.');
      return;
    }
    try {
      setSubmittingDeliverable(true);
      const fd = new FormData();
      if (deliverableFile) fd.append('deliverable_file', deliverableFile);
      if (deliverableUrl.trim()) fd.append('deliverable_url', deliverableUrl.trim());
      if (deliverableNotes.trim()) fd.append('student_notes', deliverableNotes.trim());

      await apiService.submitTaskDeliverable(selectedTaskForDeliverable.id, fd);
      notify.success('Đã nộp kết quả thực hiện nhiệm vụ thành công! Đang chờ GVHD đánh giá.');
      setSelectedTaskForDeliverable(null);
      setDeliverableFile(null);
      setDeliverableUrl('');
      setDeliverableNotes('');
      const refreshTasks = await apiClient.get(`${API_BASE}/student/tasks/`, { headers: getHeaders() }).catch(() => null);
      if (refreshTasks?.data) setTasksData(refreshTasks.data);
    } catch (err: any) {
      notifyError('Lỗi nộp sản phẩm', err);
    } finally {
      setSubmittingDeliverable(false);
    }
  };

  const handleSubmitDeferral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deferralReasonDetails.trim()) {
      notify.warning('Vui lòng nhập lý do chi tiết xin bảo lưu đồ án.');
      return;
    }
    try {
      setSubmittingDeferral(true);
      const fd = new FormData();
      fd.append('reason_category', deferralReasonCategory);
      fd.append('reason_details', deferralReasonDetails.trim());
      if (deferralEvidenceFile) fd.append('evidence_file', deferralEvidenceFile);

      await apiService.submitStudentDeferralRequest(fd);
      notify.success('Đã gửi đơn xin bảo lưu đồ án thành công! Đang chờ Ban Chủ nhiệm Khoa xem xét.');
      setDeferralReasonDetails('');
      setDeferralEvidenceFile(null);
      setShowDeferralModal(false);
      const deferrals = await apiService.getStudentDeferralRequests().catch(() => []);
      setDeferralRequests(Array.isArray(deferrals) ? deferrals : []);
    } catch (err: any) {
      notifyError('Lỗi nộp đơn bảo lưu', err);
    } finally {
      setSubmittingDeferral(false);
    }
  };

  const handleSubmitOutline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!outlineTitleVi) {
      notify.warning('Vui lòng nhập tên đề tài tiếng Việt.');
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

      await apiClient.post(`${API_BASE}/student/outline/submit/`, fd, {
        headers: { ...getHeaders(), 'Content-Type': 'multipart/form-data' },
      });
      notify.success('Nộp đề cương thành công! Đề cương đã được gửi đến Giảng viên hướng dẫn xem xét & duyệt.');
      fetchData();
    } catch (err: any) {
      notifyError('Lỗi nộp đề cương', err);
    } finally {
      setOutlineSubmitting(false);
    }
  };

  const handleSubmitWeeklyReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!weekSummary) {
      notify.warning('Vui lòng nhập nội dung tóm tắt công việc đã làm trong tuần.');
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

      await apiClient.post(`${API_BASE}/student/weekly-reports/`, fd, {
        headers: { ...getHeaders(), 'Content-Type': 'multipart/form-data' },
      });
      notify.success(`Đã nộp báo cáo tiến độ Tuần ${selectedWeek} thành công!`);
      setWeekSummary('');
      setWeekTasks('');
      setWeekGit('');
      setWeekFile(null);
      fetchData();
    } catch (err: any) {
      const errorData = err.response?.data;
      const errorMessage =
        errorData?.detail ||
        errorData?.message ||
        errorData?.summary_content?.[0] ||
        errorData?.week_number?.[0] ||
        err.message ||
        'Không thể nộp báo cáo tuần.';
      notify.error('Lỗi nộp báo cáo: ' + errorMessage);
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
                    : isCompleted
                    ? `Giai đoạn ${tab.number} (Đã hoàn thành - chỉ xem)`
                    : `Giai đoạn ${tab.number} (Có thể truy cập)`
                }
              >
                <span>{isLocked ? '🔒' : tab.icon}</span>
                <span>{tab.shortLabel}</span>
                {isCurrent && (
                  <span className="utc-stepper-badge-current">
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

      {isViewingPastStage && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          🔒 Giai đoạn {activeStageNumber} đã kết thúc. Bạn có thể xem lại dữ liệu nhưng không thể thực hiện hoặc gửi lại thao tác của giai đoạn này.
        </div>
      )}

      <fieldset
        disabled={isViewingPastStage}
        aria-label={isViewingPastStage ? `Giai đoạn ${activeStageNumber} ở chế độ chỉ xem` : undefined}
        style={{ border: 0, margin: 0, padding: 0, minWidth: 0, width: '100%' }}
      >

      {/* Tab 1: Project Overview */}
      {activeTab === 'project' && (
        <div className="utc-graduation-card space-y-6">
          {projectData ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-blue-900/40 pb-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="text-xs font-mono px-2.5 py-1 rounded border font-bold"
                      style={{ background: '#EEF3FB', borderColor: '#B9D1F8', color: '#2D469E' }}
                    >
                      Trạng thái: {projectData.status_display || projectData.status}
                    </span>
                    {/* Phê duyệt đề tài từ Khoa */}
                    {(projectData.topic_review_status === 'APPROVED' || projectData.status === 'TOPIC_APPROVED') && (
                      <span className="text-xs px-2.5 py-1 rounded bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold">
                        ✅ Khoa đã phê duyệt đề tài
                      </span>
                    )}
                    {(projectData.topic_review_status === 'REVISION_REQUIRED' || projectData.status === 'TOPIC_REVISION') && (
                      <span className="text-xs px-2.5 py-1 rounded bg-rose-50 text-rose-800 border border-rose-300 font-bold animate-pulse">
                        ⚠️ Khoa yêu cầu sửa đề tài
                      </span>
                    )}
                    {projectData.topic_review_status === 'GV_CONFIRMED' && (
                      <span className="text-xs px-2.5 py-1 rounded bg-blue-50 text-blue-800 border border-blue-300 font-bold">
                        ⏳ Chờ Khoa phê duyệt đề tài
                      </span>
                    )}
                    {/* Xét duyệt điều kiện học vụ */}
                    {(projectData.initial_eligibility === 'FORCE_APPROVED' || projectData.is_force_approved) && (
                      <span className="text-xs px-2.5 py-1 rounded bg-amber-50 text-amber-800 border border-amber-300 font-bold">
                        ⚡ Duyệt đặc cách (Force Approved)
                      </span>
                    )}
                    {(projectData.initial_eligibility === 'ELIGIBLE' || projectData.final_academic_eligibility === 'ELIGIBLE' || projectData.academic_clearance_status === 'ELIGIBLE' || projectData.academic_clearance_status === 'CLEARED') && (
                      <span className="text-xs px-2.5 py-1 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                        ✅ Đủ điều kiện học vụ
                      </span>
                    )}
                    {(projectData.initial_eligibility === 'INELIGIBLE' || projectData.final_academic_eligibility === 'INELIGIBLE' || projectData.academic_clearance_status === 'FAILED') && !projectData.is_force_approved && (
                      <span className="text-xs px-2.5 py-1 rounded bg-rose-50 text-rose-800 border border-rose-300 font-bold">
                        ⚠️ Chưa đạt điều kiện học vụ
                      </span>
                    )}
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mt-2">{projectData.topic_title_vi}</h3>
                  {projectData.topic_title_en && (
                    <p className="text-sm text-slate-500 italic mt-0.5">{projectData.topic_title_en}</p>
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
                        <h4 className="font-bold text-sm text-rose-950">Khoa CNTT Yêu Cầu Chỉnh Sửa Lại Đề Tài</h4>
                        <p className="text-xs text-rose-800 font-medium">Bạn cần trao đổi với GVHD, điều chỉnh lại đề tài và nộp lại bản thảo.</p>
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
                  <div className="p-3 mt-3 rounded-lg bg-white/80 border border-rose-200 text-rose-950 text-xs">
                    <span className="font-semibold text-rose-900">Ý kiến nhận xét từ Ban Chủ nhiệm Khoa: </span>
                    <strong className="text-rose-950 font-bold">"{projectData.topic_revision_notes || 'Cần điều chỉnh nội dung theo góp ý của Khoa'}"</strong>
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
                        <h4 className="font-bold text-sm">Đề Tài Đã Được Khoa Phê Duyệt Chính Thức</h4>
                        <p className="text-xs font-medium">Đề tài đã hoàn tất phê duyệt. Sinh viên tiến hành bước kế tiếp: Xuất & Ký nộp Đề cương.</p>
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
                  <p className="text-slate-700 text-xs mt-2">
                    Hãy vào mục <b>"3. Đề cương ĐATN"</b> để tải file PDF đề cương chi tiết chuẩn UTC, lấy chữ ký GVHD và tải bản scan lên hệ thống để lưu trữ.
                  </p>
                </div>
              )}

              {/* Notification: Khoa Force Approve đặc cách */}
              {projectData.initial_eligibility === 'FORCE_APPROVED' && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1">
                  <div className="flex items-center gap-2 font-bold text-amber-950">
                    <span>⚡</span>
                    <span>Quyết định Đặc cách (Force Approve) từ Ban Chủ nhiệm Khoa:</span>
                  </div>
                  <p className="text-slate-700">
                    {projectData.ineligibility_reason || 'Khoa phê duyệt đặc cách theo đơn giải trình và cho phép sinh viên tiếp tục làm ĐATN.'}
                  </p>
                </div>
              )}

              {projectData.status === 'DISQUALIFIED' && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs space-y-1">
                  <h5 className="font-bold text-rose-950 text-sm">❌ Đồ án không đủ điều kiện làm trong đợt này (Bị loại khỏi đợt)</h5>
                  <p className="text-slate-700">
                    Hồ sơ học vụ chưa đáp ứng tiêu chuẩn tối thiểu (CPA &lt; 2.0 hoặc thiếu điều kiện tiên quyết).
                    Sinh viên có thể nộp <b>Đơn xin bảo lưu</b> bằng nút phía trên để Ban Chủ nhiệm Khoa xem xét bảo lưu kết quả sang đợt kế tiếp.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="utc-info-box utc-info-box-gvhd space-y-1">
                  <span className="text-xs text-slate-500 font-medium">Giảng viên hướng dẫn (GVHD)</span>
                  <p className="text-base font-bold text-emerald-700">
                    {projectData.supervisor?.full_name || 'Chưa phân công'}
                  </p>
                  <p className="text-xs text-slate-600">Bộ môn: {projectData.supervisor?.department || 'CNTT'}</p>
                  <p className="text-xs text-slate-600">Email: {projectData.supervisor?.email || 'N/A'}</p>
                </div>

                <div className="utc-info-box utc-info-box-gvpb space-y-1">
                  <span className="text-xs text-slate-500 font-medium">Giảng viên phản biện (GVPB)</span>
                  <p className="text-base font-bold text-[#2D469E]">
                    {projectData.reviewer?.full_name || <span className="text-slate-400 italic">Đang phân bổ...</span>}
                  </p>
                  <p className="text-xs text-slate-600">Bộ môn: {projectData.reviewer?.department || 'Khoa CNTT'}</p>
                </div>

                <div className="utc-info-box utc-info-box-council space-y-1">
                  <span className="text-xs text-slate-500 font-medium">Hội đồng bảo vệ</span>
                  <p className="text-base font-bold text-amber-700">
                    {projectData.council_name || <span className="text-slate-400 italic">Chưa xếp hội đồng</span>}
                  </p>
                  <p className="text-xs text-slate-600">Phòng: {projectData.defense_room || 'TBA'}</p>
                  <p className="text-xs text-slate-600">Thời gian: {projectData.session_date || 'TBA'} ({projectData.session_time || ''})</p>
                </div>
              </div>

              <div className="utc-process-guide-box text-xs text-slate-700 space-y-2">
                <p className="font-bold text-[#2D469E]">Quy trình thực hiện Đồ án Tốt nghiệp chuẩn UTC:</p>
                <ol className="list-decimal pl-5 space-y-1 text-slate-400">
                  <li>Nộp và duyệt Đề cương chi tiết (Tuần 1 - 3).</li>
                  <li>Báo cáo tiến độ tuần thường xuyên cho GVHD (Tuần 1 - 15).</li>
                  <li>GVHD chấm sơ khảo và đánh giá đủ điều kiện bảo vệ.</li>
                  <li>GVPB chấm nhận xét độc lập và Hội đồng chấm bảo vệ trực tiếp.</li>
                </ol>
              </div>

              {/* Hướng Dẫn & Chuyển Tiếp Sang GĐ 2 và GĐ 3 */}
              <div className="utc-sub-card space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🚀</span>
                  <div>
                    <h4 className="font-bold text-sm text-slate-100">Hướng Dẫn & Bước Tiếp Theo Của Sinh Viên:</h4>
                    <p className="text-xs text-slate-400">Sinh viên có thể chủ động chuyển sang các giai đoạn sau để cập nhật khảo sát và đề cương:</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div
                    className="utc-step-nav-card"
                    onClick={() => handleSelectTab('survey')}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">Bước 1</span>
                        <span className="text-lg">📝</span>
                      </div>
                      <h5 className="font-bold text-slate-100 text-sm mb-1">Khảo Sát Nguyện Vọng & Doanh Nghiệp (GĐ 2)</h5>
                      <p className="text-xs text-slate-400 mb-3">
                        Cập nhật thông tin thực tập tốt nghiệp, nguyện vọng hướng đề tài và thông tin liên hệ.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="utc-btn self-start text-xs px-3.5 py-1.5 rounded-lg"
                      style={{ background: '#2D469E', color: '#ffffff', border: '1px solid #7290ec' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectTab('survey');
                      }}
                    >
                      Đến GĐ 2: Khảo Sát ➔
                    </button>
                  </div>

                  <div
                    className="utc-step-nav-card"
                    onClick={() => handleSelectTab('outline')}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Bước 2</span>
                        <span className="text-lg">📄</span>
                      </div>
                      <h5 className="font-bold text-slate-100 text-sm mb-1">Soạn Thảo Đề Tài & Ký Đề Cương (GĐ 3)</h5>
                      <p className="text-xs text-slate-400 mb-3">
                        Soạn thảo tiêu đề Việt/Anh, tải phiếu đề cương PDF chuẩn UTC và nộp bản scan có chữ ký GVHD.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="utc-btn self-start text-xs px-3.5 py-1.5 rounded-lg"
                      style={{ background: 'linear-gradient(135deg, #059669 0%, #047857 100%)', color: '#ffffff', border: '1px solid #34d399' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectTab('outline');
                      }}
                    >
                      Đến GĐ 3: Đề Cương ➔
                    </button>
                  </div>
                </div>
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
        <div className="utc-graduation-card space-y-6 max-w-3xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-blue-900/40 pb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-100">Phiếu Khảo sát Thực tập & Đăng ký Nguyện vọng ĐATN</h3>
              <p className="text-xs text-slate-400">Dữ liệu được dùng để phân GVHD tự động theo chỉ tiêu Quota và nguyện vọng chuyên môn</p>
            </div>
            {surveyData?.student && (
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2.5 py-1 rounded font-extrabold border ${
                  surveyData.student.degree_program === 'ENGINEER'
                    ? 'bg-purple-50 text-purple-800 border-purple-300'
                    : 'bg-[#EEF3FB] text-[#2D469E] border-[#B9D1F8]'
                }`}>
                  {surveyData.student.degree_program === 'ENGINEER' ? '⚙️ CT Kỹ sư (Engineer)' : '🎓 CT Cử nhân (Bachelor)'}
                </span>
                {surveyData.student.cpa !== undefined && (
                  <span className="utc-cpa-badge text-xs px-2.5 py-1 rounded font-mono font-bold">
                    CPA: <b>{surveyData.student.cpa}</b>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Phase 2: Engineer Degree Requirement Warning */}
          {surveyData?.student?.degree_program === 'ENGINEER' && (
            <div className="p-4 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 text-xs space-y-1">
              <div className="flex items-center gap-2 font-bold text-sm text-purple-950">
                <span>🛡️</span>
                <span>Ràng buộc học vị tối thiểu đối với Chương trình Kỹ sư:</span>
              </div>
              <p className="leading-relaxed text-slate-700">
                Theo quy định của Trường, sinh viên thuộc chương trình đào tạo <b>Kỹ sư</b> bắt buộc phải đăng ký Giảng viên hướng dẫn có học vị tối thiểu là <b>Tiến sĩ (TS, PGS, GS)</b>.
                Hệ thống đã gắn nhãn <span className="font-bold text-emerald-700">[TS / Đủ ĐK Kỹ sư]</span> ở danh sách giảng viên hợp lệ.
              </p>
            </div>
          )}

          {surveyData?.survey ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl utc-survey-submitted-box bg-emerald-50 border border-emerald-200 text-emerald-900">
                <div className="flex items-center gap-2">
                  <span className="utc-survey-check-icon">✓</span>
                  <h4 className="font-bold text-sm">Đã gửi danh sách nguyện vọng</h4>
                </div>
                <p className="text-xs mt-1.5 opacity-90">
                  Danh sách đã được ghi nhận và không thể gửi lại để tránh trùng dữ liệu.
                </p>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-200 utc-survey-table-wrap">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 text-slate-700">
                    <tr>
                      <th className="p-3 text-left w-20">Thứ tự</th>
                      <th className="p-3 text-left">Giảng viên nguyện vọng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[1, 2, 3].map((order) => (
                      <tr key={order} className="border-t border-slate-200">
                        <td className="p-3 font-bold text-sky-600 dark:text-sky-400">NV{order}</td>
                        <td className="p-3 font-medium">
                          {formatFullName(surveyData.survey[`preference_${order}_name`]) || 'Không đăng ký'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm p-4 rounded-xl bg-slate-50 border border-slate-200 utc-survey-meta-box">
                <div><span className="font-semibold text-slate-500">Hướng nghiên cứu:</span> <span className="font-medium text-slate-800">{surveyData.survey.topic_direction_name || '—'}</span></div>
                <div><span className="font-semibold text-slate-500">Thực tập:</span> <span className="font-medium text-slate-800">{surveyData.survey.is_interning ? surveyData.survey.company_name || 'Có' : 'Không'}</span></div>
                <div className="md:col-span-2"><span className="font-semibold text-slate-500">Đề tài dự kiến:</span> <span className="font-medium text-slate-800">{surveyData.survey.tentative_title || '—'}</span></div>
              </div>
            </div>
          ) : (
          <form onSubmit={handleSaveSurvey} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Số điện thoại liên hệ <span className="text-rose-500 font-bold">(*)</span>
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    placeholder="VD: 0912345678"
                    value={phone}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPhone(val);
                      if (phoneTouched) {
                        setPhoneError(validatePhoneNumber(val, true));
                      }
                    }}
                    onBlur={() => {
                      setPhoneTouched(true);
                      setPhoneError(validatePhoneNumber(phone, true));
                    }}
                    className={`utc-form-input w-full ${
                      phoneError
                        ? 'border-rose-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 bg-rose-50/20'
                        : phoneTouched && phone && !phoneError
                        ? 'border-emerald-500 focus:border-emerald-500 bg-emerald-50/10'
                        : ''
                    }`}
                  />
                  {phoneTouched && phone && !phoneError && (
                    <span className="absolute right-3 top-2.5 text-emerald-500 text-sm font-bold" title="Số điện thoại hợp lệ">✓</span>
                  )}
                </div>
                {phoneError ? (
                  <p className="mt-1 text-xs text-rose-500 font-medium flex items-center gap-1">
                    <span>⚠️</span> {phoneError}
                  </p>
                ) : (
                  <p className="mt-1 text-[11px] text-slate-400">
                    Gồm 10 chữ số di động (bắt đầu bằng 03, 05, 07, 08, 09)
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Email liên hệ <span className="text-rose-500 font-bold">(*)</span>
                </label>
                <div className="relative">
                  <input
                    type="email"
                    placeholder="VD: sinhvien@utc.edu.vn"
                    value={email}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEmail(val);
                      if (emailTouched) {
                        setEmailError(!isValidEmail(val) ? 'Email liên hệ không đúng định dạng' : undefined);
                      }
                    }}
                    onBlur={() => {
                      setEmailTouched(true);
                      setEmailError(!isValidEmail(email) ? 'Email liên hệ không đúng định dạng' : undefined);
                    }}
                    className={`utc-form-input w-full ${
                      emailError
                        ? 'border-rose-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 bg-rose-50/20'
                        : emailTouched && email && !emailError
                        ? 'border-emerald-500 focus:border-emerald-500 bg-emerald-50/10'
                        : ''
                    }`}
                  />
                  {emailTouched && email && !emailError && (
                    <span className="absolute right-3 top-2.5 text-emerald-500 text-sm font-bold" title="Email hợp lệ">✓</span>
                  )}
                </div>
                {emailError && (
                  <p className="mt-1 text-xs text-rose-500 font-medium flex items-center gap-1">
                    <span>⚠️</span> {emailError}
                  </p>
                )}
              </div>
            </div>

            <div className="utc-survey-intern-box space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isInterning}
                  onChange={(e) => setIsInterning(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 bg-white border-slate-300 focus:ring-0"
                />
                <span className="text-sm font-semibold intern-label">Hiện tại đang đi thực tập tại Doanh nghiệp / Công ty</span>
              </label>

              {isInterning && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Tên công ty / Doanh nghiệp đang thực tập (*)</label>
                  <input
                    type="text"
                    required={isInterning}
                    placeholder="VD: Viettel, FPT Software, VNPT, VNPAY, Sun Asterisk..."
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="utc-form-input"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Chọn Chuyên ngành / Hướng nghiên cứu
              </label>
              <select
                value={topicDirectionId}
                onChange={(e) => {
                  setTopicDirectionId(e.target.value);
                  setShowAllSupervisors(false);
                }}
                className="utc-form-select"
              >
                <option value="">-- Chọn chuyên ngành --</option>
                {surveyData?.topic_areas?.map((t: any) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Gợi ý giảng viên theo chuyên ngành đã chọn */}
            {selectedTopicArea && (
              <div className="utc-topic-suggestion-box space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-bold suggestion-title">
                      🎯 Giảng viên gợi ý cho chuyên ngành “{selectedTopicArea.name}”
                    </div>
                    <div className="text-[11px] text-slate-600 mt-0.5">
                      {topicMatchedSupervisors.length > 0
                        ? `Có ${topicMatchedSupervisors.length} giảng viên đăng ký chuyên ngành này — hệ thống sẽ ưu tiên đề xuất khi phân bổ GVHD.`
                        : 'Chưa có giảng viên nào đăng ký chuyên ngành này. Bạn có thể xem toàn bộ danh sách bên dưới.'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAllSupervisors((v) => !v)}
                    className="utc-btn-toggle-all-sv"
                  >
                    {showAllSupervisors
                      ? '✕ Chỉ xem GV đúng chuyên ngành'
                      : `👥 Xem tất cả GV (${allSupervisors.length})`}
                  </button>
                </div>

                {topicMatchedSupervisors.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {topicMatchedSupervisors.map((s: any) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setPreference1Id(String(s.id));
                          setPreference2Id((p2) => (String(p2) === String(s.id) ? '' : p2));
                          setPreference3Id((p3) => (String(p3) === String(s.id) ? '' : p3));
                        }}
                        title={`Chuyên ngành: ${(s.topic_areas || []).join(', ')}`}
                        className={`text-left px-2.5 py-1.5 rounded-lg border text-[11px] transition-colors shadow-sm ${
                          String(preference1Id) === String(s.id)
                            ? 'utc-matched-sv-selected'
                            : 'utc-matched-sv-item'
                        }`}
                      >
                        <span className="font-semibold">{s.full_name}</span>
                        <span className={`block text-[10px] ${String(preference1Id) === String(s.id) ? 'text-blue-100' : 'text-slate-500'}`}>
                          {(s.topic_areas || []).slice(0, 2).join(' · ')}
                          {s.is_eligible_for_engineer ? ' • Đủ ĐK Kỹ sư' : ''}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

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
                className="utc-form-select"
              >
                <option value="">-- Chọn GVHD Nguyện vọng 1 --</option>
                {displayedSupervisors.map((s: any) => (
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
                className="utc-form-select"
              >
                <option value="">-- Chọn GVHD Nguyện vọng 2 (Không bắt buộc) --</option>
                {displayedSupervisors.map((s: any) => (
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
                className="utc-form-select"
              >
                <option value="">-- Chọn GVHD Nguyện vọng 3 (Không bắt buộc) --</option>
                {displayedSupervisors.map((s: any) => (
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
                className="utc-form-textarea"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Tên đề tài dự kiến (nếu đã có)</label>
              <input
                type="text"
                placeholder="VD: Xây dựng hệ thống quản lý chuỗi cung ứng bằng Blockchain..."
                value={tentativeTitle}
                onChange={(e) => setTentativeTitle(e.target.value)}
                className="utc-form-input"
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
          )}
        </div>
      )}

      {/* Tab 3: Outline Submission (Single Official Flow) */}
      {activeTab === 'outline' && (
        <div className="utc-graduation-card space-y-6 w-full max-w-none">
          <div className="utc-card-header flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="utc-card-title flex items-center gap-2">
                <span>📄</span>
                <span>Nộp Đề Cương Đồ Án Tốt Nghiệp (Giai đoạn 3)</span>
              </h3>
              <p className="utc-card-subtitle mt-1">
                Quy trình thẩm định 2 cấp: Sinh viên nộp đề cương ➔ GVHD thẩm định & chốt duyệt ➔ Khoa phê duyệt chính thức ➔ Mở GĐ 4 (Báo cáo tuần)
              </p>
            </div>
            {projectData && (
              <button
                type="button"
                onClick={handleExportOutlinePdf}
                disabled={generatingOutlinePdf}
                className="utc-btn utc-btn-export-pdf text-xs font-semibold px-3.5 py-2 rounded-lg flex items-center gap-2 shrink-0 border border-blue-400/30 hover:border-blue-400 transition"
                title="Tải biểu mẫu đề cương chi tiết chuẩn UTC"
              >
                <span>📄</span>
                <span>{generatingOutlinePdf ? 'Đang xuất PDF...' : 'Tải Mẫu Đề Cương UTC (PDF)'}</span>
              </button>
            )}
          </div>

          {/* Banner hướng dẫn chuyển sang GĐ 4 khi đề cương đã được Khoa duyệt */}
          {projectData?.status === 'OUTLINE_APPROVED' && (
            <div
              className="p-4 rounded-xl border flex flex-wrap items-center justify-between gap-3 shadow-sm"
              style={{
                background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.15) 0%, rgba(4, 120, 87, 0.25) 100%)',
                borderColor: '#10b981',
              }}
            >
              <div className="flex-1 min-w-[260px]">
                <div className="flex items-center gap-2 font-bold text-sm text-emerald-300">
                  <span className="text-lg">🎉</span>
                  <span>Đề Cương ĐATN Đã Được Khoa Phê Duyệt Chính Thức</span>
                </div>
                <p className="text-xs text-emerald-100/80 mt-1 leading-relaxed">
                  Đề cương chi tiết của bạn đã hoàn tất xét duyệt. Giai đoạn 4 (Báo cáo tuần) đã sẵn sàng để bạn nộp tiến độ định kỳ!
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleSelectTab('weekly')}
                className="utc-btn px-4 py-2 rounded-lg text-xs font-bold text-white shadow-md hover:brightness-110 transition-all shrink-0"
                style={{
                  background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                  border: '1px solid #34d399',
                }}
              >
                Đến GĐ 4: Báo Cáo Tuần ➔
              </button>
            </div>
          )}

          {hasSubmittedOutline ? (
            <section className="utc-submitted-outline" aria-label="Đề cương đã nộp">
              <div className="utc-submitted-outline__header">
                <div className="utc-submitted-outline__success-icon" aria-hidden="true">✓</div>
                <div className="utc-submitted-outline__heading">
                  <span className="utc-submitted-outline__eyebrow">HỒ SƠ ĐÃ GỬI CHO GIẢNG VIÊN HƯỚNG DẪN</span>
                  <h4>Đề cương chi tiết đã gửi sang Giảng viên</h4>
                  <p>Hồ sơ đã được gửi đến Giảng viên hướng dẫn xem xét và chốt duyệt trước khi chuyển lên Khoa phê duyệt chính thức.</p>
                </div>
                <span className={`utc-submitted-outline__status ${projectData.status === 'OUTLINE_APPROVED' ? 'is-approved' : 'is-pending'}`}>
                  {projectData.status === 'OUTLINE_APPROVED'
                    ? '🎉 Khoa đã phê duyệt'
                    : submittedOutline?.verdict === 'APPROVED'
                    ? '🟢 GVHD đã duyệt · Chờ Khoa'
                    : submittedOutline?.verdict === 'REVISION_REQUIRED'
                    ? '⚠️ GVHD yêu cầu sửa lại'
                    : '🟡 Đã gửi GVHD · Chờ duyệt'}
                </span>
              </div>

              {/* Visual 3-Step Flow Tracker */}
              <div className="mt-3 mb-2 p-3 rounded-xl bg-slate-900/60 border border-blue-900/50 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold">✓</span>
                  <span className="font-semibold text-emerald-300">1. Sinh viên nộp đề cương</span>
                </div>
                <span className="text-slate-500 font-bold">➔</span>
                <div className="flex items-center gap-2">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    (submittedOutline?.verdict === 'APPROVED' || projectData.status === 'OUTLINE_APPROVED')
                      ? 'bg-emerald-500 text-white'
                      : 'bg-amber-500 text-slate-900 animate-pulse'
                  }`}>
                    {(submittedOutline?.verdict === 'APPROVED' || projectData.status === 'OUTLINE_APPROVED') ? '✓' : '2'}
                  </span>
                  <span className={`font-semibold ${
                    (submittedOutline?.verdict === 'APPROVED' || projectData.status === 'OUTLINE_APPROVED')
                      ? 'text-emerald-300'
                      : 'text-amber-300'
                  }`}>
                    2. GVHD duyệt & chốt
                  </span>
                </div>
                <span className="text-slate-500 font-bold">➔</span>
                <div className="flex items-center gap-2">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    projectData.status === 'OUTLINE_APPROVED'
                      ? 'bg-emerald-500 text-white'
                      : submittedOutline?.verdict === 'APPROVED'
                      ? 'bg-blue-500 text-white animate-pulse'
                      : 'bg-slate-700 text-slate-400'
                  }`}>
                    {projectData.status === 'OUTLINE_APPROVED' ? '✓' : '3'}
                  </span>
                  <span className={`font-semibold ${
                    projectData.status === 'OUTLINE_APPROVED'
                      ? 'text-emerald-300'
                      : submittedOutline?.verdict === 'APPROVED'
                      ? 'text-blue-300'
                      : 'text-slate-500'
                  }`}>
                    3. Khoa duyệt & Mở GĐ 4
                  </span>
                </div>
              </div>

              <div className="utc-submitted-outline__body">
                <div className="utc-submitted-outline__file-card">
                  <div className="utc-submitted-outline__pdf-icon">PDF</div>
                  <div className="utc-submitted-outline__file-info">
                    <strong>{submittedOutlineFileName}</strong>
                    <span>
                      {submittedOutlineUrl
                        ? 'Tệp đề cương chi tiết đã gửi Giảng viên'
                        : 'Hồ sơ đã được ghi nhận nhưng không có tệp PDF đính kèm'}
                    </span>
                  </div>
                  {submittedOutlineUrl && (
                    <div className="utc-submitted-outline__actions">
                      <button
                        type="button"
                        onClick={() => handleOpenViewer(submittedOutlineUrl, submittedOutlineFileName)}
                        className="utc-outline-action is-primary flex items-center gap-1.5"
                      >
                        <span>👁</span>
                        <span>Xem đề cương</span>
                      </button>
                      <button
                        type="button"
                        className="utc-outline-action"
                        onClick={() => apiService.downloadFile(submittedOutlineUrl, submittedOutlineFileName)}
                      >
                        ⬇ Tải xuống
                      </button>
                    </div>
                  )}
                </div>

                <div className="utc-submitted-outline__details">
                  <div>
                    <span>Tên đề tài tiếng Việt</span>
                    <strong>{projectData.topic_title_vi || outlineTitleVi || '—'}</strong>
                  </div>
                  <div>
                    <span>Tên đề tài tiếng Anh</span>
                    <strong>{projectData.topic_title_en || outlineTitleEn || 'Chưa cập nhật'}</strong>
                  </div>
                  <div>
                    <span>Thời gian nộp</span>
                    <strong>
                      {submittedOutline?.submitted_at
                        ? new Date(submittedOutline.submitted_at).toLocaleString('vi-VN')
                        : 'Đã ghi nhận trên hệ thống'}
                    </strong>
                  </div>
                  <div>
                    <span>Tiến trình phê duyệt</span>
                    <strong>
                      {projectData.status === 'OUTLINE_APPROVED'
                        ? '🎉 Cả 2 cấp hoàn tất: Khoa đã duyệt chính thức'
                        : submittedOutline?.verdict === 'APPROVED'
                        ? '🟢 Cấp 1 xong: GVHD đã duyệt & chốt ➔ Chờ Khoa'
                        : submittedOutline?.verdict === 'REVISION_REQUIRED'
                        ? '⚠️ Cấp 1: GVHD yêu cầu chỉnh sửa lại đề cương'
                        : '🟡 Cấp 1: Đã gửi GVHD ➔ Đang chờ GVHD xem xét & duyệt'}
                    </strong>
                  </div>
                </div>

                {submittedOutline?.comments && (
                  <div className="utc-submitted-outline__comment">
                    <span>Nhận xét của giảng viên</span>
                    <p>{submittedOutline.comments}</p>
                  </div>
                )}
              </div>
            </section>
          ) : (
            <div className="utc-sub-card space-y-4">
              <div className="border-b border-blue-900/40 pb-3">
                <h4 className="utc-sub-card-title font-bold text-sm">
                  {projectData?.status === 'OUTLINE_REVISION'
                    ? '⚠️ Cập nhật lại Đề cương theo yêu cầu chỉnh sửa của Giảng viên'
                    : 'Nộp Đề Cương ĐATN Cho Giảng Viên Hướng Dẫn'}
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Nhập tên đề tài chính thức và đính kèm file đề cương chi tiết (PDF) để nộp trực tiếp cho Giảng viên hướng dẫn.
                </p>
              </div>

              {/* Banner: GVHD yêu cầu sửa đề tài / đề cương */}
              {(projectData?.status === 'OUTLINE_REVISION' || projectData?.topic_review_status === 'REVISION_REQUIRED' || projectData?.outline_review?.verdict === 'REVISION_REQUIRED') && (
                <div className="utc-action-banner-revision space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🚨</span>
                    <span className="font-bold text-sm text-rose-950">Yêu Cầu Chỉnh Sửa Lại Đề Cương:</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white/80 border border-rose-200 text-rose-950 font-mono text-xs">
                    "{projectData?.outline_review?.comments || projectData?.topic_revision_notes || 'Cần điều chỉnh nội dung nghiên cứu theo góp ý của Giảng viên hướng dẫn'}"
                  </div>
                  <p className="text-rose-800 text-xs font-medium">
                    Vui lòng điều chỉnh lại tên đề tài hoặc tải lên tệp đề cương mới bên dưới và bấm <b>"Nộp Lại Đề Cương Cho GVHD"</b>.
                  </p>
                </div>
              )}

              <form onSubmit={handleSubmitOutline} className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Tên đề tài tiếng Việt (*)</label>
                  <input
                    type="text"
                    required
                    value={outlineTitleVi}
                    onChange={(e) => setOutlineTitleVi(e.target.value)}
                    placeholder="VD: Nghiên cứu xây dựng ứng dụng hỗ trợ phân luồng giao thông thông minh..."
                    className="utc-form-input text-xs"
                  />
                  <TopicSimilarityHint title={outlineTitleVi} projectId={projectData?.id} />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Tên đề tài tiếng Anh</label>
                  <input
                    type="text"
                    value={outlineTitleEn}
                    onChange={(e) => setOutlineTitleEn(e.target.value)}
                    placeholder="VD: Research and development of an intelligent traffic routing application..."
                    className="utc-form-input text-xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">File Đề cương PDF (Tối đa 25MB)</label>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setOutlineFile(e.target.files?.[0] || null)}
                    className="utc-form-input file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Định dạng chấp nhận: PDF (.pdf), dung lượng tối đa 25MB.</p>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={outlineSubmitting}
                    className="utc-btn utc-btn-topic-save"
                  >
                    <span>🚀</span>
                    <span>
                      {outlineSubmitting
                        ? 'Đang nộp đề cương...'
                        : projectData?.status === 'OUTLINE_REVISION'
                        ? 'Nộp Lại Đề Cương Cho GVHD'
                        : 'Nộp Đề Cương Cho Giảng Viên Duyệt'}
                    </span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Weekly Reports */}
      {activeTab === 'weekly' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Submit form */}
          <div className="lg:col-span-1 utc-graduation-card p-5 space-y-4">
            <div className="utc-card-header pb-3 mb-3">
              <h3 className="utc-card-title text-base">
                <span>📊</span>
                <span>Nộp Báo cáo Tuần</span>
              </h3>
            </div>
            <form onSubmit={handleSubmitWeeklyReport} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Chọn tuần (1 đến 15)</label>
                <select
                  value={selectedWeek}
                  onChange={(e) => setSelectedWeek(Number(e.target.value))}
                  className="utc-form-select"
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
                  className="utc-form-textarea"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Kế hoạch tuần tiếp theo</label>
                <textarea
                  rows={2}
                  placeholder="Kế hoạch thực hiện trong tuần tới..."
                  value={weekTasks}
                  onChange={(e) => setWeekTasks(e.target.value)}
                  className="utc-form-textarea"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Link GitHub / GitLab commit</label>
                <input
                  type="url"
                  placeholder="https://github.com/user/repo/commits"
                  value={weekGit}
                  onChange={(e) => setWeekGit(e.target.value)}
                  className="utc-form-input"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Đính kèm file (nếu có)</label>
                <input
                  type="file"
                  onChange={(e) => setWeekFile(e.target.files?.[0] || null)}
                  className="utc-form-input file:mr-2 file:py-0.5 file:px-2 file:rounded file:border-0 file:text-xs file:bg-blue-50 file:text-[#2D469E] file:font-semibold"
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
          <div className="lg:col-span-2 utc-graduation-card p-5 space-y-4">
            <div className="utc-card-header pb-3 mb-3">
              <h3 className="utc-card-title text-base">
                <span>🗓️</span>
                <span>Lịch sử Báo cáo & Nhận xét của GVHD</span>
              </h3>
            </div>
            {weeklyReports.length === 0 ? (
              <div className="utc-empty-grade-box my-4">
                <div className="utc-empty-grade-icon">📅</div>
                <h4 className="utc-empty-grade-title">Chưa có báo cáo tuần nào được nộp</h4>
                <p className="utc-empty-grade-desc">
                  Hãy nộp báo cáo định kỳ hàng tuần ở khung bên trái để Giảng viên hướng dẫn theo dõi tiến độ và ghi nhận điểm quá trình.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {weeklyReports.map((r) => (
                  <div key={r.id} className="utc-weekly-report-card space-y-2 text-xs">
                    <div className="flex items-center justify-between pb-2 border-b border-blue-900/30">
                      <span className="font-bold text-sm text-[#2D469E]">Tuần {r.week_number}</span>
                      <span className={`px-2.5 py-0.5 rounded font-semibold text-[11px] border ${
                        r.supervisor_rating === 'GOOD' ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold' :
                        r.supervisor_rating === 'ACCEPTABLE' ? 'bg-blue-50 text-blue-800 border-blue-300 font-bold' :
                        r.supervisor_rating === 'LATE' ? 'bg-amber-50 text-amber-800 border-amber-300 font-bold' :
                        r.supervisor_rating === 'UNSATISFACTORY' ? 'bg-rose-50 text-rose-800 border-rose-300 font-bold' :
                        'bg-slate-100 text-slate-700 border-slate-300'
                      }`}>
                        {r.supervisor_rating_display || r.supervisor_rating}
                      </span>
                    </div>

                    <p className="text-slate-200"><b>Nội dung:</b> {r.summary_content}</p>
                    {r.planned_tasks && <p className="text-slate-400"><b>Kế hoạch:</b> {r.planned_tasks}</p>}
                    {r.git_commit_link && (
                      <p className="text-slate-400">
                        <b>Git:</b>{' '}
                        <a href={safeExternalUrl(r.git_commit_link)} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">
                          {r.git_commit_link}
                        </a>
                      </p>
                    )}

                    {r.supervisor_feedback && (
                      <div className="mt-2 p-2.5 rounded-lg border text-slate-800" style={{ background: '#ecfdf5', borderColor: '#a7f3d0' }}>
                        <span className="font-bold text-emerald-700">Nhận xét GVHD:</span> {r.supervisor_feedback}
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
          <div className="utc-graduation-card space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="utc-card-title">
                  <span>📋</span> Ban Nhiệm Vụ Đồ Án (Task Board) & Tiến Độ Hoàn Thành
                </h3>
                <p className="utc-card-subtitle">
                  Theo dõi danh sách công việc được GVHD giao, đánh dấu hoàn thành và cập nhật kết quả thực hiện.
                </p>
              </div>

              {tasksData?.stats && (
                <div className="flex items-center gap-3">
                  <span className="utc-task-stat-badge total">
                    Tổng số: {tasksData.stats.total} việc
                  </span>
                  <span className="utc-task-stat-badge completed">
                    Đã xong: {tasksData.stats.completed}
                  </span>
                </div>
              )}
            </div>

            {/* Progress Bar */}
            {tasksData?.stats && (
              <div className="utc-task-progress-box space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="utc-task-progress-label">Tiến độ hoàn thành nhiệm vụ được giao</span>
                  <span className="utc-task-progress-value">
                    {tasksData.stats.completed} / {tasksData.stats.total} ({tasksData.stats.completion_rate}%)
                  </span>
                </div>
                <div className="utc-progress-track">
                  <div
                    className="utc-progress-fill"
                    style={{ width: `${tasksData.stats.completion_rate}%` }}
                  />
                </div>
              </div>
            )}

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-blue-900/40">
              <span className="utc-task-filter-label text-xs font-bold mr-1">Bộ lọc:</span>
              {[
                { key: 'ALL', label: 'Tất cả nhiệm vụ' },
                { key: 'TODO', label: 'Cần làm (Todo)' },
                { key: 'IN_PROGRESS', label: 'Đang thực hiện' },
                { key: 'COMPLETED', label: 'Đã hoàn thành' },
              ].map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setTaskFilter(f.key as any)}
                  className={`utc-filter-btn ${taskFilter === f.key ? 'active' : ''}`}
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
                    <div className="utc-empty-grade-box" style={{ padding: '32px 16px' }}>
                      <p className="utc-empty-grade-title">
                        {list.length === 0
                          ? 'Chưa có nhiệm vụ nào được giao từ Giảng viên hướng dẫn.'
                          : 'Không có nhiệm vụ nào phù hợp với bộ lọc hiện tại.'}
                      </p>
                    </div>
                  );
                }

                return filtered.map((task) => {
                  const todayStr = getTodayDateStr();
                  const isOverdue = task.due_date && !task.is_completed && task.due_date < todayStr;
                  return (
                    <div
                      key={task.id}
                      className={`utc-task-card ${task.is_completed ? 'completed' : ''}`}
                    >
                      <div className="flex items-start gap-3.5 flex-1">
                        {/* Interactive Checkbox */}
                        <div className="pt-0.5">
                          <input
                            type="checkbox"
                            checked={task.is_completed}
                            onChange={() => handleRequestTaskCompletion(task)}
                            disabled={task.is_completed}
                            className="w-5 h-5 rounded border-slate-300 text-[#2D469E] focus:ring-[#2D469E]/20 bg-white cursor-pointer accent-[#2D469E] disabled:cursor-default"
                            title={task.is_completed ? 'Nhiệm vụ đã hoàn thành' : 'Đánh dấu hoàn thành nhiệm vụ'}
                          />
                        </div>

                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`text-sm font-bold transition ${
                                task.is_completed ? 'line-through text-slate-400 font-normal' : 'text-slate-900'
                              }`}
                            >
                              {task.title}
                            </span>

                            {/* Priority Badge */}
                            <span
                              className={`text-[10px] font-bold px-2.5 py-0.5 rounded uppercase border ${
                                task.priority === 'URGENT'
                                  ? 'bg-rose-50 text-rose-700 border-rose-300'
                                  : task.priority === 'HIGH'
                                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                                  : task.priority === 'LOW'
                                  ? 'bg-slate-100 text-slate-700 border-slate-300'
                                  : 'bg-blue-50 text-blue-800 border-blue-300'
                              }`}
                            >
                              {task.priority_display || task.priority}
                            </span>

                            {/* Status Badge */}
                            {task.is_completed ? (
                              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300">
                                ✅ Hoàn thành
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-300">
                                {task.status_display || 'Cần làm'}
                              </span>
                            )}

                            {/* Phase 5: Task Review Verdict Badge */}
                            {task.review_verdict && task.review_verdict !== 'NOT_SUBMITTED' && (
                              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded border ${
                                task.review_verdict === 'ACCEPTED' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' :
                                task.review_verdict === 'REVISION_REQUIRED' ? 'bg-rose-50 text-rose-800 border-rose-300' :
                                'bg-amber-50 text-amber-800 border-amber-300'
                              }`}>
                                {task.review_verdict === 'ACCEPTED' ? '🎯 Đạt yêu cầu' :
                                 task.review_verdict === 'REVISION_REQUIRED' ? '⚠️ Yêu cầu sửa lại' :
                                 '⏳ Chờ GV đánh giá'}
                              </span>
                            )}
                          </div>

                          {task.description && (
                            <p className="text-xs text-slate-600 whitespace-pre-line leading-relaxed">{task.description}</p>
                          )}

                          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                            <span>
                              GV giao:{' '}
                              <b className="text-slate-800 font-semibold">{task.assigned_by_name || 'GVHD'}</b>
                            </span>
                            {task.due_date && (
                              <span className={isOverdue ? 'text-rose-600 font-bold' : 'text-slate-600'}>
                                ⏰ Hạn chót: <b>{formatDateVN(task.due_date)}</b> {isOverdue && '(Quá hạn)'}
                              </span>
                            )}
                            {task.completed_at && (
                              <span className="text-emerald-700 font-semibold">
                                Hoàn tất lúc: {new Date(task.completed_at).toLocaleDateString('vi-VN')}
                              </span>
                            )}
                          </div>

                          {/* Phase 5: Deliverable display */}
                          {(task.deliverable_file || task.deliverable_url) && (
                            <div className="utc-task-deliverable-box mt-2 p-2.5 rounded-lg border text-xs space-y-1">
                              <span className="utc-task-deliverable-title font-semibold">📦 Sản phẩm / Báo cáo kết quả:</span>
                              <div className="flex flex-wrap items-center gap-3">
                                {task.deliverable_file && (
                                  <a href={task.deliverable_file} target="_blank" rel="noreferrer" className="utc-task-deliverable-link">
                                    File đính kèm ↗
                                  </a>
                                )}
                                {task.deliverable_url && (
                                  <a href={safeExternalUrl(task.deliverable_url)} target="_blank" rel="noreferrer" className="utc-task-deliverable-link">
                                    Link sản phẩm (Git/Drive/Demo) ↗
                                  </a>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Phase 5: Supervisor review notes */}
                          {task.supervisor_review_notes && (
                            <div className={`utc-task-review-notes-box mt-2 p-2.5 rounded-lg border text-xs ${
                              task.review_verdict === 'REVISION_REQUIRED'
                                ? 'is-revision'
                                : 'is-accepted'
                            }`}>
                              <span className="font-semibold">
                                {task.review_verdict === 'REVISION_REQUIRED' ? '⚠️ Yêu cầu sửa từ GVHD:' : '💬 Nhận xét từ GVHD:'}
                              </span>{' '}
                              {task.supervisor_review_notes}
                            </div>
                          )}

                          {/* Student Notes Display */}
                          {task.student_notes && (
                            <div className="utc-task-notes-box mt-2 p-2.5 rounded-lg border text-xs">
                              <span className="utc-task-notes-title font-semibold">📝 Ghi chú SV:</span>{' '}
                              <span className="utc-task-notes-text">{task.student_notes}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-wrap items-center gap-2 self-end md:self-center">
                        {task.is_completed ? (
                          <div className="utc-task-completed-label">
                            <span>✓</span>
                            <div>
                              <strong>Đã hoàn thành</strong>
                              <small>Sản phẩm đã được nộp</small>
                            </div>
                          </div>
                        ) : (
                          <>
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
                          </>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {(() => {
              const history = (tasksData?.tasks || [])
                .flatMap((task: any) =>
                  (task.submission_history || []).map((entry: any) => ({ ...entry, task }))
                )
                .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

              if (history.length === 0) return null;

              const eventLabel: Record<string, string> = {
                SUBMITTED: 'Đã nộp sản phẩm',
                RESUBMITTED: 'Đã nộp lại sản phẩm',
                ACCEPTED: 'GVHD xác nhận đạt',
                REVISION_REQUIRED: 'GVHD yêu cầu sửa lại',
              };

              return (
                <div className="utc-task-history">
                  <div className="utc-task-history-header">
                    <div>
                      <h4>🕘 Lịch sử nộp & đánh giá nhiệm vụ</h4>
                      <p>Mọi lần nộp, nộp lại và phản hồi của GVHD đều được lưu tại đây.</p>
                    </div>
                    <span>{history.length} hoạt động</span>
                  </div>

                  <div className="utc-task-history-list">
                    {history.map((entry: any) => (
                      <div key={`${entry.task.id}-${entry.id}`} className={`utc-task-history-item event-${String(entry.event).toLowerCase()}`}>
                        <div className="utc-task-history-dot" />
                        <div className="utc-task-history-content">
                          <div className="utc-task-history-title-row">
                            <strong>{eventLabel[entry.event] || entry.description}</strong>
                            <time>{entry.created_at ? new Date(entry.created_at).toLocaleString('vi-VN') : ''}</time>
                          </div>
                          <div className="utc-task-history-task">Nhiệm vụ: <b>{entry.task.title}</b></div>
                          <div className="utc-task-history-meta">
                            Người thực hiện: <b>{entry.actor || 'Hệ thống'}</b>
                            {entry.is_late && <span className="utc-history-late">Nộp muộn</span>}
                          </div>
                          {entry.notes && <p className="utc-task-history-notes">“{entry.notes}”</p>}
                          {(entry.file_url || entry.deliverable_url) && (
                            <div className="utc-task-history-links">
                              {entry.file_url && <a href={safeExternalUrl(entry.file_url)} target="_blank" rel="noreferrer">📎 Xem file đã nộp</a>}
                              {entry.deliverable_url && <a href={safeExternalUrl(entry.deliverable_url)} target="_blank" rel="noreferrer">🔗 Mở link sản phẩm</a>}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Supervision Meeting Logs Section */}
          <div className="utc-graduation-card space-y-4">
            <div className="utc-card-header">
              <h3 className="utc-card-title">
                <span>🗓️</span>
                <span>Nhật Ký Hướng Dẫn Định Kỳ (Supervision Meeting Logs)</span>
              </h3>
              <p className="utc-card-subtitle">
                Biên bản ghi nhận các buổi làm việc định kỳ giữa Giảng viên hướng dẫn và Sinh viên.
              </p>
            </div>

            {meetingLogs.length === 0 ? (
              <div className="utc-empty-grade-box">
                <div className="utc-empty-grade-icon">🗓️</div>
                <h4 className="utc-empty-grade-title">Chưa có buổi họp / hướng dẫn nào được ghi nhận</h4>
                <p className="utc-empty-grade-desc">
                  Biên bản sẽ hiển thị tại đây sau các buổi trao đổi định kỳ trực tiếp hoặc trực tuyến giữa Giảng viên hướng dẫn và bạn.
                </p>
                <div className="utc-empty-grade-pill">
                  <span>⭐ Căn cứ đánh giá điểm quá trình ĐATN</span>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {meetingLogs.map((log, idx) => (
                  <div
                    key={log.id}
                    className="utc-meeting-log-card space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-900/40 pb-3">
                      <div className="flex items-center gap-3">
                        <span
                          className="w-7 h-7 rounded-full text-white flex items-center justify-center text-xs font-bold shadow-sm"
                          style={{ background: '#2D469E', border: '1px solid #7290ec' }}
                        >
                          #{meetingLogs.length - idx}
                        </span>
                        <div>
                          <span className="text-sm font-bold text-slate-900">Buổi hướng dẫn: {formatDateVN(log.meeting_date)}</span>
                          <span className="text-xs text-slate-500 ml-2">({log.meeting_time})</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300">
                          ⭐ Căn cứ điểm quá trình
                        </span>
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${
                            log.meeting_type === 'ONLINE'
                              ? 'bg-purple-50 text-purple-800 border-purple-200'
                              : 'bg-blue-50 text-blue-800 border-blue-200'
                          }`}
                        >
                          {log.meeting_type_display || (log.meeting_type === 'ONLINE' ? 'Trực tuyến' : 'Gặp trực tiếp')}
                        </span>
                        {log.location_or_link && (log.meeting_type === 'ONLINE' || log.location_or_link.startsWith('http')) ? (
                          <a
                            href={safeExternalUrl(log.location_or_link)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-white font-semibold text-xs transition shadow-sm"
                            style={{ background: '#2D469E', border: '1px solid #7290ec' }}
                            title="Bấm để tham gia phòng họp trực tuyến Google Meet / Zoom"
                          >
                            <span>📹</span>
                            <span>Tham gia cuộc họp trực tuyến (Google Meet / Zoom) ↗</span>
                          </a>
                        ) : log.location_or_link ? (
                          <span className="text-xs text-slate-600">
                            📍 Địa điểm: <b>{log.location_or_link}</b>
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div>
                        <span className="font-semibold text-slate-400">Nội dung trao đổi & tiến độ:</span>
                        <p className="utc-log-content-box mt-1 whitespace-pre-line p-3 rounded-lg border">
                          {log.content_discussed}
                        </p>
                      </div>

                      {log.supervisor_notes && (
                        <div>
                          <span className="font-semibold text-emerald-400">Góp ý & Nhận xét của GVHD:</span>
                          <p className="utc-log-notes-box mt-1 whitespace-pre-line p-3 rounded-lg border">
                            {log.supervisor_notes}
                          </p>
                        </div>
                      )}

                      {log.tasks && log.tasks.length > 0 && (
                        <div className="utc-log-tasks-box p-3 rounded-lg border space-y-1.5">
                          <span className="font-bold text-blue-400">📌 Nhiệm vụ GVHD giao tuần tới:</span>
                          {log.tasks.map((t: any) => (
                            <div key={t.id} className="flex items-center justify-between text-slate-300 pl-2">
                              <span>• <b>{t.title}</b> {t.due_date && <span className="text-slate-400">(Hạn nộp: {formatDateVN(t.due_date)})</span>}</span>
                              <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${t.is_completed ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-700 text-slate-300 border border-slate-600'}`}>
                                {t.is_completed ? '✅ Đã xong' : '⏳ Cần làm'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {log.next_meeting_plan && (
                        <div>
                          <span className="font-semibold text-amber-400">Kế hoạch kỳ tới:</span>
                          <p className="utc-log-plan-box mt-1 whitespace-pre-line p-2.5 rounded-lg border">
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

          {/* Tiện ích mở rộng: Quản lý phiên bản nộp bài & Đồng bộ lịch cá nhân */}
          {projectData?.id && (
            <div className="grid gap-6 lg:grid-cols-2">
              <SubmissionVersionsPanel projectId={projectData.id} canUpload />
              <CalendarSyncButtons />
            </div>
          )}
        </div>
      )}

      {/* Tab 6: Final Grade Summary */}
      {activeTab === 'grade' && (
        <div className="utc-graduation-card space-y-6 max-w-3xl">
          <div className="utc-card-header">
            <h3 className="utc-card-title">
              <span>🏆</span>
              <span>Bảng Điểm Tổng kết Đồ án Tốt nghiệp</span>
            </h3>
            <p className="utc-card-subtitle">
              Tính toán tự động theo Quy chế tín chỉ UTC (30% GVHD + 20% GVPB + 50% Hội đồng)
            </p>
          </div>

          {projectData?.final_grade ? (
            <div className="space-y-6">
              {/* Component Scores */}
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="utc-score-component-card">
                  <span className="utc-score-component-label">Điểm GVHD (30%)</span>
                  <p className="text-2xl font-bold text-emerald-600 mt-1">
                    {projectData.final_grade.supervisor_score !== null ? projectData.final_grade.supervisor_score : '-'}
                  </p>
                </div>
                <div className="utc-score-component-card">
                  <span className="utc-score-component-label">Điểm GVPB (20%)</span>
                  <p className="text-2xl font-bold text-[#2D469E] mt-1">
                    {projectData.final_grade.reviewer_score !== null ? projectData.final_grade.reviewer_score : '-'}
                  </p>
                </div>
                <div className="utc-score-component-card">
                  <span className="utc-score-component-label">Điểm Hội đồng (50%)</span>
                  <p className="text-2xl font-bold text-indigo-700 mt-1">
                    {projectData.final_grade.council_avg_score !== null ? projectData.final_grade.council_avg_score : '-'}
                  </p>
                </div>
              </div>

              {/* Total Final Score Card */}
              <div className="utc-final-score-banner">
                <div className="utc-final-score-main">
                  <span className="utc-final-score-eyebrow">
                    Điểm Tổng kết cuối cùng
                  </span>
                  <div className="utc-final-score-number-row">
                    <span className="utc-final-score-value">
                      {projectData.final_grade.final_score_10 !== null ? projectData.final_grade.final_score_10 : '-'}
                    </span>
                    <span className="utc-final-score-scale">/ 10</span>
                  </div>
                  <p className="utc-final-score-scale4">
                    Quy đổi Thang 4: <b>{projectData.final_grade.final_score_4 !== null ? projectData.final_grade.final_score_4 : '-'}</b>
                  </p>
                </div>

                <div className="utc-final-score-meta">
                  <div className="utc-final-score-letter">
                    {projectData.final_grade.final_letter_grade || '-'}
                  </div>
                  <p className="utc-final-score-rank">
                    Xếp loại: {projectData.final_grade.classification || 'Đang cập nhật'}
                  </p>
                  <div className="utc-final-score-status">
                    {projectData.final_grade.is_passed ? (
                      <span className="utc-final-status-badge is-passed">
                        ✅ ĐẠT YÊU CẦU
                      </span>
                    ) : (
                      <span className="utc-final-status-badge is-pending">
                        Đang bảo vệ
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Deferral Quick Action Banner in Tab 6 */}
              <div className="utc-deferral-quick-card flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl">
                <div>
                  <h4 className="text-sm font-bold text-slate-800">Đơn Xin Hoãn / Bảo Lưu Đồ Án Tốt Nghiệp</h4>
                  <p className="text-xs text-slate-500">Trường hợp chưa đủ điều kiện bảo vệ hoặc lý do học vụ cần bảo lưu kết quả sang đợt sau.</p>
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
            <div className="utc-empty-grade-box">
              <div className="utc-empty-grade-icon">📊</div>
              <h4 className="utc-empty-grade-title">Chưa có dữ liệu điểm tổng kết cho đồ án của bạn</h4>
              <p className="utc-empty-grade-desc">
                Điểm đánh giá sẽ hiển thị tại đây sau khi Giảng viên hướng dẫn, Cán bộ Phản biện và Hội đồng bảo vệ hoàn tất chấm điểm và khóa kết quả.
              </p>
              <div className="utc-empty-grade-pill">
                <span>⚡ Tỷ lệ tính điểm chuẩn UTC: 30% GVHD + 20% GVPB + 50% Hội đồng</span>
              </div>
            </div>
          )}
        </div>
      )}

      </fieldset>

      {/* Modal: Xác nhận hoàn tất nhiệm vụ */}
      {taskToComplete && (
        <div className="utc-modal-overlay" onClick={() => !confirmingTaskComplete && setTaskToComplete(null)}>
          <div className="utc-modal-card utc-task-complete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="utc-task-complete-modal-icon" aria-hidden="true">✓</div>
            <div className="utc-task-complete-modal-content">
              <span className="utc-task-complete-modal-eyebrow">XÁC NHẬN NHIỆM VỤ</span>
              <h3>Bạn đã hoàn thành nhiệm vụ này?</h3>
              <p className="utc-task-complete-modal-task">{taskToComplete.title}</p>
              <div className="utc-task-complete-modal-note">
                Sau khi xác nhận, nhiệm vụ sẽ được đánh dấu hoàn thành và chuyển vào bộ lọc <b>Đã hoàn thành</b>.
              </div>
            </div>
            <div className="utc-modal-footer utc-task-complete-modal-actions">
              <button
                type="button"
                className="utc-btn utc-btn-ghost"
                disabled={confirmingTaskComplete}
                onClick={() => setTaskToComplete(null)}
              >
                Hủy
              </button>
              <button
                type="button"
                className="utc-task-confirm-btn"
                disabled={confirmingTaskComplete}
                onClick={async () => {
                  try {
                    setConfirmingTaskComplete(true);
                    const completed = await handleToggleTaskComplete(taskToComplete);
                    if (completed) setTaskToComplete(null);
                  } finally {
                    setConfirmingTaskComplete(false);
                  }
                }}
              >
                <span>✓</span>
                {confirmingTaskComplete ? 'Đang xác nhận...' : 'Xác nhận hoàn tất'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Ghi chú & Nộp link kết quả nhiệm vụ của sinh viên */}
      {selectedTaskForNotes && (
        <div className="utc-modal-overlay">
          <div className="utc-modal-card" style={{ maxWidth: 480 }}>
            <div className="utc-modal-header">
              <div>
                <span className="text-xs text-[#2D469E] font-bold">Cập nhật tiến độ nhiệm vụ</span>
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">
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
                <label className="block text-slate-700 font-semibold mb-1">
                  Đính kèm File sản phẩm (Zip, PDF, Docs, tối đa 25MB):
                </label>
                <input
                  type="file"
                  onChange={(e) => setDeliverableFile(e.target.files?.[0] || null)}
                  className="w-full text-slate-700 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:bg-blue-50 file:text-[#2D469E] file:font-semibold"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
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
                <label className="block text-slate-700 font-semibold mb-1">
                  Ghi chú tóm tắt kết quả gửi Giảng viên (*):
                </label>
                <textarea
                  required
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
            <div className="utc-modal-header utc-deferral-modal-header">
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
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Lịch sử đơn đã nộp</h4>
              {deferralRequests.length === 0 ? (
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-500 text-xs text-center">
                  Bạn chưa gửi đơn xin bảo lưu nào trong đợt này.
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {deferralRequests.map((req) => (
                    <div key={req.id} className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800">
                          Lý do: {req.reason_category_display || req.reason_category}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          req.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' :
                          req.status === 'REJECTED' ? 'bg-rose-50 text-rose-800 border-rose-300' :
                          'bg-amber-50 text-amber-800 border-amber-300'
                        }`}>
                          {req.status_display || req.status}
                        </span>
                      </div>
                      <p className="text-slate-700 whitespace-pre-line">{req.reason_details}</p>
                      {req.evidence_file && (
                        <p>
                          <a href={req.evidence_file} target="_blank" rel="noreferrer" className="text-[#2D469E] underline font-bold hover:text-blue-900">
                            Xem minh chứng đính kèm ↗
                          </a>
                        </p>
                      )}
                      {req.faculty_review_notes && (
                        <div className="p-2.5 rounded bg-amber-50 border border-amber-200 text-amber-950">
                          <span className="font-bold text-amber-800">Ý kiến Khoa:</span> {req.faculty_review_notes}
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
                  accept=".pdf,.zip,.docx,.png,.jpg"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    // Khớp giới hạn của backend (validate_uploaded_file: tối đa 25MB) để báo lỗi ngay thay vì chờ upload.
                    if (file && file.size > 25 * 1024 * 1024) {
                      notify.warning('File minh chứng không được vượt quá 25MB.');
                      e.target.value = '';
                      setDeferralEvidenceFile(null);
                      return;
                    }
                    setDeferralEvidenceFile(file);
                  }}
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
      {/* Modal xem trước file Đề cương / Tài liệu */}
      <DocumentViewerModal
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
        title={viewerTitle}
        documentUrl={viewerUrl}
        documentType="Đề cương ĐATN"
      />
    </div>
  );
};
