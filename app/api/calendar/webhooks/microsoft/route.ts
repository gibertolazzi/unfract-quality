import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getValidAccessToken } from '@/lib/oauth';
import { resolveChannel } from '@/lib/server/calendarChannels';

// Microsoft Graph Webhook for Calendar
export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const validationToken = url.searchParams.get('validationToken');

    // MS Graph initially sends a validationToken to verify the endpoint
    if (validationToken) {
      return new NextResponse(validationToken, { 
        status: 200, 
        headers: { 'Content-Type': 'text/plain' } 
      });
    }

    const body = await req.json();
    const notifications = body.value;

    if (!notifications || !Array.isArray(notifications)) {
      return new NextResponse('OK', { status: 200 });
    }

    const batch = adminDb.batch();

    for (const notification of notifications) {
      // L'utente si ricava dalla subscription salvata alla registrazione, e solo
      // se clientState è il segreto giusto. Prima clientState ERA lo userId.
      const userId = await resolveChannel(notification.subscriptionId, 'microsoft', notification.clientState);
      const msEventId = notification.resourceData?.id;

      if (!userId || typeof msEventId !== 'string' || !msEventId) continue;

      const msToken = await getValidAccessToken(userId, 'microsoft');
      if (!msToken) continue;

      // Microsoft gives us the exact resource URL to fetch the updated event
      // e.g. "Users/id/Events/eventId"
      // Wait, let's just query Unfract Firestore to see if we track this event
      const unfractEventsQuery = await adminDb.collection(`users/${userId}/events`).where('microsoftEventId', '==', msEventId).get();
      
      if (unfractEventsQuery.empty) continue;
      const doc = unfractEventsQuery.docs[0];

      if (notification.changeType === 'deleted') {
        // Si cancella solo se Microsoft conferma che l'evento non esiste più.
        const check = await fetch(`https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(msEventId)}`, {
          headers: { Authorization: `Bearer ${msToken}` }
        });
        if (check.status === 404 || check.status === 410) batch.delete(doc.ref);
      } else if (notification.changeType === 'updated') {
        // Fetch the event from MS Graph to get the new times
        const res = await fetch(`https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(msEventId)}`, {
          headers: { Authorization: `Bearer ${msToken}` }
        });
        
        if (res.ok) {
          const msEvent = await res.json();
          const newStart = msEvent.start?.dateTime;
          const newEnd = msEvent.end?.dateTime;

          if (newStart && newEnd) {
             const startDateObj = new Date(newStart + 'Z'); // MS returns UTC without Z sometimes
             const endDateObj = new Date(newEnd + 'Z');
             
             batch.update(doc.ref, {
               title: msEvent.subject || doc.data().title,
               date: startDateObj.toISOString(),
               startTime: `${startDateObj.getHours().toString().padStart(2, '0')}:${startDateObj.getMinutes().toString().padStart(2, '0')}`,
               endTime: `${endDateObj.getHours().toString().padStart(2, '0')}:${endDateObj.getMinutes().toString().padStart(2, '0')}`,
             });
          }
        }
      }
    }

    await batch.commit();

    return new NextResponse('OK', { status: 200 });
  } catch (error) {
    console.error('Microsoft Webhook Error:', error);
    return new NextResponse('OK', { status: 200 }); 
  }
}
