'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Droppable } from '@hello-pangea/dnd';
import { TaskCard } from '@/components/tasks/TaskCard';
import { StatusDot } from '@/components/tasks/StatusPicker';
import { useTranslation } from '@/contexts/TranslationContext';
import { cellId } from '@/lib/boardFilters';
import { displayColumnId } from '@/lib/taskWorkflow';
import { columnColor } from '@/lib/statusColors';

/**
 * Bacheca a corsie (lib/boardFilters.ts): una riga per assegnatario, epic o
 * priorità, con le colonne del flusso. Le celle sono `corsia::colonna` per il
 * drag and drop; una corsia si chiude cliccando sul nome.
 */
export function SwimlaneBoard({ columns, lanes, onTaskClick, onMove, dropBlockFor, membersMap }: {
  columns: any[];
  lanes: { key: string; label: string; tasks: any[] }[];
  onTaskClick: (task: any) => void;
  onMove: (task: any, columnId: string) => void;
  dropBlockFor: (lane: string, columnId: string) => string | null;
  membersMap?: Map<string, { displayName: string; photoURL?: string }>;
}) {
  const { t } = useTranslation();
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const toggle = (key: string) => setClosed(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const width = 'w-[calc(100vw-3.75rem)] max-w-[340px] min-w-[260px] shrink-0 sm:w-[340px] sm:min-w-[340px] lg:w-[360px]';

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto pb-4 scroll-smooth">
      <div className="sticky top-0 z-20 flex gap-3.5 sm:gap-6 md:gap-8 bg-black/90 pb-3 backdrop-blur">
        {columns.map(column => (
          <div key={column.id} className={`${width} flex items-center gap-2 px-2`}>
            <StatusDot color={columnColor(column)} className="h-2.5 w-2.5" />
            <span className="truncate text-base sm:text-lg font-bold text-white">{column.title}</span>
          </div>
        ))}
      </div>

      {lanes.map(lane => {
        const open = !closed.has(lane.key);
        return (
          <section key={lane.key} className="mb-4">
            <button
              type="button"
              onClick={() => toggle(lane.key)}
              aria-expanded={open}
              className="sticky left-0 mb-2 flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-medium text-white/85 hover:bg-white/5"
            >
              {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              {lane.label}
              <span className="rounded-full bg-white/10 px-2 text-[11px] text-white/60">{lane.tasks.length}</span>
            </button>
            {open && (
              <div className="flex gap-3.5 sm:gap-6 md:gap-8">
                {columns.map(column => {
                  const cellTasks = lane.tasks
                    .filter(task => displayColumnId(task, columns) === column.id)
                    .sort((a, b) => (a.order || 0) - (b.order || 0));
                  const block = dropBlockFor(lane.key, column.id);
                  return (
                    <Droppable key={column.id} droppableId={cellId(lane.key, column.id)} type="task" isDropDisabled={!!block}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          title={block || undefined}
                          className={`${width} flex min-h-[120px] flex-col gap-3 rounded-2xl sm:rounded-[24px] border bg-[#0C0C0C] p-2.5 sm:p-3 transition-colors ${block ? 'border-dashed border-red-500/30 opacity-60' : snapshot.isDraggingOver ? 'border-white/10 bg-[#111]' : 'border-white/5'}`}
                        >
                          {block && (
                            <div className="pointer-events-none rounded-xl border border-red-500/20 bg-black/80 px-3 py-1.5 text-center text-[11px] text-red-300">
                              {t.tasks.dropNotAllowed} · {block}
                            </div>
                          )}
                          {cellTasks.map((task, index) => (
                            <TaskCard
                              key={task.id}
                              task={task}
                              index={index}
                              onClick={() => onTaskClick(task)}
                              membersMap={membersMap}
                              columns={columns}
                              onMove={onMove}
                            />
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
