"use client";

import React, { useState, useEffect, use } from "react";
import { format, addDays, startOfToday, isSameDay } from "date-fns";
import { safeFormat } from "@/lib/dateUtils";
import { enUS, it } from "date-fns/locale";
import { Calendar as CalendarIcon, Clock, Video } from "lucide-react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { UserAvatar } from '@/components/shared/UserAvatar';
import { useTranslation } from '@/contexts/TranslationContext';
import { formatMessage } from '@/lib/i18n/formatMessage';

export default function BookingPage({ params: paramsPromise }: { params: Promise<{ userId: string }> }) {
  // Da Next 15 i parametri della pagina arrivano come Promise.
  const params = use(paramsPromise);
  const { t, locale } = useTranslation();
  const dateLocale = locale === 'en' ? enUS : it;
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(startOfToday());
  const [slots, setSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [host, setHost] = useState<any>(null);
  const [bookingDuration, setBookingDuration] = useState<number>(30);
  
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [bookingStatus, setBookingStatus] = useState<'idle'|'booking'|'success'|'error'>('idle');
  const [provider, setProvider] = useState<'google' | 'microsoft' | null>('google');
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  // Letto nel browser: durante il rendering sul server sarebbe UTC.
  const [guestTimeZone, setGuestTimeZone] = useState('');
  const meetingName = provider === 'microsoft' ? 'Microsoft Teams' : 'Google Meet';

  useEffect(() => {
    setGuestTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  useEffect(() => {
    if (selectedDate) {
      fetchSlots(selectedDate);
      setSelectedSlot(null);
    }
  }, [selectedDate]);

  const fetchSlots = async (date: Date) => {
    setLoading(true);
    setSlotsError(null);
    try {
      // Il giorno scelto, non la mezzanotte del browser in UTC: il server lo
      // legge nel fuso di chi riceve le prenotazioni.
      const day = safeFormat(date, 'yyyy-MM-dd');
      const res = await fetch(`/api/calendar/slots?userId=${encodeURIComponent(params.userId)}&date=${day}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSlots(data.slots || []);
        if (data.user) setHost(data.user);
        if (data.bookingDuration) setBookingDuration(data.bookingDuration);
        setProvider(data.provider ?? null);
      } else {
        setSlots([]);
        setSlotsError(data.error || t.booking.noTimes);
      }
    } catch (err) {
      console.error(err);
      setSlots([]);
      setSlotsError(t.booking.noTimes);
    }
    setLoading(false);
  };

  const handleBook = async () => {
    if (!selectedSlot || !guestName || !guestEmail) return;
    setBookingStatus('booking');
    setBookingError(null);
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
        const data = await res.json().catch(() => ({}));
        setBookingError(data.error || null);
        setBookingStatus('error');
        // Lo slot potrebbe essere stato preso: si ricaricano gli orari liberi.
        if (res.status === 409 && selectedDate) fetchSlots(selectedDate);
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
        <h1 className="text-4xl font-halfre mb-4">{t.booking.confirmed}</h1>
        <p className="text-white/70 max-w-md mx-auto mb-8">
          {formatMessage(t.booking.inviteSent, { email: guestEmail, meeting: meetingName })}
        </p>
        <button onClick={() => window.location.reload()} className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors font-medium">
          {t.booking.bookAnother}
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
            <UserAvatar
              src={host.photoURL}
              name={host.displayName}
              className="w-16 h-16 bg-[#006AFF]/20 text-[#006AFF] rounded-full flex items-center justify-center overflow-hidden font-semibold text-xl"
              imageClassName="w-full h-full rounded-full object-cover"
            />
            <div>
              <div className="text-sm text-[#858585] mb-1">{t.booking.hostLabel}</div>
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
            <Clock size={20} className="text-[#858585]" />
            <span>{formatMessage(t.booking.durationMinutes, { count: bookingDuration })}</span>
          </div>
          <div className="flex items-center gap-3">
            <Video size={20} className="text-[#858585]" />
            <span>{meetingName}</span>
          </div>
          <div className="mt-4 text-sm leading-relaxed text-[#858585]">
            {formatMessage(t.booking.description, { meeting: meetingName })}
          </div>
          {guestTimeZone && (
            <div className="text-xs text-[#858585]">
              {formatMessage(t.booking.timezone, { timezone: guestTimeZone })}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8 flex flex-col md:flex-row gap-12">
        {!selectedSlot ? (
          <>
            <div className="flex-1 max-w-[320px]">
              <h3 className="text-xl font-bold mb-6">{t.booking.selectDate}</h3>
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
                  locale={dateLocale}
                  disabled={[{ before: startOfToday() }]}
                  className="text-white mx-auto"
                />
              </div>
            </div>

            <div className="flex-1">
              <h3 className="text-xl font-bold mb-6">
                {selectedDate ? format(selectedDate, 'EEEE d MMMM', { locale: dateLocale }) : t.booking.times}
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
                  <div className="text-center text-[#858585] py-10">
                    {slotsError
                      || (provider === null
                        ? t.booking.calendarNotConnected
                        : t.booking.noTimes)}
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
              ← {t.booking.backToTimes}
            </button>

            <h3 className="text-2xl font-bold mb-2">{t.booking.confirmDetails}</h3>
            <p className="text-[#858585] mb-8 flex items-center gap-2">
              <CalendarIcon size={16} />
              {safeFormat(selectedSlot, "EEEE d MMMM yyyy HH:mm", { locale: dateLocale })}
            </p>

            <div className="flex flex-col gap-6">
              <div>
                <label className="block text-sm text-[#858585] mb-2">{t.booking.fullNameRequired}</label>
                <input 
                  type="text" 
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-[#006AFF]"
                  placeholder="Mario Rossi"
                />
              </div>
              
              <div>
                <label className="block text-sm text-[#858585] mb-2">{t.booking.emailRequired}</label>
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
                  {bookingError || t.booking.bookingError}
                </div>
              )}

              <button 
                onClick={handleBook}
                disabled={!guestName || !guestEmail || bookingStatus === 'booking'}
                className="w-full py-4 bg-[#006AFF] text-white font-bold rounded-xl hover:bg-[#0055CC] transition-colors disabled:opacity-50 mt-4"
              >
                {bookingStatus === 'booking' ? t.booking.confirming : t.booking.bookMeeting}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
