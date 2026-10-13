import React from 'react';
import { useTranslation } from '@/contexts/TranslationContext';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { CalendarEvent } from './types';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isToday } from 'date-fns';
import { safeFormat } from '@/lib/dateUtils';
import { it, enUS } from 'date-fns/locale';

interface MonthViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onDayClick: (date: Date) => void;
}

const daysOfWeekColors = [
  'text-[#006AFF]',
  'text-[#858585]',
  'text-[#858585]',
  'text-[#858585]',
  'text-[#858585]',
  'text-[#858585]',
  'text-[#006AFF]'
];

export function MonthView({ currentDate, events, onEventClick, onDayClick }: MonthViewProps) {
  const { t, locale } = useTranslation();
  const dateLocale = locale === 'it' ? it : enUS;
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days = eachDayOfInterval({ start: startDate, end: endDate });

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-7 px-4">
        {t.calendar.days.map((day, idx) => (
          <div key={idx} className={`text-[13px] font-semibold ${daysOfWeekColors[idx]}`}>
            {day.substring(0, 3)}
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
              <Droppable droppableId={`month_${day.toISOString()}`} key={day.toString()}>
                {(provided, snapshot) => (
                  <div 
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    onClick={() => onDayClick(day)}
                    className={`flex flex-col p-2 min-h-[120px] cursor-pointer hover:bg-white/5 transition-colors ${!isLastCol ? 'border-r border-white/5' : ''} ${!isLastRow ? 'border-b border-white/5' : ''} ${snapshot.isDraggingOver ? 'bg-white/10' : ''}`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className={`flex items-center justify-center text-[13px] font-semibold w-6 h-6 rounded-full ${isToday(day) ? 'bg-[#006AFF] text-white' : (!isCurrentMonth ? 'text-[#858585]' : 'text-white')}`}>
                        {safeFormat(day, 'd', { locale: dateLocale })}
                      </span>
                    </div>
                    
                    <div className="flex flex-col gap-1 flex-1 overflow-y-auto custom-scrollbar">
                      {dayEvents.map((ev, idx) => (
                        <Draggable key={ev.id} draggableId={ev.id} index={idx}>
                          {(provided, snapshot) => (
                            <div id={`event-${ev.id}`} 
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              style={provided.draggableProps.style}
                              onClick={(e) => { e.stopPropagation(); onEventClick(ev); }}
                              className={`px-2 py-1 rounded-md ${ev.color} border border-white/5 ${ev.textColor} text-[10px] font-medium truncate flex gap-1.5 cursor-pointer hover:brightness-125 select-none transition-all ${snapshot.isDragging ? 'shadow-xl opacity-90' : ''}`}
                            >
                              <span className="font-bold shrink-0">{ev.startTime}</span>
                              <span className="truncate">{ev.title}</span>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  </div>
                )}
              </Droppable>
          );
        })}
      </div>
    </div>
  );
}
