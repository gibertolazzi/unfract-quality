import React from 'react';
import { CalendarEvent } from './types';
import { format, isSameDay, isToday } from 'date-fns';

interface DayViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onTimeSlotClick: (date: Date, hour: number) => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function DayView({ currentDate, events, onEventClick, onTimeSlotClick }: DayViewProps) {
  const dayEvents = events.filter(e => isSameDay(e.date, currentDate));

  return (
    <div className="flex flex-col bg-black/20 border border-white/10 rounded-2xl overflow-hidden h-[70vh] flex-1">
      {/* Header */}
      <div className="flex border-b border-white/10">
        <div className="w-16 shrink-0 border-r border-white/5" />
        <div className="flex-1 text-center py-4">
          <div className="text-sm text-[#858585] font-medium uppercase">{format(currentDate, 'EEEE')}</div>
          <div className={`mx-auto w-fit px-4 py-1 rounded-full text-2xl font-bold mt-1 ${isToday(currentDate) ? 'bg-[#006AFF] text-white' : 'text-white'}`}>
            {format(currentDate, 'd MMMM yyyy')}
          </div>
        </div>
      </div>
      
      {/* Scrollable Grid */}
      <div className="flex-1 overflow-y-auto custom-scrollbar flex">
        {/* Time Column */}
        <div className="w-16 shrink-0 border-r border-white/5 flex flex-col">
          {HOURS.map(hour => (
            <div key={hour} className="h-24 flex items-start justify-center text-xs text-[#858585] pt-2 border-b border-white/5">
              {hour.toString().padStart(2, '0')}:00
            </div>
          ))}
        </div>
        
        {/* Day Column */}
        <div className="flex-1 flex flex-col">
          {HOURS.map(hour => {
            const slotEvents = dayEvents.filter(e => parseInt(e.startTime.split(':')[0]) === hour);
            
            return (
              <div 
                key={hour} 
                onClick={() => onTimeSlotClick(currentDate, hour)}
                className="h-24 border-b border-white/5 p-2 hover:bg-white/5 transition-colors cursor-pointer relative flex flex-col gap-1"
              >
                {slotEvents.map(ev => (
                  <div 
                    key={ev.id}
                    onClick={(e) => { e.stopPropagation(); onEventClick(ev); }}
                    className={`px-3 py-2 rounded-lg ${ev.color} border border-white/5 ${ev.textColor} text-xs font-medium cursor-pointer hover:brightness-125 transition-all w-full max-w-md`}
                  >
                    <div className="font-bold mb-0.5">{ev.startTime} - {ev.endTime}</div>
                    <div className="truncate">{ev.title}</div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
