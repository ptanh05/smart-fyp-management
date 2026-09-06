import React, { useState, useRef, useEffect } from 'react';

export interface DebouncedSubmitButtonProps {
  loading?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  type?: 'submit' | 'button';
  loadingText?: string;
  debounceTimeMs?: number;
  title?: string;
}

export const DebouncedSubmitButton: React.FC<DebouncedSubmitButtonProps> = ({
  loading = false,
  disabled = false,
  children,
  className = 'btn btn-primary',
  style,
  onClick,
  type = 'submit',
  loadingText = 'Đang xử lý...',
  debounceTimeMs = 1200,
  title,
}) => {
  const [localSubmitting, setLocalSubmitting] = useState(false);
  const isLockedRef = useRef(false);
  const lastClickTimeRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // When external loading finishes, unlock immediately
    if (!loading && localSubmitting) {
      setLocalSubmitting(false);
      isLockedRef.current = false;
    }
  }, [loading]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const now = Date.now();

    // Guard: ignore if disabled, already loading, locked, or clicked within debounce threshold
    if (disabled || loading || isLockedRef.current || now - lastClickTimeRef.current < debounceTimeMs) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // Lock submission immediately to prevent duplicate requests
    lastClickTimeRef.current = now;
    isLockedRef.current = true;
    setLocalSubmitting(true);

    if (onClick) {
      onClick(e);
    }

    // Auto-release lock after debounceTimeMs in case component doesn't unmount or pass loading
    timerRef.current = setTimeout(() => {
      isLockedRef.current = false;
      setLocalSubmitting(false);
    }, debounceTimeMs);
  };

  const isBusy = loading || localSubmitting;

  return (
    <button
      type={type}
      className={className}
      style={{
        ...style,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        opacity: isBusy || disabled ? 0.65 : 1,
        cursor: isBusy || disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s ease',
      }}
      onClick={handleClick}
      disabled={disabled || isBusy}
      title={title}
    >
      {isBusy && (
        <span
          style={{
            width: '14px',
            height: '14px',
            border: '2px solid currentColor',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            display: 'inline-block',
            animation: 'spin 0.8s linear infinite',
          }}
        />
      )}
      {isBusy ? loadingText : children}
    </button>
  );
};

export default DebouncedSubmitButton;
