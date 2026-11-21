import { triggerGlobalToast, type ToastType } from '../contexts/ToastContext';

/**
 * Thông báo không chặn màn hình (thay cho window.alert).
 * Dùng được ở mọi nơi, kể cả ngoài React component.
 */
const show = (type: ToastType, defaultDuration: number) => (message: string, duration?: number) =>
  triggerGlobalToast(message, type, duration ?? defaultDuration);

export const notify = {
  success: show('success', 3500),
  info: show('info', 4000),
  warning: show('warning', 5500),
  error: show('error', 6500),
};

const STATUS_MESSAGES: Record<number, string> = {
  400: 'Dữ liệu gửi lên không hợp lệ.',
  401: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.',
  403: 'Bạn không có quyền thực hiện thao tác này.',
  404: 'Không tìm thấy dữ liệu yêu cầu.',
  409: 'Dữ liệu đã bị thay đổi bởi người khác, vui lòng tải lại.',
  413: 'File tải lên quá lớn.',
  429: 'Bạn thao tác quá nhanh, vui lòng thử lại sau giây lát.',
  500: 'Máy chủ đang gặp sự cố, vui lòng thử lại sau.',
  502: 'Máy chủ tạm thời không phản hồi, vui lòng thử lại sau.',
  503: 'Hệ thống đang bảo trì, vui lòng thử lại sau.',
  504: 'Máy chủ phản hồi quá lâu, vui lòng thử lại sau.',
};

const firstString = (v: unknown): string | undefined => {
  if (typeof v === 'string' && v.trim()) return v;
  if (Array.isArray(v)) return firstString(v[0]);
  if (v && typeof v === 'object') {
    for (const val of Object.values(v as Record<string, unknown>)) {
      const s = firstString(val);
      if (s) return s;
    }
  }
  return undefined;
};

/**
 * Chuyển lỗi (axios / Error) thành câu tiếng Việt dễ hiểu cho người dùng.
 * Ưu tiên thông điệp nghiệp vụ backend trả về; ẩn lỗi kỹ thuật thô.
 */
export const getErrorMessage = (err: any, fallback = 'Đã có lỗi xảy ra, vui lòng thử lại.'): string => {
  if (!err) return fallback;
  if (typeof err === 'string') return err;

  const data = err.response?.data;
  const status: number | undefined = err.response?.status;

  if (data && typeof data === 'object' && !(data instanceof Blob)) {
    const msg = firstString(data.detail) || firstString(data.message) || firstString(data.error) || firstString(data);
    // Bỏ qua trang HTML lỗi của server
    if (msg && !msg.trim().startsWith('<')) return msg;
  } else if (typeof data === 'string' && data.trim() && !data.trim().startsWith('<') && data.length < 300) {
    return data;
  }

  if (status && STATUS_MESSAGES[status]) return STATUS_MESSAGES[status];
  if (status && status >= 500) return STATUS_MESSAGES[500];

  if (err.code === 'ECONNABORTED') return 'Kết nối quá thời gian chờ, vui lòng thử lại.';
  if (err.message === 'Network Error' || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    return 'Không thể kết nối máy chủ. Vui lòng kiểm tra Internet.';
  }
  return fallback;
};

/** Hiện toast lỗi với tiền tố ngữ cảnh, ví dụ: notifyError('Lỗi lưu đề tài', err) */
export const notifyError = (context: string, err?: any) => {
  if (err === undefined) {
    notify.error(context);
    return;
  }
  notify.error(`${context}: ${getErrorMessage(err)}`);
};

/* ------------------------------------------------------------------ */
/* Hộp thoại xác nhận / nhập liệu (thay cho window.confirm / prompt)   */
/* ------------------------------------------------------------------ */

export interface DialogOptions {
  title?: string;
  confirmText?: string;
  cancelText?: string;
  /** Nút xác nhận màu đỏ cho thao tác nguy hiểm (xóa, khóa...) */
  danger?: boolean;
  /** Chỉ dùng cho promptDialog */
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
}

export interface DialogRequest extends DialogOptions {
  kind: 'confirm' | 'prompt';
  message: string;
  resolve: (value: any) => void;
}

export const DIALOG_EVENT = 'app:dialog';

const openDialog = <T,>(req: Omit<DialogRequest, 'resolve'>): Promise<T> =>
  new Promise<T>((resolve) => {
    window.dispatchEvent(new CustomEvent<DialogRequest>(DIALOG_EVENT, { detail: { ...req, resolve } }));
  });

/** Trả về true nếu người dùng xác nhận. */
export const confirmDialog = (message: string, options: DialogOptions = {}): Promise<boolean> =>
  openDialog<boolean>({ kind: 'confirm', message, ...options });

/** Trả về chuỗi người dùng nhập, hoặc null nếu hủy. */
export const promptDialog = (message: string, options: DialogOptions = {}): Promise<string | null> =>
  openDialog<string | null>({ kind: 'prompt', message, ...options });
