'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowUp, ArrowDown, Trash2, Plus, Loader2 } from 'lucide-react';
import { ColumnService } from '@/lib/services/taskService';
import { useTranslation } from '@/contexts/TranslationContext';
import { useToast } from '@/contexts/ToastContext';
import { formatMessage } from '@/lib/i18n/formatMessage';
import {
  COLUMN_CATEGORIES, columnCategory, deleteColumnBlock, displayColumnId, moveTargets, sortColumns,
  type ColumnCategory, type WorkflowColumn,
} from '@/lib/taskWorkflow';

/**
 * «Gestisci flusso di lavoro»: colonne della bacheca, ordine e categoria
 * (lib/taskWorkflow.ts). Una colonna con attività si elimina solo scegliendo
 * dove spostarle; l'ultima «Da fare» e l'ultima «Completato» restano.
 */

interface WorkflowModalProps {
  projectId: string;
  columns: (WorkflowColumn & { title: string })[];
  tasks: { id: string; columnId?: string | null }[];
  /** Apre subito l'eliminazione di questa colonna (cestino sulla bacheca). */
  initialDeleteId?: string | null;
  onClose: () => void;
}

const DOT: Record<ColumnCategory, string> = {
  todo: 'bg-[#858585]',
  progress: 'bg-[#FFB800]',
  done: 'bg-[#10B981]',
};

export function WorkflowModal({ projectId, columns, tasks, initialDeleteId, onClose }: WorkflowModalProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const sorted = sortColumns(columns);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [deleting, setDeleting] = useState<string | null>(initialDeleteId || null);
  const [moveTo, setMoveTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [blockedChange, setBlockedChange] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<ColumnCategory>('todo');

  const categoryLabel: Record<ColumnCategory, string> = {
    todo: t.tasks.categoryTodo,
    progress: t.tasks.categoryProgress,
    done: t.tasks.categoryDone,
  };
  const blockMessage = (block: 'last-todo' | 'last-done') =>
    block === 'last-todo' ? t.tasks.deleteColumnLastTodo : t.tasks.deleteColumnLastDone;
  // Le attività senza una colonna valida compaiono nella prima «Da fare».
  const tasksIn = (columnId: string) => tasks.filter(task => displayColumnId(task, columns) === columnId);

  const run = async (write: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await write();
      return true;
    } catch (error) {
      console.error('Workflow change failed:', error);
      toast.error(t.tasks.workflowSaveError);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const saveTitle = async (column: WorkflowColumn & { title: string }) => {
    const title = (titles[column.id] ?? column.title).trim();
    if (!title || title === column.title) {
      setTitles(prev => ({ ...prev, [column.id]: column.title }));
      return;
    }
    // Con il nome si fissa la categoria: una colonna vecchia la ricavava dal nome.
    await run(() => ColumnService.update(column.id, { title, category: columnCategory(column) }));
  };

  const changeCategory = async (column: WorkflowColumn, category: ColumnCategory) => {
    const block = deleteColumnBlock(columns, column.id);
    if (block && category !== columnCategory(column)) {
      setBlockedChange(column.id);
      return;
    }
    setBlockedChange(null);
    await run(() => ColumnService.update(column.id, { category }));
  };

  const move = async (index: number, delta: number) => {
    const next = [...sorted];
    const [moved] = next.splice(index, 1);
    next.splice(index + delta, 0, moved);
    await run(() => ColumnService.batchUpdateOrder(next.map((c, order) => ({ id: c.id, order }))));
  };

  const addColumn = async () => {
    const title = newTitle.trim();
    if (!title) return;
    const ok = await run(() => ColumnService.create(projectId, title, sorted.length, newCategory));
    if (ok) {
      setNewTitle('');
      setNewCategory('todo');
    }
  };

  const confirmDelete = async (column: WorkflowColumn & { title: string }) => {
    const inside = tasksIn(column.id);
    const target = moveTo || moveTargets(columns, column.id)[0]?.id || '';
    if (inside.length > 0 && !target) return;
    const startOrder = tasksIn(target).length;
    const ok = await run(() => ColumnService.deleteAndMoveTasks(column.id, target, inside.map(task => task.id), startOrder));
    if (ok) {
      setDeleting(null);
      setMoveTo('');
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0A0A0A] shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/5 bg-white/5 p-5">
          <div>
            <h2 className="text-lg font-semibold text-white/90">{t.tasks.manageWorkflow}</h2>
            <p className="mt-1 text-xs text-[#858585]">{t.tasks.workflowDesc}</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-[#858585] transition-colors hover:bg-white/10 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col gap-2 overflow-y-auto p-5">
          {sorted.map((column, index) => {
            const category = columnCategory(column);
            const inside = tasksIn(column.id);
            const block = deleteColumnBlock(columns, column.id);
            const targets = moveTargets(sorted, column.id);
            return (
              <div key={column.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex items-center gap-2">
                  <div className="flex flex-col">
                    <button
                      onClick={() => move(index, -1)}
                      disabled={busy || index === 0}
                      aria-label={t.tasks.moveUp}
                      className="text-[#858585] hover:text-white disabled:opacity-20"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      onClick={() => move(index, 1)}
                      disabled={busy || index === sorted.length - 1}
                      aria-label={t.tasks.moveDown}
                      className="text-[#858585] hover:text-white disabled:opacity-20"
                    >
                      <ArrowDown size={14} />
                    </button>
                  </div>
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOT[category]}`} />
                  <input
                    value={titles[column.id] ?? column.title}
                    onChange={e => setTitles(prev => ({ ...prev, [column.id]: e.target.value }))}
                    onBlur={() => saveTitle(column)}
                    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                    className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm font-medium text-white outline-none focus:border-white/10"
                  />
                  <span className="hidden shrink-0 text-[11px] text-[#858585] sm:inline">
                    {formatMessage(t.tasks.columnTasks, { count: inside.length })}
                  </span>
                  <select
                    value={category}
                    onChange={e => changeCategory(column, e.target.value as ColumnCategory)}
                    disabled={busy}
                    className="shrink-0 rounded-lg border border-white/10 bg-[#111] px-2 py-1 text-xs text-white outline-none"
                  >
                    {COLUMN_CATEGORIES.map(c => <option key={c} value={c}>{categoryLabel[c]}</option>)}
                  </select>
                  <button
                    onClick={() => { setDeleting(deleting === column.id ? null : column.id); setMoveTo(''); }}
                    disabled={busy}
                    aria-label={t.tasks.deleteColumn}
                    className="shrink-0 p-1 text-[#858585] transition-colors hover:text-red-500"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                {blockedChange === column.id && block && (
                  <p className="mt-2 text-xs text-amber-400">{blockMessage(block)}</p>
                )}

                {deleting === column.id && (
                  <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                    {block ? (
                      <p className="text-xs text-amber-400">{blockMessage(block)}</p>
                    ) : (
                      <>
                        <p className="text-xs text-white/80">
                          {inside.length > 0
                            ? formatMessage(t.tasks.deleteColumnMove, { name: column.title, count: inside.length })
                            : formatMessage(t.tasks.deleteColumnEmpty, { name: column.title })}
                        </p>
                        {inside.length > 0 && (
                          <select
                            value={moveTo || targets[0]?.id || ''}
                            onChange={e => setMoveTo(e.target.value)}
                            className="mt-2 w-full rounded-lg border border-white/10 bg-[#111] px-2 py-1.5 text-xs text-white outline-none"
                          >
                            {targets.map(c => (
                              <option key={c.id} value={c.id}>{c.title} · {categoryLabel[columnCategory(c)]}</option>
                            ))}
                          </select>
                        )}
                        <div className="mt-3 flex justify-end gap-2">
                          <button onClick={() => setDeleting(null)} className="rounded-full px-3 py-1.5 text-xs text-white/60 hover:bg-white/5 hover:text-white">
                            {t.tasks.cancel}
                          </button>
                          <button
                            onClick={() => confirmDelete(column)}
                            disabled={busy}
                            className="flex items-center gap-1 rounded-full bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-50"
                          >
                            {busy && <Loader2 size={12} className="animate-spin" />}
                            {t.tasks.delete}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          <div className="mt-2 flex items-center gap-2 rounded-xl border border-dashed border-white/10 p-3">
            <input
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addColumn(); }}
              placeholder={t.tasks.newColumnTitle}
              className="min-w-0 flex-1 bg-transparent px-2 py-1 text-sm text-white outline-none placeholder:text-[#555]"
            />
            <select
              value={newCategory}
              onChange={e => setNewCategory(e.target.value as ColumnCategory)}
              className="shrink-0 rounded-lg border border-white/10 bg-[#111] px-2 py-1 text-xs text-white outline-none"
            >
              {COLUMN_CATEGORIES.map(c => <option key={c} value={c}>{categoryLabel[c]}</option>)}
            </select>
            <button
              onClick={addColumn}
              disabled={busy || !newTitle.trim()}
              aria-label={t.tasks.addColumn}
              className="flex shrink-0 items-center gap-1 rounded-full bg-[#006AFF] px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-600 disabled:opacity-50"
            >
              <Plus size={14} />
              {t.tasks.addColumn}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
