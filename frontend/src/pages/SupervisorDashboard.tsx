import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { apiService } from '../services/api';
import type { Supervisor, SupervisorOfStudentGroup } from '../types';
import Navbar from '../components/Navbar';
import UTCAppLayout from '../components/UTCAppLayout';
import ChatRoom from '../components/ChatRoom';
import DocumentReview from '../components/DocumentReview';
import EvaluationForm, { supervisorEvaluationConfigs } from '../components/EvaluationForm';
import type { EvaluationType } from '../components/EvaluationForm';
import SupervisorRequestsList from '../components/SupervisorRequestsList';
import CommentsSection from '../components/CommentsSection';
import SupervisorAnalytics from '../components/SupervisorAnalytics';
import AuditLogViewer from '../components/AuditLogViewer';
import UTCFypTimeline from '../components/UTCFypTimeline';
import UTCEvaluationSheetModal from '../components/UTCEvaluationSheetModal';
import { UTCSupervisorGraduationView } from '../components/UTCSupervisorGraduationView';
import SupervisorOfferedTopics from '../components/SupervisorOfferedTopics';
import { SkeletonProfile, SkeletonEvaluationGrid } from '../components/SkeletonLoader';
import { TablePagination } from '../components/TablePagination';
import { getRelativeTime } from '../utils/dateUtils';
import { useModalGuard } from '../utils/modalHooks';
import './Dashboard.css';
import '../components/EvaluationForm.css';
import '../components/DocumentReview.css';
import '../components/SkeletonLoader.css';
import '../components/CommentsSection.css';

const SupervisorDashboard: React.FC = () => {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const supervisor = user as Supervisor;
  const [activeTab, setActiveTab] = useState('overview');
  const [profile, setProfile] = useState<Supervisor | null>(null);
  const [supervisorRequests, setSupervisorRequests] = useState<SupervisorOfStudentGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<SupervisorOfStudentGroup | null>(null);
  const [exporting, setExporting] = useState(false);
  const [showUTCSheet, setShowUTCSheet] = useState(false);
  
  // Profile edit state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editFormData, setEditFormData] = useState({
    research_interest: '',
    academic_background: '',
  });
  const [savingProfile, setSavingProfile] = useState(false);

  // Broadcast Announcement State (Feature 2)
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
  const [broadcastForm, setBroadcastForm] = useState({
    title: '',
    message: '',
  });
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastError, setBroadcastError] = useState<string | null>(null);

  const isBroadcastDirty = Boolean(broadcastForm.title.trim() || broadcastForm.message.trim());
  const broadcastModalGuard = useModalGuard({
    isOpen: isBroadcastModalOpen,
    onClose: () => setIsBroadcastModalOpen(false),
    isDirty: isBroadcastDirty,
    confirmMessage: 'Bạn có nội dung thông báo chưa gửi. Bạn có chắc muốn đóng không?',
  });

  const handleBroadcastSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastForm.title.trim() || !broadcastForm.message.trim()) {
      setBroadcastError('Vui lòng nhập cả tiêu đề và nội dung thông báo.');
      return;
    }

    try {
      setBroadcasting(true);
      setBroadcastError(null);
      const res = await apiService.broadcastAnnouncement({
        title: broadcastForm.title.trim(),
        message: broadcastForm.message.trim(),
      });
      alert(res.message || 'Đã gửi thông báo chung tới tất cả sinh viên thành công!');
      setIsBroadcastModalOpen(false);
      setBroadcastForm({ title: '', message: '' });
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Không thể gửi thông báo. Vui lòng thử lại.';
      setBroadcastError(msg);
    } finally {
      setBroadcasting(false);
    }
  };

  const profileEditGuard = useModalGuard({
    isOpen: isEditingProfile,
    onClose: () => handleCancelEdit(),
    isDirty: Boolean(
      (profile && editFormData.research_interest !== (profile.research_interest || '')) ||
      (profile && editFormData.academic_background !== (profile.academic_background || ''))
    ),
  });


  useEffect(() => {
    loadData();
  }, []);

  // Reload requests when requests tab is clicked
  useEffect(() => {
    if (activeTab === 'requests') {
      loadSupervisorRequests();
    }
  }, [activeTab]);

  // Auto-sync when internet reconnects without page reload
  useEffect(() => {
    const handleOnlineSync = () => {
      loadData();
    };
    window.addEventListener('app:online-sync', handleOnlineSync);
    return () => {
      window.removeEventListener('app:online-sync', handleOnlineSync);
    };
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const profileData = await apiService.getSupervisorProfile();
      setProfile(profileData);
      await loadSupervisorRequests();
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
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

  const handleAcceptRequest = async (id: number) => {
    try {
      await apiService.respondToSupervisorRequest(id, 'accepted');
      await loadSupervisorRequests(); // Reload requests
      alert('Request accepted successfully!');
    } catch (error: any) {
      console.error('Failed to accept request:', error);
      alert(error.response?.data?.message || 'Failed to accept request');
    }
  };

  const handleRejectRequest = async (id: number) => {
    try {
      await apiService.respondToSupervisorRequest(id, 'rejected');
      await loadSupervisorRequests(); // Reload requests
      alert('Request rejected');
    } catch (error: any) {
      console.error('Failed to reject request:', error);
      alert(error.response?.data?.message || 'Failed to reject request');
    }
  };

  const handleExportReport = async () => {
    try {
      setExporting(true);
      const blob = await apiService.exportReport();
      
      // Generate filename with current date
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format
      const filename = `supervisor_report_${dateStr}.xlsx`;
      
      // Create download link and trigger download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      alert('Report exported successfully!');
    } catch (error: any) {
      console.error('Failed to export report:', error);
      alert(error.response?.data?.message || 'Failed to export report. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const handleEditProfile = () => {
    setEditFormData({
      research_interest: profile?.research_interest || '',
      academic_background: profile?.academic_background || '',
    });
    setIsEditingProfile(true);
  };

  const handleCancelEdit = () => {
    setIsEditingProfile(false);
    setEditFormData({
      research_interest: '',
      academic_background: '',
    });
  };

  const handleSaveProfile = async () => {
    try {
      setSavingProfile(true);
      const updatedProfile = await apiService.updateSupervisorProfile({
        research_interest: editFormData.research_interest,
        academic_background: editFormData.academic_background,
      });
      setProfile(updatedProfile);
      setIsEditingProfile(false);
      alert('Profile updated successfully!');
    } catch (error: any) {
      console.error('Failed to update profile:', error);
      alert(error.response?.data?.message || 'Failed to update profile. Please try again.');
    } finally {
      setSavingProfile(false);
    }
  };

  if (loading || !supervisor) {
    return (
      <div>
        <Navbar user={supervisor} onLogout={logout} />
        <div className="container" style={{ paddingTop: '30px' }}>
          <SkeletonProfile />
          <div style={{ marginTop: '30px' }}>
            <SkeletonEvaluationGrid count={3} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <UTCAppLayout user={supervisor} onLogout={logout} activeTab={activeTab} onTabChange={setActiveTab}>
      <div className="container">
        <div className="dashboard-header">
          <div>
            <h1>{t('dashboard.supervisorTitle', 'Bảng Điều Khiển Giảng Viên Hướng Dẫn')}</h1>
            <p>{t('dashboard.welcome', 'Xin chào')}, {supervisor?.user?.username}</p>
          </div>
          <button
            className="btn btn-primary"
            onClick={handleExportReport}
            disabled={exporting}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            {exporting ? (
              <>
                <span className="spinner-small"></span>
                {t('common.loading', 'Đang tải...')}
              </>
            ) : (
              <>
                📊 {t('actions.exportReport', 'Xuất Báo Cáo Excel UTC')}
              </>
            )}
          </button>
        </div>

        <div className="tabs">
          <button
            className={`tab ${activeTab === 'utc_graduation' ? 'active' : ''}`}
            onClick={() => setActiveTab('utc_graduation')}
            style={{ fontWeight: 'bold', background: activeTab === 'utc_graduation' ? '#003366' : undefined, color: activeTab === 'utc_graduation' ? '#fff' : undefined }}
          >
            🎓 Quản lý ĐATN UTC (Duyệt Đề cương, Báo cáo & Chấm Điểm)
          </button>
          <button
            className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            {t('nav.overview', 'Tổng Quan')}
          </button>
          <button
            className={`tab ${activeTab === 'requests' ? 'active' : ''}`}
            onClick={() => setActiveTab('requests')}
          >
            {t('nav.requests', 'Yêu Cầu Từ Sinh Viên')}
          </button>
          <button
            className={`tab ${activeTab === 'groups' ? 'active' : ''}`}
            onClick={() => setActiveTab('groups')}
          >
            {t('nav.groups', 'Nhóm Đồ Án Hướng Dẫn')}
          </button>
          <button
            className={`tab ${activeTab === 'offered_topics' ? 'active' : ''}`}
            onClick={() => setActiveTab('offered_topics')}
          >
            💡 Đề Tài Gợi Ý
          </button>
          <button
            className={`tab ${activeTab === 'documents' ? 'active' : ''}`}
            onClick={() => setActiveTab('documents')}
          >
            {t('nav.documents', 'Tài Liệu Đồ Án')}
          </button>
          <button
            className={`tab ${activeTab === 'evaluations' ? 'active' : ''}`}
            onClick={() => setActiveTab('evaluations')}
          >
            {t('nav.evaluations', 'Đánh Giá & Chấm Điểm')}
          </button>
          <button
            className={`tab ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            {t('nav.chat', 'Trao Đổi & Thảo Luận')}
          </button>
          <button
            className={`tab ${activeTab === 'audit' ? 'active' : ''}`}
            onClick={() => setActiveTab('audit')}
          >
            {t('nav.auditLogs', 'Nhật Ký Hệ Thống')}
          </button>
        </div>

        <div className="tab-content">
          {activeTab === 'utc_graduation' && <UTCSupervisorGraduationView />}

          {activeTab === 'overview' && (
            <>
              <UTCFypTimeline currentStep={3} />

              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h2 style={{ margin: 0 }}>{t('profile.title', 'Thông Tin Cá Nhân & Hồ Sơ UTC')}</h2>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button
                      className="btn btn-primary"
                      onClick={() => {
                        setBroadcastForm({ title: '', message: '' });
                        setBroadcastError(null);
                        setIsBroadcastModalOpen(true);
                      }}
                      style={{
                        backgroundColor: '#0284c7',
                        color: '#fff',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                      title="Gửi tin nhắn thông báo chung cho tất cả sinh viên các nhóm hướng dẫn"
                    >
                      📢 {t('dashboard.broadcastAnnouncement', 'Gửi Thông Báo Chung')}
                    </button>
                    <button
                      className="btn btn-outline"
                      onClick={() => setShowUTCSheet(true)}
                      style={{
                        borderColor: '#003366',
                        color: '#003366',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      🎓 {t('dashboard.printUTCSheet', 'In Biên Bản / Phiếu Chấm UTC')}
                    </button>
                    <button className="btn btn-secondary" onClick={handleEditProfile}>
                      ✏️ {t('profile.editProfile', 'Chỉnh Sửa Hồ Sơ')}
                    </button>
                  </div>
                </div>
                <div className="profile-info">
                  <p><strong>{t('profile.supervisorId', 'Mã Số Giảng Viên')}:</strong> {profile?.supervisor_id}</p>
                  <p><strong>{t('profile.researchInterest', 'Hướng Nghiên Cứu')}:</strong> {profile?.research_interest || 'N/A'}</p>
                  <p><strong>{t('profile.academicBackground', 'Học Hàm / Học Vị')}:</strong> {profile?.academic_background || 'N/A'}</p>
                </div>
              </div>

              <SupervisorAnalytics />

              {isEditingProfile && (
                <div className="modal-overlay" onClick={profileEditGuard.handleOverlayClick}>
                  <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                    <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', borderBottom: '1px solid #e0e0e0' }}>
                      <h3 style={{ margin: 0 }}>Edit Profile</h3>
                      <button 
                        onClick={profileEditGuard.requestClose}
                        style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#666' }}
                      >
                        ×
                      </button>
                    </div>
                    
                    <div className="modal-body" style={{ padding: '20px' }}>
                      <div className="form-group" style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#333' }}>
                          Research Interest
                        </label>
                        <textarea
                          value={editFormData.research_interest}
                          onChange={(e) => setEditFormData({ ...editFormData, research_interest: e.target.value })}
                          placeholder="Enter your research interests..."
                          rows={3}
                          style={{
                            width: '100%',
                            padding: '10px',
                            border: '1px solid #ddd',
                            borderRadius: '6px',
                            fontSize: '14px',
                            resize: 'vertical',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>
                      
                      <div className="form-group" style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#333' }}>
                          Academic Background
                        </label>
                        <textarea
                          value={editFormData.academic_background}
                          onChange={(e) => setEditFormData({ ...editFormData, academic_background: e.target.value })}
                          placeholder="Enter your academic background..."
                          rows={3}
                          style={{
                            width: '100%',
                            padding: '10px',
                            border: '1px solid #ddd',
                            borderRadius: '6px',
                            fontSize: '14px',
                            resize: 'vertical',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>
                    </div>
                    
                    <div className="modal-footer" style={{ 
                      display: 'flex', 
                      justifyContent: 'flex-end', 
                      gap: '12px', 
                      padding: '16px 20px', 
                      borderTop: '1px solid #e0e0e0',
                      backgroundColor: '#f8f9fa',
                    }}>
                      <button 
                        className="btn btn-secondary" 
                        onClick={profileEditGuard.requestClose}
                        disabled={savingProfile}
                      >
                        Cancel
                      </button>
                      <button 
                        className="btn btn-primary" 
                        onClick={handleSaveProfile}
                        disabled={savingProfile}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                      >
                        {savingProfile ? (
                          <>
                            <span className="spinner-small"></span>
                            Saving...
                          </>
                        ) : (
                          'Save Changes'
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Broadcast Announcement Modal (Feature 2) */}
              {isBroadcastModalOpen && (
                <div className="modal-overlay" onClick={broadcastModalGuard.handleOverlayClick}>
                  <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '580px' }}>
                    <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', borderBottom: '1px solid #e2e8f0' }}>
                      <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a' }}>📢 Gửi Thông Báo Chung Cho Các Nhóm</h3>
                      <button 
                        onClick={broadcastModalGuard.requestClose}
                        style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#64748b' }}
                      >
                        ×
                      </button>
                    </div>

                    <form onSubmit={handleBroadcastSubmit}>
                      <div className="modal-body" style={{ padding: '20px 24px' }}>
                        <div style={{ padding: '10px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', color: '#1e40af', fontSize: '0.85rem', marginBottom: '16px', lineHeight: 1.5 }}>
                          ℹ️ Thông báo này sẽ được gửi ngay lập tức tới <b>toàn bộ sinh viên</b> thuộc các nhóm đồ án do thầy/cô hướng dẫn.
                        </div>

                        {broadcastError && (
                          <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#dc2626', fontSize: '0.85rem', marginBottom: '16px' }}>
                            {broadcastError}
                          </div>
                        )}

                        <div className="form-group" style={{ marginBottom: '16px' }}>
                          <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#334155', fontSize: '0.9rem' }}>
                            Tiêu đề thông báo <span style={{ color: '#ef4444' }}>*</span>
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="Ví dụ: Lịch họp báo cáo tiến độ tuần này / Lưu ý nộp đề cương..."
                            value={broadcastForm.title}
                            onChange={(e) => setBroadcastForm({ ...broadcastForm, title: e.target.value })}
                            style={{
                              width: '100%',
                              padding: '10px 12px',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              fontSize: '14px',
                              boxSizing: 'border-box',
                            }}
                            autoFocus
                          />
                        </div>

                        <div className="form-group" style={{ marginBottom: '8px' }}>
                          <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#334155', fontSize: '0.9rem' }}>
                            Nội dung thông báo chi tiết <span style={{ color: '#ef4444' }}>*</span>
                          </label>
                          <textarea
                            required
                            rows={5}
                            placeholder="Nhập nội dung cần nhắn gửi tới các nhóm..."
                            value={broadcastForm.message}
                            onChange={(e) => setBroadcastForm({ ...broadcastForm, message: e.target.value })}
                            style={{
                              width: '100%',
                              padding: '10px 12px',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              fontSize: '14px',
                              boxSizing: 'border-box',
                              resize: 'vertical',
                            }}
                          />
                        </div>
                      </div>

                      <div className="modal-footer" style={{ 
                        display: 'flex', 
                        justifyContent: 'flex-end', 
                        gap: '12px', 
                        padding: '14px 24px', 
                        borderTop: '1px solid #e2e8f0',
                        backgroundColor: '#f8fafc',
                      }}>
                        <button 
                          type="button"
                          className="btn btn-secondary" 
                          onClick={broadcastModalGuard.requestClose}
                          disabled={broadcasting}
                        >
                          Hủy bỏ
                        </button>
                        <button 
                          type="submit" 
                          className="btn btn-primary" 
                          disabled={broadcasting || !broadcastForm.title.trim() || !broadcastForm.message.trim()}
                          style={{
                            backgroundColor: '#0284c7',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                          }}
                        >
                          {broadcasting ? 'Đang gửi...' : 'Gửi thông báo ngay 🚀'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === 'requests' && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2>Student Requests</h2>
                <button className="btn btn-secondary" onClick={loadSupervisorRequests}>
                  Refresh
                </button>
              </div>
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ marginBottom: '10px', color: '#333' }}>Pending Requests</h3>
                <SupervisorRequestsList
                  requests={supervisorRequests.filter((r) => r.status === 'pending')}
                  viewType="supervisor"
                  onAccept={handleAcceptRequest}
                  onReject={handleRejectRequest}
                />
              </div>
              {supervisorRequests.filter((r) => r.status !== 'pending').length > 0 && (
                <div>
                  <h3 style={{ marginBottom: '10px', color: '#333' }}>Other Requests</h3>
                  <SupervisorRequestsList
                    requests={supervisorRequests.filter((r) => r.status !== 'pending')}
                    viewType="supervisor"
                    onAccept={handleAcceptRequest}
                    onReject={handleRejectRequest}
                    showActions={false}
                  />
                </div>
              )}
            </div>
          )}

          {activeTab === 'groups' && (
            <div className="card">
              <h2>My Student Groups</h2>
              <p style={{ color: '#666', marginBottom: '20px' }}>
                Select a group and choose an action below.
              </p>
              <GroupsList
                groups={supervisorRequests.filter((r) => r.status === 'accepted')}
                onViewEvaluations={(group) => {
                  setSelectedGroup(group);
                  setActiveTab('evaluations');
                }}
                onOpenChat={(group) => {
                  setSelectedGroup(group);
                  setActiveTab('chat');
                }}
                onViewDocuments={(group) => {
                  setSelectedGroup(group);
                  setActiveTab('documents');
                }}
                onViewComments={(group) => {
                  setSelectedGroup(group);
                }}
                selectedGroupId={selectedGroup?.id}
              />
              
              {/* Discussion Section for Selected Group */}
              {selectedGroup && (
                <div style={{ marginTop: '30px' }}>
                  <h3 style={{ marginBottom: '15px', color: '#333' }}>
                    Discussion - {selectedGroup.project?.project_name || `Group #${selectedGroup.group?.id}`}
                  </h3>
                  <CommentsSection
                    commentType="supervisor-student"
                    groupId={selectedGroup.group?.id || selectedGroup.id}
                    currentUser={profile ? { id: profile.id, user_type: 'supervisor' } : undefined}
                    autoRefresh={true}
                    refreshInterval={30000}
                    maxHeight="350px"
                  />
                </div>
              )}
            </div>
          )}

          {activeTab === 'offered_topics' && (
            <div className="card">
              <SupervisorOfferedTopics onTopicChanged={loadData} />
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="card">
              <DocumentReview groups={supervisorRequests.filter((r) => r.status === 'accepted')} />
            </div>
          )}

          {activeTab === 'evaluations' && (
            <div className="card">
              {selectedGroup ? (
                <>
                  <div style={{ marginBottom: '20px' }}>
                    <h2>Evaluations for Group #{selectedGroup.id}</h2>
                    <p style={{ color: '#666', marginTop: '8px' }}>
                      <strong>Project:</strong> {selectedGroup.project?.project_name || 'N/A'} | 
                      <strong> Students:</strong> {selectedGroup.group?.student_1_details?.user?.username || 'N/A'} & {selectedGroup.group?.student_2_details?.user?.username || 'N/A'}
                    </p>
                  </div>
                  <EvaluationsList groupId={selectedGroup.id} />
                </>
              ) : (
                <div className="empty-state">
                  <h2>Evaluations</h2>
                  <p>Please select a group from the "My Groups" tab to view and manage evaluations.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'chat' && (
            <div>
              {selectedGroup ? (
                <ChatRoom groupId={selectedGroup.id} />
              ) : (
                <div className="card">
                  <h2>Chat Room</h2>
                  <div className="empty-state">
                    Please select a group from the "My Groups" tab to start chatting with students.
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'audit' && (
            <AuditLogViewer />
          )}
        </div>
      </div>

      <UTCEvaluationSheetModal
        isOpen={showUTCSheet}
        onClose={() => setShowUTCSheet(false)}
        groupData={{
          groupId: selectedGroup?.id || 1,
          projectTitle: selectedGroup?.project?.project_name || 'Hệ thống Quản lý Đồ án Smart FYP UTC',
          facultyDepartment: 'Khoa Công nghệ Thông tin - UTC',
          student1Name: selectedGroup?.group?.student_1_details?.user?.username || 'Sinh viên 1 (UTC)',
          student1RegNo: selectedGroup?.group?.student_1_details?.registration_no || '201200101',
          student2Name: selectedGroup?.group?.student_2_details?.user?.username || 'Sinh viên 2 (UTC)',
          student2RegNo: selectedGroup?.group?.student_2_details?.registration_no || '201200102',
          supervisorName: supervisor?.user?.first_name ? `${supervisor.user.first_name} ${supervisor.user.last_name}` : 'TS. Nguyễn Văn Minh',
          reviewerName: 'PGS.TS. Trần Thị Mai',
          committeeName: 'PGS.TS. Nguyễn Đức Thắng',
          supervisorScore: 8.8,
          reviewerScore: 8.2,
          committeeScore: 8.5,
        }}
      />
    </UTCAppLayout>
  );
};

const GroupsList: React.FC<{
  groups: SupervisorOfStudentGroup[];
  onViewEvaluations: (group: SupervisorOfStudentGroup) => void;
  onOpenChat: (group: SupervisorOfStudentGroup) => void;
  onViewDocuments: (group: SupervisorOfStudentGroup) => void;
  onViewComments?: (group: SupervisorOfStudentGroup) => void;
  selectedGroupId?: number;
}> = ({ groups, onViewEvaluations, onOpenChat, onViewDocuments, onViewComments, selectedGroupId }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSemester, setSelectedSemester] = useState<string>('all');
  const [selectedProgress, setSelectedProgress] = useState<'all' | 'on_track' | 'delayed'>('all');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [sortField, setSortField] = useState<'name' | 'created_at' | 'score' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  if (groups.length === 0) {
    return <div className="empty-state">Chưa có nhóm đồ án nào được phân công</div>;
  }

  // Extract available semesters from students in groups
  const availableSemesters = Array.from(
    new Set(
      groups
        .flatMap((g) => [
          g.group?.student_1_details?.semester,
          g.group?.student_2_details?.semester,
        ])
        .filter(Boolean) as string[]
    )
  );
  const defaultSemesters = ['Kỳ 1 2025-2026', 'Kỳ 2 2025-2026', 'Kỳ 1 2024-2025', 'Kỳ 2 2024-2025'];
  const allSemesters = Array.from(new Set([...availableSemesters, ...defaultSemesters]));

  const getGroupProgress = (g: any): 'on_track' | 'delayed' => {
    if (g.is_late || (g as any).has_late_documents) {
      return 'delayed';
    }
    return 'on_track';
  };

  const getGroupName = (g: SupervisorOfStudentGroup): string => {
    return g.project?.project_name || g.group?.student_1_details?.user?.username || `Group #${g.id}`;
  };

  const getGroupScore = (g: SupervisorOfStudentGroup): number | null => {
    if (typeof (g as any).supervisor_score === 'number') return (g as any).supervisor_score;
    if (typeof (g.project as any)?.supervisor_score === 'number') return (g.project as any).supervisor_score;
    return null;
  };

  const filteredGroups = groups.filter((g) => {
    const sem1 = g.group?.student_1_details?.semester;
    const sem2 = g.group?.student_2_details?.semester;
    const groupSem = sem1 || sem2 || 'Kỳ 1 2025-2026';

    const matchesSemester = selectedSemester === 'all' || groupSem === selectedSemester;
    const progress = getGroupProgress(g);
    const matchesProgress = selectedProgress === 'all' || progress === selectedProgress;

    const s1Name = g.group?.student_1_details?.user?.username || '';
    const s2Name = g.group?.student_2_details?.user?.username || '';
    const s1Reg = g.group?.student_1_details?.registration_no || '';
    const s2Reg = g.group?.student_2_details?.registration_no || '';
    const pName = g.project?.project_name || '';
    const gId = g.id.toString();

    const matchesSearch =
      !searchTerm ||
      pName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s1Name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s2Name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s1Reg.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s2Reg.toLowerCase().includes(searchTerm.toLowerCase()) ||
      gId.includes(searchTerm);

    return matchesSemester && matchesProgress && matchesSearch;
  });

  const handleSort = (field: 'name' | 'created_at' | 'score') => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const renderSortIcon = (field: 'name' | 'created_at' | 'score') => {
    if (sortField !== field) {
      return <span style={{ color: '#94a3b8', marginLeft: '4px', fontSize: '11px' }}>⇅</span>;
    }
    return sortDirection === 'asc' ? (
      <span style={{ color: '#007bff', marginLeft: '4px', fontWeight: 'bold', fontSize: '11px' }}>▲</span>
    ) : (
      <span style={{ color: '#007bff', marginLeft: '4px', fontWeight: 'bold', fontSize: '11px' }}>▼</span>
    );
  };

  const sortedGroups = useMemo(() => {
    if (!sortField) return filteredGroups;
    return [...filteredGroups].sort((a, b) => {
      if (sortField === 'name') {
        const nameA = getGroupName(a);
        const nameB = getGroupName(b);
        const cmp = nameA.localeCompare(nameB, 'vi', { sensitivity: 'base' });
        return sortDirection === 'asc' ? cmp : -cmp;
      }
      if (sortField === 'created_at') {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
      }
      if (sortField === 'score') {
        const scoreA = getGroupScore(a) ?? -1;
        const scoreB = getGroupScore(b) ?? -1;
        return sortDirection === 'asc' ? scoreA - scoreB : scoreB - scoreA;
      }
      return 0;
    });
  }, [filteredGroups, sortField, sortDirection]);

  const paginatedGroups = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedGroups.slice(start, start + pageSize);
  }, [sortedGroups, currentPage, pageSize]);

  return (
    <div>
      {/* Search and Filters Bar */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '20px',
          flexWrap: 'wrap',
          alignItems: 'center',
          backgroundColor: '#f8fafc',
          padding: '14px',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
        }}
      >
        <div style={{ flex: 1, minWidth: '220px' }}>
          <input
            type="text"
            placeholder="🔍 Tìm kiếm theo tên đề tài, sinh viên, MSSV..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '0.88rem',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Kỳ học:</label>
          <select
            value={selectedSemester}
            onChange={(e) => setSelectedSemester(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '0.85rem',
              backgroundColor: 'white',
              cursor: 'pointer',
            }}
          >
            <option value="all">Tất cả kỳ học</option>
            {allSemesters.map((sem) => (
              <option key={sem} value={sem}>
                {sem}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Tiến độ:</label>
          <select
            value={selectedProgress}
            onChange={(e) => setSelectedProgress(e.target.value as any)}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '0.85rem',
              backgroundColor: 'white',
              cursor: 'pointer',
            }}
          >
            <option value="all">Tất cả tiến độ</option>
            <option value="on_track">🟢 Đúng hạn (On Track)</option>
            <option value="delayed">🔴 Chậm tiến độ (Delayed)</option>
          </select>
        </div>

        {/* View mode toggle */}
        <div style={{ display: 'flex', border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden' }}>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            style={{
              padding: '6px 12px',
              border: 'none',
              backgroundColor: viewMode === 'table' ? '#007bff' : '#ffffff',
              color: viewMode === 'table' ? '#ffffff' : '#475569',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
            title="Xem dạng bảng"
          >
            📊 Bảng
          </button>
          <button
            type="button"
            onClick={() => setViewMode('cards')}
            style={{
              padding: '6px 12px',
              border: 'none',
              backgroundColor: viewMode === 'cards' ? '#007bff' : '#ffffff',
              color: viewMode === 'cards' ? '#ffffff' : '#475569',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
            title="Xem dạng thẻ"
          >
            🗂 Thẻ
          </button>
        </div>

        {(searchTerm || selectedSemester !== 'all' || selectedProgress !== 'all') && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setSearchTerm('');
              setSelectedSemester('all');
              setSelectedProgress('all');
            }}
          >
            Đặt lại bộ lọc
          </button>
        )}
      </div>

      {filteredGroups.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
          <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>Không tìm thấy nhóm đồ án phù hợp</p>
          <p style={{ fontSize: '0.85rem' }}>Hãy thử thay đổi từ khóa tìm kiếm, kỳ học hoặc bộ lọc tiến độ.</p>
        </div>
      ) : viewMode === 'table' ? (
        /* TABLE VIEW WITH SORTING & PAGINATION */
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ margin: 0, width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f1f5f9' }}>
                  <th style={{ padding: '12px 14px', textAlign: 'left', width: '80px' }}>Mã nhóm</th>
                  <th
                    style={{ padding: '12px 14px', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => handleSort('name')}
                    title="Bấm vào để sắp xếp theo Tên"
                  >
                    Tên {renderSortIcon('name')}
                  </th>
                  <th
                    style={{ padding: '12px 14px', textAlign: 'left', cursor: 'pointer', userSelect: 'none', width: '140px' }}
                    onClick={() => handleSort('created_at')}
                    title="Bấm vào để sắp xếp theo Ngày tạo"
                  >
                    Ngày tạo {renderSortIcon('created_at')}
                  </th>
                  <th
                    style={{ padding: '12px 14px', textAlign: 'left', cursor: 'pointer', userSelect: 'none', width: '110px' }}
                    onClick={() => handleSort('score')}
                    title="Bấm vào để sắp xếp theo Điểm số"
                  >
                    Điểm số {renderSortIcon('score')}
                  </th>
                  <th style={{ padding: '12px 14px', textAlign: 'left' }}>Sinh viên</th>
                  <th style={{ padding: '12px 14px', textAlign: 'left', width: '120px' }}>Tiến độ</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right', width: '220px' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {paginatedGroups.map((group) => {
                  const progress = getGroupProgress(group);
                  const sem =
                    group.group?.student_1_details?.semester ||
                    group.group?.student_2_details?.semester ||
                    'Kỳ 1 2025-2026';
                  const score = getGroupScore(group);

                  return (
                    <tr
                      key={group.id}
                      style={{
                        backgroundColor: selectedGroupId === group.id ? '#f0f8ff' : undefined,
                        borderBottom: '1px solid #e2e8f0',
                      }}
                    >
                      <td style={{ padding: '12px 14px', fontWeight: 'bold', color: '#007bff' }}>
                        #{group.id}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: 600, color: '#1e293b' }}>{getGroupName(group)}</div>
                        <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Kỳ: {sem}</div>
                      </td>
                      <td
                        style={{ padding: '12px 14px', fontSize: '0.85rem', color: '#475569', whiteSpace: 'nowrap' }}
                        title={group.created_at ? new Date(group.created_at).toLocaleString('vi-VN') : ''}
                      >
                        {group.created_at ? getRelativeTime(group.created_at) : 'Mới tạo'}
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 600, color: score !== null ? '#10b981' : '#64748b' }}>
                        {score !== null ? `${score} / 10đ` : 'Chưa chấm'}
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: '0.85rem' }}>
                        <div>
                          {group.group?.student_1_details?.user?.username || 'N/A'}{' '}
                          {group.group?.student_1_details?.registration_no && (
                            <span style={{ color: '#64748b', fontSize: '0.8rem' }}>
                              ({group.group.student_1_details.registration_no})
                            </span>
                          )}
                        </div>
                        {group.group?.student_2_details && (
                          <div style={{ marginTop: '2px' }}>
                            {group.group.student_2_details.user?.username || 'N/A'}{' '}
                            {group.group.student_2_details.registration_no && (
                              <span style={{ color: '#64748b', fontSize: '0.8rem' }}>
                                ({group.group.student_2_details.registration_no})
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        {progress === 'on_track' ? (
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '10px',
                              backgroundColor: '#dcfce7',
                              color: '#166534',
                              border: '1px solid #bbf7d0',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            🟢 Đúng hạn
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '10px',
                              backgroundColor: '#fee2e2',
                              color: '#991b1b',
                              border: '1px solid #fecaca',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            🔴 Chậm tiến độ
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => onViewDocuments(group)}
                            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                            title="Tài liệu"
                          >
                            📄 Docs
                          </button>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => onViewEvaluations(group)}
                            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                            title="Đánh giá"
                          >
                            📝 Điểm
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => onOpenChat(group)}
                            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                            title="Trao đổi"
                          >
                            💬 Chat
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <TablePagination
            currentPage={currentPage}
            pageSize={pageSize}
            totalItems={sortedGroups.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setCurrentPage(1);
            }}
            pageSizeOptions={[10, 25, 50]}
          />
        </div>
      ) : (
        /* CARD GRID VIEW */
        <div>
          <div className="grid">
            {paginatedGroups.map((group) => {
              const sem =
                group.group?.student_1_details?.semester ||
                group.group?.student_2_details?.semester ||
                'Kỳ 1 2025-2026';
              const progress = getGroupProgress(group);

              return (
                <div
                  key={group.id}
                  className="card"
                  style={{
                    border: selectedGroupId === group.id ? '2px solid #007bff' : '1px solid #ddd',
                    backgroundColor: selectedGroupId === group.id ? '#f0f8ff' : 'white',
                    position: 'relative',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h3 style={{ margin: 0 }}>Group #{group.id}</h3>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: '10px',
                          backgroundColor: '#e2e8f0',
                          color: '#334155',
                        }}
                      >
                        📅 {sem}
                      </span>
                      {progress === 'on_track' ? (
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '10px',
                            backgroundColor: '#dcfce7',
                            color: '#166534',
                            border: '1px solid #bbf7d0',
                          }}
                        >
                          🟢 Đúng hạn
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '10px',
                            backgroundColor: '#fee2e2',
                            color: '#991b1b',
                            border: '1px solid #fecaca',
                          }}
                        >
                          🔴 Chậm tiến độ
                        </span>
                      )}
                    </div>
                  </div>

                  <p><strong>Project:</strong> {group.project?.project_name}</p>
                  <p>
                    <strong>Students:</strong> {group.group?.student_1_details?.user?.username || 'N/A'}{' '}
                    {group.group?.student_1_details?.registration_no && `(${group.group.student_1_details.registration_no})`} &{' '}
                    {group.group?.student_2_details?.user?.username || 'N/A'}{' '}
                    {group.group?.student_2_details?.registration_no && `(${group.group.student_2_details.registration_no})`}
                  </p>

                  <div style={{ display: 'flex', gap: '10px', marginTop: '16px', flexWrap: 'wrap' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => onViewDocuments(group)}
                      style={{ flex: 1, minWidth: '80px' }}
                    >
                      📄 Docs
                    </button>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => onViewEvaluations(group)}
                      style={{ flex: 1, minWidth: '80px' }}
                    >
                      📝 Evaluate
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => onOpenChat(group)}
                      style={{ flex: 1, minWidth: '80px' }}
                    >
                      💬 Chat
                    </button>
                    {onViewComments && (
                      <button
                        className={`btn btn-sm ${selectedGroupId === group.id ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => onViewComments(group)}
                        style={{ flex: 1, minWidth: '80px' }}
                      >
                        📋 Discuss
                      </button>
                    )}
                  </div>
                  {selectedGroupId === group.id && (
                    <p style={{ color: '#007bff', marginTop: '10px', fontWeight: 'bold', fontSize: '0.85rem' }}>
                      ✓ Currently Selected
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: '16px' }}>
            <TablePagination
              currentPage={currentPage}
              pageSize={pageSize}
              totalItems={sortedGroups.length}
              onPageChange={setCurrentPage}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setCurrentPage(1);
              }}
              pageSizeOptions={[10, 25, 50]}
            />
          </div>
        </div>
      )}
    </div>
  );
};

interface EvaluationData {
  config: EvaluationType;
  currentMarks: number;
  status: 'not-started' | 'in-progress' | 'completed';
}

const EvaluationsList: React.FC<{ groupId: number }> = ({ groupId }) => {
  const [evaluations, setEvaluations] = useState<EvaluationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvaluation, setSelectedEvaluation] = useState<EvaluationType | null>(null);

  useEffect(() => {
    loadEvaluations();
  }, [groupId]);

  const loadEvaluations = async () => {
    setLoading(true);
    const evaluationData: EvaluationData[] = [];

    for (const config of supervisorEvaluationConfigs) {
      try {
        const data = await config.getEvaluation(groupId);
        
        // Calculate current marks
        let currentMarks = 0;
        let hasAnyValue = false;
        let allCompleted = true;

        config.criteria.forEach((criterion) => {
          const status = data[criterion.field] || 'pending';
          if (status !== 'pending') {
            hasAnyValue = true;
            const percentages: { [key: string]: number } = {
              pending: 0,
              marginal: 15,
              adequate: 40,
              good: 70,
              excellent: 95,
            };
            currentMarks += ((percentages[status] || 0) / 100) * criterion.maxMarks;
          } else {
            allCompleted = false;
          }
        });

        let status: 'not-started' | 'in-progress' | 'completed' = 'not-started';
        if (allCompleted && hasAnyValue) {
          status = 'completed';
        } else if (hasAnyValue) {
          status = 'in-progress';
        }

        evaluationData.push({
          config,
          currentMarks,
          status,
        });
      } catch (error) {
        // If evaluation doesn't exist yet, add with zero marks
        evaluationData.push({
          config,
          currentMarks: 0,
          status: 'not-started',
        });
      }
    }

    setEvaluations(evaluationData);
    setLoading(false);
  };

  const handleEvaluationClick = (config: EvaluationType) => {
    setSelectedEvaluation(config);
  };

  const handleCloseForm = () => {
    setSelectedEvaluation(null);
  };

  const handleSaved = () => {
    loadEvaluations();
  };

  if (loading) {
    return <SkeletonEvaluationGrid count={5} />;
  }

  return (
    <div>
      <div className="evaluation-cards">
        {evaluations.map((evaluation) => {
          const percentage = (evaluation.currentMarks / evaluation.config.totalMaxMarks) * 100;
          
          return (
            <div
              key={evaluation.config.id}
              className="evaluation-card"
              onClick={() => handleEvaluationClick(evaluation.config)}
            >
              <div className="evaluation-card-header">
                <h3>{evaluation.config.name}</h3>
                <span className={`evaluation-card-status ${evaluation.status}`}>
                  {evaluation.status === 'not-started' && 'Not Started'}
                  {evaluation.status === 'in-progress' && 'In Progress'}
                  {evaluation.status === 'completed' && 'Completed'}
                </span>
              </div>
              
              <div className="evaluation-card-marks">
                <span className="current">{evaluation.currentMarks.toFixed(1)}</span>
                <span className="max">/ {evaluation.config.totalMaxMarks}</span>
              </div>
              
              <div className="evaluation-card-progress">
                <div
                  className="evaluation-card-progress-bar"
                  style={{ width: `${Math.min(percentage, 100)}%` }}
                />
              </div>
              
              <div className="evaluation-card-action">
                Click to {evaluation.status === 'not-started' ? 'start' : 'edit'} evaluation
              </div>
            </div>
          );
        })}
      </div>

      {selectedEvaluation && (
        <EvaluationForm
          groupId={groupId}
          evaluationType={selectedEvaluation}
          onClose={handleCloseForm}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
};

export default SupervisorDashboard;
