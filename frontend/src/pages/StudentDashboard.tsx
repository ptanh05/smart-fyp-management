import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { apiService } from '../services/api';
import type { Student } from '../types';
import Navbar from '../components/Navbar';
import UTCAppLayout from '../components/UTCAppLayout';
import StudentTemplatesView from '../components/StudentTemplatesView';
import UTCFypTimeline from '../components/UTCFypTimeline';
import UTCEvaluationSheetModal from '../components/UTCEvaluationSheetModal';
import { UTCStudentGraduationView } from '../components/UTCStudentGraduationView';
import { UTCSupervisorGroupChatView } from '../components/UTCSupervisorGroupChatView';
import { SkeletonProfile } from '../components/SkeletonLoader';
import { getProjectStageInfo } from '../utils/graduationStages';
import './Dashboard.css';
import '../components/SkeletonLoader.css';
import '../components/StudentTemplatesView.css';

const StudentDashboard: React.FC = () => {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const [searchParams] = useSearchParams();
  const student = user as Student;
  const [activeTab, setActiveTab] = useState('overview');
  const [profile, setProfile] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUTCSheet, setShowUTCSheet] = useState(false);
  const [supervisionLogs, setSupervisionLogs] = useState<any[]>([]);
  const [supervisionLogsLoading, setSupervisionLogsLoading] = useState(false);

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
                gap: '12px',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span
                    style={{
                      background: '#e0f2fe',
                      color: '#0369a1',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      letterSpacing: '0.5px',
                    }}
                  >
                    {tabInfo.badge}
                  </span>
                  <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                    MSSV: <strong>{profile?.registration_no || (student as any)?.registration_no || '---'}</strong>
                  </span>
                  {profile?.department && (
                    <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                      | Khoa: <strong>{profile.department}</strong>
                    </span>
                  )}
                </div>
                <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#002B49' }}>
                  {tabInfo.title}
                </h1>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.88rem', color: '#64748b' }}>
                  {tabInfo.subtitle}
                </p>
              </div>

              {/* Action buttons on header */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={loadData}
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
                    title="Mở biểu mẫu biên bản đánh giá ĐATN UTC có chữ ký và điểm chi tiết"
                  >
                    <span>📄</span>
                    <span>Xem Phiếu Đánh Giá ĐATN Chuẩn UTC</span>
                  </button>
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

      <UTCEvaluationSheetModal
        isOpen={showUTCSheet}
        onClose={() => setShowUTCSheet(false)}
        groupData={{
          groupId: profile?.graduation_project?.id || profile?.id || 1,
          projectTitle: profile?.graduation_project?.topic_title_vi || 'Hệ thống Quản lý Đồ án Smart FYP UTC',
          facultyDepartment: profile?.department || 'Khoa Công nghệ Thông tin - UTC',
          student1Name: profile?.user ? `${profile.user.first_name || ''} ${profile.user.last_name || ''}`.trim() || profile.user.username : 'Sinh viên UTC',
          student1RegNo: profile?.registration_no || '201200101',
          supervisorName: profile?.graduation_project?.supervisor_name || 'TS. Nguyễn Văn Minh',
          reviewerName: 'PGS.TS. Trần Thị Mai',
          committeeName: 'PGS.TS. Nguyễn Đức Thắng',
          supervisorScore: (profile?.graduation_project as any)?.supervisor_score ?? 8.5,
          reviewerScore: (profile?.graduation_project as any)?.reviewer_score ?? 8.0,
          committeeScore: (profile?.graduation_project as any)?.council_score ?? 8.8,
        }}
      />
    </UTCAppLayout>
  );
};

export default StudentDashboard;
