import React from 'react';
import { useTranslation } from '@/contexts/TranslationContext';
import { startOfYear, addMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, format, isSameMonth, isToday } from 'date-fns';
import { it, enUS } from 'date-fns/locale';

interface YearViewProps {
  currentDate: Date;
  onMonthClick: (date: Date) => void;
}


function MiniMonth({ date, onMonthClick, t, dateLocale }: { date: Date, onMonthClick: (d: Date) => void, t: any, dateLocale: any }) {
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  return (
    <div 
      onClick={() => onMonthClick(monthStart)}
      className="flex flex-col gap-2 p-4 bg-black/20 border border-white/10 rounded-2xl cursor-pointer hover:border-white/20 hover:bg-white/5 transition-all"
    >
      <h3 className="text-sm font-semibold text-white mb-2 pl-1">
        {format(monthStart, 'MMMM', { locale: dateLocale })}
      </h3>
      
      <div className="grid grid-cols-7 gap-y-2">
        {daysOfWeek(t).map((day: string, idx: number) => (
          <div key={idx} className={`text-[10px] text-center font-medium ${idx === 0 || idx === 6 ? 'text-[#006AFF]' : 'text-[#858585]'}`}>
            {day}
          </div>
        ))}
        {days.map((day, i) => {
          const isCurrMonth = isSameMonth(day, monthStart);
          const isCurrDay = isToday(day);
          
          return (
            <div 
              key={i} 
              className={`
                text-[11px] text-center w-6 h-6 mx-auto flex items-center justify-center rounded-full
                ${!isCurrMonth ? 'text-[#858585]' : 'text-white/80'}
                ${isCurrDay ? 'bg-[#006AFF] text-white font-bold' : ''}
              `}
            >
              {format(day, 'd', { locale: dateLocale })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const daysOfWeek = (t: any) => t.calendar.days.map((d: string) => d.charAt(0));
export function YearView({ currentDate, onMonthClick }: YearViewProps) {
  const { t, locale } = useTranslation();
  const dateLocale = locale === 'it' ? it : enUS;
  const yearStart = startOfYear(currentDate);
  const months = Array.from({ length: 12 }, (_, i) => addMonths(yearStart, i));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 p-2 h-[70vh] overflow-y-auto custom-scrollbar">
      {months.map(month => (
        <MiniMonth key={month.toString()} date={month} onMonthClick={onMonthClick} t={t} dateLocale={dateLocale} />
      ))}
    </div>
  );
}
