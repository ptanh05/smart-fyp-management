import React, { useState, useEffect, useRef } from 'react';
import { apiService } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import type { Document, DocumentRequirement } from '../types';
import DocumentViewerModal from './DocumentViewerModal';
import CopyButton from './CopyButton';
import ActionIconButton from './ActionIconButton';
import './DocumentsList.css';

interface DocumentsListProps {
  groupId: number;
}

// Document Row Component with download, preview, and "Submit to committee" when accepted
interface DocumentRowProps {
  document: Document;
  documentType: string;
  deadlinePassed: boolean;
  allowLateSubmission: boolean;
  onSubmittedToCommittee: (docId: number | null) => void;
  onPreviewDocument: (doc: Document) => void;
  submittingDocId: number | null;
}

const DocumentRow: React.FC<DocumentRowProps> = ({
  document,
  documentType,
  deadlinePassed,
  allowLateSubmission,
  onSubmittedToCommittee,
  onPreviewDocument,
  submittingDocId,
}) => {
  const [downloading, setDownloading] = useState(false);
  const canSubmitToCommittee =
    document.status === 'accepted' &&
    !document.submitted_to_committee &&
    (!deadlinePassed || allowLateSubmission);
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
          {document.is_late && (
            <span className="badge badge-late" title={document.late_duration || 'Nộp muộn'}>
              🔴 Nộp muộn (Late){document.late_duration ? ` • ${document.late_duration}` : ''}
            </span>
          )}
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
          {document.uploaded_file && (
            <button
              className="btn btn-outline-info btn-sm"
              onClick={() => onPreviewDocument(document)}
              title="Xem trước tài liệu trực tiếp trên trình duyệt"
              style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <span>👁️</span>
              Xem trước
            </button>
          )}
          <button
            className="btn btn-primary btn-sm"
          <ActionIconButton
            action="download"
            tooltip="Tải về tệp tin tài liệu này về máy tính"
            onClick={handleDownload}
            disabled={downloading || !document.uploaded_file}
            label={downloading ? 'Đang tải...' : 'Tải về'}
            variant="primary"
          />
          {document.uploaded_file && (
            <CopyButton
              text={document.uploaded_file.startsWith('http') ? document.uploaded_file : `${window.location.origin}${document.uploaded_file}`}
              label="Copy link"
              title="Sao chép link nộp bài / tải file"
              tooltipText="Đã sao chép link nộp bài vào bộ nhớ tạm"
            />
          )}
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
  const { showToast } = useToast();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [documentType, setDocumentType] = useState<string>('scope_document');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStats, setUploadStats] = useState<{ loaded: number; total: number } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [requirements, setRequirements] = useState<DocumentRequirement[]>([]);
  const [requirementsLoading, setRequirementsLoading] = useState(false);
  const [submittingDocId, setSubmittingDocId] = useState<number | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{ url: string; title: string; type: string } | null>(null);

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

  const handleCancelUpload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setUploading(false);
    setUploadProgress(0);
    setUploadStats(null);
    showToast('Đã hủy tải lên tập tin.', 'info');
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      setFileError('Vui lòng chọn tập tin cần tải lên');
      return;
    }

    const formData = new FormData();
    formData.append('title', selectedFile.name);
    formData.append('uploaded_file', selectedFile);

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setUploadProgress(0);
    setUploadStats(null);
    setUploading(true);
    setFileError(null);

    try {
      await apiService.uploadDocument(
        documentType,
        formData,
        (progressEvent) => {
          const total = progressEvent.total || selectedFile.size || 1;
          const loaded = progressEvent.loaded;
          const percent = Math.min(100, Math.max(0, Math.round((loaded * 100) / total)));
          setUploadProgress(percent);
          setUploadStats({ loaded, total });
        },
        controller.signal
      );
      showToast('Tải lên tài liệu thành công!', 'success');
      setSelectedFile(null);
      setUploadProgress(0);
      setUploadStats(null);
      // Reset file input
      const fileInput = document.getElementById('document-file-input') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }
      await loadDocuments();
    } catch (error: any) {
      if (error.name === 'CanceledError' || error.message === 'canceled' || controller.signal.aborted) {
        showToast('Đã hủy tải lên tập tin.', 'info');
        setFileError('Quá trình tải lên đã bị hủy.');
      } else {
        console.error('Failed to upload document:', error);
        // Extract error message from response
        const errorData = error.response?.data;
        let errorMessage = 'Không thể tải lên tài liệu. Vui lòng thử lại.';
        
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
        
        showToast(errorMessage, 'error');
        setFileError(errorMessage);
      }
    } finally {
      setUploading(false);
      abortControllerRef.current = null;
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
  const allowLateSubmission = requirementsForType.some((r) => !!r.allow_late_submission);
  const isSubmissionBlocked = deadlinePassed && !allowLateSubmission;

  return (
    <div className="card documents-container">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>👥 <strong>Mã nhóm:</strong></span>
          <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#003366', background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px' }}>#{groupId}</span>
          <CopyButton text={String(groupId)} label="Copy mã nhóm" tooltipText="Đã sao chép mã nhóm vào bộ nhớ tạm" />
        </div>
        {documents.length > 0 && documents[0].uploaded_file && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>📄 <strong>Link nộp bài gần nhất:</strong></span>
            <CopyButton
              text={documents[0].uploaded_file.startsWith('http') ? documents[0].uploaded_file : `${window.location.origin}${documents[0].uploaded_file}`}
              label="Copy link nộp bài"
              tooltipText="Đã sao chép link nộp bài vào bộ nhớ tạm"
            />
          </div>
        )}
      </div>

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
                {r.allow_late_submission ? (
                  <span className="badge badge-warning" style={{ backgroundColor: '#f59e0b', color: 'white', marginLeft: '8px' }}>
                    Cho phép nộp muộn
                  </span>
                ) : (
                  <span className="badge badge-secondary" style={{ backgroundColor: '#64748b', color: 'white', marginLeft: '8px' }}>
                    Khóa nộp muộn
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <hr className="section-divider" />

      {/* Upload Section */}
      <div className="upload-section">
        <h3>Upload New Document</h3>

        {/* Banner for Late Submission blocked */}
        {isSubmissionBlocked && (
          <div
            className="alert alert-danger"
            style={{
              backgroundColor: '#fee2e2',
              borderColor: '#f87171',
              color: '#b91c1c',
              padding: '12px 16px',
              borderRadius: '8px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            role="alert"
          >
            <span style={{ fontSize: '1.2rem' }}>⛔</span>
            <div>
              <strong>Đã hết hạn nộp:</strong> Hệ thống đã khóa tính năng nộp bài cho loại tài liệu này vì đã quá hạn deadline.
            </div>
          </div>
        )}

        {/* Banner for Late Submission allowed */}
        {deadlinePassed && allowLateSubmission && (
          <div
            className="alert alert-warning"
            style={{
              backgroundColor: '#fef3c7',
              borderColor: '#fcd34d',
              color: '#b45309',
              padding: '12px 16px',
              borderRadius: '8px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            role="alert"
          >
            <span style={{ fontSize: '1.2rem' }}>⚠️</span>
            <div>
              <strong>Nộp bài quá hạn (Cho phép nộp muộn):</strong> Đã quá hạn deadline nhưng hệ thống cho phép nộp muộn. Sau khi nộp, tài liệu sẽ được đánh dấu nhãn đỏ <strong>"Nộp muộn (Late)"</strong> kèm thời gian trễ.
            </div>
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
            disabled={uploading || isSubmissionBlocked}
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
                disabled={uploading || isSubmissionBlocked}
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

        {/* Upload Progress Bar & Cancel Button */}
        {uploading && (
          <div className="upload-progress-card">
            <div className="upload-progress-header">
              <div className="progress-label">
                <span className="spinner-small"></span>
                <span>Đang tải lên: <strong>{selectedFile?.name}</strong></span>
              </div>
              <span className="progress-percentage">{uploadProgress}%</span>
            </div>

            <div className="upload-progress-bar-wrap">
              <div
                className="upload-progress-bar-fill"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>

            <div className="upload-progress-footer">
              <span className="upload-stats-text">
                {uploadStats
                  ? `${(uploadStats.loaded / (1024 * 1024)).toFixed(1)} MB / ${(uploadStats.total / (1024 * 1024)).toFixed(1)} MB (${uploadProgress}%)`
                  : `${uploadProgress}% hoàn thành`}
              </span>
              <button
                type="button"
                className="btn-cancel-upload"
                onClick={handleCancelUpload}
                title="Hủy quá trình tải lên"
              >
                ✕ Hủy (Cancel)
              </button>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button 
          className="btn btn-primary submit-btn"
          onClick={handleSubmit}
          disabled={!selectedFile || uploading || isSubmissionBlocked}
        >
          {uploading ? (
            <>
              <span className="spinner-small"></span>
              {deadlinePassed && allowLateSubmission ? 'Đang nộp bài muộn...' : 'Uploading...'}
            </>
          ) : isSubmissionBlocked ? (
            <>
              <span>⛔</span>
              Đã hết hạn nộp
            </>
          ) : deadlinePassed && allowLateSubmission ? (
            <>
              <span>📤</span>
              Nộp bài (Nộp muộn)
            </>
          ) : (
            <>
              <span>📤</span>
              Upload Document
            </>
          )}
        </button>
        {!uploading && (
          <button 
            className="btn btn-primary submit-btn"
            onClick={handleSubmit}
            disabled={!selectedFile || deadlinePassed}
          >
            <span>📤</span>
            Tải lên tài liệu
          </button>
        )}
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
                    allowLateSubmission={allowLateSubmission}
                    onSubmittedToCommittee={(docId) => {
                      setSubmittingDocId(docId ?? null);
                      if (docId === null) loadDocuments();
                    }}
                    onPreviewDocument={(docToPreview) => {
                      setPreviewDoc({
                        url: docToPreview.uploaded_file,
                        title: docToPreview.title,
                        type: docToPreview.document_type,
                      });
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

      {/* Document Viewer Modal for reading document directly in browser */}
      {previewDoc && (
        <DocumentViewerModal
          isOpen={!!previewDoc}
          onClose={() => setPreviewDoc(null)}
          title={previewDoc.title}
          documentUrl={previewDoc.url}
          documentType={previewDoc.type}
        />
      )}
    </div>
  );
};

export default DocumentsList;
