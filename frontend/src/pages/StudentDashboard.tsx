import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { apiService } from '../services/api';
import type { Student, Group, Project, ProjectCategory, SupervisorOfStudentGroup, ExternalEvaluation } from '../types';
import Navbar from '../components/Navbar';
import UTCAppLayout from '../components/UTCAppLayout';
import GroupRequestModal from '../components/GroupRequestModal';
import ProjectModal from '../components/ProjectModal';
import SupervisorRequestModal from '../components/SupervisorRequestModal';
import DocumentsList from '../components/DocumentsList';
import ChatRoom from '../components/ChatRoom';
import SupervisorRequestsList from '../components/SupervisorRequestsList';
import CommentsSection from '../components/CommentsSection';
import SearchFilter from '../components/SearchFilter';
import ExternalEvaluationView from '../components/ExternalEvaluationView';
import StudentTemplatesView from '../components/StudentTemplatesView';
import CommitteeOfferedProjects from '../components/CommitteeOfferedProjects';
import UTCFypTimeline from '../components/UTCFypTimeline';
import UTCEvaluationSheetModal from '../components/UTCEvaluationSheetModal';
import { UTCStudentGraduationView } from '../components/UTCStudentGraduationView';
import { SkeletonProfile, SkeletonCardGrid } from '../components/SkeletonLoader';
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
  const student = user as Student;
  const [activeTab, setActiveTab] = useState('overview');
  const [profile, setProfile] = useState<Student | null>(null);
  const [sentRequests, setSentRequests] = useState<Group[]>([]);
  const [receivedRequests, setReceivedRequests] = useState<Group[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectCategories, setProjectCategories] = useState<ProjectCategory[]>([]);
  const [supervisorRequests, setSupervisorRequests] = useState<SupervisorOfStudentGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showSupervisorModal, setShowSupervisorModal] = useState(false);
  const [projectSearch, setProjectSearch] = useState('');
  const [externalEvaluation, setExternalEvaluation] = useState<ExternalEvaluation | null>(null);
  const [externalLoading, setExternalLoading] = useState(false);
  const [selectedProjectForSupervisor, setSelectedProjectForSupervisor] = useState<Project | null>(null);
  const [showUTCSheet, setShowUTCSheet] = useState(false);

  const handleProjectSearch = useCallback((search: string) => {
    setProjectSearch(search);
    loadProjects(search);
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  // Reload projects when project tab is clicked
  useEffect(() => {
    if (activeTab === 'project' && profile?.groupmate_id) {
      loadProjects();
    }
  }, [activeTab, profile?.groupmate_id]);

  // Reload group requests when groups tab is clicked
  useEffect(() => {
    if (activeTab === 'groups' && !profile?.groupmate_id) {
      loadGroupRequests();
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

  const loadData = async () => {
    try {
      setLoading(true);
      const [profileData, categoriesData] = await Promise.all([
        apiService.getStudentProfile(),
        apiService.getProjectCategories(),
      ]);
      setProfile(profileData);
      setProjectCategories(categoriesData.results || []);

      if (profileData.groupmate_id) {
        const supervisorRequestsData = await apiService.getSupervisorRequests();
        setSupervisorRequests(supervisorRequestsData.results || []);
        // Load projects separately
        await loadProjects();
      } else {
        // Load group requests even if student doesn't have a group yet
        await loadGroupRequests();
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadGroupRequests = async () => {
    try {
      const [sentData, receivedData] = await Promise.all([
        apiService.getGroupRequests({ requested: 'to' }),
        apiService.getGroupRequests({ requested: 'from' }),
      ]);
      setSentRequests(sentData || []);
      setReceivedRequests(receivedData || []);
    } catch (error) {
      console.error('Failed to load group requests:', error);
      setSentRequests([]);
      setReceivedRequests([]);
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

  const handleGroupRequest = async (studentId: number, categoryId: number) => {
    try {
      await apiService.createGroupRequest({ 
        student_2: studentId, 
        project_category: categoryId 
      });
      await loadGroupRequests(); // Reload group requests
      setShowGroupModal(false);
      // Show success message (you can add a toast notification here)
      alert('Group request sent successfully!');
    } catch (error: any) {
      console.error('Failed to create group request:', error);
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.non_field_errors?.[0] ||
                          error.message || 
                          'Failed to send group request';
      alert(`Error: ${errorMessage}`);
      throw error; // Re-throw to let modal handle it
    }
  };

  const handleAcceptGroupRequest = async (groupId: number) => {
    try {
      await apiService.updateGroupRequest(groupId, { status: 'accepted' });
      await loadGroupRequests(); // Reload group requests
      await loadData(); // Reload full data to update profile
    } catch (error) {
      console.error('Failed to accept group request:', error);
      alert('Failed to accept group request. Please try again.');
    }
  };

  const handleRejectGroupRequest = async (groupId: number) => {
    try {
      await apiService.updateGroupRequest(groupId, { status: 'rejected' });
      await loadGroupRequests(); // Reload group requests
    } catch (error) {
      console.error('Failed to reject group request:', error);
      alert('Failed to reject group request. Please try again.');
    }
  };

  const handleCancelGroupRequest = async (groupId: number) => {
    const confirmed = window.confirm('Are you sure you want to cancel this group request? This action cannot be undone.');
    if (!confirmed) return;

    try {
      await apiService.updateGroupRequest(groupId, { status: 'canceled' });
      await loadGroupRequests(); // Reload group requests
      alert('Group request canceled successfully.');
    } catch (error) {
      console.error('Failed to cancel group request:', error);
      alert('Failed to cancel group request. Please try again.');
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

  return (
    <UTCAppLayout user={student} onLogout={logout} activeTab={activeTab} onTabChange={setActiveTab}>
      <div className="container">
        <div className="dashboard-header">
          <h1>{t('dashboard.studentTitle', 'Bảng Điều Khiển Sinh Viên UTC')}</h1>
          <p>{t('dashboard.welcome', 'Xin chào')}, {student?.user?.username}</p>
        </div>

        <div className="tabs">
          <button
            className={`tab ${activeTab === 'utc_graduation' ? 'active' : ''}`}
            onClick={() => setActiveTab('utc_graduation')}
            style={{ fontWeight: 'bold', background: activeTab === 'utc_graduation' ? '#003366' : undefined, color: activeTab === 'utc_graduation' ? '#fff' : undefined }}
          >
            🎓 Đồ Án Tốt Nghiệp UTC (Khảo sát, Báo cáo & Điểm)
          </button>
          <button
            className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            {t('nav.overview', 'Tổng Quan')}
          </button>
          {!profile?.groupmate_id && (
            <button
              className={`tab ${activeTab === 'groups' ? 'active' : ''}`}
              onClick={() => setActiveTab('groups')}
            >
              {t('nav.groups', 'Nhóm Đồ Án')}
            </button>
          )}
          {profile?.groupmate_id && (
            <>
              <button
                className={`tab ${activeTab === 'project' ? 'active' : ''}`}
                onClick={() => setActiveTab('project')}
              >
                {t('nav.project', 'Đề Tài Đồ Án')}
              </button>
              <button
                className={`tab ${activeTab === 'supervisor' ? 'active' : ''}`}
                onClick={() => setActiveTab('supervisor')}
              >
                {t('nav.supervisor', 'Giảng Viên Hướng Dẫn')}
              </button>
              <button
                className={`tab ${activeTab === 'documents' ? 'active' : ''}`}
                onClick={() => setActiveTab('documents')}
              >
                {t('nav.documents', 'Tài Liệu Đồ Án')}
              </button>
              <button
                className={`tab ${activeTab === 'chat' ? 'active' : ''}`}
                onClick={() => setActiveTab('chat')}
              >
                {t('nav.chat', 'Trao Đổi & Thảo Luận')}
              </button>
            </>
          )}
          <button
            className={`tab ${activeTab === 'templates' ? 'active' : ''}`}
            onClick={() => setActiveTab('templates')}
          >
            {t('nav.templates', 'Biểu Mẫu Chuẩn')}
          </button>
          {profile?.semester === '8' && (
            <button
              className={`tab ${activeTab === 'external' ? 'active' : ''}`}
              onClick={() => setActiveTab('external')}
            >
              {t('nav.externalManagement', 'Hội Đồng & Chấm Phản Biện')}
            </button>
          )}
        </div>

        <div className="tab-content">
          {activeTab === 'utc_graduation' && <UTCStudentGraduationView />}

          {activeTab === 'overview' && (
            <>
              {/* UTC FYP Progress Timeline */}
              <UTCFypTimeline currentStep={profile?.groupmate_id ? 3 : 1} />

              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h2 style={{ margin: 0 }}>{t('profile.title', 'Thông Tin Cá Nhân & Hồ Sơ UTC')}</h2>
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
                </div>
                <div className="profile-info">
                  <p><strong>{t('profile.regNo', 'Mã Số Sinh Viên')}:</strong> {profile?.registration_no}</p>
                  <p><strong>{t('profile.department', 'Khoa / Ngành Đào Tạo')}:</strong> {profile?.department || 'N/A'}</p>
                  <p><strong>{t('profile.semester', 'Học Kỳ Hiện Tại')}:</strong> {profile?.semester || 'N/A'}</p>
                  <p><strong>{t('profile.batch', 'Khóa Học')}:</strong> {profile?.batch_no || 'N/A'}</p>
                  <p><strong>{t('profile.groupStatus', 'Trạng Thái Nhóm')}:</strong> {profile?.groupmate_id ? t('profile.inGroup', 'Đã Có Nhóm') : t('profile.noGroup', 'Chưa Có Nhóm')}</p>
                </div>
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
                        <p><strong>Project:</strong> {acceptedGroup.project.project_name}</p>
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

          {activeTab === 'groups' && !profile?.groupmate_id && (
            <div>
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h2>Group Requests</h2>
                  <button className="btn btn-primary" onClick={() => setShowGroupModal(true)}>
                    Send Group Request
                  </button>
                </div>
                
                <div style={{ marginBottom: '30px' }}>
                  <h3 style={{ marginBottom: '15px', color: '#333' }}>Received Requests</h3>
                  {receivedRequests.length === 0 ? (
                    <div className="empty-state">No received requests</div>
                  ) : (
                    <GroupRequestsList
                      requests={receivedRequests}
                      onAccept={handleAcceptGroupRequest}
                      onReject={handleRejectGroupRequest}
                      showActions={true}
                    />
                  )}
                </div>

                <div>
                  <h3 style={{ marginBottom: '15px', color: '#333' }}>Sent Requests</h3>
                  {sentRequests.length === 0 ? (
                    <div className="empty-state">No sent requests</div>
                  ) : (
                    <GroupRequestsList
                      requests={sentRequests}
                      onAccept={handleAcceptGroupRequest}
                      onReject={handleRejectGroupRequest}
                      onCancel={handleCancelGroupRequest}
                      showActions={false}
                      showCancel={true}
                    />
                  )}
                </div>

                {/* Group Formation Comments */}
                {(receivedRequests.some(r => r.status === 'pending') || sentRequests.some(r => r.status === 'pending')) && (
                  <div style={{ marginTop: '30px' }}>
                    <h3 style={{ marginBottom: '15px', color: '#333' }}>Group Formation Discussion</h3>
                    {(() => {
                      // Show comments for the most recent pending group
                      const pendingGroup = receivedRequests.find(r => r.status === 'pending') 
                        || sentRequests.find(r => r.status === 'pending');
                      if (pendingGroup) {
                        return (
                          <CommentsSection
                            commentType="group"
                            groupId={pendingGroup.id}
                            currentUser={profile ? { id: profile.id, user_type: 'student' } : undefined}
                            autoRefresh={true}
                            refreshInterval={30000}
                          />
                        );
                      }
                      return null;
                    })()}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'project' && profile?.groupmate_id && (
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
                  searchPlaceholder="Search your projects by name, description, or language..."
                  onSearch={handleProjectSearch}
                  debounceDelay={400}
                />
                {projectsLoading ? (
                  <SkeletonCardGrid count={2} />
                ) : (
                  <div className="fade-in">
                    {projects.length === 0 && projectSearch ? (
                      <div className="empty-state">
                        <p>No projects found matching "{projectSearch}"</p>
                      </div>
                    ) : (
                      <ProjectsList
                        projects={projects}
                        selectedProjectId={selectedProjectForSupervisor?.id ?? null}
                        onSelectForSupervisor={(p) => setSelectedProjectForSupervisor(p)}
                      />
                    )}
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

          {activeTab === 'chat' && profile?.groupmate_id && (
            <>
              {(() => {
                const acceptedSupervisorGroup = supervisorRequests.find(r => r.status === 'accepted');
                if (acceptedSupervisorGroup) {
                  return <ChatRoom groupId={acceptedSupervisorGroup.id} />;
                } else {
                  return (
                    <div className="card">
                      <div className="empty-state">
                        <h3>No Active Supervisor</h3>
                        <p>You need an accepted supervisor to start chatting.</p>
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

      {showGroupModal && (
        <GroupRequestModal
          onClose={() => setShowGroupModal(false)}
          onSubmit={handleGroupRequest}
          projectCategories={projectCategories}
        />
      )}

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

const GroupRequestsList: React.FC<{
  requests: Group[];
  onAccept: (id: number) => void;
  onReject: (id: number) => void;
  onCancel?: (id: number) => void;
  showActions?: boolean;
  showCancel?: boolean;
}> = ({ requests, onAccept, onReject, onCancel, showActions = true, showCancel = false }) => {
  if (requests.length === 0) {
    return null; // Let parent handle empty state
  }

  const hasActionColumn = showActions || showCancel;

  return (
    <table className="table">
      <thead>
        <tr>
          <th>Student</th>
          <th>Category</th>
          <th>Status</th>
          {hasActionColumn && <th>Actions</th>}
        </tr>
      </thead>
      <tbody>
        {requests.map((req) => (
          <tr key={req.id}>
            <td>
              {req.student_1_details?.user.username || req.student_2_details?.user.username}
              {req.student_1_details && req.student_2_details && (
                <span style={{ color: '#666', fontSize: '12px', marginLeft: '8px' }}>
                  ({req.student_1_details.user.username} & {req.student_2_details.user.username})
                </span>
              )}
            </td>
            <td>{req.project_category_details?.category_name || 'N/A'}</td>
            <td>
              <span className={`badge badge-${req.status === 'accepted' ? 'success' : req.status === 'rejected' ? 'danger' : req.status === 'canceled' ? 'danger' : 'pending'}`}>
                {req.status}
              </span>
            </td>
            {hasActionColumn && (
              <td>
                {showActions && req.status === 'pending' && (
                  <>
                    <button className="btn btn-success btn-sm" onClick={() => onAccept(req.id)}>
                      Accept
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => onReject(req.id)}>
                      Reject
                    </button>
                  </>
                )}
                {showCancel && req.status === 'pending' && onCancel && (
                  <button className="btn btn-danger btn-sm" onClick={() => onCancel(req.id)}>
                    Cancel
                  </button>
                )}
                {req.status !== 'pending' && <span style={{ color: '#666' }}>-</span>}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
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
            <h3 style={{ marginBottom: '10px', color: '#333' }}>{project.project_name}</h3>
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
