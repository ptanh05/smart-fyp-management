import React, { useCallback, useEffect, useState } from 'react';
import { apiService } from '../services/api';
import type { SubmissionKind, SubmissionVersion, TopicSimilarityResult } from '../services/api';
import { notify, notifyError } from '../utils/notify';
import { safeExternalUrl } from '../utils/safeUrl';

const KIND_LABELS: Record<SubmissionKind, string> = {
  OUTLINE: 'Đề cương',
  REPORT: 'Báo cáo / Quyển',
  SLIDES: 'Slide bảo vệ',
  SOURCE: 'Mã nguồn',
  OTHER: 'Khác',
};
const ACCEPT = '.pdf,.docx,.zip,.pptx,.txt,.md';
const MAX_BYTES = 25 * 1024 * 1024;

const levelClass = (level?: string | null) =>
  level === 'HIGH' ? 'text-red-600 bg-red-50' : level === 'MEDIUM' ? 'text-amber-700 bg-amber-50' : 'text-emerald-700 bg-emerald-50';

export function SimilarityBadge({ version }: { version: SubmissionVersion }) {
  if (version.similarity_status === 'UNSUPPORTED') {
    return <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-500">Không kiểm tra được nội dung</span>;
  }
  if (version.similarity_status !== 'CHECKED' || version.similarity_score == null) return null;
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded font-semibold ${levelClass(version.similarity_level)}`}>
      Tương đồng {version.similarity_score.toFixed(1)}%
    </span>
  );
}

/** Lịch sử phiên bản bài nộp: mọi lần nộp đều được giữ lại, kèm tỷ lệ tương đồng. */
export function SubmissionVersionsPanel({ projectId, canUpload }: { projectId: number; canUpload: boolean }) {
  const [versions, setVersions] = useState<SubmissionVersion[]>([]);
  const [kind, setKind] = useState<SubmissionKind>('REPORT');
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setVersions(await apiService.getSubmissionVersions(projectId));
    } catch (err) {
      notifyError('Không tải được lịch sử bài nộp', err);
    }
  }, [projectId]);

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
    <div className="utc-card p-4 space-y-3 text-xs">
      <h4 className="font-bold text-sm">Lịch sử phiên bản bài nộp</h4>
      {canUpload && (
        <form onSubmit={submit} className="flex flex-wrap gap-2 items-end">
          <select value={kind} onChange={(e) => setKind(e.target.value as SubmissionKind)} className="utc-form-input text-xs w-auto">
            {(Object.keys(KIND_LABELS) as SubmissionKind[]).map((k) => (
              <option key={k} value={k}>{KIND_LABELS[k]}</option>
            ))}
          </select>
          <input type="file" accept={ACCEPT} onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-xs" />
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chú thay đổi (tuỳ chọn)" className="utc-form-input text-xs flex-1 min-w-[160px]" />
          <button type="submit" disabled={!file || busy} className="utc-btn">{busy ? 'Đang nộp...' : 'Nộp phiên bản mới'}</button>
        </form>
      )}
      {versions.length === 0 ? (
        <p className="text-slate-500">Chưa có phiên bản nào.</p>
      ) : (
        <ul className="divide-y divide-slate-200">
          {versions.map((v) => {
            const href = safeExternalUrl(v.file_url);
            return (
              <li key={v.id} className="py-2 flex flex-wrap items-center gap-2">
                <span className="font-semibold">{KIND_LABELS[v.kind]} v{v.version_no}</span>
                {href ? (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline truncate max-w-[220px]">{v.original_name}</a>
                ) : (
                  <span className="truncate max-w-[220px]">{v.original_name}</span>
                )}
                <span className="text-slate-500">{new Date(v.created_at).toLocaleString('vi-VN')}</span>
                <SimilarityBadge version={v} />
                {v.note && <span className="text-slate-500 italic w-full">{v.note}</span>}
              </li>
            );
          })}
        </ul>
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
    <div className={`mt-2 p-2 rounded text-[11px] ${result.has_duplicate_risk ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'}`} role="status">
      <p className="font-semibold mb-1">
        {result.has_duplicate_risk ? 'Đề tài có nguy cơ trùng với đề tài đã có:' : 'Có đề tài tương tự:'}
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
    <div className="utc-card p-4 text-xs space-y-2">
      <h4 className="font-bold text-sm">Đồng bộ hạn chót vào lịch cá nhân</h4>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="utc-btn" onClick={download}>Tải file .ics</button>
        <button type="button" className="utc-btn" onClick={() => subscribe(false)}>Lấy link đăng ký lịch</button>
        {feedUrl && <button type="button" className="utc-btn" onClick={() => subscribe(true)}>Đổi link (thu hồi link cũ)</button>}
      </div>
      {feedUrl && <input readOnly value={feedUrl} className="utc-form-input text-xs w-full" onFocus={(e) => e.target.select()} />}
      <p className="text-slate-500">Link đăng ký là bí mật — không chia sẻ cho người khác.</p>
    </div>
  );
}
