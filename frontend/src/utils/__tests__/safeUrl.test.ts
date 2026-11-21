import { describe, it, expect } from 'vitest';
import { safeExternalUrl, isSafeInternalPath } from '../safeUrl';

describe('safeExternalUrl', () => {
  it('giữ nguyên link http(s) hợp lệ', () => {
    expect(safeExternalUrl('https://github.com/utc/repo/commit/abc')).toBe('https://github.com/utc/repo/commit/abc');
    expect(safeExternalUrl('  http://meet.google.com/xyz  ')).toBe('http://meet.google.com/xyz');
  });

  it('cho phép đường dẫn tương đối cùng origin', () => {
    expect(safeExternalUrl('/media/outlines/1.pdf')).toBe('/media/outlines/1.pdf');
  });

  it.each([
    'javascript:alert(1)',
    'JavaScript:alert(document.cookie)',
    ' javascript:alert(1)',
    'java\tscript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    '//evil.example/steal',
    'github.com/no-scheme',
  ])('chặn %s', (url) => {
    expect(safeExternalUrl(url)).toBeUndefined();
  });

  it('trả undefined cho giá trị rỗng', () => {
    expect(safeExternalUrl(null)).toBeUndefined();
    expect(safeExternalUrl(undefined)).toBeUndefined();
    expect(safeExternalUrl('   ')).toBeUndefined();
  });
});

describe('isSafeInternalPath', () => {
  it('chấp nhận path nội bộ', () => {
    expect(isSafeInternalPath('/student/dashboard?tab=stage3')).toBe(true);
  });

  it.each([
    '//evil.example',
    '/\\evil.example',
    'https://evil.example',
    'javascript:alert(1)',
    'student/dashboard',
    '/student\n/dashboard',
    '',
    null,
    undefined,
  ])('từ chối %s', (path) => {
    expect(isSafeInternalPath(path as string | null | undefined)).toBe(false);
  });
});
