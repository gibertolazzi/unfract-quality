import { db } from '@/lib/firebase';
import { collection, doc, setDoc, deleteDoc, onSnapshot, query } from 'firebase/firestore';
import { CalendarEvent } from '@/types/calendar';

export const subscribeToEvents = (userId: string, callback: (events: CalendarEvent[]) => void) => {
  const eventsRef = collection(db, 'users', userId, 'events');
  const q = query(eventsRef);

  return onSnapshot(q, (snapshot) => {
    const events = snapshot.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        title: data.title,
        date: data.date?.toDate ? data.date.toDate() : new Date(data.date),
        startTime: data.startTime,
        endTime: data.endTime,
        color: data.color || 'bg-[#006AFF]/20',
        textColor: data.textColor || 'text-[#00A6FF]',
        description: data.description || '',
        meetLink: data.meetLink,
        addMeet: data.addMeet,
        guestEmail: data.guestEmail,
        googleEventId: data.googleEventId || undefined,
        microsoftEventId: data.microsoftEventId || undefined,
      } as CalendarEvent;
    });
    callback(events);
  }, (error) => {
    console.error("Error subscribing to events: ", error);
    callback([]);
  });
};

export const saveEventToFirestore = async (userId: string, event: CalendarEvent) => {
  const id = event.id || Math.random().toString(36).substring(7);
  const eventRef = doc(db, 'users', userId, 'events', id);
  await setDoc(eventRef, {
    title: event.title,
    date: event.date,
    startTime: event.startTime,
    endTime: event.endTime,
    color: event.color || 'bg-[#006AFF]/20',
    textColor: event.textColor || 'text-[#00A6FF]',
    description: event.description || '',
    meetLink: event.meetLink || null,
    addMeet: event.addMeet || false,
    guestEmail: event.guestEmail || null,
  }, { merge: true });
  return id;
};

export const deleteEventFromFirestore = async (userId: string, eventId: string) => {
  await deleteDoc(doc(db, 'users', userId, 'events', eventId));
};

export const sendCalendarNotification = async (event: CalendarEvent, action: 'create' | 'update' | 'cancel', userEmail?: string, userName?: string, toast?: any) => {
  if (!event.guestEmail) return;
  
  try {
    const res = await fetch('/api/calendar/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event,
        action,
        guestEmail: event.guestEmail,
        userEmail,
        userName
      })
    });
    
    if (!res.ok) {
      const errorData = await res.json();
      console.error('Failed to send email notification:', errorData);
      if (toast) toast.error(`Errore invio email: ${errorData.error?.message || 'sconosciuto'}`);
    } else {
      if (toast) toast.success("Email inviata con successo!");
    }
  } catch (err) {
    console.error('Error sending notification:', err);
    if (toast) toast.error("Errore di rete nell'invio dell'email");
  }
};
