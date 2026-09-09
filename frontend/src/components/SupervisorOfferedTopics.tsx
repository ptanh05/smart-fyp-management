import React, { useState, useEffect, useRef } from 'react';
import { apiService } from '../services/api';
import type { Project, ProjectCategory } from '../types';
import { useModalGuard } from '../utils/modalHooks';
import './SupervisorOfferedTopics.css';

interface SupervisorOfferedTopicsProps {
  onTopicChanged?: () => void;
}

export const SupervisorOfferedTopics: React.FC<SupervisorOfferedTopicsProps> = ({ onTopicChanged }) => {
  const [topics, setTopics] = useState<Project[]>([]);
  const [categories, setCategories] = useState<ProjectCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'registered'>('all');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    project_name: '',
    project_category: 0,
    language: '',
    project_description: '',
    functionalities: '',
  });
  const initialFormDataRef = useRef(formData);

  const isDirty = showModal && JSON.stringify(formData) !== JSON.stringify(initialFormDataRef.current);
  const { requestClose, handleOverlayClick } = useModalGuard({
    isOpen: showModal,
    onClose: () => setShowModal(false),
    isDirty,
    confirmMessage: 'Bạn có dữ liệu đề tài đang nhập dở chưa lưu. Bạn có chắc muốn đóng không?',
  });

  const loadTopics = async () => {
    try {
      setLoading(true);
      const [topicsData, catsData] = await Promise.all([
        apiService.getProjects({ mineOnly: true }),
        apiService.getProjectCategories(),
      ]);
      setTopics(topicsData || []);
      setCategories(catsData || []);
    } catch (err: any) {
      console.error('Failed to load topics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTopics();
  }, []);

  const handleOpenCreateModal = () => {
    setIsEditing(false);
    setSelectedTopicId(null);
    const initial = {
      project_name: '',
      project_category: categories.length > 0 ? categories[0].id : 0,
      language: '',
      project_description: '',
      functionalities: '',
    };
    setFormData(initial);
    initialFormDataRef.current = initial;
    setModalError(null);
    setShowModal(true);
  };

  const handleOpenEditModal = (topic: Project) => {
    if (topic.has_registered_groups) {
      alert('Đề tài này đã có nhóm sinh viên đăng ký hoặc nhận, không thể chỉnh sửa thông tin.');
      return;
    }
    setIsEditing(true);
    setSelectedTopicId(topic.id);
    const initial = {
      project_name: topic.project_name,
      project_category: topic.project_category || (categories[0]?.id || 0),
      language: topic.language || '',
      project_description: topic.project_description || '',
      functionalities: topic.functionalities || '',
    };
    setFormData(initial);
    initialFormDataRef.current = initial;
    setModalError(null);
    setShowModal(true);
  };

  const handleDeleteTopic = async (topic: Project) => {
    if (topic.has_registered_groups) {
      alert('Đề tài này đã có sinh viên đăng ký hoặc nhận, không thể xóa.');
      return;
    }

    const confirmDelete = window.confirm(
      `Bạn có chắc chắn muốn xóa đề tài gợi ý: "${topic.project_name}"?\n\nThao tác này không thể hoàn tác.`
    );
    if (!confirmDelete) return;

    try {
      await apiService.deleteProject(topic.id);
      alert('Đề tài đã bị gỡ khỏi danh sách đề tài gợi ý thành công!');
      loadTopics();
      onTopicChanged?.();
    } catch (err: any) {
      console.error('Delete project failed:', err);
      alert('Lỗi xóa đề tài: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!formData.project_name.trim()) {
      setModalError('Vui lòng nhập tên đề tài.');
      return;
    }
    if (!formData.project_category) {
      setModalError('Vui lòng chọn hướng đề tài / chuyên mục.');
      return;
    }

    try {
      setSaving(true);
      if (isEditing && selectedTopicId) {
        await apiService.updateProject(selectedTopicId, formData);
        alert('Lưu thay đổi thông tin đề tài gợi ý thành công!');
      } else {
        await apiService.createProject(formData);
        alert('Tạo đề tài gợi ý mới thành công!');
      }
      setShowModal(false);
      loadTopics();
      onTopicChanged?.();
    } catch (err: any) {
      console.error('Save project error:', err);
      setModalError(err.response?.data?.message || 'Có lỗi xảy ra khi lưu thông tin đề tài.');
    } finally {
      setSaving(false);
    }
  };

  const filteredTopics = topics.filter((t) => {
    const matchesSearch =
      t.project_name.toLowerCase().includes(search.toLowerCase()) ||
      t.project_description.toLowerCase().includes(search.toLowerCase()) ||
      t.language.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === 'available') return !t.has_registered_groups;
    if (statusFilter === 'registered') return !!t.has_registered_groups;
    return true;
  });

  return (
    <div className="supervisor-topics-container">
      <div className="supervisor-topics-header">
        <div>
          <h2>Đề Tài Gợi Ý Của Giảng Viên</h2>
          <p className="subtitle">
            Quản lý các đề tài gợi ý cho sinh viên đăng ký. Giảng viên có thể sửa thông tin hoặc xóa đề tài khi chưa có nhóm nhận.
          </p>
        </div>
        <button className="btn btn-primary create-topic-btn" onClick={handleOpenCreateModal}>
          ➕ Thêm Đề Tài Gợi Ý Mới
        </button>
      </div>

      <div className="supervisor-topics-controls">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Tìm theo tiêu đề, công nghệ, mô tả..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="clear-btn" onClick={() => setSearch('')}>
              ×
            </button>
          )}
        </div>

        <div className="filter-group">
          <label>Trạng thái nhận:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="select-filter"
          >
            <option value="all">Tất cả đề tài ({topics.length})</option>
            <option value="available">Chưa có nhóm nhận ({topics.filter((t) => !t.has_registered_groups).length})</option>
            <option value="registered">Đã có nhóm nhận ({topics.filter((t) => t.has_registered_groups).length})</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="topics-loading">Đang tải danh sách đề tài gợi ý...</div>
      ) : filteredTopics.length === 0 ? (
        <div className="empty-topics">
          <div className="empty-icon">💡</div>
          <h4>Không tìm thấy đề tài gợi ý nào</h4>
          <p>
            {search || statusFilter !== 'all'
              ? 'Thử thay đổi bộ lọc tìm kiếm hoặc xem lại trạng thái đề tài.'
              : 'Thầy/Cô chưa tạo đề tài gợi ý nào. Hãy nhấn "Thêm Đề Tài Gợi Ý Mới" để bắt đầu.'}
          </p>
        </div>
      ) : (
        <div className="topics-grid">
          {filteredTopics.map((topic) => {
            const isRegistered = !!topic.has_registered_groups;
            const categoryObj = categories.find((c) => c.id === topic.project_category);

            return (
              <div
                key={topic.id}
                className={`topic-card ${isRegistered ? 'is-registered' : 'is-available'}`}
              >
                <div className="topic-card-header">
                  <span className="topic-category-badge">
                    📁 {categoryObj ? categoryObj.category_name : `Danh mục #${topic.project_category}`}
                  </span>
                  {isRegistered ? (
                    <span className="status-badge badge-registered">
                      🔒 Đã có nhóm nhận
                    </span>
                  ) : (
                    <span className="status-badge badge-available">
                      🟢 Chưa có nhóm nhận
                    </span>
                  )}
                </div>

                <h3 className="topic-title">{topic.project_name}</h3>

                <p className="topic-description">{topic.project_description || 'Chưa có mô tả chi tiết.'}</p>

                <div className="topic-meta">
                  <div className="meta-item">
                    <span className="meta-label">💻 Ngôn ngữ / Công nghệ:</span>
                    <span className="meta-value tech-tag">{topic.language || 'Không giới hạn'}</span>
                  </div>
                  {topic.functionalities && (
                    <div className="meta-item">
                      <span className="meta-label">⚙️ Yêu cầu kỹ thuật & Chức năng:</span>
                      <p className="meta-value functionalities-text">{topic.functionalities}</p>
                    </div>
                  )}
                </div>

                <div className="topic-actions">
                  <button
                    className={`btn btn-sm ${isRegistered ? 'btn-disabled' : 'btn-outline-primary'}`}
                    onClick={() => handleOpenEditModal(topic)}
                    disabled={isRegistered}
                    title={isRegistered ? 'Đề tài đã có nhóm nhận, không thể sửa' : 'Sửa thông tin đề tài'}
                  >
                    ✏️ Sửa đề tài
                  </button>
                  <button
                    className={`btn btn-sm ${isRegistered ? 'btn-disabled' : 'btn-outline-danger'}`}
                    onClick={() => handleDeleteTopic(topic)}
                    disabled={isRegistered}
                    title={isRegistered ? 'Đề tài đã có nhóm sinh viên đăng ký, không thể xóa' : 'Xóa đề tài'}
                  >
                    🗑️ Xóa đề tài
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Add / Edit Topic */}
      {showModal && (
        <div className="modal-overlay" onClick={saving ? undefined : handleOverlayClick}>
          <div className="modal-content topic-edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{isEditing ? 'Sửa Thông Tin Đề Tài Gợi Ý' : 'Thêm Đề Tài Gợi Ý Mới'}</h3>
              <button
                className="modal-close"
                onClick={requestClose}
                disabled={saving}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleFormSubmit}>
              <div className="modal-body">
                {modalError && <div className="alert alert-error">{modalError}</div>}

                <div className="form-group">
                  <label>
                    Tiêu đề đề tài <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={200}
                    value={formData.project_name}
                    onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
                    placeholder="VD: Xây dựng hệ thống quản lý đồ án tốt nghiệp thông minh ứng dụng AI"
                  />
                </div>

                <div className="form-group">
                  <label>
                    Hướng đề tài / Lĩnh vực <span className="required">*</span>
                  </label>
                  <select
                    required
                    value={formData.project_category}
                    onChange={(e) => setFormData({ ...formData, project_category: Number(e.target.value) })}
                  >
                    <option value={0} disabled>
                      -- Chọn hướng chuyên mục --
                    </option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.category_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>
                    Ngôn ngữ / Công nghệ kỹ thuật đề xuất <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={200}
                    value={formData.language}
                    onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                    placeholder="VD: Python, Django, React, TypeScript, PostgreSQL"
                  />
                </div>

                <div className="form-group">
                  <label>Mô tả chi tiết đề tài</label>
                  <textarea
                    rows={4}
                    value={formData.project_description}
                    onChange={(e) => setFormData({ ...formData, project_description: e.target.value })}
                    placeholder="Mô tả bối cảnh, lý do thực hiện đề tài, mục tiêu cần đạt được..."
                  />
                </div>

                <div className="form-group">
                  <label>Yêu cầu kỹ thuật & Các phân hệ / Chức năng chính</label>
                  <textarea
                    rows={4}
                    value={formData.functionalities}
                    onChange={(e) => setFormData({ ...formData, functionalities: e.target.value })}
                    placeholder="1. Phân hệ xác thực phân quyền&#10;2. Phân hệ nộp và duyệt đồ án&#10;3. Phân hệ chấm điểm theo tiêu chí..."
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={requestClose}
                  disabled={saving}
                >
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Đang lưu...' : isEditing ? '💾 Lưu Thay Đổi' : '➕ Tạo Đề Tài'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupervisorOfferedTopics;
