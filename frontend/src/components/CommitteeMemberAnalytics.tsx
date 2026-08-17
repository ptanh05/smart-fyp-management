import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import type { CommitteeMemberAnalytics as CommitteeMemberAnalyticsType } from '../types';
import './CommitteeMemberAnalytics.css';

const CommitteeMemberAnalytics: React.FC = () => {
  const [analytics, setAnalytics] = useState<CommitteeMemberAnalyticsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        const data = await apiService.getCommitteeMemberAnalytics();
        setAnalytics(data);
        setError(null);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load analytics';
        setError(errorMessage);
        console.error('Failed to fetch analytics:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="cm-analytics-container">
        <div className="cm-analytics-loading">Loading analytics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="cm-analytics-container">
        <div className="cm-analytics-error">
          <p className="cm-analytics-error-text">{error}</p>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return null;
  }

  const { panel, groups, evaluations, average_marks, completion } = analytics;

  const getProgressClass = (percent: number): string => {
    if (percent >= 75) return 'cm-progress-fill cm-progress-fill-high';
    if (percent >= 50) return 'cm-progress-fill cm-progress-fill-medium';
    return 'cm-progress-fill cm-progress-fill-low';
  };

  const getCircleProgressClass = (percent: number): string => {
    if (percent >= 75) return 'cm-completion-svg-progress cm-completion-svg-progress-high';
    if (percent >= 50) return 'cm-completion-svg-progress cm-completion-svg-progress-medium';
    return 'cm-completion-svg-progress cm-completion-svg-progress-low';
  };

  return (
    <div className="cm-analytics-container">
      <h3 className="cm-analytics-title">Dashboard Analytics</h3>
      
      {/* Panel Info */}
      <div className="cm-card">
        <h4 className="cm-card-title">Panel Information</h4>
        <div className="cm-panel-info">
          <div className="cm-panel-name">{panel.name || 'Unnamed Panel'}</div>
          <div className="cm-panel-stats">
            <div className="cm-panel-stat">
              <span className="cm-panel-stat-value">{panel.total_members}</span>
              <span className="cm-panel-stat-label">Panel Members</span>
            </div>
            <div className="cm-panel-stat">
              <span className="cm-panel-stat-value">{groups.total}</span>
              <span className="cm-panel-stat-label">Assigned Groups</span>
            </div>
            <div className="cm-panel-stat">
              <span className="cm-panel-stat-value">{groups.groups_per_member}</span>
              <span className="cm-panel-stat-label">Groups/Member</span>
            </div>
          </div>
        </div>
      </div>

      {/* Overall Completion */}
      <div className="cm-card">
        <h4 className="cm-card-title">Overall Progress</h4>
        <div className="cm-completion-container">
          <div className="cm-completion-circle">
            <svg viewBox="0 0 36 36" className="cm-completion-svg">
              <path
                className="cm-completion-svg-bg"
                d="M18 2.0845
                  a 15.9155 15.9155 0 0 1 0 31.831
                  a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className={getCircleProgressClass(completion.percentage)}
                d="M18 2.0845
                  a 15.9155 15.9155 0 0 1 0 31.831
                  a 15.9155 15.9155 0 0 1 0 -31.831"
                strokeDasharray={`${completion.percentage}, 100`}
              />
            </svg>
            <div className="cm-completion-percent">{completion.percentage}%</div>
          </div>
          <div className="cm-completion-details">
            <div className="cm-completion-stat">
              <span className="cm-completion-stat-label">Completed Evaluations</span>
              <span className="cm-completion-stat-value">{completion.completed_evaluations}</span>
            </div>
            <div className="cm-completion-stat">
              <span className="cm-completion-stat-label">Total Evaluations</span>
              <span className="cm-completion-stat-value">{completion.total_evaluations}</span>
            </div>
            <div className="cm-completion-stat">
              <span className="cm-completion-stat-label">Remaining</span>
              <span className="cm-completion-stat-value">
                {completion.total_evaluations - completion.completed_evaluations}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Evaluation Progress */}
      <div className="cm-card">
        <h4 className="cm-card-title">Evaluation Breakdown</h4>
        <div className="cm-evaluation-list">
          {Object.entries(evaluations).map(([key, stat]) => {
            const total = stat.completed + stat.pending;
            const percent = total > 0 ? Math.round((stat.completed / total) * 100) : 0;
            return (
              <div key={key} className="cm-evaluation-row">
                <div className="cm-evaluation-header">
                  <span className="cm-evaluation-label">
                    {key.replace(/_/g, ' ').replace('committee', '').trim()}
                  </span>
                  <span className="cm-evaluation-count">
                    {stat.completed}/{total}
                  </span>
                </div>
                <div className="cm-progress-bar">
                  <div 
                    className={getProgressClass(percent)}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Average Marks */}
      <div className="cm-card">
        <h4 className="cm-card-title">Average Marks by Evaluation</h4>
        <div className="cm-marks-grid">
          {Object.entries(average_marks).map(([key, value]) => (
            <div key={key} className="cm-mark-item">
              <div className="cm-mark-value">{value}</div>
              <div className="cm-mark-label">
                {key.replace(/_/g, ' ').replace('committee', '').trim()}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Panel Members */}
      <div className="cm-card">
        <h4 className="cm-card-title">Panel Members</h4>
        <div className="cm-members-list">
          {panel.members.map((member) => (
            <div key={member.id} className="cm-member-item">
              <div className="cm-member-avatar">
                {member.user__username.charAt(0).toUpperCase()}
              </div>
              <div className="cm-member-info">
                <div className="cm-member-name">{member.user__username}</div>
                <div className="cm-member-id">ID: {member.committee_id}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CommitteeMemberAnalytics;
