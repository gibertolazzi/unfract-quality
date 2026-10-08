import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getValidAccessToken } from '@/lib/oauth';
import { requireUser } from '@/lib/server/auth';
import { eventInstant, graphInstant, timeInZone, userTimeZone } from '@/lib/server/timeZone';

/** I campi usati degli eventi di Google Calendar e di Microsoft Graph. */
interface EventTime { dateTime?: string; date?: string }
interface GoogleEvent {
  id: string;
  summary?: string;
  description?: string;
  hangoutLink?: string;
  start?: EventTime;
  end?: EventTime;
}
interface GraphEvent {
  id: string;
  subject?: string;
  bodyPreview?: string;
  isAllDay?: boolean;
  start?: EventTime;
  end?: EventTime;
  onlineMeeting?: { joinUrl?: string } | null;
}
type SyncedEvent = Record<string, string | boolean | null>;

export async function GET(req: Request) {
  // L'utente viene dal token: prima bastava un `userId` nella query per leggere il calendario di chiunque.
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  const userId = auth.user.uid;

  const { searchParams } = new URL(req.url);
  const timeMin = searchParams.get('timeMin');
  const timeMax = searchParams.get('timeMax');

  if (!timeMin || !timeMax) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  try {
    const events: SyncedEvent[] = [];
    // Il browser ricalcola data e orari dagli istanti ISO; il fuso serve qui per
    // gli eventi di tutto il giorno, che valgono dalla mezzanotte dell'utente.
    const timeZone = userTimeZone((await adminDb.collection('users').doc(userId).get()).data());

    // 1. Fetch Google Events
    const googleToken = await getValidAccessToken(userId, 'google');
    if (googleToken) {
      const gUrl = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
      gUrl.searchParams.append('timeMin', timeMin);
      gUrl.searchParams.append('timeMax', timeMax);
      gUrl.searchParams.append('singleEvents', 'true');
      gUrl.searchParams.append('orderBy', 'startTime');

      const gRes = await fetch(gUrl.toString(), {
        headers: { Authorization: `Bearer ${googleToken}` }
      });
      
      if (gRes.ok) {
        const gData = await gRes.json();
        const gItems = gData.items || [];
        gItems.forEach((e: GoogleEvent) => {
          const start = eventInstant(e.start?.dateTime || e.start?.date || '', timeZone);
          const end = eventInstant(e.end?.dateTime || e.end?.date || '', timeZone);
          events.push({
            id: `google-${e.id}`,
            googleEventId: e.id,
            title: e.summary || 'Google Event',
            date: start.toISOString(),
            startISO: start.toISOString(),
            endISO: end.toISOString(),
            startTime: timeInZone(start, timeZone),
            endTime: timeInZone(end, timeZone),
            description: e.description || '',
            meetLink: e.hangoutLink || null,
            color: 'bg-white/10',
            textColor: 'text-white',
            isExternal: true
          });
        });
      }
    }

    // 2. Fetch Microsoft Events
    const msToken = await getValidAccessToken(userId, 'microsoft');
    if (msToken) {
      const mUrl = new URL('https://graph.microsoft.com/v1.0/me/calendarview');
      mUrl.searchParams.append('startDateTime', timeMin);
      mUrl.searchParams.append('endDateTime', timeMax);

      const mRes = await fetch(mUrl.toString(), {
        headers: { Authorization: `Bearer ${msToken}` }
      });

      if (mRes.ok) {
        const mData = await mRes.json();
        const mItems = mData.value || [];
        mItems.forEach((e: GraphEvent) => {
          const start = graphInstant(String(e.start?.dateTime), !!e.isAllDay, timeZone);
          const end = graphInstant(String(e.end?.dateTime), !!e.isAllDay, timeZone);
          events.push({
            id: `microsoft-${e.id}`,
            microsoftEventId: e.id,
            title: e.subject || 'Outlook Event',
            date: start.toISOString(),
            startISO: start.toISOString(),
            endISO: end.toISOString(),
            startTime: timeInZone(start, timeZone),
            endTime: timeInZone(end, timeZone),
            description: e.bodyPreview || '',
            meetLink: e.onlineMeeting?.joinUrl || null,
            color: 'bg-[#006AFF]/20',
            textColor: 'text-[#00A6FF]',
            isExternal: true
          });
        });
      }
    }

    return NextResponse.json({ events });
  } catch (err) {
    console.error('Sync Error:', err);
    return NextResponse.json({ error: 'Sincronizzazione del calendario non riuscita.' }, { status: 500 });
  }
}
