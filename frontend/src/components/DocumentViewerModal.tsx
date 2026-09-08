import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import './DocumentViewerModal.css';

interface DocumentViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  documentUrl: string;
  documentType?: string;
}

const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({
  isOpen,
  onClose,
  title,
  documentUrl,
  documentType = 'Document',
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<boolean>(false);

  useEffect(() => {
    let currentBlobUrl: string | null = null;
    let isMounted = true;

    const loadDocument = async () => {
      if (!isOpen || !documentUrl) return;

      try {
        setLoading(true);
        setError(null);

        // If it's already a blob: or data: URL, use directly
        if (documentUrl.startsWith('blob:') || documentUrl.startsWith('data:')) {
          if (isMounted) {
            setBlobUrl(documentUrl);
            setLoading(false);
          }
          return;
        }

        // Fetch securely with auth Bearer token
        const blob = await apiService.fetchDocumentBlob(documentUrl);
        if (isMounted) {
          currentBlobUrl = URL.createObjectURL(blob);
          setBlobUrl(currentBlobUrl);
        }
      } catch (err: any) {
        console.error('Failed to load document for preview:', err);
        if (isMounted) {
          setError(err.message || 'Không thể tải tài liệu để xem trước.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadDocument();

    return () => {
      isMounted = false;
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl);
      }
    };
  }, [isOpen, documentUrl]);

  if (!isOpen) return null;

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 20, 200));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(prev - 20, 60));
  };

  const handleResetZoom = () => {
    setZoomLevel(100);
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const isPdf =
    documentUrl.toLowerCase().endsWith('.pdf') ||
    documentUrl.includes('.pdf') ||
    title.toLowerCase().endsWith('.pdf') ||
    documentType.toLowerCase().includes('document');

  const isImage =
    /\.(jpg|jpeg|png|gif|webp|svg)($|\?)/i.test(documentUrl) ||
    /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(title);

  const handleDownload = async () => {
    try {
      setDownloading(true);
      const fileName = title.includes('.') ? title : `${title}.pdf`;
      await apiService.downloadDocument(documentUrl, fileName);
    } catch (err) {
      console.error('Download error:', err);
      alert('Tải tài liệu thất bại.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className={`doc-viewer-overlay ${isFullscreen ? 'fullscreen-mode' : ''}`} onClick={onClose}>
      <div className="doc-viewer-container" onClick={(e) => e.stopPropagation()}>
        {/* Header Toolbar */}
        <div className="doc-viewer-header">
          <div className="doc-viewer-title-group">
            <span className="doc-type-badge">{documentType.replace(/_/g, ' ').toUpperCase()}</span>
            <h3 className="doc-viewer-title" title={title}>{title}</h3>
          </div>

          <div className="doc-viewer-actions">
            <div className="zoom-controls">
              <button onClick={handleZoomOut} className="btn-icon" title="Thu nhỏ">
                ➖
              </button>
              <span className="zoom-value" onClick={handleResetZoom} title="Đặt lại thu phóng">
                {zoomLevel}%
              </span>
              <button onClick={handleZoomIn} className="btn-icon" title="Phóng to">
                ➕
              </button>
            </div>

            <button onClick={toggleFullscreen} className="btn-icon" title={isFullscreen ? 'Thu nhỏ cửa sổ' : 'Toàn màn hình'}>
              {isFullscreen ? '🗗' : '🗖'}
            </button>

            <button
              onClick={handleDownload}
              disabled={downloading}
              className="btn-download"
              title="Tải tài liệu về máy"
            >
              {downloading ? '⏳ Đang tải...' : '📥 Tải về'}
            </button>

            <button onClick={onClose} className="btn-close" title="Đóng">
              ✕
            </button>
          </div>
        </div>

        {/* Document Content View */}
        <div className="doc-viewer-body">
          {loading && (
            <div className="doc-viewer-loading">
              <div className="spinner-large"></div>
              <p>Đang tải tài liệu xem trước trực tiếp...</p>
            </div>
          )}

          {error && !loading && (
            <div className="doc-viewer-fallback">
              <div className="fallback-card">
                <span className="fallback-icon">⚠️</span>
                <h4>Không thể hiển thị tài liệu</h4>
                <p>{error}</p>
                <button
                  onClick={handleDownload}
                  className="btn btn-primary"
                  style={{ marginTop: '12px' }}
                >
                  📥 Tải file về máy để xem
                </button>
              </div>
            </div>
          )}

          {!loading && !error && blobUrl && (
            isImage ? (
              <div
                className="doc-viewer-image-wrapper"
                style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
              >
                <img src={blobUrl} alt={title} className="doc-viewer-image" />
              </div>
            ) : isPdf ? (
              <iframe
                src={`${blobUrl}#toolbar=1&navpanes=0`}
                title={title}
                className="doc-viewer-iframe"
                style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
              />
            ) : (
              <div className="doc-viewer-fallback" style={{ transform: `scale(${zoomLevel / 100})` }}>
                <div className="fallback-card">
                  <span className="fallback-icon">📄</span>
                  <h4>{title}</h4>
                  <p>Định dạng tài liệu này được tối ưu cho việc tải về.</p>
                  <button
                    onClick={handleDownload}
                    className="btn btn-primary"
                  >
                    📥 Tải file về máy
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentViewerModal;
