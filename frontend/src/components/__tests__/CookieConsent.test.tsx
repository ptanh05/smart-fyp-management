import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '../../i18n';
import CookieConsent, { CONSENT_STORAGE_KEY, CONSENT_VERSION } from '../CookieConsent';

describe('CookieConsent', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('vi');
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('hiện banner khi người dùng chưa đồng ý', () => {
    render(<CookieConsent />);
    expect(screen.getByRole('region', { name: 'Thông báo sử dụng cookie' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Đồng ý' })).toBeInTheDocument();
  });

  it('bấm "Đồng ý" -> ẩn banner và lưu lựa chọn', async () => {
    const user = userEvent.setup();
    render(<CookieConsent />);
    await user.click(screen.getByRole('button', { name: 'Đồng ý' }));

    expect(screen.queryByRole('region')).toBeNull();
    const saved = JSON.parse(localStorage.getItem(CONSENT_STORAGE_KEY) || '{}');
    expect(saved.version).toBe(CONSENT_VERSION);
    expect(typeof saved.acceptedAt).toBe('string');
  });

  it('không hiện lại khi đã đồng ý trước đó (tải lại trang)', () => {
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify({ version: CONSENT_VERSION }));
    render(<CookieConsent />);
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('hỏi lại khi phiên bản chính sách thay đổi hoặc dữ liệu lưu bị hỏng', () => {
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify({ version: CONSENT_VERSION - 1 }));
    const { unmount } = render(<CookieConsent />);
    expect(screen.getByRole('region')).toBeInTheDocument();
    unmount();

    localStorage.setItem(CONSENT_STORAGE_KEY, '{không phải JSON');
    render(<CookieConsent />);
    expect(screen.getByRole('region')).toBeInTheDocument();
  });

  it('"Xem chi tiết" mở/đóng danh sách cookie, có aria-expanded', async () => {
    const user = userEvent.setup();
    render(<CookieConsent />);
    const toggle = screen.getByRole('button', { name: 'Xem chi tiết' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Cookie đăng nhập (HttpOnly)')).toBeNull();

    await user.click(toggle);
    expect(screen.getByRole('button', { name: 'Ẩn chi tiết' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Cookie đăng nhập (HttpOnly)')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Ẩn chi tiết' }));
    expect(screen.queryByText('Cookie đăng nhập (HttpOnly)')).toBeNull();
  });

  it('localStorage bị chặn -> không crash, vẫn hiện và vẫn ẩn được', async () => {
    const user = userEvent.setup();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    render(<CookieConsent />);
    await user.click(screen.getByRole('button', { name: 'Đồng ý' }));
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('hiển thị tiếng Anh khi đổi ngôn ngữ', async () => {
    await i18n.changeLanguage('en');
    render(<CookieConsent />);
    expect(screen.getByRole('region', { name: 'Cookie notice' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument();
  });
});
