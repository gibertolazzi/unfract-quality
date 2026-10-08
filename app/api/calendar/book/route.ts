import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { availableSlots, type BookingProvider } from '@/lib/server/bookingSlots';
import { tooManyRequestsShared } from '@/lib/server/rateLimit';
import { dayInZone, userTimeZone } from '@/lib/server/timeZone';

export const runtime = 'nodejs';

const USER_ID = /^[A-Za-z0-9_-]{1,128}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
const LOCKS = 'booking_locks';
const LOCK_TTL_MS = 2 * 60_000;

/**
 * Prenotazione dalla pagina pubblica `/book/{userId}`. Non serve il login.
 *
 * Prima usava l'SDK client di Firebase sul server, senza utente, e cercava un
 * `users/{id}.calendarToken` che nessuno scrive più: la prenotazione non
 * poteva riuscire (segnalazione Q02). E accettava qualsiasi orario, anche
 * fuori disponibilità o già occupato.
 *
 * Ora:
 * - legge l'utente con l'SDK admin e usa i token di `integrations/*`;
 * - ricalcola gli slot liberi di quel giorno e accetta solo uno di quelli;
 * - un blocco di due minuti su `booking_locks` impedisce che due ospiti
 *   prendano lo stesso slot nello stesso momento (dopo, l'evento è nel
 *   calendario e lo slot risulta occupato);
 * - crea l'evento su Google (con Meet) o, in mancanza, su Outlook (con Teams),
 *   e il calendario manda l'invito all'ospite.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const userId = typeof body?.userId === 'string' ? body.userId : '';
  const slot = new Date(typeof body?.slot === 'string' ? body.slot : NaN);
  const guestName = typeof body?.guestName === 'string' ? body.guestName.replace(/[\u0000-\u001f\u007f]/g, ' ').trim() : '';
  const guestEmail = typeof body?.guestEmail === 'string' ? body.guestEmail.trim() : '';

  if (!USER_ID.test(userId) || isNaN(slot.getTime()) || !guestName || guestName.length > 100
    || guestEmail.length > 254 || !EMAIL_PATTERN.test(guestEmail)) {
    return NextResponse.json({ error: 'Dati della prenotazione non validi.' }, { status: 400 });
  }

  // Ogni prenotazione manda un invito dal calendario dell'utente.
  if (await tooManyRequestsShared(`calendar-book:${userId}`, 5, 10 * 60_000)) {
    return NextResponse.json({ error: 'Troppe prenotazioni in poco tempo. Riprova fra qualche minuto.' }, { status: 429 });
  }

  const userDoc = await adminDb.collection('users').doc(userId).get();
  if (!userDoc.exists) {
    return NextResponse.json({ error: 'Utente non trovato.' }, { status: 404 });
  }
  const userData = userDoc.data() || {};
  const start = slot.toISOString();

  let day;
  try {
    day = await availableSlots(userId, userData, dayInZone(slot, userTimeZone(userData)));
  } catch (error) {
    console.error('Calendar book: slots not available:', error);
    return NextResponse.json({ error: 'Calendario non raggiungibile. Riprova più tardi.' }, { status: 502 });
  }
  if (!day.provider) {
    return NextResponse.json({ error: 'Questo utente non ha collegato un calendario.' }, { status: 409 });
  }
  if (!day.slots.includes(start)) {
    return NextResponse.json({ error: 'Questo orario non è più disponibile. Scegline un altro.' }, { status: 409 });
  }

  const lockRef = adminDb.collection(LOCKS).doc(`${userId}_${slot.getTime()}`);
  const locked = await adminDb.runTransaction(async transaction => {
    const lock = await transaction.get(lockRef);
    if (lock.exists && Number(lock.data()?.expiresAt) > Date.now()) return false;
    transaction.set(lockRef, { userId, start, expiresAt: Date.now() + LOCK_TTL_MS });
    return true;
  });
  if (!locked) {
    return NextResponse.json({ error: 'Questo orario non è più disponibile. Scegline un altro.' }, { status: 409 });
  }

  const end = new Date(slot.getTime() + day.bookingDuration * 60_000).toISOString();
  const hostName = typeof userData.displayName === 'string' && userData.displayName ? userData.displayName : 'Unfract';
  const event = {
    title: `Meeting: ${hostName} & ${guestName}`,
    description: `Prenotato da Unfract.\nOspite: ${guestName}\nEmail: ${guestEmail}`,
    start,
    end,
    timeZone: day.timeZone,
    guestName,
    guestEmail,
  };

  const provider = day.provider as BookingProvider;
  const created = provider === 'google'
    ? await createGoogleEvent(day.tokens.google!, event)
    : await createMicrosoftEvent(day.tokens.microsoft!, event);

  if (!created) {
    await lockRef.delete().catch(() => undefined);
    return NextResponse.json({ error: 'Il calendario non ha accettato la prenotazione. Riprova più tardi.' }, { status: 502 });
  }

  // All'ospite non si restituisce l'evento: conteneva dati del calendario dell'utente.
  return NextResponse.json({ success: true, start, end, provider });
}

type BookingEvent = {
  title: string; description: string; start: string; end: string; timeZone: string; guestName: string; guestEmail: string;
};

async function createGoogleEvent(token: string, event: BookingEvent): Promise<boolean> {
  // sendUpdates=all: senza, Google non manda l'invito all'ospite.
  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      summary: event.title,
      description: event.description,
      start: { dateTime: event.start, timeZone: event.timeZone },
      end: { dateTime: event.end, timeZone: event.timeZone },
      attendees: [{ email: event.guestEmail, displayName: event.guestName }],
      conferenceData: { createRequest: { requestId: randomUUID(), conferenceSolutionKey: { type: 'hangoutsMeet' } } },
    }),
  }).catch(error => {
    console.error('Google Calendar booking error:', error);
    return null;
  });
  if (!res?.ok) {
    console.error('Google Calendar booking rejected:', res?.status, await res?.text().catch(() => ''));
    return false;
  }
  return true;
}

async function createMicrosoftEvent(token: string, event: BookingEvent): Promise<boolean> {
  const res = await fetch('https://graph.microsoft.com/v1.0/me/events', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subject: event.title,
      body: { contentType: 'text', content: event.description },
      start: { dateTime: event.start.slice(0, 19), timeZone: 'UTC' },
      end: { dateTime: event.end.slice(0, 19), timeZone: 'UTC' },
      attendees: [{ emailAddress: { address: event.guestEmail, name: event.guestName }, type: 'required' }],
      isOnlineMeeting: true,
      onlineMeetingProvider: 'teamsForBusiness',
    }),
  }).catch(error => {
    console.error('Microsoft Graph booking error:', error);
    return null;
  });
  if (!res?.ok) {
    console.error('Microsoft Graph booking rejected:', res?.status, await res?.text().catch(() => ''));
    return false;
  }
  return true;
}
