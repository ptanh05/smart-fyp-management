import React, { useState, useEffect, useRef, useCallback } from 'react';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import type { ChatMessage } from '../types';
import DocumentViewerModal from './DocumentViewerModal';
import './ChatRoom.css';

interface ChatRoomProps {
  groupId: number; // This is SupervisorOfStudentGroup ID
}

interface RoomMember {
  username: string;
  full_name: string;
  role: 'student' | 'supervisor' | string;
  role_display: string;
}

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'polling';

const ChatRoom: React.FC<ChatRoomProps> = ({ groupId }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [selectedAttachment, setSelectedAttachment] = useState<File | null>(null);
  const [attachmentPreviewUrl, setAttachmentPreviewUrl] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{ url: string; title: string; type: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [members, setMembers] = useState<RoomMember[]>([]);

  const { user, userType } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 3;
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    if (selectedAttachment && selectedAttachment.type.startsWith('image/')) {
      const url = URL.createObjectURL(selectedAttachment);
      setAttachmentPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setAttachmentPreviewUrl(null);
    }
  }, [selectedAttachment]);

  // Get WebSocket URL using one-time ticket
  const getWebSocketUrl = useCallback(async () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = import.meta.env.VITE_WS_HOST || window.location.hostname;
    const defaultPort = import.meta.env.DEV ? ':8000' : (window.location.port ? `:${window.location.port}` : '');
    const portStr = import.meta.env.VITE_WS_PORT ? `:${import.meta.env.VITE_WS_PORT}` : defaultPort;
    const baseWsUrl = import.meta.env.VITE_WS_URL
      ? (import.meta.env.VITE_WS_URL.endsWith('/') ? import.meta.env.VITE_WS_URL : `${import.meta.env.VITE_WS_URL}/`) + `chat/${groupId}/`
      : `${protocol}//${host}${portStr}/ws/chat/${groupId}/`;

    try {
      const { ticket } = await apiService.getWebSocketTicket(groupId);
      return `${baseWsUrl}?ticket=${ticket}`;
    } catch (err) {
      console.error('Failed to obtain WebSocket ticket:', err);
      return baseWsUrl;
    }
  }, [groupId]);

  // Check if message was sent by current user
  const isMyMessage = (message: ChatMessage): boolean => {
    if (!user) return false;
    
    if (userType === 'student') {
      const student = user as any;
      return message.sent_by === 'student' && message.student?.id === student.id;
    } else if (userType === 'supervisor') {
      const supervisor = user as any;
      return message.sent_by === 'supervisor' && message.supervisor?.id === supervisor.id;
    }
    
    return false;
  };

  // Start polling as fallback
  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    setConnectionStatus('polling');
    pollingIntervalRef.current = setInterval(pollNewMessages, 3000);
  }, []);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  // Connect to WebSocket
  const connectWebSocket = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setConnectionStatus('connecting');
    stopPolling();

    try {
      const url = await getWebSocketUrl();
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnectionStatus('connected');
        reconnectAttempts.current = 0;
        stopPolling();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      ws.onclose = (event) => {
        wsRef.current = null;
        
        if (event.code === 4001) {
          console.warn('WebSocket unauthorized, falling back to polling');
          startPolling();
        } else if (event.code === 4003) {
          console.warn('WebSocket forbidden - user not a group member');
          setConnectionStatus('disconnected');
        } else if (reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          setConnectionStatus('connecting');
          setTimeout(connectWebSocket, 2000 * reconnectAttempts.current);
        } else {
          console.warn('Max WebSocket reconnect attempts reached, falling back to polling');
          startPolling();
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      startPolling();
    }
  }, [getWebSocketUrl, startPolling, stopPolling]);

  // Handle incoming WebSocket messages
  const handleWebSocketMessage = useCallback((data: any) => {
    switch (data.type) {
      case 'connection_established':
        if (data.online_users && Array.isArray(data.online_users)) {
          setOnlineUsers(data.online_users);
        }
        if (data.members && Array.isArray(data.members)) {
          setMembers(data.members);
        }
        break;

      case 'presence_update':
        if (data.online_users && Array.isArray(data.online_users)) {
          setOnlineUsers(data.online_users);
        } else if (data.username) {
          setOnlineUsers(prev => {
            if (data.is_online) {
              return prev.includes(data.username) ? prev : [...prev, data.username];
            } else {
              return prev.filter(u => u !== data.username);
            }
          });
        }
        break;
      
      case 'chat_message':
        const newMsg: ChatMessage = {
          id: data.message_id,
          message: data.message,
          attachment: data.attachment,
          attachment_name: data.attachment_name,
          attachment_type: data.attachment_type,
          attachment_size: data.attachment_size,
          sent_by: data.sent_by,
          created_at: data.created_at,
          group: groupId,
          student: data.sent_by === 'student' ? { id: data.sender_id, user: { username: data.sender_username } } : null,
          supervisor: data.sent_by === 'supervisor' ? { id: data.sender_id, user: { username: data.sender_username } } : null,
        } as any;
        
        setMessages(prev => {
          if (prev.some(m => m.id === newMsg.id)) {
            return prev;
          }
          return [...prev, newMsg];
        });
        scrollToBottom();
        break;
      
      case 'typing':
        const typingUser = data.username;
        if (!typingUser) break;

        if (data.is_typing) {
          setTypingUsers(prev => prev.includes(typingUser) ? prev : [...prev, typingUser]);

          // Clear previous timer for this user if exists
          if (typingTimersRef.current[typingUser]) {
            clearTimeout(typingTimersRef.current[typingUser]);
          }

          // Auto-remove typing state after 3.5 seconds
          typingTimersRef.current[typingUser] = setTimeout(() => {
            setTypingUsers(prev => prev.filter(u => u !== typingUser));
            delete typingTimersRef.current[typingUser];
          }, 3500);
        } else {
          if (typingTimersRef.current[typingUser]) {
            clearTimeout(typingTimersRef.current[typingUser]);
            delete typingTimersRef.current[typingUser];
          }
          setTypingUsers(prev => prev.filter(u => u !== typingUser));
        }
        break;
      
      case 'user_join':
        if (data.username) {
          setOnlineUsers(prev => prev.includes(data.username) ? prev : [...prev, data.username]);
        }
        break;
      
      case 'user_leave':
        if (data.username) {
          setOnlineUsers(prev => prev.filter(u => u !== data.username));
          setTypingUsers(prev => prev.filter(u => u !== data.username));
        }
        break;
      
      case 'error':
        console.error('WebSocket error:', data.message);
        break;
      
      case 'pong':
        break;
    }
  }, [groupId]);

  // Disconnect WebSocket
  const disconnectWebSocket = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    stopPolling();
  }, [stopPolling]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit: 25MB
    const MAX_SIZE = 25 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      alert(`Dung lượng file (${(file.size / (1024 * 1024)).toFixed(1)}MB) vượt quá giới hạn cho phép (25MB).`);
      e.target.value = '';
      return;
    }
    setSelectedAttachment(file);
  };

  const handleRemoveAttachment = () => {
    setSelectedAttachment(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDownloadAttachment = async (fileUrl: string, fileName: string) => {
    try {
      await apiService.downloadDocument(fileUrl, fileName);
    } catch (err) {
      console.error('Download attachment failed:', err);
      alert('Không thể tải file đính kèm.');
    }
  };

  const formatFileSize = (bytes?: number | null): string => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const isImageAttachment = (msg: ChatMessage) => {
    if (msg.attachment_type?.startsWith('image/')) return true;
    const name = (msg.attachment_name || msg.attachment || '').toLowerCase();
    return /\.(jpg|jpeg|png|gif|webp|svg)($|\?)/i.test(name);
  };

  const isPdfAttachment = (msg: ChatMessage) => {
    if (msg.attachment_type?.includes('pdf')) return true;
    const name = (msg.attachment_name || msg.attachment || '').toLowerCase();
    return /\.pdf($|\?)/i.test(name);
  };

  const getAttachmentUrl = (url: string) => {
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return url;
  };

  // Send message via WebSocket or API
  const sendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!newMessage.trim() && !selectedAttachment) || loading) return;

    setLoading(true);
    
    // Clear typing indicator
    sendTypingIndicator(false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    
    const messageToSend = newMessage.trim();

    try {
      if (selectedAttachment) {
        // Send multipart form data with attachment
        const formData = new FormData();
        formData.append('group', String(groupId));
        if (messageToSend) {
          formData.append('message', messageToSend);
        }
        formData.append('attachment', selectedAttachment);

        const createdMsg = await apiService.sendChatMessageWithAttachment(formData);
        setNewMessage('');
        handleRemoveAttachment();
        setMessages((prev) => {
          if (prev.some((m) => m.id === createdMsg.id)) return prev;
          return [...prev, createdMsg];
        });
        scrollToBottom();
      } else if (wsRef.current?.readyState === WebSocket.OPEN) {
        // Send via WebSocket
        wsRef.current.send(JSON.stringify({
          type: 'chat_message',
          message: messageToSend,
        }));
        setNewMessage('');
        scrollToBottom();
      } else {
        // Fallback to REST API
        const createdMsg = await apiService.sendChatMessage({ group: groupId, message: messageToSend });
        setNewMessage('');
        setMessages((prev) => {
          if (prev.some((m) => m.id === createdMsg.id)) return prev;
          return [...prev, createdMsg];
        });
        scrollToBottom();
      }
    } catch (error: any) {
      console.error('Failed to send message:', error);
      alert(error.response?.data?.message || 'Failed to send message. Please try again.');
    } finally {
      setLoading(false);
      // Re-focus textarea
      textareaRef.current?.focus();
    }
  };

  // Send typing indicator
  const sendTypingIndicator = useCallback((isTyping: boolean) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'typing',
        is_typing: isTyping,
      }));
    }
  }, []);

  // Handle textarea change with typing indicator
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);
    
    if (e.target.value.trim()) {
      sendTypingIndicator(true);
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Stop typing after 2 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        sendTypingIndicator(false);
      }, 2000);
    } else {
      sendTypingIndicator(false);
    }
  };

  // Keyboard handler for Shift + Enter (newline) vs Enter (send)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        // Shift + Enter: Allow natural newline break
        return;
      } else {
        // Enter without Shift: Send message immediately
        e.preventDefault();
        sendMessage();
      }
    }
  };

  // Load messages via REST API
  const loadMessages = async () => {
    try {
      const response = await apiService.getChatMessages(groupId, 1);
      const sortedMessages = [...response.results].reverse();
      setMessages(sortedMessages);
      setTotalCount(response.count);
      setHasMore(response.next !== null);
      setCurrentPage(1);
    } catch (error: any) {
      console.error('Failed to load messages:', error);
      setMessages([]);
    }
  };

  // Poll for new messages (fallback)
  const pollNewMessages = async () => {
    try {
      const response = await apiService.getChatMessages(groupId, 1);
      const newMessages = [...response.results].reverse();
      
      if (newMessages.length > 0 && messages.length > 0) {
        const latestNewId = newMessages[newMessages.length - 1]?.id;
        const latestCurrentId = messages[messages.length - 1]?.id;
        
        if (latestNewId !== latestCurrentId) {
          setMessages(newMessages);
          setTotalCount(response.count);
          setHasMore(response.next !== null);
        }
      } else if (newMessages.length > 0 && messages.length === 0) {
        setMessages(newMessages);
        setTotalCount(response.count);
        setHasMore(response.next !== null);
      }
    } catch (error) {
      // Silently fail for polling
    }
  };

  // Load more (older) messages: exactly 20 messages per page with ZERO scroll jumping
  const loadMoreMessages = async () => {
    if (loadingMore || !hasMore) return;
    
    const container = messagesContainerRef.current;
    const prevScrollHeight = container ? container.scrollHeight : 0;
    const prevScrollTop = container ? container.scrollTop : 0;

    setLoadingMore(true);
    try {
      const nextPage = currentPage + 1;
      const response = await apiService.getChatMessages(groupId, nextPage);
      const olderMessages = [...response.results].reverse();
      
      setMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        const filteredOlder = olderMessages.filter(m => !existingIds.has(m.id));
        return [...filteredOlder, ...prev];
      });
      setCurrentPage(nextPage);
      setHasMore(response.next !== null);

      // Preserve exact scroll position so view does not jump
      requestAnimationFrame(() => {
        if (container) {
          const heightDiff = container.scrollHeight - prevScrollHeight;
          container.scrollTop = prevScrollTop + heightDiff;
        }
      });
    } catch (error: any) {
      console.error('Failed to load more messages:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  // Auto-fetch older messages when scrolling to top
  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;

    // When scrolled near the top (<= 30px), trigger older message pagination
    if (container.scrollTop <= 30 && hasMore && !loadingMore) {
      loadMoreMessages();
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // Initialize: load messages, connect WebSocket, and manage visibility-aware polling
  useEffect(() => {
    loadMessages();
    connectWebSocket();

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        if (wsRef.current?.readyState !== WebSocket.OPEN) {
          pollNewMessages();
          startPolling();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      disconnectWebSocket();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      Object.values(typingTimersRef.current).forEach(t => clearTimeout(t));
    };
  }, [groupId, startPolling, stopPolling, connectWebSocket, disconnectWebSocket]);

  // Scroll to bottom on initial load
  useEffect(() => {
    if (currentPage === 1 && messages.length > 0) {
      scrollToBottom();
    }
  }, [messages.length, currentPage]);

  // Get connection status display
  const getStatusDisplay = () => {
    switch (connectionStatus) {
      case 'connected':
        return { text: 'Trực tuyến (Connected)', color: '#28a745', icon: '🟢' };
      case 'connecting':
        return { text: 'Đang kết nối...', color: '#ffc107', icon: '🟡' };
      case 'polling':
        return { text: 'Cập nhật định kỳ (Polling)', color: '#17a2b8', icon: '🔄' };
      case 'disconnected':
        return { text: 'Mất kết nối', color: '#dc3545', icon: '🔴' };
      default:
        return { text: 'Chưa rõ', color: '#6c757d', icon: '⚪' };
    }
  };

  const statusDisplay = getStatusDisplay();

  const getStatusClass = () => {
    switch (connectionStatus) {
      case 'connected': return 'chat-status-connected';
      case 'connecting': return 'chat-status-connecting';
      case 'polling': return 'chat-status-polling';
      case 'disconnected': return 'chat-status-disconnected';
      default: return '';
    }
  };

  // Default fallback members if backend does not supply list
  const currentUsername = (user as any)?.username || '';
  const displayMembers = members.length > 0 ? members : [
    { username: currentUsername, full_name: currentUsername, role: userType || 'member', role_display: userType === 'supervisor' ? 'GVHD' : 'Sinh viên' }
  ];

  return (
    <div className="chat-room-card">
      <div className="chat-room-header">
        <div>
          <h2 className="chat-room-title">💬 Khung Trao Đổi Nhóm Đồ Án</h2>
          <span className="chat-room-subtitle">Mã nhóm: #{groupId}</span>
        </div>
        <div className={`chat-connection-status ${getStatusClass()}`}>
          <span>{statusDisplay.icon}</span>
          <span>{statusDisplay.text}</span>
        </div>
      </div>

      {/* Member Presence Bar (Online: Green dot / Offline: Gray dot) */}
      <div className="chat-members-bar">
        <span className="chat-members-label">Thành viên:</span>
        <div className="chat-members-chips">
          {displayMembers.map(member => {
            const isOnline = onlineUsers.includes(member.username) || member.username === currentUsername;
            return (
              <div
                key={member.username}
                className={`chat-member-badge ${isOnline ? 'online' : 'offline'}`}
                title={isOnline ? `${member.full_name} đang online` : `${member.full_name} đang offline`}
              >
                <span className={`presence-dot ${isOnline ? 'dot-online' : 'dot-offline'}`} />
                <span className="member-name">{member.full_name}</span>
                <span className="member-role">({member.role_display || member.role})</span>
              </div>
            );
          })}
        </div>
      </div>
      
      <div
        ref={messagesContainerRef}
        className="chat-messages-container"
        onScroll={handleScroll}
      >
        {/* Load More Older Messages Indicator */}
        {hasMore && (
          <div className="chat-load-more-header">
            {loadingMore ? (
              <div className="chat-loading-older">
                <span className="spinner-small"></span>
                <span>Đang tải thêm 20 tin nhắn cũ hơn...</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={loadMoreMessages}
                className="chat-load-older-btn"
              >
                ⬆️ Cuộn lên hoặc bấm để tải 20 tin nhắn cũ hơn ({totalCount - messages.length} còn lại)
              </button>
            )}
          </div>
        )}
        
        {messages.length === 0 ? (
          <div className="empty-state">Chưa có tin nhắn nào trong nhóm. Hãy gửi tin nhắn đầu tiên!</div>
        ) : (
          messages.map((message) => {
            const isMyMsg = isMyMessage(message);
            const isSupervisor = message.sent_by === 'supervisor';
            const senderName = isSupervisor 
              ? (message.supervisor?.user?.username || 'Giảng viên HD')
              : (message.student?.user?.username || 'Sinh viên');
            
            return (
              <div
                key={message.id}
                className={`chat-message-wrapper ${isMyMsg ? 'sent' : 'received'}`}
              >
                <div className={`chat-bubble ${isMyMsg ? 'sent' : 'received'}`}>
                  <div className={`chat-bubble-sender ${isSupervisor ? 'supervisor' : ''} ${isMyMsg ? 'sent' : ''}`}>
                    {isSupervisor && !isMyMsg && '👨‍🏫 '}
                    {senderName}
                    {isSupervisor && ' (GVHD)'}
                  </div>

                  {/* Attachment in chat bubble */}
                  {message.attachment && (
                    <div className="chat-bubble-attachment">
                      {isImageAttachment(message) ? (
                        <div className="chat-attachment-image-wrap">
                          <img
                            src={getAttachmentUrl(message.attachment)}
                            alt={message.attachment_name || 'Hình ảnh'}
                            className="chat-attachment-img"
                            onClick={() =>
                              setPreviewDoc({
                                url: getAttachmentUrl(message.attachment!),
                                title: message.attachment_name || 'Hình ảnh',
                                type: 'image',
                              })
                            }
                            title="Nhấp để xem trước hình ảnh"
                          />
                        </div>
                      ) : (
                        <div className="chat-attachment-card">
                          <span className="chat-attachment-icon">
                            {isPdfAttachment(message) ? '📕' : '📄'}
                          </span>
                          <div className="chat-attachment-info">
                            <span className="chat-attachment-filename" title={message.attachment_name || 'Tài liệu'}>
                              {message.attachment_name || 'Tài liệu đính kèm'}
                            </span>
                            {message.attachment_size ? (
                              <span className="chat-attachment-size">
                                {formatFileSize(message.attachment_size)}
                              </span>
                            ) : null}
                          </div>
                          <div className="chat-attachment-actions">
                            {isPdfAttachment(message) && (
                              <button
                                type="button"
                                className="btn-attachment-action btn-attachment-preview"
                                onClick={() =>
                                  setPreviewDoc({
                                    url: getAttachmentUrl(message.attachment!),
                                    title: message.attachment_name || 'Tài liệu',
                                    type: 'document',
                                  })
                                }
                                title="Xem trước tài liệu PDF trực tiếp"
                              >
                                👁️ Xem
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn-attachment-action btn-attachment-download"
                              onClick={() =>
                                handleDownloadAttachment(
                                  getAttachmentUrl(message.attachment!),
                                  message.attachment_name || 'attachment'
                                )
                              }
                              title="Tải file về máy"
                            >
                              ⬇️ Tải
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {message.message && <div className="chat-bubble-content">{message.message}</div>}

                  <div className="chat-bubble-time">
                    {new Date(message.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            );
          })
        )}
        
        {/* Realtime Typing indicator */}
        {typingUsers.length > 0 && (
          <div className="chat-typing-indicator">
            <span className="typing-dot-icon">✍️</span>
            <span>
              {typingUsers.length === 1 
                ? `${typingUsers[0]} đang soạn tin...`
                : `${typingUsers.join(', ')} đang soạn tin...`
              }
            </span>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      <form onSubmit={sendMessage} className="chat-form chat-footer-form">
        {/* Selected file preview before sending */}
        {selectedAttachment && (
          <div className="chat-selected-attachment-bar">
            {attachmentPreviewUrl ? (
              <img src={attachmentPreviewUrl} alt="Preview" className="chat-selected-thumb" />
            ) : (
              <span className="chat-selected-icon">📄</span>
            )}
            <div className="chat-selected-details">
              <span className="chat-selected-name" title={selectedAttachment.name}>
                {selectedAttachment.name}
              </span>
              <span className="chat-selected-size">
                {formatFileSize(selectedAttachment.size)}
              </span>
            </div>
            <button
              type="button"
              className="chat-selected-remove-btn"
              onClick={handleRemoveAttachment}
              title="Hủy file đính kèm"
            >
              ✕
            </button>
          </div>
        )}

        <div className="chat-input-area">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="image/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip,.rar"
            style={{ display: 'none' }}
          />
          <button
            type="button"
            className="chat-attachment-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Đính kèm file (ảnh hoặc tài liệu)"
            disabled={loading}
          >
            📎
          </button>
          <textarea
            ref={textareaRef}
            value={newMessage}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={
              selectedAttachment
                ? 'Thêm chú thích (tùy chọn)... (Nhấn Enter để gửi, Shift + Enter để xuống dòng)'
                : 'Nhập tin nhắn... (Nhấn Enter để gửi, Shift + Enter để xuống dòng)'
            }
            maxLength={2000}
            rows={2}
            className="chat-textarea"
          />
          <button
            type="submit"
            className="btn btn-primary chat-send-btn"
            disabled={loading || (!newMessage.trim() && !selectedAttachment)}
          >
            {loading ? 'Đang gửi...' : 'Gửi'}
          </button>
        </div>
        <div className="chat-input-hint">
          <span>Nhấn <b>Enter</b> để gửi, <b>Shift + Enter</b> để xuống dòng mới</span>
          <span>{newMessage.length}/2000 ký tự</span>
        </div>
      </form>

      {/* Modal preview PDF or image for chat attachments */}
      {previewDoc && (
        <DocumentViewerModal
          isOpen={!!previewDoc}
          onClose={() => setPreviewDoc(null)}
          title={previewDoc.title}
          documentUrl={previewDoc.url}
          documentType={previewDoc.type}
        />
      )}
    </div>
  );
};

export default ChatRoom;
