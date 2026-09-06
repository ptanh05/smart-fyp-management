import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import type { Notification, NotificationType } from '../types';
import './NotificationDropdown.css';

interface NotificationDropdownProps {
  onNavigate?: (url: string) => void;
}

const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ onNavigate }) => {
  const navigate = useNavigate();
  const { userType } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // Initial fetch and polling setup
  useEffect(() => {
    fetchUnreadCount();
    
    // Poll for unread count every 30 seconds
    pollIntervalRef.current = setInterval(fetchUnreadCount, 30000);
    
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
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

    // Navigate if action URL exists
    if (notification.action_url) {
      if (onNavigate) {
        onNavigate(notification.action_url);
      } else {
        navigate(notification.action_url);
      }
      setIsOpen(false);
      return;
    }

    // Handle navigation based on notification type
    let targetUrl = '';
    switch (notification.notification_type) {
      case 'external_assignment':
      case 'external_evaluation':
        if (userType === 'external_examiner') {
          targetUrl = '/external_examiner/dashboard';
        } else if (userType === 'student') {
          targetUrl = '/student/dashboard';
        }
        break;
      case 'external_schedule':
        if (userType === 'external_examiner') {
          targetUrl = '/external_examiner/dashboard';
        } else if (userType === 'student') {
          targetUrl = '/student/dashboard';
        } else if (userType === 'committee_member') {
          targetUrl = '/committee_member/dashboard';
        }
        break;
      case 'group_request':
      case 'group_request_accepted':
      case 'group_request_rejected':
        if (userType === 'student') {
          targetUrl = '/student/dashboard';
        }
        break;
      case 'supervisor_request':
      case 'supervisor_request_accepted':
      case 'supervisor_request_rejected':
        if (userType === 'student') {
          targetUrl = '/student/dashboard';
        } else if (userType === 'supervisor') {
          targetUrl = '/supervisor/dashboard';
        }
        break;
      case 'new_chat_message':
        if (userType === 'student') {
          targetUrl = '/student/dashboard';
        } else if (userType === 'supervisor') {
          targetUrl = '/supervisor/dashboard';
        }
        break;
      case 'document_uploaded':
      case 'document_approved':
      case 'document_rejected':
        if (userType === 'student') {
          targetUrl = '/student/dashboard';
        } else if (userType === 'supervisor') {
          targetUrl = '/supervisor/dashboard';
        }
        break;
      case 'evaluation_completed':
        if (userType === 'student') {
          targetUrl = '/student/dashboard';
        } else if (userType === 'supervisor') {
          targetUrl = '/supervisor/dashboard';
        } else if (userType === 'committee_member') {
          targetUrl = '/committee_member/dashboard';
        }
        break;
      default:
        break;
    }

    if (targetUrl) {
      if (onNavigate) {
        onNavigate(targetUrl);
      } else {
        navigate(targetUrl);
      }
      setIsOpen(false);
    }
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

  // Format time ago
  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return date.toLocaleDateString();
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
            <h3 className="notification-header-title">Notifications</h3>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllAsRead} className="notification-mark-all-btn">
                Mark all as read
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="notification-list">
            {notifications.length === 0 && !loading ? (
              <div className="notification-empty-state">
                <span className="notification-empty-icon">🔔</span>
                <p>No notifications yet</p>
              </div>
            ) : (
              <>
                {notifications.map((notification) => (
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
                      <div className="notification-time">
                        {formatTimeAgo(notification.created_at)}
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
        </div>
      )}
    </div>
  );
};

export default NotificationDropdown;
