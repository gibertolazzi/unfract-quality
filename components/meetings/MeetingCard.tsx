"use client";

import { db } from '@/lib/firebase';
import { useDialog } from '@/contexts/DialogContext';
import { Meeting } from './types';
import { Clock, Users, ArrowRight, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { deleteMeeting } from '@/lib/meetings';
import { useTranslation } from '@/contexts/TranslationContext';

export function MeetingCard({ meeting }: { meeting: any }) {
  const router = useRouter();
  const dialog = useDialog();
  const { t } = useTranslation();

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const isConfirmed = await dialog.confirm({
      title: t.meetings.deleteTitle,
      message: t.meetings.deleteConfirm,
      isDestructive: true,
      confirmText: t.meetings.delete
    });
    if (isConfirmed) {
      await deleteMeeting(meeting.id);
    }
  };

  return (
    <div 
      onClick={() => router.push(`/meetings/${meeting.id}`)}
      className="bg-[#111] hover:bg-[#1A1A1A] border border-white/5 rounded-2xl p-5 cursor-pointer transition-all flex items-center justify-between group"
    >
      <div className="flex flex-col gap-2">
        <h3 className="text-white font-medium text-lg">{meeting.title}</h3>
        <div className="flex items-center gap-4 text-sm text-[#858585]">
          <span className="flex items-center gap-1.5"><Clock size={14} /> {meeting.date} • {meeting.duration}</span>
          <span className="flex items-center gap-1.5"><Users size={14} /> {meeting.manager}</span>
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        {meeting.tasks.length > 0 && (
          <div className="bg-[#006AFF]/10 text-[#006AFF] px-3 py-1 rounded-full text-xs font-medium">
            {meeting.tasks.length} {t.meetings.taskCount}
          </div>
        )}
        <button 
          onClick={handleDelete}
          className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-[#858585] hover:bg-red-500/20 hover:text-red-500 transition-colors"
          title={t.meetings.deleteTooltip}
        >
          <Trash2 size={18} />
        </button>
        <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-[#858585] group-hover:bg-[#006AFF] group-hover:text-white transition-colors">
          <ArrowRight size={18} />
        </div>
      </div>
    </div>
  );
}
