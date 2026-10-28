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
  const [filledAccountInfo, setFilledAccountInfo] = useState<string | null>(null);
  
  // Validation States
  const [fieldErrors, setFieldErrors] = useState<{ registrationNo?: string; email?: string; password?: string }>({});
  const [touched, setTouched] = useState<{ registrationNo?: boolean; email?: boolean; password?: boolean }>({});
  const [isShaking, setIsShaking] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  // UTC Single Sign-On (Google OAuth2) States
  const [showSsoModal, setShowSsoModal] = useState(false);
  const [ssoEmailInput, setSsoEmailInput] = useState('');
  const [ssoLoading, setSsoLoading] = useState(false);
  const [ssoError, setSsoError] = useState('');

  const handleFillStudent = (mssv: string, pass: string, name: string) => {
    setUserType('student');
    setRegistrationNo(mssv);
    setPassword(pass);
    setTouched({ registrationNo: true, password: true });
    setFieldErrors({});
    setError('');
    setFilledAccountInfo(`✓ Đã điền SV: ${name} (${mssv}) • Mật khẩu: ${pass}`);
    setTimeout(() => setFilledAccountInfo(null), 4000);
  };

  const handleFillSupervisor = (loginId: string, pass: string, name: string) => {
    setUserType('supervisor');
    setEmail(loginId);
    setPassword(pass);
    setTouched({ email: true, password: true });
    setFieldErrors({});
    setError('');
    setFilledAccountInfo(`✓ Đã điền GV: ${name} (${loginId}) • Mật khẩu: ${pass}`);
    setTimeout(() => setFilledAccountInfo(null), 4000);
  };

  const handleFillCommittee = (loginId: string, pass: string, name: string) => {
    setUserType('committee_member');
    setEmail(loginId);
    setPassword(pass);
    setTouched({ email: true, password: true });
    setFieldErrors({});
    setError('');
    setFilledAccountInfo(`✓ Đã điền Hội đồng: ${name} (${loginId}) • Mật khẩu: ${pass}`);
    setTimeout(() => setFilledAccountInfo(null), 4000);
  };

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

  const handleGoogleSsoLogin = async (targetEmail?: string) => {
    const emailToUse = targetEmail || ssoEmailInput;
    if (!emailToUse.trim()) {
      setSsoError('Vui lòng nhập địa chỉ email trường UTC (@utc.edu.vn)');
      return;
    }
    setSsoLoading(true);
    setSsoError('');
    try {
      const data = await apiService.googleSsoLogin(undefined, emailToUse.trim());
      const role = data.user_type || 'student';
      login(data.access, '', role as any);
      setShowSsoModal(false);
      navigate(`/${role}/dashboard`);
    } catch (err: any) {
      setSsoError(err.response?.data?.detail || err.response?.data?.error || 'Đăng nhập UTC SSO thất bại. Vui lòng kiểm tra lại email.');
    } finally {
      setSsoLoading(false);
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

          {/* Quick Demo Accounts Interactive Helper */}
          <div className="utc-demo-interactive-card">
            <div className="utc-demo-interactive-header">
              <span className="utc-demo-badge">⚡ ĐIỀN MẪU TEST NHANH</span>
              <span className="utc-demo-hint">Click 1 chạm để tự điền thông tin</span>
            </div>

            {/* Student Demo Options */}
            {userType === 'student' && (
              <div className="utc-demo-chips-container">
                <button
                  type="button"
                  className="utc-demo-pill primary"
                  onClick={() => handleFillStudent('201200001', 'Sv@123456', 'Nguyễn Văn An (Cử nhân)')}
                  title="Cử nhân - Đủ điều kiện bảo vệ, có Task & Điểm HĐ"
                >
                  🎓 <strong>An (201200001)</strong>: Cử nhân Đủ ĐK
                </button>
                <button
                  type="button"
                  className="utc-demo-pill"
                  onClick={() => handleFillStudent('201200011', 'Sv@123456', 'Vũ Mạnh Hùng (Kỹ sư)')}
                  title="Kỹ sư - Đồ án Kỹ sư Đủ ĐK, GVHD TS. Thắng"
                >
                  🎓 <strong>Hùng (201200011)</strong>: Kỹ sư Đủ ĐK
                </button>
                <button
                  type="button"
                  className="utc-demo-pill warn"
                  onClick={() => handleFillStudent('201200012', 'Sv@123456', 'Bùi Nam Khánh (Nợ 14 tín)')}
                  title="Nợ 14 tín - Dùng test Force Approve"
                >
                  ⚠️ <strong>Khánh (201200012)</strong>: Nợ 14 tín
                </button>
                <button
                  type="button"
                  className="utc-demo-pill default"
                  onClick={() => handleFillStudent('201200102', 'student123', 'Trần Thị Bích')}
                  title="Tài khoản demo mẫu: 201200102 / student123"
                >
                  🎓 <strong>201200102</strong> (Demo)
                </button>
              </div>
            )}

            {/* Supervisor Demo Options */}
            {userType === 'supervisor' && (
              <div className="utc-demo-chips-container">
                <button
                  type="button"
                  className="utc-demo-pill primary"
                  onClick={() => handleFillSupervisor('ts_thang', 'Gv@123456', 'TS. Vũ Bá Thắng')}
                  title="TS. Thắng - Hướng dẫn SV An & SV Hùng, giao task, chấm điểm"
                >
                  👨‍🏫 <strong>TS. Thắng</strong> (ts_thang)
                </button>
                <button
                  type="button"
                  className="utc-demo-pill"
                  onClick={() => handleFillSupervisor('pgs_ha', 'Gv@123456', 'PGS.TS. Đỗ Thị Hà')}
                  title="PGS.TS. Hà - Chủ tịch Hội đồng 01 & GVHD"
                >
                  👨‍🏫 <strong>PGS. Hà</strong> (pgs_ha)
                </button>
                <button
                  type="button"
                  className="utc-demo-pill"
                  onClick={() => handleFillSupervisor('ths_linh', 'Gv@123456', 'ThS. Nguyễn Thùy Linh')}
                  title="ThS. Linh - Hướng dẫn Cử nhân & Thư ký Hội đồng 01"
                >
                  👩‍🏫 <strong>ThS. Linh</strong> (ths_linh)
                </button>
                <button
                  type="button"
                  className="utc-demo-pill default"
                  onClick={() => handleFillSupervisor('supervisor1', 'supervisor123', 'GVC. Nguyễn Hướng Dẫn')}
                  title="Tài khoản demo mẫu: supervisor1 / supervisor123"
                >
                  👨‍🏫 <strong>supervisor1</strong> (Demo)
                </button>
              </div>
            )}

            {/* Committee Member Demo Options */}
            {userType === 'committee_member' && (
              <div className="utc-demo-chips-container">
                <button
                  type="button"
                  className="utc-demo-pill primary"
                  onClick={() => handleFillCommittee('pgs_ha', 'Gv@123456', 'Chủ tịch HĐ: PGS.TS. Đỗ Thị Hà')}
                  title="Chủ tịch Hội đồng 01 - Chấm điểm bảo vệ"
                >
                  🏛️ <strong>Chủ tịch HĐ</strong> (pgs_ha)
                </button>
                <button
                  type="button"
                  className="utc-demo-pill"
                  onClick={() => handleFillCommittee('ths_linh', 'Gv@123456', 'Thư ký: ThS. Nguyễn Thùy Linh')}
                  title="Thư ký Hội đồng 01 - Chấm điểm & lập biên bản"
                >
                  📝 <strong>Thư ký 1</strong> (ths_linh)
                </button>
                <button
                  type="button"
                  className="utc-demo-pill"
                  onClick={() => handleFillCommittee('ts_nam', 'Gv@123456', 'Ủy viên: TS. Trần Hoài Nam')}
                  title="Ủy viên Hội đồng 01 - Chấm điểm & hỏi đáp"
                >
                  ⚖️ <strong>Ủy viên</strong> (ts_nam)
                </button>
                <button
                  type="button"
                  className="utc-demo-pill default"
                  onClick={() => handleFillCommittee('committee1', 'committee123', 'PGS.TS. Nguyễn Chủ Tịch HĐ')}
                  title="Tài khoản demo mẫu: committee1 / committee123"
                >
                  🏛️ <strong>committee1</strong> (Demo)
                </button>
              </div>
            )}

            {/* Success notification banner */}
            {filledAccountInfo && (
              <div className="utc-demo-alert-success">
                {filledAccountInfo}
              </div>
            )}
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
                    placeholder={t('login.usernamePlaceholder', 'Nhập mã sinh viên UTC (Ví dụ: 201200102 hoặc 201200103)')}
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
                  placeholder={userType === 'student' ? 'Nhập mật khẩu (Mặc định: student123 hoặc chính MSSV)' : t('login.passwordPlaceholder', 'Nhập mật khẩu của bạn')}
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
                setShowSsoModal(true);
                setSsoError('');
              }}
            >
              <span className="sso-icon">🎓</span> {t('portal.ssoBtn', 'Đăng nhập với Email UTC (@utc.edu.vn)')}
            </button>
          </form>
        </section>
      </main>

      {/* UTC Google / Email Single Sign-On Modal */}
      {showSsoModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-blue-500/30 rounded-2xl max-w-md w-full p-6 text-slate-100 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setShowSsoModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white w-8 h-8 rounded-full bg-slate-800/60 hover:bg-slate-800 flex items-center justify-center transition"
            >
              ✕
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-2xl">
                🎓
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Đăng nhập UTC SSO</h3>
                <p className="text-xs text-blue-400 font-medium">Cổng xác thực tài khoản trường @utc.edu.vn</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Hệ thống tự động đồng bộ tài khoản Sinh viên (Cử nhân / Kỹ sư) và Giảng viên trường ĐH Giao thông Vận tải thông qua định dạng email trường.
            </p>

            {ssoError && (
              <div className="mb-4 p-3 rounded-lg bg-red-950/60 border border-red-500/40 text-red-300 text-xs">
                ⚠️ {ssoError}
              </div>
            )}

            {/* Quick 1-Click UTC Demo Accounts */}
            <div className="mb-4 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                ⚡ Chọn nhanh tài khoản UTC mẫu để kiểm thử:
              </span>
              <div className="grid grid-cols-1 gap-1.5">
                <button
                  type="button"
                  disabled={ssoLoading}
                  onClick={() => handleGoogleSsoLogin('201200001@utc.edu.vn')}
                  className="text-left px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-blue-600/30 text-xs text-slate-200 hover:text-white border border-slate-700/60 hover:border-blue-500/50 flex items-center justify-between transition"
                >
                  <span>👨‍🎓 <strong>201200001@utc.edu.vn</strong> (SV An)</span>
                  <span className="text-[10px] text-emerald-400 font-semibold">1-Click</span>
                </button>
                <button
                  type="button"
                  disabled={ssoLoading}
                  onClick={() => handleGoogleSsoLogin('thangvb@utc.edu.vn')}
                  className="text-left px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-blue-600/30 text-xs text-slate-200 hover:text-white border border-slate-700/60 hover:border-blue-500/50 flex items-center justify-between transition"
                >
                  <span>👨‍🏫 <strong>thangvb@utc.edu.vn</strong> (TS. Thắng)</span>
                  <span className="text-[10px] text-blue-400 font-semibold">1-Click</span>
                </button>
                <button
                  type="button"
                  disabled={ssoLoading}
                  onClick={() => handleGoogleSsoLogin('hadt@utc.edu.vn')}
                  className="text-left px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-blue-600/30 text-xs text-slate-200 hover:text-white border border-slate-700/60 hover:border-blue-500/50 flex items-center justify-between transition"
                >
                  <span>🏛️ <strong>hadt@utc.edu.vn</strong> (PGS.TS. Hà - HĐ)</span>
                  <span className="text-[10px] text-purple-400 font-semibold">1-Click</span>
                </button>
              </div>
            </div>

            {/* Custom UTC Email Input */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Hoặc nhập địa chỉ email trường UTC của bạn:
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={ssoEmailInput}
                  onChange={(e) => setSsoEmailInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleGoogleSsoLogin();
                    }
                  }}
                  placeholder="Ví dụ: 201200011@utc.edu.vn"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowSsoModal(false)}
                className="w-1/3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={ssoLoading}
                onClick={() => handleGoogleSsoLogin()}
                className="w-2/3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-lg shadow-blue-600/30"
              >
                {ssoLoading ? 'ĐANG XÁC THỰC...' : '🚀 XÁC THỰC VÀ ĐĂNG NHẬP'}
              </button>
            </div>
          </div>
        </div>
      )}

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
