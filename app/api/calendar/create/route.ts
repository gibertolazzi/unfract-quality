import { NextResponse } from 'next/server';
import { getValidAccessToken } from '@/lib/oauth';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, event, isUpdate, startDateISO, endDateISO } = body;

    if (!userId || !event || !startDateISO || !endDateISO) {
      return NextResponse.json({ error: 'Missing required data' }, { status: 400 });
    }
    
    // Instead of using Intl.DateTimeFormat().resolvedOptions().timeZone which is server-based,
    // we just use the raw ISO strings which end in Z (UTC). Google and MS accept UTC perfectly.
    let googleMeetLink = null;
    let microsoftTeamsLink = null;
    let googleEventId = event.googleEventId || null;
    let microsoftEventId = event.microsoftEventId || null;

    // 1. Google Calendar Sync
    const googleToken = await getValidAccessToken(userId, 'google');
    if (googleToken) {
      const googlePayload: any = {
        summary: event.title,
        description: event.description,
        start: { dateTime: startDateISO },
        end: { dateTime: endDateISO },
      };

      if (event.guestEmail) {
        googlePayload.attendees = [{ email: event.guestEmail }];
      }

      if (event.addMeet && !googleEventId) {
        googlePayload.conferenceData = {
          createRequest: {
            requestId: `unfract-${event.id || Math.random().toString(36).substring(7)}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' }
          }
        };
      }

      const method = (isUpdate && googleEventId) ? 'PUT' : 'POST';
      const url = (isUpdate && googleEventId) 
        ? `https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`
        : 'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1';

      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${googleToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(googlePayload),
      });

      if (res.ok) {
        const data = await res.json();
        googleEventId = data.id;
        if (data.hangoutLink) {
          googleMeetLink = data.hangoutLink;
        }
      } else {
        console.error('Google Calendar API Error:', await res.text());
      }
    }

    // 2. Microsoft Calendar Sync
    const microsoftToken = await getValidAccessToken(userId, 'microsoft');
    if (microsoftToken) {
      const microsoftPayload: any = {
        subject: event.title,
        body: { contentType: 'HTML', content: event.description || '' },
        start: { dateTime: startDateISO, timeZone: 'UTC' },
        end: { dateTime: endDateISO, timeZone: 'UTC' },
      };

      if (event.guestEmail) {
        microsoftPayload.attendees = [
          { emailAddress: { address: event.guestEmail }, type: 'required' }
        ];
      }

      if (event.addMeet && !microsoftEventId) {
        microsoftPayload.isOnlineMeeting = true;
        microsoftPayload.onlineMeetingProvider = 'teamsForBusiness';
      }

      const method = (isUpdate && microsoftEventId) ? 'PATCH' : 'POST';
      const url = (isUpdate && microsoftEventId)
        ? `https://graph.microsoft.com/v1.0/me/events/${microsoftEventId}`
        : 'https://graph.microsoft.com/v1.0/me/events';

      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${microsoftToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(microsoftPayload),
      });

      if (res.ok) {
        const data = await res.json();
        microsoftEventId = data.id;
        if (data.onlineMeeting?.joinUrl) {
          microsoftTeamsLink = data.onlineMeeting.joinUrl;
        }
      } else {
        console.error('Microsoft Graph API Error:', await res.text());
      }
    }

    // 3. Update the event in Firestore
    const finalMeetLink = googleMeetLink || microsoftTeamsLink || event.meetLink || null;
    
    await adminDb.doc(`users/${userId}/events/${event.id}`).set({
      googleEventId: googleEventId || null,
      microsoftEventId: microsoftEventId || null,
      meetLink: finalMeetLink,
    }, { merge: true });

    return NextResponse.json({ 
      success: true, 
      meetLink: finalMeetLink, 
      googleEventId, 
      microsoftEventId 
    });

  } catch (error: any) {
    console.error('Calendar Create API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
