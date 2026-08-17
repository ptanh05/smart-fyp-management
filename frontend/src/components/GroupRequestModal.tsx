import React, { useState, useEffect, useRef } from 'react';
import { apiService } from '../services/api';
import type { ProjectCategory, Student } from '../types';
import './Modal.css';

interface GroupRequestModalProps {
  onClose: () => void;
  onSubmit: (studentId: number, categoryId: number) => void;
  projectCategories: ProjectCategory[];
}

const GroupRequestModal: React.FC<GroupRequestModalProps> = ({
  onClose,
  onSubmit,
  projectCategories,
}) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadStudents();
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      loadStudents(searchQuery);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery]);

  const loadStudents = async (search?: string) => {
    try {
      setLoadingStudents(true);
      const data = await apiService.getStudentsList({ forRequest: true, search });
      setStudents(data.results || []);
      if (data.results && data.results.length === 0 && !search) {
        setError('No students available for group request');
      }
    } catch (error: any) {
      console.error('Failed to load students:', error);
      setError(error.response?.data?.message || 'Failed to load students');
    } finally {
      setLoadingStudents(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!selectedStudent || !selectedCategory) {
      setError('Please select both a student and a project category');
      return;
    }

    setLoading(true);
    try {
      await onSubmit(selectedStudent, selectedCategory);
      // Modal will be closed by parent component on success
    } catch (error: any) {
      console.error('Failed to create group request:', error);
      setError(error.response?.data?.message || error.message || 'Failed to send group request');
      setLoading(false);
    }
  };

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Send Group Request</h2>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          {error && (
            <div className="alert alert-error">
              {error}
            </div>
          )}
          <div className="form-group">
            <label>Search Student</label>
            <input
              type="text"
              placeholder="Search by name or registration number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={loading}
              style={{ marginBottom: '10px' }}
            />
            <label>Select Student</label>
            {loadingStudents ? (
              <div>Loading students...</div>
            ) : (
              <select
                value={selectedStudent || ''}
                onChange={(e) => {
                  setSelectedStudent(Number(e.target.value));
                  setError('');
                }}
                required
                disabled={loading}
              >
                <option value="">Choose a student...</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.user.username} ({student.registration_no})
                  </option>
                ))}
              </select>
            )}
            {!loadingStudents && students.length === 0 && searchQuery && (
              <p className="help-text">
                No students found matching "{searchQuery}".
              </p>
            )}
            {!loadingStudents && students.length === 0 && !searchQuery && (
              <p className="help-text">
                No students available. Make sure you're in the same batch/department/semester.
              </p>
            )}
          </div>
          <div className="form-group">
            <label>Project Category</label>
            <select
              value={selectedCategory || ''}
              onChange={(e) => {
                setSelectedCategory(Number(e.target.value));
                setError('');
              }}
              required
              disabled={loading}
            >
              <option value="">Choose a category...</option>
              {projectCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.category_name}
                </option>
              ))}
            </select>
          </div>
          <div className="btn-row">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading || loadingStudents}>
              {loading ? 'Sending...' : 'Send Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default GroupRequestModal;
