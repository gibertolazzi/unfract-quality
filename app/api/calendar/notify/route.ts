import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { adminDb } from '@/lib/firebase-admin';
import { getCalendarEventEmailHtml } from '@/lib/emailTemplates';
import { requireUser } from '@/lib/server/auth';
import { tooManyRequests } from '@/lib/server/rateLimit';

export const runtime = 'nodejs';

type Action = 'create' | 'update' | 'cancel';
const ACTIONS = new Set<Action>(['create', 'update', 'cancel']);

function formatDateForIcs(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function generateIcs(event: { id: string; title: string; description: string; start: Date; end: Date }, method: 'REQUEST' | 'CANCEL') {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Unfract//Calendar//IT',
    `METHOD:${method}`,
    'BEGIN:VEVENT',
    `UID:${event.id}@unfract.com`,
    `DTSTAMP:${formatDateForIcs(new Date())}`,
    `DTSTART:${formatDateForIcs(event.start)}`,
    `DTEND:${formatDateForIcs(event.end)}`,
    `SUMMARY:${event.title}`,
    `DESCRIPTION:${event.description}`,
    'STATUS:' + (method === 'CANCEL' ? 'CANCELLED' : 'CONFIRMED'),
    'SEQUENCE:' + (method === 'CANCEL' ? '1' : '0'),
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

function formatDate(date: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('it-IT', { timeZone, day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
  } catch {
    return new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
  }
}

/**
 * Email all'ospite di un evento, con allegato .ics.
 *
 * L'evento lo legge il server dal calendario Unfract dell'utente collegato:
 * titolo, descrizione e ospite non arrivano più dal client. Prima la route
 * spediva a qualsiasi indirizzo qualsiasi testo, senza login.
 *
 * Gli istanti di inizio e fine li calcola il browser (`startISO`, `endISO`),
 * che conosce il fuso dell'utente; il server non deve indovinarlo.
 */
export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const { user } = auth;

  if (tooManyRequests(`calendar-notify:${user.uid}`, 30)) {
    return NextResponse.json({ error: 'Troppi invii in poco tempo. Riprova fra un minuto.' }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const eventId = typeof body?.eventId === 'string' ? body.eventId : '';
  const action: Action = ACTIONS.has(body?.action) ? body.action : 'create';
  const start = new Date(typeof body?.startISO === 'string' ? body.startISO : NaN);
  const end = new Date(typeof body?.endISO === 'string' ? body.endISO : NaN);
  const timeZone = typeof body?.timeZone === 'string' ? body.timeZone : 'Europe/Rome';

  if (!eventId || eventId.includes('/') || isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
    return NextResponse.json({ error: 'Dati dell’evento non validi.' }, { status: 400 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.error('Calendar notify not configured: missing RESEND_API_KEY');
    return NextResponse.json({ error: 'Invio email non configurato sul server.' }, { status: 500 });
  }

  try {
    const snapshot = await adminDb.doc(`users/${user.uid}/events/${eventId}`).get();
    const event = snapshot.data();
    if (!event) {
      return NextResponse.json({ error: 'Evento non trovato.' }, { status: 404 });
    }
    const guestEmail = typeof event.guestEmail === 'string' ? event.guestEmail : '';
    if (!guestEmail) {
      return NextResponse.json({ error: 'L’evento non ha un ospite.' }, { status: 400 });
    }

    const title = typeof event.title === 'string' && event.title ? event.title : 'Evento Unfract';
    const method = action === 'cancel' ? 'CANCEL' : 'REQUEST';
    const ics = generateIcs({ id: eventId, title, description: event.description || '', start, end }, method);

    let subject = `Invito: ${title}`;
    if (action === 'update') subject = `Aggiornamento Orario: ${title}`;
    else if (action === 'cancel') subject = `Cancellazione: ${title}`;

    const resend = new Resend(resendKey);
    const { error } = await resend.emails.send({
      from: 'Unfract Calendar <calendar@unfract.com>',
      to: [guestEmail],
      subject,
      html: getCalendarEventEmailHtml({
        eventName: title,
        action,
        date: formatDate(start, timeZone),
        time: `${event.startTime || ''} - ${event.endTime || ''}`,
        inviterName: user.name,
      }),
      attachments: [{ filename: 'invite.ics', content: Buffer.from(ics).toString('base64') }],
    });

    if (error) {
      console.error('Resend rejected calendar email:', error);
      return NextResponse.json({ error: 'Il provider ha rifiutato l’invio.' }, { status: 502 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Calendar notify error:', error);
    return NextResponse.json({ error: 'Invio dell’email non riuscito.' }, { status: 500 });
  }
}
