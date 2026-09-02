import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import type { Project, ProjectCategory, Supervisor } from '../types';
import './CommitteeOfferedProjects.css';

interface CommitteeOfferedProjectsProps {
  categories: ProjectCategory[];
  selectedProjectId: number | null;
  onSelectProject: (project: Project) => void;
}

const CommitteeOfferedProjects: React.FC<CommitteeOfferedProjectsProps> = ({
  categories,
  selectedProjectId,
  onSelectProject,
}) => {
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [supervisorId, setSupervisorId] = useState<number | ''>('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    // Load supervisors once
    apiService.getSupervisors().then(res => setSupervisors(res.results)).catch(console.error);
  }, []);

  useEffect(() => {
    if (categoryId || supervisorId) {
      loadProjects();
    } else {
      setProjects([]);
    }
  }, [categoryId, supervisorId]);

  const loadProjects = async () => {
    if (!categoryId && !supervisorId) return;
    try {
      setLoading(true);
      const data = await apiService.getProjects({
        offered: true,
        categoryId: categoryId ? Number(categoryId) : undefined,
        supervisorId: supervisorId ? Number(supervisorId) : undefined,
      });
      setProjects(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load offered projects:', err);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  const categoryName = (id: number) => categories.find((c) => c.id === id)?.category_name ?? '';

  return (
    <div className="committee-offered-projects card">
      <h3>Offered Projects</h3>
      <p className="committee-offered-description">
        Choose a category to see projects set by admin. Select one to use when requesting a supervisor.
      </p>
      <div className="filters-container" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
          <label>Category</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value === '' ? '' : Number(e.target.value))}
            aria-label="Category"
          >
            <option value="">All Categories...</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.category_name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
          <label>Supervisor</label>
          <select
            value={supervisorId}
            onChange={(e) => setSupervisorId(e.target.value === '' ? '' : Number(e.target.value))}
            aria-label="Supervisor"
          >
            <option value="">All Supervisors...</option>
            {supervisors.map((s) => (
              <option key={s.id} value={s.id}>
                {s.user.first_name} {s.user.last_name}
              </option>
            ))}
          </select>
        </div>
      </div>
      {(categoryId || supervisorId) && (
        <>
          {loading ? (
            <div className="empty-state">Loading...</div>
          ) : projects.length === 0 ? (
            <div className="empty-state">No offered projects in this category.</div>
          ) : (
            <div className="committee-offered-list">
              {projects.map((p) => {
                const isSelected = selectedProjectId === p.id;
                const isExpanded = expandedId === p.id;
                return (
                  <div
                    key={p.id}
                    className={`committee-offered-item ${isSelected ? 'selected' : ''}`}
                  >
                    <div className="committee-offered-item-header">
                      <span className="committee-offered-item-name">{p.project_name}</span>
                      <span className="committee-offered-item-meta">
                        {categoryName(p.project_category)} · {p.language}
                      </span>
                      <div className="committee-offered-item-actions">
                        <button
                          type="button"
                          className="btn btn-text btn-sm"
                          onClick={() => setExpandedId(isExpanded ? null : p.id)}
                        >
                          {isExpanded ? 'Less' : 'Details'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => onSelectProject(p)}
                        >
                          {isSelected ? 'Selected' : 'Select for supervisor request'}
                        </button>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="committee-offered-item-detail">
                        <p><strong>Description</strong><br />{p.project_description}</p>
                        {p.functionalities && (
                          <p><strong>Functionalities</strong><br />{p.functionalities}</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CommitteeOfferedProjects;
