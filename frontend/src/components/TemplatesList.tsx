import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';

interface Template {
  id: number;
  title: string;
  template_type: string;
  semester: string;
  uploaded_file: string;
  uploaded_at: string;
}

interface TemplatesListProps {
  templateType: string;
}

// File validation constants (matching backend)
const MAX_FILE_SIZE_MB = 25;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx', 'ppt', 'pptx'];

const TemplatesList: React.FC<TemplatesListProps> = ({ templateType }) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [semester, setSemester] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, [templateType, semester]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const data = await apiService.getTemplates(templateType, semester || undefined);
      setTemplates(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load templates:', error);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  const validateFile = (file: File): string | null => {
    // Check file size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
      return `File size (${fileSizeMB}MB) exceeds maximum allowed size of ${MAX_FILE_SIZE_MB}MB.`;
    }

    // Check file extension
    const fileName = file.name.toLowerCase();
    const extension = fileName.split('.').pop() || '';
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      return `Invalid file type '.${extension}'. Allowed types: ${ALLOWED_EXTENSIONS.join(', ').toUpperCase()}`;
    }

    return null;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!semester) {
      alert('Please select a semester first');
      return;
    }

    // Client-side validation
    const validationError = validateFile(file);
    if (validationError) {
      alert(validationError);
      e.target.value = '';
      return;
    }

    const formData = new FormData();
    formData.append('title', file.name);
    formData.append('uploaded_file', file);
    formData.append('semester', semester);

    try {
      setUploading(true);
      await apiService.uploadTemplate(templateType, formData);
      alert('Template uploaded successfully!');
      await loadTemplates();
      e.target.value = '';
    } catch (error: any) {
      console.error('Failed to upload template:', error);
      // Extract error message from response
      const errorData = error.response?.data;
      let errorMessage = 'Failed to upload template. Please try again.';
      
      if (errorData) {
        if (errorData.uploaded_file) {
          errorMessage = Array.isArray(errorData.uploaded_file) 
            ? errorData.uploaded_file.join(' ') 
            : errorData.uploaded_file;
        } else if (errorData.message) {
          errorMessage = errorData.message;
        } else if (errorData.detail) {
          errorMessage = errorData.detail;
        }
      }
      
      alert(errorMessage);
      e.target.value = '';
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = (fileUrl: string, fileName: string) => {
    // Extract filename from URL if it's a full path
    // fileUrl might be like "doc_templates/filename.pdf" or just "filename.pdf"
    let filename = fileUrl;
    if (fileUrl.includes('/')) {
      filename = fileUrl.split('/').pop() || fileName;
    }
    // Create download link - templates are stored in doc_templates/
    const downloadUrl = `/app/doc_templates/${filename}`;
    window.open(downloadUrl, '_blank');
  };

  const semesters = [
    { value: 'semester_6', label: 'Semester 6' },
    { value: 'semester_7', label: 'Semester 7' },
    { value: 'semester_8', label: 'Semester 8' },
  ];

  return (
    <div className="card">
      <h3 style={{ marginBottom: '20px' }}>
        {templateType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
      </h3>
      
      <div className="form-group">
        <label>Semester</label>
        <select
          value={semester}
          onChange={(e) => setSemester(e.target.value)}
          required
        >
          <option value="">Select semester...</option>
          {semesters.map((sem) => (
            <option key={sem.value} value={sem.value}>
              {sem.label}
            </option>
          ))}
        </select>
      </div>

      {semester && (
        <>
          <div className="form-group">
            <label>Upload Template</label>
            <input
              type="file"
              onChange={handleFileUpload}
              accept=".pdf,.doc,.docx,.ppt,.pptx"
              disabled={uploading}
            />
            <small className="help-text" style={{ display: 'block' }}>
              Allowed: PDF, DOC, DOCX, PPT, PPTX (Max {MAX_FILE_SIZE_MB}MB)
            </small>
            {uploading && <p className="text-primary" style={{ marginTop: '5px' }}>Uploading...</p>}
          </div>

          {loading ? (
            <div className="empty-state">Loading templates...</div>
          ) : templates.length === 0 ? (
            <div className="empty-state">No templates uploaded yet for this semester</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Semester</th>
                  <th>Uploaded At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((template) => (
                  <tr key={template.id}>
                    <td>{template.title}</td>
                    <td>{template.semester.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</td>
                    <td>{new Date(template.uploaded_at).toLocaleDateString()}</td>
                    <td>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => downloadTemplate(template.uploaded_file, template.title)}
                      >
                        Download
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
};

export default TemplatesList;
