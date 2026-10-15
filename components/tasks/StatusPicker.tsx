'use client';

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { FloatingMenu, MenuItem, MenuLabel } from '@/components/tasks/FloatingMenu';
import { useTranslation } from '@/contexts/TranslationContext';
import { useWorkflowGuard } from '@/hooks/useWorkflowGuard';
import { canTransition, columnCategory, displayColumnId, sortColumns, type ColumnCategory, type WorkflowColumn } from '@/lib/taskWorkflow';

/**
 * Lo stato di un'attività come badge colorato per categoria, con il menu
 * «Sposta in» come in Jira: solo le colonne raggiungibili; quelle dove manca
 * una condizione si vedono spente con il motivo.
 */

export const STATUS_STYLE: Record<ColumnCategory, { badge: string; dot: string }> = {
  todo: { badge: 'border-white/15 bg-white/5 text-white/80 hover:bg-white/10', dot: 'bg-[#858585]' },
  progress: { badge: 'border-[#FFB800]/40 bg-[#FFB800]/10 text-[#FFCC4D] hover:bg-[#FFB800]/20', dot: 'bg-[#FFB800]' },
  done: { badge: 'border-[#10B981]/40 bg-[#10B981]/10 text-[#34D399] hover:bg-[#10B981]/20', dot: 'bg-[#10B981]' },
};

type PickerTask = { columnId?: string | null; assigneeUid?: string | null; date?: unknown };

export function StatusPicker({ task, columns, value, onMove, disabled, compact }: {
  /** L'attività com'è salvata (le transizioni partono dalla sua colonna). */
  task: PickerTask;
  columns: (WorkflowColumn & { title: string })[];
  /** La colonna mostrata, se diversa da quella salvata (dettaglio non ancora salvato). */
  value?: string;
  onMove: (columnId: string) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const guard = useWorkflowGuard(columns);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const currentId = value ?? displayColumnId(task, columns);
  const current = columns.find(c => c.id === currentId);
  const style = STATUS_STYLE[columnCategory(current)];
  const options = sortColumns(columns).filter(c => c.id !== currentId && (c.id === task.columnId || canTransition(columns, task.columnId, c.id)));

  return (
    <>
      <button
        type="button"
        onClick={e => { e.stopPropagation(); if (!disabled) setAnchor(anchor ? null : e.currentTarget); }}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={!!anchor}
        title={t.tasks.moveTo}
        className={`flex max-w-[180px] shrink-0 items-center gap-1.5 rounded-full border font-medium transition-colors disabled:cursor-default ${compact ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-[11px]'} ${style.badge}`}
      >
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${style.dot}`} />
        <span className="truncate">{current?.title || t.tasks.unknown}</span>
        {!disabled && <ChevronDown size={12} className="shrink-0" />}
      </button>
      {anchor && (
        <FloatingMenu anchor={anchor} onClose={() => setAnchor(null)}>
          <MenuLabel>{t.tasks.moveTo}</MenuLabel>
          {options.length === 0 && <p className="px-2.5 py-1.5 text-xs text-[#858585]">{t.tasks.noTransitions}</p>}
          {options.map(column => {
            const block = guard.blockOf(task, column.id);
            const reason = block ? guard.message(block, task, column.id) : undefined;
            return (
              <MenuItem
                key={column.id}
                disabled={!!block}
                title={reason}
                onClick={() => { setAnchor(null); onMove(column.id); }}
              >
                <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_STYLE[columnCategory(column)].dot}`} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{column.title}</span>
                  {reason && <span className="block text-[10px] leading-tight text-amber-400/90">{reason}</span>}
                </span>
              </MenuItem>
            );
          })}
        </FloatingMenu>
      )}
    </>
  );
}
