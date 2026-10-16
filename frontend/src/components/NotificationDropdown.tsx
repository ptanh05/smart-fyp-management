import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import type { Notification, NotificationType } from '../types';
import { getRelativeTime } from '../utils/dateUtils';
import './NotificationDropdown.css';

interface NotificationDropdownProps {
  onNavigate?: (url: string) => void;
}

const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ onNavigate }) => {
  const navigate = useNavigate();
  const { userType } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [filterTab, setFilterTab] = useState<'all' | 'grades'>('all');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isGradeNotification = (n: Notification): boolean => {
    const gradeTypes: NotificationType[] = [
      'evaluation_completed',
      'external_evaluation',
      'external_schedule',
    ];
    if (gradeTypes.includes(n.notification_type)) return true;

    const lowerTitle = (n.title || '').toLowerCase();
    const lowerMsg = (n.message || '').toLowerCase();
    const keywords = [
      'điểm',
      'bảo vệ',
      'hội đồng',
      'đánh giá',
      'score',
      'grade',
      'defense',
      'nhắc nhở nộp điểm',
      'phiếu đánh giá',
    ];
    return keywords.some((kw) => lowerTitle.includes(kw) || lowerMsg.includes(kw));
  };

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    try {
      const data = await apiService.getUnreadNotificationCount();
      setUnreadCount(data.unread_count);
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  }, []);

  // Fetch notifications
  const fetchNotifications = useCallback(async (page = 1, append = false) => {
    setLoading(true);
    try {
      const data = await apiService.getNotifications({ page });
      if (append) {
        setNotifications(prev => [...prev, ...data.results]);
      } else {
        setNotifications(data.results);
      }
      setHasMore(data.next !== null);
      setCurrentPage(page);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch and visibility-aware polling setup
  useEffect(() => {
    fetchUnreadCount();

    const startTimer = () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = setInterval(fetchUnreadCount, 30000);
    };

    const stopTimer = () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };

    startTimer();

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopTimer();
      } else {
        fetchUnreadCount();
        startTimer();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      stopTimer();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchUnreadCount]);

  // Fetch notifications when dropdown opens
  useEffect(() => {
    if (isOpen) {
      fetchNotifications(1);
    }
  }, [isOpen, fetchNotifications]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle notification click
  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    if (!notification.is_read) {
      try {
        await apiService.markNotificationsAsRead([notification.id]);
        setNotifications(prev =>
          prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
      }
    }

    // Determine target actionable URL based on notification content
    const determineTargetUrl = (notif: Notification, currentRole: string | null): string => {
      if (notif.action_url && notif.action_url !== '/student/dashboard' && notif.action_url !== '/supervisor/dashboard') {
        return notif.action_url;
      }

      const titleLower = (notif.title || '').toLowerCase();
      const msgLower = (notif.message || '').toLowerCase();
      const type = notif.notification_type || '';

      // 1. Chỉnh sửa đề tài / Phê duyệt đề tài / Đề cương
      if (
        titleLower.includes('chỉnh sửa đề tài') ||
        titleLower.includes('sửa đổi đề tài') ||
        titleLower.includes('phê duyệt đề tài') ||
        titleLower.includes('đề cương') ||
        msgLower.includes('chỉnh sửa đề tài') ||
        msgLower.includes('sửa đổi đề tài') ||
        msgLower.includes('phê duyệt đề tài')
      ) {
        if (currentRole === 'student') return '/student/dashboard?tab=utc_graduation&subtab=outline';
        if (currentRole === 'supervisor') return '/supervisor/dashboard?tab=utc_graduation&subtab=outlines';
      }

      // 2. Nhiệm vụ / Giao việc / Task / Tiến độ
      if (
        titleLower.includes('nhiệm vụ') ||
        titleLower.includes('giao việc') ||
        titleLower.includes('tiến độ') ||
        titleLower.includes('task') ||
        msgLower.includes('nhiệm vụ') ||
        msgLower.includes('giao việc')
      ) {
        if (currentRole === 'student') return '/student/dashboard?tab=utc_graduation&subtab=supervision';
        if (currentRole === 'supervisor') return '/supervisor/dashboard?tab=utc_graduation&subtab=students';
      }

      // 3. Tin nhắn / Chat / Trao đổi nhóm
      if (
        type === 'new_chat_message' ||
        titleLower.includes('tin nhắn') ||
        titleLower.includes('chat') ||
        titleLower.includes('trao đổi') ||
        msgLower.includes('nhắn trong nhóm')
      ) {
        if (currentRole === 'student') return '/student/dashboard?tab=chat';
        if (currentRole === 'supervisor') return '/supervisor/dashboard?tab=chat';
      }

      // 4. Nhóm đồ án
      if (type.includes('group_request') || titleLower.includes('nhóm đồ án')) {
        if (currentRole === 'student') return '/student/dashboard?tab=groups';
        if (currentRole === 'supervisor') return '/supervisor/dashboard?tab=my_groups';
      }

      // 5. Điều kiện học vụ / Duyệt đặc cách / Tham gia đợt / Khảo sát
      if (
        titleLower.includes('điều kiện') ||
        titleLower.includes('đặc cách') ||
        titleLower.includes('khảo sát') ||
        titleLower.includes('nguyện vọng') ||
        (type as string) === 'batch_added' ||
        titleLower.includes('đợt đồ án')
      ) {
        if (currentRole === 'student') return '/student/dashboard?tab=utc_graduation&subtab=survey';
        if (currentRole === 'supervisor') return '/supervisor/dashboard?tab=utc_graduation&subtab=students';
      }

      // 6. Phân công GVHD
      if (titleLower.includes('phân công gvhd') || titleLower.includes('kết quả phân công')) {
        if (currentRole === 'student') return '/student/dashboard?tab=utc_graduation&subtab=project';
        if (currentRole === 'supervisor') return '/supervisor/dashboard?tab=utc_graduation&subtab=students';
      }

      // 7. Bảo lưu đồ án
      if (titleLower.includes('bảo lưu') || msgLower.includes('bảo lưu')) {
        if (currentRole === 'student') return '/student/dashboard?tab=utc_graduation&subtab=project';
        if (currentRole === 'supervisor') return '/supervisor/dashboard?tab=utc_graduation&subtab=deferrals';
      }

      // 8. Báo cáo tuần
      if (titleLower.includes('báo cáo') || titleLower.includes('tuần') || type.includes('weekly')) {
        if (currentRole === 'student') return '/student/dashboard?tab=utc_graduation&subtab=weekly';
        if (currentRole === 'supervisor') return '/supervisor/dashboard?tab=utc_graduation&subtab=weekly';
      }

      // 9. Điểm / Bảo vệ / Đánh giá
      if (
        isGradeNotification(notif) ||
        type === 'evaluation_completed' ||
        type.includes('external_')
      ) {
        if (currentRole === 'student') return '/student/dashboard?tab=utc_graduation&subtab=grade';
        if (currentRole === 'supervisor') return '/supervisor/dashboard?tab=utc_graduation&subtab=eval';
        if (currentRole === 'committee_member') return '/committee_member/dashboard';
        if (currentRole === 'external_examiner') return '/external_examiner/dashboard';
      }

      // 10. Fallbacks
      if (currentRole === 'student') return '/student/dashboard?tab=utc_graduation';
      if (currentRole === 'supervisor') return '/supervisor/dashboard?tab=utc_graduation';
      if (currentRole === 'committee_member') return '/committee_member/dashboard';
      if (currentRole === 'external_examiner') return '/external_examiner/dashboard';

      return '/';
    };

    const targetUrl = determineTargetUrl(notification, userType);

    // Extract parameters
    const [, queryString] = targetUrl.split('?');
    const searchParams = new URLSearchParams(queryString || '');
    const tab = searchParams.get('tab');
    const subtab = searchParams.get('subtab');

    if (onNavigate) {
      onNavigate(targetUrl);
    } else {
      navigate(targetUrl);
    }

    // Broadcast event for current active views to switch tab/subtab immediately
    window.dispatchEvent(new CustomEvent('app:switch-tab', { detail: { targetUrl, tab, subtab } }));
    if (subtab) {
      window.dispatchEvent(new CustomEvent('app:switch-subtab', { detail: { subtab } }));
    }

    setIsOpen(false);
  };

  // Mark all as read
  const handleMarkAllAsRead = async () => {
    try {
      await apiService.markNotificationsAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  // Delete notification
  const handleDeleteNotification = async (e: React.MouseEvent, notificationId: number) => {
    e.stopPropagation();
    try {
      await apiService.deleteNotification(notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      // Update unread count if the deleted notification was unread
      const deletedNotification = notifications.find(n => n.id === notificationId);
      if (deletedNotification && !deletedNotification.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  // Load more notifications
  const handleLoadMore = () => {
    if (!loading && hasMore) {
      fetchNotifications(currentPage + 1, true);
    }
  };

  // Get notification icon based on type
  const getNotificationIcon = (type: NotificationType): string => {
    const icons: Record<NotificationType, string> = {
      group_request: '👥',
      group_request_accepted: '✅',
      group_request_rejected: '❌',
      supervisor_request: '👨‍🏫',
      supervisor_request_accepted: '✅',
      supervisor_request_rejected: '❌',
      new_chat_message: '💬',
      document_uploaded: '📄',
      document_approved: '✅',
      document_rejected: '❌',
      evaluation_completed: '📝',
      new_comment: '💭',
      external_assignment: '🌐',
      external_evaluation: '📋',
      external_schedule: '📅',
      general: '🔔'
    };
    return icons[type] || '🔔';
  };

  // Get notification color based on type
  const getNotificationColor = (type: NotificationType): string => {
    const colors: Record<NotificationType, string> = {
      group_request: '#3b82f6',
      group_request_accepted: '#10b981',
      group_request_rejected: '#ef4444',
      supervisor_request: '#8b5cf6',
      supervisor_request_accepted: '#10b981',
      supervisor_request_rejected: '#ef4444',
      new_chat_message: '#06b6d4',
      document_uploaded: '#f59e0b',
      document_approved: '#10b981',
      document_rejected: '#ef4444',
      evaluation_completed: '#10b981',
      new_comment: '#64748b',
      external_assignment: '#3b82f6',
      external_evaluation: '#10b981',
      external_schedule: '#06b6d4',
      general: '#64748b'
    };
    return colors[type] || '#64748b';
  };


  return (
    <div ref={dropdownRef} className="notification-container">
      {/* Bell Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="notification-bell-button"
        aria-label="Notifications"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="notification-badge">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="notification-dropdown">
          {/* Header */}
          <div className="notification-header">
            <h3 className="notification-header-title">Thông báo</h3>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllAsRead} className="notification-mark-all-btn">
                Đánh dấu đã đọc
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          {(() => {
            const gradeCount = notifications.filter(isGradeNotification).length;
            const filteredNotifications = filterTab === 'grades'
              ? notifications.filter(isGradeNotification)
              : notifications;

            return (
              <>
                <div className="notification-tabs">
                  <button
                    type="button"
                    className={`notif-tab-btn ${filterTab === 'all' ? 'active' : ''}`}
                    onClick={() => setFilterTab('all')}
                  >
                    Tất cả ({notifications.length})
                  </button>
                  <button
                    type="button"
                    className={`notif-tab-btn ${filterTab === 'grades' ? 'active' : ''}`}
                    onClick={() => setFilterTab('grades')}
                  >
                    📊 Điểm số
                    {gradeCount > 0 && <span className="notif-tab-badge">{gradeCount}</span>}
                  </button>
                </div>

                {/* Notifications List */}
                <div className="notification-list">
                  {filteredNotifications.length === 0 && !loading ? (
                    <div className="notification-empty-state">
                      <span className="notification-empty-icon">{filterTab === 'grades' ? '📊' : '🔔'}</span>
                      <p>
                        {filterTab === 'grades'
                          ? 'Không có thông báo nào về điểm số và bảo vệ.'
                          : 'Chưa có thông báo nào'}
                      </p>
                    </div>
                  ) : (
                    <>
                      {filteredNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`notification-item ${notification.is_read ? 'notification-item-read' : 'notification-item-unread'} ${notification.action_url || notification.notification_type ? 'notification-item-clickable' : ''}`}
                  >
                    <span 
                      className="notification-icon"
                      style={{ 
                        backgroundColor: `${getNotificationColor(notification.notification_type)}15`,
                        borderRadius: '8px',
                        padding: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      {getNotificationIcon(notification.notification_type)}
                    </span>
                    <div className="notification-content">
                      <div className="notification-title">{notification.title}</div>
                      <div className="notification-message">{notification.message}</div>
                      <div
                        className="notification-time"
                        title={notification.created_at ? new Date(notification.created_at).toLocaleString('vi-VN') : ''}
                      >
                        {getRelativeTime(notification.created_at)}
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDeleteNotification(e, notification.id)}
                      className="notification-delete-btn"
                      aria-label="Delete notification"
                    >
                      ×
                    </button>
                  </div>
                ))}

                {/* Load More */}
                {hasMore && (
                  <button
                    onClick={handleLoadMore}
                    disabled={loading}
                    className="notification-load-more-btn"
                  >
                    {loading ? 'Loading...' : 'Load more'}
                  </button>
                )}
              </>
            )}

            {loading && notifications.length === 0 && (
              <div className="notification-loading-state">Loading notifications...</div>
            )}
          </div>
        </>
      );
    })()}
  </div>
)}
</div>
  );
};

export default NotificationDropdown;
