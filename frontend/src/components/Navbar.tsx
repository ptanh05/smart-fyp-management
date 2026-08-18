import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Student, Supervisor, CommitteeMember } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import ChangePasswordModal from './ChangePasswordModal';
import NotificationDropdown from './NotificationDropdown';
import './Navbar.css';

interface NavbarProps {
  user: Student | Supervisor | CommitteeMember | null;
  onLogout: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ user, onLogout }) => {
  const { t, i18n } = useTranslation();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { toggleTheme, isDark } = useTheme();
  const navigate = useNavigate();

  const toggleLanguage = () => {
    const nextLng = i18n.language.startsWith('vi') ? 'en' : 'vi';
    i18n.changeLanguage(nextLng);
  };

  const handleNotificationNavigate = (url: string) => {
    // Parse the URL and navigate with query params
    const [path, queryString] = url.split('?');
    if (queryString) {
      navigate(`${path}?${queryString}`);
    } else {
      navigate(path);
    }
    setMobileMenuOpen(false);
  };

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const navbar = document.querySelector('.navbar');
      if (navbar && !navbar.contains(event.target as Node)) {
        setMobileMenuOpen(false);
      }
    };

    if (mobileMenuOpen) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [mobileMenuOpen]);

  // Close mobile menu on window resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) {
        setMobileMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getUserTypeLabel = (userType: string) => {
    switch (userType) {
      case 'student':
        return 'Student';
      case 'supervisor':
        return 'Supervisor';
      case 'committee_member':
        return 'Committee';
      default:
        return userType;
    }
  };

  // Early return AFTER all hooks have been called
  if (!user || !user.user) {
    return (
      <nav className="navbar">
        <div className="navbar-content">
          <div className="navbar-brand">
            <span className="navbar-brand-full">Project Management System</span>
            <span className="navbar-brand-short">PMS</span>
          </div>
          <div className="navbar-actions navbar-desktop">
            <span className="user-info">Loading...</span>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <>
      <nav className="navbar">
        <div className="navbar-content">
          <div className="navbar-brand">
            <span className="navbar-brand-full">Project Management System</span>
            <span className="navbar-brand-short">PMS</span>
          </div>

          {/* Mobile hamburger button */}
          <button
            className="navbar-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation"
          >
            <span className={`hamburger ${mobileMenuOpen ? 'open' : ''}`}>
              <span></span>
              <span></span>
              <span></span>
            </span>
          </button>

          {/* Desktop actions */}
          <div className="navbar-actions navbar-desktop">
            <NotificationDropdown onNavigate={handleNotificationNavigate} />
            <span className="user-info">
              {user.user.username} ({t(`roles.${user.user.user_type}`, { defaultValue: getUserTypeLabel(user.user.user_type) })})
            </span>
            <button
              className="btn btn-lang-toggle"
              onClick={toggleLanguage}
              title="Switch Language"
              style={{ padding: '6px 12px', fontWeight: 600, fontSize: '0.85rem' }}
            >
              {i18n.language.startsWith('vi') ? '🇻🇳 VI' : '🇬🇧 EN'}
            </button>
            <button
              className="btn btn-theme-toggle"
              onClick={toggleTheme}
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDark ? '☀️' : '🌙'}
            </button>
            <button
              className="btn btn-outline"
              onClick={() => setShowChangePassword(true)}
              title="Change Password"
            >
              Change Password
            </button>
            <button className="btn btn-secondary" onClick={onLogout}>
              {t('nav.logout', 'Sign Out')}
            </button>
          </div>

          {/* Mobile menu */}
          <div className={`navbar-mobile-menu ${mobileMenuOpen ? 'open' : ''}`}>
            <div className="mobile-user-info">
              <div className="mobile-user-avatar">
                {user.user.username.charAt(0).toUpperCase()}
              </div>
              <div className="mobile-user-details">
                <span className="mobile-user-name">{user.user.username}</span>
                <span className="mobile-user-type">{getUserTypeLabel(user.user.user_type)}</span>
              </div>
            </div>
            <div className="mobile-menu-divider"></div>
            <div className="mobile-menu-item">
              <NotificationDropdown onNavigate={handleNotificationNavigate} />
            </div>
            <button
              className="mobile-menu-item mobile-menu-button"
              onClick={() => {
                toggleTheme();
              }}
            >
              {isDark ? '☀️ Light Mode' : '🌙 Dark Mode'}
            </button>
            <button
              className="mobile-menu-item mobile-menu-button"
              onClick={() => {
                setShowChangePassword(true);
                setMobileMenuOpen(false);
              }}
            >
              🔑 Change Password
            </button>
            <div className="mobile-menu-divider"></div>
            <button
              className="mobile-menu-item mobile-menu-button logout"
              onClick={() => {
                onLogout();
                setMobileMenuOpen(false);
              }}
            >
              🚪 Logout
            </button>
          </div>
        </div>

        {/* Overlay for mobile menu */}
        {mobileMenuOpen && (
          <div className="navbar-overlay" onClick={() => setMobileMenuOpen(false)} />
        )}
      </nav>

      <ChangePasswordModal
        isOpen={showChangePassword}
        onClose={() => setShowChangePassword(false)}
      />
    </>
  );
};

export default Navbar;
