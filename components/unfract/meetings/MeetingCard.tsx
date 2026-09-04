"use client";

import React from 'react';
import { Meeting } from './types';
import { Clock, Users, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function MeetingCard({ meeting }: { meeting: Meeting }) {
  const router = useRouter();

  return (
    <div 
      onClick={() => router.push(`/meetings/${meeting.id}`)}
      className="bg-[#111] hover:bg-[#1A1A1A] border border-white/5 rounded-2xl p-5 cursor-pointer transition-all flex items-center justify-between group"
    >
      <div className="flex flex-col gap-2">
        <h3 className="text-white font-medium text-lg">{meeting.title}</h3>
        <div className="flex items-center gap-4 text-sm text-white/40">
          <span className="flex items-center gap-1.5"><Clock size={14} /> {meeting.date} • {meeting.duration}</span>
          <span className="flex items-center gap-1.5"><Users size={14} /> {meeting.manager}</span>
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        {meeting.tasks.length > 0 && (
          <div className="bg-[#006AFF]/10 text-[#006AFF] px-3 py-1 rounded-full text-xs font-medium">
            {meeting.tasks.length} Task
          </div>
        )}
        <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/50 group-hover:bg-[#006AFF] group-hover:text-white transition-colors">
          <ArrowRight size={18} />
        </div>
      </div>
    </div>
  );
}
