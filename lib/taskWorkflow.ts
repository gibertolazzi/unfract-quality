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
 */

export type ColumnCategory = 'todo' | 'progress' | 'done';
export const COLUMN_CATEGORIES: ColumnCategory[] = ['todo', 'progress', 'done'];

export interface WorkflowColumn {
  id: string;
  title?: string;
  order?: number;
  category?: string;
}

interface WorkflowTask {
  columnId?: string | null;
}

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

/** Dove va un'attività quando la si spunta: in «Completato», o di nuovo in «Da fare». */
export function toggleDoneTarget(task: WorkflowTask, columns: WorkflowColumn[]): { columnId: string; done: boolean } | null {
  const done = taskStatus(task, columns) === 'done';
  const target = done
    ? firstColumnOf(columns, 'todo') ?? sortColumns(columns).find(c => columnCategory(c) !== 'done')
    : firstColumnOf(columns, 'done');
  if (!target || target.id === task.columnId) return null;
  return { columnId: target.id, done: !done };
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
