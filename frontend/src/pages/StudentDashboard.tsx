import { notify } from '../utils/notify';
import { formatFullName } from '../utils/nameHelper';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { apiService } from '../services/api';
import { safeExternalUrl } from '../utils/safeUrl';
import type { Student } from '../types';
import Navbar from '../components/Navbar';
import UTCAppLayout from '../components/UTCAppLayout';
import StudentTemplatesView from '../components/StudentTemplatesView';
import UTCFypTimeline from '../components/UTCFypTimeline';
import RoleHomeWidget from '../components/RoleHomeWidget';
import UTCEvaluationSheetModal from '../components/UTCEvaluationSheetModal';
import { UTCStudentGraduationView } from '../components/UTCStudentGraduationView';
import { UTCSupervisorGroupChatView } from '../components/UTCSupervisorGroupChatView';
import { SkeletonProfile } from '../components/SkeletonLoader';
import RagUtcChatWidget from '../components/RagUtcChatWidget';
import {
  GRADUATION_STAGES,
  getProjectStageInfo,
  getProjectWorkflow,
  getStageInfo,
  resolveStageTab,
} from '../utils/graduationStages';
import { getLocalizedStageText, isEnglish, tr } from '../utils/i18nHelper';
import './Dashboard.css';
import '../components/SkeletonLoader.css';
import '../components/StudentTemplatesView.css';

const StudentDashboard: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isEn = isEnglish(i18n?.resolvedLanguage || i18n?.language);
  const { user, logout } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const student = user as Student;
  const [activeTab, setActiveTab] = useState('overview');
  const [profile, setProfile] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUTCSheet, setShowUTCSheet] = useState(false);
  const [supervisionLogs, setSupervisionLogs] = useState<any[]>([]);
  const [supervisionLogsLoading, setSupervisionLogsLoading] = useState(false);

  // Giai đoạn hiện tại lấy từ `workflow` do backend tính (cùng nguồn với sidebar
  // và thanh tiến trình). Fallback trạng thái chỉ dùng khi API chưa trả workflow.
  const graduationProject = profile?.graduation_project || (student as any)?.graduation_project;
  const studentWorkflow =
    getProjectWorkflow((profile as any)?.workflow) || getProjectWorkflow(graduationProject);
  const currentStageInfo = studentWorkflow
    ? getStageInfo(studentWorkflow.current_stage_number)
    : getProjectStageInfo(graduationProject);
  const warnedRedirectRef = useRef<string | null>(null);

  /**
   * Chọn subtab giai đoạn hợp lệ: subtab hợp lệ được giữ khi reload; subtab trỏ
   * tới giai đoạn tương lai/bị khóa được chuyển về giai đoạn hiện tại kèm lý do,
   * và URL được sửa lại để URL ↔ UI luôn đồng bộ.
   */
  const applyGraduationSubtab = useCallback((requested: string, syncUrl: boolean) => {
    if (!profile) {
      // Hồ sơ chưa tải: trang đang hiển thị loading, sẽ kiểm tra lại khi có workflow.
      setActiveTab(requested);
      return requested;
    }
    const resolved = resolveStageTab(requested, studentWorkflow, currentStageInfo.number);
    setActiveTab(resolved.key);
    if (resolved.redirected) {
      if (resolved.reason && warnedRedirectRef.current !== requested) {
        warnedRedirectRef.current = requested;
        notify.warning(`Chưa thể mở giai đoạn này: ${resolved.reason} Đã chuyển về GĐ ${currentStageInfo.number}.`);
      }
      if (syncUrl) {
        setSearchParams((currentParams) => {
          const nextParams = new URLSearchParams(currentParams);
          nextParams.set('tab', 'utc_graduation');
          nextParams.set('subtab', resolved.key);
          return nextParams;
        }, { replace: true });
      }
    }
    return resolved.key;
  }, [profile, studentWorkflow, currentStageInfo.number, setSearchParams]);

  // Synchronize activeTab with URL search params and global notification events
  useEffect(() => {
    const tab = searchParams.get('tab');
    const subtab = searchParams.get('subtab');
    if (subtab && ['project', 'survey', 'outline', 'weekly', 'supervision', 'grade'].includes(subtab)) {
      applyGraduationSubtab(subtab, true);
    } else if (tab) {
      if (tab === 'utc_graduation') {
        setActiveTab(currentStageInfo.key);
      } else {
        setActiveTab(tab);
      }
    }

    const handleSwitchTab = (e: any) => {
      const targetTab = e.detail?.tab;
      if (targetTab) {
        if (targetTab === 'utc_graduation') {
          setActiveTab(currentStageInfo.key);
        } else {
          setActiveTab(targetTab);
        }
      }
    };

    const handleSwitchSubtab = (e: any) => {
      const targetSubtab = e.detail?.subtab;
      if (targetSubtab && ['project', 'survey', 'outline', 'weekly', 'supervision', 'grade'].includes(targetSubtab)) {
        applyGraduationSubtab(targetSubtab, false);
      }
    };

    window.addEventListener('app:switch-tab', handleSwitchTab);
    window.addEventListener('app:switch-subtab', handleSwitchSubtab);
    return () => {
      window.removeEventListener('app:switch-tab', handleSwitchTab);
      window.removeEventListener('app:switch-subtab', handleSwitchSubtab);
    };
  }, [searchParams, currentStageInfo.key, applyGraduationSubtab]);

  const loadSupervisionLogs = async () => {
    try {
      setSupervisionLogsLoading(true);
      const logs = await apiService.getStudentSupervisionLogs();
      setSupervisionLogs(Array.isArray(logs) ? logs : []);
    } catch (err) {
      console.warn('Failed to load supervision logs on student dashboard:', err);
    } finally {
      setSupervisionLogsLoading(false);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const profileData = await apiService.getStudentProfile();
      setProfile(profileData);
      loadSupervisionLogs();
    } catch (error) {
      console.error('Failed to load student profile:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  /**
   * Keep the selected dashboard tab and the URL in one place.  Previously the
   * graduation view changed only local state, while its URL-sync effect kept
   * reading the old `subtab` value and immediately switched the UI back.
   */
  const handleTabChange = useCallback((requestedTab: string) => {
    const graduationSubtabs = ['project', 'survey', 'outline', 'weekly', 'supervision', 'grade'];
    // Không cho chuyển sang giai đoạn bị khóa; URL ghi đúng tab thực sự hiển thị.
    const nextTab = graduationSubtabs.includes(requestedTab) && profile
      ? applyGraduationSubtab(requestedTab, false)
      : requestedTab;
    setActiveTab(nextTab);
    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams);

      if (graduationSubtabs.includes(nextTab)) {
        nextParams.set('tab', 'utc_graduation');
        nextParams.set('subtab', nextTab);
      } else {
        nextParams.set('tab', nextTab);
        nextParams.delete('subtab');
      }

      return nextParams;
    }, { replace: true });
  }, [setSearchParams, profile, applyGraduationSubtab]);

  // Reload overview data when switching back to overview
  useEffect(() => {
    if (activeTab === 'overview') {
      loadData();
    }
  }, [activeTab]);

  // Auto-sync when internet reconnects without reloading the page
  useEffect(() => {
    const handleOnlineSync = () => {
      loadData();
    };

    window.addEventListener('app:online-sync', handleOnlineSync);
    return () => {
      window.removeEventListener('app:online-sync', handleOnlineSync);
    };
  }, [activeTab]);

  if (loading || !student) {
    return (
      <div>
        <Navbar user={student} onLogout={logout} />
        <div className="container">
          <div className="dashboard-header">
            <h1>Student Dashboard</h1>
            <p>Loading your dashboard...</p>
          </div>
          <div className="card">
            <SkeletonProfile />
          </div>
        </div>
      </div>
    );
  }

  const graduationSubtabs = ['project', 'survey', 'outline', 'weekly', 'supervision', 'grade'];
  const isGraduationTab = graduationSubtabs.includes(activeTab) || activeTab === 'utc_graduation';

  const getTabHeaderInfo = (tab: string) => {
    switch (tab) {
      case 'overview':
        return {
          title: tr(isEn, 'Tổng Quan Dashboard & Học Vụ', 'Academic & Dashboard Overview'),
          subtitle: tr(
            isEn,
            'Theo dõi tiến trình 6 giai đoạn UTC FYP Milestone, hồ sơ học vụ và lịch gặp GVHD',
            'Track the 6-stage UTC FYP Milestone workflow, academic profile, and supervision meetings'
          ),
          badge: tr(isEn, 'Tổng quan', 'Overview'),
        };
      case 'project':
      case 'utc_graduation':
        return {
          title: tr(isEn, 'GĐ 1: Đề Tài & Giảng Viên Hướng Dẫn', 'Stage 1: Thesis Topic & Academic Supervisor'),
          subtitle: tr(
            isEn,
            'Thông tin chi tiết đề tài được phân công, trạng thái phê duyệt từ Khoa và điều kiện học vụ',
            'Detailed information on your assigned topic, Faculty approval status, and academic eligibility'
          ),
          badge: tr(isEn, 'Giai đoạn 1', 'Stage 1'),
        };
      case 'survey':
        return {
          title: tr(isEn, 'GĐ 2: Khảo Sát Doanh Nghiệp & Nguyện Vọng Đề Tài', 'Stage 2: Enterprise Survey & Supervisor Preferences'),
          subtitle: tr(
            isEn,
            'Đăng ký 3 nguyện vọng GVHD, hướng nghiên cứu mong muốn và thông tin thực tập doanh nghiệp',
            'Register 3 supervisor preferences, research direction, and enterprise internship information'
          ),
          badge: tr(isEn, 'Giai đoạn 2', 'Stage 2'),
        };
      case 'outline':
        return {
          title: tr(isEn, 'GĐ 3: Đề Cương ĐATN & Nộp Bản Ký Duyệt', 'Stage 3: Thesis Outline & Signed Submission'),
          subtitle: tr(
            isEn,
            'Dự thảo đề tài song ngữ, xuất phiếu đề cương PDF chuẩn UTC và nộp bản scan có chữ ký GVHD',
            'Draft bilingual topic outline, export official UTC PDF form, and upload supervisor-signed scan'
          ),
          badge: tr(isEn, 'Giai đoạn 3', 'Stage 3'),
        };
      case 'weekly':
        return {
          title: tr(isEn, 'GĐ 4: Nộp Bản Nháp Đồ Án', 'Stage 4: Thesis Draft Report Submission'),
          subtitle: tr(
            isEn,
            'Nộp và quản lý các phiên bản bản nháp báo cáo/quyển đồ án trước khi bước vào giai đoạn thực hiện',
            'Upload and manage draft thesis report versions prior to the execution stage'
          ),
          badge: tr(isEn, 'Giai đoạn 4', 'Stage 4'),
        };
      case 'supervision':
        return {
          title: tr(isEn, 'GĐ 5: Thực Hiện Đồ Án & Báo Cáo Tiến Độ', 'Stage 5: Thesis Execution & Progress Reports'),
          subtitle: tr(
            isEn,
            'Nhận task từ GVHD, nộp sản phẩm, báo cáo tiến độ tuần và theo dõi nhật ký hướng dẫn',
            'Receive tasks from your supervisor, submit deliverables, weekly progress reports, and supervision logs'
          ),
          badge: tr(isEn, 'Giai đoạn 5', 'Stage 5'),
        };
      case 'grade':
        return {
          title: tr(isEn, 'GĐ 6: Bảng Điểm Tổng Hợp & Đánh Giá Bảo Vệ UTC', 'Stage 6: Final Scoreboard & UTC Defense Evaluation'),
          subtitle: tr(
            isEn,
            'Điểm quá trình GVHD, Điểm phản biện, Điểm Hội đồng bảo vệ và đơn xin hoãn/bảo lưu ĐATN',
            'Supervisor score, Reviewer score, Defense Council grades, and thesis deferral requests'
          ),
          badge: tr(isEn, 'Giai đoạn 6', 'Stage 6'),
        };
      case 'chat':
      case 'groups':
        return {
          title: tr(isEn, 'Kênh Trao Đổi & Nhóm Đồ Án GVHD', 'Project Group & Supervisor Discussion Channel'),
          subtitle: tr(
            isEn,
            'Kênh nhắn tin tức thời giữa Giảng viên hướng dẫn và các sinh viên trong nhóm đề tài',
            'Instant messaging channel between your academic supervisor and students in the project group'
          ),
          badge: tr(isEn, 'Nhóm đồ án', 'Project Group'),
        };
      case 'templates':
        return {
          title: tr(isEn, 'Biểu Mẫu Chuẩn & Quy Định ĐATN UTC', 'Official UTC Thesis Templates & Guidelines'),
          subtitle: tr(
            isEn,
            'Tải về và tra cứu các mẫu đơn, đề cương, nhật ký và báo cáo tốt nghiệp chuẩn Trường ĐHGTVT',
            'Download and browse official UTC application forms, outlines, supervision logs, and thesis templates'
          ),
          badge: tr(isEn, 'Biểu mẫu UTC', 'UTC Templates'),
        };
      default:
        return {
          title: tr(isEn, 'Bảng Điều Khiển Sinh Viên UTC', 'UTC Student Dashboard'),
          subtitle: tr(
            isEn,
            'Cổng thông tin đồ án tốt nghiệp Trường Đại học Giao thông Vận tải',
            'University of Transport and Communications Graduation Thesis Portal'
          ),
          badge: tr(isEn, 'Hệ thống', 'System'),
        };
    }
  };

  // Chỉ mở Xem Phiếu Đánh Giá ĐATN Chuẩn UTC khi ĐÃ KẾT THÚC GIAI ĐOẠN 6 (Đã chấm điểm hoàn tất)
  const isPhase6Finished = (() => {
    const proj = profile?.graduation_project || (student as any)?.graduation_project;
    if (!proj) return false;

    // 1. Trạng thái đồ án đã hoàn tất bảo vệ / đóng đợt
    const completedStatuses = ['PASSED', 'FAILED', 'COMPLETED', 'CLOSED', 'ARCHIVED'];
    if (completedStatuses.includes(proj.status)) {
      return true;
    }

    // 2. Bảng điểm tổng hợp đã được khóa chính thức (is_finalized)
    const finalGrade = proj.final_grade || proj.final_grade_summary;
    if (finalGrade?.is_finalized) {
      return true;
    }

    // 3. Phải ở Giai đoạn 6 VÀ tất cả các đầu điểm (GVHD, Phản biện, Hội đồng) đều đã được nhập
    const stageNum = currentStageInfo.number;
    if (stageNum !== 6) {
      return false;
    }

    const hasSupervisorScore =
      proj.supervisor_score !== null &&
      proj.supervisor_score !== undefined &&
      proj.supervisor_score !== '';
    const hasReviewerScore =
      proj.reviewer_score !== null &&
      proj.reviewer_score !== undefined &&
      proj.reviewer_score !== '';
    const hasCouncilScore =
      (proj.council_score !== null && proj.council_score !== undefined && proj.council_score !== '') ||
      (proj.committee_score !== null && proj.committee_score !== undefined && proj.committee_score !== '') ||
      (finalGrade?.final_score_10 !== null && finalGrade?.final_score_10 !== undefined);

    return Boolean(hasSupervisorScore && hasReviewerScore && hasCouncilScore);
  })();

  return (
    <>
      <UTCAppLayout
      user={student}
      onLogout={logout}
      activeTab={activeTab}
      onTabChange={handleTabChange}
      currentStageNumber={currentStageInfo.number}
      selectedBatchId={profile?.academic_batch?.id || (profile as any)?.academic_batch_id || (student as any)?.academic_batch_id}
    >
      <div className="container">
        {/* Modern Executive Header Card (Left-sidebar first UI like Admin) */}
        {(() => {
          const tabInfo = getTabHeaderInfo(activeTab);
          return (
            <div className="utc-page-header-card">
              <div>
                <div className="utc-header-meta-row">
                  <span className="utc-header-badge">
                    {tabInfo.badge}
                  </span>
                  <span className="utc-header-meta">
                    {tr(isEn, 'MSSV:', 'Student ID:')} <strong>{profile?.registration_no || (student as any)?.registration_no || '---'}</strong>
                  </span>
                  {profile?.department && (
                    <span className="utc-header-meta">
                      | {tr(isEn, 'Khoa:', 'Faculty:')} <strong>{profile.department}</strong>
                    </span>
                  )}
                </div>
                <h1 className="utc-header-title">
                  {tabInfo.title}
                </h1>
                <p className="utc-header-subtitle">
                  {tabInfo.subtitle}
                </p>
              </div>

              {/* Action buttons on header */}
              <div className="utc-header-actions">
                <button
                  type="button"
                  className="utc-header-refresh-btn"
                  onClick={loadData}
                >
                  🔄 {tr(isEn, 'Tải Lại', 'Reload')}
                </button>
              </div>
            </div>
          );
        })()}

        <div className="tab-content">
          {isGraduationTab && (
            <UTCStudentGraduationView
              initialTab={(graduationSubtabs.includes(activeTab) ? activeTab : currentStageInfo.key) as any}
              onSubtabChange={handleTabChange}
              initialProjectData={profile?.graduation_project || (student as any)?.graduation_project}
            />
          )}

          {activeTab === 'overview' && (
            <>
              {/* Role Home Widget: Việc cần làm ngay & đếm ngược */}
              <RoleHomeWidget role="student" onNavigateTab={handleTabChange} />

              {/* UTC FYP Progress Timeline */}
              <UTCFypTimeline
                currentStep={currentStageInfo.number}
                onStageClick={(stageNum) => {
                  const st = GRADUATION_STAGES.find((item) => item.number === stageNum);
                  if (st) handleTabChange(st.key);
                }}
              />

              {/* UTC Academic Batch & Project Quick Action Banner */}
              {profile?.academic_batch && (
                <div className="card utc-batch-banner">
                  <div className="utc-batch-banner-inner">
                    <div className="utc-batch-banner-main">
                      <div className="utc-batch-banner-head">
                        <span className="utc-batch-banner-pill">
                          {tr(isEn, 'Đợt Đồ Án Chính Thức', 'Official Thesis Batch')}
                        </span>
                        <span className="utc-batch-banner-code">
                          {tr(isEn, 'Mã đợt:', 'Batch Code:')} <strong>{profile.academic_batch.batch_code}</strong>
                        </span>
                      </div>
                      <h2 className="utc-batch-banner-title">
                        {profile.academic_batch.batch_name}
                      </h2>

                      {profile.graduation_project ? (
                        <div className="utc-batch-banner-project-box">
                          <div className="utc-batch-banner-project-top">
                            <span className="utc-batch-banner-project-label">
                              {tr(isEn, 'Đề tài được phân công:', 'Assigned Topic:')}
                            </span>
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              {(profile.graduation_project.topic_review_status === 'APPROVED' || profile.graduation_project.status === 'TOPIC_APPROVED') && (
                                <span style={{ background: '#059669', color: '#fff', fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '12px' }}>
                                  ✅ {tr(isEn, 'Khoa đã duyệt đề tài', 'Faculty Approved Topic')}
                                </span>
                              )}
                              {(profile.graduation_project.topic_review_status === 'REVISION_REQUIRED' || profile.graduation_project.status === 'TOPIC_REVISION') && (
                                <span style={{ background: '#dc2626', color: '#fff', fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '12px' }}>
                                  ⚠️ {tr(isEn, 'Khoa yêu cầu sửa đề tài', 'Faculty Requested Revision')}
                                </span>
                              )}
                              {profile.graduation_project.initial_eligibility === 'FORCE_APPROVED' && (
                                <span style={{ background: '#d97706', color: '#fff', fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '12px' }}>
                                  ⚡ {tr(isEn, 'Đặc cách (Force Approve)', 'Force Approved')}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="utc-batch-banner-project-title">
                            {profile.graduation_project.topic_title_vi}
                          </div>
                          {(profile.graduation_project.topic_review_status === 'REVISION_REQUIRED' || profile.graduation_project.status === 'TOPIC_REVISION') && (
                            <div className="utc-batch-banner-revision-box">
                              <strong>{tr(isEn, 'Ý kiến nhận xét từ Khoa: ', 'Faculty Feedback: ')}</strong> {profile.graduation_project.topic_revision_notes || tr(isEn, 'Cần chỉnh sửa lại đề tài theo góp ý', 'Please revise the topic according to feedback')}
                            </div>
                          )}
                          <div className="utc-batch-banner-project-meta">
                            <span>👨‍🏫 {tr(isEn, 'GVHD:', 'Supervisor:')} <strong>{profile.graduation_project.supervisor_name || tr(isEn, 'Đang phân công', 'Allocating')}</strong></span>
                            <span>📊 {tr(isEn, 'Trạng thái:', 'Status:')} <strong className="utc-batch-banner-status">{profile.graduation_project.status_display || profile.graduation_project.status}</strong></span>
                          </div>
                        </div>
                      ) : (
                        <div className="utc-batch-banner-warning-box">
                          <div className="utc-batch-banner-warning-text">
                            {tr(
                              isEn,
                              '⚠️ Bạn đã được thêm vào đợt làm đồ án nhưng chưa được phân công Đề tài & GVHD. Hãy vào mục Khảo sát & Nguyện vọng để chọn GVHD mong muốn!',
                              '⚠️ You are enrolled in this thesis batch but have not been assigned a Topic & Supervisor yet. Please go to Preference Survey to submit your choices!'
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div style={{ alignSelf: 'center' }}>
                      <button
                        type="button"
                        className="utc-batch-banner-cta"
                        onClick={() => setActiveTab(currentStageInfo.key)}
                      >
                        <span>{currentStageInfo.icon}</span>
                        <span>
                          {(() => {
                            const locStage = getLocalizedStageText(currentStageInfo.number, currentStageInfo, isEn);
                            if (isEn) return `Open ${locStage.label}`;
                            return currentStageInfo.label.startsWith('GĐ ')
                              ? `Vào ${currentStageInfo.label}`
                              : `Vào GĐ ${currentStageInfo.number}: ${currentStageInfo.label}`;
                          })()}
                        </span>
                        <span>➔</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h2 style={{ margin: 0 }}>{t('profile.title', 'Thông Tin Cá Nhân & Hồ Sơ UTC')}</h2>
                  {isPhase6Finished ? (
                    <button
                      className="btn utc-btn-view-sheet"
                      onClick={() => setShowUTCSheet(true)}
                      title="Mở biểu mẫu biên bản đánh giá ĐATN UTC có chữ ký và điểm chi tiết"
                    >
                      <span>📄</span>
                      <span>{tr(isEn, 'Xem Phiếu Đánh Giá ĐATN Chuẩn UTC', 'View Official UTC Evaluation Sheet')}</span>
                      <span className="utc-unlocked-badge">✅ {tr(isEn, 'Đã công bố', 'Published')}</span>
                    </button>
                  ) : (
                    <button
                      className="btn utc-btn-view-sheet-locked"
                      onClick={() => {
                        notify.warning(
                          tr(
                            isEn,
                            `🔒 Phiếu Đánh Giá ĐATN Chuẩn UTC hiện đang khóa.\n\nBiểu mẫu đánh giá và bảng điểm chính thức chỉ được mở sau khi bạn hoàn thành Giai đoạn 6 (Hội đồng bảo vệ hoàn tất chấm điểm & công bố kết quả đồ án).\n\nHiện tại bạn đang ở GĐ ${currentStageInfo.number}: ${currentStageInfo.label}.`,
                            `🔒 The Official UTC Evaluation Sheet is currently locked.\n\nOfficial scores and evaluation minutes unlock only after Stage 6 is completed (Defense Committee finalizes and publishes grades).\n\nYou are currently at Stage ${currentStageInfo.number}.`
                          )
                        );
                      }}
                      title={tr(
                        isEn,
                        `Chưa mở: Cần hoàn tất chấm điểm và kết thúc Giai đoạn 6 (Bảo vệ đồ án) mới có thể xem phiếu đánh giá. Hiện tại bạn đang ở GĐ ${currentStageInfo.number}.`,
                        `Locked until Stage 6 defense grading is finalized. Currently at Stage ${currentStageInfo.number}.`
                      )}
                    >
                      <span>🔒</span>
                      <span>{tr(isEn, 'Xem Phiếu Đánh Giá ĐATN Chuẩn UTC', 'View Official UTC Evaluation Sheet')}</span>
                      <span className="utc-locked-badge">{tr(isEn, 'Khóa đến hết GĐ 6', 'Locked until Stage 6')}</span>
                    </button>
                  )}
                </div>
                <div className="profile-info">
                  <p><strong>{t('profile.regNo', tr(isEn, 'Mã Sinh Viên (MSSV)', 'Student Registration No'))}:</strong> {profile?.registration_no}</p>
                  <p><strong>{t('profile.semester', tr(isEn, 'Học Kỳ Đang Học', 'Current Semester'))}:</strong> {profile?.semester ? `${tr(isEn, 'Kỳ', 'Semester')} ${profile.semester}` : tr(isEn, 'Chưa có', 'N/A')}</p>
                  <p><strong>{tr(isEn, 'Điểm Trung Bình Tích Lũy (GPA)', 'Cumulative GPA')}:</strong> {(profile as any)?.cgpa || tr(isEn, 'Chưa cập nhật', 'Not updated')}</p>
                  <p><strong>{t('profile.department', tr(isEn, 'Khoa / Viện Đào Tạo', 'Faculty / Department'))}:</strong> {profile?.department || tr(isEn, 'Khoa Công nghệ Thông tin - UTC', 'Faculty of Information Technology - UTC')}</p>
                  <p>
                    <strong>{tr(isEn, 'Trạng thái học vụ đồ án:', 'Academic Eligibility:')}</strong>{' '}
                    {profile?.graduation_project?.initial_eligibility === 'INELIGIBLE' ? (
                      <span style={{ color: '#ef4444', fontWeight: 600 }}>
                        ❌ {tr(isEn, 'Không đủ điều kiện (Nợ ≥ 10 tín chỉ)', 'Ineligible (≥ 10 overdue credits)')}
                      </span>
                    ) : (
                      <span style={{ color: '#10b981', fontWeight: 600 }}>
                        ✓ {tr(isEn, 'Đủ điều kiện làm đồ án tốt nghiệp', 'Eligible for graduation thesis')}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Online Meeting Link & Supervision Schedule on Student Dashboard */}
              <div className="card" style={{ marginTop: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>🗓️</span> {tr(isEn, 'Lịch Hẹn Gặp & Họp Trực Tuyến Với GVHD', 'Supervision Meetings & Online Schedule')}
                  </h2>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={loadSupervisionLogs}
                    style={{ fontSize: '0.85rem' }}
                  >
                    🔄 {tr(isEn, 'Cập nhật', 'Refresh')}
                  </button>
                </div>

                {supervisionLogsLoading ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '0.9rem' }}>
                    {tr(isEn, 'Đang tải lịch hẹn gặp từ giảng viên...', 'Loading supervision schedule...')}
                  </div>
                ) : supervisionLogs.length === 0 ? (
                  <div className="utc-empty-meeting-box">
                    {tr(
                      isEn,
                      'Chưa có lịch hẹn gặp trực tuyến hoặc buổi họp nào được lên lịch từ GVHD.',
                      'No online or in-person supervision meetings have been scheduled by your supervisor yet.'
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {supervisionLogs.slice(0, 3).map((meeting: any) => {
                      const isOnline = meeting.meeting_type === 'ONLINE' || (meeting.location_or_link && meeting.location_or_link.startsWith('http'));
                      return (
                        <div
                          key={meeting.id}
                          className={`utc-meeting-item ${isOnline ? 'is-online' : 'is-offline'}`}
                        >
                          <div style={{ flex: '1 1 300px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                              <span className={`utc-meeting-type-badge ${isOnline ? 'badge-online' : ''}`}>
                                {isOnline ? tr(isEn, '📹 TRỰC TUYẾN (MEET/ZOOM)', '📹 ONLINE (MEET/ZOOM)') : tr(isEn, '📍 GẶP TRỰC TIẾP', '📍 IN-PERSON')}
                              </span>
                              <span className="utc-meeting-time">
                                {tr(isEn, 'Ngày:', 'Date:')} {meeting.meeting_date} ({meeting.meeting_time})
                              </span>
                            </div>

                            {meeting.content_discussed && (
                              <p style={{ margin: '4px 0', fontSize: '0.88rem' }}>
                                <strong>{tr(isEn, 'Nội dung:', 'Agenda:')}</strong> {meeting.content_discussed}
                              </p>
                            )}

                            {meeting.supervisor_notes && (
                              <p style={{ margin: '4px 0', fontSize: '0.85rem', color: '#10b981' }}>
                                <strong>{tr(isEn, 'Nhận xét GV:', 'Supervisor Notes:')}</strong> {meeting.supervisor_notes}
                              </p>
                            )}

                            {!isOnline && meeting.location_or_link && (
                              <p style={{ margin: '4px 0', fontSize: '0.85rem' }}>
                                <strong>{tr(isEn, 'Địa điểm:', 'Location:')}</strong> {meeting.location_or_link}
                              </p>
                            )}
                          </div>

                          {isOnline && meeting.location_or_link && (
                            <div>
                              <a
                                href={safeExternalUrl(meeting.location_or_link)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-primary"
                                style={{
                                  backgroundColor: '#0284c7',
                                  color: '#fff',
                                  fontWeight: 600,
                                  fontSize: '0.85rem',
                                  padding: '8px 16px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  textDecoration: 'none',
                                  borderRadius: '6px',
                                  boxShadow: '0 2px 4px rgba(2, 132, 199, 0.25)',
                                }}
                                title={tr(isEn, 'Bấm vào để mở phòng họp trực tuyến', 'Click to open online meeting room')}
                              >
                                <span>📹</span>
                                <span>{tr(isEn, 'Tham gia cuộc họp trực tuyến ↗', 'Join Online Meeting ↗')}</span>
                              </a>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {(activeTab === 'chat' || activeTab === 'groups') && (
            <UTCSupervisorGroupChatView currentStudent={profile} />
          )}

          {activeTab === 'templates' && (
            <StudentTemplatesView studentSemester={profile?.semester || undefined} />
          )}
        </div>
      </div>

      {isPhase6Finished && (
        <UTCEvaluationSheetModal
          isOpen={showUTCSheet}
          onClose={() => setShowUTCSheet(false)}
          groupData={{
            groupId: profile?.graduation_project?.id || profile?.id || 1,
            projectTitle: profile?.graduation_project?.topic_title_vi || 'Đồ án Tốt nghiệp UTC',
            facultyDepartment: profile?.department || 'Khoa Công nghệ Thông tin - UTC',
            student1Name: profile?.user ? formatFullName(profile.user) : 'Sinh viên UTC',
            student1RegNo: profile?.registration_no || '',
            supervisorName: (() => {
              const title = (profile?.graduation_project as any)?.supervisor_academic_title || '';
              const name = profile?.graduation_project?.supervisor_name || '';
              return name ? `${title} ${name}`.trim() : undefined;
            })(),
            reviewerName: (profile?.graduation_project as any)?.reviewer_name || undefined,
            committeeName:
              (profile?.graduation_project as any)?.council_chair_name ||
              (profile?.graduation_project as any)?.council_name ||
              undefined,
            supervisorScore:
              (profile?.graduation_project as any)?.supervisor_score ??
              (profile?.graduation_project as any)?.final_grade?.supervisor_score ??
              (profile?.graduation_project as any)?.final_grade_summary?.supervisor_score ??
              null,
            reviewerScore:
              (profile?.graduation_project as any)?.reviewer_score ??
              (profile?.graduation_project as any)?.final_grade?.reviewer_score ??
              (profile?.graduation_project as any)?.final_grade_summary?.reviewer_score ??
              null,
            committeeScore:
              (profile?.graduation_project as any)?.council_score ??
              (profile?.graduation_project as any)?.committee_score ??
              (profile?.graduation_project as any)?.final_grade?.council_avg_score ??
              (profile?.graduation_project as any)?.final_grade_summary?.council_avg_score ??
              null,
            finalScore10:
              (profile?.graduation_project as any)?.final_grade?.final_score_10 ??
              (profile?.graduation_project as any)?.final_grade_summary?.final_score_10 ??
              null,
            gpa4:
              (profile?.graduation_project as any)?.final_grade?.final_score_4 ??
              (profile?.graduation_project as any)?.final_grade_summary?.final_score_4 ??
              null,
            letterGrade:
              (profile?.graduation_project as any)?.final_grade?.final_letter_grade ??
              (profile?.graduation_project as any)?.final_grade_summary?.final_letter_grade ??
              null,
            classification:
              (profile?.graduation_project as any)?.final_grade?.classification ??
              (profile?.graduation_project as any)?.final_grade_summary?.classification ??
              null,
            isPass:
              (profile?.graduation_project as any)?.final_grade?.is_passed ??
              (profile?.graduation_project as any)?.final_grade_summary?.is_passed ??
              null,
          }}
        />
      )}
      </UTCAppLayout>
      <RagUtcChatWidget />
    </>
  );
};

export default StudentDashboard;
