import React, { useState, useEffect } from 'react';
import { X, Calendar as CalendarIcon, Clock, AlignLeft, Video, Users, Download } from 'lucide-react';
import { CalendarEvent } from './types';
import { safeFormat, parseSafeDate } from '@/lib/dateUtils';
import { it } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/contexts/TranslationContext';
import { escapeIcsText, icsSingleLine } from '@/lib/ics';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (event: CalendarEvent) => void;
  onDelete?: (id: string) => void;
  initialEvent?: CalendarEvent | null;
  selectedDate?: Date;
}

export function EventModal({ isOpen, onClose, onSave, onDelete, initialEvent, selectedDate }: EventModalProps) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState<Date>(new Date());
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('bg-[#006AFF]/20');
  const [textColor, setTextColor] = useState('text-[#00A6FF]');
  const [addMeet, setAddMeet] = useState(false);
  const [guestEmail, setGuestEmail] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  const { settings } = useAuth();
  const { t } = useTranslation();

  const colorOptions = [
    { bg: 'bg-[#006AFF]/20', border: 'border-[#006AFF]/30', text: 'text-[#00A6FF]' },
    { bg: 'bg-red-500/20', border: 'border-red-500/30', text: 'text-red-400' },
    { bg: 'bg-green-500/20', border: 'border-green-500/30', text: 'text-green-400' },
    { bg: 'bg-purple-500/20', border: 'border-purple-500/30', text: 'text-purple-400' },
    { bg: 'bg-yellow-500/20', border: 'border-yellow-500/30', text: 'text-yellow-400' },
  ];

  useEffect(() => {
    if (initialEvent) {
      setTitle(initialEvent.title);
      setDate(initialEvent.date);
      setStartTime(initialEvent.startTime);
      setEndTime(initialEvent.endTime);
      setDescription(initialEvent.description);
      setColor(initialEvent.color);
      setTextColor(initialEvent.textColor);
      setGuestEmail(initialEvent.guestEmail || '');
    } else if (selectedDate) {
      setTitle('');
      setDate(selectedDate);
      setStartTime('09:00');
      setEndTime('10:00');
      setDescription('');
      setColor('bg-[#006AFF]/20');
      setTextColor('text-[#00A6FF]');
      setAddMeet(false);
      setGuestEmail('');
    }
  }, [initialEvent, selectedDate, isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!title.trim()) return;
    setIsSaving(true);
    
    const eventId = initialEvent ? initialEvent.id : Math.random().toString(36).substr(2, 9);
    let finalMeetLink = initialEvent?.meetLink;
    if (addMeet && !finalMeetLink) {
      if (settings?.defaultMeetingLink) {
        finalMeetLink = settings.defaultMeetingLink;
      } else {
        finalMeetLink = `${window.location.origin}/video/${eventId}`;
      }
    }

    onSave({
      id: eventId,
      title,
      date,
      startTime,
      endTime,
      color,
      textColor,
      description,
      addMeet,
      guestEmail,
      meetLink: finalMeetLink
    });
    setIsSaving(false);
    onClose();
  };

  const downloadICS = async () => {
    const formatDate = (d: Date, t: string) => {
      const [h, m] = t.split(':');
      const dateObj = new Date(d);
      dateObj.setHours(parseInt(h, 10), parseInt(m, 10), 0);
      return dateObj.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const start = formatDate(date, startTime);
    const end = formatDate(date, endTime);
    
    const eventId = initialEvent ? initialEvent.id : Math.random().toString(36).substring(7);
    let activeMeetLink = initialEvent?.meetLink;
    if (addMeet && !activeMeetLink) {
      if (settings?.defaultMeetingLink) {
        activeMeetLink = settings.defaultMeetingLink;
      } else {
        activeMeetLink = `${window.location.origin}/video/${eventId}`;
      }
    }
    
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Unfract//Calendar//EN',
      'BEGIN:VEVENT',
      `UID:${icsSingleLine(eventId)}@unfract.com`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:${escapeIcsText(title || t.calendar.newEvent)}`,
      `DESCRIPTION:${escapeIcsText(description + (activeMeetLink ? `\n\n${t.calendar.joinVideoCall}: ${activeMeetLink}` : ''))}`,
      activeMeetLink ? `LOCATION:${escapeIcsText(activeMeetLink)}` : '',
      activeMeetLink ? `URL:${icsSingleLine(activeMeetLink)}` : '',
      'END:VEVENT',
      'END:VCALENDAR'
    ].filter(Boolean).join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(title || 'evento').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="relative w-full max-w-lg bg-[#0A0A0A] border border-white/10 rounded-[32px] overflow-hidden flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden rounded-[32px]">
           <div className={`absolute top-[-50px] left-[-50px] w-64 h-64 opacity-20 blur-[80px] rounded-full ${color.split('/')[0]}`} />
        </div>

        <div className="relative z-10 flex items-center justify-between p-6 border-b border-white/5">
          <h3 className="text-xl font-halfre text-white">
            {initialEvent ? t.calendar.editEvent : t.calendar.newEvent}
          </h3>
          <button onClick={onClose} className="p-2 text-[#858585] hover:text-white transition-colors hover:bg-white/5 rounded-full">
            <X size={20} />
          </button>
        </div>

        <div className="relative z-10 flex-1 p-6 md:p-8 flex flex-col gap-6">
          <input 
            type="text" 
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-2xl font-halfre text-white bg-transparent border-b border-white/10 pb-2 outline-none focus:border-white/30 placeholder:text-[#858585] w-full transition-colors"
            placeholder={t.calendar.addTitle}
            autoFocus
          />

          <div className="flex flex-col gap-4 text-sm text-white/70 font-sans">
            <div className="flex items-center gap-4">
              <CalendarIcon size={18} className="text-[#858585]" />
              <input 
                type="date"
                value={safeFormat(date, 'yyyy-MM-dd')}
                onChange={(e) => {
                  const d = parseSafeDate(e.target.value);
                  if (d) setDate(d);
                }}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white outline-none focus:border-white/30"
              />
            </div>

            <div className="flex items-center gap-4">
              <Clock size={18} className="text-[#858585]" />
              <div className="flex items-center gap-2">
                <input 
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white outline-none focus:border-white/30"
                />
                <span>-</span>
                <input 
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white outline-none focus:border-white/30"
                />
              </div>
            </div>

            <div className="flex items-start gap-4">
              <AlignLeft size={18} className="text-[#858585] mt-2" />
                <textarea 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-white/30 min-h-[100px] resize-y custom-scrollbar"
                  placeholder={t.calendar.addDescription}
                />
              </div>

              <div className="flex items-center gap-4 mt-2">
                <Users size={18} className="text-[#858585]" />
                <input 
                  type="email" 
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white outline-none focus:border-white/30 placeholder:text-[#858585]"
                  placeholder={t.calendar.guestEmailOptional}
                />
              </div>

              {initialEvent?.meetLink && (
                <div className="flex items-center gap-4 mt-2">
                  <Video size={18} className="text-[#858585]" />
                  <a 
                    href={initialEvent.meetLink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-[#006AFF] hover:underline"
                  >
                    {t.calendar.joinVideoCall}
                  </a>
                </div>
              )}
              
              <div className="flex items-center gap-4 mt-2">
              <div className="w-[18px]" />
              <div className="flex items-center gap-3">
                {colorOptions.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => { setColor(opt.bg); setTextColor(opt.text); }}
                    className={`w-6 h-6 rounded-full border-2 transition-all ${opt.bg.split('/')[0]} ${color === opt.bg ? 'border-white' : 'border-transparent opacity-50 hover:opacity-100'}`}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center gap-4 mt-2">
              <Video size={18} className="text-[#858585]" />
              <label className="flex items-center gap-3 cursor-pointer">
                <div className={`w-10 h-5 rounded-full transition-colors relative ${addMeet ? 'bg-[#006AFF]' : 'bg-white/10'}`}>
                  <div className={`w-3 h-3 rounded-full bg-white absolute top-1 transition-transform ${addMeet ? 'left-6' : 'left-1'}`} />
                </div>
                <input 
                  type="checkbox" 
                  checked={addMeet}
                  onChange={(e) => setAddMeet(e.target.checked)}
                  className="hidden"
                />
                <span className="text-white/80">
                  {settings?.defaultMeetingLink ? t.calendar.addDefaultMeet : t.calendar.generateMeetLink}
                </span>
              </label>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-end gap-3 p-6 border-t border-white/5 bg-black/40">
          {initialEvent && onDelete && (
            <button 
              onClick={() => { onDelete(initialEvent.id); onClose(); }}
              className="mr-auto px-4 py-2 text-sm font-medium text-red-400 hover:text-red-300 transition-colors"
            >
              {t.calendar.delete}
            </button>
          )}
          
          <button 
            onClick={downloadICS}
            className={`${(!initialEvent || !onDelete) ? 'mr-auto' : ''} flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#00A6FF] hover:text-[#006AFF] hover:bg-[#006AFF]/10 rounded-full transition-colors`}
            title={t.calendar.exportTooltip}
          >
            <Download size={16} />
            {t.calendar.exportICS}
          </button>

          <button 
            onClick={onClose}
            className="px-5 py-2 rounded-full border border-white/10 text-white text-sm font-medium hover:bg-white/5 transition-colors"
          >
            {t.calendar.cancel}
          </button>
          <button 
            onClick={handleSave}
            disabled={!title.trim() || isSaving}
            className="px-5 py-2 rounded-full bg-[#006AFF] text-white text-sm font-medium hover:bg-[#0055CC] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSaving ? t.calendar.saving : t.calendar.save}
          </button>
        </div>
      </div>
    </div>
  );
}
