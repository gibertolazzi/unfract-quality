"use client";

import React, { useState, useEffect } from 'react';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import { useSearchParams } from 'next/navigation';
import { RefreshCw, ChevronDown, ChevronLeft, ChevronRight, Settings } from 'lucide-react';
import { addMonths, subMonths, addWeeks, subWeeks, addDays, subDays, addYears, subYears, format, setHours } from 'date-fns';
import { it, enUS } from 'date-fns/locale';
import { CalendarEvent, CalendarViewType } from './types';
import { MonthView } from './MonthView';
import { WeekView } from './WeekView';
import { DayView } from './DayView';
import { YearView } from './YearView';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useTranslation } from '@/contexts/TranslationContext';
import { EventModal } from '@/components/calendar/EventModal';
import { SettingsModal } from '@/components/calendar/SettingsModal';
import { subscribeToEvents, saveEventToFirestore, deleteEventFromFirestore, sendCalendarNotification } from '@/lib/calendar';
import { auth } from '@/lib/firebase';

// Classi condivise: tutti i controlli dell'header hanno la stessa altezza e non vanno a capo.
const BTN = "h-9 px-4 flex items-center justify-center gap-2 rounded-full border border-white/10 text-white text-sm font-medium hover:bg-white/5 transition-colors whitespace-nowrap";
const ICON_BTN = "h-9 w-9 flex items-center justify-center rounded-full border border-white/10 text-[#858585] hover:text-white hover:bg-white/5 transition-colors shrink-0";
const NAV_BTN = "h-9 w-9 flex items-center justify-center rounded-full hover:bg-white/5 text-[#858585] hover:text-white transition-colors";

/** Combina il giorno di `date` con un orario "HH:mm" e restituisce l'istante UTC in ISO (calcolato col fuso del browser). */
const buildISO = (date: Date, time: string) => {
  const [h, m] = time.split(':').map(n => parseInt(n, 10));
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};

export function CalendarBoard() {
  const searchParams = useSearchParams();
  const eventId = searchParams?.get('eventId');
  
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [view, setView] = useState<CalendarViewType>('month');
  const [firestoreEvents, setFirestoreEvents] = useState<CalendarEvent[]>([]);
  const [externalEvents, setExternalEvents] = useState<CalendarEvent[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Eventi Unfract + eventi dei calendari collegati (Google/Outlook).
  // Gli eventi creati da Unfract tornano indietro dalla sync: li scartiamo usando gli ID esterni.
  const events = React.useMemo(() => {
    const knownGoogle = new Set(firestoreEvents.map(e => e.googleEventId).filter(Boolean));
    const knownMicrosoft = new Set(firestoreEvents.map(e => e.microsoftEventId).filter(Boolean));
    const allEvents = [...firestoreEvents];
    externalEvents.forEach(ee => {
      if (ee.googleEventId && knownGoogle.has(ee.googleEventId)) return;
      if (ee.microsoftEventId && knownMicrosoft.has(ee.microsoftEventId)) return;
      allEvents.push(ee);
    });
    return allEvents;
  }, [firestoreEvents, externalEvents]);
  
  const { user } = useAuth();
  const { t } = useTranslation();
  const toast = useToast();
  const [isSyncing, setIsSyncing] = useState(false);
  const dateLocale = t.settings.language === 'it' ? it : enUS;

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

  /**
   * Invia l'evento ai calendari collegati (Google/Outlook) tramite backend.
   * Crea l'evento se nuovo, altrimenti lo aggiorna usando gli ID esterni salvati.
   */
  const syncToExternalCalendars = async (event: CalendarEvent, isUpdate: boolean) => {
    if (!user) return;
    try {
      const res = await fetch('/api/calendar/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          event,
          isUpdate,
          // Gli istanti UTC li calcola il browser: il server non deve indovinare il fuso.
          startDateISO: buildISO(event.date, event.startTime),
          endDateISO: buildISO(event.date, event.endTime),
        })
      });
      if (!res.ok) {
        console.error('Calendar sync failed:', await res.text());
        return;
      }
      const data = await res.json();
      setFirestoreEvents(prev => prev.map(e => e.id === event.id ? {
        ...e,
        meetLink: data.meetLink || e.meetLink,
        googleEventId: data.googleEventId || e.googleEventId,
        microsoftEventId: data.microsoftEventId || e.microsoftEventId,
      } : e));
    } catch (err) {
      console.error('Error syncing with external calendars:', err);
    }
  };

  const onDragEnd = async (result: DropResult) => {
    const { destination, draggableId } = result;
    if (!destination || !user) return;
    if (result.source.droppableId === destination.droppableId) return;

    const event = events.find(e => e.id === draggableId);
    if (!event) return;
    if (event.isExternal) {
      toast.error(t.calendar.externalEventReadOnly);
      return;
    }

    try {
      // droppableId: "month_<ISO>" oppure "time_<ISO>_<ora>"
      const parts = destination.droppableId.split('_');
      const newDate = new Date(parts[1]);
      if (isNaN(newDate.getTime())) return;

      let startTime = event.startTime;
      let endTime = event.endTime;

      if (parts[0] === 'time') {
        const destHour = parseInt(parts[2], 10);
        const [sh, sm] = event.startTime.split(':').map(n => parseInt(n, 10));
        const [eh, em] = event.endTime.split(':').map(n => parseInt(n, 10));
        const duration = Math.max(15, (eh * 60 + em) - (sh * 60 + sm));
        const newStart = destHour * 60 + sm;
        const newEnd = Math.min(newStart + duration, 23 * 60 + 59);
        const fmt = (mins: number) => `${Math.floor(mins / 60).toString().padStart(2, '0')}:${(mins % 60).toString().padStart(2, '0')}`;
        startTime = fmt(newStart);
        endTime = fmt(newEnd);
      }

      const updatedEvent: CalendarEvent = { ...event, date: newDate, startTime, endTime };
      setFirestoreEvents(prev => prev.map(e => e.id === event.id ? updatedEvent : e));
      await saveEventToFirestore(user.uid, updatedEvent);
      await sendCalendarNotification(updatedEvent, 'update', user.email || undefined, user.displayName || undefined, toast);
      await syncToExternalCalendars(updatedEvent, true);
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
    const locale = dateLocale;
    if (view === 'year') return format(currentDate, 'yyyy', { locale });
    if (view === 'day') return format(currentDate, 'MMMM yyyy', { locale });
    if (view === 'week') return format(currentDate, 'MMMM yyyy', { locale });
    return format(currentDate, 'MMMM yyyy', { locale });
  };

  // Scarica gli eventi di Google/Outlook tramite backend (token sempre rinnovati lato server)
  const loadExternalEvents = async (manual = false) => {
    if (!user) return;
    setIsSyncing(true);
    try {
      // Range attorno alla data corrente (mese corrente +- 2 mesi)
      const timeMin = subMonths(currentDate, 2).toISOString();
      const timeMax = addMonths(currentDate, 2).toISOString();

      const res = await fetch(`/api/calendar/sync?userId=${user.uid}&timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`);
      if (!res.ok) {
        console.error('Calendar sync failed:', await res.text());
        return;
      }
      const data = await res.json();

      // Data e orari li ricalcoliamo qui dagli istanti ISO, così usano il fuso dell'utente e non quello del server.
      const mapped: CalendarEvent[] = (data.events || []).map((e: any) => {
        const start = new Date(e.startISO || e.date);
        const end = new Date(e.endISO || e.date);
        return {
          ...e,
          title: e.title || t.calendar.untitled,
          date: start,
          startTime: format(start, 'HH:mm'),
          endTime: format(end, 'HH:mm'),
        } as CalendarEvent;
      });
      setExternalEvents(mapped);
      if (manual) toast.success(t.calendar.syncDone);
    } catch (err) {
      console.error('Error syncing calendars:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Si ricarica solo quando cambia mese/utente, non a ogni click su giorno/settimana
  const monthKey = currentDate.getFullYear() * 12 + currentDate.getMonth();
  React.useEffect(() => {
    loadExternalEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, monthKey]);

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

    // Gli eventi che arrivano da Google/Outlook si modificano lì: salvarli qui li duplicherebbe.
    if (selectedEvent?.isExternal) {
      toast.error(t.calendar.externalEventReadOnly);
      return;
    }

    const isUpdate = !!selectedEvent;
    // Conserva gli ID esterni, altrimenti l'aggiornamento creerebbe un doppione su Google/Outlook
    const merged: CalendarEvent = {
      ...event,
      googleEventId: event.googleEventId || selectedEvent?.googleEventId,
      microsoftEventId: event.microsoftEventId || selectedEvent?.microsoftEventId,
    };

    // Salva sempre in Firestore
    const newId = await saveEventToFirestore(user.uid, merged);
    merged.id = newId;

    await sendCalendarNotification(merged, isUpdate ? 'update' : 'create', user.email || undefined, user.displayName || undefined, toast);

    // Poi propaga a Google/Outlook (se collegati) e recupera link Meet/Teams
    await syncToExternalCalendars(merged, isUpdate);
  };

  const handleDeleteEvent = async (id: string) => {
    if (!user) return;
    await deleteEventFromFirestore(user.uid, id);
    // Remove locally instantly for UX
    setFirestoreEvents(prev => prev.filter(e => e.id !== id));
    setExternalEvents(prev => prev.filter(e => e.id !== id));
  };

  const viewLabels: Record<CalendarViewType, string> = {
    day: t.calendar.day, week: t.calendar.week, month: t.calendar.month, year: t.calendar.year,
  };

  return (
  <DragDropContext onDragEnd={onDragEnd}>
    <div className="flex flex-col gap-8 font-sans min-h-full">
      {/* Header */}
      <div className="flex flex-col gap-4 px-2 md:flex-row md:items-center md:justify-between">
        {/* Sinistra: Oggi + frecce */}
        <div className="flex items-center gap-3 md:flex-1">
          <button 
            onClick={() => setCurrentDate(new Date())}
            className={BTN}
          >
            {t.calendar.today}
          </button>
          <div className="flex items-center gap-1">
            <button onClick={handlePrevious} className={NAV_BTN}>
              <ChevronLeft size={20} />
            </button>
            <button onClick={handleNext} className={NAV_BTN}>
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
        
        {/* Titolo: sopra su mobile, centrato su desktop */}
        <h2 className="order-first md:order-none text-xl font-bold text-white font-sans md:text-center md:flex-1">{getHeaderTitle()}</h2>
        
        {/* Destra: azioni */}
        <div className="flex flex-wrap items-center gap-2 md:gap-3 md:flex-1 md:min-w-max md:flex-nowrap md:justify-end relative">
          <button onClick={() => setIsSettingsOpen(true)} className={ICON_BTN} title={t.calendar.calendarSettings}>
            <Settings size={16} />
          </button>

          <button 
            onClick={() => {
              const url = `${window.location.origin}/book/${auth.currentUser?.uid}`;
              navigator.clipboard.writeText(url);
              toast.success(t.calendar.copyBookingLinkSuccess);
            }}
            className={BTN}
            title={t.calendar.copyBookingLink}
          >
            {t.calendar.copyLink}
          </button>

          <button 
            onClick={() => loadExternalEvents(true)}
            disabled={isSyncing}
            className={`${BTN} disabled:opacity-50`}
          >
            <RefreshCw size={14} className={`text-[#006AFF] ${isSyncing ? 'animate-spin' : ''}`} />
            {t.calendar.sync}
          </button>
          
          <div className="relative">
            <button 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className={BTN}
            >
              {viewLabels[view]}
              <ChevronDown size={16} className="text-[#858585]" />
            </button>
            
            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-36 bg-[#111] border border-white/10 rounded-2xl shadow-xl overflow-hidden z-50 py-2">
                {(['day', 'week', 'month', 'year'] as CalendarViewType[]).map(v => (
                  <button 
                    key={v}
                    onClick={() => {
                      setView(v);
                      setIsDropdownOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 capitalize transition-colors"
                  >
                    {v === 'day' ? t.calendar.dayLower : v === 'week' ? t.calendar.weekLower : v === 'month' ? t.calendar.monthLower : t.calendar.yearLower}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* View Container */}
      <div className="flex-1 overflow-auto custom-scrollbar flex flex-col pb-10">
        <div className="min-w-[700px] flex flex-col flex-1">
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
      </div>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

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
