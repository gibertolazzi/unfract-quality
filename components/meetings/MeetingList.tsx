"use client";

import React, { useState } from 'react';
import { Plus, ChevronDown, Video, Square, ExternalLink } from 'lucide-react';
import { Meeting } from './types';
import { MeetingCard } from './MeetingCard';
import { useRecording } from '@/contexts/RecordingContext';

interface MeetingListProps {
  meetings: Meeting[];
  onMeetingAdded: () => void;
}

export function MeetingList({ meetings, onMeetingAdded }: MeetingListProps) {
  const { startRecording, stopRecording, isRecording, isProcessing, openPiP } = useRecording();

  return (
    <div className="flex flex-col h-full font-sans max-w-[1229px] mx-auto w-full">
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-8">
        {isRecording || isProcessing ? (
          <div className="flex items-center gap-3">
            {isRecording && (
              <button 
                onClick={openPiP}
                className="flex items-center gap-2 bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white transition-colors px-4 py-2.5 rounded-xl text-sm font-medium"
              >
                <ExternalLink size={16} />
                Apri PiP
              </button>
            )}
            <button 
              onClick={stopRecording}
              className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500/20 transition-colors px-4 py-2.5 rounded-xl text-sm font-medium"
            >
              <Square size={16} />
              Stop Meeting
            </button>
          </div>
        ) : (
          <button 
            onClick={startRecording}
            className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500/20 transition-colors px-4 py-2.5 rounded-xl text-sm font-medium"
          >
            <Video size={16} />
            Registra Meeting
          </button>
        )}

        <button className="flex items-center gap-2 border border-white/10 bg-transparent text-[#858585] hover:text-white transition-colors px-4 py-2.5 rounded-xl text-sm font-medium">
          Ordina per: più recente
          <ChevronDown size={16} />
        </button>
      </div>

      {/* List */}
      <div className="flex flex-col gap-4 overflow-y-auto custom-scrollbar pb-10">
        {meetings.length === 0 ? (
          <div className="text-center text-[#858585] mt-10 flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <Video size={24} className="text-[#858585]" />
            </div>
            Nessun meeting registrato. Avvia una registrazione!
          </div>
        ) : (
          meetings.map(meeting => (
            <MeetingCard key={meeting.id} meeting={meeting} />
          ))
        )}
      </div>
    </div>
  );
}
