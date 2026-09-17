import React, { useState } from 'react';
import { Circle, ChevronDown, ChevronRight, PlusCircle, CheckCircle2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { CustomPrompt } from '@/components/unfract/shared/CustomPrompt';

import { useProject } from '@/contexts/ProjectContext';

const priorityConfig = {
  High: { color: 'text-[#FF2200]', border: 'border-[#FF2200]', bg: 'bg-[#FF2200]/10' },
  Medium: { color: 'text-[#FFAE00]', border: 'border-[#FFAE00]', bg: 'bg-[#FFAE00]/10' },
  Low: { color: 'text-[#006AFF]', border: 'border-[#006AFF]', bg: 'bg-[#006AFF]/10' },
  Critical: { color: 'text-[#FF0004]', border: 'border-[#FF0004]', bg: 'bg-[#FF0004]/10' }
};

export function TaskTimeline({ 
  tasks, 
  epics, 
  columns, 
  onTaskClick, 
  onToggleDone 
}: { 
  tasks: any[]; 
  epics: any[]; 
  columns: any[]; 
  onTaskClick: (task: any) => void; 
  onToggleDone: (task: any) => void;
}) {
  const [expandedEpics, setExpandedEpics] = useState<string[]>([]);
  const [showEpicPrompt, setShowEpicPrompt] = useState(false);
  const { activeProjectId } = useProject();

  const toggleEpic = (epicId: string) => {
    setExpandedEpics(prev => prev.includes(epicId) ? prev.filter(id => id !== epicId) : [...prev, epicId]);
  };

  const createEpic = async (title: string, color?: string) => {
    if (!activeProjectId) return;
    const defaultColors = ['#006AFF', '#00FF00', '#FF0004', '#FFAE00', '#9D00FF'];
    const selectedColor = color || defaultColors[Math.floor(Math.random() * defaultColors.length)];
    await addDoc(collection(db, 'epics'), {
      title,
      color: selectedColor,
      createdAt: new Date().toISOString(),
      projectId: activeProjectId
    });
    setShowEpicPrompt(false);
  };

  const getPriorityStyle = (priority: string) => priorityConfig[priority as keyof typeof priorityConfig] || priorityConfig.Medium;

  // Timeline Config (Jan 1 to Dec 31 2026)
  const timelineStart = new Date('2026-01-01T00:00:00Z').getTime();
  const timelineEnd = new Date('2026-12-31T23:59:59Z').getTime();
  const totalMs = timelineEnd - timelineStart;
  const totalWidth = 2400; // px
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const currentMonthIndex = new Date().getMonth();

  const getTaskIntervals = (epicTasks: any[]) => {
    const intervals = epicTasks.map(t => {
      // Safely parse dates
      let start = t.createdAt?.toDate ? t.createdAt.toDate().getTime() : new Date(t.createdAt).getTime();
      if (isNaN(start)) start = timelineStart;
      
      const isDone = columns.find(c => c.id === t.columnId)?.title.toLowerCase() === 'done';
      let end = new Date().getTime(); // if not done, active up to today
      if (isDone && t.completedAt) {
        end = t.completedAt.toDate ? t.completedAt.toDate().getTime() : new Date(t.completedAt).getTime();
      }
      if (isNaN(end)) end = new Date().getTime();

      // Ensure start <= end
      if (start > end) start = end - 86400000; 
      
      return { start, end };
    }).filter(int => int.start <= timelineEnd && int.end >= timelineStart);

    // Sort by start
    intervals.sort((a, b) => a.start - b.start);

    // Merge overlapping
    const merged: {start: number, end: number}[] = [];
    for (const int of intervals) {
      if (merged.length === 0) {
        merged.push(int);
      } else {
        const last = merged[merged.length - 1];
        if (int.start <= last.end) {
          last.end = Math.max(last.end, int.end);
        } else {
          merged.push(int);
        }
      }
    }
    return merged;
  };

  return (
    <div className="flex h-full w-full bg-[#0A0A0A] border-t border-white/5 font-sans overflow-hidden">
      
      {/* Left Sidebar (Epics & Tasks) */}
      <div className="w-[300px] shrink-0 border-r border-white/5 flex flex-col bg-[#0A0A0A] overflow-y-auto custom-scrollbar">
        <div className="p-4 border-b border-white/5">
          <h2 className="text-xl font-semibold text-white">Epics</h2>
        </div>
        
        <div className="flex flex-col p-4 gap-4 pb-20">
          {epics.map(epic => {
            const isExpanded = expandedEpics.includes(epic.id);
            const epicTasks = tasks.filter(t => t.epicId === epic.id);
            
            const doneTasks = epicTasks.filter(t => columns.find(c => c.id === t.columnId)?.title.toLowerCase() === 'done');
            const progress = epicTasks.length > 0 ? (doneTasks.length / epicTasks.length) * 100 : 0;
            
            return (
              <div key={epic.id} className="flex flex-col bg-[#111] border border-white/5 rounded-2xl overflow-hidden p-3 gap-3">
                <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleEpic(epic.id)}>
                  <div className="flex items-center gap-2">
                    {isExpanded ? <ChevronDown size={16} className="text-[#858585]" /> : <ChevronRight size={16} className="text-[#858585]" />}
                    <span className="text-sm font-medium text-white">{epic.title}</span>
                  </div>
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: epic.color }}></div>
                </div>
                
                {/* Progress bar */}
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, backgroundColor: epic.color }}></div>
                </div>
                
                {/* Tasks List */}
                {isExpanded && (
                  <div className="flex flex-col gap-2 mt-2">
                    {epicTasks.length === 0 && <span className="text-xs text-[#858585] italic px-2">Nessuna task in questo Epic</span>}
                    {epicTasks.map(t => {
                      const isDone = columns.find(c => c.id === t.columnId)?.title.toLowerCase() === 'done';
                      const pStyle = getPriorityStyle(t.priority);
                      
                      return (
                        <div 
                          key={t.id} 
                          className="flex items-center justify-between px-2 py-1.5 hover:bg-white/5 rounded-lg transition-colors cursor-pointer group"
                          onClick={() => onTaskClick(t)}
                        >
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={(e) => { e.stopPropagation(); onToggleDone(t); }}
                              className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${isDone ? 'bg-[#006AFF] border-[#006AFF]' : 'border-white/20 bg-transparent group-hover:border-[#006AFF]'}`}
                            >
                              {isDone && <CheckCircle2 size={10} className="text-white" />}
                            </button>
                            <span className={`text-xs ${isDone ? 'text-[#858585] line-through' : 'text-white/80'}`}>{t.title || 'Untitled'}</span>
                          </div>
                          
                          <span className={`text-[9px] px-2 py-0.5 rounded-full border ${pStyle.border} ${pStyle.bg} ${pStyle.color} font-medium tracking-wide uppercase ml-2 shrink-0`}>
                            {isDone ? 'Done' : 'To Do'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          
          <button onClick={() => setShowEpicPrompt(true)} className="flex items-center gap-2 text-[#858585] hover:text-white mt-2 px-2 transition-colors">
            <PlusCircle size={16} />
            <span className="text-sm font-medium">Create Epic</span>
          </button>
        </div>
      </div>
      
      {/* Right side Gantt chart (Timeline) */}
      <div className="flex-1 overflow-x-auto relative flex flex-col bg-[#050505] custom-scrollbar">
        
        {/* Months Header */}
        <div className="flex items-center h-16 border-b border-white/5 shrink-0 min-w-max">
          {months.map((month, index) => {
            const isCurrent = index === currentMonthIndex;
            return (
              <div key={month} className={`w-[200px] px-4 text-xs font-semibold border-l border-white/5 h-full flex items-center ${isCurrent ? 'text-[#006AFF] bg-[#006AFF]/5' : 'text-[#858585]'}`}>
                {month}
              </div>
            );
          })}
        </div>
        
        {/* Grid and Bars Area */}
        <div className="flex-1 relative min-w-max pb-20">
          {/* Background Grid Lines */}
          <div className="absolute inset-0 flex pointer-events-none">
            {months.map((_, index) => (
              <div key={index} className={`w-[200px] border-l border-white/5 h-full ${index === currentMonthIndex ? 'bg-[#006AFF]/5' : ''}`}></div>
            ))}
          </div>
          
          {/* Bars */}
          <div className="relative pt-6 px-2 flex flex-col gap-[72px]">
            {epics.map(epic => {
              const epicTasks = tasks.filter(t => t.epicId === epic.id);
              const intervals = getTaskIntervals(epicTasks);
              
              return (
                <div key={epic.id} className="relative h-6 w-[2400px]">
                  {intervals.map((int, i) => {
                    // clamp to viewable timeline
                    const startClamped = Math.max(timelineStart, int.start);
                    const endClamped = Math.min(timelineEnd, int.end);
                    
                    const leftPercent = ((startClamped - timelineStart) / totalMs);
                    const widthPercent = ((endClamped - startClamped) / totalMs);
                    
                    const leftPx = leftPercent * totalWidth;
                    const widthPx = Math.max(widthPercent * totalWidth, 4); // min 4px wide to be visible
                    
                    return (
                      <div 
                        key={i}
                        className="absolute h-full rounded-full shadow-lg transition-all duration-500 hover:brightness-125" 
                        style={{ 
                          backgroundColor: epic.color, 
                          left: `${leftPx}px`, 
                          width: `${widthPx}px` 
                        }}
                      ></div>
                    );
                  })}
                  {intervals.length === 0 && (
                    <div className="absolute h-full flex items-center pl-4 text-xs text-[#858585] italic">No tasks assigned</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        
      </div>
      {showEpicPrompt && (
        <CustomPrompt 
          title="Crea nuovo Epic" 
          placeholder="Nome del nuovo Epic..." 
          onConfirm={createEpic} 
          onClose={() => setShowEpicPrompt(false)}
          colors={['#006AFF', '#00FF00', '#FF0004', '#FFAE00', '#9D00FF']}
        />
      )}
    </div>
  );
}
