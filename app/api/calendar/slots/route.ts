import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { fetchCalendarEvents } from '@/lib/googleCalendar';
import { startOfDay, endOfDay, setHours, setMinutes, parseISO, isBefore, isAfter } from 'date-fns';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const dateStr = searchParams.get('date');

  if (!userId || !dateStr) {
    return NextResponse.json({ error: 'Missing userId or date' }, { status: 400 });
  }

  try {
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

    // 2. Define business hours (9:00 - 18:00)
    const targetDate = new Date(dateStr);
    const dayStart = setMinutes(setHours(targetDate, 9), 0);
    const dayEnd = setMinutes(setHours(targetDate, 18), 0);
    
    // 3. Fetch events for that day
    const events = await fetchCalendarEvents(token, startOfDay(targetDate), endOfDay(targetDate));

    // 4. Generate 30-min slots
    const slots = [];
    let currentSlot = dayStart;
    
    while (currentSlot < dayEnd) {
      const slotEnd = new Date(currentSlot.getTime() + 30 * 60000);
      
      // Check if slot overlaps with any event
      const isAvailable = !events.some((e: any) => {
        if (!e.start?.dateTime || !e.end?.dateTime) return false;
        const eStart = new Date(e.start.dateTime);
        const eEnd = new Date(e.end.dateTime);
        
        // Overlap condition: slotStart < eEnd AND slotEnd > eStart
        return currentSlot < eEnd && slotEnd > eStart;
      });

      // Filter out slots in the past
      if (isAvailable && currentSlot > new Date()) {
        slots.push(currentSlot.toISOString());
      }
      
      currentSlot = slotEnd;
    }

    return NextResponse.json({ slots, user: { displayName: userData.displayName, photoURL: userData.photoURL } });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
