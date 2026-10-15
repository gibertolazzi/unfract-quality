'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowUp, ArrowDown, Trash2, Plus, Loader2, ShieldCheck } from 'lucide-react';
import { ColumnService } from '@/lib/services/taskService';
import { WorkflowDiagram } from '@/components/tasks/WorkflowDiagram';
import { planTemplate, planWriteCount, WORKFLOW_TEMPLATES, type TemplatePlan, type WorkflowTemplate } from '@/lib/workflowTemplates';
import { useTranslation } from '@/contexts/TranslationContext';
import { useToast } from '@/contexts/ToastContext';
import { formatMessage } from '@/lib/i18n/formatMessage';
import {
  allowedTargets, canTransition, COLUMN_CATEGORIES, columnCategory, deleteColumnBlock, displayColumnId, ENTRY_RULES, moveTargets, sortColumns,
  type ColumnCategory, type EntryRules, type WorkflowColumn,
} from '@/lib/taskWorkflow';

/**
 * «Gestisci flusso di lavoro» (lib/taskWorkflow.ts), in tre schede:
 * - Colonne: ordine, categoria, condizioni per entrare. Una colonna con
 *   attività si elimina solo scegliendo dove spostarle; l'ultima «Da fare» e
 *   l'ultima «Completato» restano.
 * - Transizioni: da quale colonna si va a quale, con lo schema.
 * - Modelli: flussi pronti (lib/workflowTemplates.ts).
 */

export type WorkflowTab = 'columns' | 'transitions' | 'templates';

interface WorkflowModalProps {
  projectId: string;
  columns: (WorkflowColumn & { title: string })[];
  tasks: { id: string; columnId?: string | null }[];
  /** Apre subito l'eliminazione di questa colonna (menu ⋯ sulla bacheca). */
  initialDeleteId?: string | null;
  /** Scheda da aprire, ed eventuale colonna di cui aprire le condizioni. */
  initialTab?: WorkflowTab;
  initialRulesId?: string | null;
  onClose: () => void;
}

const DOT: Record<ColumnCategory, string> = {
  todo: 'bg-[#858585]',
  progress: 'bg-[#FFB800]',
  done: 'bg-[#10B981]',
};

export function WorkflowModal({ projectId, columns, tasks, initialDeleteId, initialTab, initialRulesId, onClose }: WorkflowModalProps) {
  const { t, locale } = useTranslation();
  const [tab, setTab] = useState<WorkflowTab>(initialTab || 'columns');
  const [rulesOpen, setRulesOpen] = useState<string | null>(initialRulesId || null);
  const [template, setTemplate] = useState<{ template: WorkflowTemplate; plan: TemplatePlan } | null>(null);
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
  const ruleLabel: Record<keyof EntryRules, string> = {
    assignee: t.tasks.ruleAssignee,
    dueDate: t.tasks.ruleDueDate,
    assigneeOnly: t.tasks.ruleAssigneeOnly,
    adminOnly: t.tasks.ruleAdminOnly,
  };
  const templateText: Record<WorkflowTemplate['id'], [string, string]> = {
    kanban: [t.tasks.templateKanban, t.tasks.templateKanbanDesc],
    software: [t.tasks.templateSoftware, t.tasks.templateSoftwareDesc],
    content: [t.tasks.templateContent, t.tasks.templateContentDesc],
    approval: [t.tasks.templateApproval, t.tasks.templateApprovalDesc],
  };
  const titleOf = (id: string) => columns.find(c => c.id === id)?.title || '';
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

  const toggleRule = async (column: WorkflowColumn, rule: keyof EntryRules) => {
    const entryRules = { ...(column.entryRules || {}), [rule]: !column.entryRules?.[rule] };
    await run(() => ColumnService.update(column.id, { entryRules }));
  };

  const toggleTransition = async (from: WorkflowColumn, toId: string) => {
    const blocked = from.blockedTargets || [];
    const blockedTargets = blocked.includes(toId) ? blocked.filter(id => id !== toId) : [...blocked, toId];
    await run(() => ColumnService.update(from.id, { blockedTargets }));
  };

  const previewTemplate = (chosen: WorkflowTemplate) => {
    setTemplate({ template: chosen, plan: planTemplate(chosen, columns, tasks, locale, () => ColumnService.newId()) });
  };

  const applyTemplate = async () => {
    if (!template) return;
    if (planWriteCount(template.plan) > 450) {
      toast.error(t.tasks.templateTooMany);
      return;
    }
    const ok = await run(() => ColumnService.applyTemplate(projectId, template.plan));
    if (ok) {
      toast.success(t.tasks.templateApplied);
      // I nomi in modifica sono quelli di prima del modello.
      setTitles({});
      setTemplate(null);
      setTab('columns');
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
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0A0A0A] shadow-2xl"
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

        <div className="flex gap-1 border-b border-white/5 px-5 pt-3">
          {([['columns', t.tasks.tabColumns], ['transitions', t.tasks.tabTransitions], ['templates', t.tasks.tabTemplates]] as [WorkflowTab, string][]).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`rounded-t-lg border-b-2 px-3 py-2 text-xs font-medium transition-colors ${tab === id ? 'border-[#006AFF] text-white' : 'border-transparent text-[#858585] hover:text-white'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'columns' && (
          <div className="flex flex-col gap-2 overflow-y-auto p-5">
            {sorted.map((column, index) => {
              const category = columnCategory(column);
              const inside = tasksIn(column.id);
              const block = deleteColumnBlock(columns, column.id);
              const targets = moveTargets(sorted, column.id);
              const activeRules = ENTRY_RULES.filter(rule => column.entryRules?.[rule]);
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
                      onClick={() => setRulesOpen(rulesOpen === column.id ? null : column.id)}
                      aria-label={t.tasks.rulesButton}
                      title={t.tasks.rulesButton}
                      className={`relative shrink-0 p-1 transition-colors hover:text-white ${activeRules.length ? 'text-[#4D9BFF]' : 'text-[#858585]'}`}
                    >
                      <ShieldCheck size={15} />
                      {activeRules.length > 0 && (
                        <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#006AFF] text-[9px] text-white">{activeRules.length}</span>
                      )}
                    </button>
                    <button
                      onClick={() => { setDeleting(deleting === column.id ? null : column.id); setMoveTo(''); }}
                      disabled={busy}
                      aria-label={t.tasks.deleteColumn}
                      className="shrink-0 p-1 text-[#858585] transition-colors hover:text-red-500"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  {activeRules.length > 0 && rulesOpen !== column.id && (
                    <p className="mt-1 pl-8 text-[11px] text-[#4D9BFF]">
                      {t.tasks.rulesTitle} {activeRules.map(rule => ruleLabel[rule]).join(', ')}
                    </p>
                  )}

                  {rulesOpen === column.id && (
                    <div className="mt-3 rounded-lg border border-white/10 bg-black/40 p-3">
                      <p className="mb-2 text-xs text-white/80">{t.tasks.rulesTitle}</p>
                      <div className="grid gap-1.5 sm:grid-cols-2">
                        {ENTRY_RULES.map(rule => (
                          <label key={rule} className="flex cursor-pointer items-center gap-2 text-xs text-white/80">
                            <input
                              type="checkbox"
                              checked={!!column.entryRules?.[rule]}
                              onChange={() => toggleRule(column, rule)}
                              disabled={busy}
                              className="accent-[#006AFF]"
                            />
                            {ruleLabel[rule]}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

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
        )}

        {tab === 'transitions' && (
          <div className="flex flex-col gap-4 overflow-y-auto p-5">
            <p className="text-xs text-[#858585]">{t.tasks.transitionsDesc}</p>
            <WorkflowDiagram columns={sorted} fromAnyLabel={t.tasks.transitionsFromAny} />
            {sorted.map(from => {
              const exits = allowedTargets(columns, from.id);
              const reachable = sorted.some(other => other.id !== from.id && canTransition(columns, other.id, from.id));
              return (
                <div key={from.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-white">
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOT[columnCategory(from)]}`} />
                      {formatMessage(t.tasks.transitionsFrom, { name: from.title })}
                    </div>
                    {(from.blockedTargets || []).length > 0 && (
                      <button
                        onClick={() => run(() => ColumnService.update(from.id, { blockedTargets: [] }))}
                        disabled={busy}
                        className="shrink-0 rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-white/70 hover:text-white"
                      >
                        {t.tasks.transitionsAll}
                      </button>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {sorted.filter(to => to.id !== from.id).map(to => {
                      const allowed = canTransition(columns, from.id, to.id);
                      return (
                        <button
                          key={to.id}
                          onClick={() => toggleTransition(from, to.id)}
                          disabled={busy}
                          aria-pressed={allowed}
                          className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${allowed ? 'border-[#006AFF]/60 bg-[#006AFF]/15 text-white' : 'border-white/10 text-[#555] line-through'}`}
                        >
                          → {to.title}
                        </button>
                      );
                    })}
                  </div>
                  {exits.length === 0 && <p className="mt-2 text-[11px] text-amber-400">{t.tasks.transitionsDeadEnd}</p>}
                  {!reachable && sorted.length > 1 && <p className="mt-2 text-[11px] text-amber-400">{t.tasks.transitionsUnreachable}</p>}
                </div>
              );
            })}
          </div>
        )}

        {tab === 'templates' && (
          <div className="flex flex-col gap-3 overflow-y-auto p-5">
            <p className="text-xs text-[#858585]">{t.tasks.templatesDesc}</p>
            {WORKFLOW_TEMPLATES.map(item => {
              const [name, desc] = templateText[item.id];
              const open = template?.template.id === item.id;
              return (
                <div key={item.id} className={`rounded-xl border p-4 ${open ? 'border-[#006AFF]/50 bg-[#006AFF]/5' : 'border-white/10 bg-white/[0.03]'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-white">{name}</h3>
                      <p className="mt-0.5 text-xs text-[#858585]">{desc}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-1">
                        {item.columns.map((c, i) => (
                          <React.Fragment key={c.key}>
                            {i > 0 && <span className="text-[10px] text-[#555]">→</span>}
                            <span className="flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-white/80">
                              <span className={`h-1.5 w-1.5 rounded-full ${DOT[c.category]}`} />
                              {c.title[locale === 'en' ? 'en' : 'it']}
                            </span>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                    {!open && (
                      <button
                        onClick={() => previewTemplate(item)}
                        disabled={busy}
                        className="shrink-0 rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/80 hover:border-white/20 hover:text-white"
                      >
                        {t.tasks.templateApply}
                      </button>
                    )}
                  </div>

                  {open && template && (
                    <div className="mt-3 border-t border-white/10 pt-3">
                      <p className="mb-1.5 text-xs text-white/80">{t.tasks.templatePreview}</p>
                      <ul className="flex flex-col gap-1 text-[11px] text-[#A0A0A0]">
                        {template.plan.writes.map(write => (
                          <li key={write.id}>
                            {write.isNew
                              ? formatMessage(t.tasks.templateNew, { name: write.data.title })
                              : titleOf(write.id) === write.data.title
                                ? formatMessage(t.tasks.templateKeep, { name: write.data.title })
                                : formatMessage(t.tasks.templateRename, { from: titleOf(write.id), to: write.data.title })}
                          </li>
                        ))}
                        {template.plan.removals.map(removal => {
                          const to = template.plan.writes.find(w => w.id === removal.moveTo)?.data.title || '';
                          return (
                            <li key={removal.id} className={removal.taskIds.length ? 'text-amber-400' : ''}>
                              {removal.taskIds.length
                                ? formatMessage(t.tasks.templateRemove, { name: removal.title, count: removal.taskIds.length, to })
                                : formatMessage(t.tasks.templateRemoveEmpty, { name: removal.title })}
                            </li>
                          );
                        })}
                      </ul>
                      <div className="mt-3 flex justify-end gap-2">
                        <button onClick={() => setTemplate(null)} className="rounded-full px-3 py-1.5 text-xs text-white/60 hover:bg-white/5 hover:text-white">
                          {t.tasks.cancel}
                        </button>
                        <button
                          onClick={applyTemplate}
                          disabled={busy}
                          className="flex items-center gap-1 rounded-full bg-[#006AFF] px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-600 disabled:opacity-50"
                        >
                          {busy && <Loader2 size={12} className="animate-spin" />}
                          {t.tasks.templateConfirm}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
