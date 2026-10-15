'use client';

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { FloatingMenu, MenuItem, MenuLabel } from '@/components/tasks/FloatingMenu';
import { useTranslation } from '@/contexts/TranslationContext';
import { useWorkflowGuard } from '@/hooks/useWorkflowGuard';
import { canTransition, displayColumnId, sortColumns, type WorkflowColumn } from '@/lib/taskWorkflow';
import { badgeStyle, columnColor } from '@/lib/statusColors';

/**
 * Lo stato di un'attività come badge del colore della colonna
 * (lib/statusColors.ts), con il menu
 * «Sposta in» come in Jira: solo le colonne raggiungibili; quelle dove manca
 * una condizione si vedono spente con il motivo.
 */

/** Pallino del colore di uno stato. */
export function StatusDot({ color, className = 'h-2 w-2' }: { color: string; className?: string }) {
  return <span className={`shrink-0 rounded-full ${className}`} style={{ backgroundColor: color }} />;
}

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
  const color = columnColor(current);
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
        style={badgeStyle(color)}
        className={`flex max-w-[180px] shrink-0 items-center gap-1.5 rounded-full border font-medium transition-[filter] hover:brightness-125 disabled:cursor-default disabled:hover:brightness-100 ${compact ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-[11px]'}`}
      >
        <StatusDot color={color} className="h-1.5 w-1.5" />
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
                <StatusDot color={columnColor(column)} />
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
