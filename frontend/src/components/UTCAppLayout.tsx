import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import utcLogo from '../asset/images/utc_logo.webp';
import type { Student, Supervisor, CommitteeMember, UserType } from '../types';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import { GRADUATION_STAGES, getProjectStageNumber } from '../utils/graduationStages';
import ChangePasswordModal from './ChangePasswordModal';
import NotificationDropdown from './NotificationDropdown';
import GlobalSearchBar from './GlobalSearchBar';
import './UTCAppLayout.css';

interface UTCAppLayoutProps {
  user: Student | Supervisor | CommitteeMember | null;
  onLogout: () => void;
  children: React.ReactNode;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  currentStageNumber?: number; // 1 to 6 (for student)
  stageCounts?: Record<number, number>; // { 1: count, 2: count, ... 6: count } (for supervisor)
  /**
   * Portal to render, independent of the account's primary user_type.
   * Needed for dual-role accounts (e.g. a supervisor who is also a committee member):
   * the committee portal must still render only the committee navigation.
   */
  portalRole?: UserType;
}

const UTCAppLayout: React.FC<UTCAppLayoutProps> = ({
  user,
  onLogout,
  children,
  activeTab = 'overview',
  onTabChange,
  currentStageNumber,
  stageCounts,
  portalRole,
}) => {
  const { t, i18n } = useTranslation();
  const { toggleTheme, isDark } = useTheme();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

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
    if (portalRole) {
      return t(`roles.${portalRole}`, portalRole);
    }
    if (!user) return 'UTC Member';
    if ('user' in user && user.user) {
      const type = user.user.user_type;
      return t(`roles.${type}`, type);
    }
    return 'Thành Viên UTC';
  };

  const getUserType = (): UserType => {
    if (portalRole) return portalRole;
    if (!user) return 'student';
    if ('user' in user && user.user) {
      return user.user.user_type;
    }
    return 'student';
  };
  const userType = getUserType();

  // For Student: Determine the single current active stage to display on the sidebar
  const studentProject = (user as any)?.graduation_project;
  const effectiveStageNumber = currentStageNumber || getProjectStageNumber(studentProject);
  const currentStage = GRADUATION_STAGES.find((s) => s.number === effectiveStageNumber) || GRADUATION_STAGES[0];

  const handleNotificationNavigate = (url: string) => {
    const [path, queryString] = url.split('?');
    const searchParams = new URLSearchParams(queryString || '');
    const tab = searchParams.get('tab');
    const subtab = searchParams.get('subtab');

    if (onTabChange) {
      if (subtab) {
        onTabChange(subtab);
      } else if (tab) {
        onTabChange(tab === 'utc_graduation' ? 'project' : tab);
      }
    }

    if (queryString) {
      navigate(`${path}?${queryString}`);
    } else {
      navigate(path);
    }

    if (subtab) {
      window.dispatchEvent(new CustomEvent('app:switch-subtab', { detail: { subtab } }));
    }
  };

  return (
    <div className={`utc-dashboard-wrapper ${sidebarOpen ? 'sidebar-expanded' : 'sidebar-collapsed'}`}>
      {/* 1. Left Sidebar Navigation */}
      <aside className="utc-sidebar">
        <div className="utc-sidebar-logo">
          <span className="utc-seal">
            <img src={utcLogo} alt="UTC Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '50%' }} />
          </span>
          <div className="utc-logo-text-group">
            <span className="utc-school-title">SMART FYP UTC</span>
            <span className="utc-school-title-sub">
              {userType === 'student' ? 'CỔNG SINH VIÊN' : userType === 'supervisor' ? 'CỔNG GIẢNG VIÊN' : 'HỘI ĐỒNG ĐÁNH GIÁ'}
            </span>
          </div>
        </div>

        <nav className="utc-sidebar-nav">
          {userType === 'student' ? (
            <>
              {/* 1. TỔNG QUAN HỆ THỐNG */}
              <div className="utc-sidebar-section-title">TỔNG QUAN HỆ THỐNG</div>
              <div
                className={`utc-nav-item ${activeTab === 'overview' ? 'active' : ''}`}
                onClick={() => onTabChange && onTabChange('overview')}
                title="Tổng Quan Dashboard & Tiến Độ Học Vụ"
              >
                <span className="utc-nav-icon">📊</span>
                <span className="utc-nav-label">Tổng Quan Dashboard</span>
              </div>

              {/* 2. QUY TRÌNH ĐỒ ÁN UTC (CHỈ HIỂN THỊ GIAI ĐOẠN HIỆN TẠI) */}
              <div className="utc-sidebar-section-title">
                GIAI ĐOẠN HIỆN TẠI ({currentStage.number}/6)
              </div>
              <div
                className={`utc-nav-item ${
                  activeTab === currentStage.key ||
                  (currentStage.number === 1 && (activeTab === 'project' || activeTab === 'utc_graduation'))
                    ? 'active'
                    : ''
                }`}
                onClick={() => onTabChange && onTabChange(currentStage.key)}
                title={`${currentStage.label} - Giai đoạn bạn đang thực hiện. Khi GVHD duyệt sẽ mở giai đoạn tiếp theo`}
              >
                <span className="utc-nav-icon">{currentStage.icon}</span>
                <span className="utc-nav-label">{currentStage.label}</span>
                <span
                  className="utc-nav-badge"
                  style={{
                    background: '#0284c7',
                    color: '#ffffff',
                    fontWeight: 800,
                    borderRadius: '12px',
                    padding: '2px 8px',
                    fontSize: '0.72rem',
                  }}
                >
                  GĐ {currentStage.number}
                </span>
              </div>

              {/* 3. TRAO ĐỔI & THẢO LUẬN */}
              <div className="utc-sidebar-section-title">TRAO ĐỔI & THẢO LUẬN</div>
              <div
                className={`utc-nav-item ${activeTab === 'chat' || activeTab === 'groups' ? 'active' : ''}`}
                onClick={() => onTabChange && onTabChange('chat')}
                title="Nhóm Đồ Án & Kênh Chat Trực Tiếp GVHD"
              >
                <span className="utc-nav-icon">💬</span>
                <span className="utc-nav-label">Nhóm Đồ Án & Chat GVHD</span>
              </div>

              {/* 4. TÀI NGUYÊN & TIỆN ÍCH */}
              <div className="utc-sidebar-section-title">TÀI NGUYÊN & TIỆN ÍCH</div>
              <div
                className={`utc-nav-item ${activeTab === 'templates' ? 'active' : ''}`}
                onClick={() => onTabChange && onTabChange('templates')}
                title="Kho Biểu Mẫu Chuẩn & Quy Định ĐATN UTC"
              >
                <span className="utc-nav-icon">📑</span>
                <span className="utc-nav-label">Biểu Mẫu Chuẩn UTC</span>
              </div>

            </>
          ) : userType === 'committee_member' ? (
            // Committee member navigation: ONLY defense schedule, students/projects and grading
            <>
              <div className="utc-sidebar-section-title">HỘI ĐỒNG ĐÁNH GIÁ</div>
              <div
                className={`utc-nav-item ${activeTab === 'utc_live_defense' ? 'active' : ''}`}
                onClick={() => onTabChange && onTabChange('utc_live_defense')}
                title="Lịch bảo vệ, phòng/ca bảo vệ và chấm điểm trực tiếp"
              >
                <span className="utc-nav-icon">🏛️</span>
                <span className="utc-nav-label">Lịch Bảo Vệ</span>
              </div>
              <div
                className={`utc-nav-item ${activeTab === 'groups' ? 'active' : ''}`}
                onClick={() => onTabChange && onTabChange('groups')}
                title="Sinh viên và đồ án thuộc Hội đồng của bạn"
              >
                <span className="utc-nav-icon">👥</span>
                <span className="utc-nav-label">Sinh Viên & Đồ Án</span>
              </div>
              <div
                className={`utc-nav-item ${activeTab === 'evaluations' ? 'active' : ''}`}
                onClick={() => onTabChange && onTabChange('evaluations')}
                title="Chấm điểm Hội đồng cho sinh viên"
              >
                <span className="utc-nav-icon">📝</span>
                <span className="utc-nav-label">Chấm Điểm</span>
              </div>
            </>
          ) : (
            // Supervisor navigation (Hiện TẤT CẢ các giai đoạn ở bên cạnh + số sinh viên ở giai đoạn đó)
            <>
              {/* 1. TỔNG QUAN */}
              <div className="utc-sidebar-section-title">TỔNG QUAN HỆ THỐNG</div>
              <div
                className={`utc-nav-item ${activeTab === 'overview' ? 'active' : ''}`}
                onClick={() => onTabChange && onTabChange('overview')}
                title="Trang Chủ & Thống Kê Giảng Viên"
              >
                <span className="utc-nav-icon">🏠</span>
                <span className="utc-nav-label">Tổng Quan Dashboard</span>
              </div>

              {/* 2. QUY TRÌNH HƯỚNG DẪN ĐATN (HIỂN THỊ TẤT CẢ 6 GIAI ĐOẠN + SỐ SINH VIÊN CÒN LẠI) */}
              <div className="utc-sidebar-section-title">QUY TRÌNH HƯỚNG DẪN ĐATN</div>
              {GRADUATION_STAGES.map((st) => {
                const count = stageCounts?.[st.number] ?? 0;
                const isTabActive =
                  activeTab === `stage_${st.number}` ||
                  activeTab === st.key ||
                  (st.number === 1 && (activeTab === 'students' || activeTab === 'project' || activeTab === 'utc_graduation')) ||
                  (st.number === 2 && activeTab === 'survey') ||
                  (st.number === 3 && activeTab === 'outlines') ||
                  (st.number === 4 && activeTab === 'weekly') ||
                  (st.number === 5 && activeTab === 'supervision') ||
                  (st.number === 6 && activeTab === 'eval');

                return (
                  <div
                    key={st.number}
                    className={`utc-nav-item ${isTabActive ? 'active' : ''}`}
                    onClick={() => onTabChange && onTabChange(`stage_${st.number}`)}
                    title={`${st.sidebarLabel} - Hiện có ${count} sinh viên đang ở giai đoạn này`}
                  >
                    <span className="utc-nav-icon">{st.icon}</span>
                    <span className="utc-nav-label">{st.sidebarLabel}</span>
                    <span
                      className="utc-nav-badge"
                      style={{
                        background: count > 0 ? '#0284c7' : 'rgba(255, 255, 255, 0.12)',
                        color: count > 0 ? '#ffffff' : '#94a3b8',
                        fontWeight: 700,
                        borderRadius: '12px',
                        padding: '2px 8px',
                        fontSize: '0.72rem',
                        boxShadow: count > 0 ? '0 0 8px rgba(2, 132, 199, 0.35)' : 'none',
                      }}
                    >
                      {count} SV
                    </span>
                  </div>
                );
              })}

              {/* 3. ĐÁNH GIÁ & BẢO LƯU */}
              <div className="utc-sidebar-section-title">ĐÁNH GIÁ & BẢO LƯU</div>
              <div
                className={`utc-nav-item ${activeTab === 'reviewer' ? 'active' : ''}`}
                onClick={() => onTabChange && onTabChange('reviewer')}
                title="Đồ Án Phản Biện Độc Lập"
              >
                <span className="utc-nav-icon">🔍</span>
                <span className="utc-nav-label">Đồ Án Phản Biện</span>
              </div>
              <div
                className={`utc-nav-item ${activeTab === 'deferrals' ? 'active' : ''}`}
                onClick={() => onTabChange && onTabChange('deferrals')}
                title="Đơn Xin Hoãn / Bảo Lưu Đồ Án Tốt Nghiệp"
              >
                <span className="utc-nav-icon">📋</span>
                <span className="utc-nav-label">Đơn Xin Bảo Lưu</span>
              </div>

              {/* 4. TRAO ĐỔI & TIỆN ÍCH */}
              <div className="utc-sidebar-section-title">TRAO ĐỔI & TIỆN ÍCH</div>
              <div
                className={`utc-nav-item ${activeTab === 'chat' || activeTab === 'groups' ? 'active' : ''}`}
                onClick={() => onTabChange && onTabChange('chat')}
                title="Nhóm Đồ Án & Kênh Chat Trực Tiếp Sinh Viên"
              >
                <span className="utc-nav-icon">💬</span>
                <span className="utc-nav-label">Nhóm Đồ Án & Chat</span>
              </div>
              <div
                className={`utc-nav-item ${activeTab === 'templates' ? 'active' : ''}`}
                onClick={() => onTabChange && onTabChange('templates')}
                title="Kho Biểu Mẫu Chuẩn & Quy Định ĐATN UTC"
              >
                <span className="utc-nav-icon">📑</span>
                <span className="utc-nav-label">Biểu Mẫu Chuẩn UTC</span>
              </div>
              <div
                className={`utc-nav-item ${activeTab === 'audit' ? 'active' : ''}`}
                onClick={() => onTabChange && onTabChange('audit')}
                title="Nhật Ký Hoạt Động & Thống Kê"
              >
                <span className="utc-nav-icon">📈</span>
                <span className="utc-nav-label">Nhật Ký Hệ Thống</span>
              </div>
            </>
          )}
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
            <GlobalSearchBar
              className="utc-header-global-search"
              placeholder={t('common.search', 'Tìm kiếm đề tài, sinh viên, GV, biểu mẫu... (Ctrl+K)')}
            />
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
            <img src={utcLogo} alt="UTC Logo" style={{ width: '75%', height: '75%', objectFit: 'contain' }} />
          </div>
        </section>

        {/* 4. Quick actions & news are student/supervisor oriented — hidden in the committee portal */}
        {userType !== 'committee_member' && (
          <>
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
          </>
        )}

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
