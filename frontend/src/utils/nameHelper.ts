/**
 * Tiện ích chuẩn hóa họ và tên theo quy ước tiếng Việt: Họ trước, Tên sau.
 * (Vietnamese naming convention: Last Name / Family Name first, First Name / Given Name last)
 * 
 * Ví dụ:
 * - first_name = "An", last_name = "Nguyễn Văn" -> "Nguyễn Văn An"
 * - first_name = "Vũ Bá", last_name = "Thắng" -> "Vũ Bá Thắng"
 * - first_name = "ThS. Nguyễn Thị", last_name = "Hồng (Giáo Vụ)" -> "ThS. Nguyễn Thị Hồng (Giáo Vụ)"
 */

export function formatFullName(
  firstNameOrUser?: { first_name?: string; last_name?: string; username?: string; full_name?: string } | string | null,
  lastName?: string | null,
  usernameFallback: string = ''
): string {
  if (!firstNameOrUser) {
    return lastName || usernameFallback || '';
  }

  // Nếu tham số truyền vào là đối tượng user
  if (typeof firstNameOrUser === 'object') {
    const u = firstNameOrUser;
    if (u.full_name && typeof u.full_name === 'string') {
      return u.full_name.trim();
    }
    return formatFullName(u.first_name, u.last_name, u.username || usernameFallback);
  }

  const fn = (firstNameOrUser || '').trim();
  const ln = (lastName || '').trim();

  if (!fn && !ln) return usernameFallback.trim();
  if (!fn) return ln;
  if (!ln) return fn;

  const fnLower = fn.toLowerCase();
  const lnLower = ln.toLowerCase();

  // Kiểm tra học hàm, học vị (ThS, TS, PGS, GS...)
  const titles = ['ths', 'ts', 'pgs', 'gs'];
  if (titles.some(t => fnLower.startsWith(t))) {
    return `${fn} ${ln}`;
  }
  if (titles.some(t => lnLower.startsWith(t))) {
    return `${ln} ${fn}`;
  }

  const fnWords = fn.split(/\s+/);
  const lnWords = ln.split(/\s+/);

  // Nếu first_name có từ 2 từ trở lên (Họ và đệm) và last_name là 1 từ (Tên gọi)
  if (fnWords.length > 1 && lnWords.length === 1) {
    return `${fn} ${ln}`;
  }

  // Mặc định chuẩn tiếng Việt: last_name (Họ và đệm) đứng trước, first_name (Tên) đứng sau
  return `${ln} ${fn}`;
}

