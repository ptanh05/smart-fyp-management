import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Student, Supervisor, CommitteeMember } from '../types';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import ChangePasswordModal from './ChangePasswordModal';
import NotificationDropdown from './NotificationDropdown';
import './UTCAppLayout.css';

interface UTCAppLayoutProps {
  user: Student | Supervisor | CommitteeMember | null;
  onLogout: () => void;
  children: React.ReactNode;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

const UTCAppLayout: React.FC<UTCAppLayoutProps> = ({
  user,
  onLogout,
  children,
  activeTab = 'overview',
  onTabChange,
}) => {
  const { t, i18n } = useTranslation();
  const { toggleTheme, isDark } = useTheme();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [expandedMenu, setExpandedMenu] = useState<string | null>('academic');

  // Format dynamic greeting based on current hour
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (i18n.language.startsWith('en')) {
      if (hour < 12) return 'Good morning,';
      if (hour < 18) return 'Good afternoon,';
      return 'Good evening,';
    }
    if (hour < 12) return 'Chào buổi sáng,';
    if (hour < 18) return 'Chào buổi trưa,';
    return 'Chào buổi tối,';
  };

  // Get current date string formatted in Vietnamese / English
  const getCurrentDateString = () => {
    const now = new Date();
    if (i18n.language.startsWith('en')) {
      return now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }
    const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const dayName = days[now.getDay()];
    const date = now.getDate().toString().padStart(2, '0');
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const year = now.getFullYear();
    return `${dayName}, ngày ${date}/${month}/${year}`;
  };

  const toggleLanguage = () => {
    const nextLng = i18n.language.startsWith('vi') ? 'en' : 'vi';
    i18n.changeLanguage(nextLng);
  };

  const getUserDisplayName = () => {
    if (!user) return 'Người dùng UTC';
    if ('user' in user && user.user) {
      const { first_name, last_name, username } = user.user;
      if (first_name || last_name) {
        return `${first_name} ${last_name}`.trim();
      }
      return username;
    }
    return 'Người dùng UTC';
  };

  const getUserRoleLabel = () => {
    if (!user) return 'UTC Member';
    if ('user' in user && user.user) {
      const type = user.user.user_type;
      return t(`roles.${type}`, type);
    }
    return 'Thành Viên UTC';
  };

  const handleNotificationNavigate = (url: string) => {
    const [path, queryString] = url.split('?');
    if (queryString) {
      navigate(`${path}?${queryString}`);
    } else {
      navigate(path);
    }
  };

  return (
    <div className={`utc-dashboard-wrapper ${sidebarOpen ? 'sidebar-expanded' : 'sidebar-collapsed'}`}>
      {/* 1. Left Sidebar Navigation */}
      <aside className="utc-sidebar">
        <div className="utc-sidebar-logo">
          <span className="utc-seal">🎓</span>
          <div className="utc-logo-text-group">
            <span className="utc-school-title">TRƯỜNG ĐẠI HỌC</span>
            <span className="utc-school-title-sub">GIAO THÔNG VẬN TẢI</span>
          </div>
        </div>

        <nav className="utc-sidebar-nav">
          <div
            className={`utc-nav-item ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => onTabChange && onTabChange('overview')}
          >
            <span className="utc-nav-icon">🏠</span>
            <span className="utc-nav-label">{t('nav.overview', 'Trang chủ')}</span>
          </div>

          <div
            className={`utc-nav-item ${expandedMenu === 'academic' ? 'expanded' : ''}`}
            onClick={() => setExpandedMenu(expandedMenu === 'academic' ? null : 'academic')}
          >
            <span className="utc-nav-icon">🎓</span>
            <span className="utc-nav-label">Góc học tập & Đồ án</span>
            <span className="utc-arrow">{expandedMenu === 'academic' ? '▾' : '▸'}</span>
          </div>

          {expandedMenu === 'academic' && (
            <div className="utc-sub-nav">
              <div
                className={`utc-sub-item ${activeTab === 'groups' || activeTab === 'project' ? 'active' : ''}`}
                onClick={() => onTabChange && onTabChange('project')}
              >
                {t('nav.project', 'Tra cứu đề tài & Nhóm')}
              </div>
              <div
                className={`utc-sub-item ${activeTab === 'evaluations' || activeTab === 'external' ? 'active' : ''}`}
                onClick={() => onTabChange && onTabChange('evaluations')}
              >
                {t('nav.evaluations', 'Tra cứu điểm & Đánh giá')}
              </div>
              <div
                className={`utc-sub-item ${activeTab === 'documents' ? 'active' : ''}`}
                onClick={() => onTabChange && onTabChange('documents')}
              >
                {t('nav.documents', 'Tài liệu & Đề cương')}
              </div>
            </div>
          )}

          <div
            className={`utc-nav-item ${activeTab === 'requests' || activeTab === 'supervisor' ? 'active' : ''}`}
            onClick={() => onTabChange && onTabChange('requests')}
          >
            <span className="utc-nav-icon">📝</span>
            <span className="utc-nav-label">{t('nav.requests', 'Đăng ký trực tuyến')}</span>
          </div>

          <div
            className={`utc-nav-item ${activeTab === 'templates' ? 'active' : ''}`}
            onClick={() => onTabChange && onTabChange('templates')}
          >
            <span className="utc-nav-icon">📅</span>
            <span className="utc-nav-label">{t('nav.templates', 'Biểu mẫu & Lịch bảo vệ')}</span>
          </div>

          <div
            className={`utc-nav-item ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => onTabChange && onTabChange('chat')}
          >
            <span className="utc-nav-icon">💬</span>
            <span className="utc-nav-label">{t('nav.chat', 'Trao đổi & Thảo luận')}</span>
          </div>

          <div
            className={`utc-nav-item ${activeTab === 'audit' ? 'active' : ''}`}
            onClick={() => onTabChange && onTabChange('audit')}
          >
            <span className="utc-nav-icon">📊</span>
            <span className="utc-nav-label">{t('nav.auditLogs', 'Nhật ký & Thống kê')}</span>
          </div>
        </nav>

        <div className="utc-sidebar-footer">
          <div className="utc-system-version">Smart FYP UTC v2.5</div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="utc-main-container">
        {/* 2. Top Header Bar */}
        <header className="utc-topbar">
          <div className="utc-topbar-left">
            <button
              className="utc-toggle-sidebar-btn"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              title="Sidebar"
            >
              ☰
            </button>
            <div className="utc-search-bar">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder={t('common.search', 'Tìm kiếm thông tin đồ án, giảng viên, biểu mẫu...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="utc-topbar-right">
            <button className="utc-top-btn" onClick={toggleLanguage} title="Language">
              {i18n.language.startsWith('vi') ? '🇻🇳 VI' : '🇬🇧 EN'}
            </button>

            <button className="utc-top-btn" onClick={toggleTheme} title="Theme">
              {isDark ? '☀️' : '🌙'}
            </button>

            <NotificationDropdown onNavigate={handleNotificationNavigate} />

            <div className="utc-user-profile-menu">
              <div
                className="utc-user-pill"
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              >
                <div className="utc-user-avatar">
                  {getUserDisplayName().charAt(0).toUpperCase()}
                </div>
                <div className="utc-user-name-group">
                  <span className="utc-display-name">{getUserDisplayName()}</span>
                  <span className="utc-role-tag">{getUserRoleLabel()}</span>
                </div>
                <span className="dropdown-arrow">▾</span>
              </div>

              {userDropdownOpen && (
                <div className="utc-user-dropdown">
                  <div className="dropdown-header">
                    <strong>{getUserDisplayName()}</strong>
                    <div className="role-sub">{getUserRoleLabel()}</div>
                  </div>
                  <div className="dropdown-item" onClick={() => { setShowChangePassword(true); setUserDropdownOpen(false); }}>
                    🔐 {t('nav.changePassword', 'Đổi mật khẩu')}
                  </div>
                  <div className="dropdown-item logout" onClick={() => { onLogout(); setUserDropdownOpen(false); }}>
                    🚪 {t('nav.logout', 'Đăng xuất')}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* 3. Hero Greeting Banner (Exact UTC Portal Style) */}
        <section className="utc-hero-banner">
          <div className="utc-hero-text-block">
            <span className="utc-greeting-time">{getGreeting()}</span>
            <h1 className="utc-hero-user-name">{getUserDisplayName()}</h1>
            <div className="utc-hero-date">
              📅 {getCurrentDateString()}
            </div>
          </div>
          <div className="utc-hero-badge">
            <span>🎓</span>
          </div>
        </section>

        {/* 4. 4 Quick Action Cards Grid (Exact UTC Vibe) */}
        <section className="utc-quick-actions-grid">
          <div className="utc-quick-card action-blue" onClick={() => onTabChange && onTabChange('project')}>
            <div className="qc-icon icon-bg-blue">📘</div>
            <div className="qc-text">
              <span className="qc-tag">HỌC TẬP</span>
              <h4 className="qc-title">Đăng ký đồ án</h4>
            </div>
          </div>

          <div className="utc-quick-card action-amber" onClick={() => onTabChange && onTabChange('templates')}>
            <div className="qc-icon icon-bg-amber">📅</div>
            <div className="qc-text">
              <span className="qc-tag">LỊCH</span>
              <h4 className="qc-title">Thời khóa biểu & Tiến độ</h4>
            </div>
          </div>

          <div className="utc-quick-card action-green" onClick={() => onTabChange && onTabChange('documents')}>
            <div className="qc-icon icon-bg-green">📑</div>
            <div className="qc-text">
              <span className="qc-tag">TÀI LIỆU</span>
              <h4 className="qc-title">Nộp báo cáo & Đề cương</h4>
            </div>
          </div>

          <div className="utc-quick-card action-red" onClick={() => onTabChange && onTabChange('evaluations')}>
            <div className="qc-icon icon-bg-red">📊</div>
            <div className="qc-text">
              <span className="qc-tag">THÔNG TIN</span>
              <h4 className="qc-title">Kết quả điểm & Đánh giá</h4>
            </div>
          </div>
        </section>

        {/* 5. 2-Column News & Training Announcements Grid (Exact UTC Portal Vibe) */}
        <section className="utc-news-grid">
          <div className="utc-news-card">
            <div className="utc-news-header">
              <h3 className="utc-news-title blue-border">| TIN NHÀ TRƯỜNG</h3>
              <a href="#all" onClick={(e) => e.preventDefault()} className="utc-news-link">Xem tất cả</a>
            </div>
            <ul className="utc-news-list">
              <li>
                <span className="pin-icon">📌</span>
                <div className="news-content">
                  <a href="#news1" onClick={(e) => e.preventDefault()}>
                    Thực hiện chế độ chính sách sinh viên học kỳ I năm học 2026 - 2027
                  </a>
                  <span className="news-date">📅 11/08/2026</span>
                </div>
              </li>
              <li>
                <span className="pin-icon">📌</span>
                <div className="news-content">
                  <a href="#news2" onClick={(e) => e.preventDefault()}>
                    Công ty TNHH Tư vấn & Công nghệ Xây dựng Hoàng Phát tuyển dụng sinh viên UTC
                  </a>
                  <span className="news-date">📅 22/07/2026</span>
                </div>
              </li>
              <li>
                <span className="pin-icon">📌</span>
                <div className="news-content">
                  <a href="#news3" onClick={(e) => e.preventDefault()}>
                    Tổng công ty Quản lý bay Việt Nam thông báo tuyển dụng lao động năm 2026
                  </a>
                  <span className="news-date">📅 16/07/2026</span>
                </div>
              </li>
            </ul>
          </div>

          <div className="utc-news-card">
            <div className="utc-news-header">
              <h3 className="utc-news-title blue-border">| TIN ĐÀO TẠO & ĐỒ ÁN TỐT NGHIỆP</h3>
              <a href="#all" onClick={(e) => e.preventDefault()} className="utc-news-link">Xem tất cả</a>
            </div>
            <ul className="utc-news-list">
              <li>
                <span className="pin-icon">📌</span>
                <div className="news-content">
                  <a href="#train1" onClick={(e) => e.preventDefault()}>
                    THÔNG BÁO VỀ VIỆC SỬ DỤNG CHỨNG CHỈ IELTS / CHUẨN ĐẦU RA TRONG QUÁ TRÌNH ĐÀO TẠO ĐỒ ÁN K61
                  </a>
                  <span className="news-date">📅 14/08/2026</span>
                </div>
              </li>
              <li>
                <span className="pin-icon">📌</span>
                <div className="news-content">
                  <a href="#train2" onClick={(e) => e.preventDefault()}>
                    Thông báo lịch đăng ký bổ sung, duyệt đề cương Đồ án Tốt nghiệp đợt 1 năm học 2026 - 2027
                  </a>
                  <span className="news-date">📅 10/08/2026</span>
                </div>
              </li>
              <li>
                <span className="pin-icon">📌</span>
                <div className="news-content">
                  <a href="#train3" onClick={(e) => e.preventDefault()}>
                    Lịch báo cáo Đánh giá Giữa kỳ Đồ án Tốt nghiệp các Khoa CNTT, Điện tử, Cầu đường (10/08 - 23/08)
                  </a>
                  <span className="news-date">📅 06/08/2026</span>
                </div>
              </li>
            </ul>
          </div>
        </section>

        {/* 6. Children Inner Content (Dynamic Dashboard Tabs) */}
        <main className="utc-dashboard-body-content">
          {children}
        </main>
      </div>

      {/* Change Password Modal */}
      {showChangePassword && (
        <ChangePasswordModal isOpen={showChangePassword} onClose={() => setShowChangePassword(false)} />
      )}
    </div>
  );
};

export default UTCAppLayout;
