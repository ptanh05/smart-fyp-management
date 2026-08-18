import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { useTranslation } from 'react-i18next';
import './LoginPage.css';

const LoginPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [userType, setUserType] = useState<'student' | 'supervisor' | 'committee_member' | 'external_examiner'>('student');
  const [registrationNo, setRegistrationNo] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const toggleLanguage = () => {
    const nextLng = i18n.language.startsWith('vi') ? 'en' : 'vi';
    i18n.changeLanguage(nextLng);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let response;
      if (userType === 'student') {
        response = await apiService.studentLogin(registrationNo, password);
      } else if (userType === 'supervisor') {
        response = await apiService.supervisorLogin(email, password);
      } else if (userType === 'committee_member') {
        response = await apiService.committeeMemberLogin(email, password);
      } else {
        response = await apiService.externalExaminerLogin(email, password);
      }

      login(response.access, response.refresh, userType);
      navigate(`/${userType}/dashboard`);
    } catch (err: any) {
      setError(err.response?.data?.message || t('login.loginFailed', 'Đăng nhập thất bại. Vui lòng kiểm tra lại tài khoản.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="utc-portal-wrapper">
      {/* Background Decorative Overlay */}
      <div className="utc-bg-glow glow-1"></div>
      <div className="utc-bg-glow glow-2"></div>

      {/* Top Banner Header */}
      <header className="utc-portal-header">
        <div className="utc-brand-container">
          <div className="utc-logo-badge">
            <span className="utc-logo-icon">🎓</span>
            <div className="utc-logo-text">
              <span className="utc-school-name">{t('portal.schoolName', 'TRƯỜNG ĐẠI HỌC GIAO THÔNG VẬN TẢI')}</span>
              <span className="utc-school-name-sub">{t('portal.schoolSub', 'UNIVERSITY OF TRANSPORT AND COMMUNICATIONS')}</span>
            </div>
          </div>
          <button onClick={toggleLanguage} className="utc-lang-btn">
            {i18n.language.startsWith('vi') ? '🇻🇳 Tiếng Việt' : '🇬🇧 English'}
          </button>
        </div>

        <div className="utc-portal-title-block">
          <h1>{t('portal.headerTitle', 'CỔNG THÔNG TIN QUẢN LÝ ĐỒ ÁN TỐT NGHIỆP TRỰC TUYẾN')}</h1>
          <p>{t('portal.headerSub', 'Hệ thống Smart FYP UTC — Quản lý vòng đời đồ án tốt nghiệp sinh viên dễ dàng, hiệu quả và chính xác')}</p>
        </div>
      </header>

      {/* Main Grid Content Container */}
      <main className="utc-portal-body">
        {/* Left Side Welcome Info Card */}
        <section className="utc-info-card">
          <div className="utc-info-header">
            <div className="utc-icon-circle blue">🎓</div>
            <div className="utc-info-header-text">
              <h2>{t('portal.welcomeTitle', 'CHÀO MỪNG ĐẾN VỚI HỆ THỐNG SMART FYP UTC')}</h2>
              <p>{t('portal.welcomeDesc', 'Trường Đại học Giao thông Vận tải — nơi đào tạo nguồn nhân lực chất lượng cao trong lĩnh vực Giao thông Vận tải, Kinh tế, Kỹ thuật và Công nghệ.')}</p>
            </div>
          </div>

          <p className="utc-info-desc">
            {t('portal.welcomeNote', 'Đăng nhập để quản lý tiến độ đồ án tốt nghiệp, tra cứu điểm số, theo dõi lịch bảo vệ và sử dụng các tiện ích chuẩn hóa dành cho sinh viên và giảng viên UTC.')}
          </p>

          {/* 4 Feature Boxes Grid */}
          <div className="utc-features-grid">
            <div className="utc-feature-box">
              <div className="utc-feature-icon icon-blue">📊</div>
              <div>
                <h4>{t('portal.feat1Title', 'Quản lý Tiến độ Đồ án')}</h4>
                <p>{t('portal.feat1Desc', 'Theo dõi 5 mốc tiến độ & trạng thái nộp tài liệu')}</p>
              </div>
            </div>

            <div className="utc-feature-box">
              <div className="utc-feature-icon icon-navy">📅</div>
              <div>
                <h4>{t('portal.feat2Title', 'Lịch Bảo vệ & Hội đồng')}</h4>
                <p>{t('portal.feat2Desc', 'Xem lịch bảo vệ, phân công phản biện & hội đồng')}</p>
              </div>
            </div>

            <div className="utc-feature-box">
              <div className="utc-feature-icon icon-amber">📝</div>
              <div>
                <h4>{t('portal.feat3Title', 'Biểu mẫu & In Phiếu chấm')}</h4>
                <p>{t('portal.feat3Desc', 'Xuất biên bản bảo vệ A4 & báo cáo Excel chuẩn UTC')}</p>
              </div>
            </div>

            <div className="utc-feature-box">
              <div className="utc-feature-icon icon-green">🏆</div>
              <div>
                <h4>{t('portal.feat4Title', 'Trọng số Điểm 40-20-40 & GPA')}</h4>
                <p>{t('portal.feat4Desc', 'Tự động quy đổi thang GPA 4.0 & điểm chữ UTC')}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Right Side Login Card */}
        <section className="utc-login-card">
          <div className="utc-lock-badge">
            <span>🔒</span>
          </div>

          <h2 className="utc-login-title">{t('portal.loginFormTitle', 'ĐĂNG NHẬP HỆ THỐNG')}</h2>

          {/* Role Selector Tabs */}
          <div className="utc-role-tabs">
            <button
              className={`utc-role-tab ${userType === 'student' ? 'active' : ''}`}
              onClick={() => setUserType('student')}
            >
              {t('roles.student', 'Sinh viên')}
            </button>
            <button
              className={`utc-role-tab ${userType === 'supervisor' ? 'active' : ''}`}
              onClick={() => setUserType('supervisor')}
            >
              {t('roles.supervisor', 'Giảng viên HD')}
            </button>
            <button
              className={`utc-role-tab ${userType === 'committee_member' ? 'active' : ''}`}
              onClick={() => setUserType('committee_member')}
            >
              {t('roles.committee_member', 'Hội đồng')}
            </button>
            <button
              className={`utc-role-tab ${userType === 'external_examiner' ? 'active' : ''}`}
              onClick={() => setUserType('external_examiner')}
            >
              {t('roles.external_examiner', 'Phản biện')}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="utc-login-form">
            {userType === 'student' ? (
              <div className="utc-input-group">
                <span className="utc-input-icon">👤</span>
                <input
                  type="text"
                  value={registrationNo}
                  onChange={(e) => setRegistrationNo(e.target.value)}
                  required
                  placeholder={t('login.usernamePlaceholder', 'Nhập mã sinh viên UTC (Ví dụ: 201200101 hoặc svdemo)')}
                />
              </div>
            ) : (
              <div className="utc-input-group">
                <span className="utc-input-icon">✉️</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder={t('login.emailPlaceholder', 'Nhập email UTC (Ví dụ: gvdemo@utc.edu.vn)')}
                />
              </div>
            )}

            <div className="utc-input-group">
              <span className="utc-input-icon">🔒</span>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder={t('login.passwordPlaceholder', 'Nhập mật khẩu của bạn')}
              />
              <button
                type="button"
                className="utc-toggle-password-btn"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPassword ? '👁️' : '🙈'}
              </button>
            </div>

            <div className="utc-form-options">
              <a href="#forgot" onClick={(e) => { e.preventDefault(); alert('Vui lòng liên hệ Giáo vụ Khoa UTC để lấy lại mật khẩu.'); }}>
                {t('portal.forgotPassword', 'Quên mật khẩu?')}
              </a>
              <a href="#help" onClick={(e) => { e.preventDefault(); alert('Hỗ trợ kỹ thuật UTC: 024 3766 4078 | Email: dev@utc.edu.vn'); }}>
                ❓ {t('portal.help', 'Trợ giúp!')}
              </a>
            </div>

            {error && <div className="utc-error-box">{error}</div>}

            <button type="submit" className="utc-btn-submit" disabled={loading}>
              {loading ? t('login.loggingIn', 'ĐANG ĐĂNG NHẬP...') : t('login.submit', 'ĐĂNG NHẬP')}
            </button>

            <div className="utc-divider">
              <span>{t('portal.orLoginWith', 'hoặc đăng nhập')}</span>
            </div>

            <button
              type="button"
              className="utc-btn-sso"
              onClick={() => {
                alert('Đăng nhập Microsoft SSO dành cho tài khoản @utc.edu.vn hoặc @sv.utc.edu.vn');
              }}
            >
              <span className="sso-icon">🌐</span> {t('portal.ssoBtn', 'Đăng nhập với Email UTC (@utc.edu.vn)')}
            </button>
          </form>
        </section>
      </main>

      {/* Bottom Highlights KPI Banner */}
      <div className="utc-highlights-banner">
        <div className="utc-highlight-item">
          <div className="utc-hl-icon">🛡️</div>
          <div>
            <h5>{t('portal.hl1Title', 'Bảo mật tuyệt đối')}</h5>
            <p>{t('portal.hl1Desc', 'Phân quyền RBAC & bảo mật thông tin an toàn')}</p>
          </div>
        </div>

        <div className="utc-highlight-item">
          <div className="utc-hl-icon">🔒</div>
          <div>
            <h5>{t('portal.hl2Title', 'Đồng bộ dữ liệu 24/7')}</h5>
            <p>{t('portal.hl2Desc', 'Hệ thống tự động lưu trữ tiến độ đồ án liên tục')}</p>
          </div>
        </div>

        <div className="utc-highlight-item">
          <div className="utc-hl-icon">🎧</div>
          <div>
            <h5>{t('portal.hl3Title', 'Hỗ trợ kỹ thuật 24/7')}</h5>
            <p>{t('portal.hl3Desc', 'Đội ngũ công nghệ thông tin luôn sẵn sàng giải đáp')}</p>
          </div>
        </div>

        <div className="utc-highlight-item">
          <div className="utc-hl-icon">⚡</div>
          <div>
            <h5>{t('portal.hl4Title', 'Xác nhận nhanh chóng')}</h5>
            <p>{t('portal.hl4Desc', 'Phê duyệt đề cương & duyệt báo cáo đồ án tức thì')}</p>
          </div>
        </div>
      </div>

      {/* Footer Notice */}
      <footer className="utc-portal-footer">
        {t('portal.footer', 'Đơn vị vận hành: Trường Đại học Giao thông Vận tải (UTC) — Địa chỉ: Số 3 Phố Cầu Giấy, Láng Thượng, Đống Đa, Hà Nội | Điện thoại: (024) 3766 4078')}
      </footer>
    </div>
  );
};

export default LoginPage;
