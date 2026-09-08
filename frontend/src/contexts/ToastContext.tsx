import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
}

interface ToastContextType {
  toasts: ToastMessage[];
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  removeToast: (id: string) => void;
  isOnline: boolean;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info', duration: number = 4000) => {
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const newToast: ToastMessage = { id, message, type, duration };

      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  // Network Offline & Online event listeners
  useEffect(() => {
    const handleOffline = () => {
      setIsOnline(false);
      showToast('Mất kết nối Internet, vui lòng kiểm tra đường truyền', 'warning', 6000);
    };

    const handleOnline = () => {
      setIsOnline(true);
      showToast('Đã kết nối lại Internet. Đang đồng bộ dữ liệu...', 'success', 4000);

      // Trigger auto-sync across all components without needing page reload
      window.dispatchEvent(new CustomEvent('app:online-sync'));
    };

    // Global listener for API / non-React triggers
    const handleAppToast = (e: Event) => {
      const customEvent = e as CustomEvent<{ message: string; type?: ToastType; duration?: number }>;
      if (customEvent.detail) {
        showToast(
          customEvent.detail.message,
          customEvent.detail.type || 'info',
          customEvent.detail.duration
        );
      }
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    window.addEventListener('app:show-toast', handleAppToast);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('app:show-toast', handleAppToast);
    };
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast, isOnline }}>
      {children}
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// Global helper for triggering toast from outside React component tree (e.g. Axios interceptors)
export const triggerGlobalToast = (message: string, type: ToastType = 'info', duration?: number) => {
  window.dispatchEvent(
    new CustomEvent('app:show-toast', {
      detail: { message, type, duration },
    })
  );
};
