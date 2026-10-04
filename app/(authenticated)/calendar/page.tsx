import React from "react";
import { CalendarBoard } from "@/components/calendar/CalendarBoard";

export const dynamic = 'force-dynamic';

export default function CalendarPage() {
  return (
    <div className="min-h-full">
      <CalendarBoard />
    </div>
  );
}
