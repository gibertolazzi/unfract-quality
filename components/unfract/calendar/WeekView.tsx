import React from 'react';
import { CalendarEvent } from './types';
import { startOfWeek, endOfWeek, eachDayOfInterval, format, isSameDay, isToday } from 'date-fns';

interface WeekViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onTimeSlotClick: (date: Date, hour: number) => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function WeekView({ currentDate, events, onEventClick, onTimeSlotClick }: WeekViewProps) {
  const startDate = startOfWeek(currentDate, { weekStartsOn: 0 });
  const endDate = endOfWeek(currentDate, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  return (
    <div className="flex flex-col bg-black/20 border border-white/10 rounded-2xl overflow-hidden h-[70vh] flex-1">
      {/* Header */}
      <div className="flex border-b border-white/10">
        <div className="w-16 shrink-0 border-r border-white/5" /> {/* Time column header */}
        {days.map((day, i) => (
          <div key={i} className={`flex-1 text-center py-3 border-white/5 ${i !== days.length - 1 ? 'border-r' : ''}`}>
            <div className="text-xs text-[#858585] font-medium uppercase">{format(day, 'EEE')}</div>
            <div className={`mx-auto w-8 h-8 flex items-center justify-center rounded-full text-lg font-semibold mt-1 ${isToday(day) ? 'bg-[#006AFF] text-white' : 'text-white'}`}>
              {format(day, 'd')}
            </div>
          </div>
        ))}
      </div>
      
      {/* Scrollable Grid */}
      <div className="flex-1 overflow-y-auto custom-scrollbar flex">
        {/* Time Column */}
        <div className="w-16 shrink-0 border-r border-white/5 flex flex-col">
          {HOURS.map(hour => (
            <div key={hour} className="h-20 flex items-start justify-center text-xs text-[#858585] pt-2 border-b border-white/5">
              {hour.toString().padStart(2, '0')}:00
            </div>
          ))}
        </div>
        
        {/* Days Columns */}
        <div className="flex-1 flex">
          {days.map((day, dayIdx) => {
            const dayEvents = events.filter(e => isSameDay(e.date, day));
            return (
              <div key={dayIdx} className={`flex-1 flex flex-col border-white/5 ${dayIdx !== days.length - 1 ? 'border-r' : ''}`}>
                {HOURS.map(hour => {
                  // Find events starting in this hour (simplified for MVP)
                  const slotEvents = dayEvents.filter(e => parseInt(e.startTime.split(':')[0]) === hour);
                  
                  return (
                    <div 
                      key={hour} 
                      onClick={() => onTimeSlotClick(day, hour)}
                      className="h-20 border-b border-white/5 p-1 hover:bg-white/5 transition-colors cursor-pointer relative"
                    >
                      {slotEvents.map(ev => (
                        <div 
                          key={ev.id}
                          onClick={(e) => { e.stopPropagation(); onEventClick(ev); }}
                          className={`px-2 py-1 mb-1 rounded-md ${ev.color} border border-white/5 ${ev.textColor} text-[10px] font-medium leading-tight cursor-pointer hover:brightness-125 transition-all`}
                        >
                          <div className="font-bold">{ev.startTime} - {ev.endTime}</div>
                          <div className="truncate">{ev.title}</div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
