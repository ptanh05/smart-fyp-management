import React, { useState, useEffect, useRef } from 'react';
import { apiService } from '../services/api';
import { getRelativeTime } from '../utils/dateUtils';
import './UTCSupervisorGroupChatView.css';

interface UTCSupervisorGroupChatViewProps {
  isSupervisorView?: boolean;
  currentStudent?: any;
  supervisorProfile?: any;
}

export const UTCSupervisorGroupChatView: React.FC<UTCSupervisorGroupChatViewProps> = () => {
  const [groupInfo, setGroupInfo] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [searchMember, setSearchMember] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  const loadGroupData = async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      const data = await apiService.getSupervisorGroupInfo();
      setGroupInfo(data);
      setErrorMsg(null);
    } catch (err: any) {
      console.error('Lỗi tải nhóm đồ án GVHD:', err);
      setErrorMsg(err.response?.data?.message || err.message || 'Chưa tải được thông tin nhóm.');
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  const loadMessages = async () => {
    try {
      const msgs = await apiService.getSupervisorGroupMessages();
      setMessages((prev) => {
        // Only scroll if new messages arrived
        if (msgs.length !== prev.length) {
          setTimeout(() => scrollToBottom(true), 100);
        }
        return msgs;
      });
    } catch (err) {
      console.error('Lỗi tải tin nhắn nhóm:', err);
    }
  };

  // Initial load & Polling
  useEffect(() => {
    loadGroupData(true);
    loadMessages();

    // Live sync polling every 4 seconds
    pollIntervalRef.current = setInterval(() => {
      loadMessages();
    }, 4000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed && !selectedFile) return;

    try {
      setSending(true);
      if (selectedFile) {
        const fd = new FormData();
        fd.append('message', trimmed);
        fd.append('attachment', selectedFile);
        await apiService.sendSupervisorGroupMessage(fd);
      } else {
        await apiService.sendSupervisorGroupMessage({ message: trimmed });
      }

      setInputText('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      // Immediately refresh messages
      await loadMessages();
      setTimeout(() => scrollToBottom(true), 50);
    } catch (err: any) {
      alert('Lỗi gửi tin nhắn: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSending(false);
    }
  };

  const handleDeleteMessage = async (msgId: number) => {
    if (!window.confirm('Bạn có chắc muốn xóa tin nhắn này không?')) return;
    try {
      await apiService.deleteSupervisorGroupMessage(msgId);
      setMessages((prev) => prev.filter((m) => m.id !== msgId));
    } catch (err: any) {
      alert('Lỗi xóa tin nhắn: ' + (err.response?.data?.detail || err.message));
    }
  };

  if (loading) {
    return (
      <div className="utc-group-chat-loading">
        <div className="loading-spinner"></div>
        <p>Đang tải không gian nhóm đồ án & đoạn chat chung...</p>
      </div>
    );
  }

  if (!groupInfo || !groupInfo.has_group) {
    return (
      <div className="card utc-group-empty-card">
        <div className="utc-empty-icon">👥</div>
        <h2>Chưa Có Nhóm Đồ Án / Chưa Phân Công GVHD</h2>
        <p className="utc-empty-sub">
          {errorMsg || groupInfo?.message ||
            'Bạn chưa được phân công Giảng viên Hướng dẫn chính thức. Vui lòng hoàn thành mục Khảo sát & Nguyện vọng hoặc chờ Khoa công bố phân công để tham gia nhóm đồ án cùng Thầy/Cô.'}
        </p>
      </div>
    );
  }

  const { supervisor, members = [] } = groupInfo;
  const filteredMembers = members.filter((m: any) => {
    if (!searchMember) return true;
    const query = searchMember.toLowerCase();
    return (
      (m.full_name || '').toLowerCase().includes(query) ||
      (m.registration_no || '').toLowerCase().includes(query) ||
      (m.topic_title || '').toLowerCase().includes(query)
    );
  });

  return (
    <div className="utc-group-chat-container">
      {/* 1. Header Banner: Thông tin GVHD & Nhóm Đồ Án */}
      <div className="utc-group-header-card">
        <div className="utc-group-header-main">
          <div className="utc-sup-avatar-badge">
            <span>👨‍🏫</span>
          </div>
          <div className="utc-sup-details">
            <div className="utc-sup-tag-row">
              <span className="utc-sup-tag">GIẢNG VIÊN HƯỚNG DẪN</span>
              <span className="utc-dept-tag">{supervisor?.department || 'Khoa CNTT - UTC'}</span>
            </div>
            <h2 className="utc-sup-name">{supervisor?.name}</h2>
            <div className="utc-sup-meta">
              <span>📧 {supervisor?.email}</span>
              {supervisor?.research_interest && (
                <span>🔬 Lĩnh vực: <strong>{supervisor.research_interest}</strong></span>
              )}
            </div>
          </div>
        </div>

        <div className="utc-group-stats">
          <div className="utc-stat-item">
            <span className="utc-stat-num">{members.length}</span>
            <span className="utc-stat-lbl">Sinh viên cùng GVHD</span>
          </div>
          <div className="utc-stat-item highlight">
            <span className="utc-stat-num">{messages.length}</span>
            <span className="utc-stat-lbl">Tin nhắn trao đổi</span>
          </div>
        </div>
      </div>

      {/* 2. Main Workspace: Two-Column (Thành viên bên trái + Kênh Chat bên phải) */}
      <div className="utc-group-workspace">
        {/* Left Column: Danh sách các thành viên cùng 1 GVHD */}
        <div className="utc-group-members-col">
          <div className="utc-col-header">
            <h3>👥 Danh Sách Nhóm ({members.length})</h3>
            <span className="utc-cohort-hint">Cùng hướng dẫn bởi {supervisor?.name}</span>
          </div>

          <div className="utc-member-search-box">
            <input
              type="text"
              placeholder="🔍 Tìm MSSV, họ tên, đề tài..."
              value={searchMember}
              onChange={(e) => setSearchMember(e.target.value)}
            />
          </div>

          <div className="utc-members-list">
            {/* Mục GVHD ở đầu danh sách thành viên */}
            <div className="utc-member-item supervisor-item">
              <div className="utc-member-avatar sup">
                <span>⭐</span>
              </div>
              <div className="utc-member-info">
                <div className="utc-member-name-row">
                  <span className="utc-member-name font-bold">{supervisor?.name}</span>
                  <span className="utc-role-pill sup">GVHD</span>
                </div>
                <span className="utc-member-sub">{supervisor?.email}</span>
              </div>
            </div>

            {/* Danh sách sinh viên */}
            {filteredMembers.map((m: any) => (
              <div
                key={m.student_id}
                className={`utc-member-item ${m.is_current_user ? 'current-user-item' : ''}`}
              >
                <div className="utc-member-avatar student">
                  <span>{m.full_name?.charAt(0)?.toUpperCase() || 'S'}</span>
                </div>
                <div className="utc-member-info">
                  <div className="utc-member-name-row">
                    <span className="utc-member-name font-semibold">{m.full_name}</span>
                    {m.is_current_user ? (
                      <span className="utc-role-pill me">Bạn</span>
                    ) : (
                      <span className="utc-role-pill student">SV</span>
                    )}
                  </div>
                  <div className="utc-member-meta-row">
                    <span className="utc-member-reg font-mono">{m.registration_no}</span>
                    <span className="utc-member-status">{m.status}</span>
                  </div>
                  <div className="utc-member-topic" title={m.topic_title}>
                    📄 {m.topic_title}
                  </div>
                </div>
              </div>
            ))}

            {filteredMembers.length === 0 && (
              <div className="utc-no-members">Không tìm thấy sinh viên phù hợp.</div>
            )}
          </div>
        </div>

        {/* Right Column: Kênh Chat Chung (Group Chat) */}
        <div className="utc-group-chat-col">
          <div className="utc-chat-header">
            <div className="utc-chat-header-info">
              <div className="utc-chat-title-group">
                <span className="utc-chat-room-icon">💬</span>
                <div>
                  <h4>Kênh Trao Đổi Chung - Nhóm ĐATN</h4>
                  <p className="utc-chat-subtitle">
                    Kênh thảo luận công khai giữa Thầy/Cô {supervisor?.name} và toàn bộ {members.length} sinh viên hướng dẫn
                  </p>
                </div>
              </div>
            </div>

            <div className="utc-chat-badge-live">
              <span className="utc-live-dot"></span>
              <span>Đang kết nối</span>
            </div>
          </div>

          <div className="utc-chat-notice-banner">
            <span>📢</span>
            <p>
              Tất cả thành viên trong nhóm đồ án của Thầy/Cô có thể trao đổi bài học, hỏi đáp đề tài, thông báo lịch hẹn và chia sẻ tài liệu trực tiếp tại đây.
            </p>
          </div>

          {/* Messages Stream */}
          <div className="utc-messages-stream">
            {messages.length === 0 ? (
              <div className="utc-chat-empty-state">
                <div className="utc-chat-empty-icon">💬</div>
                <h4>Chưa có tin nhắn nào trong nhóm</h4>
                <p>Hãy gửi lời chào đầu tiên để bắt đầu thảo luận với Thầy/Cô và các bạn trong nhóm!</p>
              </div>
            ) : (
              messages.map((msg: any) => {
                const isSupervisor = msg.sender_role === 'supervisor';
                const isMe = msg.is_me;

                return (
                  <div
                    key={msg.id}
                    className={`utc-message-row ${isMe ? 'message-out' : 'message-in'} ${
                      isSupervisor ? 'from-supervisor' : ''
                    }`}
                  >
                    {!isMe && (
                      <div className={`utc-msg-avatar ${isSupervisor ? 'sup-avatar' : 'student-avatar'}`}>
                        {isSupervisor ? '👨‍🏫' : msg.sender_name?.charAt(0)?.toUpperCase() || 'S'}
                      </div>
                    )}

                    <div className="utc-msg-bubble-wrap">
                      <div className="utc-msg-sender-info">
                        <span className="utc-msg-sender-name font-semibold">{msg.sender_name}</span>
                        <span className={`utc-msg-role-tag ${isSupervisor ? 'sup' : 'student'}`}>
                          {msg.sender_role_label}
                        </span>
                        <span className="utc-msg-time">
                          {getRelativeTime(msg.created_at)}
                        </span>
                      </div>

                      <div className="utc-msg-bubble">
                        {msg.message && <p className="utc-msg-text">{msg.message}</p>}

                        {/* File Attachment */}
                        {msg.attachment && (
                          <div className="utc-msg-attachment">
                            <span className="utc-attachment-icon">📎</span>
                            <div className="utc-attachment-info">
                              <a
                                href={msg.attachment}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="utc-attachment-name"
                                title="Bấm để tải về / mở tệp"
                              >
                                {msg.attachment_name || 'Tệp đính kèm'}
                              </a>
                              {msg.attachment_size && (
                                <span className="utc-attachment-size">
                                  ({(msg.attachment_size / 1024).toFixed(1)} KB)
                                </span>
                              )}
                            </div>
                            <a
                              href={msg.attachment}
                              download
                              className="utc-download-btn"
                              title="Tải về"
                            >
                              ⬇️
                            </a>
                          </div>
                        )}

                        {/* Action buttons (Delete) */}
                        {isMe && (
                          <button
                            type="button"
                            className="utc-msg-del-btn"
                            onClick={() => handleDeleteMessage(msg.id)}
                            title="Xóa tin nhắn"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input Bar */}
          <form className="utc-chat-input-bar" onSubmit={handleSendMessage}>
            {selectedFile && (
              <div className="utc-selected-file-chip">
                <span>📎 {selectedFile.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                >
                  ✕
                </button>
              </div>
            )}

            <div className="utc-input-row">
              <label className="utc-attach-btn" title="Đính kèm tệp / tài liệu">
                <span>📎</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setSelectedFile(e.target.files[0]);
                    }
                  }}
                />
              </label>

              <textarea
                className="utc-chat-textarea"
                placeholder="Nhập tin nhắn thảo luận cho cả nhóm (Enter để gửi, Shift+Enter xuống dòng)..."
                rows={1}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e);
                  }
                }}
              />

              <button
                type="submit"
                className="utc-chat-send-btn"
                disabled={sending || (!inputText.trim() && !selectedFile)}
              >
                {sending ? '⏳' : 'Gửi ➔'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default UTCSupervisorGroupChatView;
