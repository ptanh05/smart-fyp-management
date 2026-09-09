import React, { useState, useRef } from 'react';
import { apiService } from '../services/api';
import DebouncedSubmitButton from './DebouncedSubmitButton';
import { useModalGuard } from '../utils/modalHooks';
import './BugReportModal.css';

interface BugReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const BugReportModal: React.FC<BugReportModalProps> = ({ isOpen, onClose }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isDirty = Boolean(title.trim() || description.trim() || screenshot);
  const { requestClose, handleOverlayClick } = useModalGuard({
    isOpen,
    onClose: () => {
      handleRemoveScreenshot();
      setTitle('');
      setDescription('');
      setErrorMessage(null);
      setSuccessMessage(null);
      onClose();
    },
    isDirty,
    confirmMessage: 'Bạn có nội dung báo cáo sự cố chưa gửi. Bạn có chắc muốn đóng không?',
  });

  if (!isOpen) return null;

  const handleFileChange = (file: File | null) => {
    if (!file) return;

    // Check file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setErrorMessage('Chỉ chấp nhận tệp hình ảnh định dạng PNG, JPG, JPEG hoặc WebP.');
      return;
    }

    // Check size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage('Kích thước ảnh chụp màn hình không được vượt quá 10MB.');
      return;
    }

    setErrorMessage(null);
    setScreenshot(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handleRemoveScreenshot = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setScreenshot(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setErrorMessage('Vui lòng nhập mô tả chi tiết vấn đề bạn đang gặp phải.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const formData = new FormData();
      formData.append('title', title.trim() || 'Báo lỗi hệ thống');
      formData.append('description', description.trim());
      formData.append('page_url', window.location.href);
      if (screenshot) {
        formData.append('screenshot', screenshot);
      }

      const res = await apiService.submitBugReport(formData);
      setSuccessMessage(res.message || 'Báo cáo lỗi đã được gửi thành công đến Quản trị viên!');
      
      setTimeout(() => {
        handleRemoveScreenshot();
        setTitle('');
        setDescription('');
        setSuccessMessage(null);
        onClose();
      }, 1800);
    } catch (err: any) {
      console.error('Error submitting bug report:', err);
      const detail = err.response?.data?.description?.[0] || err.response?.data?.detail || 'Có lỗi xảy ra khi gửi báo cáo. Vui lòng thử lại!';
      setErrorMessage(detail);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bug-modal-overlay" onClick={handleOverlayClick}>
      <div className="bug-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="bug-modal-header">
          <h3 className="bug-modal-title">
            <span>🐞</span> Báo Lỗi Hệ Thống & Phản Hồi
          </h3>
          <button className="bug-modal-close-btn" onClick={requestClose} aria-label="Đóng modal">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="bug-modal-body">
            {successMessage && <div className="bug-alert-success">✓ {successMessage}</div>}
            {errorMessage && <div className="bug-alert-error">⚠️ {errorMessage}</div>}

            <div className="bug-form-group">
              <label className="bug-form-label">
                Tiêu đề sự cố / Tính năng lỗi
              </label>
              <input
                type="text"
                className="bug-form-input"
                placeholder="VD: Không tải được tài liệu, lỗi hiển thị bảng điểm..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
              />
            </div>

            <div className="bug-form-group">
              <label className="bug-form-label">
                Mô tả chi tiết sự cố <span className="required">*</span>
              </label>
              <textarea
                className="bug-form-textarea"
                rows={4}
                placeholder="Vui lòng mô tả các bước xảy ra lỗi hoặc hành vi mong đợi..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>

            <div className="bug-form-group">
              <label className="bug-form-label">Đường dẫn trang xảy ra lỗi (Tự động ghi nhận)</label>
              <span className="bug-url-badge">🔗 {window.location.href}</span>
            </div>

            <div className="bug-form-group">
              <label className="bug-form-label">Ảnh chụp màn hình sự cố (Tùy chọn)</label>
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept="image/png,image/jpeg,image/jpg,image/webp"
                onChange={(e) => e.target.files && handleFileChange(e.target.files[0])}
              />

              {!previewUrl ? (
                <div
                  className={`bug-dropzone ${isDragOver ? 'dragover' : ''}`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDrop}
                >
                  <div className="bug-dropzone-icon">📷</div>
                  <p className="bug-dropzone-text">
                    Kéo thả ảnh chụp màn hình vào đây hoặc <strong>nhấp để chọn ảnh</strong>
                  </p>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Hỗ trợ PNG, JPG, WebP tối đa 10MB</span>
                </div>
              ) : (
                <div className="bug-preview-container">
                  <img src={previewUrl} alt="Ảnh chụp màn hình lỗi" className="bug-preview-image" />
                  <button
                    type="button"
                    className="bug-preview-remove"
                    onClick={handleRemoveScreenshot}
                    title="Gỡ ảnh"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="bug-modal-footer">
            <button type="button" className="bug-btn-cancel" onClick={onClose} disabled={isSubmitting}>
              Hủy
            </button>
            <DebouncedSubmitButton
              loading={isSubmitting}
              loadingText="Đang gửi báo cáo..."
              className="btn btn-primary"
            >
              🚀 Gửi Báo Cáo Lỗi
            </DebouncedSubmitButton>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BugReportModal;
