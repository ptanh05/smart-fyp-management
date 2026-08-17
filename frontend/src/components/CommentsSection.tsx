import React, { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/api';
import type { GroupComment, SupervisorStudentComment } from '../types';
import './CommentsSection.css';

interface CommentsSectionProps {
  /**
   * The type of comments to display:
   * - 'group': Group formation comments (students only)
   * - 'supervisor-student': Supervisor-student comments (both can post)
   */
  commentType: 'group' | 'supervisor-student';
  /**
   * The group ID for which to display/post comments
   */
  groupId: number;
  /**
   * Current user info to identify the commenter
   */
  currentUser?: {
    id: number;
    user_type: 'student' | 'supervisor' | 'committee_member';
  };
  /**
   * Whether to enable auto-refresh (polling)
   */
  autoRefresh?: boolean;
  /**
   * Refresh interval in milliseconds (default: 30000 = 30 seconds)
   */
  refreshInterval?: number;
  /**
   * Whether the comments section is read-only (no posting)
   */
  readOnly?: boolean;
  /**
   * Maximum height of the comments list (default: 400px)
   */
  maxHeight?: string;
}

type CommentItem = GroupComment | SupervisorStudentComment;

const CommentsSection: React.FC<CommentsSectionProps> = ({
  commentType,
  groupId,
  currentUser,
  autoRefresh = false,
  refreshInterval = 30000,
  readOnly = false,
  maxHeight = '400px',
}) => {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadComments = useCallback(async (page = 1, append = false) => {
    try {
      if (page === 1 && !append) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);

      if (commentType === 'group') {
        const data = await apiService.getGroupComments(groupId);
        // Group comments are not paginated
        setComments(data);
        setHasMore(false);
      } else {
        const data = await apiService.getSupervisorStudentComments(groupId, page);
        if (append && page > 1) {
          setComments(prev => [...prev, ...data.results]);
        } else {
          setComments(data.results);
        }
        setHasMore(!!data.next);
        setCurrentPage(page);
      }
    } catch (err: any) {
      console.error('Failed to load comments:', err);
      setError('Failed to load comments');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [groupId, commentType]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  // Auto-refresh polling
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      loadComments(1, false);
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, loadComments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      if (commentType === 'group') {
        await apiService.createGroupComment(groupId, newComment.trim());
      } else {
        await apiService.createSupervisorStudentComment({
          group: groupId,
          comment: newComment.trim(),
        });
      }
      setNewComment('');
      // Reload comments to show the new one
      loadComments(1, false);
    } catch (err: any) {
      console.error('Failed to post comment:', err);
      setError(err.response?.data?.message || 'Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLoadMore = () => {
    if (hasMore && !loadingMore) {
      loadComments(currentPage + 1, true);
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  const getCommenterInfo = (comment: CommentItem): { name: string; type: 'student' | 'supervisor'; isCurrentUser: boolean } => {
    if (commentType === 'group') {
      const groupComment = comment as GroupComment;
      return {
        name: groupComment.student?.user?.username || 'Unknown Student',
        type: 'student',
        isCurrentUser: currentUser?.user_type === 'student' && 
          groupComment.student?.id === currentUser?.id,
      };
    } else {
      const ssComment = comment as SupervisorStudentComment;
      if (ssComment.commented_by === 'supervisor') {
        return {
          name: ssComment.supervisor?.user?.username || 'Unknown Supervisor',
          type: 'supervisor',
          isCurrentUser: currentUser?.user_type === 'supervisor' && 
            ssComment.supervisor?.id === currentUser?.id,
        };
      } else {
        return {
          name: ssComment.student?.user?.username || 'Unknown Student',
          type: 'student',
          isCurrentUser: currentUser?.user_type === 'student' && 
            ssComment.student?.id === currentUser?.id,
        };
      }
    }
  };

  if (loading) {
    return (
      <div className="comments-section">
        <div className="comments-loading">
          <div className="spinner-small"></div>
          <span>Loading comments...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="comments-section">
      <div className="comments-header">
        <h4>
          {commentType === 'group' ? 'Group Formation Comments' : 'Discussion'}
        </h4>
        <button 
          className="btn-refresh" 
          onClick={() => loadComments(1, false)}
          title="Refresh comments"
        >
          ↻
        </button>
      </div>

      {error && (
        <div className="comments-error">
          {error}
        </div>
      )}

      <div className="comments-list" style={{ maxHeight }}>
        {comments.length === 0 ? (
          <div className="comments-empty">
            <span>💬</span>
            <p>No comments yet. Be the first to start the discussion!</p>
          </div>
        ) : (
          <>
            {comments.map((comment) => {
              const commenter = getCommenterInfo(comment);
              return (
                <div 
                  key={comment.id} 
                  className={`comment-item ${commenter.isCurrentUser ? 'my-comment' : ''}`}
                >
                  <div className="comment-avatar">
                    {commenter.type === 'supervisor' ? '👨‍🏫' : '👤'}
                  </div>
                  <div className="comment-content">
                    <div className="comment-header">
                      <span className={`comment-author ${commenter.type === 'supervisor' ? 'supervisor' : ''}`}>
                        {commenter.name}
                        {commenter.type === 'supervisor' && (
                          <span className="author-badge">Supervisor</span>
                        )}
                      </span>
                      <span className="comment-time">{formatDate(comment.created_at)}</span>
                    </div>
                    <div className="comment-text">{comment.comment}</div>
                  </div>
                </div>
              );
            })}
            {hasMore && (
              <div className="load-more-container">
                <button 
                  className="btn btn-secondary btn-sm"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {!readOnly && (
        <form className="comment-form" onSubmit={handleSubmit}>
          <div className="comment-input-wrapper">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Write a comment..."
              rows={2}
              maxLength={500}
              disabled={submitting}
            />
            <div className="comment-input-footer">
              <span className="char-count">{newComment.length}/500</span>
              <button 
                type="submit" 
                className="btn btn-primary btn-sm"
                disabled={!newComment.trim() || submitting}
              >
                {submitting ? (
                  <>
                    <span className="spinner-small"></span>
                    Posting...
                  </>
                ) : (
                  'Post'
                )}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
};

export default CommentsSection;
