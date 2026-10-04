import { NextResponse } from 'next/server';
import { getValidAccessToken } from '@/lib/oauth';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  const timeMin = searchParams.get('timeMin');
  const timeMax = searchParams.get('timeMax');

  if (!userId || !timeMin || !timeMax) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  try {
    const events: any[] = [];

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
        gItems.forEach((e: any) => {
          const start = e.start?.dateTime ? new Date(e.start.dateTime) : new Date(e.start?.date);
          const end = e.end?.dateTime ? new Date(e.end.dateTime) : new Date(e.end?.date);
          events.push({
            id: `google-${e.id}`,
            googleEventId: e.id,
            title: e.summary || 'Google Event',
            date: start.toISOString(),
            startISO: start.toISOString(),
            endISO: end.toISOString(),
            startTime: `${start.getHours().toString().padStart(2, '0')}:${start.getMinutes().toString().padStart(2, '0')}`,
            endTime: `${end.getHours().toString().padStart(2, '0')}:${end.getMinutes().toString().padStart(2, '0')}`,
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
        mItems.forEach((e: any) => {
          const start = new Date(e.start?.dateTime + 'Z');
          const end = new Date(e.end?.dateTime + 'Z');
          events.push({
            id: `microsoft-${e.id}`,
            microsoftEventId: e.id,
            title: e.subject || 'Outlook Event',
            date: start.toISOString(),
            startISO: start.toISOString(),
            endISO: end.toISOString(),
            startTime: `${start.getHours().toString().padStart(2, '0')}:${start.getMinutes().toString().padStart(2, '0')}`,
            endTime: `${end.getHours().toString().padStart(2, '0')}:${end.getMinutes().toString().padStart(2, '0')}`,
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
  } catch (err: any) {
    console.error('Sync Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
