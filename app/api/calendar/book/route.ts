import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { createCalendarEvent } from '@/lib/googleCalendar';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, slot, guestName, guestEmail } = body;

    if (!userId || !slot || !guestName || !guestEmail) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    // 1. Get user and token
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data();
    const token = userData.calendarToken;
    if (!token) {
      return NextResponse.json({ error: 'User has no calendar token' }, { status: 400 });
    }

    // 2. Prepare event payload
    const startDate = new Date(slot);
    const endDate = new Date(startDate.getTime() + 30 * 60000); // 30 min duration

    const googleEventPayload = {
      summary: `Meeting: ${userData.displayName} & ${guestName}`,
      description: `Meeting booked via Unfract MVP.\nGuest Name: ${guestName}\nGuest Email: ${guestEmail}`,
      start: {
        dateTime: startDate.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: endDate.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      attendees: [
        { email: guestEmail }
      ],
      conferenceData: {
        createRequest: {
          requestId: Math.random().toString(36).substring(7),
          conferenceSolutionKey: {
            type: 'hangoutsMeet'
          }
        }
      }
    };

    // 3. Create event
    const event = await createCalendarEvent(token, googleEventPayload);
    if (!event) {
      throw new Error('Failed to create Google Calendar event');
    }

    return NextResponse.json({ success: true, event });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
