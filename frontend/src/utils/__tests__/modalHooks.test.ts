import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useModalGuard } from '../modalHooks';

describe('useModalGuard', () => {
  let onCloseMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onCloseMock = vi.fn();
    vi.spyOn(window, 'confirm');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('closes immediately on Escape key when form is not dirty', () => {
    renderHook(() =>
      useModalGuard({
        isOpen: true,
        onClose: onCloseMock,
        isDirty: false,
      })
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(onCloseMock).toHaveBeenCalledTimes(1);
    expect(window.confirm).not.toHaveBeenCalled();
  });

  it('prompts user when form is dirty on Escape key, and closes if confirmed', () => {
    vi.mocked(window.confirm).mockReturnValue(true);

    renderHook(() =>
      useModalGuard({
        isOpen: true,
        onClose: onCloseMock,
        isDirty: true,
        confirmMessage: 'Warning: unsaved data',
      })
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(window.confirm).toHaveBeenCalledWith('Warning: unsaved data');
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it('does NOT close when form is dirty on Escape key if user cancels confirmation', () => {
    vi.mocked(window.confirm).mockReturnValue(false);

    renderHook(() =>
      useModalGuard({
        isOpen: true,
        onClose: onCloseMock,
        isDirty: true,
      })
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(window.confirm).toHaveBeenCalled();
    expect(onCloseMock).not.toHaveBeenCalled();
  });

  it('does not trigger onClose on Escape when modal is not open', () => {
    renderHook(() =>
      useModalGuard({
        isOpen: false,
        onClose: onCloseMock,
        isDirty: false,
      })
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(onCloseMock).not.toHaveBeenCalled();
  });

  it('does not trigger onClose on Escape when enableEscape is false', () => {
    renderHook(() =>
      useModalGuard({
        isOpen: true,
        onClose: onCloseMock,
        enableEscape: false,
      })
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(onCloseMock).not.toHaveBeenCalled();
  });

  it('requestClose() respects dirty state', () => {
    vi.mocked(window.confirm).mockReturnValue(false);

    const { result } = renderHook(() =>
      useModalGuard({
        isOpen: true,
        onClose: onCloseMock,
        isDirty: true,
      })
    );

    act(() => {
      const closed = result.current.requestClose();
      expect(closed).toBe(false);
    });

    expect(onCloseMock).not.toHaveBeenCalled();

    vi.mocked(window.confirm).mockReturnValue(true);
    act(() => {
      const closed = result.current.requestClose();
      expect(closed).toBe(true);
    });

    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it('handleOverlayClick only closes when target equals currentTarget', () => {
    const { result } = renderHook(() =>
      useModalGuard({
        isOpen: true,
        onClose: onCloseMock,
        isDirty: false,
      })
    );

    const outerEl = document.createElement('div');
    const innerEl = document.createElement('div');
    outerEl.appendChild(innerEl);

    // Clicking child innerEl (stopPropagation simulated)
    act(() => {
      result.current.handleOverlayClick({
        target: innerEl,
        currentTarget: outerEl,
        preventDefault: vi.fn(),
      } as any);
    });
    expect(onCloseMock).not.toHaveBeenCalled();

    // Clicking outer overlay directly
    act(() => {
      result.current.handleOverlayClick({
        target: outerEl,
        currentTarget: outerEl,
        preventDefault: vi.fn(),
      } as any);
    });
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });
});
