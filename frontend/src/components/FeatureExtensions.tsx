import React, { useCallback, useEffect, useState } from 'react';
import { apiService } from '../services/api';
import type { SubmissionKind, SubmissionVersion, TopicSimilarityResult } from '../services/api';
import { notify, notifyError } from '../utils/notify';
import { safeExternalUrl } from '../utils/safeUrl';
import './FeatureExtensions.css';

const KIND_LABELS: Record<SubmissionKind, string> = {
  OUTLINE: 'Đề cương',
  REPORT: 'Báo cáo / Quyển',
  SLIDES: 'Slide bảo vệ',
  SOURCE: 'Mã nguồn',
  OTHER: 'Khác',
};
const ACCEPT = '.pdf,.docx,.zip,.pptx,.txt,.md';
const MAX_BYTES = 25 * 1024 * 1024;

export function SimilarityBadge({ version }: { version: SubmissionVersion }) {
  if (version.similarity_status === 'UNSUPPORTED') {
    return <span className="utc-similarity-badge unsupported">Chưa hỗ trợ quét nội dung</span>;
  }
  if (version.similarity_status !== 'CHECKED' || version.similarity_score == null) return null;
  
  const level = version.similarity_level?.toLowerCase() || 'low';
  return (
    <span className={`utc-similarity-badge ${level}`}>
      ✓ Tương đồng {version.similarity_score.toFixed(1)}%
    </span>
  );
}

/** Lịch sử phiên bản bài nộp: mọi lần nộp đều được giữ lại, kèm tỷ lệ tương đồng. */
export function SubmissionVersionsPanel({
  projectId,
  canUpload,
  allowedKinds,
  defaultKind = 'REPORT',
  title = 'Lịch Sử Phiên Bản Bài Nộp',
  subtitle = 'Quản lý các bản nộp (Báo cáo, Đề cương, Slide, Mã nguồn) & đối soát tỷ lệ tương đồng.',
}: {
  projectId: number;
  canUpload: boolean;
  allowedKinds?: SubmissionKind[];
  defaultKind?: SubmissionKind;
  title?: string;
  subtitle?: string;
}) {
  const allowedKindsKey = allowedKinds?.join(',') || '';
  const [versions, setVersions] = useState<SubmissionVersion[]>([]);
  const [kind, setKind] = useState<SubmissionKind>(defaultKind);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const loaded = await apiService.getSubmissionVersions(projectId);
      setVersions(allowedKinds?.length ? loaded.filter((v) => allowedKinds.includes(v.kind)) : loaded);
    } catch (err) {
      notifyError('Không tải được lịch sử bài nộp', err);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, allowedKindsKey]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    if (file.size > MAX_BYTES) {
      notify.warning('Tệp vượt quá 25MB.');
      return;
    }
    try {
      setBusy(true);
      const v = await apiService.uploadSubmissionVersion(projectId, file, kind, note.trim());
      notify.success(`Đã nộp ${KIND_LABELS[v.kind]} phiên bản v${v.version_no}.`);
      setFile(null);
      setNote('');
      (e.target as HTMLFormElement).reset();
      load();
    } catch (err) {
      notifyError('Nộp bài thất bại', err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="utc-feature-card">
      <div className="utc-feature-card-header">
        <h4 className="utc-feature-card-title">
           <span>📦</span> {title}
        </h4>
        <p className="utc-feature-card-subtitle">
          {subtitle}
        </p>
      </div>

      {canUpload && (
        <form onSubmit={submit} className="utc-version-form">
          <div className="utc-version-form-grid">
            <div className="utc-field-group">
              <label className="utc-field-label">Loại tài liệu (*)</label>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as SubmissionKind)}
                className="utc-version-select"
              >
                {((allowedKinds?.length ? allowedKinds : Object.keys(KIND_LABELS)) as SubmissionKind[]).map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
            <div className="utc-field-group">
              <label className="utc-field-label">Chọn tệp đính kèm (Tối đa 25MB)</label>
              <input
                type="file"
                accept={ACCEPT}
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="utc-version-file-input"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center mt-1">
            <div className="utc-field-group flex-1 min-w-[200px]">
              <label className="utc-field-label">Ghi chú thay đổi (tuỳ chọn)</label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ví dụ: Cập nhật sau buổi nhận xét của GVHD..."
                className="utc-version-text-input"
              />
            </div>
            <div className="self-end">
              <button
                type="submit"
                disabled={!file || busy}
                className="utc-btn-submit-version"
              >
                <span>{busy ? '⏳ Đang nộp...' : '📤 Nộp phiên bản'}</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {versions.length === 0 ? (
        <div className="utc-version-empty">
          <span className="text-xl">📁</span>
          <p>Chưa có phiên bản bài nộp nào được lưu trên hệ thống.</p>
        </div>
      ) : (
        <div className="utc-version-list">
          {versions.map((v) => {
            const href = safeExternalUrl(v.file_url);
            return (
              <div key={v.id} className="utc-version-item">
                <div className="utc-version-item-header">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="utc-version-badge">v{v.version_no}</span>
                    <span className="utc-version-kind">{KIND_LABELS[v.kind]}</span>
                    {href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="utc-version-filename"
                        title={v.original_name}
                      >
                        📄 {v.original_name} ↗
                      </a>
                    ) : (
                      <span className="utc-version-filename" title={v.original_name}>
                        📄 {v.original_name}
                      </span>
                    )}
                  </div>
                  <SimilarityBadge version={v} />
                </div>
                <div className="utc-version-item-footer">
                  <span>🕒 {new Date(v.created_at).toLocaleString('vi-VN')}</span>
                  {v.note && <span className="utc-version-note">“{v.note}”</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Cảnh báo đề tài trùng/tương tự khi sinh viên gõ tên đề tài (debounce 600ms). */
export function TopicSimilarityHint({ title, projectId }: { title: string; projectId?: number }) {
  const [result, setResult] = useState<TopicSimilarityResult | null>(null);

  useEffect(() => {
    const trimmed = title.trim();
    if (trimmed.length < 10) {
      setResult(null);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const r = await apiService.checkTopicSimilarity(trimmed, projectId);
        if (!cancelled) setResult(r);
      } catch {
        if (!cancelled) setResult(null);
      }
    }, 600);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [title, projectId]);

  if (!result || result.matches.length === 0) return null;
  return (
    <div
      className={`mt-2 p-2 rounded text-[11px] ${
        result.has_duplicate_risk ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-amber-50 text-amber-800 border border-amber-200'
      }`}
      role="status"
    >
      <p className="font-semibold mb-1">
        {result.has_duplicate_risk ? '⚠️ Đề tài có nguy cơ trùng với đề tài đã có:' : 'ℹ️ Có đề tài tương tự:'}
      </p>
      <ul className="list-disc pl-4 space-y-0.5">
        {result.matches.slice(0, 3).map((m, i) => (
          <li key={i}>
            {m.topic_title_vi} {m.batch_code ? `(${m.batch_code})` : ''} — {Math.round(m.similarity * 100)}%
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Tải lịch .ics hoặc lấy link đăng ký (Google Calendar/Outlook tự cập nhật). */
export function CalendarSyncButtons() {
  const [feedUrl, setFeedUrl] = useState('');

  const download = async () => {
    try {
      const blob = await apiService.downloadMyCalendar();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'lich-do-an.ics';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      notifyError('Không tải được lịch', err);
    }
  };

  const subscribe = async (rotate = false) => {
    try {
      const { feed_url } = await apiService.getCalendarFeedUrl(rotate);
      setFeedUrl(feed_url);
      await navigator.clipboard?.writeText(feed_url).catch(() => undefined);
      notify.success(rotate ? 'Đã tạo link mới, link cũ hết hiệu lực.' : 'Đã sao chép link đăng ký lịch.');
    } catch (err) {
      notifyError('Không lấy được link lịch', err);
    }
  };

  return (
    <div className="utc-feature-card">
      <div className="utc-feature-card-header">
        <h4 className="utc-feature-card-title">
          <span>📅</span> Đồng Bộ Hạn Chót Vào Lịch Cá Nhân
        </h4>
        <p className="utc-feature-card-subtitle">
          Tích hợp hạn nộp bài, báo cáo tuần và lịch bảo vệ vào Google Calendar, Outlook hoặc Apple Calendar.
        </p>
      </div>

      <div className="utc-calendar-actions">
        <button type="button" className="utc-calendar-btn" onClick={download}>
          <span>📥</span> Tải file .ics
        </button>
        <button type="button" className="utc-calendar-btn primary" onClick={() => subscribe(false)}>
          <span>🔗</span> Lấy link đăng ký lịch
        </button>
        {feedUrl && (
          <button type="button" className="utc-calendar-btn warning" onClick={() => subscribe(true)}>
            <span>🔄</span> Đổi link bảo mật
          </button>
        )}
      </div>

      {feedUrl && (
        <div className="utc-calendar-feed-box">
          <label className="utc-field-label">Link đăng ký của bạn:</label>
          <div className="flex gap-2 items-center mt-1">
            <input
              readOnly
              value={feedUrl}
              className="utc-calendar-feed-input"
              onFocus={(e) => e.target.select()}
            />
            <button
              type="button"
              className="utc-calendar-copy-btn"
              onClick={async () => {
                await navigator.clipboard?.writeText(feedUrl).catch(() => undefined);
                notify.success('Đã sao chép link đăng ký!');
              }}
            >
              Sao chép
            </button>
          </div>
        </div>
      )}

      <div className="utc-calendar-notice">
        <span>🔒</span>
        <p>Link đăng ký là mã bảo mật riêng của bạn — không chia sẻ cho người khác.</p>
      </div>
    </div>
  );
}
