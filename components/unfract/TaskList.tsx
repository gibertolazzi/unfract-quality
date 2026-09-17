import React from 'react';
import { Calendar, ChevronDown, Check } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const priorityConfig = {
  High: { color: 'text-[#FF2200]', border: 'border-[#FF2200]', bg: 'bg-[#FF2200]/10', icon: 'M12 2L2 22h20L12 2zm0 6v8m0 4h.01' },
  Medium: { color: 'text-[#FFAE00]', border: 'border-[#FFAE00]', bg: 'bg-[#FFAE00]/10', icon: 'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z' },
  Low: { color: 'text-[#006AFF]', border: 'border-[#006AFF]', bg: 'bg-[#006AFF]/10', icon: 'M22 12l-10 10L2 12' },
  Critical: { color: 'text-[#FF0004]', border: 'border-[#FF0004]', bg: 'bg-[#FF0004]/10', icon: 'M3 3h18v18H3z' }
};

import { useAuth } from '@/contexts/AuthContext';

export function TaskList({ tasks, columns, onTaskClick, onToggleDone }: { tasks: any[]; columns: any[]; onTaskClick: (task: any) => void; onToggleDone: (task: any) => void }) {
  const { user } = useAuth();
  const getPriorityStyle = (priority: string) => priorityConfig[priority as keyof typeof priorityConfig] || priorityConfig.Medium;

  return (
    <div className="flex flex-col gap-4 w-full h-full pb-8">
      {tasks.map((task, index) => {
        const priorityStyle = getPriorityStyle(task.priority);
        const col = columns.find(c => c.id === task.columnId);
        const isDone = col?.title.toLowerCase() === 'done';

        let blobColors = ['bg-blue-600/40', 'bg-transparent'];
        if (task.priority === 'High' || task.priority === 'Critical') {
          blobColors = ['bg-red-600/40', 'bg-transparent'];
        } else if (task.priority === 'Medium') {
          blobColors = ['bg-yellow-500/40', 'bg-transparent'];
        } else if (task.priority === 'Low') {
          blobColors = ['bg-blue-600/40', 'bg-transparent'];
        }
        
        return (
          <div 
            key={task.id}
            onClick={() => onTaskClick(task)}
            className="relative overflow-hidden flex items-center justify-between p-4 bg-black border border-white/5 rounded-2xl hover:border-white/10 hover:bg-white/5 cursor-pointer transition-colors w-full group"
          >
            {/* Animated Blobs */}
            <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden rounded-2xl">
              <div className="absolute top-[-40px] left-[-20px] w-48 h-48 opacity-20 blur-[50px] animate-blob">
                <div className={`w-full h-full rounded-full ${blobColors[0]}`} />
              </div>
            </div>

            {/* Left side */}
            <div className="relative z-10 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <button 
                  onClick={(e) => { e.stopPropagation(); onToggleDone(task); }}
                  className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${isDone ? 'bg-[#006AFF] border-[#006AFF]' : 'border-white/20 bg-transparent hover:border-[#006AFF]'}`}
                >
                  {isDone && <Check size={14} className="text-white" />}
                </button>
                <span className="text-[#006AFF] font-medium text-sm">[{index + 1}]</span>
                <h3 className={`text-white text-base ${isDone ? 'line-through opacity-50' : ''}`}>{task.title || 'Untitled'}</h3>
              </div>
              
              <div className="flex items-center gap-6 ml-8">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-blue-600 overflow-hidden border border-black shrink-0 flex items-center justify-center text-[10px] text-white font-bold" title={user?.displayName || "Utente"}>
                    {user?.photoURL ? (
                      <img src={user.photoURL} alt={user.displayName || ""} className="w-full h-full object-cover" />
                    ) : (
                      (user?.displayName ? user.displayName.charAt(0) : 'U').toUpperCase()
                    )}
                  </div>
                  <span className="text-white/70 text-xs">{user?.displayName || "Utente"} <span className="text-[#858585]">(R)</span></span>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-blue-600 overflow-hidden border border-black shrink-0 flex items-center justify-center text-[10px] text-white font-bold" title={user?.displayName || "Utente"}>
                    {user?.photoURL ? (
                      <img src={user.photoURL} alt={user.displayName || ""} className="w-full h-full object-cover" />
                    ) : (
                      (user?.displayName ? user.displayName.charAt(0) : 'U').toUpperCase()
                    )}
                  </div>
                  <span className="text-white/70 text-xs">{user?.displayName || "Utente"} <span className="text-[#858585]">(A)</span></span>
                </div>
              </div>
            </div>

            {/* Right side */}
            <div className="relative z-10 flex flex-col items-end gap-3 shrink-0">
              <div className="flex items-center gap-3">
                {/* Priority Pill */}
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border ${priorityStyle.border} ${priorityStyle.bg}`}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={priorityStyle.color}>
                    <path d={priorityStyle.icon} />
                  </svg>
                  <span className={`text-[11px] font-medium ${priorityStyle.color}`}>{task.priority}</span>
                </div>
                
                {/* Status Dropdown Pill */}
                <div className="flex items-center gap-2 px-3 py-1 rounded-full border text-[11px] font-medium cursor-pointer transition-colors border-blue-500/50 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20">
                  {col?.title || 'Unknown'}
                  <ChevronDown size={12} />
                </div>
              </div>
              <div className="flex items-center gap-4 text-[11px] text-[#858585]">
                <span>Created: {task.createdAt ? formatDistanceToNow(task.createdAt.toDate ? task.createdAt.toDate() : new Date(task.createdAt), { addSuffix: true }) : 'N/A'}</span>
                <span>Updated: {task.updatedAt ? formatDistanceToNow(task.updatedAt.toDate ? task.updatedAt.toDate() : new Date(task.updatedAt), { addSuffix: true }) : 'N/A'}</span>
                <span>Deadline: <strong className={`font-medium ${new Date(task.date) < new Date() && !isDone ? 'text-red-500' : 'text-white'}`}>{task.date || 'N/A'}</strong></span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
