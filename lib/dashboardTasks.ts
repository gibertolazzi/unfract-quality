/**
 * «Le mie Task» nella Panoramica: le task dell'utente, prima quelle da fare.
 *
 * Prima la lista prendeva le prime 6 task del progetto nell'ordine in cui
 * arrivavano dal database, comprese quelle fatte: segnandone qualcuna come
 * fatta, quelle che mancavano potevano restare fuori. In più contava come
 * "mie" tutte le task senza il vecchio campo `assignee`, cioè anche quelle
 * assegnate ad altri con `assigneeUid`.
 */

export type TaskStatus = 'todo' | 'progress' | 'done';

interface ColumnLike {
  id: string;
  title?: string;
}

interface TaskLike {
  id: string;
  columnId?: string;
  assigneeUid?: string;
  assignee?: string;
  priority?: string;
  order?: number;
}

interface UserLike {
  uid: string;
  displayName?: string | null;
}

/** Lo stato dipende dal nome della colonna in cui si trova la task. */
export function taskStatus(task: Pick<TaskLike, 'columnId'>, columns: ColumnLike[]): TaskStatus {
  const title = columns.find(c => c.id === task.columnId)?.title?.toLowerCase() || '';
  if (title.includes('done') || title.includes('fatto') || title.includes('completato')) return 'done';
  if (title.includes('progress') || title.includes('lavorazione') || title.includes('doing')) return 'progress';
  return 'todo';
}

/** Assegnata all'utente: per ID, oppure (task vecchie, senza ID) per nome. */
export function isMine(task: TaskLike, user: UserLike): boolean {
  if (task.assigneeUid) return task.assigneeUid === user.uid;
  return !!task.assignee && !!user.displayName && task.assignee === user.displayName;
}

const PRIORITY_RANK: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };
const rank = (task: TaskLike) => PRIORITY_RANK[task.priority || 'Medium'] ?? 2;

/**
 * Le task da mostrare: prima quelle da fare (per priorità, poi nell'ordine
 * della bacheca), poi quelle fatte, solo se avanza posto. Così una task
 * segnata come fatta lascia il posto alla prossima da fare.
 */
export function myDashboardTasks<T extends TaskLike>(tasks: T[], columns: ColumnLike[], user: UserLike, limit = 6) {
  const mine = tasks.filter(task => isMine(task, user));
  const byPriority = (a: T, b: T) => rank(a) - rank(b) || (a.order ?? 0) - (b.order ?? 0);
  const pending = mine.filter(task => taskStatus(task, columns) !== 'done').sort(byPriority);
  const done = mine.filter(task => taskStatus(task, columns) === 'done');
  return { visible: [...pending, ...done].slice(0, limit), pendingCount: pending.length };
}
