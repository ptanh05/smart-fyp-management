import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './CookieConsent.css';

/** Khóa localStorage lưu lựa chọn; tăng CONSENT_VERSION khi chính sách cookie thay đổi để hỏi lại. */
export const CONSENT_STORAGE_KEY = 'pms-cookie-consent';
export const CONSENT_VERSION = 1;

const hasConsented = (): boolean => {
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return false;
    return JSON.parse(raw)?.version === CONSENT_VERSION;
  } catch {
    return false;
  }
};

/**
 * Banner thông báo cookie, hiện ở mọi trang (kể cả trang đăng nhập) cho tới khi người dùng đồng ý.
 * Hệ thống chỉ dùng cookie/bộ nhớ cần thiết (phiên đăng nhập, giao diện, ngôn ngữ) nên chỉ có nút "Đồng ý".
 */
const CookieConsent: React.FC = () => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(() => !hasConsented());
  const [showDetails, setShowDetails] = useState(false);

  if (!visible) return null;

  const accept = () => {
    try {
      window.localStorage.setItem(
        CONSENT_STORAGE_KEY,
        JSON.stringify({ version: CONSENT_VERSION, acceptedAt: new Date().toISOString() })
      );
    } catch {
      // Trình duyệt chặn localStorage (chế độ riêng tư...): vẫn ẩn banner trong phiên hiện tại.
    }
    setVisible(false);
  };

  return (
    <section
      className="cookie-consent"
      role="region"
      aria-label={t('cookie.ariaLabel', 'Thông báo sử dụng cookie')}
      aria-live="polite"
    >
      <div className="cookie-consent-body">
        <h2 className="cookie-consent-title">🍪 {t('cookie.title', 'Website sử dụng cookie')}</h2>
        <p className="cookie-consent-text">
          {t(
            'cookie.message',
            'Hệ thống chỉ sử dụng cookie và bộ nhớ trình duyệt cần thiết để duy trì đăng nhập an toàn và ghi nhớ tùy chọn giao diện, ngôn ngữ của bạn. Chúng tôi không dùng cookie quảng cáo hay theo dõi.'
          )}
        </p>
        {showDetails && (
          <ul id="cookie-consent-details" className="cookie-consent-details">
            <li>
              <strong>{t('cookie.sessionName', 'Cookie đăng nhập (HttpOnly)')}</strong>
              {': '}
              {t('cookie.sessionDesc', 'giữ phiên làm việc an toàn, không thể đọc được từ JavaScript.')}
            </li>
            <li>
              <strong>{t('cookie.storageName', 'Bộ nhớ trình duyệt (localStorage)')}</strong>
              {': '}
              {t('cookie.storageDesc', 'lưu thông tin phiên, chế độ sáng/tối và ngôn ngữ hiển thị.')}
            </li>
          </ul>
        )}
      </div>
      <div className="cookie-consent-actions">
        <button
          type="button"
          className="cookie-consent-btn cookie-consent-btn-link"
          aria-expanded={showDetails}
          aria-controls="cookie-consent-details"
          onClick={() => setShowDetails((s) => !s)}
        >
          {showDetails ? t('cookie.hideDetails', 'Ẩn chi tiết') : t('cookie.showDetails', 'Xem chi tiết')}
        </button>
        <button type="button" className="cookie-consent-btn cookie-consent-btn-primary" onClick={accept}>
          {t('cookie.accept', 'Đồng ý')}
        </button>
      </div>
    </section>
  );
};

export default CookieConsent;
