import React from 'react';
import './ErrorMessage.css';

interface ErrorMessageProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  variant?: 'error' | 'warning' | 'info';
}

/**
 * Reusable error message component with retry functionality.
 * Use for network failures, validation errors, and general error states.
 */
const ErrorMessage: React.FC<ErrorMessageProps> = ({
  title,
  message,
  onRetry,
  variant = 'error'
}) => {
  const getIcon = () => {
    switch (variant) {
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      case 'error':
      default:
        return '❌';
    }
  };

  return (
    <div className={`error-message error-message-${variant}`} role="alert">
      <div className="error-message-content">
        <span className="error-message-icon">{getIcon()}</span>
        <div className="error-message-text">
          {title && <h4 className="error-message-title">{title}</h4>}
          <p className="error-message-description">{message}</p>
        </div>
      </div>
      {onRetry && (
        <button 
          className="error-message-retry" 
          onClick={onRetry}
          type="button"
        >
          Try Again
        </button>
      )}
    </div>
  );
};

export default ErrorMessage;
