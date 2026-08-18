import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { apiService } from '../services/api';
import type { Supervisor, SupervisorOfStudentGroup } from '../types';
import Navbar from '../components/Navbar';
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
import { SkeletonProfile, SkeletonEvaluationGrid } from '../components/SkeletonLoader';
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

  useEffect(() => {
    loadData();
  }, []);

  // Reload requests when requests tab is clicked
  useEffect(() => {
    if (activeTab === 'requests') {
      loadSupervisorRequests();
    }
  }, [activeTab]);

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
    <div>
      <Navbar user={supervisor} onLogout={logout} />
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
          {activeTab === 'overview' && (
            <>
              <UTCFypTimeline currentStep={3} />

              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h2 style={{ margin: 0 }}>{t('profile.title', 'Thông Tin Cá Nhân & Hồ Sơ UTC')}</h2>
                  <div style={{ display: 'flex', gap: '10px' }}>
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
                <div className="modal-overlay" onClick={handleCancelEdit}>
                  <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                    <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', borderBottom: '1px solid #e0e0e0' }}>
                      <h3 style={{ margin: 0 }}>Edit Profile</h3>
                      <button 
                        onClick={handleCancelEdit}
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
                        onClick={handleCancelEdit}
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
    </div>
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
  if (groups.length === 0) {
    return <div className="empty-state">No groups assigned</div>;
  }

  return (
    <div className="grid">
      {groups.map((group) => (
        <div 
          key={group.id} 
          className="card" 
          style={{ 
            border: selectedGroupId === group.id ? '2px solid #007bff' : '1px solid #ddd',
            backgroundColor: selectedGroupId === group.id ? '#f0f8ff' : 'white',
          }}
        >
          <h3>Group #{group.id}</h3>
          <p><strong>Project:</strong> {group.project?.project_name}</p>
          <p>
            <strong>Students:</strong> {group.group?.student_1_details?.user?.username || 'N/A'} &{' '}
            {group.group?.student_2_details?.user?.username || 'N/A'}
          </p>
          
          {/* Panel Assignment */}
          {group.project?.panel_info && (
            <div style={{ 
              marginTop: '10px', 
              padding: '8px 12px', 
              backgroundColor: '#e8f4f8', 
              borderRadius: '4px',
              border: '1px solid #bee5eb'
            }}>
              <p style={{ margin: 0, fontSize: '0.9rem' }}>
                <strong>📋 Panel:</strong> {group.project.panel_info.name || `Panel #${group.project.panel_info.id}`}
              </p>
              {group.project.panel_info.members && group.project.panel_info.members.length > 0 && (
                <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#555' }}>
                  Committee: {group.project.panel_info.members.map(m => 
                    m.user.first_name || m.user.username
                  ).join(', ')}
                </p>
              )}
            </div>
          )}
          
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
      ))}
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
