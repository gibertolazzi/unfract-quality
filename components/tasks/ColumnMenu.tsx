'use client';

import React, { useState } from 'react';
import { MoreHorizontal, Pencil, ShieldCheck, GitBranch, Trash2, Check, PlusCircle } from 'lucide-react';
import { FloatingMenu, MenuItem, MenuLabel } from '@/components/tasks/FloatingMenu';
import { StatusDot } from '@/components/tasks/StatusPicker';
import { CATEGORY_COLORS, COLUMN_COLORS } from '@/lib/statusColors';
import { useTranslation } from '@/contexts/TranslationContext';
import { COLUMN_CATEGORIES, columnCategory, type ColumnCategory, type WorkflowColumn } from '@/lib/taskWorkflow';

/**
 * Menu ⋯ sull'intestazione di una colonna, come in Jira: nuova attività,
 * rinomina, categoria, colore, condizioni, transizioni, elimina. Le voci del
 * flusso solo per gli admin del progetto.
 */
export function ColumnMenu({ column, canEditWorkflow, canAddTask, onNewTask, onRename, onCategory, onColor, onRules, onTransitions, onDelete }: {
  column: WorkflowColumn;
  /** null = il colore della categoria. */
  onColor: (color: string | null) => void;
  canEditWorkflow: boolean;
  canAddTask: boolean;
  onNewTask: () => void;
  onRename: () => void;
  onCategory: (category: ColumnCategory) => void;
  onRules: () => void;
  onTransitions: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const category = columnCategory(column);
  const categoryLabel: Record<ColumnCategory, string> = {
    todo: t.tasks.categoryTodo,
    progress: t.tasks.categoryProgress,
    done: t.tasks.categoryDone,
  };
  const pick = (action: () => void) => () => { setAnchor(null); action(); };

  if (!canEditWorkflow && !canAddTask) return null;

  return (
    <>
      <button
        type="button"
        onClick={e => setAnchor(anchor ? null : e.currentTarget)}
        aria-label={t.tasks.columnActions}
        aria-haspopup="menu"
        aria-expanded={!!anchor}
        className="rounded-md p-1 text-[#858585] transition-colors hover:bg-white/10 hover:text-white"
      >
        <MoreHorizontal size={18} />
      </button>
      {anchor && (
        <FloatingMenu anchor={anchor} onClose={() => setAnchor(null)} width={230}>
          {canAddTask && (
            <MenuItem onClick={pick(onNewTask)}><PlusCircle size={14} />{t.tasks.newTask}</MenuItem>
          )}
          {canEditWorkflow && (
            <>
              <MenuItem onClick={pick(onRename)}><Pencil size={14} />{t.tasks.renameColumn}</MenuItem>
              <MenuLabel>{t.tasks.columnCategory}</MenuLabel>
              {COLUMN_CATEGORIES.map(c => (
                <MenuItem key={c} onClick={pick(() => onCategory(c))}>
                  <StatusDot color={CATEGORY_COLORS[c]} />
                  <span className="flex-1">{categoryLabel[c]}</span>
                  {c === category && <Check size={13} className="text-[#4D9BFF]" />}
                </MenuItem>
              ))}
              <MenuLabel>{t.tasks.columnColor}</MenuLabel>
              <div className="flex flex-wrap gap-1.5 px-2.5 pb-2 pt-0.5">
                <button
                  type="button"
                  onClick={pick(() => onColor(null))}
                  title={t.tasks.columnColorAuto}
                  aria-label={t.tasks.columnColorAuto}
                  aria-pressed={!column.color}
                  className={`flex h-6 items-center gap-1 rounded-full border px-2 text-[10px] text-white/80 ${!column.color ? 'border-white/60' : 'border-white/10 hover:border-white/30'}`}
                >
                  <StatusDot color={CATEGORY_COLORS[category]} className="h-2 w-2" />
                  {t.tasks.columnColorAuto}
                </button>
                {Object.entries(COLUMN_COLORS).map(([key, hex]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={pick(() => onColor(key))}
                    aria-label={(t.tasks.colorNames as Record<string, string>)[key] || key}
                    title={(t.tasks.colorNames as Record<string, string>)[key] || key}
                    aria-pressed={column.color === key}
                    className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 ${column.color === key ? 'border-white' : 'border-transparent'}`}
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </div>
              <div className="my-1 border-t border-white/5" />
              <MenuItem onClick={pick(onRules)}><ShieldCheck size={14} />{t.tasks.rulesButton}</MenuItem>
              <MenuItem onClick={pick(onTransitions)}><GitBranch size={14} />{t.tasks.tabTransitions}</MenuItem>
              <div className="my-1 border-t border-white/5" />
              <MenuItem danger onClick={pick(onDelete)}><Trash2 size={14} />{t.tasks.deleteColumn}</MenuItem>
            </>
          )}
        </FloatingMenu>
      )}
    </>
  );
}
