import React, { useEffect, useRef, useState } from 'react';
import { DIALOG_EVENT, type DialogRequest } from '../utils/notify';
import './DialogHost.css';

/**
 * Hộp thoại xác nhận/nhập liệu dùng chung, mount 1 lần ở App.
 * Bàn phím: Esc hủy; Enter kích hoạt nút đang focus; Ctrl/Cmd+Enter gửi ô nhập;
 * Tab/Shift+Tab giữ focus trong hộp thoại. Theo dark mode.
 */
const DialogHost: React.FC = () => {
  const [queue, setQueue] = useState<DialogRequest[]>([]);
  const [value, setValue] = useState('');
  const current = queue[0];
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const req = (e as CustomEvent<DialogRequest>).detail;
      if (req) setQueue((q) => [...q, req]);
    };
    window.addEventListener(DIALOG_EVENT, handler);
    return () => window.removeEventListener(DIALOG_EVENT, handler);
  }, []);

  useEffect(() => {
    if (!current) return;
    setValue(current.defaultValue ?? '');
    const prevFocus = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => (current.kind === 'prompt' ? inputRef.current : confirmRef.current)?.focus(), 0);
    return () => {
      clearTimeout(t);
      prevFocus?.focus?.();
    };
  }, [current]);

  const isPrompt = current?.kind === 'prompt';
  const canConfirm = !!current && (!isPrompt || !current.required || value.trim().length > 0);

  const close = (result: any) => {
    if (!current) return;
    current.resolve(result);
    setQueue((q) => q.slice(1));
  };
  const onCancel = () => close(isPrompt ? null : false);
  const onConfirm = () => {
    if (!canConfirm) return;
    close(isPrompt ? value.trim() : true);
  };

  // Luôn trỏ tới handler mới nhất để listener toàn cục không đọc state cũ.
  const handlersRef = useRef({ onCancel, onConfirm, isPrompt });
  handlersRef.current = { onCancel, onConfirm, isPrompt };

  /**
   * Bàn phím được xử lý ở window (pha capture) thay vì trên overlay:
   * - Hoạt động kể cả khi focus rơi khỏi nút (ví dụ click vào phần chữ).
   * - Chặn Esc lan xuống modal bên dưới (useModalGuard nghe ở window, pha bubble).
   */
  useEffect(() => {
    if (!current) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const box = boxRef.current;
      if (!box) return;
      const target = e.target as HTMLElement | null;
      const { onCancel, onConfirm, isPrompt } = handlersRef.current;

      if (e.key === 'Escape' || e.key === 'Esc') {
        e.preventDefault();
        e.stopImmediatePropagation();
        onCancel();
        return;
      }

      if (e.key === 'Enter') {
        // Enter trên một nút: để trình duyệt kích hoạt CHÍNH nút đang focus
        // (Hủy -> hủy, Xác nhận -> xác nhận). Không ghi đè hành vi mặc định.
        if (target?.tagName === 'BUTTON' && box.contains(target)) return;
        // Ô nhập nhiều dòng: Enter xuống dòng, Ctrl/Cmd+Enter để gửi.
        if (isPrompt && target?.tagName === 'TEXTAREA' && box.contains(target)) {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            onConfirm();
          }
          return;
        }
        // Focus không nằm trên phần tử tương tác nào: không tự xác nhận.
        e.preventDefault();
        return;
      }

      if (e.key === 'Tab') {
        const focusables = Array.from(
          box.querySelectorAll<HTMLElement>('button:not([disabled]), textarea')
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;
        const inside = !!active && box.contains(active) && active !== box;
        if (!inside) {
          e.preventDefault();
          (e.shiftKey ? last : first).focus();
        } else if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [current]);

  if (!current) return null;

  const title = current.title ?? (isPrompt ? 'Nhập thông tin' : current.danger ? 'Xác nhận thao tác' : 'Xác nhận');

  return (
    <div className="app-dialog-overlay" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div
        ref={boxRef}
        tabIndex={-1}
        className="app-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="app-dialog-title"
        aria-describedby="app-dialog-message"
      >
        <h3 id="app-dialog-title" className="app-dialog-title">
          {current.danger ? '⚠️ ' : ''}
          {title}
        </h3>
        <p id="app-dialog-message" className="app-dialog-message">
          {current.message}
        </p>
        {isPrompt && (
          <textarea
            ref={inputRef}
            className="app-dialog-input"
            rows={3}
            value={value}
            placeholder={current.placeholder}
            onChange={(e) => setValue(e.target.value)}
          />
        )}
        <div className="app-dialog-actions">
          <button type="button" className="app-dialog-btn app-dialog-btn-cancel" onClick={onCancel}>
            {current.cancelText ?? 'Hủy'}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={`app-dialog-btn ${current.danger ? 'app-dialog-btn-danger' : 'app-dialog-btn-primary'}`}
            onClick={onConfirm}
            disabled={!canConfirm}
          >
            {current.confirmText ?? 'Xác nhận'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DialogHost;
