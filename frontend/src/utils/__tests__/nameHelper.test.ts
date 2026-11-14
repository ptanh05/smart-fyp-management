import { describe, it, expect } from 'vitest';
import { formatFullName, normalizeVietnameseFullName, isVietnameseSurname } from '../nameHelper';

describe('nameHelper (Vietnamese Name Convention Normalizer)', () => {
  describe('isVietnameseSurname', () => {
    it('correctly identifies Vietnamese surnames', () => {
      expect(isVietnameseSurname('Lý')).toBe(true);
      expect(isVietnameseSurname('Nguyễn')).toBe(true);
      expect(isVietnameseSurname('Trần')).toBe(true);
      expect(isVietnameseSurname('Phạm')).toBe(true);
      expect(isVietnameseSurname('Đỗ')).toBe(true);
      expect(isVietnameseSurname('Quách')).toBe(true);
    });

    it('returns false for given names or invalid inputs', () => {
      expect(isVietnameseSurname('Linh')).toBe(false);
      expect(isVietnameseSurname('Phong')).toBe(false);
      expect(isVietnameseSurname('Khải')).toBe(false);
      expect(isVietnameseSurname('')).toBe(false);
    });
  });

  describe('normalizeVietnameseFullName', () => {
    it('fixes reversed single string "Hà Linh Lý" -> "Lý Hà Linh"', () => {
      expect(normalizeVietnameseFullName('Hà Linh Lý')).toBe('Lý Hà Linh');
    });

    it('keeps already properly ordered name "Lý Hà Linh" intact', () => {
      expect(normalizeVietnameseFullName('Lý Hà Linh')).toBe('Lý Hà Linh');
    });

    it('fixes reversed name with title "TS. Hà Linh Lý" -> "TS. Lý Hà Linh"', () => {
      expect(normalizeVietnameseFullName('TS. Hà Linh Lý')).toBe('TS. Lý Hà Linh');
    });

    it('keeps properly ordered name with title "TS. Nguyễn Văn Minh" intact', () => {
      expect(normalizeVietnameseFullName('TS. Nguyễn Văn Minh')).toBe('TS. Nguyễn Văn Minh');
    });

    it('fixes 2-word reversed name "Linh Lý" -> "Lý Linh"', () => {
      expect(normalizeVietnameseFullName('Linh Lý')).toBe('Lý Linh');
    });

    it('keeps 2-word ordered name "Lý Linh" intact', () => {
      expect(normalizeVietnameseFullName('Lý Linh')).toBe('Lý Linh');
    });

    it('keeps 3-word standard names intact', () => {
      expect(normalizeVietnameseFullName('Đỗ Hoàng Long')).toBe('Đỗ Hoàng Long');
      expect(normalizeVietnameseFullName('Mai Đình Phong')).toBe('Mai Đình Phong');
      expect(normalizeVietnameseFullName('Quách Quang Khải')).toBe('Quách Quang Khải');
      expect(normalizeVietnameseFullName('Lý Văn Khoa')).toBe('Lý Văn Khoa');
    });
  });

  describe('formatFullName', () => {
    it('reorders first_name "Hà Linh" and last_name "Lý" to "Lý Hà Linh"', () => {
      expect(formatFullName('Hà Linh', 'Lý')).toBe('Lý Hà Linh');
    });

    it('handles user object with first_name "Hà Linh" and last_name "Lý"', () => {
      const user = { first_name: 'Hà Linh', last_name: 'Lý', username: '241106045' };
      expect(formatFullName(user)).toBe('Lý Hà Linh');
    });

    it('handles user object with full_name "Hà Linh Lý"', () => {
      const user = { full_name: 'Hà Linh Lý', username: '241106045' };
      expect(formatFullName(user)).toBe('Lý Hà Linh');
    });

    it('handles user object with username "Hà Linh Lý" when other fields empty', () => {
      const user = { username: 'Hà Linh Lý' };
      expect(formatFullName(user)).toBe('Lý Hà Linh');
    });

    it('handles traditional first_name "An" and last_name "Nguyễn Văn" -> "Nguyễn Văn An"', () => {
      expect(formatFullName('An', 'Nguyễn Văn')).toBe('Nguyễn Văn An');
    });

    it('handles first_name "Nguyễn Văn" and last_name "An" -> "Nguyễn Văn An"', () => {
      expect(formatFullName('Nguyễn Văn', 'An')).toBe('Nguyễn Văn An');
    });

    it('handles academic titles correctly', () => {
      expect(formatFullName('ThS. Nguyễn Thị', 'Hồng (Giáo Vụ)')).toBe('ThS. Nguyễn Thị Hồng (Giáo Vụ)');
      expect(formatFullName('PGS.TS. Trần Thị', 'Mai')).toBe('PGS.TS. Trần Thị Mai');
    });

    it('handles single string input "Hà Linh Lý"', () => {
      expect(formatFullName('Hà Linh Lý')).toBe('Lý Hà Linh');
    });

    it('handles empty / fallback cases gracefully', () => {
      expect(formatFullName(null, null, 'N/A')).toBe('N/A');
      expect(formatFullName(undefined)).toBe('');
    });
  });
});
