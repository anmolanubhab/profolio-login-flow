/**
 * Safe utility functions to prevent null/undefined errors
 */

// Safe string operations
export const safeString = (value: unknown, fallback = ''): string => {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return fallback;
  return String(value);
};

// Safe array operations
export const safeArray = <T>(value: T[] | null | undefined, fallback: T[] = []): T[] => {
  return Array.isArray(value) ? value : fallback;
};

// Safe object access
export const safeGet = <T>(obj: Record<string, unknown> | null | undefined, key: string, fallback: T): T => {
  if (!obj || typeof obj !== 'object') return fallback;
  const value = obj[key];
  return value !== undefined && value !== null ? (value as T) : fallback;
};

// Safe number parsing
export const safeNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && !isNaN(value)) return value;
  const parsed = Number(value);
  return isNaN(parsed) ? fallback : parsed;
};

// Safe JSON parsing
export const safeJsonParse = <T>(json: string | null | undefined, fallback: T): T => {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
};

// Safe date formatting
export const safeDate = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
};

// Safe format time ago
export const formatTimeAgo = (timestamp: string | null | undefined): string => {
  if (!timestamp) return 'Unknown';
  const date = safeDate(timestamp);
  if (!date) return 'Unknown';
  
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  
  if (diffInDays === 0) return 'Today';
  if (diffInDays === 1) return 'Yesterday';
  if (diffInDays < 7) return `${diffInDays} days ago`;
  if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
  return `${Math.floor(diffInDays / 30)} months ago`;
};

// Safe salary formatting
export const formatSalary = (
  min: number | null | undefined,
  max: number | null | undefined,
  currency: string | null | undefined
): string | null => {
  if (!min && !max) return null;
  const curr = currency || 'USD';
  if (min && max) return `${curr} ${min.toLocaleString()} - ${max.toLocaleString()}`;
  if (min) return `${curr} ${min.toLocaleString()}+`;
  return `Up to ${curr} ${max?.toLocaleString()}`;
};

// Safe truncate text
export const truncateText = (text: string | null | undefined, maxLength: number): string => {
  const str = safeString(text);
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '...';
};

// Safe email extraction
export const extractEmailUsername = (email: string | null | undefined): string => {
  const str = safeString(email);
  return str.split('@')[0] || 'User';
};

// Check if object is empty
export const isEmpty = (obj: unknown): boolean => {
  if (obj === null || obj === undefined) return true;
  if (typeof obj === 'string') return obj.trim() === '';
  if (Array.isArray(obj)) return obj.length === 0;
  if (typeof obj === 'object') return Object.keys(obj).length === 0;
  return false;
};
