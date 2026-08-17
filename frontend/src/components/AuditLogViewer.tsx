import React, { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/api';
import type { AuditLog, AuditLogStats } from '../types';
import './AuditLogViewer.css';

interface AuditLogViewerProps {
  groupId?: number; // If provided, only show logs for this group
  showStats?: boolean;
}

const AuditLogViewer: React.FC<AuditLogViewerProps> = ({ groupId, showStats = true }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<AuditLogStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [evaluationType, setEvaluationType] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  const evaluationTypes = [
    { value: '', label: 'All Evaluations' },
    { value: 'scope_document', label: 'Scope Document' },
    { value: 'srs_supervisor', label: 'SRS (Supervisor)' },
    { value: 'srs_committee', label: 'SRS (Committee)' },
    { value: 'sdd_supervisor', label: 'SDD (Supervisor)' },
    { value: 'sdd_committee', label: 'SDD (Committee)' },
    { value: 'evaluation3_supervisor', label: 'Evaluation 3 (Supervisor)' },
    { value: 'evaluation3_committee', label: 'Evaluation 3 (Committee)' },
    { value: 'evaluation4_supervisor', label: 'Evaluation 4 (Supervisor)' },
    { value: 'evaluation4_committee', label: 'Evaluation 4 (Committee)' },
  ];

  const fetchLogs = useCallback(async (page = 1, append = false) => {
    try {
      if (page === 1) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const params: Record<string, unknown> = { page };
      if (evaluationType) params.evaluation_type = evaluationType;
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;
      if (groupId) params.group = groupId;

      let response;
      if (groupId) {
        response = await apiService.getAuditLogsByGroup(groupId, page);
      } else {
        response = await apiService.getAuditLogs(params);
      }

      if (append) {
        setLogs(prev => [...prev, ...response.results]);
      } else {
        setLogs(response.results);
      }
      setHasMore(response.next !== null);
      setCurrentPage(page);
      setError(null);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load audit logs';
      setError(errorMessage);
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [evaluationType, fromDate, toDate, groupId]);

  const fetchStats = useCallback(async () => {
    try {
      const data = await apiService.getAuditLogStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch audit stats:', err);
    }
  }, []);

  useEffect(() => {
    fetchLogs(1);
    if (showStats && !groupId) {
      fetchStats();
    }
  }, [fetchLogs, fetchStats, showStats, groupId]);

  const handleFilterChange = () => {
    fetchLogs(1);
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      fetchLogs(currentPage + 1, true);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const getEvaluationTypeBadgeClass = (type: string | null): string => {
    if (!type) return 'audit-badge audit-badge-default';
    const classMap: Record<string, string> = {
      scope_document: 'audit-badge audit-badge-scope-document',
      srs_supervisor: 'audit-badge audit-badge-srs-supervisor',
      srs_committee: 'audit-badge audit-badge-srs-committee',
      sdd_supervisor: 'audit-badge audit-badge-sdd-supervisor',
      sdd_committee: 'audit-badge audit-badge-sdd-committee',
      evaluation3_supervisor: 'audit-badge audit-badge-evaluation3-supervisor',
      evaluation3_committee: 'audit-badge audit-badge-evaluation3-committee',
      evaluation4_supervisor: 'audit-badge audit-badge-evaluation4-supervisor',
      evaluation4_committee: 'audit-badge audit-badge-evaluation4-committee',
    };
    return classMap[type] || 'audit-badge audit-badge-default';
  };

  const getUserTypeBadgeClass = (userType: string): string => {
    const classMap: Record<string, string> = {
      supervisor: 'audit-badge audit-badge-supervisor',
      committee_member: 'audit-badge audit-badge-committee-member',
      student: 'audit-badge audit-badge-student',
    };
    return classMap[userType] || 'audit-badge audit-badge-default';
  };

  if (loading) {
    return (
      <div className="audit-container">
        <div className="audit-loading">Loading audit logs...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="audit-container">
        <div className="audit-error">{error}</div>
      </div>
    );
  }

  return (
    <div className="audit-container">
      <h3 className="audit-title">Audit Logs</h3>

      {/* Stats Summary */}
      {showStats && stats && !groupId && (
        <div className="audit-stats-container">
          <div className="audit-stat-card">
            <div className="audit-stat-value">{stats.total_logs}</div>
            <div className="audit-stat-label">Total Changes</div>
          </div>
          <div className="audit-stat-card">
            <div className="audit-stat-value">{stats.recent_logs_7_days}</div>
            <div className="audit-stat-label">Last 7 Days</div>
          </div>
        </div>
      )}

      {/* Filters */}
      {!groupId && (
        <div className="audit-filters-container">
          <div className="audit-filter-group">
            <label className="audit-filter-label">Evaluation Type</label>
            <select
              value={evaluationType}
              onChange={(e) => setEvaluationType(e.target.value)}
              className="audit-filter-select"
            >
              {evaluationTypes.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>
          <div className="audit-filter-group">
            <label className="audit-filter-label">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="audit-filter-input"
            />
          </div>
          <div className="audit-filter-group">
            <label className="audit-filter-label">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="audit-filter-input"
            />
          </div>
          <button onClick={handleFilterChange} className="audit-filter-button">
            Apply Filters
          </button>
        </div>
      )}

      {/* Logs List */}
      {logs.length === 0 ? (
        <div className="audit-empty-state">
          <span className="audit-empty-icon">📋</span>
          <p>No audit logs found</p>
        </div>
      ) : (
        <div className="audit-logs-list">
          {logs.map((log) => (
            <div key={log.id} className="audit-log-item">
              <div className="audit-log-header">
                <div className="audit-log-user">
                  <span className="audit-username">{log.user_username}</span>
                  <span className={getUserTypeBadgeClass(log.user_type)}>
                    {log.user_type.replace('_', ' ')}
                  </span>
                </div>
                <span className="audit-log-time">{formatDate(log.created_at)}</span>
              </div>

              {log.evaluation_type && (
                <div className="audit-log-eval-type">
                  <span className={getEvaluationTypeBadgeClass(log.evaluation_type)}>
                    {evaluationTypes.find(t => t.value === log.evaluation_type)?.label || log.evaluation_type}
                  </span>
                </div>
              )}

              <div className="audit-log-description">{log.description}</div>

              {log.group_info && (
                <div className="audit-log-group">
                  <span className="audit-group-label">Group:</span>
                  <span>{log.group_info.project_name || 'Unnamed Project'}</span>
                  <span className="audit-group-students">
                    ({log.group_info.student_1} & {log.group_info.student_2})
                  </span>
                </div>
              )}

              {(log.old_value || log.new_value) && (
                <div className="audit-log-change">
                  <div className="audit-change-arrow">
                    <span className="audit-old-value">{log.old_value || 'N/A'}</span>
                    <span className="audit-arrow">→</span>
                    <span className="audit-new-value">{log.new_value || 'N/A'}</span>
                  </div>
                </div>
              )}
            </div>
          ))}

          {hasMore && (
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="audit-load-more-button"
            >
              {loadingMore ? 'Loading...' : 'Load More'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default AuditLogViewer;
