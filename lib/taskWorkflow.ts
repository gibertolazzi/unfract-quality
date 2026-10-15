/**
 * Flusso di lavoro delle attività: le colonne della bacheca e la loro
 * categoria (Da fare, In corso, Completato), come gli «status category» di
 * Jira.
 *
 * Prima lo stato di un'attività si indovinava dal nome della colonna, e in
 * modo diverso da schermata a schermata: la Panoramica cercava «done»,
 * «fatto» o «completato» dentro il nome, bacheca, lista e timeline volevano
 * esattamente «done». Rinominare una colonna cambiava lo stato delle sue
 * attività; eliminarla le faceva sparire dalla bacheca e contare come «da
 * fare» in Panoramica.
 *
 * Ora ogni colonna ha una `category`. Le colonne create prima non ce l'hanno:
 * la si ricava dal nome, come prima, finché qualcuno non la sceglie in
 * «Gestisci flusso di lavoro».
 *
 * Come le transizioni di Jira, una colonna può anche dire verso quali colonne
 * non si passa (`blockedTargets`: così una colonna nuova è raggiungibile da
 * subito) e cosa serve per entrarci (`entryRules`). Le controlla l'app, non
 * le regole di Firestore, come il resto dei permessi per modulo.
 */

export type ColumnCategory = 'todo' | 'progress' | 'done';
export const COLUMN_CATEGORIES: ColumnCategory[] = ['todo', 'progress', 'done'];

/** Cosa serve per entrare in una colonna. */
export interface EntryRules {
  /** L'attività deve avere un assegnatario. */
  assignee?: boolean;
  /** L'attività deve avere una scadenza. */
  dueDate?: boolean;
  /** Ce la sposta solo il suo assegnatario (o un admin). */
  assigneeOnly?: boolean;
  /** Ce la sposta solo un admin del progetto. */
  adminOnly?: boolean;
}
export const ENTRY_RULES: (keyof EntryRules)[] = ['assignee', 'dueDate', 'assigneeOnly', 'adminOnly'];

export interface WorkflowColumn {
  id: string;
  title?: string;
  order?: number;
  category?: string;
  /** Colonne in cui non si passa da questa. */
  blockedTargets?: string[];
  entryRules?: EntryRules;
}

interface WorkflowTask {
  columnId?: string | null;
}

interface RuleTask extends WorkflowTask {
  assigneeUid?: string | null;
  date?: unknown;
}

/** Chi sposta: per «solo admin» e «solo l'assegnatario». */
export interface MoveContext {
  uid?: string | null;
  isAdmin: boolean;
}

export type MoveBlock = 'transition' | keyof EntryRules;

function isCategory(value: unknown): value is ColumnCategory {
  return value === 'todo' || value === 'progress' || value === 'done';
}

/** Categoria dal nome, per le colonne create prima delle categorie. */
export function categoryFromTitle(title: string | undefined): ColumnCategory {
  const name = (title || '').trim().toLowerCase();
  if (name.includes('done') || name.includes('fatto') || name.includes('complet')) return 'done';
  if (name.includes('progress') || name.includes('lavorazione') || name.includes('doing') || name.includes('corso')) return 'progress';
  return 'todo';
}

export function columnCategory(column: WorkflowColumn | undefined): ColumnCategory {
  if (!column) return 'todo';
  return isCategory(column.category) ? column.category : categoryFromTitle(column.title);
}

export function sortColumns<C extends WorkflowColumn>(columns: C[]): C[] {
  return [...columns].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/**
 * La colonna in cui mostrare un'attività: la sua, oppure (se la colonna non
 * esiste più) la prima colonna «Da fare», così non sparisce dalla bacheca.
 */
export function displayColumnId(task: WorkflowTask, columns: WorkflowColumn[]): string | undefined {
  if (task.columnId && columns.some(c => c.id === task.columnId)) return task.columnId;
  return firstColumnOf(columns, 'todo')?.id ?? sortColumns(columns)[0]?.id;
}

/** Lo stato di un'attività: la categoria della sua colonna. */
export function taskStatus(task: WorkflowTask, columns: WorkflowColumn[]): ColumnCategory {
  return columnCategory(columns.find(c => c.id === task.columnId));
}

export function firstColumnOf<C extends WorkflowColumn>(columns: C[], category: ColumnCategory): C | undefined {
  return sortColumns(columns).find(c => columnCategory(c) === category);
}

/**
 * Dove va un'attività quando la si spunta: in «Completato», o di nuovo in
 * «Da fare». Fra le colonne della categoria, la prima raggiungibile.
 */
export function toggleDoneTarget(task: WorkflowTask, columns: WorkflowColumn[]): { columnId: string; done: boolean } | null {
  const done = taskStatus(task, columns) === 'done';
  const sorted = sortColumns(columns);
  const candidates = done
    ? [...sorted.filter(c => columnCategory(c) === 'todo'), ...sorted.filter(c => columnCategory(c) === 'progress')]
    : sorted.filter(c => columnCategory(c) === 'done');
  const target = candidates.find(c => canTransition(columns, task.columnId, c.id)) ?? candidates[0];
  if (!target || target.id === task.columnId) return null;
  return { columnId: target.id, done: !done };
}

/** Se da una colonna si può passare a un'altra. Un'attività senza colonna valida va ovunque. */
export function canTransition(columns: WorkflowColumn[], fromId: string | null | undefined, toId: string): boolean {
  if (!fromId || fromId === toId) return true;
  const from = columns.find(c => c.id === fromId);
  return !from || !(from.blockedTargets || []).includes(toId);
}

/** Le colonne in cui si può passare da questa, in ordine. */
export function allowedTargets<C extends WorkflowColumn>(columns: C[], fromId: string | null | undefined): C[] {
  return sortColumns(columns).filter(c => c.id !== fromId && canTransition(columns, fromId, c.id));
}

function hasValue(value: unknown): boolean {
  return value !== null && value !== undefined && !(typeof value === 'string' && value.trim() === '');
}

/** Cosa manca per entrare in una colonna (anche per un'attività nuova). */
export function entryBlock(task: RuleTask, column: WorkflowColumn | undefined, context: MoveContext): keyof EntryRules | null {
  const rules = column?.entryRules || {};
  if (rules.adminOnly && !context.isAdmin) return 'adminOnly';
  if (rules.assigneeOnly && !context.isAdmin && (!context.uid || task.assigneeUid !== context.uid)) return 'assigneeOnly';
  if (rules.assignee && !hasValue(task.assigneeUid)) return 'assignee';
  if (rules.dueDate && !hasValue(task.date)) return 'dueDate';
  return null;
}

/**
 * Perché un'attività non può passare in una colonna, o null se può.
 * `task` è com'è adesso (o come sta per essere salvata, dal dettaglio).
 */
export function moveBlock(task: RuleTask, toId: string, columns: WorkflowColumn[], context: MoveContext): MoveBlock | null {
  if (task.columnId === toId) return null;
  if (!canTransition(columns, task.columnId, toId)) return 'transition';
  return entryBlock(task, columns.find(c => c.id === toId), context);
}

/**
 * Se una colonna si può eliminare: non l'ultima «Da fare» né l'ultima
 * «Completato», altrimenti non si potrebbe più aprire o chiudere
 * un'attività.
 */
export function deleteColumnBlock(columns: WorkflowColumn[], columnId: string): 'last-todo' | 'last-done' | null {
  const column = columns.find(c => c.id === columnId);
  if (!column) return null;
  const category = columnCategory(column);
  if (category === 'progress') return null;
  const others = columns.filter(c => c.id !== columnId && columnCategory(c) === category);
  if (others.length > 0) return null;
  return category === 'todo' ? 'last-todo' : 'last-done';
}

/** Le colonne dove spostare le attività di quella che si elimina: prima quelle della stessa categoria. */
export function moveTargets<C extends WorkflowColumn>(columns: C[], columnId: string): C[] {
  const column = columns.find(c => c.id === columnId);
  const category = columnCategory(column);
  const rest = sortColumns(columns.filter(c => c.id !== columnId));
  return [...rest.filter(c => columnCategory(c) === category), ...rest.filter(c => columnCategory(c) !== category)];
}
