"use client";

import React, { useState, useEffect } from "react";
import { format, addDays, startOfToday, isSameDay } from "date-fns";
import { it } from "date-fns/locale";
import { Calendar as CalendarIcon, Clock, Video, User } from "lucide-react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";

export default function BookingPage({ params }: { params: { userId: string } }) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(startOfToday());
  const [slots, setSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [host, setHost] = useState<any>(null);
  
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [bookingStatus, setBookingStatus] = useState<'idle'|'booking'|'success'|'error'>('idle');

  useEffect(() => {
    if (selectedDate) {
      fetchSlots(selectedDate);
      setSelectedSlot(null);
    }
  }, [selectedDate]);

  const fetchSlots = async (date: Date) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/calendar/slots?userId=${params.userId}&date=${date.toISOString()}`);
      if (res.ok) {
        const data = await res.json();
        setSlots(data.slots || []);
        if (data.user) setHost(data.user);
      } else {
        setSlots([]);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleBook = async () => {
    if (!selectedSlot || !guestName || !guestEmail) return;
    setBookingStatus('booking');
    try {
      const res = await fetch(`/api/calendar/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: params.userId,
          slot: selectedSlot,
          guestName,
          guestEmail
        })
      });
      if (res.ok) {
        setBookingStatus('success');
      } else {
        setBookingStatus('error');
      }
    } catch (err) {
      setBookingStatus('error');
    }
  };

  if (bookingStatus === 'success') {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center">
        <div className="w-20 h-20 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mb-6">
          <CalendarIcon size={40} />
        </div>
        <h1 className="text-4xl font-halfre mb-4">Meeting Confermato!</h1>
        <p className="text-white/70 max-w-md mx-auto mb-8">
          Ti abbiamo inviato un invito sul calendario all'indirizzo {guestEmail}. 
          All'interno troverai anche il link per Google Meet.
        </p>
        <button onClick={() => window.location.reload()} className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors font-medium">
          Prenota un altro meeting
        </button>
      </div>
    );
  }

  return (
    <div className="bg-[#111] border border-white/10 rounded-[32px] overflow-hidden flex flex-col md:flex-row shadow-2xl min-h-[600px]">
      {/* Sidebar with Host Info */}
      <div className="w-full md:w-1/3 bg-black/40 p-8 border-b md:border-b-0 md:border-r border-white/5">
        {host ? (
          <div className="flex items-center gap-4 mb-8">
            {host.photoURL ? (
              <img src={host.photoURL} alt={host.displayName} className="w-16 h-16 rounded-full" />
            ) : (
              <div className="w-16 h-16 bg-[#006AFF]/20 text-[#006AFF] rounded-full flex items-center justify-center">
                <User size={32} />
              </div>
            )}
            <div>
              <div className="text-sm text-white/50 mb-1">Incontra</div>
              <h2 className="text-xl font-bold">{host.displayName}</h2>
            </div>
          </div>
        ) : (
          <div className="animate-pulse flex gap-4 mb-8">
            <div className="w-16 h-16 bg-white/5 rounded-full" />
            <div className="flex-1 py-2">
              <div className="h-3 bg-white/5 rounded w-1/2 mb-2" />
              <div className="h-5 bg-white/5 rounded w-3/4" />
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4 text-white/70">
          <div className="flex items-center gap-3">
            <Clock size={20} className="text-white/40" />
            <span>30 minuti</span>
          </div>
          <div className="flex items-center gap-3">
            <Video size={20} className="text-white/40" />
            <span>Google Meet</span>
          </div>
          <div className="mt-4 text-sm leading-relaxed text-white/50">
            Seleziona un giorno e un orario per prenotare una call. I dettagli e il link di Google Meet verranno inviati via email.
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8 flex flex-col md:flex-row gap-12">
        {!selectedSlot ? (
          <>
            <div className="flex-1 max-w-[320px]">
              <h3 className="text-xl font-bold mb-6">Seleziona data</h3>
              <div className="bg-black/20 rounded-2xl p-4 border border-white/5">
                <style>{`
                  .rdp { --rdp-cell-size: 40px; margin: 0; }
                  .rdp-day_selected { background-color: #006AFF; font-weight: bold; border-radius: 50%; }
                  .rdp-day:hover:not(.rdp-day_selected) { background-color: rgba(255,255,255,0.1); border-radius: 50%; }
                `}</style>
                <DayPicker 
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  locale={it}
                  disabled={[{ before: startOfToday() }]}
                  className="text-white mx-auto"
                />
              </div>
            </div>

            <div className="flex-1">
              <h3 className="text-xl font-bold mb-6">
                {selectedDate ? format(selectedDate, 'EEEE d MMMM', { locale: it }) : 'Orari'}
              </h3>
              
              <div className="flex flex-col gap-3 h-[380px] overflow-y-auto custom-scrollbar pr-2">
                {loading ? (
                  Array.from({length: 5}).map((_, i) => (
                    <div key={i} className="h-14 bg-white/5 rounded-xl animate-pulse" />
                  ))
                ) : slots.length > 0 ? (
                  slots.map((s) => {
                    const date = new Date(s);
                    return (
                      <button
                        key={s}
                        onClick={() => setSelectedSlot(s)}
                        className="p-4 border border-white/10 rounded-xl hover:border-[#006AFF] hover:bg-[#006AFF]/10 transition-colors text-center font-bold text-lg"
                      >
                        {format(date, 'HH:mm')}
                      </button>
                    );
                  })
                ) : (
                  <div className="text-center text-white/50 py-10">
                    Nessun orario disponibile in questa data.
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 max-w-lg mx-auto">
            <button 
              onClick={() => setSelectedSlot(null)}
              className="text-[#006AFF] hover:underline mb-8 text-sm flex items-center gap-1"
            >
              ← Torna agli orari
            </button>

            <h3 className="text-2xl font-bold mb-2">Conferma dettagli</h3>
            <p className="text-white/50 mb-8 flex items-center gap-2">
              <CalendarIcon size={16} />
              {format(new Date(selectedSlot), "EEEE d MMMM yyyy, 'alle' HH:mm", { locale: it })}
            </p>

            <div className="flex flex-col gap-6">
              <div>
                <label className="block text-sm text-white/50 mb-2">Nome e Cognome *</label>
                <input 
                  type="text" 
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-[#006AFF]"
                  placeholder="Mario Rossi"
                />
              </div>
              
              <div>
                <label className="block text-sm text-white/50 mb-2">Email *</label>
                <input 
                  type="email" 
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-[#006AFF]"
                  placeholder="mario@example.com"
                />
              </div>

              {bookingStatus === 'error' && (
                <div className="p-4 bg-red-500/20 text-red-400 rounded-xl text-sm border border-red-500/30">
                  Si è verificato un errore durante la prenotazione. Riprova più tardi.
                </div>
              )}

              <button 
                onClick={handleBook}
                disabled={!guestName || !guestEmail || bookingStatus === 'booking'}
                className="w-full py-4 bg-[#006AFF] text-white font-bold rounded-xl hover:bg-[#0055CC] transition-colors disabled:opacity-50 mt-4"
              >
                {bookingStatus === 'booking' ? 'Conferma in corso...' : 'Prenota Meeting'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
