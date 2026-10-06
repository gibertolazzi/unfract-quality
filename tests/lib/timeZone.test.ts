import { describe, expect, it } from 'vitest';
import {
  dayInZone, eventInstant, graphInstant, isDay, nextDay, timeInZone, userTimeZone, validTimeZone, weekday, zonedTimeToUtc,
} from '@/lib/server/timeZone';

describe('fuso dell’utente', () => {
  it('ora legale e ora solare di Roma', () => {
    expect(zonedTimeToUtc('2026-10-12', '09:00', 'Europe/Rome').toISOString()).toBe('2026-10-12T07:00:00.000Z');
    expect(zonedTimeToUtc('2026-11-02', '09:00', 'Europe/Rome').toISOString()).toBe('2026-11-02T08:00:00.000Z');
  });

  it('il giorno del cambio dell’ora', () => {
    // 25 ottobre 2026: alle 03:00 si torna alle 02:00.
    expect(zonedTimeToUtc('2026-10-25', '00:00', 'Europe/Rome').toISOString()).toBe('2026-10-24T22:00:00.000Z');
    expect(zonedTimeToUtc('2026-10-25', '09:00', 'Europe/Rome').toISOString()).toBe('2026-10-25T08:00:00.000Z');
    // 29 marzo 2026: alle 02:00 si passa alle 03:00.
    expect(zonedTimeToUtc('2026-03-29', '09:00', 'Europe/Rome').toISOString()).toBe('2026-03-29T07:00:00.000Z');
  });

  it('altri fusi', () => {
    expect(zonedTimeToUtc('2026-10-12', '09:00', 'America/New_York').toISOString()).toBe('2026-10-12T13:00:00.000Z');
    expect(zonedTimeToUtc('2026-10-12', '09:00', 'UTC').toISOString()).toBe('2026-10-12T09:00:00.000Z');
  });

  it('ora e giorno di un istante nel fuso', () => {
    const late = new Date('2026-10-12T22:30:00Z');
    expect(timeInZone(late, 'Europe/Rome')).toBe('00:30');
    expect(dayInZone(late, 'Europe/Rome')).toBe('2026-10-13');
    expect(timeInZone(late, 'UTC')).toBe('22:30');
  });

  it('eventi di tutto il giorno dalla mezzanotte dell’utente', () => {
    expect(eventInstant('2026-10-12', 'Europe/Rome').toISOString()).toBe('2026-10-11T22:00:00.000Z');
    expect(eventInstant('2026-10-12T09:00:00+02:00', 'Europe/Rome').toISOString()).toBe('2026-10-12T07:00:00.000Z');
    expect(graphInstant('2026-10-12T00:00:00.0000000', true, 'Europe/Rome').toISOString()).toBe('2026-10-11T22:00:00.000Z');
    expect(graphInstant('2026-10-12T07:00:00.0000000', false, 'Europe/Rome').toISOString()).toBe('2026-10-12T07:00:00.000Z');
  });

  it('fuso non valido o assente: Europe/Rome', () => {
    expect(validTimeZone('Mars/Olympus')).toBe('Europe/Rome');
    expect(validTimeZone(undefined)).toBe('Europe/Rome');
    expect(userTimeZone({ settings: { timezone: 'America/New_York' } })).toBe('America/New_York');
    expect(userTimeZone(undefined)).toBe('Europe/Rome');
  });

  it('date di calendario', () => {
    expect(isDay('2026-10-12')).toBe(true);
    expect(isDay('2026-02-30')).toBe(false);
    expect(isDay('2026-10-12T00:00:00.000Z')).toBe(false);
    expect(weekday('2026-10-12')).toBe(1);
    expect(nextDay('2026-10-31')).toBe('2026-11-01');
  });
});
