import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { useTranslation } from 'react-i18next';
import './LoginPage.css';
import utcLogo from '../asset/images/utc_logo.webp';

const LoginPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [userType, setUserType] = useState<'student' | 'supervisor' | 'committee_member' | 'external_examiner'>('student');
  const [registrationNo, setRegistrationNo] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Validation States
  const [fieldErrors, setFieldErrors] = useState<{ registrationNo?: string; email?: string; password?: string }>({});
  const [touched, setTouched] = useState<{ registrationNo?: boolean; email?: boolean; password?: boolean }>({});
  const [isShaking, setIsShaking] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const toggleLanguage = () => {
    const nextLng = i18n.language.startsWith('vi') ? 'en' : 'vi';
    i18n.changeLanguage(nextLng);
  };

  // Field validation rules
  const validateFields = (type: string, regNoVal: string, emailVal: string, passVal: string) => {
    const errors: { registrationNo?: string; email?: string; password?: string } = {};

    if (type === 'student') {
      if (!regNoVal.trim()) {
        errors.registrationNo = i18n.language.startsWith('vi') 
          ? 'Vui lòng nhập Mã sinh viên hoặc Tên đăng nhập UTC' 
          : 'Please enter UTC Student ID or Username';
      } else if (regNoVal.trim().length < 3) {
        errors.registrationNo = i18n.language.startsWith('vi')
          ? 'Mã sinh viên phải có ít nhất 3 ký tự'
          : 'Student ID must be at least 3 characters';
      }
    } else {
      if (!emailVal.trim()) {
        errors.email = i18n.language.startsWith('vi')
          ? 'Vui lòng nhập Email hoặc Tên đăng nhập cán bộ UTC'
          : 'Please enter UTC Staff Email or Username';
      } else if (emailVal.trim().length < 3) {
        errors.email = i18n.language.startsWith('vi')
          ? 'Thông tin đăng nhập phải có ít nhất 3 ký tự'
          : 'Username/Email must be at least 3 characters';
      }
    }

    if (!passVal) {
      errors.password = i18n.language.startsWith('vi')
        ? 'Vui lòng nhập mật khẩu'
        : 'Please enter your password';
    } else if (passVal.length < 4) {
      errors.password = i18n.language.startsWith('vi')
        ? 'Mật khẩu phải có ít nhất 4 ký tự'
        : 'Password must be at least 4 characters';
    }

    return errors;
  };

  const handleBlur = (field: 'registrationNo' | 'email' | 'password') => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const errors = validateFields(userType, registrationNo, email, password);
    setFieldErrors(errors);
  };

  const handleUserTypeChange = (newRole: 'student' | 'supervisor' | 'committee_member' | 'external_examiner') => {
    setUserType(newRole);
    setError('');
    setFieldErrors({});
    setTouched({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Trigger validation on submit
    setTouched({ registrationNo: true, email: true, password: true });
    const errors = validateFields(userType, registrationNo, email, password);
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      return;
    }

    setLoading(true);

    try {
      let response;
      if (userType === 'student') {
        response = await apiService.studentLogin(registrationNo.trim(), password);
      } else if (userType === 'supervisor') {
        response = await apiService.supervisorLogin(email.trim(), password);
      } else if (userType === 'committee_member') {
        response = await apiService.committeeMemberLogin(email.trim(), password);
      } else {
        response = await apiService.externalExaminerLogin(email.trim(), password);
      }

      login(response.access, response.refresh, userType);
      navigate(`/${userType}/dashboard`);
    } catch (err: any) {
      if (err.response?.status === 429) {
        const detail = err.response?.data?.detail || '';
        const seconds = detail.match(/\d+/)?.[0] || '60';
        setError(t('login.throttled', `Đăng nhập sai quá nhiều lần. Vui lòng thử lại sau ${seconds} giây.`));
      } else {
        setError(err.response?.data?.message || err.response?.data?.detail || t('login.loginFailed', 'Đăng nhập thất bại. Vui lòng kiểm tra lại tài khoản.'));
      }
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
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
            <img src={utcLogo} alt="UTC Logo" className="utc-logo-icon" style={{ backgroundColor: '#fff', padding: '2px', objectFit: 'contain' }} />
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
        {/* Left Side Welcome Info Card - Modern UTC Capstone Showcase */}
        <section className="utc-info-card">
          {/* Official University Badge */}
          <div className="utc-hero-badge">
            <span className="utc-badge-pulse"></span>
            <span className="utc-badge-school">{t('portal.schoolName', 'TRƯỜNG ĐẠI HỌC GIAO THÔNG VẬN TẢI')}</span>
            <span className="utc-badge-divider">•</span>
            <span className="utc-badge-dept">KHOA CÔNG NGHỆ THÔNG TIN</span>
            <span className="utc-badge-tag">CHÍNH THỨC</span>
          </div>

          {/* Header Title & Branding */}
          <div className="utc-info-header">
            <div className="utc-logo-frame">
              <img src={utcLogo} alt="UTC Logo" className="utc-info-logo" />
            </div>
            <div className="utc-info-header-text">
              <h2 className="utc-hero-title">
                {t('portal.welcomeTitle', 'CHÀO MỪNG ĐẾN VỚI HỆ THỐNG SMART FYP UTC')}
              </h2>
              <p className="utc-hero-subtitle">
                {t('portal.welcomeDesc', 'Trường Đại học Giao thông Vận tải — Hệ thống quản lý đề tài & vòng đời đồ án tốt nghiệp sinh viên chuẩn hóa.')}
              </p>
            </div>
          </div>

          {/* 5-Step Capstone Milestone Roadmap */}
          <div className="utc-timeline-preview-container">
            <div className="utc-timeline-preview-header">
              <div className="utc-tl-title-group">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="utc-tl-icon">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
                <span className="utc-timeline-preview-title">Lộ trình 5 Mốc Đồ án Chuẩn UTC</span>
              </div>
              <span className="utc-timeline-preview-badge">Khóa K60 - K63</span>
            </div>

            <div className="utc-timeline-stepper">
              <div className="utc-stepper-line">
                <div className="utc-stepper-progress"></div>
              </div>
              <div className="utc-step-node completed">
                <div className="utc-node-circle">1</div>
                <span className="utc-node-label">Đăng ký đề tài</span>
                <span className="utc-node-sub">Tuần 1-2</span>
              </div>
              <div className="utc-step-node completed">
                <div className="utc-node-circle">2</div>
                <span className="utc-node-label">Đề cương chi tiết</span>
                <span className="utc-node-sub">Tuần 3-4</span>
              </div>
              <div className="utc-step-node active">
                <div className="utc-node-circle">3</div>
                <span className="utc-node-label">Đánh giá giữa kỳ</span>
                <span className="utc-node-sub">Tuần 8-10</span>
              </div>
              <div className="utc-step-node">
                <div className="utc-node-circle">4</div>
                <span className="utc-node-label">Nộp khóa luận</span>
                <span className="utc-node-sub">Tuần 14</span>
              </div>
              <div className="utc-step-node">
                <div className="utc-node-circle">5</div>
                <span className="utc-node-label">Bảo vệ Hội đồng</span>
                <span className="utc-node-sub">Tuần 16</span>
              </div>
            </div>
          </div>

          {/* 4 Feature Boxes Grid - Upgraded with Modern SVGs & Badges */}
          <div className="utc-features-grid">
            <div className="utc-feature-card feat-blue">
              <div className="utc-feat-top">
                <div className="utc-feature-icon-wrapper icon-blue">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="20" x2="18" y2="10" />
                    <line x1="12" y1="20" x2="12" y2="4" />
                    <line x1="6" y1="20" x2="6" y2="14" />
                    <path d="M3 20h18" />
                  </svg>
                </div>
                <span className="utc-feat-badge badge-blue">5 MỐC QUY TRÌNH</span>
              </div>
              <div className="utc-feat-content">
                <h4>{t('portal.feat1Title', 'Quản lý Tiến độ Đồ án')}</h4>
                <p>{t('portal.feat1Desc', 'Theo dõi 5 mốc tiến độ & trạng thái nộp tài liệu')}</p>
              </div>
            </div>

            <div className="utc-feature-card feat-indigo">
              <div className="utc-feat-top">
                <div className="utc-feature-icon-wrapper icon-indigo">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </div>
                <span className="utc-feat-badge badge-indigo">HỘI ĐỒNG & PB</span>
              </div>
              <div className="utc-feat-content">
                <h4>{t('portal.feat2Title', 'Lịch Bảo vệ & Hội đồng')}</h4>
                <p>{t('portal.feat2Desc', 'Xem lịch bảo vệ, phân công phản biện & hội đồng')}</p>
              </div>
            </div>

            <div className="utc-feature-card feat-amber">
              <div className="utc-feat-top">
                <div className="utc-feature-icon-wrapper icon-amber">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                </div>
                <span className="utc-feat-badge badge-amber">BIỂU MẪU A4</span>
              </div>
              <div className="utc-feat-content">
                <h4>{t('portal.feat3Title', 'Biểu mẫu & In Phiếu chấm')}</h4>
                <p>{t('portal.feat3Desc', 'Xuất biên bản bảo vệ A4 & báo cáo Excel chuẩn UTC')}</p>
              </div>
            </div>

            <div className="utc-feature-card feat-emerald">
              <div className="utc-feat-top">
                <div className="utc-feature-icon-wrapper icon-emerald">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="8" r="6" />
                    <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
                  </svg>
                </div>
                <span className="utc-feat-badge badge-emerald">40-20-40 • GPA 4.0</span>
              </div>
              <div className="utc-feat-content">
                <h4>{t('portal.feat4Title', 'Trọng số Điểm 40-20-40 & GPA')}</h4>
                <p>{t('portal.feat4Desc', 'Tự động quy đổi thang GPA 4.0 & điểm chữ UTC')}</p>
              </div>
            </div>
          </div>

          {/* Bottom Security / Trust Notice */}
          <div className="utc-info-footer-bar">
            <div className="utc-footer-trust">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span>{t('portal.welcomeNote', 'Đăng nhập để quản lý tiến độ đồ án tốt nghiệp, tra cứu điểm và xuất biểu mẫu chuẩn UTC.')}</span>
            </div>
            <div className="utc-footer-live">
              <span className="utc-live-dot"></span>
              <span>UTC 2026-2027</span>
            </div>
          </div>
        </section>

        {/* Right Side Login Card */}
        <section className={`utc-login-card ${isShaking ? 'utc-shake-anim' : ''}`}>
          <div className="utc-lock-badge">
            <span>🔒</span>
          </div>

          <h2 className="utc-login-title">{t('portal.loginFormTitle', 'ĐĂNG NHẬP HỆ THỐNG')}</h2>

          {/* Role Selector Tabs */}
          <div className="utc-role-tabs">
            <button
              type="button"
              className={`utc-role-tab ${userType === 'student' ? 'active' : ''}`}
              onClick={() => handleUserTypeChange('student')}
            >
              {t('roles.student', 'Sinh viên')}
            </button>
            <button
              type="button"
              className={`utc-role-tab ${userType === 'supervisor' ? 'active' : ''}`}
              onClick={() => handleUserTypeChange('supervisor')}
            >
              {t('roles.supervisor', 'Giảng viên HD')}
            </button>
            <button
              type="button"
              className={`utc-role-tab ${userType === 'committee_member' ? 'active' : ''}`}
              onClick={() => handleUserTypeChange('committee_member')}
            >
              {t('roles.committee_member', 'Hội đồng')}
            </button>
          </div>

          {/* Quick Demo Accounts Helper */}
          <div style={{
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap',
            marginBottom: '16px',
            padding: '10px 12px',
            background: 'rgba(0, 51, 102, 0.05)',
            borderRadius: '8px',
            border: '1px dashed #cbd5e1',
            fontSize: '0.82rem',
            alignItems: 'center'
          }}>
            <span style={{ fontWeight: 600, color: '#003366', marginRight: '2px' }}>
              ⚡ Điền mẫu:
            </span>
            <button
              type="button"
              onClick={() => {
                setUserType('student');
                setRegistrationNo('201200101');
                setPassword('student123');
                setFieldErrors({});
                setError('');
              }}
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                border: '1px solid #93c5fd',
                background: userType === 'student' ? '#dbeafe' : '#fff',
                cursor: 'pointer',
                fontWeight: 500,
                color: '#1e40af',
                fontSize: '0.8rem'
              }}
            >
              🎓 SV: 201200101
            </button>
            <button
              type="button"
              onClick={() => {
                setUserType('supervisor');
                setEmail('supervisor1');
                setPassword('supervisor123');
                setFieldErrors({});
                setError('');
              }}
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                border: '1px solid #86efac',
                background: userType === 'supervisor' ? '#dcfce7' : '#fff',
                cursor: 'pointer',
                fontWeight: 500,
                color: '#166534',
                fontSize: '0.8rem'
              }}
            >
              👨‍🏫 GV: supervisor1
            </button>
            <button
              type="button"
              onClick={() => {
                setUserType('committee_member');
                setEmail('committee1');
                setPassword('committee123');
                setFieldErrors({});
                setError('');
              }}
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                border: '1px solid #fde047',
                background: userType === 'committee_member' ? '#fef9c3' : '#fff',
                cursor: 'pointer',
                fontWeight: 500,
                color: '#854d0e',
                fontSize: '0.8rem'
              }}
            >
              🏛️ HĐ: committee1
            </button>
          </div>

          <form onSubmit={handleSubmit} className="utc-login-form" noValidate>
            {userType === 'student' ? (
              <div className={`utc-input-group ${touched.registrationNo && fieldErrors.registrationNo ? 'has-error' : ''} ${touched.registrationNo && !fieldErrors.registrationNo && registrationNo ? 'is-valid' : ''}`}>
                <div className="utc-input-wrapper">
                  <span className="utc-input-icon">👤</span>
                  <input
                    type="text"
                    value={registrationNo}
                    onChange={(e) => {
                      setRegistrationNo(e.target.value);
                      if (touched.registrationNo) {
                        setFieldErrors(validateFields(userType, e.target.value, email, password));
                      }
                    }}
                    onBlur={() => handleBlur('registrationNo')}
                    placeholder={t('login.usernamePlaceholder', 'Nhập mã sinh viên UTC (Ví dụ: 201200101 hoặc student1)')}
                  />
                  {touched.registrationNo && !fieldErrors.registrationNo && registrationNo && (
                    <span className="utc-valid-icon">✓</span>
                  )}
                </div>
                {touched.registrationNo && fieldErrors.registrationNo && (
                  <div className="utc-field-error">{fieldErrors.registrationNo}</div>
                )}
              </div>
            ) : (
              <div className={`utc-input-group ${touched.email && fieldErrors.email ? 'has-error' : ''} ${touched.email && !fieldErrors.email && email ? 'is-valid' : ''}`}>
                <div className="utc-input-wrapper">
                  <span className="utc-input-icon">✉️</span>
                  <input
                    type="text"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (touched.email) {
                        setFieldErrors(validateFields(userType, registrationNo, e.target.value, password));
                      }
                    }}
                    onBlur={() => handleBlur('email')}
                    placeholder={t('login.emailPlaceholder', 'Nhập email hoặc username (Ví dụ: supervisor1 hoặc gvc.nguyen@utc.edu.vn)')}
                  />
                  {touched.email && !fieldErrors.email && email && (
                    <span className="utc-valid-icon">✓</span>
                  )}
                </div>
                {touched.email && fieldErrors.email && (
                  <div className="utc-field-error">{fieldErrors.email}</div>
                )}
              </div>
            )}

            <div className={`utc-input-group ${touched.password && fieldErrors.password ? 'has-error' : ''} ${touched.password && !fieldErrors.password && password ? 'is-valid' : ''}`}>
              <div className="utc-input-wrapper">
                <span className="utc-input-icon">🔒</span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (touched.password) {
                      setFieldErrors(validateFields(userType, registrationNo, email, e.target.value));
                    }
                  }}
                  onBlur={() => handleBlur('password')}
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
              {touched.password && fieldErrors.password && (
                <div className="utc-field-error">{fieldErrors.password}</div>
              )}
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
