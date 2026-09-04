import React from 'react';
import { CalendarEvent } from './types';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, format, isSameMonth, isSameDay } from 'date-fns';
import { it } from 'date-fns/locale';

interface MonthViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onDayClick: (date: Date) => void;
}

const daysOfWeek = [
  { label: 'Sun', color: 'text-[#006AFF]' },
  { label: 'Mon', color: 'text-white/50' },
  { label: 'Tue', color: 'text-white/50' },
  { label: 'Wed', color: 'text-white/50' },
  { label: 'Thu', color: 'text-white/50' },
  { label: 'Fri', color: 'text-white/50' },
  { label: 'Sat', color: 'text-[#006AFF]' }
];

export function MonthView({ currentDate, events, onEventClick, onDayClick }: MonthViewProps) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days = eachDayOfInterval({ start: startDate, end: endDate });

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-7 px-4">
        {daysOfWeek.map((day, idx) => (
          <div key={idx} className={`text-[13px] font-semibold ${day.color}`}>
            {day.label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 border border-white/10 rounded-2xl overflow-hidden bg-black/20">
        {days.map((day, index) => {
          const isCurrentMonth = isSameMonth(day, monthStart);
          const isLastCol = (index + 1) % 7 === 0;
          const isLastRow = index >= days.length - 7;
          const dayEvents = events.filter(e => isSameDay(e.date, day)).sort((a, b) => a.startTime.localeCompare(b.startTime));

          return (
            <div 
              key={day.toString()} 
              onClick={() => onDayClick(day)}
              className={`flex flex-col p-2 min-h-[120px] cursor-pointer hover:bg-white/5 transition-colors ${!isLastCol ? 'border-r border-white/5' : ''} ${!isLastRow ? 'border-b border-white/5' : ''}`}
            >
              <span className={`text-[13px] font-semibold mb-1 ${!isCurrentMonth ? 'text-white/40' : 'text-white'}`}>
                {format(day, 'd')}
              </span>
              
              <div className="flex flex-col gap-1 mt-1 flex-1 overflow-y-auto custom-scrollbar">
                {dayEvents.map(ev => (
                  <div 
                    key={ev.id} 
                    onClick={(e) => { e.stopPropagation(); onEventClick(ev); }}
                    className={`px-2 py-1 rounded-md ${ev.color} border border-white/5 ${ev.textColor} text-[10px] font-medium truncate flex gap-1.5 cursor-pointer hover:brightness-125 transition-all`}
                  >
                    <span className="font-bold shrink-0">{ev.startTime}</span>
                    <span className="truncate">{ev.title}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
