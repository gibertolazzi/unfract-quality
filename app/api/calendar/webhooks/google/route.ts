import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getValidAccessToken } from '@/lib/oauth';
import { resolveChannel } from '@/lib/server/calendarChannels';
import { eventInstant, timeInZone, userTimeZone } from '@/lib/server/timeZone';

// Google will call this endpoint whenever an event changes on the connected calendar
export async function POST(req: Request) {
  try {
    const channelId = req.headers.get('x-goog-channel-id');
    const channelToken = req.headers.get('x-goog-channel-token');
    const resourceState = req.headers.get('x-goog-resource-state');

    // L'utente si ricava dal canale salvato alla registrazione, e solo se il
    // segreto corrisponde. Prima si ricavava dall'id del canale, che chiunque
    // poteva scrivere. I canali registrati con il vecchio schema non hanno
    // segreto e vengono ignorati: si riattivano ricollegando il calendario.
    const userId = await resolveChannel(channelId, 'google', channelToken);
    if (!userId) {
      return new NextResponse('OK', { status: 200 }); // 200 perché Google non riprovi
    }

    if (resourceState === 'sync') {
      console.log(`Google Webhook Sync successful for user ${userId}`);
      return new NextResponse('OK', { status: 200 });
    }

    // It's an update ('exists' or 'not_exists')
    // Since Google doesn't send the event payload in the webhook, we must fetch the latest changes (Sync Token logic).
    // For MVP hardcore sync: we fetch the latest events updated in the last 5 minutes.
    
    const googleToken = await getValidAccessToken(userId, 'google');
    if (!googleToken) {
      console.error(`Google Token not found for user ${userId} during webhook`);
      return new NextResponse('OK', { status: 200 });
    }

    const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?updatedMin=${encodeURIComponent(fiveMinsAgo)}&singleEvents=true`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${googleToken}` }
    });

    if (res.ok) {
      const data = await res.json();
      const updatedEvents = data.items || [];
      // Gli orari "HH:mm" salvati sull'evento vanno nel fuso dell'utente: il server è in UTC.
      const timeZone = userTimeZone((await adminDb.collection('users').doc(userId).get()).data());
      
      const batch = adminDb.batch();
      
      for (const googleEvent of updatedEvents) {
        // Find if we have this event in Unfract
        const unfractEventsQuery = await adminDb.collection(`users/${userId}/events`).where('googleEventId', '==', googleEvent.id).get();
        
        if (!unfractEventsQuery.empty) {
          const doc = unfractEventsQuery.docs[0];
          
          if (googleEvent.status === 'cancelled') {
            batch.delete(doc.ref);
          } else {
            // Update time and title
            const newStart = googleEvent.start?.dateTime || googleEvent.start?.date;
            const newEnd = googleEvent.end?.dateTime || googleEvent.end?.date;
            
            if (newStart && newEnd) {
              const startDateObj = eventInstant(newStart, timeZone);
              const endDateObj = eventInstant(newEnd, timeZone);
              
              batch.update(doc.ref, {
                title: googleEvent.summary || doc.data().title,
                date: startDateObj.toISOString(),
                startTime: timeInZone(startDateObj, timeZone),
                endTime: timeInZone(endDateObj, timeZone),
              });
            }
          }
        }
      }
      
      await batch.commit();
      console.log(`Synced ${updatedEvents.length} events from Google for user ${userId}`);
    }

    return new NextResponse('OK', { status: 200 });
  } catch (error) {
    console.error('Google Webhook Error:', error);
    return new NextResponse('OK', { status: 200 }); // Always 200 so Google stops retrying
  }
}
