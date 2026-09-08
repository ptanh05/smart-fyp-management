import React, { useState, useEffect, useRef, useCallback } from 'react';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import type { ChatMessage } from '../types';
import DocumentViewerModal from './DocumentViewerModal';
import './ChatRoom.css';

interface ChatRoomProps {
  groupId: number; // This is SupervisorOfStudentGroup ID
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
  const { user, userType } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 3;
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
          // Unauthorized - don't reconnect, fall back to polling
          console.warn('WebSocket unauthorized, falling back to polling');
          startPolling();
        } else if (event.code === 4003) {
          // Forbidden - user not in group
          console.warn('WebSocket forbidden - user not a group member');
          setConnectionStatus('disconnected');
        } else if (reconnectAttempts.current < maxReconnectAttempts) {
          // Try to reconnect
          reconnectAttempts.current++;
          setConnectionStatus('connecting');
          setTimeout(connectWebSocket, 2000 * reconnectAttempts.current);
        } else {
          // Max reconnect attempts reached, fall back to polling
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
        // Connection successful
        break;
      
      case 'chat_message':
        // Add new message to the list
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
          // Check if message already exists (deduplication)
          if (prev.some(m => m.id === newMsg.id)) {
            return prev;
          }
          return [...prev, newMsg];
        });
        scrollToBottom();
        break;
      
      case 'typing':
        if (data.is_typing) {
          setTypingUsers(prev => {
            if (!prev.includes(data.username)) {
              return [...prev, data.username];
            }
            return prev;
          });
        } else {
          setTypingUsers(prev => prev.filter(u => u !== data.username));
        }
        break;
      
      case 'user_join':
        // Optional: Show user join notification
        break;
      
      case 'user_leave':
        // Optional: Show user leave notification
        setTypingUsers(prev => prev.filter(u => u !== data.username));
        break;
      
      case 'error':
        console.error('WebSocket error:', data.message);
        break;
      
      case 'pong':
        // Heartbeat response
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
  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() && !selectedAttachment) return;

    setLoading(true);
    
    // Clear typing indicator
    sendTypingIndicator(false);
    
    try {
      if (selectedAttachment) {
        // Send multipart form data with attachment
        const formData = new FormData();
        formData.append('group', String(groupId));
        if (newMessage.trim()) {
          formData.append('message', newMessage.trim());
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
          message: newMessage.trim(),
        }));
        setNewMessage('');
        scrollToBottom();
      } else {
        // Fallback to REST API
        const createdMsg = await apiService.sendChatMessage({ group: groupId, message: newMessage });
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

  // Handle input change with typing indicator
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    
    // Send typing indicator
    if (e.target.value.trim()) {
      sendTypingIndicator(true);
      
      // Clear existing timeout
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

  // Load more (older) messages
  const loadMoreMessages = async () => {
    if (loadingMore || !hasMore) return;
    
    setLoadingMore(true);
    try {
      const nextPage = currentPage + 1;
      const response = await apiService.getChatMessages(groupId, nextPage);
      const olderMessages = [...response.results].reverse();
      setMessages(prev => [...olderMessages, ...prev]);
      setCurrentPage(nextPage);
      setHasMore(response.next !== null);
    } catch (error: any) {
      console.error('Failed to load more messages:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // Initialize: load messages and connect WebSocket
  useEffect(() => {
    loadMessages();
    connectWebSocket();
    
    return () => {
      disconnectWebSocket();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [groupId]);

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
        return { text: 'Connected', color: '#28a745', icon: '🟢' };
      case 'connecting':
        return { text: 'Connecting...', color: '#ffc107', icon: '🟡' };
      case 'polling':
        return { text: 'Live updates (polling)', color: '#17a2b8', icon: '🔄' };
      case 'disconnected':
        return { text: 'Disconnected', color: '#dc3545', icon: '🔴' };
      default:
        return { text: 'Unknown', color: '#6c757d', icon: '⚪' };
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

  return (
    <div className="chat-room-card">
      <div className="chat-room-header">
        <h2 className="chat-room-title">Chat Room</h2>
        <div className={`chat-connection-status ${getStatusClass()}`}>
          <span>{statusDisplay.icon}</span>
          <span>{statusDisplay.text}</span>
        </div>
      </div>
      
      <div
        ref={messagesContainerRef}
        className="chat-messages-container"
      >
        {/* Load More Button */}
        {hasMore && (
          <div style={{ textAlign: 'center', marginBottom: '12px' }}>
            <button
              onClick={loadMoreMessages}
              disabled={loadingMore}
              className="chat-load-older-btn"
            >
              {loadingMore ? 'Loading...' : `Load older messages (${totalCount - messages.length} more)`}
            </button>
          </div>
        )}
        
        {messages.length === 0 ? (
          <div className="empty-state">No messages yet</div>
        ) : (
          messages.map((message) => {
            const isMyMsg = isMyMessage(message);
            const isSupervisor = message.sent_by === 'supervisor';
            const senderName = isSupervisor 
              ? (message.supervisor?.user?.username || 'Supervisor')
              : (message.student?.user?.username || 'Student');
            
            return (
              <div
                key={message.id}
                className={`chat-message-wrapper ${isMyMsg ? 'sent' : 'received'}`}
              >
                <div className={`chat-bubble ${isMyMsg ? 'sent' : 'received'}`}>
                  <div className={`chat-bubble-sender ${isSupervisor ? 'supervisor' : ''} ${isMyMsg ? 'sent' : ''}`}>
                    {isSupervisor && !isMyMsg && '👨‍🏫 '}
                    {senderName}
                    {isSupervisor && ' (Supervisor)'}
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
                    {new Date(message.created_at).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            );
          })
        )}
        
        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <div className="chat-typing-indicator">
            {typingUsers.length === 1 
              ? `${typingUsers[0]} is typing...`
              : `${typingUsers.join(', ')} are typing...`
            }
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      <form onSubmit={sendMessage} className="chat-form">
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
          <input
            type="text"
            value={newMessage}
            onChange={handleInputChange}
            placeholder={selectedAttachment ? 'Thêm chú thích (tùy chọn)...' : 'Nhập tin nhắn...'}
            maxLength={2000}
            className="chat-text-input"
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || (!newMessage.trim() && !selectedAttachment)}
          >
            {loading ? 'Đang gửi...' : 'Gửi'}
          </button>
        </div>
        <div className="chat-char-count">
          {newMessage.length}/2000
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
