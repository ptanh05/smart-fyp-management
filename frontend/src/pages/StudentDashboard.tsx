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
import UTCEvaluationSheetModal from '../components/UTCEvaluationSheetModal';
import { UTCStudentGraduationView } from '../components/UTCStudentGraduationView';
import { UTCSupervisorGroupChatView } from '../components/UTCSupervisorGroupChatView';
import { SkeletonProfile } from '../components/SkeletonLoader';
import {
  getProjectStageInfo,
  getProjectWorkflow,
  getStageInfo,
  resolveStageTab,
} from '../utils/graduationStages';
import './Dashboard.css';
import '../components/SkeletonLoader.css';
import '../components/StudentTemplatesView.css';

const StudentDashboard: React.FC = () => {
  const { t } = useTranslation();
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
          title: 'Tổng Quan Dashboard & Học Vụ',
          subtitle: 'Theo dõi tiến trình 5 bước UTC FYP Milestone, hồ sơ học vụ và lịch gặp GVHD',
          badge: 'Tổng quan',
        };
      case 'project':
      case 'utc_graduation':
        return {
          title: 'GĐ 1: Đề Tài & Giảng Viên Hướng Dẫn',
          subtitle: 'Thông tin chi tiết đề tài được phân công, trạng thái phê duyệt từ Khoa và điều kiện học vụ',
          badge: 'Giai đoạn 1',
        };
      case 'survey':
        return {
          title: 'GĐ 2: Khảo Sát Doanh Nghiệp & Nguyện Vọng Đề Tài',
          subtitle: 'Đăng ký 3 nguyện vọng GVHD, hướng nghiên cứu mong muốn và thông tin thực tập doanh nghiệp',
          badge: 'Giai đoạn 2',
        };
      case 'outline':
        return {
          title: 'GĐ 3: Đề Cương ĐATN & Nộp Bản Ký Duyệt',
          subtitle: 'Dự thảo đề tài song ngữ, xuất phiếu đề cương PDF chuẩn UTC và nộp bản scan có chữ ký GVHD',
          badge: 'Giai đoạn 3',
        };
      case 'weekly':
        return {
          title: 'GĐ 4: Báo Cáo Tiến Độ Tuần 1 - 15',
          subtitle: 'Nộp báo cáo định kỳ hàng tuần, đính kèm tài liệu, link GitHub và nhận xét đánh giá của GVHD',
          badge: 'Giai đoạn 4',
        };
      case 'supervision':
        return {
          title: 'GĐ 5: Task Board & Nhật Ký Hướng Dẫn',
          subtitle: 'Quản lý bảng nhiệm vụ Kanban do GVHD giao, nộp sản phẩm hoàn thành và xem biên bản các buổi họp',
          badge: 'Giai đoạn 5',
        };
      case 'grade':
        return {
          title: 'GĐ 6: Bảng Điểm Tổng Hợp & Đánh Giá Bảo Vệ UTC',
          subtitle: 'Điểm quá trình GVHD, Điểm phản biện, Điểm Hội đồng bảo vệ và đơn xin hoãn/bảo lưu ĐATN',
          badge: 'Giai đoạn 6',
        };
      case 'chat':
      case 'groups':
        return {
          title: 'Kênh Trao Đổi & Nhóm Đồ Án GVHD',
          subtitle: 'Kênh nhắn tin tức thời giữa Giảng viên hướng dẫn và các sinh viên trong nhóm đề tài',
          badge: 'Nhóm đồ án',
        };
      case 'templates':
        return {
          title: 'Biểu Mẫu Chuẩn & Quy Định ĐATN UTC',
          subtitle: 'Tải về và tra cứu các mẫu đơn, đề cương, nhật ký và báo cáo tốt nghiệp chuẩn Trường ĐHGTVT',
          badge: 'Biểu mẫu UTC',
        };
      default:
        return {
          title: 'Bảng Điều Khiển Sinh Viên UTC',
          subtitle: 'Cổng thông tin đồ án tốt nghiệp Trường Đại học Giao thông Vận tải',
          badge: 'Hệ thống',
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
                    MSSV: <strong>{profile?.registration_no || (student as any)?.registration_no || '---'}</strong>
                  </span>
                  {profile?.department && (
                    <span className="utc-header-meta">
                      | Khoa: <strong>{profile.department}</strong>
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
                  🔄 Tải Lại
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
              {/* UTC FYP Progress Timeline */}
              <UTCFypTimeline currentStep={profile?.timeline_step || 3} />

              {/* UTC Academic Batch & Project Quick Action Banner */}
              {profile?.academic_batch && (
                <div
                  className="card utc-batch-banner"
                  style={{
                    background: 'linear-gradient(135deg, #0a2540 0%, #004b87 100%)',
                    color: '#ffffff',
                    borderRadius: '12px',
                    padding: '24px',
                    marginBottom: '20px',
                    boxShadow: '0 8px 24px rgba(0, 43, 73, 0.25)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                    <div style={{ flex: '1 1 350px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                        <span style={{
                          background: '#38bdf8',
                          color: '#0f172a',
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          padding: '3px 10px',
                          borderRadius: '20px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          Đợt Đồ Án Chính Thức
                        </span>
                        <span style={{ fontSize: '0.85rem', color: '#93c5fd' }}>
                          Mã đợt: {profile.academic_batch.batch_code}
                        </span>
                      </div>
                      <h2 style={{ margin: '0 0 10px 0', fontSize: '1.35rem', fontWeight: 700, color: '#ffffff' }}>
                        {profile.academic_batch.batch_name}
                      </h2>

                      {profile.graduation_project ? (
                        <div style={{ background: 'rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '14px 16px', marginTop: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '6px' }}>
                            <span style={{ fontSize: '0.85rem', color: '#93c5fd' }}>
                              Đề tài được phân công:
                            </span>
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              {(profile.graduation_project.topic_review_status === 'APPROVED' || profile.graduation_project.status === 'TOPIC_APPROVED') && (
                                <span style={{ background: '#059669', color: '#fff', fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '12px' }}>
                                  ✅ Khoa đã duyệt đề tài
                                </span>
                              )}
                              {(profile.graduation_project.topic_review_status === 'REVISION_REQUIRED' || profile.graduation_project.status === 'TOPIC_REVISION') && (
                                <span style={{ background: '#dc2626', color: '#fff', fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '12px' }}>
                                  ⚠️ Khoa yêu cầu sửa đề tài
                                </span>
                              )}
                              {profile.graduation_project.initial_eligibility === 'FORCE_APPROVED' && (
                                <span style={{ background: '#d97706', color: '#fff', fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '12px' }}>
                                  ⚡ Đặc cách (Force Approve)
                                </span>
                              )}
                            </div>
                          </div>
                          <div style={{ fontSize: '1.05rem', fontWeight: 600, color: '#f8fafc', marginBottom: '8px' }}>
                            {profile.graduation_project.topic_title_vi}
                          </div>
                          {(profile.graduation_project.topic_review_status === 'REVISION_REQUIRED' || profile.graduation_project.status === 'TOPIC_REVISION') && (
                            <div style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '6px', padding: '8px 12px', marginBottom: '10px', fontSize: '0.85rem', color: '#fca5a5' }}>
                              <strong>Ý kiến nhận xét từ Khoa: </strong> {profile.graduation_project.topic_revision_notes || 'Cần chỉnh sửa lại đề tài theo góp ý'}
                            </div>
                          )}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', fontSize: '0.85rem', color: '#cbd5e1' }}>
                            <span>👨‍🏫 GVHD: <strong>{profile.graduation_project.supervisor_name || 'Đang phân công'}</strong></span>
                            <span>📊 Trạng thái: <strong style={{ color: '#34d399' }}>{profile.graduation_project.status_display || profile.graduation_project.status}</strong></span>
                          </div>
                        </div>
                      ) : (
                        <div style={{ background: 'rgba(234, 179, 8, 0.15)', border: '1px solid rgba(250, 204, 21, 0.3)', borderRadius: '8px', padding: '12px 16px', marginTop: '12px' }}>
                          <div style={{ color: '#fef08a', fontSize: '0.9rem', fontWeight: 500 }}>
                            ⚠️ Bạn đã được thêm vào đợt làm đồ án nhưng chưa được phân công Đề tài & GVHD. Hãy vào mục Khảo sát & Nguyện vọng để chọn GVHD mong muốn!
                          </div>
                        </div>
                      )}
                    </div>

                    <div style={{ alignSelf: 'center' }}>
                      <button
                        onClick={() => setActiveTab(currentStageInfo.key)}
                        style={{
                          background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                          color: '#ffffff',
                          border: '1px solid rgba(255, 255, 255, 0.25)',
                          padding: '12px 24px',
                          borderRadius: '10px',
                          fontSize: '0.92rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          boxShadow: '0 4px 14px rgba(2, 132, 199, 0.4)',
                          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = '0 6px 20px rgba(2, 132, 199, 0.55)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 4px 14px rgba(2, 132, 199, 0.4)';
                        }}
                      >
                        <span>{currentStageInfo.icon}</span>
                        <span>Vào GĐ {currentStageInfo.number}: {currentStageInfo.label}</span>
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
                      <span>Xem Phiếu Đánh Giá ĐATN Chuẩn UTC</span>
                      <span className="utc-unlocked-badge">✅ Đã công bố</span>
                    </button>
                  ) : (
                    <button
                      className="btn utc-btn-view-sheet-locked"
                      onClick={() => {
                        notify.warning(
                          `🔒 Phiếu Đánh Giá ĐATN Chuẩn UTC hiện đang khóa.\n\nBiểu mẫu đánh giá và bảng điểm chính thức chỉ được mở sau khi bạn hoàn thành Giai đoạn 6 (Hội đồng bảo vệ hoàn tất chấm điểm & công bố kết quả đồ án).\n\nHiện tại bạn đang ở GĐ ${currentStageInfo.number}: ${currentStageInfo.label}.`
                        );
                      }}
                      title={`Chưa mở: Cần hoàn tất chấm điểm và kết thúc Giai đoạn 6 (Bảo vệ đồ án) mới có thể xem phiếu đánh giá. Hiện tại bạn đang ở GĐ ${currentStageInfo.number}.`}
                    >
                      <span>🔒</span>
                      <span>Xem Phiếu Đánh Giá ĐATN Chuẩn UTC</span>
                      <span className="utc-locked-badge">Khóa đến hết GĐ 6</span>
                    </button>
                  )}
                </div>
                <div className="profile-info">
                  <p><strong>{t('profile.registration_no', 'Mã Sinh Viên (MSSV)')}:</strong> {profile?.registration_no}</p>
                  <p><strong>{t('profile.semester', 'Học Kỳ Đang Học')}:</strong> {profile?.semester ? `Kỳ ${profile.semester}` : 'Chưa có'}</p>
                  <p><strong>{t('profile.cgpa', 'Điểm Trung Bình Tích Lũy (GPA)')}:</strong> {(profile as any)?.cgpa || 'Chưa cập nhật'}</p>
                  <p><strong>{t('profile.department', 'Khoa / Viện Đào Tạo')}:</strong> {profile?.department || 'Khoa Công nghệ Thông tin - UTC'}</p>
                  <p>
                    <strong>Trạng thái học vụ đồ án:</strong>{' '}
                    {profile?.graduation_project?.initial_eligibility === 'INELIGIBLE' ? (
                      <span style={{ color: '#ef4444', fontWeight: 600 }}>
                        ❌ Không đủ điều kiện (Nợ $\ge$ 10 tín chỉ)
                      </span>
                    ) : (
                      <span style={{ color: '#10b981', fontWeight: 600 }}>
                        ✓ Đủ điều kiện làm đồ án tốt nghiệp
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Online Meeting Link & Supervision Schedule on Student Dashboard */}
              <div className="card" style={{ marginTop: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>🗓️</span> Lịch Hẹn Gặp & Họp Trực Tuyến Với GVHD
                  </h2>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={loadSupervisionLogs}
                    style={{ fontSize: '0.85rem' }}
                  >
                    🔄 Cập nhật
                  </button>
                </div>

                {supervisionLogsLoading ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '0.9rem' }}>
                    Đang tải lịch hẹn gặp từ giảng viên...
                  </div>
                ) : supervisionLogs.length === 0 ? (
                  <div className="utc-empty-meeting-box">
                    Chưa có lịch hẹn gặp trực tuyến hoặc buổi họp nào được lên lịch từ GVHD.
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
                                {isOnline ? '📹 TRỰC TUYẾN (MEET/ZOOM)' : '📍 GẶP TRỰC TIẾP'}
                              </span>
                              <span className="utc-meeting-time">
                                Ngày: {meeting.meeting_date} ({meeting.meeting_time})
                              </span>
                            </div>

                            {meeting.content_discussed && (
                              <p style={{ margin: '4px 0', fontSize: '0.88rem' }}>
                                <strong>Nội dung:</strong> {meeting.content_discussed}
                              </p>
                            )}

                            {meeting.supervisor_notes && (
                              <p style={{ margin: '4px 0', fontSize: '0.85rem', color: '#10b981' }}>
                                <strong>Nhận xét GV:</strong> {meeting.supervisor_notes}
                              </p>
                            )}

                            {!isOnline && meeting.location_or_link && (
                              <p style={{ margin: '4px 0', fontSize: '0.85rem' }}>
                                <strong>Địa điểm:</strong> {meeting.location_or_link}
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
                                title="Bấm vào để mở phòng họp trực tuyến"
                              >
                                <span>📹</span>
                                <span>Tham gia cuộc họp trực tuyến ↗</span>
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
            projectTitle: profile?.graduation_project?.topic_title_vi || 'Hệ thống Quản lý Đồ án Smart FYP UTC',
            facultyDepartment: profile?.department || 'Khoa Công nghệ Thông tin - UTC',
            student1Name: profile?.user ? formatFullName(profile.user) : 'Sinh viên UTC',
            student1RegNo: profile?.registration_no || '201200101',
            supervisorName: profile?.graduation_project?.supervisor_name || 'TS. Nguyễn Văn Minh',
            reviewerName: 'PGS.TS. Trần Thị Mai',
            committeeName: 'PGS.TS. Nguyễn Đức Thắng',
            supervisorScore: Number(
              (profile?.graduation_project as any)?.supervisor_score ??
              (profile?.graduation_project as any)?.final_grade?.supervisor_score ??
              (profile?.graduation_project as any)?.final_grade_summary?.supervisor_score ?? 0
            ),
            reviewerScore: Number(
              (profile?.graduation_project as any)?.reviewer_score ??
              (profile?.graduation_project as any)?.final_grade?.reviewer_score ??
              (profile?.graduation_project as any)?.final_grade_summary?.reviewer_score ?? 0
            ),
            committeeScore: Number(
              (profile?.graduation_project as any)?.council_score ??
              (profile?.graduation_project as any)?.committee_score ??
              (profile?.graduation_project as any)?.final_grade?.council_avg_score ??
              (profile?.graduation_project as any)?.final_grade_summary?.council_avg_score ?? 0
            ),
          }}
        />
      )}
    </UTCAppLayout>
  );
};

export default StudentDashboard;
