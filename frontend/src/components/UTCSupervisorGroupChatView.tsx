import { formatFullName } from '../utils/nameHelper';
import React, { useState, useEffect, useRef } from 'react';
import { apiService } from '../services/api';
import { getRelativeTime } from '../utils/dateUtils';
import './UTCSupervisorGroupChatView.css';

interface UTCSupervisorGroupChatViewProps {
  isSupervisorView?: boolean;
  currentStudent?: any;
  supervisorProfile?: any;
}

const EMOJI_LIST = ['👍', '❤️', '😄', '😮', '😢', '🔥'];

export const UTCSupervisorGroupChatView: React.FC<UTCSupervisorGroupChatViewProps> = () => {
  const [groupInfo, setGroupInfo] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [searchMember, setSearchMember] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Advanced features states
  const [replyingTo, setReplyingTo] = useState<any | null>(null);
  const [activeEmojiPickerId, setActiveEmojiPickerId] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const showToast = (text: string) => {
    setToastMessage(text);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  const scrollToMessage = (msgId: number) => {
    const el = document.getElementById(`utc-msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('utc-msg-highlight');
      setTimeout(() => {
        el.classList.remove('utc-msg-highlight');
      }, 2200);
    }
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

    pollIntervalRef.current = setInterval(() => {
      loadMessages();
    }, 4000);

    // Close emoji picker on click outside
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.utc-msg-actions-toolbar') && !target.closest('.utc-emoji-picker-popup')) {
        setActiveEmojiPickerId(null);
      }
    };
    document.addEventListener('click', handleDocumentClick);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      document.removeEventListener('click', handleDocumentClick);
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
        if (replyingTo) {
          fd.append('reply_to_id', String(replyingTo.id));
        }
        await apiService.sendSupervisorGroupMessage(fd);
      } else {
        const payload: any = { message: trimmed };
        if (replyingTo) {
          payload.reply_to_id = replyingTo.id;
        }
        await apiService.sendSupervisorGroupMessage(payload);
      }

      setInputText('');
      setSelectedFile(null);
      setReplyingTo(null);
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
    if (!window.confirm('Bạn có chắc chắn muốn xóa tin nhắn này?')) return;
    try {
      await apiService.deleteSupervisorGroupMessage(msgId);
      setMessages((prev) => prev.filter((m) => m.id !== msgId));
      showToast('Đã xóa tin nhắn.');
    } catch (err: any) {
      alert('Lỗi xóa tin nhắn: ' + (err.response?.data?.detail || err.message));
    }
  };

  // 1. Download file handler
  const handleDownloadFile = async (e: React.MouseEvent, msgId: number, fileUrl: string, fileName?: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      setDownloadingId(msgId);
      showToast('Đang tải tệp xuống thiết bị...');
      await apiService.downloadFile(fileUrl, fileName);
    } catch (err: any) {
      alert('Lỗi tải tệp: ' + (err.message || 'Không thể tải tệp'));
    } finally {
      setDownloadingId(null);
    }
  };

  // 2. Reaction handler
  const handleToggleReaction = async (msgId: number, emoji: string) => {
    setActiveEmojiPickerId(null);
    try {
      const res = await apiService.toggleSupervisorGroupMessageReaction(msgId, emoji);
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, reactions: res.reactions } : m))
      );
    } catch (err: any) {
      console.error('Lỗi thả cảm xúc:', err);
    }
  };

  // 3. Copy message handler
  const handleCopyMessage = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast('📋 Đã sao chép nội dung tin nhắn!');
    } catch (err) {
      showToast('Không thể sao chép văn bản');
    }
  };

  // 4. Reply message handler
  const handleReplyMessage = (msg: any) => {
    setReplyingTo(msg);
    chatInputRef.current?.focus();
  };

  // 5. Pin message handler
  const handleTogglePin = async (msgId: number) => {
    try {
      const res = await apiService.togglePinSupervisorGroupMessage(msgId);
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, is_pinned: res.is_pinned } : m))
      );
      showToast(res.is_pinned ? '📌 Đã ghim tin nhắn lên đầu nhóm!' : 'Đã bỏ ghim tin nhắn.');
    } catch (err: any) {
      alert('Lỗi ghim tin nhắn: ' + (err.response?.data?.detail || err.message));
    }
  };

  if (loading && !groupInfo) {
    return (
      <div className="utc-group-chat-loading">
        <div className="utc-spinner"></div>
        <p>Đang tải thông tin nhóm đồ án và kênh trao đổi...</p>
      </div>
    );
  }

  if (errorMsg && !groupInfo) {
    return (
      <div className="utc-group-chat-error-card">
        <span className="utc-err-icon">⚠️</span>
        <h3>Không thể tải thông tin nhóm</h3>
        <p>{errorMsg}</p>
        <button onClick={() => loadGroupData(true)} className="utc-retry-btn">
          Thử lại
        </button>
      </div>
    );
  }

  const supervisor = groupInfo?.supervisor;
  const members = groupInfo?.members || [];
  const currentUsername = members.find((m: any) => m.is_current_user)?.username;

  // Filter members by search input
  const filteredMembers = members.filter((m: any) => {
    const q = searchMember.toLowerCase();
    const formattedName = formatFullName(m.full_name).toLowerCase();
    return (
      formattedName.includes(q) ||
      m.registration_no?.toLowerCase().includes(q) ||
      m.topic_title?.toLowerCase().includes(q)
    );
  });

  // Pinned messages
  const pinnedMessages = messages.filter((m) => m.is_pinned);
  const latestPinned = pinnedMessages.length > 0 ? pinnedMessages[pinnedMessages.length - 1] : null;

  return (
    <div className="utc-group-chat-container">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="utc-chat-toast">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. Header Overview Card */}
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

      {/* 2. Main Workspace: Two-Column */}
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
                  <span>{formatFullName(m.full_name)?.charAt(0)?.toUpperCase() || 'S'}</span>
                </div>
                <div className="utc-member-info">
                  <div className="utc-member-name-row">
                    <span className="utc-member-name font-semibold">{formatFullName(m.full_name)}</span>
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

          {/* Banner Thông báo */}
          <div className="utc-chat-notice-banner">
            <span>📢</span>
            <p>
              Tất cả thành viên trong nhóm đồ án của Thầy/Cô có thể trao đổi bài học, hỏi đáp đề tài, thông báo lịch hẹn và chia sẻ tài liệu trực tiếp tại đây.
            </p>
          </div>

          {/* Banner Tin nhắn đã ghim (Pinned Message Banner) */}
          {latestPinned && (
            <div className="utc-pinned-banner">
              <div
                className="utc-pinned-content"
                onClick={() => scrollToMessage(latestPinned.id)}
                title="Bấm để cuộn đến tin nhắn đã ghim"
              >
                <span className="utc-pinned-badge">📌 ĐÃ GHIM</span>
                <span className="utc-pinned-sender font-semibold">
                  {formatFullName(latestPinned.sender_name)}:
                </span>
                <span className="utc-pinned-text">
                  {latestPinned.message || latestPinned.attachment_name || '[Tệp đính kèm]'}
                </span>
              </div>
              <div className="utc-pinned-actions">
                <button
                  type="button"
                  className="utc-pinned-jump-btn"
                  onClick={() => scrollToMessage(latestPinned.id)}
                  title="Xem tin nhắn đã ghim"
                >
                  👁️ Xem
                </button>
                <button
                  type="button"
                  className="utc-pinned-close-btn"
                  onClick={() => handleTogglePin(latestPinned.id)}
                  title="Bỏ ghim tin nhắn này"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

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
                const reactions = msg.reactions || {};
                const reactionEntries = Object.entries(reactions).filter(
                  ([_, users]: [string, any]) => Array.isArray(users) && users.length > 0
                );

                return (
                  <div
                    key={msg.id}
                    id={`utc-msg-${msg.id}`}
                    className={`utc-message-row ${isMe ? 'message-out' : 'message-in'} ${
                      isSupervisor ? 'from-supervisor' : ''
                    } ${msg.is_pinned ? 'msg-is-pinned' : ''}`}
                  >
                    {!isMe && (
                      <div className={`utc-msg-avatar ${isSupervisor ? 'sup-avatar' : 'student-avatar'}`}>
                        {isSupervisor ? '👨‍🏫' : formatFullName(msg.sender_name)?.charAt(0)?.toUpperCase() || 'S'}
                      </div>
                    )}

                    <div className="utc-msg-bubble-wrap">
                      <div className="utc-msg-sender-info">
                        <span className="utc-msg-sender-name font-semibold">{formatFullName(msg.sender_name)}</span>
                        <span className={`utc-msg-role-tag ${isSupervisor ? 'sup' : 'student'}`}>
                          {msg.sender_role_label}
                        </span>
                        {msg.is_pinned && <span className="utc-msg-pinned-tag">📌 Đã ghim</span>}
                        <span className="utc-msg-time">{getRelativeTime(msg.created_at)}</span>
                      </div>

                      <div className="utc-msg-bubble">
                        {/* Quoted Reply Box */}
                        {msg.reply_to && (
                          <div
                            className="utc-quoted-reply-box"
                            onClick={() => scrollToMessage(msg.reply_to.id)}
                            title="Bấm để xem tin nhắn gốc"
                          >
                            <span className="utc-quoted-sender">
                              ↩️ {formatFullName(msg.reply_to.sender_name)}
                            </span>
                            <p className="utc-quoted-snippet">{msg.reply_to.message}</p>
                          </div>
                        )}

                        {/* Message Text */}
                        {msg.message && <p className="utc-msg-text">{msg.message}</p>}

                        {/* File Attachment */}
                        {msg.attachment && (
                          <div className="utc-msg-attachment">
                            <span className="utc-attachment-icon">📎</span>
                            <div className="utc-attachment-info">
                              <span
                                className="utc-attachment-name-clickable"
                                onClick={(e) => handleDownloadFile(e, msg.id, msg.attachment, msg.attachment_name)}
                                title="Bấm để tải về máy tính"
                              >
                                {msg.attachment_name || 'Tệp đính kèm'}
                              </span>
                              {msg.attachment_size && (
                                <span className="utc-attachment-size">
                                  ({(msg.attachment_size / 1024).toFixed(1)} KB)
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              className="utc-download-btn-active"
                              onClick={(e) => handleDownloadFile(e, msg.id, msg.attachment, msg.attachment_name)}
                              title="Tải về máy tính"
                              disabled={downloadingId === msg.id}
                            >
                              {downloadingId === msg.id ? '⏳' : '⬇️'}
                            </button>
                          </div>
                        )}

                        {/* Floating Action Toolbar on Hover */}
                        <div className="utc-msg-actions-toolbar">
                          {/* Emoji Picker Popup */}
                          {activeEmojiPickerId === msg.id && (
                            <div className="utc-emoji-picker-popup">
                              {EMOJI_LIST.map((emoji) => (
                                <button
                                  key={emoji}
                                  type="button"
                                  className="utc-emoji-option-btn"
                                  onClick={() => handleToggleReaction(msg.id, emoji)}
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Reaction Button */}
                          <button
                            type="button"
                            className="utc-action-icon-btn"
                            title="Thả cảm xúc"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveEmojiPickerId(activeEmojiPickerId === msg.id ? null : msg.id);
                            }}
                          >
                            😊
                          </button>

                          {/* Reply Button */}
                          <button
                            type="button"
                            className="utc-action-icon-btn"
                            title="Trả lời tin nhắn"
                            onClick={() => handleReplyMessage(msg)}
                          >
                            ↩️
                          </button>

                          {/* Copy Button */}
                          {msg.message && (
                            <button
                              type="button"
                              className="utc-action-icon-btn"
                              title="Sao chép nội dung"
                              onClick={() => handleCopyMessage(msg.message)}
                            >
                              📋
                            </button>
                          )}

                          {/* Pin Button */}
                          <button
                            type="button"
                            className={`utc-action-icon-btn ${msg.is_pinned ? 'is-active-pin' : ''}`}
                            title={msg.is_pinned ? 'Bỏ ghim tin nhắn' : 'Ghim tin nhắn'}
                            onClick={() => handleTogglePin(msg.id)}
                          >
                            📌
                          </button>

                          {/* Delete Button (If author) */}
                          {isMe && (
                            <button
                              type="button"
                              className="utc-action-icon-btn delete"
                              title="Xóa tin nhắn"
                              onClick={() => handleDeleteMessage(msg.id)}
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Reaction Pills below message */}
                      {reactionEntries.length > 0 && (
                        <div className="utc-msg-reactions-row">
                          {reactionEntries.map(([emoji, userList]: [string, any]) => {
                            const hasReacted = currentUsername && userList.includes(currentUsername);
                            return (
                              <button
                                key={emoji}
                                type="button"
                                className={`utc-reaction-pill-badge ${hasReacted ? 'my-reaction' : ''}`}
                                onClick={() => handleToggleReaction(msg.id, emoji)}
                                title={userList.join(', ')}
                              >
                                <span>{emoji}</span>
                                <span className="utc-reaction-pill-count">{userList.length}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quoting / Replying Preview Bar */}
          {replyingTo && (
            <div className="utc-reply-preview-bar">
              <div className="utc-reply-preview-info">
                <span className="utc-reply-icon">↩️</span>
                <div className="utc-reply-text">
                  <span className="utc-reply-sender">
                    Đang trả lời <strong>{formatFullName(replyingTo.sender_name)}</strong>:
                  </span>
                  <span className="utc-reply-snippet">
                    {replyingTo.message || replyingTo.attachment_name || '[Tệp đính kèm]'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="utc-reply-cancel-btn"
                onClick={() => setReplyingTo(null)}
                title="Hủy trả lời"
              >
                ✕
              </button>
            </div>
          )}

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
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setSelectedFile(e.target.files[0]);
                    }
                  }}
                  style={{ display: 'none' }}
                />
              </label>

              <input
                ref={chatInputRef}
                type="text"
                className="utc-text-input"
                placeholder={
                  replyingTo
                    ? `Nhập câu trả lời cho ${formatFullName(replyingTo.sender_name)}...`
                    : 'Nhập tin nhắn thảo luận cho cả nhóm (Enter để gửi)...'
                }
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                disabled={sending}
              />

              <button
                type="submit"
                className="utc-send-btn"
                disabled={sending || (!inputText.trim() && !selectedFile)}
              >
                {sending ? 'Đang gửi...' : 'Gửi ➔'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
