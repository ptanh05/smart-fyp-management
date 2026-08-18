import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import type { Document, SupervisorOfStudentGroup } from '../types';
import DocumentViewerModal from './DocumentViewerModal';
import './DocumentReview.css';

interface DocumentReviewProps {
  groups: SupervisorOfStudentGroup[];
}

const DOCUMENT_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'scope_document', label: 'Scope Document' },
  { value: 'srs_document', label: 'SRS Document' },
  { value: 'sdd_document', label: 'SDD Document' },
  { value: 'final_report_document', label: 'Final Report' },
  { value: 'presentation_document', label: 'Presentation' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'pending', label: 'Pending' },
  { value: 'accepted_by_student', label: 'Awaiting Review' },
  { value: 'accepted', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

const DocumentReview: React.FC<DocumentReviewProps> = ({ groups }) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterGroup, setFilterGroup] = useState<number | ''>('');
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [downloading, setDownloading] = useState<number | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{ url: string; title: string; type: string } | null>(null);

  useEffect(() => {
    loadDocuments();
  }, [filterType, filterStatus, filterGroup]);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const params: { document_type?: string; status?: string; group?: number } = {};
      if (filterType) params.document_type = filterType;
      if (filterStatus) params.status = filterStatus;
      if (filterGroup) params.group = filterGroup;

      const response = await apiService.getSupervisorDocuments(params);
      setDocuments(response.results || []);
    } catch (error) {
      console.error('Failed to load documents:', error);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (document: Document, newStatus: 'accepted' | 'rejected') => {
    try {
      setActionLoading(document.id);
      await apiService.updateDocumentStatus(document.document_type, document.id, newStatus);
      
      // Update local state
      setDocuments(prevDocs => 
        prevDocs.map(doc => 
          doc.id === document.id ? { ...doc, status: newStatus } : doc
        )
      );
      
      // Close modal if open
      if (selectedDocument?.id === document.id) {
        setSelectedDocument({ ...selectedDocument, status: newStatus });
      }
      
      alert(`Document ${newStatus === 'accepted' ? 'approved' : 'rejected'} successfully!`);
    } catch (error: any) {
      console.error('Failed to update document status:', error);
      const errorMessage = error.response?.data?.message || 'Failed to update document status';
      alert(errorMessage);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDownload = async (document: Document) => {
    if (!document.uploaded_file) {
      alert('No file available for download');
      return;
    }

    try {
      setDownloading(document.id);
      const fileName = getFileName(document);
      await apiService.downloadDocument(document.uploaded_file, fileName);
    } catch (error) {
      console.error('Download failed:', error);
      alert('Failed to download document. Please try again.');
    } finally {
      setDownloading(null);
    }
  };

  const getFileName = (doc: Document): string => {
    if (doc.uploaded_file) {
      const urlParts = doc.uploaded_file.split('/');
      const lastPart = urlParts[urlParts.length - 1];
      const fileName = lastPart.split('?')[0];
      if (fileName && fileName.includes('.')) {
        return fileName;
      }
    }
    return doc.title.includes('.') ? doc.title : `${doc.title}.pdf`;
  };

  const getStatusBadgeClass = (status: string): string => {
    switch (status) {
      case 'accepted':
        return 'badge-success';
      case 'rejected':
        return 'badge-danger';
      case 'accepted_by_student':
        return 'badge-warning';
      case 'pending':
      default:
        return 'badge-pending';
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'accepted':
        return 'Approved';
      case 'rejected':
        return 'Rejected';
      case 'accepted_by_student':
        return 'Awaiting Review';
      case 'pending':
        return 'Pending';
      default:
        return status;
    }
  };

  const getDocumentTypeLabel = (type: string): string => {
    const found = DOCUMENT_TYPES.find(dt => dt.value === type);
    return found ? found.label : type;
  };

  const canReview = (document: Document): boolean => {
    // Supervisors can only review documents that are "accepted_by_student" (both students agreed)
    return document.status === 'accepted_by_student';
  };

  const pendingReviewCount = documents.filter(d => d.status === 'accepted_by_student').length;

  return (
    <div className="document-review">
      <div className="document-review-header">
        <h2>Document Review</h2>
        {pendingReviewCount > 0 && (
          <span className="pending-badge">{pendingReviewCount} pending review</span>
        )}
      </div>

      {/* Filters */}
      <div className="document-filters">
        <div className="filter-group">
          <label>Document Type</label>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            {DOCUMENT_TYPES.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Status</label>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            {STATUS_OPTIONS.map(status => (
              <option key={status.value} value={status.value}>{status.label}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Group</label>
          <select value={filterGroup} onChange={(e) => setFilterGroup(e.target.value ? Number(e.target.value) : '')}>
            <option value="">All Groups</option>
            {groups.map(group => (
              <option key={group.id} value={group.id}>
                Group #{group.id} - {group.project?.project_name || 'N/A'}
              </option>
            ))}
          </select>
        </div>

        <button className="btn btn-secondary" onClick={loadDocuments}>
          Refresh
        </button>
      </div>

      {/* Documents List */}
      {loading ? (
        <div className="loading">Loading documents...</div>
      ) : documents.length === 0 ? (
        <div className="empty-state">
          <p>No documents found matching your filters.</p>
          <p className="help-text">
            Students need to submit and mutually approve documents before they appear for your review.
          </p>
        </div>
      ) : (
        <div className="documents-grid">
          {documents.map(doc => (
            <div key={doc.id} className={`document-card ${canReview(doc) ? 'needs-review' : ''}`}>
              <div className="document-card-header">
                <span className="document-type">{getDocumentTypeLabel(doc.document_type)}</span>
                <span className={`badge ${getStatusBadgeClass(doc.status)}`}>
                  {getStatusLabel(doc.status)}
                </span>
              </div>

              <div className="document-card-body">
                <h4 className="document-title" title={doc.title}>
                  📄 {doc.title}
                </h4>
                
                {doc.group_info && (
                  <div className="document-info">
                    <p><strong>Project:</strong> {doc.group_info.project_name || 'N/A'}</p>
                    <p>
                      <strong>Students:</strong>{' '}
                      {doc.group_info.student_1?.username || 'N/A'} &{' '}
                      {doc.group_info.student_2?.username || 'N/A'}
                    </p>
                  </div>
                )}

                <p className="document-meta">
                  <strong>Uploaded:</strong> {new Date(doc.uploaded_at).toLocaleDateString()}
                  {doc.uploaded_by && (
                    <> by {doc.uploaded_by.user?.username || 'Student'}</>
                  )}
                </p>
              </div>

              <div className="document-card-actions">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleDownload(doc)}
                  disabled={downloading === doc.id || !doc.uploaded_file}
                >
                  {downloading === doc.id ? 'Downloading...' : '⬇️ Download'}
                </button>

                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => setSelectedDocument(doc)}
                >
                  👁️ View Details
                </button>

                {canReview(doc) && (
                  <>
                    <button
                      className="btn btn-success btn-sm"
                      onClick={() => handleStatusUpdate(doc, 'accepted')}
                      disabled={actionLoading === doc.id}
                    >
                      {actionLoading === doc.id ? '...' : '✓ Approve'}
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleStatusUpdate(doc, 'rejected')}
                      disabled={actionLoading === doc.id}
                    >
                      {actionLoading === doc.id ? '...' : '✗ Reject'}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Document Detail Modal */}
      {selectedDocument && (
        <div className="modal-overlay" onClick={() => setSelectedDocument(null)}>
          <div className="modal-content document-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Document Details</h3>
              <button className="modal-close" onClick={() => setSelectedDocument(null)}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="detail-row">
                <label>Title:</label>
                <span>{selectedDocument.title}</span>
              </div>
              
              <div className="detail-row">
                <label>Document Type:</label>
                <span>{getDocumentTypeLabel(selectedDocument.document_type)}</span>
              </div>
              
              <div className="detail-row">
                <label>Status:</label>
                <span className={`badge ${getStatusBadgeClass(selectedDocument.status)}`}>
                  {getStatusLabel(selectedDocument.status)}
                </span>
              </div>
              
              <div className="detail-row">
                <label>Uploaded At:</label>
                <span>{new Date(selectedDocument.uploaded_at).toLocaleString()}</span>
              </div>

              {selectedDocument.uploaded_by && (
                <div className="detail-row">
                  <label>Uploaded By:</label>
                  <span>
                    {selectedDocument.uploaded_by.user?.username || 'Student'}
                    {selectedDocument.uploaded_by.registration_no && 
                      ` (${selectedDocument.uploaded_by.registration_no})`
                    }
                  </span>
                </div>
              )}

              {selectedDocument.group_info && (
                <>
                  <div className="detail-row">
                    <label>Project:</label>
                    <span>{selectedDocument.group_info.project_name || 'N/A'}</span>
                  </div>
                  <div className="detail-row">
                    <label>Students:</label>
                    <span>
                      {selectedDocument.group_info.student_1?.username || 'N/A'} 
                      {selectedDocument.group_info.student_1?.registration_no && 
                        ` (${selectedDocument.group_info.student_1.registration_no})`
                      }
                      {' & '}
                      {selectedDocument.group_info.student_2?.username || 'N/A'}
                      {selectedDocument.group_info.student_2?.registration_no && 
                        ` (${selectedDocument.group_info.student_2.registration_no})`
                      }
                    </span>
                  </div>
                </>
              )}
            </div>

            <div className="modal-footer">
              {selectedDocument.uploaded_file && (
                <button
                  className="btn"
                  style={{ backgroundColor: '#6366f1', color: 'white' }}
                  onClick={() =>
                    setPreviewDoc({
                      url: selectedDocument.uploaded_file || '',
                      title: selectedDocument.title,
                      type: selectedDocument.document_type,
                    })
                  }
                >
                  👁️ Preview Document
                </button>
              )}

              <button
                className="btn btn-secondary"
                onClick={() => handleDownload(selectedDocument)}
                disabled={downloading === selectedDocument.id || !selectedDocument.uploaded_file}
              >
                {downloading === selectedDocument.id ? 'Downloading...' : '⬇️ Download Document'}
              </button>

              {canReview(selectedDocument) && (
                <>
                  <button
                    className="btn btn-success"
                    onClick={() => handleStatusUpdate(selectedDocument, 'accepted')}
                    disabled={actionLoading === selectedDocument.id}
                  >
                    {actionLoading === selectedDocument.id ? 'Processing...' : '✓ Approve Document'}
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => handleStatusUpdate(selectedDocument, 'rejected')}
                    disabled={actionLoading === selectedDocument.id}
                  >
                    {actionLoading === selectedDocument.id ? 'Processing...' : '✗ Reject Document'}
                  </button>
                </>
              )}

              <button className="btn btn-outline" onClick={() => setSelectedDocument(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

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

export default DocumentReview;
