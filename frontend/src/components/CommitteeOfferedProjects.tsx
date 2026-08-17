import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import type { Project, ProjectCategory } from '../types';
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
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    if (categoryId) {
      loadProjects();
    } else {
      setProjects([]);
    }
  }, [categoryId]);

  const loadProjects = async () => {
    if (!categoryId) return;
    try {
      setLoading(true);
      const data = await apiService.getProjects({
        offered: true,
        categoryId: Number(categoryId),
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
      <div className="form-group">
        <label>Category</label>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value === '' ? '' : Number(e.target.value))}
          aria-label="Category"
        >
          <option value="">Select category...</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.category_name}
            </option>
          ))}
        </select>
      </div>
      {categoryId && (
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
