import React, { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/api';
import type { Student, ProjectGroup, GroupJoinRequestInfo, TopicStatus } from '../types';
import { useModalGuard } from '../utils/modalHooks';
import './StudentGroupManagement.css';

interface StudentGroupManagementProps {
  currentStudent: Student | null;
  onProfileRefresh?: () => void;
}

export const StudentGroupManagement: React.FC<StudentGroupManagementProps> = ({
  currentStudent,
  onProfileRefresh,
}) => {
  // State
  const [loading, setLoading] = useState(true);
  const [myGroup, setMyGroup] = useState<ProjectGroup | null>(null);
  const [recruitingGroups, setRecruitingGroups] = useState<ProjectGroup[]>([]);
  const [sentRequests, setSentRequests] = useState<GroupJoinRequestInfo[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Alerts
  const [alertInfo, setAlertInfo] = useState<{ type: 'success' | 'error' | 'warning' | 'info'; message: string } | null>(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [selectedGroupForJoin, setSelectedGroupForJoin] = useState<ProjectGroup | null>(null);
  const [joinMessage, setJoinMessage] = useState('');

  // Create Group Form
  const [createForm, setCreateForm] = useState({
    name: '',
    tentative_topic: '',
    tentative_description: '',
    max_members: 3,
  });
  const [createErrors, setCreateErrors] = useState<{ name?: string; general?: string }>({});
  const [submittingCreate, setSubmittingCreate] = useState(false);

  // Confirmations
  const [confirmAction, setConfirmAction] = useState<{
    type: 'kick' | 'leave' | 'disband' | 'transfer';
    targetId?: number;
    targetName?: string;
    title: string;
    message: string;
  } | null>(null);

  // Transfer Leadership Modal
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedMemberForLeader, setSelectedMemberForLeader] = useState<number | ''>('');

  // Rename Group Modal (Feature 1)
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [submittingRename, setSubmittingRename] = useState(false);

  // Topic Revision Form (Feature 15)
  const [topicForm, setTopicForm] = useState({
    topic_title: '',
    topic_description: '',
  });
  const [topicSubmitting, setTopicSubmitting] = useState(false);


  const isCreateDirty = Boolean(createForm.name.trim() || createForm.tentative_topic.trim() || createForm.tentative_description.trim());
  const createModalGuard = useModalGuard({
    isOpen: showCreateModal,
    onClose: () => setShowCreateModal(false),
    isDirty: isCreateDirty,
    confirmMessage: 'Bạn có dữ liệu tạo nhóm đang nhập dở. Bạn có chắc muốn đóng không?',
  });

  const isJoinDirty = Boolean(joinMessage.trim());
  const joinModalGuard = useModalGuard({
    isOpen: showJoinModal,
    onClose: () => setShowJoinModal(false),
    isDirty: isJoinDirty,
    confirmMessage: 'Bạn có lời nhắn xin gia nhập chưa gửi. Bạn có chắc muốn đóng không?',
  });

  const transferModalGuard = useModalGuard({
    isOpen: showTransferModal,
    onClose: () => setShowTransferModal(false),
    isDirty: Boolean(selectedMemberForLeader),
  });

  const isRenameDirty = Boolean(newGroupName.trim() && myGroup && newGroupName.trim() !== myGroup.group_name);
  const renameModalGuard = useModalGuard({
    isOpen: showRenameModal,
    onClose: () => setShowRenameModal(false),
    isDirty: isRenameDirty,
    confirmMessage: 'Bạn có thay đổi tên nhóm chưa lưu. Bạn có chắc muốn đóng không?',
  });

  const confirmDialogGuard = useModalGuard({
    isOpen: Boolean(confirmAction),
    onClose: () => setConfirmAction(null),
  });


  // --------------------------------------------------------------------------
  // Data Loading
  // --------------------------------------------------------------------------
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const myGroupRes = await apiService.getMyStudentGroup();
      if (myGroupRes.has_group && myGroupRes.group) {
        setMyGroup(myGroupRes.group);
        setTopicForm({
          topic_title: myGroupRes.group.tentative_topic || '',
          topic_description: myGroupRes.group.tentative_description || '',
        });
      } else {
        setMyGroup(null);
        // Load recruiting groups and sent join requests
        const [recruitingRes, requestsRes] = await Promise.all([
          apiService.getRecruitingGroups(searchQuery),
          apiService.getMySentJoinRequests(),
        ]);
        setRecruitingGroups(recruitingRes || []);
        setSentRequests(requestsRes || []);
      }
    } catch (err: any) {
      console.error('Error loading group data:', err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const showAlert = (type: 'success' | 'error' | 'warning' | 'info', message: string) => {
    setAlertInfo({ type, message });
    setTimeout(() => {
      setAlertInfo(null);
    }, 6000);
  };

  // --------------------------------------------------------------------------
  // Feature 2, 3, 4, 5: Create Group
  // --------------------------------------------------------------------------
  const handleOpenCreateModal = () => {
    if (myGroup) {
      // Feature 5: Đã có nhóm -> chặn
      showAlert('error', 'Bạn đã thuộc một nhóm đồ án, không thể tạo thêm');
      return;
    }
    setCreateForm({
      name: '',
      tentative_topic: '',
      tentative_description: '',
      max_members: 3,
    });
    setCreateErrors({});
    setShowCreateModal(true);
  };

  const handleCreateGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateErrors({});

    // Feature 3: Tên nhóm để trống hoặc chỉ có khoảng trắng
    const trimmedName = createForm.name.trim();
    if (!trimmedName) {
      setCreateErrors({ name: 'Tên nhóm không được để trống' });
      return;
    }

    try {
      setSubmittingCreate(true);
      const res = await apiService.createStudentGroup({
        name: trimmedName,
        tentative_topic: createForm.tentative_topic.trim(),
        tentative_description: createForm.tentative_description.trim(),
        max_members: createForm.max_members,
      });

      setShowCreateModal(false);
      showAlert('success', res.message || 'Tạo nhóm thành công! Bạn là Trưởng nhóm.');
      await loadData();
      if (onProfileRefresh) onProfileRefresh();
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.name?.[0] ||
        err.response?.data?.detail ||
        'Không thể tạo nhóm';

      // Feature 4: Tên nhóm đã tồn tại trong cùng kỳ
      if (msg.includes('đã tồn tại')) {
        setCreateErrors({ name: 'Tên nhóm đã tồn tại, vui lòng chọn tên khác' });
      } else if (msg.includes('đã thuộc một nhóm')) {
        // Feature 5
        setCreateErrors({ general: 'Bạn đã thuộc một nhóm đồ án, không thể tạo thêm' });
        showAlert('error', 'Bạn đã thuộc một nhóm đồ án, không thể tạo thêm');
      } else {
        setCreateErrors({ general: msg });
      }
    } finally {
      setSubmittingCreate(false);
    }
  };

  // --------------------------------------------------------------------------
  // Feature 6, 9: Request to Join Group
  // --------------------------------------------------------------------------
  const handleOpenJoinModal = (group: ProjectGroup) => {
    // Feature 9: Khóa nếu đã đủ sĩ số tối đa
    if (group.current_members_count >= group.max_members) {
      showAlert('error', 'Nhóm đã đủ số lượng thành viên tối đa');
      return;
    }
    setSelectedGroupForJoin(group);
    setJoinMessage('');
    setShowJoinModal(true);
  };

  const handleSendJoinRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroupForJoin) return;

    try {
      const res = await apiService.requestToJoinGroup(selectedGroupForJoin.id, joinMessage);
      setShowJoinModal(false);
      showAlert('success', res.message || 'Đã gửi yêu cầu gia nhập nhóm thành công!');
      await loadData();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Không thể gửi yêu cầu gia nhập';
      showAlert('error', msg);
    }
  };

  // --------------------------------------------------------------------------
  // Feature 7: Trưởng nhóm duyệt yêu cầu xin gia nhập
  // --------------------------------------------------------------------------
  const handleApproveRequest = async (reqId: number) => {
    try {
      const res = await apiService.approveJoinRequest(reqId);
      showAlert('success', res.message || 'Đã duyệt thành viên vào nhóm!');
      await loadData();
      if (onProfileRefresh) onProfileRefresh();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Không thể duyệt yêu cầu';
      showAlert('error', msg);
    }
  };

  // --------------------------------------------------------------------------
  // Feature 8: Trưởng nhóm từ chối yêu cầu xin gia nhập
  // --------------------------------------------------------------------------
  const handleRejectRequest = async (reqId: number) => {
    try {
      const res = await apiService.rejectJoinRequest(reqId);
      showAlert('info', res.message || 'Đã từ chối yêu cầu gia nhập.');
      await loadData();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Không thể từ chối yêu cầu';
      showAlert('error', msg);
    }
  };

  // --------------------------------------------------------------------------
  // Feature 10: Trưởng nhóm xóa thành viên (Kick member)
  // --------------------------------------------------------------------------
  const handleKickMemberClick = (memberId: number, memberName: string) => {
    setConfirmAction({
      type: 'kick',
      targetId: memberId,
      targetName: memberName,
      title: 'Xác nhận xóa thành viên',
      message: `Bạn có chắc chắn muốn xóa thành viên ${memberName} khỏi nhóm không? Thành viên này sẽ trở về trạng thái chưa có nhóm.`,
    });
  };

  // --------------------------------------------------------------------------
  // Feature 11, 12: Thành viên tự rời nhóm
  // --------------------------------------------------------------------------
  const handleLeaveGroupClick = () => {
    if (!myGroup) return;

    // Feature 12: Chặn rời nhóm khi đề tài đã được phê duyệt chính thức
    if (myGroup.topic_status === 'APPROVED') {
      alert('Đề tài đã được phê duyệt chính thức, không thể tự ý rời nhóm. Vui lòng liên hệ giảng viên/quản trị viên để giải quyết.');
      showAlert('error', 'Đề tài đã được phê duyệt chính thức, không thể tự ý rời nhóm. Vui lòng liên hệ giảng viên/quản trị viên để giải quyết.');
      return;
    }

    // Feature 11: Khi chưa chốt đề tài -> Cho phép rời
    setConfirmAction({
      type: 'leave',
      title: 'Xác nhận rời khỏi nhóm',
      message: 'Bạn có chắc chắn muốn rời khỏi nhóm đồ án này không? Bạn sẽ trở về trạng thái chưa có nhóm.',
    });
  };

  // --------------------------------------------------------------------------
  // Feature 13: Trưởng nhóm giải tán nhóm
  // --------------------------------------------------------------------------
  const handleDisbandGroupClick = () => {
    if (!myGroup) return;

    if (myGroup.topic_status === 'APPROVED') {
      showAlert('error', 'Đề tài đã được phê duyệt chính thức, không thể giải tán nhóm. Vui lòng liên hệ quản trị viên.');
      return;
    }

    setConfirmAction({
      type: 'disband',
      title: 'Cảnh báo: Giải tán nhóm đồ án',
      message: `Bạn có chắc chắn muốn giải tán nhóm "${myGroup.group_name}" không? Toàn bộ thành viên sẽ trở về trạng thái tự do và dữ liệu nhóm sẽ bị xóa.`,
    });
  };

  // --------------------------------------------------------------------------
  // Feature 14: Trưởng nhóm chuyển quyền Trưởng nhóm
  // --------------------------------------------------------------------------
  const handleOpenTransferModal = () => {
    setSelectedMemberForLeader('');
    setShowTransferModal(true);
  };

  const handleConfirmTransferSubmit = () => {
    if (!selectedMemberForLeader || !myGroup) return;
    const targetMember = myGroup.members.find((m) => m.student.id === Number(selectedMemberForLeader));
    const targetName = targetMember?.student.user.first_name || targetMember?.student.user.username || 'thành viên này';

    setShowTransferModal(false);
    setConfirmAction({
      type: 'transfer',
      targetId: Number(selectedMemberForLeader),
      targetName,
      title: 'Xác nhận chuyển quyền Trưởng nhóm',
      message: `Bạn có chắc chắn muốn chuyển quyền Trưởng nhóm cho ${targetName} không? Bạn sẽ trở thành thành viên bình thường.`,
    });
  };

  // Execute confirmed dialog action
  const handleExecuteConfirm = async () => {
    if (!confirmAction) return;

    try {
      if (confirmAction.type === 'kick' && confirmAction.targetId) {
        const res = await apiService.kickGroupMember(confirmAction.targetId);
        showAlert('success', res.message || 'Đã xóa thành viên khỏi nhóm.');
      } else if (confirmAction.type === 'leave') {
        const res = await apiService.leaveGroup();
        showAlert('success', res.message || 'Bạn đã rời khỏi nhóm thành công.');
      } else if (confirmAction.type === 'disband') {
        const res = await apiService.disbandGroup();
        showAlert('success', res.message || 'Nhóm đã được giải tán thành công.');
      } else if (confirmAction.type === 'transfer' && confirmAction.targetId) {
        const res = await apiService.transferLeadership(confirmAction.targetId);
        showAlert('success', res.message || 'Đã chuyển giao quyền Trưởng nhóm thành công!');
      }

      setConfirmAction(null);
      await loadData();
      if (onProfileRefresh) onProfileRefresh();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Thao tác không thành công';
      showAlert('error', msg);
      setConfirmAction(null);
    }
  };

  // --------------------------------------------------------------------------
  // Feature 1 (User Request): Trưởng nhóm đổi tên nhóm đồ án
  // --------------------------------------------------------------------------
  const handleOpenRenameModal = () => {
    if (!myGroup) return;
    setNewGroupName(myGroup.group_name);
    setRenameError(null);
    setShowRenameModal(true);
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newGroupName.trim();
    if (!trimmed) {
      setRenameError('Tên nhóm không được để trống.');
      return;
    }
    if (trimmed.length < 3) {
      setRenameError('Tên nhóm phải có ít nhất 3 ký tự.');
      return;
    }
    if (trimmed.length > 255) {
      setRenameError('Tên nhóm không được vượt quá 255 ký tự.');
      return;
    }

    try {
      setSubmittingRename(true);
      setRenameError(null);
      const res = await apiService.renameStudentGroup(trimmed);
      setMyGroup(res.group);
      setShowRenameModal(false);
      showAlert('success', res.message || 'Cập nhật tên nhóm thành công!');
      if (onProfileRefresh) onProfileRefresh();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Không thể đổi tên nhóm. Vui lòng thử lại.';
      setRenameError(msg);
    } finally {
      setSubmittingRename(false);
    }
  };

  // --------------------------------------------------------------------------
  // Feature 15: Chỉnh sửa nội dung đề xuất đề tài khi GVHD yêu cầu sửa
  // --------------------------------------------------------------------------

  const handleUpdateTopicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topicForm.topic_title.trim()) {
      showAlert('error', 'Vui lòng nhập tên đề tài đề xuất.');
      return;
    }

    try {
      setTopicSubmitting(true);
      const res = await apiService.updateTopicProposal({
        topic_title: topicForm.topic_title.trim(),
        topic_description: topicForm.topic_description.trim(),
      });
      showAlert('success', res.message || 'Cập nhật đề xuất thành công! Trạng thái chuyển về Chờ duyệt lại.');
      await loadData();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.topic_title?.[0] || 'Lỗi cập nhật đề tài';
      showAlert('error', msg);
    } finally {
      setTopicSubmitting(false);
    }
  };

  const getTopicStatusBadge = (status?: TopicStatus) => {
    switch (status) {
      case 'APPROVED':
        return <span className="status-pill status-approved">✓ Đã phê duyệt chính thức</span>;
      case 'REVISION_REQUESTED':
        return <span className="status-pill status-revision">⚠️ Yêu cầu chỉnh sửa</span>;
      case 'PENDING_REVIEW':
        return <span className="status-pill status-pending">⏳ Chờ duyệt lại</span>;
      case 'REJECTED':
        return <span className="status-pill status-rejected">✕ Từ chối</span>;
      default:
        return <span className="status-pill status-not-reg">Chưa đăng ký đề tài</span>;
    }
  };

  const isLeader = myGroup?.my_role === 'LEADER';

  // --------------------------------------------------------------------------
  // RENDER
  // --------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="section-card" style={{ textAlign: 'center', padding: '40px' }}>
        <p>Đang tải thông tin nhóm đồ án...</p>
      </div>
    );
  }

  return (
    <div className="group-mgmt-container">
      {/* Alert Notice */}
      {alertInfo && (
        <div className={`group-alert group-alert-${alertInfo.type}`}>
          <span>{alertInfo.message}</span>
          <button
            onClick={() => setAlertInfo(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* CASE A: SINH VIÊN ĐÃ CÓ NHÓM (MY GROUP VIEW)                          */}
      {/* ===================================================================== */}
      {myGroup ? (
        <>
          {/* Header Hero */}
          <div className="my-group-hero">
            <div className="my-group-hero-header">
              <div>
                <span style={{ fontSize: '0.85rem', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Nhóm Đồ Án Tốt Nghiệp
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <h1 className="my-group-title" style={{ margin: 0 }}>{myGroup.group_name}</h1>
                  {isLeader && (
                    <button
                      onClick={handleOpenRenameModal}
                      className="btn btn-secondary btn-sm"
                      style={{
                        background: 'rgba(255, 255, 255, 0.2)',
                        color: '#fff',
                        border: '1px solid rgba(255, 255, 255, 0.4)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        padding: '4px 12px',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                      }}
                      title="Trưởng nhóm đổi tên nhóm đồ án"
                    >
                      ✏️ Đổi tên nhóm
                    </button>
                  )}
                </div>
              </div>

              <div className="my-group-badges">
                {isLeader ? (
                  <span className="hero-badge hero-badge-leader">⭐ Trưởng nhóm (Leader)</span>
                ) : (
                  <span className="hero-badge">Thành viên (Member)</span>
                )}
                {myGroup.is_full ? (
                  <span className="hero-badge hero-badge-full">Đã đủ thành viên ({myGroup.current_members_count}/{myGroup.max_members})</span>
                ) : (
                  <span className="hero-badge hero-badge-open">Đang mở tuyển ({myGroup.current_members_count}/{myGroup.max_members})</span>
                )}
              </div>
            </div>

            <div className="my-group-details-grid">
              <div className="my-group-detail-item">
                <span className="my-group-detail-label">Đợt làm đồ án</span>
                <span className="my-group-detail-value">{myGroup.academic_batch_name || 'Kỳ chuẩn UTC'}</span>
              </div>
              <div className="my-group-detail-item">
                <span className="my-group-detail-label">Trưởng nhóm</span>
                <span className="my-group-detail-value">
                  {myGroup.leader?.user?.first_name || myGroup.leader?.user?.username} ({myGroup.leader?.registration_no})
                </span>
              </div>
              <div className="my-group-detail-item">
                <span className="my-group-detail-label">Sĩ số thành viên</span>
                <span className="my-group-detail-value">
                  {myGroup.current_members_count} / {myGroup.max_members} sinh viên
                </span>
              </div>
              <div className="my-group-detail-item">
                <span className="my-group-detail-label">Trạng thái đề tài</span>
                <div>{getTopicStatusBadge(myGroup.topic_status)}</div>
              </div>
            </div>
          </div>

          {/* Group Members Section */}
          <div className="section-card">
            <div className="section-card-header">
              <h3>👥 Danh Sách Thành Viên ({myGroup.members?.length || 0})</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                {isLeader ? (
                  <>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={handleOpenTransferModal}
                      title="Chuyển quyền Trưởng nhóm cho thành viên khác"
                      disabled={!myGroup.members || myGroup.members.length <= 1}
                    >
                      👑 Chuyển quyền Trưởng nhóm
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={handleDisbandGroupClick}
                      title="Giải tán nhóm khi chưa chốt đề tài"
                    >
                      🗑️ Giải tán nhóm
                    </button>
                  </>
                ) : (
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={handleLeaveGroupClick}
                    title="Rời khỏi nhóm"
                  >
                    🚪 Rời nhóm
                  </button>
                )}
              </div>
            </div>

            <div className="members-grid">
              {myGroup.members?.map((m) => {
                const memberStudent = m.student;
                const isThisMemberLeader = m.role === 'LEADER';
                const isMe = memberStudent.id === currentStudent?.id;

                return (
                  <div key={m.id} className="member-card">
                    <div className="member-card-header">
                      <div className="member-avatar">
                        {(memberStudent.user?.first_name || memberStudent.user?.username || 'S')[0].toUpperCase()}
                      </div>
                      <div className="member-info">
                        <p className="member-name">
                          {memberStudent.user?.first_name || memberStudent.user?.username}{' '}
                          {memberStudent.user?.last_name || ''} {isMe && '(Bạn)'}
                        </p>
                        <p className="member-reg">MSSV: {memberStudent.registration_no}</p>
                        <p className="member-reg">Khoa: {memberStudent.department || 'CNTT'}</p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className={`role-tag role-tag-${m.role.toLowerCase()}`}>
                        {isThisMemberLeader ? '⭐ Trưởng nhóm' : 'Thành viên'}
                      </span>

                      {/* Leader can kick member (Feature 10) */}
                      {isLeader && !isThisMemberLeader && (
                        <button
                          className="btn btn-outline btn-sm"
                          style={{ borderColor: '#ea4335', color: '#ea4335', padding: '4px 8px', fontSize: '0.8rem' }}
                          onClick={() =>
                            handleKickMemberClick(
                              memberStudent.id,
                              memberStudent.user?.first_name || memberStudent.user?.username
                            )
                          }
                        >
                          Xóa khỏi nhóm
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pending Join Requests (Leader Only - Feature 7, 8) */}
          {isLeader && (
            <div className="section-card">
              <div className="section-card-header">
                <h3>📬 Yêu Cầu Xin Gia Nhập Đang Chờ Duyệt ({myGroup.join_requests?.length || 0})</h3>
              </div>

              {!myGroup.join_requests || myGroup.join_requests.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: '#666' }}>
                  Hiện tại không có yêu cầu xin gia nhập nào đang chờ duyệt.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {myGroup.join_requests.map((req) => (
                    <div
                      key={req.id}
                      style={{
                        padding: '16px',
                        border: '1px solid #e0e6ed',
                        borderRadius: '8px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '12px',
                        background: '#fcfdfe',
                      }}
                    >
                      <div>
                        <strong>
                          {req.student.user.first_name || req.student.user.username} ({req.student.registration_no})
                        </strong>
                        <span style={{ color: '#666', fontSize: '0.85rem', marginLeft: '8px' }}>
                          Khoa: {req.student.department || 'CNTT'}
                        </span>
                        {req.message && (
                          <p style={{ margin: '6px 0 0 0', fontSize: '0.9rem', color: '#444', fontStyle: 'italic' }}>
                            &ldquo;{req.message}&rdquo;
                          </p>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleApproveRequest(req.id)}
                          disabled={myGroup.is_full}
                        >
                          ✓ Chấp nhận
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleRejectRequest(req.id)}
                        >
                          ✕ Từ chối
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Topic Proposal & Revision Section (Feature 15) */}
          <div className="section-card">
            <div className="section-card-header">
              <h3>📝 Đề Xuất Đề Tài Đồ Án Của Nhóm</h3>
              <div>{getTopicStatusBadge(myGroup.topic_status)}</div>
            </div>

            {/* If Revision Requested: Show Alert Box (Feature 15) */}
            {myGroup.topic_status === 'REVISION_REQUESTED' && (
              <div
                style={{
                  background: '#fff8e6',
                  borderLeft: '5px solid #f59e0b',
                  padding: '16px',
                  borderRadius: '6px',
                  marginBottom: '20px',
                }}
              >
                <strong style={{ color: '#b45309', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  ⚠️ Giảng viên hướng dẫn yêu cầu chỉnh sửa đề xuất đề tài:
                </strong>
                <p style={{ margin: '8px 0 0 0', color: '#92400e', fontSize: '0.95rem' }}>
                  {myGroup.topic_revision_notes || 'Vui lòng bổ sung rõ hơn về phạm vi và công nghệ áp dụng.'}
                </p>
              </div>
            )}

            {/* Proposal Details / Edit Form */}
            {myGroup.topic_status === 'REVISION_REQUESTED' || myGroup.topic_status === 'NOT_REGISTERED' ? (
              <form onSubmit={handleUpdateTopicSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="form-field">
                  <label htmlFor="topic-title">Tên đề tài đề xuất *</label>
                  <input
                    id="topic-title"
                    type="text"
                    value={topicForm.topic_title}
                    onChange={(e) => setTopicForm({ ...topicForm, topic_title: e.target.value })}
                    placeholder="Nhập tên đề tài tiếng Việt..."
                    required
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="topic-desc">Mô tả tóm tắt / Mục tiêu & Công nghệ dự kiến</label>
                  <textarea
                    id="topic-desc"
                    rows={4}
                    value={topicForm.topic_description}
                    onChange={(e) => setTopicForm({ ...topicForm, topic_description: e.target.value })}
                    placeholder="Mô tả nội dung nghiên cứu, bài toán cần giải quyết, công nghệ sử dụng..."
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="submit" className="btn btn-primary" disabled={topicSubmitting}>
                    {topicSubmitting ? 'Đang lưu...' : '📤 Cập nhật đề xuất (Gửi duyệt lại)'}
                  </button>
                </div>
              </form>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <strong style={{ color: '#555', fontSize: '0.85rem' }}>TÊN ĐỀ TÀI:</strong>
                  <p style={{ margin: '4px 0 0 0', fontSize: '1.1rem', fontWeight: 600, color: '#003366' }}>
                    {myGroup.tentative_topic || 'Chưa cập nhật tên đề tài'}
                  </p>
                </div>

                {myGroup.tentative_description && (
                  <div>
                    <strong style={{ color: '#555', fontSize: '0.85rem' }}>MÔ TẢ NỘI DUNG:</strong>
                    <p style={{ margin: '4px 0 0 0', color: '#333', fontSize: '0.95rem' }}>
                      {myGroup.tentative_description}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      ) : (
        /* =================================================================== */
        /* CASE B: SINH VIÊN CHƯA CÓ NHÓM (RECRUITING & CREATE VIEW)           */
        /* =================================================================== */
        <>
          {/* Header Banner */}
          <div className="group-mgmt-header">
            <div>
              <h2>🎓 Ghép Nhóm & Đăng Ký Nhóm Đồ Án</h2>
              <p>Bạn hiện chưa tham gia nhóm đồ án nào. Hãy tạo nhóm mới hoặc xin gia nhập các nhóm đang tuyển.</p>
            </div>
            <button className="btn btn-primary" onClick={handleOpenCreateModal} style={{ fontWeight: 600 }}>
              ➕ Tạo Nhóm Đồ Án Mới
            </button>
          </div>

          {/* Section: Recruiting Groups (Feature 1, 9) */}
          <div className="section-card">
            <div className="section-card-header">
              <h3>🔍 Danh Sách Nhóm Đang Mở Tuyển Thành Viên</h3>
              <div style={{ width: '300px' }}>
                <input
                  type="text"
                  placeholder="Tìm kiếm theo tên nhóm, đề tài..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #ccc' }}
                />
              </div>
            </div>

            {recruitingGroups.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                <p style={{ fontSize: '1.1rem' }}>Hiện chưa có nhóm nào mở tuyển thành viên.</p>
                <p>Hãy là người đầu tiên tạo nhóm và mời đồng đội tham gia!</p>
                <button className="btn btn-primary" onClick={handleOpenCreateModal} style={{ marginTop: '12px' }}>
                  ➕ Tạo Nhóm Mới
                </button>
              </div>
            ) : (
              <div className="recruiting-grid">
                {recruitingGroups.map((g) => {
                  const hasSentReq = g.my_join_request && g.my_join_request.status === 'PENDING';
                  const isFull = g.current_members_count >= g.max_members;

                  return (
                    <div key={g.id} className="recruiting-card">
                      <div>
                        <div className="recruiting-card-header">
                          <div>
                            <h4 className="recruiting-group-name">{g.group_name}</h4>
                            <span style={{ fontSize: '0.85rem', color: '#666' }}>
                              Trưởng nhóm:{' '}
                              <strong>
                                {g.leader?.user?.first_name || g.leader?.user?.username} ({g.leader?.registration_no})
                              </strong>
                            </span>
                          </div>
                          <span className={`slots-pill ${isFull ? 'slots-full' : 'slots-available'}`}>
                            {g.current_members_count}/{g.max_members} TV
                          </span>
                        </div>

                        {g.tentative_topic && (
                          <div className="recruiting-topic" style={{ marginTop: '12px' }}>
                            <strong>Đề tài dự kiến:</strong>
                            <p>{g.tentative_topic}</p>
                          </div>
                        )}

                        {g.tentative_description && (
                          <p style={{ margin: '8px 0 0 0', fontSize: '0.85rem', color: '#666' }}>
                            {g.tentative_description.length > 120
                              ? `${g.tentative_description.substring(0, 120)}...`
                              : g.tentative_description}
                          </p>
                        )}
                      </div>

                      <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: '12px' }}>
                        {hasSentReq ? (
                          <button className="btn btn-secondary btn-sm" disabled style={{ width: '100%' }}>
                            ⏳ Đã gửi yêu cầu (Chờ duyệt)
                          </button>
                        ) : (
                          <button
                            className="btn btn-primary btn-sm"
                            style={{ width: '100%' }}
                            onClick={() => handleOpenJoinModal(g)}
                            disabled={isFull}
                            title={isFull ? 'Nhóm đã đủ số lượng thành viên tối đa' : 'Gửi yêu cầu xin gia nhập nhóm'}
                          >
                            {isFull ? 'Đã đủ thành viên' : '📨 Xin gia nhập nhóm'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section: My Sent Join Requests */}
          {sentRequests.length > 0 && (
            <div className="section-card">
              <div className="section-card-header">
                <h3>📬 Yêu Cầu Xin Gia Nhập Đã Gửi Của Bạn ({sentRequests.length})</h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {sentRequests.map((req) => (
                  <div
                    key={req.id}
                    style={{
                      padding: '14px 18px',
                      borderRadius: '8px',
                      border: '1px solid #e0e6ed',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: '#fff',
                    }}
                  >
                    <div>
                      <strong>Nhóm: {req.group_name}</strong>
                      <span style={{ fontSize: '0.85rem', color: '#666', marginLeft: '12px' }}>
                        Ngày gửi: {new Date(req.created_at).toLocaleDateString('vi-VN')}
                      </span>
                      {req.message && (
                        <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#555' }}>
                          Lời nhắn: &ldquo;{req.message}&rdquo;
                        </p>
                      )}
                    </div>

                    <div>
                      {req.status === 'PENDING' && (
                        <span className="status-pill status-pending">⏳ Chờ duyệt</span>
                      )}
                      {req.status === 'ACCEPTED' && (
                        <span className="status-pill status-approved">✓ Đã chấp nhận</span>
                      )}
                      {req.status === 'REJECTED' && (
                        <span className="status-pill status-rejected">✕ Bị từ chối</span>
                      )}
                      {req.status === 'CANCELED' && (
                        <span className="status-pill status-not-reg">Đã hủy</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ===================================================================== */}
      {/* MODALS & CONFIRMATIONS                                                */}
      {/* ===================================================================== */}

      {/* Modal: Create Group (Feature 2, 3, 4, 5) */}
      {showCreateModal && (
        <div className="custom-modal-overlay" onClick={createModalGuard.handleOverlayClick}>
          <div className="custom-modal" onClick={(e) => e.stopPropagation()}>
            <div className="custom-modal-header">
              <h3>Tạo Nhóm Đồ Án Mới</h3>
              <button className="custom-modal-close" onClick={createModalGuard.requestClose}>
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateGroupSubmit}>
              <div className="custom-modal-body">
                {createErrors.general && (
                  <div className="group-alert group-alert-error" style={{ margin: 0 }}>
                    {createErrors.general}
                  </div>
                )}

                <div className="form-field">
                  <label htmlFor="modal-group-name">Tên nhóm đồ án *</label>
                  <input
                    id="modal-group-name"
                    type="text"
                    value={createForm.name}
                    onChange={(e) => {
                      setCreateForm({ ...createForm, name: e.target.value });
                      if (createErrors.name) setCreateErrors({ ...createErrors, name: undefined });
                    }}
                    placeholder="Ví dụ: Nhóm 01 - Smart Traffic AI"
                    autoFocus
                  />
                  {createErrors.name && <span className="field-error">{createErrors.name}</span>}
                </div>

                <div className="form-field">
                  <label htmlFor="modal-max-members">Số lượng thành viên tối đa</label>
                  <select
                    id="modal-max-members"
                    value={createForm.max_members}
                    onChange={(e) => setCreateForm({ ...createForm, max_members: Number(e.target.value) })}
                  >
                    <option value={2}>2 sinh viên</option>
                    <option value={3}>3 sinh viên (Khuyên dùng)</option>
                  </select>
                </div>

                <div className="form-field">
                  <label htmlFor="modal-tentative-topic">Đề tài dự kiến (Tùy chọn)</label>
                  <input
                    id="modal-tentative-topic"
                    type="text"
                    value={createForm.tentative_topic}
                    onChange={(e) => setCreateForm({ ...createForm, tentative_topic: e.target.value })}
                    placeholder="Ví dụ: Nghiên cứu nhận diện biển báo giao thông"
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="modal-tentative-desc">Mô tả tóm tắt đề tài (Tùy chọn)</label>
                  <textarea
                    id="modal-tentative-desc"
                    rows={3}
                    value={createForm.tentative_description}
                    onChange={(e) => setCreateForm({ ...createForm, tentative_description: e.target.value })}
                    placeholder="Nội dung cần làm, kỹ năng cần ở bạn cùng nhóm..."
                  />
                </div>
              </div>

              <div className="custom-modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={createModalGuard.requestClose}
                  disabled={submittingCreate}
                >
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary" disabled={submittingCreate}>
                  {submittingCreate ? 'Đang tạo nhóm...' : 'Tạo nhóm & Làm Trưởng nhóm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Request to Join (Feature 6) */}
      {showJoinModal && selectedGroupForJoin && (
        <div className="custom-modal-overlay" onClick={joinModalGuard.handleOverlayClick}>
          <div className="custom-modal" onClick={(e) => e.stopPropagation()}>
            <div className="custom-modal-header">
              <h3>Xin Gia Nhập: {selectedGroupForJoin.group_name}</h3>
              <button className="custom-modal-close" onClick={joinModalGuard.requestClose}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSendJoinRequest}>
              <div className="custom-modal-body">
                <p style={{ margin: 0, color: '#555', fontSize: '0.95rem' }}>
                  Gửi yêu cầu xin gia nhập đến Trưởng nhóm{' '}
                  <strong>
                    {selectedGroupForJoin.leader?.user?.first_name || selectedGroupForJoin.leader?.user?.username}
                  </strong>
                  .
                </p>

                <div className="form-field">
                  <label htmlFor="modal-join-msg">Lời nhắn gửi Trưởng nhóm (Tùy chọn)</label>
                  <textarea
                    id="modal-join-msg"
                    rows={4}
                    value={joinMessage}
                    onChange={(e) => setJoinMessage(e.target.value)}
                    placeholder="Giới thiệu bản thân, kỹ năng và định hướng làm đồ án..."
                    autoFocus
                  />
                </div>
              </div>

              <div className="custom-modal-footer">
                <button type="button" className="btn btn-secondary" onClick={joinModalGuard.requestClose}>
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary">
                  Gửi yêu cầu gia nhập
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Transfer Leadership (Feature 14) */}
      {showTransferModal && myGroup && (
        <div className="custom-modal-overlay" onClick={transferModalGuard.handleOverlayClick}>
          <div className="custom-modal" onClick={(e) => e.stopPropagation()}>
            <div className="custom-modal-header">
              <h3>👑 Chuyển Quyền Trưởng Nhóm</h3>
              <button className="custom-modal-close" onClick={transferModalGuard.requestClose}>
                ✕
              </button>
            </div>

            <div className="custom-modal-body">
              <p style={{ margin: 0, color: '#555' }}>
                Chọn một thành viên trong nhóm để chuyển giao quyền Trưởng nhóm (Leader):
              </p>

              <div className="form-field">
                <label htmlFor="select-new-leader">Chọn thành viên</label>
                <select
                  id="select-new-leader"
                  value={selectedMemberForLeader}
                  onChange={(e) => setSelectedMemberForLeader(e.target.value ? Number(e.target.value) : '')}
                >
                  <option value="">-- Chọn thành viên nhận quyền --</option>
                  {myGroup.members
                    ?.filter((m) => m.student.id !== currentStudent?.id)
                    .map((m) => (
                      <option key={m.student.id} value={m.student.id}>
                        {m.student.user.first_name || m.student.user.username} ({m.student.registration_no})
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="custom-modal-footer">
              <button type="button" className="btn btn-secondary" onClick={transferModalGuard.requestClose}>
                Hủy
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!selectedMemberForLeader}
                onClick={handleConfirmTransferSubmit}
              >
                Tiếp tục
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Rename Group (Feature 1) */}
      {showRenameModal && myGroup && (
        <div className="custom-modal-overlay" onClick={renameModalGuard.handleOverlayClick}>
          <div className="custom-modal" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="custom-modal-header">
              <h3>✏️ Đổi Tên Nhóm Đồ Án</h3>
              <button className="custom-modal-close" onClick={renameModalGuard.requestClose}>
                ✕
              </button>
            </div>

            <form onSubmit={handleRenameSubmit}>
              <div className="custom-modal-body">
                <p style={{ margin: '0 0 12px 0', color: '#64748b', fontSize: '0.9rem' }}>
                  Tên nhóm mới sẽ được cập nhật đồng bộ trên toàn bộ hệ thống cho tất cả thành viên.
                </p>

                {renameError && (
                  <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #f87171', borderRadius: '6px', color: '#dc2626', fontSize: '0.85rem', marginBottom: '12px' }}>
                    {renameError}
                  </div>
                )}

                <div className="form-field">
                  <label htmlFor="rename-group-input">
                    Tên nhóm mới <span className="required-star">*</span>
                  </label>
                  <input
                    id="rename-group-input"
                    type="text"
                    required
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="Nhập tên nhóm mới (tối thiểu 3 ký tự)..."
                    autoFocus
                  />
                  <span className="field-hint">Tên nhóm phải từ 3 - 255 ký tự và không trùng trong cùng kỳ đồ án.</span>
                </div>
              </div>

              <div className="custom-modal-footer">
                <button type="button" className="btn btn-secondary" onClick={renameModalGuard.requestClose}>
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary" disabled={submittingRename || !newGroupName.trim()}>
                  {submittingRename ? 'Đang lưu...' : 'Lưu tên mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Dialog (Kick, Leave, Disband, Transfer) */}
      {confirmAction && (
        <div className="custom-modal-overlay" onClick={confirmDialogGuard.handleOverlayClick}>
          <div className="custom-modal" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div className="custom-modal-header">
              <h3 style={{ color: confirmAction.type === 'disband' ? '#dc2626' : undefined }}>
                {confirmAction.title}
              </h3>
              <button className="custom-modal-close" onClick={confirmDialogGuard.requestClose}>
                ✕
              </button>
            </div>

            <div className="custom-modal-body">
              <p style={{ margin: 0, color: '#374151', fontSize: '0.95rem', lineHeight: 1.5 }}>
                {confirmAction.message}
              </p>
            </div>

            <div className="custom-modal-footer">
              <button type="button" className="btn btn-secondary" onClick={confirmDialogGuard.requestClose}>
                Hủy bỏ
              </button>
              <button
                type="button"
                className={`btn ${confirmAction.type === 'disband' || confirmAction.type === 'kick' ? 'btn-danger' : 'btn-primary'}`}
                onClick={handleExecuteConfirm}
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
