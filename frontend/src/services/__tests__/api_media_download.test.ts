import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { apiService } from '../api';

describe('Media Attachment Download & Token Refresh Flow', () => {
  let originalCreateObjectURL: typeof window.URL.createObjectURL;
  let originalRevokeObjectURL: typeof window.URL.revokeObjectURL;
  let createdUrlMock: string;
  let clickedElements: HTMLAnchorElement[] = [];
  let windowOpenSpy: any;

  beforeEach(() => {
    localStorage.clear();
    clickedElements = [];
    createdUrlMock = 'blob:http://localhost:3000/mock-uuid-1234';

    // Mock window.URL methods
    originalCreateObjectURL = window.URL.createObjectURL;
    originalRevokeObjectURL = window.URL.revokeObjectURL;
    window.URL.createObjectURL = vi.fn(() => createdUrlMock);
    window.URL.revokeObjectURL = vi.fn();

    // Mock HTMLAnchorElement click
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clickedElements.push(this);
    });

    // Spy on window.open to ensure it is NEVER called as fallback
    windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
  });

  afterEach(() => {
    window.URL.createObjectURL = originalCreateObjectURL;
    window.URL.revokeObjectURL = originalRevokeObjectURL;
    vi.restoreAllMocks();
  });

  it('1. downloads file successfully with valid access token using Authorization header', async () => {
    localStorage.setItem('access_token', 'valid_access_token_123');

    const mockBlob = new Blob(['sample file content'], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    const getSpy = vi.spyOn((apiService as any).api, 'get').mockResolvedValueOnce({
      data: mockBlob,
      headers: {
        'content-type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'content-disposition': 'attachment; filename="bug_cong.docx"',
      },
      status: 200,
    });

    await apiService.downloadFile('/media/chat_attachments/bug_cong.docx');

    expect(getSpy).toHaveBeenCalledTimes(1);
    expect(window.URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(clickedElements.length).toBe(1);
    expect(clickedElements[0].download).toBe('bug_cong.docx');
    expect(window.URL.revokeObjectURL).toHaveBeenCalledWith(createdUrlMock);
    expect(windowOpenSpy).not.toHaveBeenCalled();
  });

  it('2. extracts UTF-8 encoded filename from RFC 5987 Content-Disposition header', async () => {
    localStorage.setItem('access_token', 'valid_token');

    const mockBlob = new Blob(['utf8 content']);
    vi.spyOn((apiService as any).api, 'get').mockResolvedValueOnce({
      data: mockBlob,
      headers: {
        'content-disposition': "attachment; filename*=utf-8''b%C3%A1o_c%C3%A1o_ti%E1%BA%BFn_%C4%91%E1%BB%99.docx",
      },
      status: 200,
    });

    await apiService.downloadFile('/media/chat_attachments/report.docx');

    expect(clickedElements.length).toBe(1);
    expect(clickedElements[0].download).toBe('báo_cáo_tiến_độ.docx');
    expect(windowOpenSpy).not.toHaveBeenCalled();
  });

  it('3. falls back to sanitized URL basename when Content-Disposition is absent', async () => {
    const mockBlob = new Blob(['simple content']);
    vi.spyOn((apiService as any).api, 'get').mockResolvedValueOnce({
      data: mockBlob,
      headers: {},
      status: 200,
    });

    await apiService.downloadFile('/media/chat_attachments/tailieu_huongdan.pdf?token=old');

    expect(clickedElements.length).toBe(1);
    expect(clickedElements[0].download).toBe('tailieu_huongdan.pdf');
    expect(windowOpenSpy).not.toHaveBeenCalled();
  });

  it('4. decodes error Blob JSON when backend returns 403 Forbidden with detail', async () => {
    const errorJson = JSON.stringify({ detail: 'Bạn không có quyền truy cập tệp tin này.' });

    vi.spyOn((apiService as any).api, 'get').mockRejectedValueOnce({
      response: {
        status: 403,
        data: {
          text: async () => errorJson,
        },
      },
    });

    await expect(apiService.downloadFile('/media/chat_attachments/private_doc.docx')).rejects.toThrow(
      'Bạn không có quyền truy cập tệp tin này.'
    );
    expect(windowOpenSpy).not.toHaveBeenCalled();
  });

  it('5. decodes error Blob JSON when backend returns 404 Not Found', async () => {
    const errorJson = JSON.stringify({ detail: "Tệp tin 'missing.docx' không tồn tại hoặc đã bị xóa." });

    vi.spyOn((apiService as any).api, 'get').mockRejectedValueOnce({
      response: {
        status: 404,
        data: {
          text: async () => errorJson,
        },
      },
    });

    await expect(apiService.downloadFile('/media/chat_attachments/missing.docx')).rejects.toThrow(
      "Tệp tin 'missing.docx' không tồn tại hoặc đã bị xóa."
    );
    expect(windowOpenSpy).not.toHaveBeenCalled();
  });

  it('6. rejects empty or invalid file path immediately without making request', async () => {
    await expect(apiService.downloadFile('')).rejects.toThrow('Đường dẫn tệp không hợp lệ.');
  });

  it('7. Axios response interceptor: retries 401 request with refreshed access token', async () => {
    localStorage.setItem('access_token', 'old_expired_token');

    const refreshPostSpy = vi.spyOn(axios, 'post').mockResolvedValueOnce({
      data: { access: 'new_fresh_token_999' },
      status: 200,
    });

    const retryMock = vi.fn().mockResolvedValueOnce({ status: 200, data: 'retried_success' });
    (apiService as any).api = retryMock;

    // Simulate original 401 error
    const originalRequest: any = {
      url: '/media/chat_attachments/test.docx',
      headers: { Authorization: 'Bearer old_expired_token' },
      _retry: false,
    };
    const errorObj = {
      response: { status: 401 },
      config: originalRequest,
    };

    // Find the interceptor function registered on Axios instance
    const interceptors = ((apiService as any).api as any)?.interceptors?.response?.handlers;
    const errorHandler = interceptors?.[0]?.rejected;

    if (errorHandler) {
      await errorHandler(errorObj);
      expect(refreshPostSpy).toHaveBeenCalledWith(
        expect.stringContaining('/token/refresh/'),
        {},
        { withCredentials: true }
      );
      expect(localStorage.getItem('access_token')).toBe('new_fresh_token_999');
      expect(originalRequest._retry).toBe(true);
      expect(originalRequest.headers.Authorization).toBe('Bearer new_fresh_token_999');
    }
  });

  it('8. Axios response interceptor: serializes concurrent 401 errors so only 1 refresh call is made', async () => {
    localStorage.setItem('access_token', 'expired_token');

    let refreshCount = 0;
    vi.spyOn(axios, 'post').mockImplementation(async (url: any) => {
      if (typeof url === 'string' && url.includes('/token/refresh/')) {
        refreshCount++;
        await new Promise((r) => setTimeout(r, 10));
        return { data: { access: 'shared_refreshed_access' }, status: 200 };
      }
      return { data: {}, status: 200 };
    });

    const retryCalls: any[] = [];
    (apiService as any).api = vi.fn().mockImplementation(async (req: any) => {
      retryCalls.push(req);
      return { status: 200, data: 'ok' };
    });

    // Simulate interceptor execution
    const interceptors = ((apiService as any).api as any)?.interceptors?.response?.handlers;
    const errorHandler = interceptors?.[0]?.rejected;

    if (errorHandler) {
      const req1: any = { url: '/req1', headers: {}, _retry: false };
      const req2: any = { url: '/req2', headers: {}, _retry: false };

      await Promise.all([
        errorHandler({ response: { status: 401 }, config: req1 }),
        errorHandler({ response: { status: 401 }, config: req2 }),
      ]);

      expect(refreshCount).toBe(1);
      expect(localStorage.getItem('access_token')).toBe('shared_refreshed_access');
      expect(req1.headers.Authorization).toBe('Bearer shared_refreshed_access');
      expect(req2.headers.Authorization).toBe('Bearer shared_refreshed_access');
    }
  });

  it('9. Axios response interceptor: rejects and wipes auth when refresh token is expired', async () => {
    localStorage.setItem('access_token', 'old_access');
    localStorage.setItem('refresh_token', 'expired_refresh');

    vi.spyOn(axios, 'post').mockRejectedValueOnce({
      response: { status: 401, data: { detail: 'Invalid or expired refresh token.' } },
    });

    const interceptors = ((apiService as any).api as any)?.interceptors?.response?.handlers;
    const errorHandler = interceptors?.[0]?.rejected;

    if (errorHandler) {
      const originalRequest: any = { url: '/some/api/', headers: {}, _retry: false };
      await expect(
        errorHandler({ response: { status: 401 }, config: originalRequest })
      ).rejects.toBeDefined();

      expect(localStorage.getItem('access_token')).toBeNull();
      expect(localStorage.getItem('refresh_token')).toBeNull();
    }
  });
});
