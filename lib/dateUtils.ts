import { format, formatDistanceToNow, type Locale } from 'date-fns';

/**
 * Parses any value (string, number, Date, Firestore Timestamp, or Timestamp-like object)
 * into a valid JavaScript Date, or returns null if invalid.
 */
export function parseSafeDate(value: any): Date | null {
  if (value === null || value === undefined || value === '') return null;

  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  // Firestore Timestamp with .toDate() or .toMillis() method
  if (typeof value === 'object') {
    if (typeof value.toDate === 'function') {
      try {
        const d = value.toDate();
        if (d instanceof Date && !isNaN(d.getTime())) return d;
      } catch {}
    }
    if (typeof value.toMillis === 'function') {
      try {
        const d = new Date(value.toMillis());
        if (d instanceof Date && !isNaN(d.getTime())) return d;
      } catch {}
    }
    // Firestore plain object { seconds: number, nanoseconds?: number }
    if (typeof value.seconds === 'number') {
      const d = new Date(value.seconds * 1000);
      if (!isNaN(d.getTime())) return d;
    }
  }

  // Numeric timestamp in milliseconds or seconds
  if (typeof value === 'number') {
    if (isNaN(value)) return null;
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  // String parsing
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed || trimmed === 'null' || trimmed === 'undefined' || trimmed === 'Invalid Date' || trimmed === 'NaN') {
      return null;
    }

    // Try standard constructor first
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d;

    // Check for DD/MM/YYYY or DD-MM-YYYY or YYYY/MM/DD or YYYY-MM-DD
    const parts = trimmed.split(/[\/\-\.]/);
    if (parts.length === 3) {
      const p0 = Number(parts[0]);
      const p1 = Number(parts[1]);
      const p2 = Number(parts[2]);
      if (parts[0].length === 4 && !isNaN(p0) && !isNaN(p1) && !isNaN(p2)) {
        // YYYY-MM-DD
        const parsed = new Date(p0, p1 - 1, p2);
        if (!isNaN(parsed.getTime())) return parsed;
      } else if (parts[2].length === 4 && !isNaN(p0) && !isNaN(p1) && !isNaN(p2)) {
        // DD-MM-YYYY
        const parsed = new Date(p2, p1 - 1, p0);
        if (!isNaN(parsed.getTime())) return parsed;
      }
    }
  }

  return null;
}

/**
 * Returns true if the value can be resolved to a valid Date.
 */
export function isValidDate(value: any): boolean {
  return parseSafeDate(value) !== null;
}

/**
 * Safely formats a date-like value with date-fns format.
 * Returns fallback if the date is invalid or formatting throws.
 */
export function safeFormat(
  value: any,
  formatStr: string,
  options?: { locale?: Locale; weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6; firstWeekContainsDate?: 1 | 4; useAdditionalWeekYearTokens?: boolean; useAdditionalDayOfYearTokens?: boolean },
  fallback: string = ''
): string {
  const d = parseSafeDate(value);
  if (!d) return fallback;
  try {
    return format(d, formatStr, options);
  } catch {
    return fallback;
  }
}

/**
 * Safely formats distance to now with date-fns formatDistanceToNow.
 * Returns fallback if the date is invalid or formatting throws.
 */
export function safeFormatDistanceToNow(
  value: any,
  options?: { addSuffix?: boolean; unit?: 'second' | 'minute' | 'hour' | 'day' | 'month' | 'year'; roundTo?: 'floor' | 'ceil' | 'round'; locale?: Locale },
  fallback: string = ''
): string {
  const d = parseSafeDate(value);
  if (!d) return fallback;
  try {
    return formatDistanceToNow(d, options);
  } catch {
    return fallback;
  }
}
