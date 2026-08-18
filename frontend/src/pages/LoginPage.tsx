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
      setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h1 style={{ margin: 0, fontSize: '1.5rem' }}>{t('login.title', 'Project Management System')}</h1>
          <button
            onClick={toggleLanguage}
            className="btn"
            style={{
              padding: '6px 12px',
              fontSize: '0.85rem',
              fontWeight: 600,
              backgroundColor: '#f1f5f9',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            {i18n.language.startsWith('vi') ? '🇻🇳 Tiếng Việt' : '🇬🇧 English'}
          </button>
        </div>
        
        <h2>{t('login.selectRole', 'Select Your Role')}</h2>
        
        <div className="user-type-selector">
          <button
            className={`type-btn ${userType === 'student' ? 'active' : ''}`}
            onClick={() => setUserType('student')}
          >
            {t('roles.student', 'Student')}
          </button>
          <button
            className={`type-btn ${userType === 'supervisor' ? 'active' : ''}`}
            onClick={() => setUserType('supervisor')}
          >
            {t('roles.supervisor', 'Supervisor')}
          </button>
          <button
            className={`type-btn ${userType === 'committee_member' ? 'active' : ''}`}
            onClick={() => setUserType('committee_member')}
          >
            {t('roles.committee_member', 'Committee')}
          </button>
          <button
            className={`type-btn ${userType === 'external_examiner' ? 'active' : ''}`}
            onClick={() => setUserType('external_examiner')}
          >
            {t('roles.external_examiner', 'External')}
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {userType === 'student' ? (
            <div className="form-group">
              <label htmlFor="registrationNo">{t('login.username', 'Registration Number')}</label>
              <input
                id="registrationNo"
                type="text"
                value={registrationNo}
                onChange={(e) => setRegistrationNo(e.target.value)}
                required
                placeholder={t('login.usernamePlaceholder', 'Enter registration number')}
              />
            </div>
          ) : (
            <div className="form-group">
              <label htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Enter email"
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="password">{t('login.password', 'Password')}</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder={t('login.passwordPlaceholder', 'Enter password')}
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="btn btn-primary login-btn" disabled={loading}>
            {loading ? t('login.loggingIn', 'Logging in...') : t('login.submit', 'Sign In')}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
