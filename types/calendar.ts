export interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  startTime: string; // e.g., "16:00"
  endTime: string;   // e.g., "17:00"
  color: string;     // bg color class
  textColor: string; // text color class
  description: string;
  meetLink?: string;
  addMeet?: boolean;
  guestEmail?: string;
}

export type CalendarViewType = 'day' | 'week' | 'month' | 'year';
