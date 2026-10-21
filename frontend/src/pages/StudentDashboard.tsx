import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { apiService } from '../services/api';
import type { Student, Project, ProjectCategory, SupervisorOfStudentGroup, ExternalEvaluation } from '../types';
import Navbar from '../components/Navbar';
import UTCAppLayout from '../components/UTCAppLayout';
import ProjectModal from '../components/ProjectModal';
import SupervisorRequestModal from '../components/SupervisorRequestModal';
import DocumentsList from '../components/DocumentsList';
import SupervisorRequestsList from '../components/SupervisorRequestsList';
import CommentsSection from '../components/CommentsSection';
import SearchFilter from '../components/SearchFilter';
import ExternalEvaluationView from '../components/ExternalEvaluationView';
import StudentTemplatesView from '../components/StudentTemplatesView';
import CommitteeOfferedProjects from '../components/CommitteeOfferedProjects';
import UTCFypTimeline from '../components/UTCFypTimeline';
import UTCEvaluationSheetModal from '../components/UTCEvaluationSheetModal';
import { UTCStudentGraduationView } from '../components/UTCStudentGraduationView';
import { UTCSupervisorGroupChatView } from '../components/UTCSupervisorGroupChatView';
import { SkeletonProfile, SkeletonCardGrid } from '../components/SkeletonLoader';
import CopyButton from '../components/CopyButton';
import { getProjectStageInfo } from '../utils/graduationStages';
import './Dashboard.css';
import '../components/SkeletonLoader.css';
import '../components/CommentsSection.css';
import '../components/SearchFilter.css';
import '../components/ExternalEvaluationView.css';
import '../components/StudentTemplatesView.css';
import '../components/CommitteeOfferedProjects.css';

const StudentDashboard: React.FC = () => {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const [searchParams] = useSearchParams();
  const student = user as Student;
  const [activeTab, setActiveTab] = useState('overview');
  const [profile, setProfile] = useState<Student | null>(null);

  // Synchronize activeTab with URL search params and global notification events
  useEffect(() => {
    const tab = searchParams.get('tab');
    const subtab = searchParams.get('subtab');
    if (subtab && ['project', 'survey', 'outline', 'weekly', 'supervision', 'grade'].includes(subtab)) {
      setActiveTab(subtab);
    } else if (tab) {
      if (tab === 'utc_graduation') {
        const curStage = getProjectStageInfo(profile?.graduation_project);
        setActiveTab(curStage.key);
      } else {
        setActiveTab(tab);
      }
    }

    const handleSwitchTab = (e: any) => {
      const targetTab = e.detail?.tab;
      if (targetTab) {
        if (targetTab === 'utc_graduation') {
          const curStage = getProjectStageInfo(profile?.graduation_project);
          setActiveTab(curStage.key);
        } else {
          setActiveTab(targetTab);
        }
      }
    };

    const handleSwitchSubtab = (e: any) => {
      const targetSubtab = e.detail?.subtab;
      if (targetSubtab && ['project', 'survey', 'outline', 'weekly', 'supervision', 'grade'].includes(targetSubtab)) {
        setActiveTab(targetSubtab);
      }
    };

    window.addEventListener('app:switch-tab', handleSwitchTab);
    window.addEventListener('app:switch-subtab', handleSwitchSubtab);
    return () => {
      window.removeEventListener('app:switch-tab', handleSwitchTab);
      window.removeEventListener('app:switch-subtab', handleSwitchSubtab);
    };
  }, [searchParams, profile?.graduation_project]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectCategories, setProjectCategories] = useState<ProjectCategory[]>([]);
  const [supervisorRequests, setSupervisorRequests] = useState<SupervisorOfStudentGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showSupervisorModal, setShowSupervisorModal] = useState(false);
  const [projectSearch, setProjectSearch] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('');
  const [externalEvaluation, setExternalEvaluation] = useState<ExternalEvaluation | null>(null);
  const [externalLoading, setExternalLoading] = useState(false);
  const [selectedProjectForSupervisor, setSelectedProjectForSupervisor] = useState<Project | null>(null);
  const [showUTCSheet, setShowUTCSheet] = useState(false);
  const [supervisionLogs, setSupervisionLogs] = useState<any[]>([]);
  const [supervisionLogsLoading, setSupervisionLogsLoading] = useState(false);

  const handleProjectSearch = useCallback((search: string) => {
    setProjectSearch(search);
    loadProjects(search);
  }, []);

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

  useEffect(() => {
    loadData();
  }, []);

  // Reload overview data when switching back to overview
  useEffect(() => {
    if (activeTab === 'overview') {
      loadData();
    }
  }, [activeTab]);

  // Reload projects when project tab is clicked
  useEffect(() => {
    if (activeTab === 'project' && profile?.groupmate_id) {
      loadProjects();
    }
  }, [activeTab, profile?.groupmate_id]);

  // Reload supervisor requests when supervisor/documents/chat tabs are clicked
  useEffect(() => {
    if ((activeTab === 'supervisor' || activeTab === 'documents' || activeTab === 'chat') && profile?.groupmate_id) {
      loadSupervisorRequests();
    }
  }, [activeTab, profile?.groupmate_id]);

  // Load external evaluation when external tab is clicked (8th semester only)
  useEffect(() => {
    if (activeTab === 'external' && profile?.semester === '8') {
      loadExternalEvaluation();
    }
  }, [activeTab, profile?.semester]);

  // Auto-sync when internet reconnects without reloading the page
  useEffect(() => {
    const handleOnlineSync = () => {
      loadData();
      if (activeTab === 'project') loadProjects();
      if (activeTab === 'supervisor' || activeTab === 'documents' || activeTab === 'chat') loadSupervisorRequests();
    };

    window.addEventListener('app:online-sync', handleOnlineSync);
    return () => {
      window.removeEventListener('app:online-sync', handleOnlineSync);
    };
  }, [activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);
      // Load independently so a failing auxiliary endpoint (e.g. categories)
      // can never block the student profile / current-stage detection.
      const [profileResult, categoriesResult] = await Promise.allSettled([
        apiService.getStudentProfile(),
        apiService.getProjectCategories(),
      ]);

      let profileData: Student | null = null;
      if (profileResult.status === 'fulfilled') {
        profileData = profileResult.value;
        setProfile(profileData);
      } else {
        console.error('Failed to load student profile:', profileResult.reason);
      }

      if (categoriesResult.status === 'fulfilled') {
        const categoriesData = categoriesResult.value;
        setProjectCategories(Array.isArray(categoriesData) ? categoriesData : (categoriesData as any).results || []);
      } else {
        console.error('Failed to load project categories:', categoriesResult.reason);
        setProjectCategories([]);
      }

      // Load supervision meetings for dashboard display (Features 3 & 4)
      loadSupervisionLogs();

      if (profileData?.groupmate_id) {
        const supervisorRequestsData = await apiService.getSupervisorRequests();
        setSupervisorRequests(supervisorRequestsData.results || []);
        // Load projects separately
        await loadProjects();
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProjects = async (search?: string) => {
    try {
      setProjectsLoading(true);
      const projectsData = await apiService.getProjects({ search, mineOnly: true });
      setProjects(projectsData || []);
    } catch (error) {
      console.error('Failed to load projects:', error);
      setProjects([]);
    } finally {
      setProjectsLoading(false);
    }
  };

  const loadSupervisorRequests = async () => {
    try {
      const requestsData = await apiService.getSupervisorRequests();
      setSupervisorRequests(requestsData.results || []);
    } catch (error) {
      console.error('Failed to load supervisor requests:', error);
      setSupervisorRequests([]);
    }
  };

  const loadExternalEvaluation = async () => {
    try {
      setExternalLoading(true);
      const evaluation = await apiService.getStudentExternalEvaluation();
      setExternalEvaluation(evaluation);
    } catch (error) {
      console.error('Failed to load external evaluation:', error);
      setExternalEvaluation(null);
    } finally {
      setExternalLoading(false);
    }
  };

  const handleCancelSupervisorRequest = async (requestId: number) => {
    const confirmed = window.confirm('Are you sure you want to cancel this supervisor request? This action cannot be undone.');
    if (!confirmed) return;

    try {
      await apiService.updateSupervisorRequest(requestId, { status: 'canceled' });
      await loadSupervisorRequests(); // Reload supervisor requests
      alert('Supervisor request canceled successfully.');
    } catch (error) {
      console.error('Failed to cancel supervisor request:', error);
      alert('Failed to cancel supervisor request. Please try again.');
    }
  };

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
          title: 'Nhóm Đồ Án & Kênh Chat Trực Tiếp GVHD',
          subtitle: 'Kênh trao đổi chuyên môn trực tiếp giữa Giảng viên hướng dẫn và các sinh viên cùng nhóm GVHD',
          badge: 'Trao đổi',
        };
      case 'templates':
        return {
          title: 'Kho Biểu Mẫu Chuẩn & Quy Định ĐATN UTC',
          subtitle: 'Tải về toàn bộ biểu mẫu chuẩn, mẫu báo cáo, slide bảo vệ và quy chế đồ án tốt nghiệp UTC',
          badge: 'Tài nguyên',
        };
      case 'external':
        return {
          title: 'Hội Đồng Đánh Giá & Điểm Phản Biện ĐATN',
          subtitle: 'Thông tin phân bổ hội đồng chấm bảo vệ và kết quả đánh giá phản biện độc lập kỳ 8',
          badge: 'Hội đồng',
        };
      default:
        return {
          title: 'Bảng Điều Khiển Sinh Viên UTC',
          subtitle: 'Cổng thông tin đồ án tốt nghiệp Trường Đại học Giao thông Vận tải',
          badge: 'Hệ thống',
        };
    }
  };

  const currentStageInfo = getProjectStageInfo(profile?.graduation_project || (student as any)?.graduation_project);

  return (
    <UTCAppLayout
      user={student}
      onLogout={logout}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      currentStageNumber={currentStageInfo.number}
    >
      <div className="container">
        {/* Modern Executive Header Card (Left-sidebar first UI like Admin) */}
        {(() => {
          const tabInfo = getTabHeaderInfo(activeTab);
          return (
            <div
              className="utc-page-header-card"
              style={{
                background: '#ffffff',
                borderRadius: '12px',
                padding: '18px 24px',
                marginBottom: '20px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 2px 8px rgba(0, 43, 73, 0.04)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: '#e0f2fe',
                      color: '#0369a1',
                    }}
                  >
                    {tabInfo.badge}
                  </span>
                  <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                    MSSV: <strong>{profile?.registration_no || student?.user?.username}</strong> • Đợt: <strong>{profile?.academic_batch?.batch_name || 'ĐATN UTC'}</strong>
                  </span>
                </div>
                <h1 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, color: '#0f172a' }}>
                  {tabInfo.title}
                </h1>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.88rem', color: '#64748b' }}>
                  {tabInfo.subtitle}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                {activeTab === 'overview' && (
                  <button
                    className="btn btn-outline"
                    onClick={() => setShowUTCSheet(true)}
                    style={{
                      borderColor: '#004b87',
                      color: '#004b87',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      fontSize: '0.88rem',
                    }}
                  >
                    📑 {t('dashboard.printUTCSheet', 'In Phiếu Chấm UTC')}
                  </button>
                )}
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={loadData}
                  title="Tải lại dữ liệu mới nhất"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    fontSize: '0.88rem',
                  }}
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
              onSubtabChange={(st) => setActiveTab(st)}
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
                  <button
                    className="btn btn-outline"
                    onClick={() => setShowUTCSheet(true)}
                    style={{
                      background: 'rgba(0, 51, 102, 0.08)',
                      borderColor: '#003366',
                      color: '#003366',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                      boxShadow: '0 2px 6px rgba(0, 51, 102, 0.12)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 51, 102, 0.22)';
                      e.currentTarget.style.background = '#003366';
                      e.currentTarget.style.color = '#ffffff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 2px 6px rgba(0, 51, 102, 0.12)';
                      e.currentTarget.style.background = 'rgba(0, 51, 102, 0.08)';
                      e.currentTarget.style.color = '#003366';
                    }}
                  >
                    <span>📑</span>
                    <span>{t('dashboard.printUTCSheet', 'In Biên Bản / Phiếu Chấm UTC')}</span>
                  </button>
                </div>
                <div className="profile-info">
                  <p>
                    <strong>{t('profile.regNo', 'Mã Số Sinh Viên')}:</strong> {profile?.registration_no}{' '}
                    {profile?.registration_no && (
                      <CopyButton text={profile.registration_no} title="Sao chép MSSV" tooltipText="Đã sao chép MSSV" />
                    )}
                  </p>
                  <p><strong>{t('profile.department', 'Khoa / Ngành Đào Tạo')}:</strong> {profile?.department || 'N/A'}</p>
                  <p><strong>{t('profile.semester', 'Học Kỳ Hiện Tại')}:</strong> {profile?.semester || 'N/A'}</p>
                  <p><strong>{t('profile.batch', 'Đợt Đồ Án / Khóa Học')}:</strong> {profile?.academic_batch?.batch_name || profile?.batch_no || 'N/A'}</p>
                  <p>
                    <strong>Trạng Thái Đề Tài:</strong>{' '}
                    {profile?.graduation_project ? (
                      <span style={{ fontWeight: 600 }}>
                        {(profile.graduation_project.topic_review_status === 'APPROVED' || profile.graduation_project.status === 'TOPIC_APPROVED') ? (
                          <span style={{ color: '#059669' }}>
                            ✅ Khoa đã duyệt ({profile.graduation_project.topic_title_vi})
                          </span>
                        ) : (profile.graduation_project.topic_review_status === 'REVISION_REQUIRED' || profile.graduation_project.status === 'TOPIC_REVISION') ? (
                          <span style={{ color: '#dc2626' }}>
                            ⚠️ Khoa yêu cầu sửa đề tài {profile.graduation_project.topic_revision_notes ? `[${profile.graduation_project.topic_revision_notes}]` : ''} ({profile.graduation_project.topic_title_vi})
                          </span>
                        ) : (
                          <span style={{ color: '#047857' }}>
                            Đã phân công ({profile.graduation_project.topic_title_vi})
                          </span>
                        )}
                        {profile.graduation_project.initial_eligibility === 'FORCE_APPROVED' && (
                          <span style={{ marginLeft: '8px', color: '#d97706', fontSize: '0.85rem' }}>
                            (⚡ Đặc cách: {profile.graduation_project.ineligibility_reason || 'Khoa duyệt đặc cách'})
                          </span>
                        )}
                      </span>
                    ) : (
                      <span style={{ color: '#d97706', fontWeight: 500 }}>
                        Chờ phân công / Chưa điền khảo sát
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Feature 3 & 4: Online Meeting Link & Supervision Schedule on Student Dashboard */}
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
                  <div style={{ padding: '24px', textAlign: 'center', background: '#f8fafc', borderRadius: '8px', color: '#64748b', fontSize: '0.9rem', border: '1px dashed #cbd5e1' }}>
                    Chưa có lịch hẹn gặp trực tuyến hoặc buổi họp nào được lên lịch từ GVHD.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {supervisionLogs.slice(0, 3).map((meeting: any) => {
                      const isOnline = meeting.meeting_type === 'ONLINE' || (meeting.location_or_link && meeting.location_or_link.startsWith('http'));
                      return (
                        <div
                          key={meeting.id}
                          style={{
                            padding: '16px 20px',
                            background: isOnline ? '#f0f9ff' : '#f8fafc',
                            border: `1px solid ${isOnline ? '#bae6fd' : '#e2e8f0'}`,
                            borderRadius: '10px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '12px',
                          }}
                        >
                          <div style={{ flex: '1 1 300px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                              <span style={{
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: '4px',
                                backgroundColor: isOnline ? '#e0f2fe' : '#e2e8f0',
                                color: isOnline ? '#0369a1' : '#475569',
                                border: `1px solid ${isOnline ? '#7dd3fc' : '#cbd5e1'}`,
                              }}>
                                {isOnline ? '📹 TRỰC TUYẾN (MEET/ZOOM)' : '📍 GẶP TRỰC TIẾP'}
                              </span>
                              <span style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.95rem' }}>
                                Ngày: {meeting.meeting_date} ({meeting.meeting_time})
                              </span>
                            </div>

                            {meeting.content_discussed && (
                              <p style={{ margin: '4px 0', fontSize: '0.88rem', color: '#334155' }}>
                                <strong>Nội dung:</strong> {meeting.content_discussed}
                              </p>
                            )}

                            {meeting.supervisor_notes && (
                              <p style={{ margin: '4px 0', fontSize: '0.85rem', color: '#047857' }}>
                                <strong>Nhận xét GV:</strong> {meeting.supervisor_notes}
                              </p>
                            )}

                            {!isOnline && meeting.location_or_link && (
                              <p style={{ margin: '4px 0', fontSize: '0.85rem', color: '#64748b' }}>
                                <strong>Địa điểm:</strong> {meeting.location_or_link}
                              </p>
                            )}
                          </div>

                          {isOnline && meeting.location_or_link && (
                            <div>
                              <a
                                href={meeting.location_or_link}
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

              {/* Panel Assignment Information */}
              {(() => {
                const acceptedGroup = supervisorRequests.find(r => r.status === 'accepted');
                if (acceptedGroup?.project?.panel_info) {
                  const panel = acceptedGroup.project.panel_info;
                  return (
                    <div className="card" style={{ marginTop: '20px' }}>
                      <h2>📋 Panel Assignment</h2>
                      <div className="profile-info">
                        <p><strong>Panel:</strong> {panel.name || `Panel #${panel.id}`}</p>
                        <p>
                          <strong>Project:</strong> {acceptedGroup.project.project_name}{' '}
                          <span style={{ color: '#64748b', fontSize: '0.9em', fontWeight: 600 }}>(Mã: PRJ-{acceptedGroup.project.id})</span>{' '}
                          <CopyButton
                            text={`PRJ-${acceptedGroup.project.id}`}
                            label="Copy mã đề tài"
                            tooltipText="Đã sao chép mã đề tài vào bộ nhớ tạm"
                          />
                        </p>
                        <p><strong>Supervisor:</strong> {acceptedGroup.supervisor.user.first_name || acceptedGroup.supervisor.user.username} {acceptedGroup.supervisor.user.last_name || ''}</p>
                      </div>
                      {panel.members && panel.members.length > 0 && (
                        <div style={{ marginTop: '15px' }}>
                          <h4 style={{ marginBottom: '10px', color: '#555' }}>Committee Members</h4>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                            {panel.members.map(member => (
                              <div 
                                key={member.id} 
                                style={{ 
                                  padding: '8px 12px', 
                                  backgroundColor: '#f0f4f8', 
                                  borderRadius: '6px',
                                  border: '1px solid #e0e0e0'
                                }}
                              >
                                <span style={{ fontWeight: '500' }}>
                                  {member.user.first_name || member.user.username} {member.user.last_name || ''}
                                </span>
                                <span style={{ color: '#666', fontSize: '0.9em', marginLeft: '8px' }}>
                                  ({member.committee_id})
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }
                return null;
              })()}
            </>
          )}

          {activeTab === 'legacy_project' && profile?.groupmate_id && (
            <div>
              <div className="card" style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h2>My Project</h2>
                  <button className="btn btn-primary" onClick={() => setShowProjectModal(true)}>
                    Create Project
                  </button>
                </div>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '0.95rem' }}>
                  Create your own project idea, or choose an offered project (admin-set, category-wise) below. Then select one for supervisor request.
                </p>
                <SearchFilter
                  searchPlaceholder="Tìm kiếm đề tài theo tên, mô tả, công nghệ..."
                  onSearch={handleProjectSearch}
                  debounceDelay={400}
                  syncWithUrl={true}
                  filters={[
                    {
                      name: 'semester',
                      label: 'Học kỳ',
                      options: [
                        { value: '', label: 'Tất cả học kỳ' },
                        { value: '1', label: 'Kỳ 1' },
                        { value: '2', label: 'Kỳ 2' },
                        { value: '3', label: 'Kỳ 3' },
                        { value: '6', label: 'Kỳ 6' },
                        { value: '7', label: 'Kỳ 7' },
                        { value: '8', label: 'Kỳ 8' },
                      ],
                    },
                  ]}
                  onFilterChange={(filterName, value) => {
                    if (filterName === 'semester') {
                      setSelectedSemester(value);
                    }
                  }}
                />
                {projectsLoading ? (
                  <SkeletonCardGrid count={2} />
                ) : (
                  <div className="fade-in">
                    {(() => {
                      const displayedProjects = projects.filter(p => {
                        if (selectedSemester) {
                          const pSem = (p as any).semester;
                          if (pSem && String(pSem).replace('semester_', '') !== selectedSemester) {
                            return false;
                          }
                        }
                        return true;
                      });

                      if (displayedProjects.length === 0 && (projectSearch || selectedSemester)) {
                        return (
                          <div className="empty-state">
                            <p>
                              Không tìm thấy đề tài nào khớp với {projectSearch && `từ khóa "${projectSearch}"`} {selectedSemester && `(Học kỳ: Kỳ ${selectedSemester})`}
                            </p>
                          </div>
                        );
                      }

                      return (
                        <ProjectsList
                          projects={displayedProjects}
                          selectedProjectId={selectedProjectForSupervisor?.id ?? null}
                          onSelectForSupervisor={(p) => setSelectedProjectForSupervisor(p)}
                        />
                      );
                    })()}
                  </div>
                )}
              </div>
              <CommitteeOfferedProjects
                categories={projectCategories}
                selectedProjectId={selectedProjectForSupervisor?.id ?? null}
                onSelectProject={(p) => setSelectedProjectForSupervisor(p)}
              />
              {selectedProjectForSupervisor && (
                <div className="card" style={{ marginTop: '24px', padding: '12px 16px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                  <strong>Selected for supervisor request:</strong> {selectedProjectForSupervisor.project_name}
                  {' '}
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelectedProjectForSupervisor(null)}>
                    Clear
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'supervisor' && profile?.groupmate_id && (
            <div>
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h2>Supervisor Requests</h2>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn btn-secondary" onClick={loadSupervisorRequests}>
                      Refresh
                    </button>
                    {(supervisorRequests.length === 0 || supervisorRequests.every(r => r.status !== 'accepted')) && (
                      <button
                        className="btn btn-primary"
                        onClick={() => setShowSupervisorModal(true)}
                        disabled={!selectedProjectForSupervisor}
                        title={!selectedProjectForSupervisor ? 'Select a project in the Project tab first' : ''}
                      >
                        Request Supervisor
                      </button>
                    )}
                  </div>
                </div>
                {!selectedProjectForSupervisor && (supervisorRequests.length === 0 || supervisorRequests.every(r => r.status !== 'accepted')) && (
                  <div style={{ padding: '12px 16px', marginBottom: '16px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <strong>Project required.</strong> Go to the <strong>Project</strong> tab, create a project or select an offered one (admin-set), then choose &quot;Use for supervisor request&quot; or &quot;Select for supervisor request&quot;. After that you can request a supervisor here.
                  </div>
                )}
                {supervisorRequests.length === 0 ? (
                  <div className="empty-state">
                    <h3>No Supervisor Requests</h3>
                    <p>
                      {selectedProjectForSupervisor
                        ? 'Click "Request Supervisor" to send a request. The supervisor will see your project idea when deciding.'
                        : 'Select a project in the Project tab first, then come back to request a supervisor.'}
                    </p>
                  </div>
                ) : (
                  <>
                    <SupervisorRequestsList 
                      requests={supervisorRequests}
                      viewType="student"
                      onCancel={handleCancelSupervisorRequest}
                    />
                    {supervisorRequests.some(r => r.status === 'accepted') && (
                      <>
                        <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#d4edda', borderRadius: '4px', color: '#155724' }}>
                          <strong>✓ Supervisor Accepted!</strong>
                          <p style={{ marginTop: '5px', marginBottom: 0 }}>
                            You can now upload documents and chat with your supervisor. Check the "Documents" and "Chat" tabs.
                          </p>
                        </div>

                        {/* Panel Assignment Info */}
                        {(() => {
                          const acceptedGroup = supervisorRequests.find(r => r.status === 'accepted');
                          if (acceptedGroup?.project?.panel_info) {
                            const panel = acceptedGroup.project.panel_info;
                            return (
                              <div style={{ 
                                marginTop: '20px', 
                                padding: '15px', 
                                backgroundColor: '#e8f4f8', 
                                borderRadius: '4px', 
                                border: '1px solid #bee5eb' 
                              }}>
                                <strong>📋 Evaluation Panel: {panel.name || `Panel #${panel.id}`}</strong>
                                {panel.members && panel.members.length > 0 && (
                                  <div style={{ marginTop: '10px' }}>
                                    <span style={{ color: '#555', fontSize: '0.9em' }}>Committee Members: </span>
                                    {panel.members.map((member, index) => (
                                      <span key={member.id} style={{ color: '#333' }}>
                                        {member.user.first_name || member.user.username} {member.user.last_name || ''}
                                        {index < panel.members.length - 1 ? ', ' : ''}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          }
                          return null;
                        })()}
                        
                        {/* Supervisor-Student Discussion */}
                        <div style={{ marginTop: '30px' }}>
                          <h3 style={{ marginBottom: '15px', color: '#333' }}>Discussion with Supervisor</h3>
                          {(() => {
                            const acceptedGroup = supervisorRequests.find(r => r.status === 'accepted');
                            if (acceptedGroup?.group?.id) {
                              return (
                                <CommentsSection
                                  commentType="supervisor-student"
                                  groupId={acceptedGroup.group.id}
                                  currentUser={profile ? { id: profile.id, user_type: 'student' } : undefined}
                                  autoRefresh={true}
                                  refreshInterval={30000}
                                />
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {activeTab === 'documents' && profile?.groupmate_id && (
            <>
              {(() => {
                const acceptedSupervisorGroup = supervisorRequests.find(r => r.status === 'accepted');
                if (acceptedSupervisorGroup) {
                  return <DocumentsList groupId={acceptedSupervisorGroup.id} />;
                } else {
                  return (
                    <div className="card">
                      <div className="empty-state">
                        <h3>No Active Supervisor</h3>
                        <p>You need an accepted supervisor to upload documents.</p>
                        {supervisorRequests.length > 0 && (
                          <div style={{ marginTop: '10px' }}>
                            <p style={{ color: '#666' }}>Current supervisor request status:</p>
                            <ul style={{ textAlign: 'left', display: 'inline-block' }}>
                              {supervisorRequests.map((req, idx) => (
                                <li key={idx}>
                                  {req.supervisor?.user?.username || 'Unknown'}: {req.status}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {supervisorRequests.length === 0 && (
                          <p style={{ marginTop: '10px', color: '#666' }}>
                            Go to the "Supervisor" tab to request a supervisor.
                          </p>
                        )}
                      </div>
                    </div>
                  );
                }
              })()}
            </>
          )}

          {(activeTab === 'chat' || activeTab === 'groups') && (
            <UTCSupervisorGroupChatView currentStudent={profile} />
          )}

          {activeTab === 'templates' && (
            <StudentTemplatesView studentSemester={profile?.semester || undefined} />
          )}

          {activeTab === 'external' && profile?.semester === '8' && (
            <div className="card">
              <h2>External Evaluation Results</h2>
              {externalLoading ? (
                <div className="loading-state" style={{ padding: '40px', textAlign: 'center' }}>
                  <div className="loading-spinner" style={{ 
                    width: '40px', 
                    height: '40px', 
                    border: '3px solid #e2e8f0',
                    borderTopColor: '#3b82f6',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                    margin: '0 auto 16px'
                  }}></div>
                  <p>Loading evaluation...</p>
                </div>
              ) : externalEvaluation ? (
                <ExternalEvaluationView evaluation={externalEvaluation} />
              ) : (
                <div className="empty-state">
                  <h3>No External Evaluation Available</h3>
                  <p>Your external evaluation will appear here once completed by the external examiner.</p>
                  <p style={{ marginTop: '10px', color: '#666', fontSize: '14px' }}>
                    External evaluations are typically conducted during the final semester presentation.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showProjectModal && (
        <ProjectModal
          onClose={() => setShowProjectModal(false)}
          projectCategories={projectCategories}
          onSuccess={loadData}
        />
      )}

      {showSupervisorModal && selectedProjectForSupervisor && (
        <SupervisorRequestModal
          onClose={() => setShowSupervisorModal(false)}
          projectCategories={projectCategories}
          onSuccess={loadData}
          initialProject={selectedProjectForSupervisor}
        />
      )}

      <UTCEvaluationSheetModal
        isOpen={showUTCSheet}
        onClose={() => setShowUTCSheet(false)}
        groupData={{
          groupId: profile?.id || 1,
          projectTitle: projects[0]?.project_name || 'Hệ thống Quản lý Đồ án Smart FYP UTC',
          facultyDepartment: profile?.department || 'Khoa Công nghệ Thông tin - UTC',
          student1Name: profile?.user?.username || 'Sinh viên UTC',
          student1RegNo: profile?.registration_no || '201200101',
          student2Name: profile?.groupmate_id ? 'Sinh viên 2 (Nhóm UTC)' : undefined,
          student2RegNo: profile?.groupmate_id ? '201200102' : undefined,
          supervisorName: 'TS. Nguyễn Văn Minh',
          reviewerName: 'PGS.TS. Trần Thị Mai',
          committeeName: 'PGS.TS. Nguyễn Đức Thắng',
          supervisorScore: 8.5,
          reviewerScore: 8.0,
          committeeScore: 8.8,
        }}
      />
    </UTCAppLayout>
  );
};

const ProjectsList: React.FC<{
  projects: Project[];
  selectedProjectId?: number | null;
  onSelectForSupervisor?: (project: Project) => void;
}> = ({ projects, selectedProjectId, onSelectForSupervisor }) => {
  if (projects.length === 0) {
    return (
      <div className="empty-state">
        <h3>No projects yet</h3>
        <p>Click "Create Project" to get started, or choose an offered project (admin-set) below.</p>
      </div>
    );
  }

  return (
    <div className="grid">
      {projects.map((project) => {
        const isSelected = selectedProjectId === project.id;
        return (
          <div key={project.id} className="card" style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
              <h3 style={{ marginBottom: '10px', color: '#333' }}>{project.project_name}</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>PRJ-{project.id}</span>
                <CopyButton text={`PRJ-${project.id}`} label="Copy mã" tooltipText="Đã sao chép mã đề tài vào bộ nhớ tạm" />
              </div>
            </div>
            <p style={{ marginBottom: '10px', color: '#666' }}>{project.project_description}</p>
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              <p><strong>Language:</strong> {project.language}</p>
              {project.functionalities && (
                <p><strong>Functionalities:</strong> {project.functionalities}</p>
              )}
            </div>
            {onSelectForSupervisor && (
              <div style={{ marginTop: '12px' }}>
                <button
                  type="button"
                  className={`btn btn-sm ${isSelected ? 'btn-secondary' : 'btn-primary'}`}
                  onClick={() => onSelectForSupervisor(project)}
                >
                  {isSelected ? 'Selected for supervisor request' : 'Use for supervisor request'}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default StudentDashboard;
