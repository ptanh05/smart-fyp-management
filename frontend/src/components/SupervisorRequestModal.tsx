import React, { useState, useEffect, useRef, useCallback } from 'react';
import { apiService } from '../services/api';
import type { ProjectCategory, Project } from '../types';
import './Modal.css';

interface SupervisorRequestModalProps {
  onClose: () => void;
  projectCategories: ProjectCategory[];
  onSuccess: () => void;
  /** Project chosen in Project tab (own or committee-offered). Supervisor sees this idea when deciding. */
  initialProject: Project;
}

const SupervisorRequestModal: React.FC<SupervisorRequestModalProps> = ({
  onClose,
  projectCategories,
  onSuccess,
  initialProject,
}) => {
  const [supervisors, setSupervisors] = useState<any[]>([]);
  const [selectedSupervisor, setSelectedSupervisor] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [supervisorsLoading, setSupervisorsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supervisorSearch, setSupervisorSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const categoryId = initialProject.project_category;
  const categoryName = projectCategories.find((c) => c.id === categoryId)?.category_name ?? '';

  const loadSupervisors = useCallback(async (search?: string) => {
    try {
      setSupervisorsLoading(true);
      const data = await apiService.getSupervisors({ categoryId, search });
      setSupervisors(data.results || []);
    } catch (err) {
      setError('Failed to load supervisors. Please try again.');
      setSupervisors([]);
    } finally {
      setSupervisorsLoading(false);
    }
  }, [categoryId]);

  useEffect(() => {
    loadSupervisors();
  }, [loadSupervisors]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      loadSupervisors(supervisorSearch);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [supervisorSearch, loadSupervisors]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSupervisor) {
      setLoading(true);
      setError(null);
      try {
        await apiService.createSupervisorRequest({
          supervisor: selectedSupervisor,
          project: initialProject.id,
        });
        onSuccess();
        onClose();
      } catch (err: any) {
        const msg = err.response?.data?.message || err.message || 'Failed to send request.';
        setError(msg);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Request Supervisor</h2>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Project (chosen in Project tab)</label>
            <div
              className="supervisor-modal-project-readonly"
              style={{
                padding: '10px 12px',
                background: 'var(--bg-secondary)',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
              }}
            >
              <strong>{initialProject.project_name}</strong>
              <div style={{ marginTop: '6px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                {initialProject.project_description?.slice(0, 120)}
                {initialProject.project_description && initialProject.project_description.length > 120 ? '…' : ''}
              </div>
              <div style={{ marginTop: '4px', fontSize: '0.85rem' }}>
                {categoryName} · {initialProject.language}
              </div>
            </div>
            <p className="help-text" style={{ marginTop: '6px' }}>
              The supervisor will see this project idea when deciding to accept or reject.
            </p>
          </div>
          <div className="form-group">
            <label>Search Supervisor</label>
            <input
              type="text"
              placeholder="Search by name or research interest..."
              value={supervisorSearch}
              onChange={(e) => setSupervisorSearch(e.target.value)}
              style={{ marginBottom: '10px' }}
            />
            <label>Select Supervisor</label>
            {supervisorsLoading ? (
              <div className="loading-text">Loading supervisors...</div>
            ) : (
              <select
                value={selectedSupervisor || ''}
                onChange={(e) => setSelectedSupervisor(Number(e.target.value) || null)}
                required
              >
                <option value="">Choose a supervisor...</option>
                {supervisors.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.user?.username} {s.research_interest ? `– ${s.research_interest}` : ''}
                  </option>
                ))}
              </select>
            )}
            {!supervisorsLoading && supervisors.length === 0 && (
              <p className="help-text">No supervisors in this category.</p>
            )}
          </div>
          {error && (
            <div className="alert alert-error">
              {error}
            </div>
          )}
          <div className="btn-row">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || !selectedSupervisor}
            >
              {loading ? 'Sending...' : 'Send Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SupervisorRequestModal;
