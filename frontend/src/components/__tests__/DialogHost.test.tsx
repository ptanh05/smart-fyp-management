import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, act, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import DialogHost from '../DialogHost';
import { confirmDialog, promptDialog } from '../../utils/notify';

/** Mở dialog và trả về promise kết quả + hàm đọc trạng thái. */
const open = async <T,>(fn: () => Promise<T>) => {
  let settled = false;
  let result: T | undefined;
  let p!: Promise<T>;
  act(() => {
    p = fn();
    p.then((r) => {
      settled = true;
      result = r;
    });
  });
  await screen.findByRole('alertdialog');
  // chờ focus ban đầu (setTimeout 0)
  await act(async () => {
    await new Promise((r) => setTimeout(r, 5));
  });
  return { p, state: () => ({ settled, result }) };
};

const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 5)); });

afterEach(() => cleanup());

describe('DialogHost — regression R-01: Enter theo phần tử đang focus', () => {
  it('Enter khi focus ở nút "Hủy" phải HỦY, không được xác nhận', async () => {
    const user = userEvent.setup();
    render(<DialogHost />);
    const d = await open(() => confirmDialog('Xóa vĩnh viễn?', { danger: true, confirmText: 'Xóa' }));

    screen.getByRole('button', { name: 'Hủy' }).focus();
    await user.keyboard('{Enter}');
    await flush();

    expect(d.state()).toEqual({ settled: true, result: false });
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('Enter khi focus ở nút xác nhận -> xác nhận (đúng một lần)', async () => {
    const user = userEvent.setup();
    render(<DialogHost />);
    const second = vi.fn();
    const d = await open(() => confirmDialog('Xác nhận?'));
    // dialog thứ 2 trong hàng đợi: không được bị xác nhận "lây" do Enter
    act(() => { confirmDialog('Dialog kế tiếp').then(second); });

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Xác nhận' }));
    await user.keyboard('{Enter}');
    await flush();

    expect(d.state()).toEqual({ settled: true, result: true });
    expect(second).not.toHaveBeenCalled();
    expect(screen.getByText('Dialog kế tiếp')).toBeInTheDocument();
  });

  it('Enter khi focus không ở nút nào (ví dụ hộp dialog) -> không tự xác nhận', async () => {
    const user = userEvent.setup();
    render(<DialogHost />);
    const d = await open(() => confirmDialog('Xóa?', { danger: true }));
    (screen.getByRole('alertdialog') as HTMLElement).focus();
    await user.keyboard('{Enter}');
    await flush();
    expect(d.state().settled).toBe(false);
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('Space trên nút "Hủy" -> hủy (hành vi nút mặc định vẫn hoạt động)', async () => {
    const user = userEvent.setup();
    render(<DialogHost />);
    const d = await open(() => confirmDialog('Xóa?', { danger: true }));
    screen.getByRole('button', { name: 'Hủy' }).focus();
    await user.keyboard(' ');
    await flush();
    expect(d.state()).toEqual({ settled: true, result: false });
  });
});

describe('DialogHost — regression R-03: Escape ổn định', () => {
  it('Escape vẫn đóng dialog khi focus đã rơi ra body (sau khi click vào phần chữ)', async () => {
    const user = userEvent.setup();
    render(<DialogHost />);
    const d = await open(() => confirmDialog('Click vào chữ rồi Esc'));
    (document.activeElement as HTMLElement).blur();
    expect(document.activeElement).toBe(document.body);

    await user.keyboard('{Escape}');
    await flush();
    expect(d.state()).toEqual({ settled: true, result: false });
  });

  it('Click vào phần chữ giữ focus trong dialog (hộp có tabIndex=-1)', async () => {
    render(<DialogHost />);
    await open(() => confirmDialog('Nội dung'));
    expect(screen.getByRole('alertdialog')).toHaveAttribute('tabindex', '-1');
  });

  it('Escape không lan xuống modal bên dưới (listener window pha bubble như useModalGuard)', async () => {
    const user = userEvent.setup();
    const underlyingModalEsc = vi.fn();
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') underlyingModalEsc(); };
    window.addEventListener('keydown', handler);
    try {
      render(<DialogHost />);
      const d = await open(() => confirmDialog('Trên modal khác'));
      await user.keyboard('{Escape}');
      await flush();
      expect(d.state()).toEqual({ settled: true, result: false });
      expect(underlyingModalEsc).not.toHaveBeenCalled();
      // Sau khi dialog đóng, Esc lại thuộc về modal bên dưới
      await user.keyboard('{Escape}');
      expect(underlyingModalEsc).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener('keydown', handler);
    }
  });

  it('Tab khi focus ở ngoài dialog -> đưa focus vào lại dialog', async () => {
    const user = userEvent.setup();
    render(<DialogHost />);
    await open(() => confirmDialog('Tab?'));
    (document.activeElement as HTMLElement).blur();
    await user.keyboard('{Tab}');
    expect(screen.getByRole('alertdialog').contains(document.activeElement)).toBe(true);
  });

  it('Tab / Shift+Tab xoay vòng trong dialog', async () => {
    const user = userEvent.setup();
    render(<DialogHost />);
    await open(() => confirmDialog('Tab?'));
    const cancel = screen.getByRole('button', { name: 'Hủy' });
    const ok = screen.getByRole('button', { name: 'Xác nhận' });
    expect(document.activeElement).toBe(ok);
    await user.keyboard('{Tab}');
    expect(document.activeElement).toBe(cancel);
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(document.activeElement).toBe(ok);
  });
});

describe('DialogHost — prompt: phím trong textarea', () => {
  it('Enter trong textarea xuống dòng, Ctrl+Enter gửi (đã trim); rỗng thì không gửi', async () => {
    const user = userEvent.setup();
    render(<DialogHost />);
    const d = await open(() => promptDialog('Lý do?', { required: true }));
    const ta = screen.getByRole('textbox');
    expect(document.activeElement).toBe(ta);

    await user.keyboard('{Control>}{Enter}{/Control}');
    expect(d.state().settled).toBe(false); // rỗng -> bị chặn

    await user.type(ta, 'Dòng 1{Enter}Dòng 2');
    expect(d.state().settled).toBe(false);
    expect((ta as HTMLTextAreaElement).value).toBe('Dòng 1\nDòng 2');

    await user.keyboard('{Control>}{Enter}{/Control}');
    await flush();
    expect(d.state()).toEqual({ settled: true, result: 'Dòng 1\nDòng 2' });
  });

  it('Escape trong textarea -> hủy prompt (null)', async () => {
    const user = userEvent.setup();
    render(<DialogHost />);
    const d = await open(() => promptDialog('Lý do?'));
    await user.type(screen.getByRole('textbox'), 'abc');
    await user.keyboard('{Escape}');
    await flush();
    expect(d.state()).toEqual({ settled: true, result: null });
  });
});

describe('DialogHost — focus', () => {
  it('Trả focus về phần tử trước đó khi đóng', async () => {
    const user = userEvent.setup();
    const btn = document.createElement('button');
    btn.textContent = 'Nút mở dialog';
    document.body.appendChild(btn);
    btn.focus();
    render(<DialogHost />);
    await open(() => confirmDialog('Focus?'));
    await user.keyboard('{Escape}');
    await waitFor(() => expect(document.activeElement).toBe(btn));
    btn.remove();
  });
});

describe('Toast — regression R-02: giữ xuống dòng', () => {
  it('.toast-message có white-space: pre-line và cho phép ngắt chuỗi dài', () => {
    const css = readFileSync(resolve(__dirname, '../Toast.css'), 'utf-8');
    const block = css.match(/\.toast-message\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(block).toMatch(/white-space:\s*pre-line/);
    expect(block).toMatch(/overflow-wrap:\s*anywhere/);
  });
});
