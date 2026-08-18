import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { apiService } from '../services/api';
import type { CommitteeMember, SupervisorOfStudentGroup, Document } from '../types';
import Navbar from '../components/Navbar';
import UTCAppLayout from '../components/UTCAppLayout';
import TemplatesList from '../components/TemplatesList';
import EvaluationForm, { committeeMemberEvaluationConfigs } from '../components/EvaluationForm';
import type { EvaluationType } from '../components/EvaluationForm';
import CommitteeMemberAnalytics from '../components/CommitteeMemberAnalytics';
import AuditLogViewer from '../components/AuditLogViewer';
import ExternalManagement from '../components/ExternalManagement';
import DocumentRequirementsManager from '../components/DocumentRequirementsManager';
import UTCFacultyAnalytics from '../components/UTCFacultyAnalytics';
import { SkeletonProfile, SkeletonCardGrid, SkeletonEvaluationGrid } from '../components/SkeletonLoader';
import './Dashboard.css';
import '../components/EvaluationForm.css';
import '../components/SkeletonLoader.css';
import '../components/ExternalManagement.css';

const CommitteeMemberDashboard: React.FC = () => {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const committeeMember = user as CommitteeMember;
  const [activeTab, setActiveTab] = useState('overview');
  const [profile, setProfile] = useState<CommitteeMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTemplateType, setSelectedTemplateType] = useState<string>('scope_document_template');
  const [panelGroups, setPanelGroups] = useState<SupervisorOfStudentGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<SupervisorOfStudentGroup | null>(null);
  const [groupsLoading, setGroupsLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeTab === 'groups' || activeTab === 'evaluations' || activeTab === 'documents') {
      loadPanelGroups();
    }
  }, [activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);
      const profileData = await apiService.getCommitteeMemberProfile();
      setProfile(profileData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPanelGroups = async () => {
    try {
      setGroupsLoading(true);
      const response = await apiService.getCommitteeMemberGroups();
      setPanelGroups(response.results || []);
    } catch (error) {
      console.error('Failed to load panel groups:', error);
      setPanelGroups([]);
    } finally {
      setGroupsLoading(false);
    }
  };

  const handleExportConsolidatedReport = async () => {
    try {
      await apiService.downloadConsolidatedReport();
    } catch (err) {
      console.error('Failed to download report:', err);
      alert('Failed to download report. Please try again.');
    }
  };

  if (loading || !committeeMember) {
    return (
      <div>
        <Navbar user={committeeMember} onLogout={logout} />
        <div className="container">
          <div className="dashboard-header">
            <h1>Committee Member Dashboard</h1>
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
    <UTCAppLayout user={committeeMember} onLogout={logout} activeTab={activeTab} onTabChange={setActiveTab}>
      <div className="container">
        <div className="dashboard-header">
          <h1>{t('dashboard.committeeTitle', 'Bảng Điều Khiển Hội Đồng Đánh Giá UTC')}</h1>
          <p>{t('dashboard.welcome', 'Xin chào')}, {committeeMember?.user?.username}</p>
        </div>

        <div className="tabs">
          <button
            className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            {t('nav.overview', 'Tổng Quan')}
          </button>
          <button
            className={`tab ${activeTab === 'groups' ? 'active' : ''}`}
            onClick={() => setActiveTab('groups')}
          >
            {t('nav.groups', 'Nhóm Đồ Án Hội Đồng')}
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
            className={`tab ${activeTab === 'templates' ? 'active' : ''}`}
            onClick={() => setActiveTab('templates')}
          >
            {t('nav.templates', 'Biểu Mẫu Chuẩn')}
          </button>
          <button
            className={`tab ${activeTab === 'doc-requirements' ? 'active' : ''}`}
            onClick={() => setActiveTab('doc-requirements')}
          >
            {t('nav.documents', 'Yêu Cầu Tài Liệu')}
          </button>
          <button
            className={`tab ${activeTab === 'audit' ? 'active' : ''}`}
            onClick={() => setActiveTab('audit')}
          >
            {t('nav.auditLogs', 'Nhật Ký Hệ Thống')}
          </button>
          <button
            className={`tab ${activeTab === 'external' ? 'active' : ''}`}
            onClick={() => setActiveTab('external')}
          >
            {t('nav.externalManagement', 'Hội Đồng & Chấm Phản Biện')}
          </button>
        </div>

        <div className="tab-content">
          {activeTab === 'overview' && (
            <>
              <div className="card">
                <h2>{t('profile.title', 'Thông Tin Cá Nhân & Hồ Sơ UTC')}</h2>
                <div className="profile-info">
                  <p><strong>{t('profile.supervisorId', 'Mã Hội Đồng')}:</strong> {profile?.committee_id}</p>
                  <p><strong>Hội Đồng Chấm:</strong> {profile?.panel_info?.name || `Panel #${profile?.panel}` || 'N/A'}</p>
                </div>
              </div>

              {/* Panel Information */}
              {profile?.panel_info && (
                <div className="card" style={{ marginTop: '20px' }}>
                  <h2>📋 My Panel</h2>
                  <div className="profile-info">
                    <p><strong>Panel Name:</strong> {profile.panel_info.name || `Panel #${profile.panel_info.id}`}</p>
                  </div>
                  
                  {profile.panel_info.members && profile.panel_info.members.length > 0 ? (
                    <div style={{ marginTop: '15px' }}>
                      <h4 style={{ marginBottom: '10px', color: '#555' }}>Other Panel Members</h4>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                        {profile.panel_info.members.map(member => (
                          <div 
                            key={member.id} 
                            style={{ 
                              padding: '10px 15px', 
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
                  ) : (
                    <p style={{ color: '#666', marginTop: '15px' }}>You are the only member in this panel.</p>
                  )}
                  
                  <div style={{ 
                    marginTop: '20px', 
                    padding: '12px', 
                    backgroundColor: '#e8f4f8', 
                    borderRadius: '4px',
                    border: '1px solid #bee5eb'
                  }}>
                    <p style={{ margin: 0, fontSize: '0.9rem' }}>
                      <strong>Groups Assigned:</strong> {panelGroups.length} group(s) are assigned to your panel for evaluation.
                    </p>
                  </div>
                </div>
              )}

              {/* Analytics Section */}
              <CommitteeMemberAnalytics />

              {/* UTC Faculty Analytics Breakdown */}
              <UTCFacultyAnalytics />
            </>
          )}

          {activeTab === 'groups' && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2>Groups in My Panel</h2>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button className="btn btn-primary" onClick={handleExportConsolidatedReport}>
                    📊 Export Grade Report
                  </button>
                  <button className="btn btn-secondary" onClick={loadPanelGroups} disabled={groupsLoading}>
                    {groupsLoading ? 'Loading...' : 'Refresh'}
                  </button>
                </div>
              </div>
              <p style={{ color: '#666', marginBottom: '20px' }}>
                These are the student groups assigned to your panel for evaluation. 
                Select a group to evaluate or view their submitted documents.
              </p>
              <PanelGroupsList
                groups={panelGroups}
                onSelectGroup={(group) => {
                  setSelectedGroup(group);
                  setActiveTab('evaluations');
                }}
                onViewDocuments={(group) => {
                  setSelectedGroup(group);
                  setActiveTab('documents');
                }}
                selectedGroupId={selectedGroup?.id}
                loading={groupsLoading}
                showDocumentsButton={true}
              />
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="card">
              {selectedGroup ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                    <div>
                      <h2>Documents - Group #{selectedGroup.id}</h2>
                      <p style={{ color: '#666', marginTop: '8px' }}>
                        <strong>Project:</strong> {selectedGroup.project?.project_name || 'N/A'} | 
                        <strong> Students:</strong> {selectedGroup.group?.student_1_details?.user?.username || 'N/A'} & {selectedGroup.group?.student_2_details?.user?.username || 'N/A'}
                      </p>
                    </div>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setActiveTab('groups')}
                    >
                      Change Group
                    </button>
                  </div>
                  <GroupDocumentsList groupId={selectedGroup.id} />
                </>
              ) : (
                <div className="empty-state">
                  <h2>Documents</h2>
                  <p>Please select a group from the "Panel Groups" tab to view their submitted documents.</p>
                  <button
                    className="btn btn-primary"
                    onClick={() => setActiveTab('groups')}
                    style={{ marginTop: '16px' }}
                  >
                    Go to Panel Groups
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'evaluations' && (
            <div className="card">
              {selectedGroup ? (
                <>
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h2>Evaluations for Group #{selectedGroup.id}</h2>
                        <p style={{ color: '#666', marginTop: '8px' }}>
                          <strong>Project:</strong> {selectedGroup.project?.project_name || 'N/A'} | 
                          <strong> Students:</strong> {selectedGroup.group?.student_1_details?.user?.username || 'N/A'} & {selectedGroup.group?.student_2_details?.user?.username || 'N/A'}
                        </p>
                      </div>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setActiveTab('groups')}
                      >
                        Change Group
                      </button>
                    </div>
                  </div>
                  <CommitteeEvaluationsList groupId={selectedGroup.id} />
                </>
              ) : (
                <div className="empty-state">
                  <h2>Evaluations</h2>
                  <p>Please select a group from the "Panel Groups" tab to view and manage evaluations.</p>
                  <button
                    className="btn btn-primary"
                    onClick={() => setActiveTab('groups')}
                    style={{ marginTop: '16px' }}
                  >
                    Go to Panel Groups
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'templates' && (
            <div>
              <div className="card" style={{ marginBottom: '20px' }}>
                <h2>Templates Management</h2>
                <p style={{ color: '#666', marginBottom: '20px' }}>
                  Upload document templates for students. Students can download these templates to use as guidelines.
                </p>
                <div className="form-group">
                  <label>Template Type</label>
                  <select
                    value={selectedTemplateType}
                    onChange={(e) => setSelectedTemplateType(e.target.value)}
                  >
                    <option value="scope_document_template">Scope Document Template</option>
                    <option value="srs_template">SRS Template</option>
                    <option value="sdd_template">SDD Template</option>
                    <option value="final_report_template">Final Report Template</option>
                  </select>
                </div>
              </div>
              <TemplatesList templateType={selectedTemplateType} />
            </div>
          )}

          {activeTab === 'doc-requirements' && (
            <DocumentRequirementsManager />
          )}

          {activeTab === 'audit' && (
            <AuditLogViewer />
          )}

          {activeTab === 'external' && (
            <div className="card">
              <ExternalManagement />
            </div>
          )}
        </div>
      </div>
    </UTCAppLayout>
  );
};

// Panel Groups List Component
const PanelGroupsList: React.FC<{
  groups: SupervisorOfStudentGroup[];
  onSelectGroup: (group: SupervisorOfStudentGroup) => void;
  onViewDocuments?: (group: SupervisorOfStudentGroup) => void;
  selectedGroupId?: number;
  loading: boolean;
  showDocumentsButton?: boolean;
}> = ({ groups, onSelectGroup, onViewDocuments, selectedGroupId, loading, showDocumentsButton = false }) => {
  if (loading) {
    return <SkeletonCardGrid count={3} />;
  }

  if (groups.length === 0) {
    return (
      <div className="empty-state">
        No groups assigned to your panel yet.
      </div>
    );
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
            position: 'relative',
          }}
        >
          {selectedGroupId === group.id && (
            <span style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              backgroundColor: '#007bff',
              color: 'white',
              fontSize: '0.7rem',
              padding: '2px 8px',
              borderRadius: '10px',
              fontWeight: 'bold',
            }}>
              Selected
            </span>
          )}
          <h3 style={{ marginBottom: '12px' }}>Group #{group.id}</h3>
          <div style={{ fontSize: '0.9rem', lineHeight: '1.6' }}>
            <p style={{ margin: '4px 0' }}>
              <strong>Project:</strong> {group.project?.project_name || 'N/A'}
            </p>
            <p style={{ margin: '4px 0' }}>
              <strong>Students:</strong><br />
              <span style={{ marginLeft: '8px' }}>
                {group.group?.student_1_details?.user?.username || 'N/A'} 
                {group.group?.student_1_details?.registration_no && (
                  <span style={{ color: '#666', fontSize: '0.85rem' }}> ({group.group.student_1_details.registration_no})</span>
                )}
              </span><br />
              <span style={{ marginLeft: '8px' }}>
                {group.group?.student_2_details?.user?.username || 'N/A'}
                {group.group?.student_2_details?.registration_no && (
                  <span style={{ color: '#666', fontSize: '0.85rem' }}> ({group.group.student_2_details.registration_no})</span>
                )}
              </span>
            </p>
            <p style={{ margin: '4px 0' }}>
              <strong>Supervisor:</strong> {group.supervisor?.user?.username || 'N/A'}
            </p>
            <p style={{ margin: '4px 0' }}>
              <strong>Status:</strong>{' '}
              <span className={`badge badge-${group.status === 'accepted' ? 'success' : 'pending'}`}>
                {group.status}
              </span>
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => onSelectGroup(group)}
              style={{ flex: 1 }}
            >
              📝 Evaluate
            </button>
            {showDocumentsButton && onViewDocuments && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => onViewDocuments(group)}
                style={{ flex: 1 }}
              >
                📄 Documents
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

// Committee Evaluations List Component
interface EvaluationData {
  config: EvaluationType;
  currentMarks: number;
  status: 'not-started' | 'in-progress' | 'completed';
}

const CommitteeEvaluationsList: React.FC<{ groupId: number }> = ({ groupId }) => {
  const [evaluations, setEvaluations] = useState<EvaluationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvaluation, setSelectedEvaluation] = useState<EvaluationType | null>(null);

  useEffect(() => {
    loadEvaluations();
  }, [groupId]);

  const loadEvaluations = async () => {
    setLoading(true);
    const evaluationData: EvaluationData[] = [];

    for (const config of committeeMemberEvaluationConfigs) {
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
    return <SkeletonEvaluationGrid count={4} />;
  }

  return (
    <div className="fade-in">
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

// Group Documents List Component for Committee Members
const DOCUMENT_TYPES = [
  { value: 'scope_document', label: 'Scope Document' },
  { value: 'srs_document', label: 'SRS Document' },
  { value: 'sdd_document', label: 'SDD Document' },
  { value: 'final_report_document', label: 'Final Report' },
  { value: 'presentation_document', label: 'Presentation' },
];

const GroupDocumentsList: React.FC<{ groupId: number }> = ({ groupId }) => {
  const [documents, setDocuments] = useState<{ [key: string]: Document[] }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDocuments();
  }, [groupId]);

  const loadDocuments = async () => {
    setLoading(true);
    setError(null);
    const docsByType: { [key: string]: Document[] } = {};

    try {
      for (const docType of DOCUMENT_TYPES) {
        try {
          const docs = await apiService.getDocuments(docType.value, groupId);
          if (docs && docs.length > 0) {
            docsByType[docType.value] = docs;
          }
        } catch (err) {
          // Silently skip if no documents of this type
        }
      }
      setDocuments(docsByType);
    } catch (err: any) {
      console.error('Failed to load documents:', err);
      setError('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (fileUrl: string, fileName: string) => {
    try {
      await apiService.downloadDocument(fileUrl, fileName);
    } catch (err) {
      console.error('Failed to download document:', err);
      alert('Failed to download document');
    }
  };

  const getStatusBadgeClass = (status: string): string => {
    switch (status) {
      case 'accepted':
        return 'badge-success';
      case 'rejected':
        return 'badge-danger';
      case 'accepted_by_student':
        return 'badge-warning';
      default:
        return 'badge-pending';
    }
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return <SkeletonCardGrid count={3} />;
  }

  if (error) {
    return (
      <div className="empty-state">
        <p style={{ color: '#dc3545' }}>{error}</p>
        <button className="btn btn-primary" onClick={loadDocuments} style={{ marginTop: '10px' }}>
          Retry
        </button>
      </div>
    );
  }

  const hasAnyDocuments = Object.keys(documents).length > 0;

  if (!hasAnyDocuments) {
    return (
      <div className="empty-state">
        <h3>No Documents</h3>
        <p>This group has not submitted any documents to the committee yet. Committee sees only documents that students have submitted after supervisor acceptance.</p>
      </div>
    );
  }

  return (
    <div className="fade-in">
      {DOCUMENT_TYPES.map((docType) => {
        const docs = documents[docType.value];
        if (!docs || docs.length === 0) return null;

        return (
          <div key={docType.value} style={{ marginBottom: '30px' }}>
            <h3 style={{ marginBottom: '15px', color: '#333', borderBottom: '2px solid #e0e0e0', paddingBottom: '8px' }}>
              {docType.label}
            </h3>
            <table className="table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Uploaded</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((doc) => (
                  <tr key={doc.id}>
                    <td>{doc.title}</td>
                    <td>
                      <span className={`badge ${getStatusBadgeClass(doc.status)}`}>
                        {doc.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.85rem', color: '#666' }}>
                      {formatDate(doc.uploaded_at)}
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleDownload(doc.uploaded_file, `${doc.title}.${doc.uploaded_file.split('.').pop()}`)}
                      >
                        Download
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
      <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-secondary" onClick={loadDocuments}>
          Refresh Documents
        </button>
      </div>
    </div>
  );
};

export default CommitteeMemberDashboard;
