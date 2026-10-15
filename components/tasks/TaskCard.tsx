"use client";

import React from 'react';
import { Calendar } from 'lucide-react';
import { Draggable } from '@hello-pangea/dnd';
import { StatusPicker } from '@/components/tasks/StatusPicker';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/contexts/TranslationContext';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { safeFormat } from '@/lib/dateUtils';

const priorityStyles = {
  High: 'text-[#FF2200] border-[#FF2200]',
  Medium: 'text-[#FFAE00] border-[#FFAE00]',
  Low: 'text-[#006AFF] border-[#006AFF]',
  Critical: 'text-[#FF0004] border-[#FF0004]'
};

export function TaskCard({ 
  task, 
  index, 
  onClick,
  membersMap,
  columns,
  onMove
}: { 
  task: any; 
  index: number; 
  onClick: () => void;
  membersMap?: Map<string, { displayName: string; photoURL?: string }>;
  /** Con colonne e onMove la scheda mostra lo stato e «Sposta in». */
  columns?: any[];
  onMove?: (task: any, columnId: string) => void;
}) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const priorityLabels: Record<string, string> = {
    Critical: t.tasks.priorityCritical,
    High: t.tasks.priorityHigh,
    Medium: t.tasks.priorityMedium,
    Low: t.tasks.priorityLow,
  };
  let blobColors = ['bg-blue-600/40', 'bg-transparent'];
  if (task.priority === 'High' || task.priority === 'Critical') {
    blobColors = ['bg-red-600/40', 'bg-transparent'];
  } else if (task.priority === 'Medium') {
    blobColors = ['bg-yellow-500/40', 'bg-transparent'];
  } else if (task.priority === 'Low') {
    blobColors = ['bg-blue-600/40', 'bg-transparent'];
  }

  const assignee = task.assigneeUid && membersMap ? membersMap.get(task.assigneeUid) : null;
  const isMine = task.assigneeUid === user?.uid;
  const avatarSrc = assignee?.photoURL || (isMine ? user?.photoURL : undefined);
  const avatarName = assignee?.displayName || task.assignee || (isMine ? (user?.displayName || user?.email) : undefined) || 'Unassigned';
  
  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div 
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={onClick}
          id={`task-${task.id}`}
          className={`relative min-h-[185px] w-full shrink-0 overflow-hidden flex flex-col gap-5 p-6 bg-black border rounded-3xl group transition-all ${snapshot.isDragging ? 'border-white/20 shadow-xl scale-[1.02]' : 'border-white/5 hover:border-white/10'} transition-all duration-500`}
        >
          {/* Animated Blobs */}
          <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden rounded-3xl">
            <div className="absolute top-[-20px] left-[-20px] w-40 h-40 opacity-40 blur-[50px] animate-blob">
              <div className={`w-full h-full rounded-full ${blobColors[0]}`} />
            </div>
            {blobColors[1] && blobColors[1] !== 'bg-transparent' && (
              <div className="absolute top-[20px] right-[-20px] w-32 h-32 opacity-30 blur-[40px] animate-blob" style={{animationDelay: '2s'}}>
                <div className={`w-full h-full rounded-full ${blobColors[1]}`} />
              </div>
            )}
          </div>

          <div className="relative z-10 flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#858585]">
                <Calendar size={16} />
                <span className="text-[13px] font-sans font-medium">{typeof task.date === 'string' && task.date.trim() ? task.date : (safeFormat(task.date, 'yyyy-MM-dd') || t.tasks.noDate)}</span>
              </div>
              <div className={`px-3 py-1 text-xs rounded-full border ${priorityStyles[task.priority as keyof typeof priorityStyles] || 'text-white/60 border-white/20'}`}>
                {priorityLabels[task.priority] || t.tasks.priorityMedium}
              </div>
            </div>
            <h3 className="break-words text-[22px] text-white font-halfre tracking-wide">{task.title || t.tasks.untitled}</h3>
          </div>
          
          <div className="relative z-10 flex items-center justify-between mt-2">
            <div className="flex items-center -space-x-2" title={avatarName ? `${t.tasks.assignedTo} ${avatarName}` : undefined}>
              <UserAvatar
                src={avatarSrc}
                name={avatarName}
                className="w-8 h-8 rounded-full border border-black bg-blue-600 overflow-hidden flex items-center justify-center text-white font-bold text-xs"
                imageClassName="w-full h-full object-cover"
              />
            </div>
            
            <div className="flex min-w-0 items-center gap-2">
              {columns && onMove && (
                <StatusPicker task={task} columns={columns} onMove={columnId => onMove(task, columnId)} compact />
              )}
              <div className="truncate px-4 py-1.5 rounded-full bg-white/10 text-white/60 text-xs font-sans">
                {task.category || t.tasks.general}
              </div>
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
}
