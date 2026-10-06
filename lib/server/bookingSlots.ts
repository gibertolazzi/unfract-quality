import { getValidAccessToken } from '@/lib/oauth';
import { isTime, nextDay, userTimeZone, weekday, zonedTimeToUtc } from '@/lib/server/timeZone';

/**
 * Orari prenotabili dalla pagina pubblica `/book/{userId}`.
 *
 * La disponibilità ("09:00–18:00 dal lunedì al venerdì") è nel fuso di chi
 * riceve le prenotazioni: gli slot si calcolano lì e si restituiscono come
 * istanti ISO, che il browser dell'ospite mostra nella sua ora locale.
 * Lo stesso calcolo lo rifà la prenotazione, per accettare solo slot liberi.
 */

export type BookingProvider = 'google' | 'microsoft';

export interface DaySlots {
  slots: string[];
  timeZone: string;
  bookingDuration: number;
  /** Il calendario su cui si crea l'evento; `null` se l'utente non ne ha collegato uno. */
  provider: BookingProvider | null;
  tokens: Partial<Record<BookingProvider, string>>;
}

const DEFAULT_AVAILABILITY: Record<string, { enabled: boolean; intervals: { start: string; end: string }[] }> = {
  0: { enabled: false, intervals: [] },
  1: { enabled: true, intervals: [{ start: '09:00', end: '18:00' }] },
  2: { enabled: true, intervals: [{ start: '09:00', end: '18:00' }] },
  3: { enabled: true, intervals: [{ start: '09:00', end: '18:00' }] },
  4: { enabled: true, intervals: [{ start: '09:00', end: '18:00' }] },
  5: { enabled: true, intervals: [{ start: '09:00', end: '18:00' }] },
  6: { enabled: false, intervals: [] },
};

export function bookingDurationOf(userData: Record<string, any>): number {
  const minutes = Number(userData.bookingDuration);
  return Number.isInteger(minutes) && minutes >= 5 && minutes <= 480 ? minutes : 30;
}

type Busy = { start: Date; end: Date };

async function googleBusy(token: string, timeMin: string, timeMax: string): Promise<Busy[]> {
  const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
  url.searchParams.append('timeMin', timeMin);
  url.searchParams.append('timeMax', timeMax);
  url.searchParams.append('singleEvents', 'true');
  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Google Calendar ha risposto ${res.status}`);
  const data = await res.json();
  return (data.items || [])
    .filter((e: any) => e.start?.dateTime && e.end?.dateTime && e.status !== 'cancelled')
    .map((e: any) => ({ start: new Date(e.start.dateTime), end: new Date(e.end.dateTime) }));
}

async function microsoftBusy(token: string, timeMin: string, timeMax: string): Promise<Busy[]> {
  const url = new URL('https://graph.microsoft.com/v1.0/me/calendarview');
  url.searchParams.append('startDateTime', timeMin);
  url.searchParams.append('endDateTime', timeMax);
  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Microsoft Graph ha risposto ${res.status}`);
  const data = await res.json();
  // Senza l'header Prefer, Graph restituisce gli orari in UTC senza la "Z".
  return (data.value || [])
    .filter((e: any) => e.start?.dateTime && e.end?.dateTime && !e.isCancelled)
    .map((e: any) => ({ start: new Date(`${e.start.dateTime}Z`), end: new Date(`${e.end.dateTime}Z`) }));
}

/**
 * Slot liberi di `day` ("YYYY-MM-DD", nel fuso dell'utente). Se un calendario
 * collegato non risponde lancia un errore: meglio nessuno slot che slot
 * occupati mostrati come liberi.
 */
export async function availableSlots(userId: string, userData: Record<string, any>, day: string, now = new Date()): Promise<DaySlots> {
  const timeZone = userTimeZone(userData);
  const bookingDuration = bookingDurationOf(userData);

  const tokens: Partial<Record<BookingProvider, string>> = {};
  const google = await getValidAccessToken(userId, 'google');
  if (google) tokens.google = google;
  const microsoft = await getValidAccessToken(userId, 'microsoft');
  if (microsoft) tokens.microsoft = microsoft;
  const provider: BookingProvider | null = tokens.google ? 'google' : tokens.microsoft ? 'microsoft' : null;

  const result: DaySlots = { slots: [], timeZone, bookingDuration, provider, tokens };
  if (!provider) return result;

  const availability = userData.availability || DEFAULT_AVAILABILITY;
  const daySettings = availability[String(weekday(day))];
  const intervals = (daySettings?.enabled && Array.isArray(daySettings.intervals) ? daySettings.intervals : [])
    .filter((interval: any) => isTime(interval?.start) && isTime(interval?.end));
  if (intervals.length === 0) return result;

  const timeMin = zonedTimeToUtc(day, '00:00', timeZone).toISOString();
  const timeMax = zonedTimeToUtc(nextDay(day), '00:00', timeZone).toISOString();
  const busy: Busy[] = [
    ...(tokens.google ? await googleBusy(tokens.google, timeMin, timeMax) : []),
    ...(tokens.microsoft ? await microsoftBusy(tokens.microsoft, timeMin, timeMax) : []),
  ];

  const step = bookingDuration * 60_000;
  for (const interval of intervals as { start: string; end: string }[]) {
    const intervalEnd = zonedTimeToUtc(day, interval.end, timeZone).getTime();
    for (let start = zonedTimeToUtc(day, interval.start, timeZone).getTime(); start + step <= intervalEnd; start += step) {
      const end = start + step;
      const free = !busy.some(b => start < b.end.getTime() && end > b.start.getTime());
      if (free && start > now.getTime()) result.slots.push(new Date(start).toISOString());
    }
  }
  result.slots = Array.from(new Set(result.slots)).sort();
  return result;
}
