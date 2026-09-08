import React from 'react';
import './ActionIconButton.css';

export type ActionType = 'view' | 'edit' | 'delete' | 'download' | 'history' | 'custom';

export interface ActionIconButtonProps {
  action: ActionType;
  tooltip?: string;
  icon?: React.ReactNode;
  label?: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  variant?: 'primary' | 'secondary' | 'danger' | 'warning' | 'success' | 'ghost';
  type?: 'button' | 'submit' | 'reset';
  ariaLabel?: string;
}

const ACTION_CONFIGS: Record<ActionType, { icon: string; defaultTooltip: string; defaultVariant: 'primary' | 'secondary' | 'danger' | 'warning' | 'success' | 'ghost' }> = {
  view: {
    icon: '👁️',
    defaultTooltip: 'Xem chi tiết thông tin / phiếu đánh giá',
    defaultVariant: 'ghost',
  },
  edit: {
    icon: '✏️',
    defaultTooltip: 'Chỉnh sửa nội dung',
    defaultVariant: 'secondary',
  },
  delete: {
    icon: '🗑️',
    defaultTooltip: 'Xóa mục này khỏi hệ thống',
    defaultVariant: 'danger',
  },
  download: {
    icon: '⬇️',
    defaultTooltip: 'Tải về tệp tin',
    defaultVariant: 'primary',
  },
  history: {
    icon: '📜',
    defaultTooltip: 'Xem lịch sử thay đổi / nhật ký hoạt động',
    defaultVariant: 'ghost',
  },
  custom: {
    icon: '⚙️',
    defaultTooltip: 'Thao tác chức năng',
    defaultVariant: 'ghost',
  },
};

export const ActionIconButton: React.FC<ActionIconButtonProps> = ({
  action,
  tooltip,
  icon,
  label,
  onClick,
  disabled = false,
  className = '',
  style,
  variant,
  type = 'button',
  ariaLabel,
}) => {
  const config = ACTION_CONFIGS[action] || ACTION_CONFIGS.custom;
  const effectiveTooltip = tooltip || config.defaultTooltip;
  const effectiveIcon = icon || config.icon;
  const effectiveVariant = variant || config.defaultVariant;

  return (
    <div className="action-icon-wrapper" data-tooltip={effectiveTooltip}>
      <button
        type={type}
        className={`action-icon-btn action-icon-${action} variant-${effectiveVariant} ${className}`}
        onClick={onClick}
        disabled={disabled}
        style={style}
        title={effectiveTooltip}
        aria-label={ariaLabel || effectiveTooltip}
      >
        <span className="action-icon-symbol" aria-hidden="true">
          {effectiveIcon}
        </span>
        {label && <span className="action-icon-label">{label}</span>}
      </button>
      <span className="action-icon-tooltip" role="tooltip">
        {effectiveTooltip}
      </span>
    </div>
  );
};

export default ActionIconButton;
