import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import './RagUtcChatWidget.css';

const STUDENT_DASHBOARD_PATH = '/student/dashboard';

const UPCOMING_CAPABILITIES = [
  'Tra cứu nhanh quy trình và các giai đoạn làm Đồ án Tốt nghiệp UTC.',
  'Giải đáp cách điền, kiểm tra và nộp các biểu mẫu chuẩn của nhà trường.',
  'Hỏi đáp mốc thời gian, hạn chót quan trọng và quy định học vụ liên quan.',
];

/**
 * Floating preview widget for "Hỏi AI RAG-UTC".
 * Guarded to render exclusively on the `/student/dashboard` route.
 */
const RagUtcChatWidget: React.FC = () => {
  const { pathname } = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const normalizedPath = (pathname || '').replace(/\/+$/, '');
  const isStudentDashboardRoute = normalizedPath === STUDENT_DASHBOARD_PATH;

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isStudentDashboardRoute) {
    return null;
  }

  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3"
      data-testid="rag-utc-chat-widget"
    >
      {isOpen && (
        <section
          id="rag-utc-preview-dialog"
          role="dialog"
          aria-modal="false"
          aria-labelledby="rag-utc-popup-title"
          className="rag-utc-popup-card w-[min(calc(100vw-3rem),370px)] max-h-[calc(100vh-7.5rem)] overflow-y-auto rounded-2xl bg-white text-slate-800 shadow-lg"
        >
          {/* Header */}
          <div className="rag-utc-popup-header flex items-start justify-between gap-3 px-4 py-3.5 text-white">
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15"
                aria-hidden="true"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="7" width="16" height="12" rx="4" />
                  <path d="M12 3v4" />
                  <circle cx="9.5" cy="13" r="1" fill="currentColor" stroke="none" />
                  <circle cx="14.5" cy="13" r="1" fill="currentColor" stroke="none" />
                  <path d="M9.5 16.2h5" />
                </svg>
              </span>
              <div className="min-w-0">
                <h3
                  id="rag-utc-popup-title"
                  className="m-0 text-sm font-bold leading-snug text-white"
                >
                  Hỏi đáp AI RAG-UTC
                </h3>
                <p className="m-0 text-xs text-blue-100">
                  Tích hợp trên hệ thống Smart FYP UTC
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rag-utc-close-btn flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-white/15 text-white transition hover:bg-white/25"
              aria-label="Đóng khung giới thiệu Hỏi AI RAG-UTC"
              title="Đóng"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="space-y-3 p-4">
            <div className="rag-utc-status-box rounded-xl border border-amber-200 bg-amber-50 p-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" />
                <span className="rag-utc-status-title text-xs font-bold uppercase tracking-wide text-amber-800">
                  Tính năng đang được phát triển
                </span>
              </div>
              <p className="rag-utc-status-desc mt-1 mb-0 text-xs leading-relaxed text-amber-900/90">
                Hệ thống đang hoàn thiện dữ liệu tri thức và sẽ sớm ra mắt sinh viên trong thời gian tới.
              </p>
            </div>

            <p className="rag-utc-popup-intro m-0 text-xs leading-relaxed text-slate-600">
              Trợ lý <strong className="font-semibold text-[#173f9e]">Hỏi đáp AI RAG-UTC</strong> sẽ đồng hành cùng bạn trong suốt kỳ làm đồ án với các tiện ích sắp tới:
            </p>

            <ul className="rag-utc-feature-list m-0 list-none space-y-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
              {UPCOMING_CAPABILITIES.map((text, idx) => (
                <li
                  key={idx}
                  className="rag-utc-popup-item flex items-start gap-2 text-xs leading-relaxed text-slate-700"
                >
                  <span
                    className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#2563eb]/12 text-[#173f9e]"
                    aria-hidden="true"
                  >
                    <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </span>
                  <span>{text}</span>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rag-utc-confirm-btn w-full cursor-pointer rounded-xl px-4 py-2.5 text-xs font-bold text-white shadow-sm transition"
            >
              Đã hiểu
            </button>
          </div>
        </section>
      )}

      {/* Floating Action Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-controls="rag-utc-preview-dialog"
        aria-label="Hỏi AI RAG-UTC (Tính năng đang phát triển)"
        className="rag-utc-fab-btn relative flex cursor-pointer items-center gap-2.5 rounded-full px-4 py-3 text-sm font-bold text-white shadow-lg transition-all duration-200"
      >
        <span className="relative flex h-6 w-6 items-center justify-center rounded-full bg-white/15" aria-hidden="true">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="7" width="16" height="12" rx="4" />
            <path d="M12 3v4" />
            <circle cx="9.5" cy="13" r="1" fill="currentColor" stroke="none" />
            <circle cx="14.5" cy="13" r="1" fill="currentColor" stroke="none" />
            <path d="M9.5 16.2h5" />
          </svg>
        </span>
        <span className="whitespace-nowrap">Hỏi AI RAG-UTC</span>
        <span
          className="inline-flex items-center gap-1 rounded-full bg-amber-300/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-200 border border-amber-300/40"
          title="Tính năng đang được phát triển"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-amber-300 animate-pulse" />
          Beta
        </span>
      </button>
    </div>
  );
};

export default RagUtcChatWidget;
