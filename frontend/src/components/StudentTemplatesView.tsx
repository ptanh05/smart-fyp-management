import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import './StudentTemplatesView.css';

interface Template {
  id: number;
  title: string;
  template_type: string;
  semester: string;
  uploaded_file: string;
  uploaded_at: string;
}

interface StudentTemplatesViewProps {
  /** Student's current semester; used as default filter */
  studentSemester?: string;
}

const TEMPLATE_TYPES = [
  { value: 'scope_document_template', label: 'Scope Document Template' },
  { value: 'srs_template', label: 'SRS Template' },
  { value: 'sdd_template', label: 'SDD Template' },
  { value: 'final_report_template', label: 'Final Report Template' },
] as const;

const SEMESTERS = [
  { value: 'semester_6', label: 'Semester 6' },
  { value: 'semester_7', label: 'Semester 7' },
  { value: 'semester_8', label: 'Semester 8' },
];

const StudentTemplatesView: React.FC<StudentTemplatesViewProps> = ({ studentSemester }) => {
  const [templateType, setTemplateType] = useState<string>(TEMPLATE_TYPES[0].value);
  const [semester, setSemester] = useState<string>(studentSemester || '');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (studentSemester && !semester) {
      setSemester(studentSemester);
    }
  }, [studentSemester]);

  useEffect(() => {
    if (semester) {
      loadTemplates();
    } else {
      setTemplates([]);
    }
  }, [templateType, semester]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiService.getTemplates(templateType, semester);
      setTemplates(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load templates:', err);
      setError('Failed to load templates. Please try again.');
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = (fileUrl: string, fileName: string) => {
    let filename = fileUrl;
    if (fileUrl.includes('/')) {
      filename = fileUrl.split('/').pop() || fileName;
    }
    const downloadUrl = `/app/doc_templates/${filename}`;
    window.open(downloadUrl, '_blank');
  };

  const formatLabel = (s: string) =>
    s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="student-templates-view card">
      <h2>Templates</h2>
      <p className="templates-description">
        View and download document templates uploaded by the committee. Use these as guidelines for your submissions.
      </p>

      <div className="templates-filters">
        <div className="form-group">
          <label>Template type</label>
          <select
            value={templateType}
            onChange={(e) => setTemplateType(e.target.value)}
            aria-label="Template type"
          >
            {TEMPLATE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Semester</label>
          <select
            value={semester}
            onChange={(e) => setSemester(e.target.value)}
            aria-label="Semester"
          >
            <option value="">Select semester...</option>
            {SEMESTERS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!semester ? (
        <div className="empty-state">
          <p>Select a semester to view templates.</p>
        </div>
      ) : error ? (
        <div className="templates-error">
          <p>{error}</p>
          <button type="button" className="btn btn-secondary" onClick={loadTemplates}>
            Retry
          </button>
        </div>
      ) : loading ? (
        <div className="empty-state">
          <div className="loading-spinner" aria-hidden="true" />
          <p>Loading templates...</p>
        </div>
      ) : templates.length === 0 ? (
        <div className="empty-state">
          <p>No templates uploaded for this semester yet.</p>
          <p className="hint">Check back later or try another semester.</p>
        </div>
      ) : (
        <div className="templates-table-wrapper">
          <table className="table templates-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Semester</th>
                <th>Uploaded</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id}>
                  <td>{t.title}</td>
                  <td>{formatLabel(t.semester)}</td>
                  <td>{new Date(t.uploaded_at).toLocaleDateString()}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => downloadTemplate(t.uploaded_file, t.title)}
                    >
                      Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default StudentTemplatesView;
