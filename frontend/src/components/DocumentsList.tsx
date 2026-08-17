import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import type { Document, DocumentRequirement } from '../types';
import './DocumentsList.css';

interface DocumentsListProps {
  groupId: number;
}

// Document Row Component with download, and "Submit to committee" when accepted
interface DocumentRowProps {
  document: Document;
  documentType: string;
  deadlinePassed: boolean;
  onSubmittedToCommittee: (docId: number | null) => void;
  submittingDocId: number | null;
}

const DocumentRow: React.FC<DocumentRowProps> = ({
  document,
  documentType,
  deadlinePassed,
  onSubmittedToCommittee,
  submittingDocId,
}) => {
  const [downloading, setDownloading] = useState(false);
  const canSubmitToCommittee =
    document.status === 'accepted' &&
    !document.submitted_to_committee &&
    !deadlinePassed;
  const isSubmitting = submittingDocId === document.id;

  const handleSubmitToCommittee = async () => {
    if (!canSubmitToCommittee) return;
    onSubmittedToCommittee(document.id);
    try {
      await apiService.submitDocumentToCommittee(documentType, document.id);
      onSubmittedToCommittee(null);
    } catch (error: any) {
      onSubmittedToCommittee(null);
      const msg = error.response?.data?.message || 'Failed to submit to committee.';
      alert(msg);
    }
  };

  const handleDownload = async () => {
    if (!document.uploaded_file) {
      alert('No file available for download');
      return;
    }

    try {
      setDownloading(true);
      
      // Extract filename from the URL or use the title
      const fileName = getFileName(document);
      
      await apiService.downloadDocument(document.uploaded_file, fileName);
    } catch (error: any) {
      console.error('Download failed:', error);
      alert('Failed to download document. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const getFileName = (doc: Document): string => {
    // Try to get filename from URL
    if (doc.uploaded_file) {
      const urlParts = doc.uploaded_file.split('/');
      const lastPart = urlParts[urlParts.length - 1];
      // Remove any query parameters
      const fileName = lastPart.split('?')[0];
      if (fileName && fileName.includes('.')) {
        return fileName;
      }
    }
    // Fallback to title with extension guess
    return doc.title.includes('.') ? doc.title : `${doc.title}.pdf`;
  };

  const getStatusBadgeClass = (status: string): string => {
    switch (status) {
      case 'accepted':
        return 'badge-success';
      case 'rejected':
        return 'badge-danger';
      case 'pending':
      default:
        return 'badge-pending';
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <tr>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="file-icon">📄</span>
          <span className="document-title">{document.title}</span>
        </div>
      </td>
      <td>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
          <span className={`badge ${getStatusBadgeClass(document.status)}`}>
            {document.status.charAt(0).toUpperCase() + document.status.slice(1)}
          </span>
          {document.submitted_to_committee && (
            <span className="badge badge-success" title="Visible to committee">
              Submitted to committee
            </span>
          )}
        </div>
      </td>
      <td className="date-cell">{formatDate(document.uploaded_at)}</td>
      <td>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleDownload}
            disabled={downloading || !document.uploaded_file}
            title={document.uploaded_file ? 'Download document' : 'No file available'}
            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            {downloading ? (
              <>
                <span className="spinner-small"></span>
                Downloading...
              </>
            ) : (
              <>
                <span>⬇️</span>
                Download
              </>
            )}
          </button>
          {canSubmitToCommittee && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleSubmitToCommittee}
              disabled={isSubmitting}
              title="Submit this accepted version to committee (before deadline)"
              style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner-small"></span>
                  Submitting...
                </>
              ) : (
                <>
                  <span>📤</span>
                  Submit to committee
                </>
              )}
            </button>
          )}
        </div>
      </td>
    </tr>
  );
};

// File validation constants (matching backend)
const MAX_FILE_SIZE_MB = 25;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx', 'ppt', 'pptx'];

const DocumentsList: React.FC<DocumentsListProps> = ({ groupId }) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [documentType, setDocumentType] = useState<string>('scope_document');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [requirements, setRequirements] = useState<DocumentRequirement[]>([]);
  const [requirementsLoading, setRequirementsLoading] = useState(false);
  const [submittingDocId, setSubmittingDocId] = useState<number | null>(null);

  useEffect(() => {
    loadDocuments();
  }, [documentType, groupId]);

  useEffect(() => {
    const loadReq = async () => {
      try {
        setRequirementsLoading(true);
        const data = await apiService.getDocumentRequirements();
        setRequirements(data || []);
      } catch {
        setRequirements([]);
      } finally {
        setRequirementsLoading(false);
      }
    };
    loadReq();
  }, []);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const data = await apiService.getDocuments(documentType, groupId);
      setDocuments(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.error('Failed to load documents:', error);
      setDocuments([]);
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setFileError(null);
    
    if (!file) {
      setSelectedFile(null);
      return;
    }

    // Client-side validation
    const validationError = validateFile(file);
    if (validationError) {
      setFileError(validationError);
      setSelectedFile(null);
      e.target.value = '';
      return;
    }

    setSelectedFile(file);
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setFileError(null);
    // Reset the file input
    const fileInput = document.getElementById('document-file-input') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      setFileError('Please select a file to upload');
      return;
    }

    const formData = new FormData();
    formData.append('title', selectedFile.name);
    formData.append('uploaded_file', selectedFile);

    try {
      setUploading(true);
      await apiService.uploadDocument(documentType, formData);
      alert('Document uploaded successfully!');
      setSelectedFile(null);
      // Reset file input
      const fileInput = document.getElementById('document-file-input') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }
      await loadDocuments();
    } catch (error: any) {
      console.error('Failed to upload document:', error);
      // Extract error message from response
      const errorData = error.response?.data;
      let errorMessage = 'Failed to upload document. Please try again.';
      
      if (errorData) {
        if (errorData.uploaded_file) {
          // Field-specific error from serializer validation
          errorMessage = Array.isArray(errorData.uploaded_file) 
            ? errorData.uploaded_file.join(' ') 
            : errorData.uploaded_file;
        } else if (errorData.message) {
          errorMessage = errorData.message;
        } else if (errorData.detail) {
          errorMessage = errorData.detail;
        }
      }
      
      setFileError(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const documentTypes = [
    { value: 'scope_document', label: 'Scope Document' },
    { value: 'srs_document', label: 'SRS Document' },
    { value: 'sdd_document', label: 'SDD Document' },
    { value: 'final_report_document', label: 'Final Report' },
    { value: 'presentation_document', label: 'Presentation' },
  ];

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const formatDeadline = (s: string) => {
    const d = new Date(s);
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  };

  // Check if submission deadline has passed for the selected document type
  const requirementsForType = requirements.filter((r) => r.document_type === documentType);
  const latestDeadlineForType = requirementsForType.length
    ? new Date(
        Math.max(...requirementsForType.map((r) => new Date(r.deadline).getTime()))
      )
    : null;
  const deadlinePassed =
    latestDeadlineForType !== null && new Date() > latestDeadlineForType;

  return (
    <div className="card documents-container">
      <h2>Documents</h2>

      {/* Requirements & deadlines (committee-set) */}
      <div className="documents-requirements-section">
        <h3>Requirements &amp; deadlines</h3>
        {requirementsLoading ? (
          <p className="help-text">Loading requirements...</p>
        ) : requirements.length === 0 ? (
          <p className="help-text">No document requirements or deadlines set yet.</p>
        ) : (
          <div className="documents-requirements-list">
            {requirements.map((r) => (
              <div key={r.id} className="documents-requirement-item">
                <span className="dr-type">{r.document_type_display}</span>
                <span className="dr-title">{r.title}</span>
                <span className="dr-deadline">Due: {formatDeadline(r.deadline)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <hr className="section-divider" />

      {/* Upload Section */}
      <div className="upload-section">
        <h3>Upload New Document</h3>

        {deadlinePassed && (
          <div className="alert alert-warning" role="alert">
            Submission deadline has passed for this document type. You cannot submit new documents.
          </div>
        )}

        <div className="form-group">
          <label htmlFor="document-type">Document Type</label>
          <select 
            id="document-type"
            value={documentType} 
            onChange={(e) => setDocumentType(e.target.value)}
            disabled={uploading}
          >
            {documentTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="document-file-input">Select File</label>
          <input 
            id="document-file-input"
            type="file" 
            onChange={handleFileSelect}
            accept=".pdf,.doc,.docx,.ppt,.pptx"
            disabled={uploading || deadlinePassed}
            className="file-input"
          />
          <small className="help-text">
            Allowed: PDF, DOC, DOCX, PPT, PPTX (Max {MAX_FILE_SIZE_MB}MB)
          </small>
        </div>

        {/* Selected File Preview */}
        {selectedFile && (
          <div className="selected-file-preview">
            <div className="file-info">
              <span className="file-icon-large">📄</span>
              <div className="file-details">
                <span className="file-name">{selectedFile.name}</span>
                <span className="file-size">{formatFileSize(selectedFile.size)}</span>
              </div>
              <button 
                className="btn btn-danger btn-sm clear-file-btn"
                onClick={handleClearFile}
                disabled={uploading || deadlinePassed}
                title="Remove selected file"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Error Message */}
        {fileError && (
          <div className="error-message">
            <span className="error-icon">⚠️</span>
            {fileError}
          </div>
        )}

        {/* Submit Button */}
        <button 
          className="btn btn-primary submit-btn"
          onClick={handleSubmit}
          disabled={!selectedFile || uploading || deadlinePassed}
        >
          {uploading ? (
            <>
              <span className="spinner-small"></span>
              Uploading...
            </>
          ) : (
            <>
              <span>📤</span>
              Upload Document
            </>
          )}
        </button>
      </div>

      {/* Divider */}
      <hr className="section-divider" />

      {/* Documents List Section */}
      <div className="documents-list-section">
        <h3>
          Uploaded Documents
          <button 
            className="btn btn-secondary btn-sm refresh-btn" 
            onClick={loadDocuments}
            disabled={loading}
            title="Refresh documents list"
          >
            🔄 Refresh
          </button>
        </h3>

        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <span>Loading documents...</span>
          </div>
        ) : documents.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">📁</span>
            <p>No {documentTypes.find(t => t.value === documentType)?.label || 'documents'} uploaded yet</p>
            <small>Select a file above and click "Upload Document" to get started</small>
          </div>
        ) : (
          <div className="documents-table-wrapper">
            <table className="table documents-table">
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Status</th>
                  <th>Uploaded</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <DocumentRow
                    key={doc.id}
                    document={doc}
                    documentType={documentType}
                    deadlinePassed={deadlinePassed}
                    onSubmittedToCommittee={(docId) => {
                      setSubmittingDocId(docId ?? null);
                      if (docId === null) loadDocuments();
                    }}
                    submittingDocId={submittingDocId}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Document Count */}
        {documents.length > 0 && (
          <div className="documents-count">
            Showing {documents.length} document{documents.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentsList;
