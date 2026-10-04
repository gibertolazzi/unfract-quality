import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getValidAccessToken } from '@/lib/oauth';
import { startOfDay, endOfDay, setHours, setMinutes } from 'date-fns';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const dateStr = searchParams.get('date');

  if (!userId || !dateStr) {
    return NextResponse.json({ error: 'Missing userId or date' }, { status: 400 });
  }

  try {
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data() || {};
    const bookingDuration = userData.bookingDuration || 30; 
    
    // Default availability if not set
    const defaultAvailability = {
      0: { enabled: false, intervals: [] }, // Sunday
      1: { enabled: true, intervals: [{ start: '09:00', end: '18:00' }] }, // Monday
      2: { enabled: true, intervals: [{ start: '09:00', end: '18:00' }] }, // Tuesday
      3: { enabled: true, intervals: [{ start: '09:00', end: '18:00' }] }, // Wednesday
      4: { enabled: true, intervals: [{ start: '09:00', end: '18:00' }] }, // Thursday
      5: { enabled: true, intervals: [{ start: '09:00', end: '18:00' }] }, // Friday
      6: { enabled: false, intervals: [] }, // Saturday
    };

    const availability = userData.availability || defaultAvailability;
    
    const targetDate = new Date(dateStr);
    const dayOfWeek = targetDate.getDay(); // 0 = Sun, 1 = Mon...
    
    const daySettings = availability[dayOfWeek.toString()];
    
    // If the day is completely disabled, return no slots immediately
    if (!daySettings || !daySettings.enabled || !daySettings.intervals || daySettings.intervals.length === 0) {
      return NextResponse.json({ 
        slots: [], 
        user: { displayName: userData.displayName, photoURL: userData.photoURL },
        bookingDuration
      });
    }

    const timeMin = startOfDay(targetDate).toISOString();
    const timeMax = endOfDay(targetDate).toISOString();

    const busyIntervals: { start: Date, end: Date }[] = [];

    // 1. Fetch Google Events
    const googleToken = await getValidAccessToken(userId, 'google');
    if (googleToken) {
      const gUrl = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
      gUrl.searchParams.append('timeMin', timeMin);
      gUrl.searchParams.append('timeMax', timeMax);
      gUrl.searchParams.append('singleEvents', 'true');

      const gRes = await fetch(gUrl.toString(), {
        headers: { Authorization: `Bearer ${googleToken}` }
      });
      if (gRes.ok) {
        const gData = await gRes.json();
        (gData.items || []).forEach((e: any) => {
          if (e.start?.dateTime && e.end?.dateTime) {
            busyIntervals.push({
              start: new Date(e.start.dateTime),
              end: new Date(e.end.dateTime)
            });
          }
        });
      }
    }

    // 2. Fetch Microsoft Events
    const microsoftToken = await getValidAccessToken(userId, 'microsoft');
    if (microsoftToken) {
      const mUrl = new URL('https://graph.microsoft.com/v1.0/me/calendarview');
      mUrl.searchParams.append('startDateTime', timeMin);
      mUrl.searchParams.append('endDateTime', timeMax);

      const mRes = await fetch(mUrl.toString(), {
        headers: { Authorization: `Bearer ${microsoftToken}` }
      });
      if (mRes.ok) {
        const mData = await mRes.json();
        (mData.value || []).forEach((e: any) => {
          if (e.start?.dateTime && e.end?.dateTime) {
            busyIntervals.push({
              start: new Date(e.start.dateTime + 'Z'),
              end: new Date(e.end.dateTime + 'Z')
            });
          }
        });
      }
    }

    // 3. Generate slots for each interval
    const slots: string[] = [];
    
    daySettings.intervals.forEach((interval: { start: string, end: string }) => {
      const intervalStart = setMinutes(setHours(targetDate, parseInt(interval.start.split(':')[0])), parseInt(interval.start.split(':')[1]));
      const intervalEnd = setMinutes(setHours(targetDate, parseInt(interval.end.split(':')[0])), parseInt(interval.end.split(':')[1]));
      
      let currentSlot = intervalStart;
      
      while (currentSlot < intervalEnd) {
        const slotEnd = new Date(currentSlot.getTime() + bookingDuration * 60000);
        if (slotEnd > intervalEnd) break;

        const isAvailable = !busyIntervals.some(busy => {
          return currentSlot < busy.end && slotEnd > busy.start;
        });

        if (isAvailable && currentSlot > new Date()) {
          slots.push(currentSlot.toISOString());
        }
        
        currentSlot = slotEnd;
      }
    });

    // Sort slots just in case intervals were out of order
    slots.sort();

    return NextResponse.json({ 
      slots, 
      user: { displayName: userData.displayName, photoURL: userData.photoURL },
      bookingDuration
    });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
