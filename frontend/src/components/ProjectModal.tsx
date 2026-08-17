import React, { useState } from 'react';
import { apiService } from '../services/api';
import type { ProjectCategory } from '../types';
import './Modal.css';

interface ProjectModalProps {
  onClose: () => void;
  projectCategories: ProjectCategory[];
  onSuccess: () => void;
}

const ProjectModal: React.FC<ProjectModalProps> = ({ onClose, projectCategories, onSuccess }) => {
  const [formData, setFormData] = useState({
    project_name: '',
    project_description: '',
    language: '',
    functionalities: '',
    project_category: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiService.createProject({
        ...formData,
        project_category: Number(formData.project_category),
      });
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Failed to create project:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create Project</h2>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Project Name</label>
            <input
              type="text"
              value={formData.project_name}
              onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>Project Category</label>
            <select
              value={formData.project_category}
              onChange={(e) => setFormData({ ...formData, project_category: e.target.value })}
              required
            >
              <option value="">Choose a category...</option>
              {projectCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.category_name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea
              value={formData.project_description}
              onChange={(e) => setFormData({ ...formData, project_description: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>Language</label>
            <input
              type="text"
              value={formData.language}
              onChange={(e) => setFormData({ ...formData, language: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>Functionalities</label>
            <textarea
              value={formData.functionalities}
              onChange={(e) => setFormData({ ...formData, functionalities: e.target.value })}
              required
            />
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProjectModal;
