/**
 * Modelli di flusso di lavoro pronti, da applicare a una bacheca
 * («Gestisci flusso di lavoro» → Modelli).
 *
 * Applicare un modello non cancella attività: le colonne esistenti si
 * riusano per categoria, nell'ordine (la prima «Da fare» diventa la prima
 * «Da fare» del modello, e così via), e quelle che avanzano si eliminano
 * spostando le attività nella prima colonna del modello con la stessa
 * categoria.
 */

import {
  columnCategory, sortColumns,
  type ColumnCategory, type EntryRules, type WorkflowColumn,
} from '@/lib/taskWorkflow';

type Locale = 'it' | 'en';

export interface TemplateColumn {
  key: string;
  title: Record<Locale, string>;
  category: ColumnCategory;
  /** Dove si può andare da qui; assente = ovunque. */
  to?: string[];
  rules?: EntryRules;
}

export interface WorkflowTemplate {
  id: 'kanban' | 'software' | 'content' | 'approval';
  columns: TemplateColumn[];
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'kanban',
    columns: [
      { key: 'todo', title: { it: 'Da fare', en: 'To Do' }, category: 'todo' },
      { key: 'doing', title: { it: 'In corso', en: 'In Progress' }, category: 'progress' },
      { key: 'done', title: { it: 'Completato', en: 'Done' }, category: 'done' },
    ],
  },
  {
    id: 'software',
    columns: [
      { key: 'backlog', title: { it: 'Backlog', en: 'Backlog' }, category: 'todo', to: ['todo'] },
      { key: 'todo', title: { it: 'Da fare', en: 'To Do' }, category: 'todo', to: ['backlog', 'doing'] },
      { key: 'doing', title: { it: 'In corso', en: 'In Progress' }, category: 'progress', to: ['todo', 'review'], rules: { assignee: true } },
      { key: 'review', title: { it: 'In revisione', en: 'In Review' }, category: 'progress', to: ['doing', 'test'], rules: { assignee: true } },
      { key: 'test', title: { it: 'Test', en: 'Testing' }, category: 'progress', to: ['doing', 'done'] },
      { key: 'done', title: { it: 'Completato', en: 'Done' }, category: 'done', to: ['doing'], rules: { assignee: true } },
    ],
  },
  {
    id: 'content',
    columns: [
      { key: 'ideas', title: { it: 'Idee', en: 'Ideas' }, category: 'todo', to: ['draft'] },
      { key: 'draft', title: { it: 'Bozza', en: 'Draft' }, category: 'progress', to: ['ideas', 'review'], rules: { assignee: true } },
      { key: 'review', title: { it: 'Revisione', en: 'Review' }, category: 'progress', to: ['draft', 'approved'] },
      { key: 'approved', title: { it: 'Approvato', en: 'Approved' }, category: 'progress', to: ['review', 'published'], rules: { adminOnly: true } },
      { key: 'published', title: { it: 'Pubblicato', en: 'Published' }, category: 'done', to: ['approved'], rules: { dueDate: true } },
    ],
  },
  {
    id: 'approval',
    columns: [
      { key: 'request', title: { it: 'Richiesta', en: 'Request' }, category: 'todo', to: ['evaluation'] },
      { key: 'evaluation', title: { it: 'In valutazione', en: 'Under review' }, category: 'progress', to: ['request', 'approved', 'rejected'] },
      { key: 'approved', title: { it: 'Approvata', en: 'Approved' }, category: 'done', to: ['evaluation'], rules: { adminOnly: true } },
      { key: 'rejected', title: { it: 'Respinta', en: 'Rejected' }, category: 'done', to: ['evaluation'], rules: { adminOnly: true } },
    ],
  },
];

export interface ColumnWrite {
  id: string;
  isNew: boolean;
  data: { title: string; category: ColumnCategory; order: number; blockedTargets: string[]; entryRules: EntryRules };
}

export interface ColumnRemoval {
  id: string;
  title: string;
  moveTo: string;
  taskIds: string[];
  startOrder: number;
}

export interface TemplatePlan {
  writes: ColumnWrite[];
  removals: ColumnRemoval[];
}

/**
 * Cosa cambia applicando un modello. `newId` dà l'ID di una colonna nuova
 * (serve prima di scriverla, per le transizioni).
 */
export function planTemplate(
  template: WorkflowTemplate,
  columns: (WorkflowColumn & { title?: string })[],
  tasks: { id: string; columnId?: string | null; order?: number }[],
  locale: string,
  newId: () => string,
): TemplatePlan {
  const lang: Locale = locale === 'en' ? 'en' : 'it';
  const free: Record<ColumnCategory, WorkflowColumn[]> = { todo: [], progress: [], done: [] };
  sortColumns(columns).forEach(c => free[columnCategory(c)].push(c));

  const ids: Record<string, string> = {};
  const reused = new Set<string>();
  template.columns.forEach(tc => {
    const existing = free[tc.category].shift();
    if (existing) reused.add(existing.id);
    ids[tc.key] = existing?.id ?? newId();
  });

  const writes: ColumnWrite[] = template.columns.map((tc, order) => ({
    id: ids[tc.key],
    isNew: !reused.has(ids[tc.key]),
    data: {
      title: tc.title[lang],
      category: tc.category,
      order,
      blockedTargets: tc.to
        ? template.columns.filter(o => o.key !== tc.key && !tc.to!.includes(o.key)).map(o => ids[o.key])
        : [],
      entryRules: tc.rules || {},
    },
  }));

  const firstOf = (category: ColumnCategory) =>
    template.columns.find(tc => tc.category === category) ?? template.columns.find(tc => tc.category === 'todo') ?? template.columns[0];
  const count: Record<string, number> = {};
  tasks.forEach(task => { if (task.columnId) count[task.columnId] = (count[task.columnId] || 0) + 1; });

  const removals: ColumnRemoval[] = sortColumns(columns)
    .filter(c => !reused.has(c.id))
    .map(c => {
      const moveTo = ids[firstOf(columnCategory(c)).key];
      const taskIds = tasks.filter(task => task.columnId === c.id).map(task => task.id);
      const startOrder = count[moveTo] || 0;
      count[moveTo] = startOrder + taskIds.length;
      return { id: c.id, title: c.title || '', moveTo, taskIds, startOrder };
    });

  return { writes, removals };
}

/** Scritture in un'unica operazione: Firestore ne accetta al massimo 500. */
export function planWriteCount(plan: TemplatePlan): number {
  return plan.writes.length + plan.removals.reduce((n, r) => n + r.taskIds.length + 1, 0);
}
