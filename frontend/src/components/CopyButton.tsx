import React, { useState } from 'react';
import { triggerGlobalToast } from '../contexts/ToastContext';
import './CopyButton.css';

export interface CopyButtonProps {
  text: string;
  label?: string;
  title?: string;
  tooltipText?: string;
  className?: string;
  style?: React.CSSProperties;
  showTextPreview?: boolean;
  onCopied?: () => void;
}

export const CopyButton: React.FC<CopyButtonProps> = ({
  text,
  label,
  title = 'Sao chép vào bộ nhớ tạm',
  tooltipText = 'Đã sao chép vào bộ nhớ tạm',
  className = '',
  style,
  showTextPreview = false,
  onCopied,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (!text) return;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for non-https / legacy environments
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }

      setCopied(true);
      triggerGlobalToast(tooltipText, 'success', 2500);
      if (onCopied) onCopied();

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      triggerGlobalToast('Không thể sao chép vào bộ nhớ tạm', 'error', 3000);
    }
  };

  return (
    <span className={`copy-button-container ${className}`} style={style}>
      {showTextPreview && <span className="copy-text-preview" title={text}>{text}</span>}
      <button
        type="button"
        className={`copy-button ${copied ? 'copied' : ''}`}
        onClick={handleCopy}
        title={copied ? tooltipText : title}
        aria-label={copied ? tooltipText : title}
      >
        <span className="copy-icon" aria-hidden="true">
          {copied ? '✓' : '📋'}
        </span>
        {label && <span className="copy-label">{copied ? 'Đã chép' : label}</span>}
      </button>
      {copied && (
        <span className="copy-tooltip animate-fade-in" role="status" aria-live="polite">
          {tooltipText}
        </span>
      )}
    </span>
  );
};

export default CopyButton;
