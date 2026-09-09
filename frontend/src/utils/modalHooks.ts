import { useEffect, useCallback } from 'react';

interface UseModalGuardOptions {
  isOpen: boolean;
  onClose: () => void;
  isDirty?: boolean;
  confirmMessage?: string;
  enableEscape?: boolean;
}

/**
 * Hook to manage modal closing with ESC key support and dirty-form protection.
 * - When Escape is pressed: closes immediately if clean, prompts before closing if dirty.
 * - Provides requestClose() callback for overlay clicks and close buttons.
 */
export const useModalGuard = ({
  isOpen,
  onClose,
  isDirty = false,
  confirmMessage = 'Bạn có dữ liệu đang nhập dở chưa lưu. Bạn có chắc chắn muốn đóng mà không lưu không?',
  enableEscape = true,
}: UseModalGuardOptions) => {
  const requestClose = useCallback(() => {
    if (isDirty) {
      const confirmed = window.confirm(confirmMessage);
      if (!confirmed) {
        return false;
      }
    }
    onClose();
    return true;
  }, [isDirty, confirmMessage, onClose]);

  useEffect(() => {
    if (!isOpen || !enableEscape) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Esc') {
        event.preventDefault();
        event.stopPropagation();
        requestClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, enableEscape, requestClose]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        e.preventDefault();
        requestClose();
      }
    },
    [requestClose]
  );

  return {
    requestClose,
    handleOverlayClick,
  };
};
