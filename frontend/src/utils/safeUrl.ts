/**
 * Kiểm tra URL do người dùng nhập (link Git, link họp, link sản phẩm...) trước khi đưa vào `href`.
 * Chỉ chấp nhận http(s) hoặc đường dẫn tương đối cùng origin (vd. `/media/...`).
 * Chặn `javascript:`, `data:`, `vbscript:`... để tránh XSS khi người khác bấm vào link.
 * Trả về `undefined` nếu không an toàn: thẻ `<a>` khi đó không còn điều hướng được.
 */
export const safeExternalUrl = (url: string | null | undefined): string | undefined => {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Kiểm tra đường dẫn nội bộ (vd. `action_url` của thông báo) trước khi gọi `navigate()`.
 * Chỉ chấp nhận path bắt đầu bằng một dấu `/` và không chứa scheme hay ký tự điều khiển.
 */
export const isSafeInternalPath = (path: string | null | undefined): path is string => {
  if (!path) return false;
  if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) return false;
  // eslint-disable-next-line no-control-regex
  return !/[\u0000-\u001f\\]/.test(path);
};
