/**
 * Ore e giorni nel fuso dell'utente, calcolati sul server.
 *
 * In produzione il server lavora in UTC: `getHours()`, `setHours()` e
 * `getDay()` danno l'ora e il giorno di Greenwich, non quelli italiani. Gli
 * orari dei calendari sincronizzati e degli slot prenotabili risultavano
 * spostati di 1 o 2 ore (segnalazione Q01). Qui si passa sempre dal fuso
 * scelto dall'utente nelle impostazioni (`users/{uid}.settings.timezone`).
 */

export const DEFAULT_TIME_ZONE = 'Europe/Rome';

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Il fuso indicato, se il runtime lo conosce; altrimenti Europe/Rome. */
export function validTimeZone(timeZone: unknown): string {
  if (typeof timeZone !== 'string' || !timeZone) return DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return timeZone;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

export function userTimeZone(userData: Record<string, any> | undefined): string {
  return validTimeZone(userData?.settings?.timezone);
}

/** Data e ora di un istante nel fuso indicato. */
function partsInZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find(part => part.type === type)?.value);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute'), second: get('second') };
}

/** Quanti millisecondi il fuso è avanti rispetto a UTC in quell'istante. */
function offsetMs(instant: number, timeZone: string): number {
  const p = partsInZone(new Date(instant), timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(instant / 1000) * 1000;
}

export function isDay(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = value.match(DAY);
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toISOString().slice(0, 10) === value;
}

export function isTime(value: unknown): value is string {
  return typeof value === 'string' && TIME.test(value);
}

/**
 * L'istante in cui nel fuso indicato è `day` alle `time` (es. 2026-10-12,
 * 09:00, Europe/Rome → 07:00 UTC). Il cambio dell'ora legale è gestito.
 */
export function zonedTimeToUtc(day: string, time: string, timeZone: string): Date {
  const [year, month, date] = day.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const wallClock = Date.UTC(year, month - 1, date, hour, minute);
  const first = wallClock - offsetMs(wallClock, timeZone);
  const second = wallClock - offsetMs(first, timeZone);
  return new Date(second);
}

/** "HH:mm" di un istante nel fuso indicato. */
export function timeInZone(date: Date, timeZone: string): string {
  const p = partsInZone(date, timeZone);
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
}

/** "YYYY-MM-DD" di un istante nel fuso indicato. */
export function dayInZone(date: Date, timeZone: string): string {
  const p = partsInZone(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** Giorno della settimana di una data "YYYY-MM-DD" (0 = domenica). */
export function weekday(day: string): number {
  return new Date(`${day}T12:00:00Z`).getUTCDay();
}

export function nextDay(day: string): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

/**
 * Inizio di un evento di calendario. Gli eventi di tutto il giorno hanno solo
 * la data ("2026-10-12"): valgono dalla mezzanotte nel fuso dell'utente, non
 * da quella di Greenwich.
 */
export function eventInstant(value: string, timeZone: string): Date {
  return isDay(value) ? zonedTimeToUtc(value, '00:00', timeZone) : new Date(value);
}

/**
 * Inizio o fine di un evento di Outlook. Senza l'header Prefer, Microsoft
 * Graph dà gli orari in UTC senza la "Z"; gli eventi di tutto il giorno
 * valgono dalla mezzanotte nel fuso dell'utente.
 */
export function graphInstant(dateTime: string, isAllDay: boolean, timeZone: string): Date {
  return isAllDay ? zonedTimeToUtc(dateTime.slice(0, 10), '00:00', timeZone) : new Date(`${dateTime}Z`);
}
