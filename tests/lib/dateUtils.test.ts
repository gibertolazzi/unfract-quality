import { describe, expect, it } from 'vitest';
import { parseSafeDate, isValidDate, safeFormat, safeFormatDistanceToNow } from '@/lib/dateUtils';

describe('dateUtils', () => {
  describe('parseSafeDate', () => {
    it('handles null, undefined, empty string and whitespace', () => {
      expect(parseSafeDate(null)).toBeNull();
      expect(parseSafeDate(undefined)).toBeNull();
      expect(parseSafeDate('')).toBeNull();
      expect(parseSafeDate('   ')).toBeNull();
    });

    it('handles invalid string literals', () => {
      expect(parseSafeDate('null')).toBeNull();
      expect(parseSafeDate('undefined')).toBeNull();
      expect(parseSafeDate('Invalid Date')).toBeNull();
      expect(parseSafeDate('NaN')).toBeNull();
      expect(parseSafeDate('invalid-date-string')).toBeNull();
    });

    it('handles invalid Date objects without throwing', () => {
      const invalid = new Date('not-a-date');
      expect(parseSafeDate(invalid)).toBeNull();
      expect(isValidDate(invalid)).toBe(false);
    });

    it('handles valid Date instances', () => {
      const d = new Date('2026-10-14T12:00:00Z');
      expect(parseSafeDate(d)).toBe(d);
      expect(isValidDate(d)).toBe(true);
    });

    it('handles ISO date strings', () => {
      const parsed = parseSafeDate('2026-10-14');
      expect(parsed).toBeInstanceOf(Date);
      expect(parsed?.getFullYear()).toBe(2026);
    });

    it('handles European DD/MM/YYYY and DD-MM-YYYY formats', () => {
      const parsedSlash = parseSafeDate('14/10/2026');
      expect(parsedSlash).toBeInstanceOf(Date);
      expect(parsedSlash?.getDate()).toBe(14);
      expect(parsedSlash?.getMonth()).toBe(9); // 0-indexed October
      expect(parsedSlash?.getFullYear()).toBe(2026);

      const parsedDash = parseSafeDate('14-10-2026');
      expect(parsedDash).toBeInstanceOf(Date);
      expect(parsedDash?.getDate()).toBe(14);
    });

    it('handles Firestore Timestamp instances with toDate()', () => {
      const timestamp = {
        toDate: () => new Date('2026-10-14T10:00:00Z'),
      };
      const parsed = parseSafeDate(timestamp);
      expect(parsed).toBeInstanceOf(Date);
      expect(parsed?.toISOString()).toBe('2026-10-14T10:00:00.000Z');
    });

    it('handles Firestore plain objects with seconds', () => {
      const plainObj = { seconds: 1728854400, nanoseconds: 0 };
      const parsed = parseSafeDate(plainObj);
      expect(parsed).toBeInstanceOf(Date);
      expect(parsed?.getTime()).toBe(1728854400 * 1000);
    });

    it('handles numeric timestamps', () => {
      const ms = 1728854400000;
      const parsed = parseSafeDate(ms);
      expect(parsed).toBeInstanceOf(Date);
      expect(parsed?.getTime()).toBe(ms);
    });
  });

  describe('safeFormat', () => {
    it('returns formatted string for valid inputs', () => {
      expect(safeFormat('2026-10-14', 'yyyy-MM-dd')).toBe('2026-10-14');
    });

    it('returns fallback without throwing RangeError for invalid dates', () => {
      expect(safeFormat('invalid', 'yyyy-MM-dd', undefined, 'N/A')).toBe('N/A');
      expect(safeFormat(null, 'yyyy-MM-dd', undefined, 'N/A')).toBe('N/A');
      expect(safeFormat(new Date('invalid'), 'yyyy-MM-dd', undefined, 'N/A')).toBe('N/A');
      expect(safeFormat({ seconds: NaN }, 'yyyy-MM-dd', undefined, 'N/A')).toBe('N/A');
    });
  });

  describe('safeFormatDistanceToNow', () => {
    it('returns formatted distance for valid dates', () => {
      const now = new Date();
      expect(safeFormatDistanceToNow(now)).toBeTruthy();
    });

    it('returns fallback without throwing RangeError for invalid dates', () => {
      expect(safeFormatDistanceToNow('invalid-time', undefined, '—')).toBe('—');
      expect(safeFormatDistanceToNow(null, undefined, '—')).toBe('—');
      expect(safeFormatDistanceToNow(new Date(NaN), undefined, '—')).toBe('—');
    });
  });
});
