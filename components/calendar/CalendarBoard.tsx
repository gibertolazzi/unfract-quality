"use client";

import React, { useState, useEffect } from 'react';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import { useSearchParams } from 'next/navigation';
import { RefreshCw, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { addMonths, subMonths, addWeeks, subWeeks, addDays, subDays, addYears, subYears, format, setHours } from 'date-fns';
import { it } from 'date-fns/locale';
import { CalendarEvent, CalendarViewType } from './types';
import { MonthView } from './MonthView';
import { WeekView } from './WeekView';
import { DayView } from './DayView';
import { YearView } from './YearView';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useTranslation } from '@/contexts/TranslationContext';
import { EventModal } from '@/components/calendar/EventModal';
import { fetchCalendarEvents, createCalendarEvent } from '@/lib/googleCalendar';
import { subscribeToEvents, saveEventToFirestore, deleteEventFromFirestore } from '@/lib/calendar';
import { auth } from '@/lib/firebase';

const initialEvents: CalendarEvent[] = [
  { 
    id: '1', 
    title: 'Meeting Onboarding', 
    date: new Date(2026, 0, 28), // Note: JS months are 0-indexed. 0 = January.
    startTime: '16:00', 
    endTime: '17:00', 
    color: 'bg-[#006AFF]/20', 
    textColor: 'text-[#00A6FF]',
    description: ''
  },
  { 
    id: '2', 
    title: 'Meeting Conoscitivo', 
    date: new Date(2026, 0, 28), 
    startTime: '17:00', 
    endTime: '18:00', 
    color: 'bg-[#006AFF]/20', 
    textColor: 'text-[#00A6FF]',
    description: ''
  }
];

export function CalendarBoard() {
  const searchParams = useSearchParams();
  const eventId = searchParams?.get('eventId');
  
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [view, setView] = useState<CalendarViewType>('month');
  const [firestoreEvents, setFirestoreEvents] = useState<CalendarEvent[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [googleEvents, setGoogleEvents] = useState<CalendarEvent[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const events = React.useMemo(() => {
    const allEvents = [...firestoreEvents];
    googleEvents.forEach(ge => {
      const isDuplicate = firestoreEvents.some(fe => 
        fe.title === ge.title && 
        fe.date.getTime() === ge.date.getTime() && 
        fe.startTime === ge.startTime
      );
      if (!isDuplicate) {
        allEvents.push(ge);
      }
    });
    return allEvents;
  }, [firestoreEvents, googleEvents]);
  
  const { accessToken, user } = useAuth();
  const { t } = useTranslation();
  const toast = useToast();
  const [isSyncing, setIsSyncing] = useState(false);

  // Subscribe to Firestore events
  React.useEffect(() => {
    if (!user) {
      setFirestoreEvents([]);
      return;
    }
    const unsubscribe = subscribeToEvents(user.uid, (newEvents) => {
      setFirestoreEvents(newEvents);
    });
    return () => unsubscribe();
  }, [user]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [selectedDateForNew, setSelectedDateForNew] = useState<Date | undefined>(undefined);

  useEffect(() => {
    if (eventId && events.length > 0) {
      const targetEvent = events.find(e => e.id === eventId);
      if (targetEvent) {
        setCurrentDate(targetEvent.date);
        
        // Let the calendar re-render with the correct date first
        setTimeout(() => {
          const el = document.getElementById(`event-${eventId}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.style.boxShadow = '0 0 0 2px #006AFF, 0 0 20px rgba(0, 106, 255, 0.4)';
            setTimeout(() => {
              el.style.boxShadow = 'none';
            }, 2500);
            
            // Remove from URL
            window.history.replaceState(null, '', '/calendar');
          }
        }, 100);
      }
    }
  }, [eventId, events]);


  const onDragEnd = async (result: DropResult) => {
    const { destination, draggableId } = result;
    if (!destination || !user) return;
    
    const event = firestoreEvents.find(e => e.id === draggableId);
    if (!event) return;
    
    try {
      const dropId = destination.droppableId; // e.g. "month_2026-10-01T..."
      const parts = dropId.split('_');
      if (parts.length >= 2) {
        const newDate = new Date(parts[1]);
        if (!isNaN(newDate.getTime())) {
          const updatedEvent = { ...event, date: newDate };
          await saveEventToFirestore(user.uid, updatedEvent);
        }
      }
    } catch (e) {
      console.error("Error dragging event", e);
    }
  };

  const handlePrevious = () => {
    switch(view) {
      case 'day': setCurrentDate(subDays(currentDate, 1)); break;
      case 'week': setCurrentDate(subWeeks(currentDate, 1)); break;
      case 'month': setCurrentDate(subMonths(currentDate, 1)); break;
      case 'year': setCurrentDate(subYears(currentDate, 1)); break;
    }
  };

  const handleNext = () => {
    switch(view) {
      case 'day': setCurrentDate(addDays(currentDate, 1)); break;
      case 'week': setCurrentDate(addWeeks(currentDate, 1)); break;
      case 'month': setCurrentDate(addMonths(currentDate, 1)); break;
      case 'year': setCurrentDate(addYears(currentDate, 1)); break;
    }
  };

  const getHeaderTitle = () => {
    const locale = t.settings.language === 'it' ? it : undefined;
    if (view === 'year') return format(currentDate, 'yyyy', { locale });
    if (view === 'day') return format(currentDate, 'MMMM yyyy', { locale });
    if (view === 'week') return format(currentDate, 'MMMM yyyy', { locale });
    return format(currentDate, 'MMMM yyyy', { locale });
  };

  const loadGoogleEvents = async () => {
    if (!accessToken) return;
    setIsSyncing(true);
    
    // We fetch a range around the current date (e.g. current month +- 1 month)
    const timeMin = subMonths(currentDate, 2);
    const timeMax = addMonths(currentDate, 2);
    
    const result = await fetchCalendarEvents(accessToken, timeMin, timeMax);
    
    if (result.error === 'unauthorized') {
      // Token is invalid/expired. Stop syncing Google events quietly.
      setIsSyncing(false);
      return;
    }
    
    const mappedEvents: CalendarEvent[] = (result.items || []).map((e: any) => {
      const start = e.start?.dateTime ? new Date(e.start.dateTime) : new Date(e.start?.date);
      const end = e.end?.dateTime ? new Date(e.end.dateTime) : new Date(e.end?.date);
      
      return {
        id: e.id,
        title: e.summary || t.calendar.untitled,
        date: start,
        startTime: format(start, 'HH:mm'),
        endTime: format(end, 'HH:mm'),
        color: 'bg-[#006AFF]/20',
        textColor: 'text-[#00A6FF]',
        description: e.description || '',
        meetLink: e.hangoutLink
      };
    });
    
    setGoogleEvents(mappedEvents);
    setIsSyncing(false);
  };

  React.useEffect(() => {
    loadGoogleEvents();
  }, [accessToken, currentDate, view]);

  // Event Handlers
  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setSelectedDateForNew(undefined);
    setIsModalOpen(true);
  };

  const handleDayClick = (date: Date) => {
    setSelectedEvent(null);
    setSelectedDateForNew(date);
    setIsModalOpen(true);
  };

  const handleTimeSlotClick = (date: Date, hour: number) => {
    const slotDate = setHours(date, hour);
    setSelectedEvent(null);
    setSelectedDateForNew(slotDate);
    setIsModalOpen(true);
  };

  const handleSaveEvent = async (event: CalendarEvent) => {
    if (!user) return; // Non dovrebbe succedere se sei loggato

    // Salva sempre in Firestore
    const newId = await saveEventToFirestore(user.uid, event);
    event.id = newId;

    // Se non ha il token google, abbiamo finito
    if (!accessToken) return;

    try {
      // Create date objects for start and end
      const [startH, startM] = event.startTime.split(':');
      const [endH, endM] = event.endTime.split(':');
      const startDate = new Date(event.date);
      startDate.setHours(parseInt(startH, 10), parseInt(startM, 10), 0);
      const endDate = new Date(event.date);
      endDate.setHours(parseInt(endH, 10), parseInt(endM, 10), 0);

      const googleEventPayload: any = {
        summary: event.title,
        description: event.description,
        start: {
          dateTime: startDate.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        end: {
          dateTime: endDate.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      };

      if (event.guestEmail) {
        googleEventPayload.attendees = [{ email: event.guestEmail }];
      }

      if (event.addMeet) {
        googleEventPayload.conferenceData = {
          createRequest: {
            requestId: Math.random().toString(36).substring(7),
            conferenceSolutionKey: {
              type: 'hangoutsMeet'
            }
          }
        };
      }

      await createCalendarEvent(accessToken, googleEventPayload);
      
      // We don't strictly need to reload if Firestore gives us everything, but it's good for getting Meet links
      // You could also save the google event id/meetlink to Firestore here.
      // await loadGoogleEvents();

    } catch (error) {
      console.error("Failed to create event:", error);
      toast.error(t.calendar.createEventError);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (!user) return;
    await deleteEventFromFirestore(user.uid, id);
    // Remove locally instantly for UX
    setFirestoreEvents(prev => prev.filter(e => e.id !== id));
    setGoogleEvents(prev => prev.filter(e => e.id !== id)); // Just in case it was a Google event we try to delete
  };

  return (
  <DragDropContext onDragEnd={onDragEnd}>
    <div className="flex flex-col gap-8 font-sans min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-2">
        <div className="flex-1 flex items-center gap-3">
          <button 
            onClick={() => setCurrentDate(new Date())}
            className="px-5 py-2 rounded-full border border-white/10 text-white text-sm font-medium hover:bg-white/5 transition-colors"
          >
            {t.calendar.today}
          </button>
          <div className="flex items-center gap-1">
            <button onClick={handlePrevious} className="p-2 rounded-full hover:bg-white/5 text-[#858585] hover:text-white transition-colors">
              <ChevronLeft size={20} />
            </button>
            <button onClick={handleNext} className="p-2 rounded-full hover:bg-white/5 text-[#858585] hover:text-white transition-colors">
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
        
        <h2 className="text-xl font-bold text-white font-sans text-center flex-1">{getHeaderTitle()}</h2>
        
        <div className="flex-1 flex justify-end gap-3 relative">
          {accessToken && (
            <button 
              onClick={() => {
                const url = `${window.location.origin}/book/${auth.currentUser?.uid}`;
                navigator.clipboard.writeText(url);
                toast.success(t.calendar.copyBookingLinkSuccess);
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 text-white text-sm font-medium hover:bg-white/5 transition-colors whitespace-nowrap"
            >
              {t.calendar.copyBookingLink}
            </button>
          )}

          <button 
            onClick={loadGoogleEvents}
            disabled={!accessToken || isSyncing}
            className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 text-white text-sm font-medium hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={`text-[#006AFF] ${isSyncing ? 'animate-spin' : ''}`} />
            {t.calendar.sync}
          </button>
          
          <div className="relative">
            <button 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 text-white text-sm font-medium hover:bg-white/5 transition-colors"
            >
              {view === 'day' ? t.calendar.day : view === 'week' ? t.calendar.week : view === 'month' ? t.calendar.month : t.calendar.year}
              <ChevronDown size={16} className="text-[#858585]" />
            </button>
            
            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-36 bg-[#111] border border-white/10 rounded-2xl shadow-xl overflow-hidden z-50 py-2">
                {['giorno', 'settimana', 'mese', 'anno'].map(v => (
                  <button 
                    key={v}
                    onClick={() => {
                      const typeMap: Record<string, CalendarViewType> = {
                        'giorno': 'day', 'settimana': 'week', 'mese': 'month', 'anno': 'year'
                      };
                      setView(typeMap[v]);
                      setIsDropdownOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 capitalize transition-colors"
                  >
                    {v === 'giorno' ? t.calendar.dayLower : v === 'settimana' ? t.calendar.weekLower : v === 'mese' ? t.calendar.monthLower : t.calendar.yearLower}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* View Container */}
      <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col pb-10">
        {view === 'month' && (
          <MonthView 
            currentDate={currentDate} 
            events={events} 
            onEventClick={handleEventClick} 
            onDayClick={handleDayClick} 
          />
        )}
        {view === 'week' && (
          <WeekView 
            currentDate={currentDate} 
            events={events} 
            onEventClick={handleEventClick} 
            onTimeSlotClick={handleTimeSlotClick} 
          />
        )}
        {view === 'day' && (
          <DayView 
            currentDate={currentDate} 
            events={events} 
            onEventClick={handleEventClick} 
            onTimeSlotClick={handleTimeSlotClick} 
          />
        )}
        {view === 'year' && (
          <YearView 
            currentDate={currentDate} 
            onMonthClick={(d) => { setCurrentDate(d); setView('month'); }} 
          />
        )}
      </div>

      <EventModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveEvent}
        onDelete={handleDeleteEvent}
        initialEvent={selectedEvent}
        selectedDate={selectedDateForNew}
      />
    </div>
  </DragDropContext>
  );
}
