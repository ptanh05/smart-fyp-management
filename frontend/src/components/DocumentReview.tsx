import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import type { Document, DocumentComment, SupervisorOfStudentGroup } from '../types';
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

  // Bulk Download state
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);
  const [bulkDownloading, setBulkDownloading] = useState(false);

  // Document Comments state
  const [comments, setComments] = useState<DocumentComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentSection, setCommentSection] = useState('general');
  const [commentText, setCommentText] = useState('');
  const [savingComment, setSavingComment] = useState(false);

  const handleToggleGroup = (groupId: number) => {
    setSelectedGroupIds(prev =>
      prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]
    );
  };

  const handleSelectAllGroups = () => {
    if (selectedGroupIds.length === groups.length) {
      setSelectedGroupIds([]);
    } else {
      setSelectedGroupIds(groups.map(g => g.id));
    }
  };

  const handleBulkDownload = async () => {
    if (selectedGroupIds.length === 0) {
      alert('Vui lòng chọn ít nhất một nhóm để tải tài liệu.');
      return;
    }
    try {
      setBulkDownloading(true);
      const blob = await apiService.bulkDownloadSupervisorDocuments(selectedGroupIds);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cac_nhom_tai_lieu_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Bulk download error:', err);
      alert('Lỗi tải hàng loạt tài liệu: ' + (err.response?.data?.message || err.message));
    } finally {
      setBulkDownloading(false);
    }
  };

  const loadComments = async (docId: number) => {
    try {
      setLoadingComments(true);
      const data = await apiService.getDocumentComments(docId);
      setComments(data || []);
    } catch (err) {
      console.error('Failed to load document comments:', err);
      setComments([]);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleOpenDocDetails = (doc: Document) => {
    setSelectedDocument(doc);
    loadComments(doc.id);
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDocument || !commentText.trim()) return;
    try {
      setSavingComment(true);
      const newComment = await apiService.addDocumentComment(selectedDocument.id, {
        section: commentSection,
        comment: commentText.trim(),
      });
      setComments(prev => [newComment, ...prev]);
      setCommentText('');
      alert('Bình luận đã được lưu và gửi thông báo cho sinh viên!');
    } catch (err: any) {
      console.error('Save comment error:', err);
      alert('Lỗi lưu nhận xét: ' + (err.response?.data?.message || err.message));
    } finally {
      setSavingComment(false);
    }
  };

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

      {/* Bulk Download Section */}
      {groups.length > 0 && (
        <div
          style={{
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '16px',
            marginBottom: '20px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <div>
              <h4 style={{ margin: 0, fontSize: '0.98rem', color: '#1e293b' }}>
                📦 Tải Xuống Hàng Loạt Tài Liệu (Bulk Download)
              </h4>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                Chọn các nhóm sinh viên để nén và tải toàn bộ tài liệu về máy dưới dạng tệp .zip
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleSelectAllGroups}
              >
                {selectedGroupIds.length === groups.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleBulkDownload}
                disabled={bulkDownloading || selectedGroupIds.length === 0}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#0284c7' }}
              >
                {bulkDownloading ? 'Đang nén file zip...' : `⬇️ Tải xuống tất cả (.zip) (${selectedGroupIds.length})`}
              </button>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '10px',
              maxHeight: '120px',
              overflowY: 'auto',
              padding: '4px 0',
            }}
          >
            {groups.map((group) => (
              <label
                key={group.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: selectedGroupIds.includes(group.id) ? '#e0f2fe' : 'white',
                  border: selectedGroupIds.includes(group.id) ? '1px solid #38bdf8' : '1px solid #cbd5e1',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedGroupIds.includes(group.id)}
                  onChange={() => handleToggleGroup(group.id)}
                />
                <span>
                  <b>Nhóm #{group.id}</b>: {group.project?.project_name || 'N/A'}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

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
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  {doc.is_late && (
                    <span className="badge" style={{ backgroundColor: '#dc2626', color: 'white' }} title={doc.late_duration || 'Nộp muộn'}>
                      🔴 Nộp muộn (Late){doc.late_duration ? ` • ${doc.late_duration}` : ''}
                    </span>
                  )}
                  <span className={`badge ${getStatusBadgeClass(doc.status)}`}>
                    {getStatusLabel(doc.status)}
                  </span>
                </div>
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
                  onClick={() => handleOpenDocDetails(doc)}
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

              {selectedDocument.is_late && (
                <div className="detail-row">
                  <label>Nộp muộn:</label>
                  <span className="badge" style={{ backgroundColor: '#dc2626', color: 'white', fontWeight: 600 }}>
                    🔴 Nộp muộn (Late){selectedDocument.late_duration ? ` • ${selectedDocument.late_duration}` : ''}
                  </span>
                </div>
              )}

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

              {/* Detailed Comments Section */}
              <div
                style={{
                  marginTop: '20px',
                  paddingTop: '16px',
                  borderTop: '1px solid #e2e8f0',
                }}
              >
                <h4 style={{ margin: '0 0 12px 0', fontSize: '1rem', color: '#1e293b' }}>
                  💬 Bình Luận & Nhận Xét Chi Tiết ({comments.length})
                </h4>

                {/* Comment Input Form */}
                <form
                  onSubmit={handleAddComment}
                  style={{
                    marginBottom: '16px',
                    backgroundColor: '#f8fafc',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <div style={{ marginBottom: '8px' }}>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        color: '#475569',
                        marginBottom: '4px',
                      }}
                    >
                      Mục nhận xét:
                    </label>
                    <select
                      value={commentSection}
                      onChange={(e) => setCommentSection(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.85rem',
                        backgroundColor: 'white',
                      }}
                    >
                      <option value="general">Nhận xét chung toàn bộ tài liệu</option>
                      <option value="chapter1">Chương 1: Đặt vấn đề & Giới thiệu</option>
                      <option value="chapter2">Chương 2: Phân tích kiến trúc hệ thống</option>
                      <option value="chapter3">Chương 3: Thiết kế & Cài đặt</option>
                      <option value="chapter4">Chương 4: Thử nghiệm & Đánh giá</option>
                      <option value="format">Định dạng, Bố cục & Trình bày văn bản</option>
                    </select>
                  </div>

                  <div style={{ marginBottom: '8px' }}>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        color: '#475569',
                        marginBottom: '4px',
                      }}
                    >
                      Nội dung nhận xét:
                    </label>
                    <textarea
                      rows={3}
                      required
                      placeholder="Nhập nhận xét chi tiết vào mục này để sinh viên hoàn thiện..."
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.85rem',
                        boxSizing: 'border-box',
                        fontFamily: 'inherit',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="submit"
                      className="btn btn-primary btn-sm"
                      disabled={savingComment || !commentText.trim()}
                    >
                      {savingComment ? 'Đang lưu...' : '💾 Lưu nhận xét'}
                    </button>
                  </div>
                </form>

                {/* List of Comments */}
                <div
                  style={{
                    maxHeight: '220px',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  {loadingComments ? (
                    <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Đang tải bình luận...</p>
                  ) : comments.length === 0 ? (
                    <p style={{ fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic' }}>
                      Chưa có nhận xét nào cho tài liệu này. Thầy/Cô có thể để lại nhận xét ở trên.
                    </p>
                  ) : (
                    comments.map((cmt) => (
                      <div
                        key={cmt.id}
                        style={{
                          backgroundColor: '#f1f5f9',
                          borderRadius: '8px',
                          padding: '10px 12px',
                          borderLeft: '3px solid #3b82f6',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '4px',
                          }}
                        >
                          <span style={{ fontWeight: 600, fontSize: '0.82rem', color: '#1e293b' }}>
                            {cmt.author_name} ({cmt.author_role === 'supervisor' ? 'Giảng viên' : 'Sinh viên'})
                          </span>
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            {new Date(cmt.created_at).toLocaleString()}
                          </span>
                        </div>
                        <span
                          style={{
                            display: 'inline-block',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            padding: '1px 6px',
                            borderRadius: '4px',
                            backgroundColor: '#e2e8f0',
                            color: '#475569',
                            marginBottom: '4px',
                          }}
                        >
                          📌 {cmt.section_display || cmt.section}
                        </span>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#334155', whiteSpace: 'pre-line' }}>
                          {cmt.comment}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
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
