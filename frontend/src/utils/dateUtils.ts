/**
 * Date utility functions for consistent date handling across the application.
 * Handles timezone issues and provides formatting helpers.
 */

/**
 * Formats a date string to a localized date.
 * Handles timezone issues by parsing ISO strings correctly.
 */
export const formatDate = (
  dateString: string | Date | undefined | null,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  },
  locale: string = 'en-US'
): string => {
  if (!dateString) return '';
  
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    
    // Check for invalid date
    if (isNaN(date.getTime())) {
      console.warn('Invalid date:', dateString);
      return '';
    }
    
    return date.toLocaleDateString(locale, options);
  } catch (error) {
    console.error('Error formatting date:', error);
    return '';
  }
};

/**
 * Formats a date string to a short date (e.g., "Jan 25, 2026").
 */
export const formatShortDate = (dateString: string | Date | undefined | null): string => {
  return formatDate(dateString, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

/**
 * Formats a date string to date and time.
 */
export const formatDateTime = (
  dateString: string | Date | undefined | null,
  locale: string = 'en-US'
): string => {
  return formatDate(dateString, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }, locale);
};

/**
 * Formats a time string (HH:MM or HH:MM:SS) to 12-hour format.
 */
export const formatTime = (timeString: string | undefined | null): string => {
  if (!timeString) return '';
  
  try {
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours, 10);
    
    if (isNaN(hour)) return timeString;
    
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    
    return `${hour12}:${minutes} ${ampm}`;
  } catch {
    return timeString;
  }
};

/**
 * Converts a date-only string (YYYY-MM-DD) to a Date object without timezone issues.
 * Useful for calendar/schedule displays.
 */
export const parseLocalDate = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

/**
 * Gets the relative time string (e.g., "2 hours ago", "3 days ago").
 */
export const getRelativeTime = (dateString: string | Date): string => {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 0) {
    // Future date
    const futureDiff = Math.abs(diffInSeconds);
    if (futureDiff < 60) return 'in a few seconds';
    if (futureDiff < 3600) return `in ${Math.floor(futureDiff / 60)} minutes`;
    if (futureDiff < 86400) return `in ${Math.floor(futureDiff / 3600)} hours`;
    if (futureDiff < 604800) return `in ${Math.floor(futureDiff / 86400)} days`;
    return formatShortDate(date);
  }
  
  // Past date
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 604800)} weeks ago`;
  
  return formatShortDate(date);
};

/**
 * Checks if a date is today.
 */
export const isToday = (dateString: string | Date): boolean => {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  const today = new Date();
  
  return date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
};

/**
 * Checks if a date is in the past.
 */
export const isPastDate = (dateString: string | Date): boolean => {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return date < today;
};

/**
 * Gets the start and end of a month for calendar displays.
 */
export const getMonthBounds = (year: number, month: number): { start: Date; end: Date } => {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  
  return { start, end };
};

/**
 * Generates an array of days for a calendar month view.
 * Includes padding for the start of the week.
 */
export const getCalendarDays = (year: number, month: number): (number | null)[] => {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPadding = firstDay.getDay();
  const totalDays = lastDay.getDate();
  
  const days: (number | null)[] = [];
  
  // Add padding for days before the 1st
  for (let i = 0; i < startPadding; i++) {
    days.push(null);
  }
  
  // Add the actual days
  for (let i = 1; i <= totalDays; i++) {
    days.push(i);
  }
  
  return days;
};

/**
 * Formats a date for API submission (YYYY-MM-DD).
 */
export const toAPIDateFormat = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

/**
 * Gets the difference between two dates in days.
 */
export const getDaysDifference = (date1: Date | string, date2: Date | string): number => {
  const d1 = typeof date1 === 'string' ? new Date(date1) : date1;
  const d2 = typeof date2 === 'string' ? new Date(date2) : date2;
  
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};
