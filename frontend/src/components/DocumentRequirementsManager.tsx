import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import type { DocumentRequirement, DocumentTypeValue } from '../types';
import './DocumentRequirementsManager.css';

const DOCUMENT_TYPES: { value: DocumentTypeValue; label: string }[] = [
  { value: 'scope_document', label: 'Scope Document' },
  { value: 'srs_document', label: 'SRS Document' },
  { value: 'sdd_document', label: 'SDD Document' },
  { value: 'final_report_document', label: 'Final Report' },
  { value: 'presentation_document', label: 'Presentation' },
];

const SEMESTERS = [
  { value: '', label: 'All semesters' },
  { value: 'semester_6', label: 'Semester 6' },
  { value: 'semester_7', label: 'Semester 7' },
  { value: 'semester_8', label: 'Semester 8' },
];

const DocumentRequirementsManager: React.FC = () => {
  const [requirements, setRequirements] = useState<DocumentRequirement[]>([]);
  const [loading, setLoading] = useState(false);
  const [semesterFilter, setSemesterFilter] = useState('');
  const [form, setForm] = useState({
    document_type: 'srs_document' as DocumentTypeValue,
    title: '',
    deadline: '',
    semester: '' as string | null,
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<{ title: string; deadline: string; semester: string | null } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiService.getDocumentRequirements(
        semesterFilter || undefined
      );
      setRequirements(data || []);
    } catch (err) {
      console.error('Failed to load document requirements:', err);
      setError('Failed to load requirements.');
      setRequirements([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [semesterFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.deadline) {
      setError('Title and deadline are required.');
      return;
    }
    try {
      setSubmitting(true);
      setError(null);
      await apiService.createDocumentRequirement({
        document_type: form.document_type,
        title: form.title.trim(),
        deadline: form.deadline,
        semester: form.semester || null,
      });
      setForm({ document_type: 'srs_document', title: '', deadline: '', semester: null });
      await load();
    } catch (err: any) {
      const data = err.response?.data;
      const message = data?.message || data?.detail || err.message || 'Failed to create.';
      const detail = typeof data?.detail === 'string' && data?.message ? data.detail : null;
      setError(detail ? `${message}: ${detail}` : message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (id: number) => {
    if (!editForm) return;
    try {
      setSubmitting(true);
      setError(null);
      await apiService.updateDocumentRequirement(id, {
        title: editForm.title.trim(),
        deadline: editForm.deadline,
        semester: editForm.semester || null,
      });
      setEditingId(null);
      setEditForm(null);
      await load();
    } catch (err: any) {
      const data = err.response?.data;
      const message = data?.message || data?.detail || err.message || 'Failed to update.';
      const detail = typeof data?.detail === 'string' && data?.message ? data.detail : null;
      setError(detail ? `${message}: ${detail}` : message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this document requirement?')) return;
    try {
      setSubmitting(true);
      setError(null);
      await apiService.deleteDocumentRequirement(id);
      await load();
    } catch (err: any) {
      const data = err.response?.data;
      const message = data?.message || data?.detail || err.message || 'Failed to delete.';
      const detail = typeof data?.detail === 'string' && data?.message ? data.detail : null;
      setError(detail ? `${message}: ${detail}` : message);
    } finally {
      setSubmitting(false);
    }
  };

  const formatDeadline = (s: string) => {
    const d = new Date(s);
    return d.toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  return (
    <div className="document-requirements-manager card">
      <h2>Document Requirements & Deadlines</h2>
      <p className="dr-description">
        Define document types (SRS, SDD, presentation, etc.) and upload deadlines. Students see these and submit documents accordingly; submissions are evaluated on the portal.
      </p>

      <div className="dr-filters">
        <div className="form-group">
          <label>Semester filter</label>
          <select
            value={semesterFilter}
            onChange={(e) => setSemesterFilter(e.target.value)}
            aria-label="Filter by semester"
          >
            {SEMESTERS.map((s) => (
              <option key={s.value || 'all'} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <form onSubmit={handleCreate} className="dr-form">
        <h3>Add requirement</h3>
        <div className="dr-form-grid">
          <div className="form-group">
            <label>Document type</label>
            <select
              value={form.document_type}
              onChange={(e) =>
                setForm((f) => ({ ...f, document_type: e.target.value as DocumentTypeValue }))
              }
            >
              {DOCUMENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. SRS Submission – Phase 1"
              maxLength={200}
            />
          </div>
          <div className="form-group">
            <label>Deadline</label>
            <input
              type="datetime-local"
              value={form.deadline}
              onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
              required
            />
          </div>
          <div className="form-group">
            <label>Semester (optional)</label>
            <select
              value={form.semester ?? ''}
              onChange={(e) =>
                setForm((f) => ({ ...f, semester: e.target.value || null }))
              }
            >
              <option value="">All semesters</option>
              <option value="semester_6">Semester 6</option>
              <option value="semester_7">Semester 7</option>
              <option value="semester_8">Semester 8</option>
            </select>
          </div>
        </div>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Adding...' : 'Add requirement'}
        </button>
      </form>

      {error && (
        <div className="alert alert-error" style={{ marginTop: '1rem' }}>
          {error}
        </div>
      )}

      <div className="dr-list">
        <h3>Current requirements</h3>
        {loading ? (
          <div className="empty-state">Loading...</div>
        ) : requirements.length === 0 ? (
          <div className="empty-state">No document requirements yet.</div>
        ) : (
          <div className="dr-table-wrapper">
            <table className="table dr-table">
              <thead>
                <tr>
                  <th>Document type</th>
                  <th>Title</th>
                  <th>Deadline</th>
                  <th>Semester</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requirements.map((r) => (
                  <tr key={r.id}>
                    <td>{r.document_type_display}</td>
                    <td>
                      {editingId === r.id && editForm ? (
                        <input
                          type="text"
                          value={editForm.title}
                          onChange={(e) =>
                            setEditForm((f) => f && { ...f, title: e.target.value })
                          }
                          className="dr-edit-input"
                        />
                      ) : (
                        r.title
                      )}
                    </td>
                    <td>
                      {editingId === r.id && editForm ? (
                        <input
                          type="datetime-local"
                          value={editForm.deadline}
                          onChange={(e) =>
                            setEditForm((f) => f && { ...f, deadline: e.target.value })
                          }
                          className="dr-edit-input"
                        />
                      ) : (
                        formatDeadline(r.deadline)
                      )}
                    </td>
                    <td>
                      {editingId === r.id && editForm ? (
                        <select
                          value={editForm.semester ?? ''}
                          onChange={(e) =>
                            setEditForm((f) =>
                              f ? { ...f, semester: e.target.value || null } : f
                            )
                          }
                          className="dr-edit-input"
                        >
                          <option value="">All</option>
                          <option value="semester_6">Semester 6</option>
                          <option value="semester_7">Semester 7</option>
                          <option value="semester_8">Semester 8</option>
                        </select>
                      ) : r.semester ? (
                        r.semester.replace('_', ' ')
                      ) : (
                        'All'
                      )}
                    </td>
                    <td>
                      {editingId === r.id && editForm ? (
                        <>
                          <button
                            type="button"
                            className="btn btn-success btn-sm"
                            onClick={() => handleUpdate(r.id)}
                            disabled={submitting}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setEditingId(null);
                              setEditForm(null);
                            }}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setEditingId(r.id);
                              setEditForm({
                                title: r.title,
                                deadline: r.deadline.slice(0, 16),
                                semester: r.semester,
                              });
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDelete(r.id)}
                            disabled={submitting}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentRequirementsManager;
