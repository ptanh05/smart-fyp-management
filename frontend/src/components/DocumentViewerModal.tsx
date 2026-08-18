import React, { useState } from 'react';
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

  const isPdf = documentUrl.toLowerCase().endsWith('.pdf') || documentUrl.includes('.pdf');

  return (
    <div className={`doc-viewer-overlay ${isFullscreen ? 'fullscreen-mode' : ''}`} onClick={onClose}>
      <div className="doc-viewer-container" onClick={(e) => e.stopPropagation()}>
        {/* Header Toolbar */}
        <div className="doc-viewer-header">
          <div className="doc-viewer-title-group">
            <span className="doc-type-badge">{documentType.replace('_', ' ').toUpperCase()}</span>
            <h3 className="doc-viewer-title">{title}</h3>
          </div>

          <div className="doc-viewer-actions">
            <div className="zoom-controls">
              <button onClick={handleZoomOut} className="btn-icon" title="Zoom Out">
                ➖
              </button>
              <span className="zoom-value" onClick={handleResetZoom} title="Reset Zoom">
                {zoomLevel}%
              </span>
              <button onClick={handleZoomIn} className="btn-icon" title="Zoom In">
                ➕
              </button>
            </div>

            <button onClick={toggleFullscreen} className="btn-icon" title="Toggle Fullscreen">
              {isFullscreen ? '🗗' : '🗖'}
            </button>

            <a
              href={documentUrl}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="btn-download"
              title="Download File"
            >
              📥 Download
            </a>

            <button onClick={onClose} className="btn-close" title="Close Viewer">
              ✕
            </button>
          </div>
        </div>

        {/* Document Content View */}
        <div className="doc-viewer-body">
          {isPdf ? (
            <iframe
              src={`${documentUrl}#toolbar=0`}
              title={title}
              className="doc-viewer-iframe"
              style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
            />
          ) : (
            <div className="doc-viewer-fallback" style={{ transform: `scale(${zoomLevel / 100})` }}>
              <div className="fallback-card">
                <span className="fallback-icon">📄</span>
                <h4>{title}</h4>
                <p>Preview is optimized for PDF documents.</p>
                <a
                  href={documentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary"
                >
                  Open in New Tab ↗
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentViewerModal;
