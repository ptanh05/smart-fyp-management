import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import type { SupervisorAnalytics as SupervisorAnalyticsType } from '../types';
import './SupervisorAnalytics.css';

const SupervisorAnalytics: React.FC = () => {
  const [analytics, setAnalytics] = useState<SupervisorAnalyticsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        const data = await apiService.getSupervisorAnalytics();
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
      <div className="sv-analytics-container">
        <div className="sv-analytics-loading">Loading analytics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sv-analytics-container">
        <div className="sv-analytics-error">
          <p className="sv-analytics-error-text">{error}</p>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return null;
  }

  const { groups, evaluations, average_marks, documents, recent_documents } = analytics;

  // Calculate evaluation completion percentage
  const totalEvaluations = Object.values(evaluations).reduce(
    (sum, stat) => sum + stat.completed + stat.pending,
    0
  );
  const completedEvaluations = Object.values(evaluations).reduce(
    (sum, stat) => sum + stat.completed,
    0
  );
  const completionPercentage = totalEvaluations > 0 
    ? Math.round((completedEvaluations / totalEvaluations) * 100) 
    : 0;

  const getProgressClass = (percent: number): string => {
    if (percent >= 75) return 'sv-progress-fill sv-progress-fill-high';
    if (percent >= 50) return 'sv-progress-fill sv-progress-fill-medium';
    return 'sv-progress-fill sv-progress-fill-low';
  };

  const getStatusClass = (status: string): string => {
    if (status === 'accepted') return 'sv-recent-status-accepted';
    if (status === 'pending') return 'sv-recent-status-pending';
    return 'sv-recent-status-rejected';
  };

  return (
    <div className="sv-analytics-container">
      <h3 className="sv-analytics-title">Dashboard Analytics</h3>
      
      {/* Groups Overview */}
      <div className="sv-stats-grid">
        <div className="sv-stat-card sv-stat-card-blue">
          <div className="sv-stat-value">{groups.total}</div>
          <div className="sv-stat-label">Total Groups</div>
        </div>
        <div className="sv-stat-card sv-stat-card-orange">
          <div className="sv-stat-value">{groups.pending}</div>
          <div className="sv-stat-label">Pending Requests</div>
        </div>
        <div className="sv-stat-card sv-stat-card-green">
          <div className="sv-stat-value">{groups.accepted}</div>
          <div className="sv-stat-label">Active Groups</div>
        </div>
        <div className="sv-stat-card sv-stat-card-red">
          <div className="sv-stat-value">{groups.rejected}</div>
          <div className="sv-stat-label">Rejected</div>
        </div>
      </div>

      {/* Evaluation Progress */}
      <div className="sv-card">
        <h4 className="sv-card-title">Evaluation Progress</h4>
        <div className="sv-progress-container">
          <div className="sv-progress-bar">
            <div 
              className={getProgressClass(completionPercentage)}
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
          <span className="sv-progress-text">
            {completedEvaluations}/{totalEvaluations} ({completionPercentage}%)
          </span>
        </div>
        
        <div className="sv-evaluation-grid">
          {Object.entries(evaluations).map(([key, stat]) => (
            <div key={key} className="sv-evaluation-item">
              <span className="sv-evaluation-label">
                {key.replace(/_/g, ' ').replace('supervisor', '').trim()}
              </span>
              <span className="sv-evaluation-value">
                <span className="sv-evaluation-completed">{stat.completed}</span>
                {' / '}
                <span className="sv-evaluation-pending">{stat.pending}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Average Marks */}
      <div className="sv-card">
        <h4 className="sv-card-title">Average Marks</h4>
        <div className="sv-marks-grid">
          {Object.entries(average_marks).map(([key, value]) => (
            <div key={key} className="sv-mark-item">
              <div className="sv-mark-value">{value}</div>
              <div className="sv-mark-label">
                {key.replace(/_/g, ' ').replace('supervisor', '').trim()}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Documents Overview */}
      <div className="sv-card">
        <h4 className="sv-card-title">Documents Overview</h4>
        <div className="sv-document-stats">
          <div className="sv-document-stat">
            <span className="sv-document-stat-value">{documents.total}</span>
            <span className="sv-document-stat-label">Total</span>
          </div>
          <div className="sv-document-stat">
            <span className="sv-document-stat-value sv-document-stat-pending">{documents.pending}</span>
            <span className="sv-document-stat-label">Pending Review</span>
          </div>
          <div className="sv-document-stat">
            <span className="sv-document-stat-value sv-document-stat-approved">{documents.approved}</span>
            <span className="sv-document-stat-label">Approved</span>
          </div>
        </div>
      </div>

      {/* Recent Documents */}
      {recent_documents.length > 0 && (
        <div className="sv-card">
          <h4 className="sv-card-title">Recent Documents</h4>
          <div className="sv-recent-list">
            {recent_documents.map((doc) => (
              <div key={doc.id} className="sv-recent-item">
                <div className="sv-recent-icon">📄</div>
                <div className="sv-recent-content">
                  <div className="sv-recent-title">{doc.title}</div>
                  <div className="sv-recent-meta">
                    {doc.document_type.replace(/_/g, ' ')} • 
                    <span className={getStatusClass(doc.status)}>
                      {' '}{doc.status}
                    </span>
                  </div>
                </div>
                <div className="sv-recent-date">
                  {new Date(doc.uploaded_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SupervisorAnalytics;
