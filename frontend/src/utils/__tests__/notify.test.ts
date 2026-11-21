import { describe, it, expect, vi } from 'vitest';
import { getErrorMessage, confirmDialog, DIALOG_EVENT } from '../notify';

describe('getErrorMessage', () => {
  it('ưu tiên detail/message từ backend', () => {
    expect(getErrorMessage({ response: { status: 400, data: { detail: 'Đề tài đã tồn tại' } } })).toBe('Đề tài đã tồn tại');
    expect(getErrorMessage({ response: { status: 400, data: { message: 'Sai định dạng' } } })).toBe('Sai định dạng');
  });
  it('lấy lỗi validate dạng field: [msg]', () => {
    expect(getErrorMessage({ response: { status: 400, data: { outline_file: ['File phải là PDF'] } } })).toBe('File phải là PDF');
  });
  it('ẩn trang HTML lỗi và dùng câu theo mã HTTP', () => {
    expect(getErrorMessage({ response: { status: 500, data: '<html>Server Error</html>' } })).toMatch(/Máy chủ/);
    expect(getErrorMessage({ response: { status: 403, data: {} } })).toMatch(/không có quyền/);
  });
  it('lỗi mạng', () => {
    expect(getErrorMessage({ message: 'Network Error' })).toMatch(/kết nối máy chủ/);
  });
  it('fallback', () => {
    expect(getErrorMessage({}, 'Mặc định')).toBe('Mặc định');
  });
});

describe('confirmDialog', () => {
  it('phát sự kiện và resolve theo lựa chọn', async () => {
    const handler = vi.fn((e: Event) => (e as CustomEvent).detail.resolve(true));
    window.addEventListener(DIALOG_EVENT, handler);
    await expect(confirmDialog('Xóa?', { danger: true })).resolves.toBe(true);
    expect((handler.mock.calls[0][0] as CustomEvent).detail).toMatchObject({ kind: 'confirm', message: 'Xóa?', danger: true });
    window.removeEventListener(DIALOG_EVENT, handler);
  });
});
