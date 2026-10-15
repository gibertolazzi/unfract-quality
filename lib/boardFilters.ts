/**
 * Filtri rapidi e corsie (swimlanes) della bacheca, come in Jira.
 *
 * I filtri valgono per bacheca, elenco e cronologia. Le corsie dividono la
 * bacheca per assegnatario, epic o priorità; trascinare un'attività in
 * un'altra corsia cambia quel campo (come in Jira).
 */

export interface BoardFilters {
  mine: boolean;
  /** uid, oppure UNASSIGNED; '' = tutti. */
  assignee: string;
  priority: string;
  /** id dell'epic, oppure NO_EPIC; '' = tutte. */
  epic: string;
  search: string;
}

export type LaneMode = 'none' | 'assignee' | 'epic' | 'priority';

export const EMPTY_FILTERS: BoardFilters = { mine: false, assignee: '', priority: '', epic: '', search: '' };
export const UNASSIGNED = '__none__';
export const NO_EPIC = '__none__';
export const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];

interface FilterTask {
  title?: string;
  description?: string;
  assigneeUid?: string | null;
  priority?: string;
  epicId?: string | null;
}

export function hasActiveFilters(filters: BoardFilters): boolean {
  return filters.mine || !!filters.assignee || !!filters.priority || !!filters.epic || !!filters.search.trim();
}

export function filterTasks<T extends FilterTask>(tasks: T[], filters: BoardFilters, uid: string | null | undefined): T[] {
  const search = filters.search.trim().toLowerCase();
  return tasks.filter(task => {
    if (filters.mine && (!uid || task.assigneeUid !== uid)) return false;
    if (filters.assignee) {
      const assignee = task.assigneeUid || UNASSIGNED;
      if (assignee !== filters.assignee) return false;
    }
    if (filters.priority && (task.priority || 'Medium') !== filters.priority) return false;
    if (filters.epic && (task.epicId || NO_EPIC) !== filters.epic) return false;
    if (search && !`${task.title || ''} ${task.description || ''}`.toLowerCase().includes(search)) return false;
    return true;
  });
}

/** La corsia di un'attività. */
export function laneKey(task: FilterTask, mode: LaneMode): string {
  if (mode === 'assignee') return task.assigneeUid || UNASSIGNED;
  if (mode === 'epic') return task.epicId || NO_EPIC;
  if (mode === 'priority') return PRIORITIES.includes(task.priority || '') ? task.priority! : 'Medium';
  return '';
}

/**
 * Le corsie, in ordine: per assegnatario prima le mie, poi per nome, i non
 * assegnati in fondo; per epic nell'ordine delle epic, senza epic in fondo;
 * per priorità dalla più alta. Solo le corsie con attività, più la mia.
 */
export function buildLanes<T extends FilterTask>(
  tasks: T[],
  mode: LaneMode,
  options: { uid?: string | null; nameOf: (uid: string) => string; epics: { id: string }[] },
): { key: string; tasks: T[] }[] {
  if (mode === 'none') return [{ key: '', tasks }];
  const groups = new Map<string, T[]>();
  tasks.forEach(task => {
    const key = laneKey(task, mode);
    groups.set(key, [...(groups.get(key) || []), task]);
  });

  let keys: string[];
  if (mode === 'priority') {
    keys = PRIORITIES.filter(p => groups.has(p));
  } else if (mode === 'epic') {
    keys = [...options.epics.map(e => e.id).filter(id => groups.has(id)), ...[...groups.keys()].filter(k => k !== NO_EPIC && !options.epics.some(e => e.id === k))];
    if (groups.has(NO_EPIC)) keys.push(NO_EPIC);
  } else {
    const people = [...groups.keys()].filter(k => k !== UNASSIGNED && k !== options.uid)
      .sort((a, b) => options.nameOf(a).localeCompare(options.nameOf(b)));
    keys = [...(options.uid ? [options.uid] : []), ...people];
    if (groups.has(UNASSIGNED)) keys.push(UNASSIGNED);
  }
  return keys.map(key => ({ key, tasks: groups.get(key) || [] }));
}

/** Cosa cambia nell'attività spostata in un'altra corsia. */
export function laneUpdate(mode: LaneMode, key: string, nameOf: (uid: string) => string | null): Record<string, string | null> {
  if (mode === 'assignee') {
    return key === UNASSIGNED ? { assigneeUid: null, assignee: null } : { assigneeUid: key, assignee: nameOf(key) };
  }
  if (mode === 'epic') return { epicId: key === NO_EPIC ? null : key };
  if (mode === 'priority') return { priority: key };
  return {};
}

const SEPARATOR = '::';

/** ID di una cella corsia × colonna, per il drag and drop. */
export function cellId(lane: string, columnId: string): string {
  return `${lane}${SEPARATOR}${columnId}`;
}

export function parseCellId(id: string): { lane: string | null; columnId: string } {
  const at = id.lastIndexOf(SEPARATOR);
  return at < 0 ? { lane: null, columnId: id } : { lane: id.slice(0, at), columnId: id.slice(at + SEPARATOR.length) };
}
