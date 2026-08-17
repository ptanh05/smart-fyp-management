import React from 'react';
import './SkeletonLoader.css';

// Base skeleton component with shimmer effect
export const Skeleton: React.FC<{
  width?: string | number;
  height?: string | number;
  borderRadius?: string;
  className?: string;
  style?: React.CSSProperties;
}> = ({ width = '100%', height = '20px', borderRadius = '4px', className = '', style }) => (
  <div
    className={`skeleton ${className}`}
    style={{
      width: typeof width === 'number' ? `${width}px` : width,
      height: typeof height === 'number' ? `${height}px` : height,
      borderRadius,
      ...style,
    }}
  />
);

// Skeleton for text lines
export const SkeletonText: React.FC<{
  lines?: number;
  lastLineWidth?: string;
  gap?: string;
}> = ({ lines = 3, lastLineWidth = '70%', gap = '12px' }) => (
  <div className="skeleton-text" style={{ display: 'flex', flexDirection: 'column', gap }}>
    {Array.from({ length: lines }).map((_, index) => (
      <Skeleton
        key={index}
        width={index === lines - 1 ? lastLineWidth : '100%'}
        height="16px"
      />
    ))}
  </div>
);

// Skeleton for avatar/circle
export const SkeletonAvatar: React.FC<{
  size?: number;
}> = ({ size = 40 }) => (
  <Skeleton width={size} height={size} borderRadius="50%" />
);

// Skeleton for a card
export const SkeletonCard: React.FC<{
  hasAvatar?: boolean;
  lines?: number;
}> = ({ hasAvatar = false, lines = 3 }) => (
  <div className="skeleton-card">
    {hasAvatar && (
      <div className="skeleton-card-header">
        <SkeletonAvatar />
        <div style={{ flex: 1 }}>
          <Skeleton width="60%" height="18px" style={{ marginBottom: '8px' }} />
          <Skeleton width="40%" height="14px" />
        </div>
      </div>
    )}
    <div className="skeleton-card-body">
      <Skeleton width="80%" height="20px" style={{ marginBottom: '16px' }} />
      <SkeletonText lines={lines} />
    </div>
    <div className="skeleton-card-footer">
      <Skeleton width="100px" height="36px" borderRadius="6px" />
      <Skeleton width="100px" height="36px" borderRadius="6px" />
    </div>
  </div>
);

// Skeleton for table rows
export const SkeletonTableRow: React.FC<{
  columns?: number;
}> = ({ columns = 4 }) => (
  <tr className="skeleton-table-row">
    {Array.from({ length: columns }).map((_, index) => (
      <td key={index}>
        <Skeleton
          width={index === 0 ? '70%' : index === columns - 1 ? '80px' : '60%'}
          height="16px"
        />
      </td>
    ))}
  </tr>
);

// Skeleton for a full table
export const SkeletonTable: React.FC<{
  rows?: number;
  columns?: number;
  hasHeader?: boolean;
}> = ({ rows = 5, columns = 4, hasHeader = true }) => (
  <table className="table skeleton-table">
    {hasHeader && (
      <thead>
        <tr>
          {Array.from({ length: columns }).map((_, index) => (
            <th key={index}>
              <Skeleton width="60%" height="14px" />
            </th>
          ))}
        </tr>
      </thead>
    )}
    <tbody>
      {Array.from({ length: rows }).map((_, index) => (
        <SkeletonTableRow key={index} columns={columns} />
      ))}
    </tbody>
  </table>
);

// Skeleton for profile info
export const SkeletonProfile: React.FC = () => (
  <div className="skeleton-profile">
    <div className="skeleton-profile-row">
      <Skeleton width="120px" height="16px" />
      <Skeleton width="200px" height="16px" />
    </div>
    <div className="skeleton-profile-row">
      <Skeleton width="100px" height="16px" />
      <Skeleton width="180px" height="16px" />
    </div>
    <div className="skeleton-profile-row">
      <Skeleton width="80px" height="16px" />
      <Skeleton width="150px" height="16px" />
    </div>
    <div className="skeleton-profile-row">
      <Skeleton width="90px" height="16px" />
      <Skeleton width="160px" height="16px" />
    </div>
  </div>
);

// Skeleton for grid of cards
export const SkeletonCardGrid: React.FC<{
  count?: number;
  hasAvatar?: boolean;
}> = ({ count = 3, hasAvatar = false }) => (
  <div className="skeleton-card-grid">
    {Array.from({ length: count }).map((_, index) => (
      <SkeletonCard key={index} hasAvatar={hasAvatar} />
    ))}
  </div>
);

// Skeleton for document review cards
export const SkeletonDocumentCard: React.FC = () => (
  <div className="skeleton-document-card">
    <div className="skeleton-document-header">
      <Skeleton width="100px" height="14px" />
      <Skeleton width="80px" height="24px" borderRadius="12px" />
    </div>
    <div className="skeleton-document-body">
      <Skeleton width="90%" height="18px" style={{ marginBottom: '12px' }} />
      <Skeleton width="70%" height="14px" style={{ marginBottom: '8px' }} />
      <Skeleton width="60%" height="14px" style={{ marginBottom: '8px' }} />
      <Skeleton width="50%" height="12px" />
    </div>
    <div className="skeleton-document-actions">
      <Skeleton width="100%" height="32px" borderRadius="6px" />
      <Skeleton width="100%" height="32px" borderRadius="6px" />
    </div>
  </div>
);

// Skeleton for document grid
export const SkeletonDocumentGrid: React.FC<{
  count?: number;
}> = ({ count = 4 }) => (
  <div className="skeleton-document-grid">
    {Array.from({ length: count }).map((_, index) => (
      <SkeletonDocumentCard key={index} />
    ))}
  </div>
);

// Skeleton for evaluation cards
export const SkeletonEvaluationCard: React.FC = () => (
  <div className="skeleton-evaluation-card">
    <div className="skeleton-evaluation-header">
      <Skeleton width="60%" height="18px" />
      <Skeleton width="80px" height="20px" borderRadius="10px" />
    </div>
    <div className="skeleton-evaluation-marks">
      <Skeleton width="60px" height="32px" />
      <Skeleton width="40px" height="16px" />
    </div>
    <Skeleton width="100%" height="8px" borderRadius="4px" />
    <Skeleton width="150px" height="14px" style={{ marginTop: '12px' }} />
  </div>
);

// Skeleton for evaluation grid
export const SkeletonEvaluationGrid: React.FC<{
  count?: number;
}> = ({ count = 5 }) => (
  <div className="skeleton-evaluation-grid">
    {Array.from({ length: count }).map((_, index) => (
      <SkeletonEvaluationCard key={index} />
    ))}
  </div>
);

// Full page loading skeleton
export const SkeletonDashboard: React.FC<{
  type?: 'profile' | 'table' | 'cards' | 'mixed';
}> = ({ type = 'mixed' }) => (
  <div className="skeleton-dashboard">
    <div className="skeleton-header">
      <Skeleton width="200px" height="28px" style={{ marginBottom: '8px' }} />
      <Skeleton width="150px" height="16px" />
    </div>
    
    <div className="skeleton-content">
      {type === 'profile' && <SkeletonProfile />}
      {type === 'table' && <SkeletonTable rows={5} columns={4} />}
      {type === 'cards' && <SkeletonCardGrid count={3} />}
      {type === 'mixed' && (
        <>
          <SkeletonProfile />
          <div style={{ marginTop: '24px' }}>
            <Skeleton width="150px" height="20px" style={{ marginBottom: '16px' }} />
            <SkeletonTable rows={3} columns={4} />
          </div>
        </>
      )}
    </div>
  </div>
);

// Chat skeleton
export const SkeletonChat: React.FC = () => (
  <div className="skeleton-chat">
    <div className="skeleton-chat-messages">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className={`skeleton-chat-message ${index % 2 === 0 ? 'received' : 'sent'}`}
        >
          <Skeleton
            width={index % 2 === 0 ? '70%' : '60%'}
            height="40px"
            borderRadius="12px"
          />
        </div>
      ))}
    </div>
    <div className="skeleton-chat-input">
      <Skeleton width="100%" height="44px" borderRadius="8px" />
      <Skeleton width="80px" height="44px" borderRadius="8px" />
    </div>
  </div>
);

export default {
  Skeleton,
  SkeletonText,
  SkeletonAvatar,
  SkeletonCard,
  SkeletonTableRow,
  SkeletonTable,
  SkeletonProfile,
  SkeletonCardGrid,
  SkeletonDocumentCard,
  SkeletonDocumentGrid,
  SkeletonEvaluationCard,
  SkeletonEvaluationGrid,
  SkeletonDashboard,
  SkeletonChat,
};
