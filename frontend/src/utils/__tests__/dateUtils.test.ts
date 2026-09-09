import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getRelativeTime,
  formatDate,
  formatDateTime,
  formatShortDate,
  formatTime,
  isToday,
  isPastDate,
  getDaysDifference,
} from '../dateUtils';

describe('dateUtils', () => {
  const BASE_TIME = new Date('2026-03-10T12:00:00Z');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(BASE_TIME);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getRelativeTime in Vietnamese', () => {
    it('returns "Vừa xong" when date is within 60 seconds', () => {
      const past = new Date(BASE_TIME.getTime() - 30 * 1000);
      expect(getRelativeTime(past, 'vi')).toBe('Vừa xong');
    });

    it('returns "5 phút trước" for 5 minutes ago', () => {
      const past = new Date(BASE_TIME.getTime() - 5 * 60 * 1000);
      expect(getRelativeTime(past, 'vi')).toBe('5 phút trước');
    });

    it('returns "2 giờ trước" for 2 hours ago', () => {
      const past = new Date(BASE_TIME.getTime() - 2 * 60 * 60 * 1000);
      expect(getRelativeTime(past, 'vi')).toBe('2 giờ trước');
    });

    it('returns "3 ngày trước" for 3 days ago', () => {
      const past = new Date(BASE_TIME.getTime() - 3 * 24 * 60 * 60 * 1000);
      expect(getRelativeTime(past, 'vi')).toBe('3 ngày trước');
    });

    it('returns "2 tuần trước" for 14 days ago', () => {
      const past = new Date(BASE_TIME.getTime() - 14 * 24 * 60 * 60 * 1000);
      expect(getRelativeTime(past, 'vi')).toBe('2 tuần trước');
    });

    it('returns "1 tháng trước" for 35 days ago', () => {
      const past = new Date(BASE_TIME.getTime() - 35 * 24 * 60 * 60 * 1000);
      expect(getRelativeTime(past, 'vi')).toBe('1 tháng trước');
    });

    it('returns "1 năm trước" for 400 days ago', () => {
      const past = new Date(BASE_TIME.getTime() - 400 * 24 * 60 * 60 * 1000);
      expect(getRelativeTime(past, 'vi')).toBe('1 năm trước');
    });

    it('returns empty string for null, undefined, or invalid date', () => {
      expect(getRelativeTime(null)).toBe('');
      expect(getRelativeTime(undefined)).toBe('');
      expect(getRelativeTime('invalid-date-string')).toBe('');
    });
  });

  describe('getRelativeTime in English', () => {
    it('returns "Just now" for recent times in en locale', () => {
      const past = new Date(BASE_TIME.getTime() - 20 * 1000);
      expect(getRelativeTime(past, 'en')).toBe('Just now');
    });

    it('returns "5 minutes ago" in en locale', () => {
      const past = new Date(BASE_TIME.getTime() - 5 * 60 * 1000);
      expect(getRelativeTime(past, 'en')).toBe('5 minutes ago');
    });

    it('returns "2 hours ago" in en locale', () => {
      const past = new Date(BASE_TIME.getTime() - 2 * 60 * 60 * 1000);
      expect(getRelativeTime(past, 'en')).toBe('2 hours ago');
    });

    it('returns "3 days ago" in en locale', () => {
      const past = new Date(BASE_TIME.getTime() - 3 * 24 * 60 * 60 * 1000);
      expect(getRelativeTime(past, 'en')).toBe('3 days ago');
    });
  });

  describe('Formatting helpers', () => {
    it('formatDate formats valid date', () => {
      const d = '2026-03-10T12:00:00Z';
      const formatted = formatDate(d, { year: 'numeric', month: 'numeric', day: 'numeric' }, 'en-US');
      expect(formatted).toBeDefined();
      expect(formatted.length).toBeGreaterThan(0);
    });

    it('formatShortDate and formatDateTime format dates properly', () => {
      const d = '2026-03-10T12:00:00Z';
      expect(formatShortDate(d).length).toBeGreaterThan(0);
      expect(formatDateTime(d, 'en-US').length).toBeGreaterThan(0);
    });

    it('formatTime formats HH:MM properly', () => {
      expect(formatTime('14:30')).toBe('2:30 PM');
      expect(formatTime('09:15')).toBe('9:15 AM');
      expect(formatTime('')).toBe('');
    });

    it('isToday correctly identifies today', () => {
      expect(isToday(BASE_TIME)).toBe(true);
      const yesterday = new Date(BASE_TIME.getTime() - 24 * 60 * 60 * 1000);
      expect(isToday(yesterday)).toBe(false);
    });

    it('isPastDate correctly identifies past date', () => {
      const past = new Date(BASE_TIME.getTime() - 48 * 60 * 60 * 1000);
      const future = new Date(BASE_TIME.getTime() + 48 * 60 * 60 * 1000);
      expect(isPastDate(past)).toBe(true);
      expect(isPastDate(future)).toBe(false);
    });

    it('getDaysDifference calculates days between dates', () => {
      const d1 = '2026-03-01';
      const d2 = '2026-03-10';
      expect(getDaysDifference(d1, d2)).toBe(9);
    });
  });
});
