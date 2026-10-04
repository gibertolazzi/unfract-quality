import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getValidAccessToken } from '@/lib/oauth';

// Google will call this endpoint whenever an event changes on the connected calendar
export async function POST(req: Request) {
  try {
    const channelId = req.headers.get('x-goog-channel-id');
    const resourceState = req.headers.get('x-goog-resource-state');
    
    // x-goog-channel-id should map to our userId so we know whose calendar updated
    // In a real production app, you would have a 'webhooks' collection to map channelId -> userId
    // For simplicity, let's assume channelId is \`google-webhook-\${userId}\`
    
    if (!channelId || !channelId.startsWith('google-webhook-')) {
      return new NextResponse('OK', { status: 200 }); // Acknowledge to prevent retries
    }

    const userId = channelId.replace('google-webhook-', '');

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
              const startDateObj = new Date(newStart);
              const endDateObj = new Date(newEnd);
              
              batch.update(doc.ref, {
                title: googleEvent.summary || doc.data().title,
                date: startDateObj.toISOString(),
                startTime: `${startDateObj.getHours().toString().padStart(2, '0')}:${startDateObj.getMinutes().toString().padStart(2, '0')}`,
                endTime: `${endDateObj.getHours().toString().padStart(2, '0')}:${endDateObj.getMinutes().toString().padStart(2, '0')}`,
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
