import { notify } from '../utils/notify';
import { formatFullName } from '../utils/nameHelper';
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
import { UTCCouncilLiveDefenseView } from '../components/UTCCouncilLiveDefenseView';
import CouncilConflictManager from '../components/CouncilConflictManager';
import { SkeletonProfile, SkeletonCardGrid, SkeletonEvaluationGrid } from '../components/SkeletonLoader';
import UTCEvaluationSheetModal from '../components/UTCEvaluationSheetModal';
import './Dashboard.css';
import './CommitteeMemberDashboard.css';
import '../components/EvaluationForm.css';
import '../components/SkeletonLoader.css';
import '../components/ExternalManagement.css';

interface MyCouncilItem {
  council_id: number;
  council_number: number;
  council_name: string;
  batch_id: number | null;
  batch_code: string | null;
  batch_name: string | null;
  role: string;
  role_display: string;
  session_date: string | null;
  session_time: string | null;
  defense_room: string | null;
  is_finalized: boolean;
  is_scores_locked: boolean;
  student_count: number;
}

const CommitteeMemberDashboard: React.FC = () => {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const committeeMember = user as CommitteeMember;
  const [activeTab, setActiveTab] = useState('utc_live_defense');
  const [profile, setProfile] = useState<CommitteeMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTemplateType, setSelectedTemplateType] = useState<string>('scope_document_template');
  const [panelGroups, setPanelGroups] = useState<SupervisorOfStudentGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<SupervisorOfStudentGroup | null>(null);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [showUTCSheet, setShowUTCSheet] = useState(false);

  // Multi-batch / Multi-council selector state (Item 26a)
  const [myCouncils, setMyCouncils] = useState<MyCouncilItem[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [selectedCouncilId, setSelectedCouncilId] = useState<number | null>(null);

  const uniqueBatches = React.useMemo(() => {
    const map = new Map<number, { batch_id: number; batch_code: string; batch_name: string }>();
    myCouncils.forEach((c) => {
      if (c.batch_id != null && !map.has(c.batch_id)) {
        map.set(c.batch_id, {
          batch_id: c.batch_id,
          batch_code: c.batch_code || `Đợt #${c.batch_id}`,
          batch_name: c.batch_name || c.batch_code || `Đợt #${c.batch_id}`,
        });
      }
    });
    return Array.from(map.values());
  }, [myCouncils]);

  const councilsInSelectedBatch = React.useMemo(() => {
    if (selectedBatchId == null) return myCouncils;
    return myCouncils.filter((c) => c.batch_id === selectedBatchId);
  }, [myCouncils, selectedBatchId]);

  useEffect(() => {
    loadData();
    loadMyCouncils();
  }, []);

  useEffect(() => {
    if (activeTab === 'groups' || activeTab === 'evaluations' || activeTab === 'documents') {
      loadPanelGroups();
    }
  }, [activeTab, selectedBatchId, selectedCouncilId]);

  // Auto-sync when internet reconnects without page reload
  useEffect(() => {
    const handleOnlineSync = () => {
      loadData();
      loadMyCouncils();
      if (activeTab === 'groups' || activeTab === 'evaluations' || activeTab === 'documents') {
        loadPanelGroups();
      }
    };
    window.addEventListener('app:online-sync', handleOnlineSync);
    return () => {
      window.removeEventListener('app:online-sync', handleOnlineSync);
    };
  }, [activeTab, selectedBatchId, selectedCouncilId]);

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

  const loadMyCouncils = async () => {
    try {
      const councils = await apiService.getMyCouncils();
      setMyCouncils(councils);
      if (councils.length > 0) {
        setSelectedBatchId((prev) => prev ?? councils[0].batch_id);
        setSelectedCouncilId((prev) => prev ?? councils[0].council_id);
      }
    } catch (error) {
      console.error('Failed to load my councils:', error);
    }
  };

  const handleBatchChange = (batchIdStr: string) => {
    const newBatchId = batchIdStr ? Number(batchIdStr) : null;
    setSelectedBatchId(newBatchId);
    const matching = newBatchId != null
      ? myCouncils.filter((c) => c.batch_id === newBatchId)
      : myCouncils;
    setSelectedCouncilId(matching.length > 0 ? matching[0].council_id : null);
    setSelectedGroup(null);
  };

  const handleCouncilChange = (councilIdStr: string) => {
    const newCouncilId = councilIdStr ? Number(councilIdStr) : null;
    setSelectedCouncilId(newCouncilId);
    setSelectedGroup(null);
  };

  const loadPanelGroups = async () => {
    try {
      setGroupsLoading(true);
      const params: { batch_id?: number; council_id?: number } = {};
      if (selectedCouncilId != null) params.council_id = selectedCouncilId;
      else if (selectedBatchId != null) params.batch_id = selectedBatchId;
      const response = await apiService.getCommitteeMemberGroups(params);
      const list = response.results || [];
      setPanelGroups(list);
      setSelectedGroup((prev) => {
        if (prev && list.some((g: any) => g.id === prev.id)) {
          return prev;
        }
        return list.length > 0 ? list[0] : null;
      });
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
      notify.error('Tải báo cáo thất bại, vui lòng thử lại.');
    }
  };

  if (loading || !committeeMember) {
    return (
      <div>
        <Navbar user={committeeMember} onLogout={logout} />
        <div className="container">
          <div className="dashboard-header">
            <h1>{t('dashboard.committeeTitle', 'Bảng Điều Khiển Hội Đồng Đánh Giá UTC')}</h1>
            <p>{t('committee.loadingDashboard', 'Đang tải bảng điều khiển Hội đồng...')}</p>
          </div>
          <div className="card">
            <SkeletonProfile />
          </div>
        </div>
      </div>
    );
  }

  return (
    <UTCAppLayout user={committeeMember} onLogout={logout} activeTab={activeTab} onTabChange={setActiveTab} portalRole="committee_member">
      <div className="container">
        <div className="dashboard-header">
          <h1>{t('dashboard.committeeTitle', 'Bảng Điều Khiển Hội Đồng Đánh Giá UTC')}</h1>
          <p>{t('dashboard.welcome', 'Xin chào')}, {committeeMember?.user?.username}</p>
        </div>

        {/* Multi-batch / Multi-council Selector Bar (Item 26a) */}
        {myCouncils.length > 0 && (
          <div className="utc-council-selector-bar">
            {uniqueBatches.length > 0 && (
              <div className="utc-council-selector-group">
                <label htmlFor="committee-batch-select">📅 {t('committee.batchLabel', 'Đợt ĐATN')}:</label>
                <select
                  id="committee-batch-select"
                  value={selectedBatchId ?? ''}
                  onChange={(e) => handleBatchChange(e.target.value)}
                >
                  {uniqueBatches.map((b) => (
                    <option key={b.batch_id} value={b.batch_id}>
                      {b.batch_code} - {b.batch_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="utc-council-selector-group">
              <label htmlFor="committee-council-select">🏛️ {t('committee.councilLabel', 'Hội đồng')}:</label>
              <select
                id="committee-council-select"
                value={selectedCouncilId ?? ''}
                onChange={(e) => handleCouncilChange(e.target.value)}
              >
                {councilsInSelectedBatch.map((c) => (
                  <option key={c.council_id} value={c.council_id}>
                    {c.council_name} ({c.role_display} • {c.student_count} SV)
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="tabs">
          <button
            className={`tab ${activeTab === 'utc_live_defense' ? 'active' : ''}`}
            onClick={() => setActiveTab('utc_live_defense')}
          >
            🏛️ Lịch Bảo Vệ & Chấm Điểm
          </button>
          <button
            className={`tab ${activeTab === 'groups' ? 'active' : ''}`}
            onClick={() => setActiveTab('groups')}
          >
            👥 Sinh Viên & Đồ Án
          </button>
          <button
            className={`tab ${activeTab === 'evaluations' ? 'active' : ''}`}
            onClick={() => setActiveTab('evaluations')}
          >
            📝 Chấm Điểm
          </button>
        </div>

        <div className="tab-content">
          {activeTab === 'utc_live_defense' && (
            <UTCCouncilLiveDefenseView
              councilId={selectedCouncilId}
              batchId={selectedBatchId}
            />
          )}
          {activeTab === 'council_conflicts' && <CouncilConflictManager />}

          {activeTab === 'overview' && (
            <>
              <div className="card">
                <h2>{t('profile.title', 'Thông Tin Cá Nhân & Hồ Sơ UTC')}</h2>
                <div className="profile-info">
                  <p><strong>{t('profile.supervisorId', 'Mã Hội Đồng')}:</strong> {profile?.committee_id}</p>
                  <p><strong>Hội Đồng Chấm:</strong> {profile?.panel_info?.name || `Hội đồng #${profile?.panel}` || 'N/A'}</p>
                </div>
              </div>

              {/* Panel Information */}
              {profile?.panel_info && (
                <div className="card" style={{ marginTop: '20px' }}>
                  <h2>📋 {t('committee.myPanel', 'Hội Đồng Của Tôi')}</h2>
                  <div className="profile-info">
                    <p><strong>{t('committee.panelName', 'Tên Hội Đồng')}:</strong> {profile.panel_info.name || `Hội đồng #${profile.panel_info.id}`}</p>
                  </div>
                  
                  {profile.panel_info.members && profile.panel_info.members.length > 0 ? (
                    <div style={{ marginTop: '15px' }}>
                      <h4 style={{ marginBottom: '10px' }}>{t('committee.otherMembers', 'Các Thành Viên Khác Trong Hội Đồng')}</h4>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                        {profile.panel_info.members.map(member => (
                          <div key={member.id} className="panel-member-chip">
                            <span style={{ fontWeight: '600' }}>
                              {formatFullName(member.user)}
                            </span>
                            <span className="student-reg-badge">
                              {member.committee_id}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="dashboard-section-desc" style={{ marginTop: '15px' }}>{t('committee.onlyMember', 'Bạn là thành viên duy nhất trong hội đồng này.')}</p>
                  )}
                  
                  <div className="panel-info-banner">
                    <p style={{ margin: 0, fontSize: '0.9rem' }}>
                      <strong>{t('committee.groupsAssigned', 'Số đồ án được phân công')}:</strong> {panelGroups.length} {t('committee.groupsAssignedDesc', 'đồ án được phân công cho hội đồng của bạn đánh giá.')}
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                <h2>{t('committee.groupsInPanel', 'Danh Sách Đồ Án Thuộc Hội Đồng')}</h2>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button className="btn btn-primary" onClick={handleExportConsolidatedReport}>
                    📊 {t('committee.exportGradeReport', 'Xuất Báo Cáo Điểm')}
                  </button>
                  <button className="btn btn-secondary" onClick={loadPanelGroups} disabled={groupsLoading}>
                    {groupsLoading ? t('committee.loading', 'Đang tải...') : t('committee.refresh', 'Làm mới')}
                  </button>
                </div>
              </div>
              <p className="dashboard-section-desc">
                {t('committee.groupsInPanelDesc', 'Đây là các sinh viên/đồ án được phân công cho hội đồng của bạn đánh giá. Chọn một đồ án để chấm điểm hoặc xem tài liệu đã nộp.')}
              </p>
              <PanelGroupsList
                groups={panelGroups}
                onSelectGroup={(group) => {
                  setSelectedGroup(group);
                  setActiveTab('evaluations');
                }}
                selectedGroupId={selectedGroup?.id}
                loading={groupsLoading}
                showDocumentsButton={false}
              />
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="card">
              {selectedGroup ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                      <h2>{t('committee.documentsTitle', 'Tài liệu - Đồ án #')}{selectedGroup.id}</h2>
                      <p className="dashboard-section-desc" style={{ marginTop: '8px' }}>
                        <strong>{t('committee.project', 'Đề tài')}:</strong> {selectedGroup.project?.project_name || 'N/A'} |{' '}
                        <strong>{t('committee.students', 'Sinh viên')}:</strong> {selectedGroup.group?.student_1_details?.user ? formatFullName(selectedGroup.group.student_1_details.user) : (selectedGroup.group as any)?.student_1?.name || selectedGroup.group?.student_1_details?.user?.username || 'N/A'}
                      </p>
                    </div>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setActiveTab('groups')}
                    >
                      {t('committee.changeGroup', 'Đổi đồ án')}
                    </button>
                  </div>
                  <GroupDocumentsList groupId={selectedGroup.id} />
                </>
              ) : (
                <div className="empty-state">
                  <h2>{t('committee.documents', 'Tài liệu')}</h2>
                  <p>{t('committee.selectGroupForDocs', 'Vui lòng chọn một đồ án ở tab "Sinh Viên & Đồ Án" để xem tài liệu đã nộp.')}</p>
                  <button
                    className="btn btn-primary"
                    onClick={() => setActiveTab('groups')}
                    style={{ marginTop: '16px' }}
                  >
                    {t('committee.goToPanelGroups', 'Đi tới Danh sách Đồ án')}
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'evaluations' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Khu vực chấm điểm trực tiếp Hội đồng Bảo vệ UTC (Thang 10) */}
              <UTCCouncilLiveDefenseView
                councilId={selectedCouncilId}
                batchId={selectedBatchId}
              />

              {/* Khu vực phiếu đánh giá chi tiết theo tiêu chí */}
              <div className="card">
                {panelGroups.length > 0 && (
                  <div className="utc-council-selector-bar" style={{ marginBottom: '16px' }}>
                    <div className="utc-council-selector-group">
                      <label htmlFor="eval-student-select">👨‍🎓 Chọn sinh viên / đồ án chấm phiếu tiêu chí:</label>
                      <select
                        id="eval-student-select"
                        value={selectedGroup?.id ?? ''}
                        onChange={(e) => {
                          const found = panelGroups.find((g) => Number(g.id) === Number(e.target.value));
                          if (found) setSelectedGroup(found);
                        }}
                      >
                        {panelGroups.map((g) => {
                          const stName = g.group?.student_1_details?.user
                            ? formatFullName(g.group.student_1_details.user)
                            : (g.group as any)?.student_1?.name || `Đồ án #${g.id}`;
                          const stReg = g.group?.student_1_details?.registration_no || '';
                          return (
                            <option key={g.id} value={g.id}>
                              {stName} {stReg ? `(${stReg})` : ''} — {g.project?.project_name || 'Đồ án'}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>
                )}

                {selectedGroup ? (
                  <>
                    <div style={{ marginBottom: '20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                        <div>
                          <h2>{t('committee.evaluationsForGroup', 'Phiếu Đánh Giá Tiêu Chí - Đồ án #')}{selectedGroup.id}</h2>
                          <p className="dashboard-section-desc" style={{ marginTop: '8px' }}>
                            <strong>{t('committee.project', 'Đề tài')}:</strong> {selectedGroup.project?.project_name || 'N/A'} |{' '}
                            <strong>{t('committee.students', 'Sinh viên')}:</strong> {selectedGroup.group?.student_1_details?.user ? formatFullName(selectedGroup.group.student_1_details.user) : (selectedGroup.group as any)?.student_1?.name || selectedGroup.group?.student_1_details?.user?.username || 'N/A'}
                          </p>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <button
                            className="btn btn-sm utc-print-sheet-btn"
                            onClick={() => setShowUTCSheet(true)}
                            title={t('committee.printScoreSheetTitle', 'Mở và in phiếu điểm đánh giá UTC')}
                          >
                            🖨️ {t('committee.printScoreSheet', 'In phiếu điểm')}
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setActiveTab('groups')}
                          >
                            {t('committee.changeGroup', 'Danh sách đồ án')}
                          </button>
                        </div>
                      </div>
                    </div>
                    <CommitteeEvaluationsList groupId={selectedGroup.id} />
                  </>
                ) : (
                  <div className="empty-state">
                    <h2>{t('committee.evaluations', 'Đánh Giá & Chấm Điểm')}</h2>
                    <p>{t('committee.noGroups', 'Chưa có sinh viên nào đủ điều kiện bảo vệ được phân công vào Hội đồng này.')}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'templates' && (
            <div>
              <div className="card" style={{ marginBottom: '20px' }}>
                <h2>{t('committee.templatesManagement', 'Quản Lý Biểu Mẫu')}</h2>
                <p className="dashboard-section-desc">
                  {t('committee.templatesDesc', 'Tải lên các biểu mẫu tài liệu chuẩn cho sinh viên tải về và sử dụng theo hướng dẫn.')}
                </p>
                <div className="form-group">
                  <label>{t('committee.templateType', 'Loại biểu mẫu')}</label>
                  <select
                    value={selectedTemplateType}
                    onChange={(e) => setSelectedTemplateType(e.target.value)}
                  >
                    <option value="scope_document_template">{t('committee.scopeTemplate', 'Biểu mẫu Đề cương')}</option>
                    <option value="srs_template">{t('committee.srsTemplate', 'Biểu mẫu Đặc tả yêu cầu (SRS)')}</option>
                    <option value="sdd_template">{t('committee.sddTemplate', 'Biểu mẫu Thiết kế hệ thống (SDD)')}</option>
                    <option value="final_report_template">{t('committee.finalReportTemplate', 'Biểu mẫu Báo cáo tốt nghiệp')}</option>
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

      {selectedGroup && (
        <UTCEvaluationSheetModal
          isOpen={showUTCSheet}
          onClose={() => setShowUTCSheet(false)}
          groupData={{
            groupId: selectedGroup.id,
            projectTitle: selectedGroup.project?.project_name || 'Đồ án tốt nghiệp UTC',
            facultyDepartment: 'Khoa Công nghệ Thông tin - UTC',
            student1Name: selectedGroup.group?.student_1_details?.user
              ? formatFullName(selectedGroup.group.student_1_details.user)
              : (selectedGroup.group as any)?.student_1?.name || selectedGroup.group?.student_1_details?.user?.username || 'Sinh viên 1',
            student1RegNo: selectedGroup.group?.student_1_details?.registration_no || (selectedGroup.group as any)?.student_1?.registration_no || 'N/A',
            student2Name: selectedGroup.group?.student_2_details?.user
              ? formatFullName(selectedGroup.group.student_2_details.user)
              : (selectedGroup.group as any)?.student_2?.name || selectedGroup.group?.student_2_details?.user?.username,
            student2RegNo: selectedGroup.group?.student_2_details?.registration_no || (selectedGroup.group as any)?.student_2?.registration_no,
            supervisorName: selectedGroup.supervisor?.user
              ? formatFullName(selectedGroup.supervisor.user)
              : (selectedGroup.supervisor as any)?.name || selectedGroup.supervisor?.user?.username || 'Chưa phân công',
            reviewerName: (selectedGroup as any).reviewer_name || undefined,
            committeeName: (selectedGroup as any).council_name || profile?.committee_id || 'Hội đồng Bảo vệ UTC',
            supervisorScore: (selectedGroup as any).supervisor_score ?? null,
            reviewerScore: (selectedGroup as any).reviewer_score ?? null,
            committeeScore: (selectedGroup as any).council_avg_score ?? null,
            finalScore10: (selectedGroup as any).final_score_10 ?? null,
            letterGrade: (selectedGroup as any).final_letter_grade ?? null,
            isPass: (selectedGroup as any).is_passed ?? null,
          }}
        />
      )}
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
  const { t } = useTranslation();

  const translateGroupStatus = (status: string) => {
    if (status === 'accepted') return t('committee.statusAccepted', 'Đã duyệt');
    if (status === 'rejected') return t('committee.statusRejected', 'Từ chối');
    if (status === 'pending') return t('committee.statusPending', 'Chờ duyệt');
    return status;
  };

  if (loading) {
    return <SkeletonCardGrid count={3} />;
  }

  if (groups.length === 0) {
    return (
      <div className="empty-state">
        {t('committee.noGroups', 'Chưa có đồ án nào được phân công cho hội đồng của bạn.')}
      </div>
    );
  }

  return (
    <div className="grid panel-groups-grid">
      {groups.map((group) => {
        const isSelected = selectedGroupId === group.id;
        const student1Name = group.group?.student_1_details?.user
          ? formatFullName(group.group.student_1_details.user)
          : (group.group as any)?.student_1?.name || group.group?.student_1_details?.user?.username || 'N/A';
        const student1Reg = group.group?.student_1_details?.registration_no || (group.group as any)?.student_1?.registration_no;
        const student2Name = group.group?.student_2_details?.user
          ? formatFullName(group.group.student_2_details.user)
          : (group.group as any)?.student_2?.name || group.group?.student_2_details?.user?.username;
        const student2Reg = group.group?.student_2_details?.registration_no || (group.group as any)?.student_2?.registration_no;
        const supervisorName = group.supervisor?.user
          ? formatFullName(group.supervisor.user)
          : (group.supervisor as any)?.name || group.supervisor?.user?.username || 'N/A';

        return (
          <div
            key={group.id}
            className={`card panel-group-card ${isSelected ? 'is-selected' : ''}`}
          >
            {isSelected && (
              <span className="selected-badge">
                {t('committee.selected', 'Đang chọn')}
              </span>
            )}
            <h3 className="panel-group-title">{t('committee.groupPrefix', 'Đồ án #')}{group.id}</h3>
            <div className="panel-group-body">
              <p className="panel-group-item">
                <span className="item-label">{t('committee.project', 'Đề tài')}:</span>
                <span className="item-value">{group.project?.project_name || 'N/A'}</span>
              </p>
              <div className="panel-group-item">
                <span className="item-label">{t('committee.students', 'Sinh viên')}:</span>
                <div className="students-list">
                  <div className="student-entry">
                    <span className="student-name">{student1Name}</span>
                    {student1Reg && (
                      <span className="student-reg-badge">{student1Reg}</span>
                    )}
                  </div>
                  {student2Name && (
                    <div className="student-entry">
                      <span className="student-name">{student2Name}</span>
                      {student2Reg && (
                        <span className="student-reg-badge">{student2Reg}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <p className="panel-group-item">
                <span className="item-label">{t('committee.supervisor', 'GVHD')}:</span>
                <span className="item-value">{supervisorName}</span>
              </p>
              <p className="panel-group-item">
                <span className="item-label">{t('committee.status', 'Trạng thái')}:</span>
                <div>
                  <span className={`badge badge-${group.status === 'accepted' ? 'success' : 'pending'}`}>
                    {translateGroupStatus(group.status)}
                  </span>
                </div>
              </p>
            </div>
            <div className="panel-group-actions">
              <button
                className="btn btn-primary btn-sm btn-evaluate"
                onClick={() => onSelectGroup(group)}
              >
                📝 {t('committee.evaluate', 'Chấm điểm')}
              </button>
              {showDocumentsButton && onViewDocuments && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => onViewDocuments(group)}
                  style={{ flex: 1 }}
                >
                  📄 {t('committee.documents', 'Tài liệu')}
                </button>
              )}
            </div>
          </div>
        );
      })}
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
  const { t } = useTranslation();
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
                  {evaluation.status === 'not-started' && t('committee.notStarted', 'Chưa chấm')}
                  {evaluation.status === 'in-progress' && t('committee.inProgress', 'Đang chấm')}
                  {evaluation.status === 'completed' && t('committee.completed', 'Hoàn thành')}
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
                {evaluation.status === 'not-started'
                  ? t('committee.clickToStart', 'Nhấn để bắt đầu chấm điểm')
                  : t('committee.clickToEdit', 'Nhấn để chỉnh sửa đánh giá')}
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
  { value: 'scope_document', label: 'Tài liệu Đề cương' },
  { value: 'srs_document', label: 'Tài liệu Đặc tả yêu cầu (SRS)' },
  { value: 'sdd_document', label: 'Tài liệu Thiết kế hệ thống (SDD)' },
  { value: 'final_report_document', label: 'Báo cáo Khóa luận tốt nghiệp' },
  { value: 'presentation_document', label: 'Slide Trình bày bảo vệ' },
];

const GroupDocumentsList: React.FC<{ groupId: number }> = ({ groupId }) => {
  const { t } = useTranslation();
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
      setError(t('committee.loadDocsError', 'Không thể tải danh sách tài liệu'));
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (fileUrl: string, fileName: string) => {
    try {
      await apiService.downloadDocument(fileUrl, fileName);
    } catch (err) {
      console.error('Failed to download document:', err);
      notify.error('Tải tài liệu thất bại.');
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

  const translateDocStatus = (status: string): string => {
    switch (status) {
      case 'accepted':
        return t('committee.statusAccepted', 'Đã duyệt');
      case 'rejected':
        return t('committee.statusRejected', 'Từ chối');
      case 'accepted_by_student':
        return 'SV đã xác nhận';
      case 'pending':
        return t('committee.statusPending', 'Chờ duyệt');
      default:
        return status.replace(/_/g, ' ');
    }
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
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
          {t('committee.retry', 'Thử lại')}
        </button>
      </div>
    );
  }

  const hasAnyDocuments = Object.keys(documents).length > 0;

  if (!hasAnyDocuments) {
    return (
      <div className="empty-state">
        <h3>{t('committee.noDocuments', 'Chưa có tài liệu')}</h3>
        <p>{t('committee.noDocumentsDesc', 'Sinh viên/nhóm này chưa nộp tài liệu nào tới hội đồng. Hội đồng chỉ thấy các tài liệu đã được GVHD duyệt và nộp lên.')}</p>
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
            <h3 style={{ marginBottom: '15px', borderBottom: '2px solid var(--divider, #e0e0e0)', paddingBottom: '8px' }}>
              {docType.label}
            </h3>
            <table className="table">
              <thead>
                <tr>
                  <th>{t('committee.docTitle', 'Tiêu đề')}</th>
                  <th>{t('committee.docStatus', 'Trạng thái')}</th>
                  <th>{t('committee.docUploaded', 'Ngày nộp')}</th>
                  <th>{t('committee.docActions', 'Thao tác')}</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((doc) => (
                  <tr key={doc.id}>
                    <td>{doc.title}</td>
                    <td>
                      <span className={`badge ${getStatusBadgeClass(doc.status)}`}>
                        {translateDocStatus(doc.status)}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-soft, #64748b)' }}>
                      {formatDate(doc.uploaded_at)}
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleDownload(doc.uploaded_file, `${doc.title}.${doc.uploaded_file.split('.').pop()}`)}
                      >
                        {t('committee.download', 'Tải xuống')}
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
          {t('committee.refreshDocuments', 'Làm mới tài liệu')}
        </button>
      </div>
    </div>
  );
};

export default CommitteeMemberDashboard;
