import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { CrmFollowup } from '@/types/crm';
import { FollowupState, FollowupType, Priority, FOLLOWUP_TRANSITIONS, canTransition } from '@/components/crm/constants';
import { CrmContextRef, mapBase, createRecord, updateRecord, archiveRecord, deleteRecord, getRecords, getRecordById, subscribeToRecords, subscribeToRecord } from './base';
import { writeAudit } from './audit';
import { toMillis } from './helpers';
import { Page, paginate } from './leadFilters';

const COLLECTION_NAME = 'crm_followups';

export function mapFollowup(id: string, data: any): CrmFollowup {
  return {
    ...mapBase(id, data),
    type: data.type || 'internal',
    title: data.title || 'Follow-up senza titolo',
    notes: data.notes || '',
    assigneeUid: data.assigneeUid || '',
    priority: data.priority || 'MEDIUM',
    dueDate: data.dueDate || '',
    state: data.state || 'OPEN',
    snoozedUntil: data.snoozedUntil || '',
    completedAt: data.completedAt,
    leadId: data.leadId || '',
    contactId: data.contactId || '',
    customerId: data.customerId || '',
    opportunityId: data.opportunityId || '',
    linkedMeetingId: data.linkedMeetingId || '',
    createdFrom: data.createdFrom || 'manual',
    automation: data.automation || undefined,
    dedupeKey: data.dedupeKey || '',
    linkedCalendarEventId: data.linkedCalendarEventId || '',
  };
}

const PRIORITY_WEIGHT: Record<Priority, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

/** Prima i più urgenti per scadenza, poi per priorità. */
function byDueDate(a: CrmFollowup, b: CrmFollowup) {
  if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
  if (a.dueDate && !b.dueDate) return -1;
  if (!a.dueDate && b.dueDate) return 1;
  return PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
}

export async function getFollowups(projectId: string, includeArchived = false) {
  const items = await getRecords(COLLECTION_NAME, projectId, mapFollowup, { includeArchived });
  return items.sort(byDueDate);
}

export function subscribeToFollowups(
  projectId: string,
  callback: (followups: CrmFollowup[]) => void,
  includeArchived = false
) {
  return subscribeToRecords(
    COLLECTION_NAME, projectId, mapFollowup,
    (items) => callback(items.sort(byDueDate)),
    { includeArchived }
  );
}

export function getFollowupById(id: string) {
  return getRecordById(COLLECTION_NAME, id, mapFollowup);
}

export function subscribeToFollowup(id: string, cb: (f: CrmFollowup | null) => void) {
  return subscribeToRecord(COLLECTION_NAME, id, mapFollowup, cb);
}

export type FollowupLinkField = 'leadId' | 'contactId' | 'customerId' | 'opportunityId';

export function subscribeToFollowupsFor(
  projectId: string,
  field: FollowupLinkField,
  targetId: string,
  callback: (followups: CrmFollowup[]) => void
) {
  if (!projectId || !targetId) {
    callback([]);
    return () => {};
  }
  const q = query(
    collection(db, COLLECTION_NAME),
    where('projectId', '==', projectId),
    where(field, '==', targetId)
  );
  return onSnapshot(q, (snapshot) => {
    callback(
      snapshot.docs
        .filter(d => d.data().archived !== true)
        .map(d => mapFollowup(d.id, d.data()))
        .sort(byDueDate)
    );
  }, (error) => {
    console.error('Error subscribing to CRM followups:', error);
    callback([]);
  });
}

// ------------------------------------------------- viste della specifica

const today = () => new Date().toISOString().slice(0, 10);

const isActive = (f: CrmFollowup) => f.state === 'OPEN' || f.state === 'IN_PROGRESS';

export const followupViews = {
  today: (items: CrmFollowup[]) => items.filter(f => isActive(f) && f.dueDate === today()),
  overdue: (items: CrmFollowup[]) => items.filter(f => isActive(f) && f.dueDate && f.dueDate < today()),
  upcoming: (items: CrmFollowup[]) => items.filter(f => isActive(f) && f.dueDate && f.dueDate > today()),
  unassigned: (items: CrmFollowup[]) => items.filter(f => isActive(f) && !f.assigneeUid),
};

// ------------------------------------------------------------ scrittura

export interface CreateFollowupInput {
  type: FollowupType;
  title: string;
  notes?: string;
  assigneeUid?: string;
  priority?: Priority;
  dueDate?: string;
  createdFrom?: CrmFollowup['createdFrom'];

  leadId?: string;
  contactId?: string;
  customerId?: string;
  opportunityId?: string;
  linkedMeetingId?: string;
  linkedCalendarEventId?: string;
}

export async function createFollowup(ctx: CrmContextRef, input: CreateFollowupInput) {
  const id = await createRecord(COLLECTION_NAME, ctx, {
    type: input.type,
    title: input.title || 'Follow-up senza titolo',
    notes: input.notes || '',
    assigneeUid: input.assigneeUid || '',
    priority: input.priority || 'MEDIUM',
    dueDate: input.dueDate || '',
    state: 'OPEN' as FollowupState,
    snoozedUntil: '',
    completedAt: null,
    leadId: input.leadId || '',
    contactId: input.contactId || '',
    customerId: input.customerId || '',
    opportunityId: input.opportunityId || '',
    linkedMeetingId: input.linkedMeetingId || '',
    createdFrom: input.createdFrom || 'manual',
    linkedCalendarEventId: input.linkedCalendarEventId || '',
  }, input.createdFrom === 'ai' ? 'ai' : 'manual');

  if (id) await writeAudit(ctx, 'followup.created', 'followup', id, null, { title: input.title });
  return id;
}

export async function updateFollowup(ctx: CrmContextRef, id: string, updates: Partial<CrmFollowup>) {
  const payload: Record<string, any> = { ...updates };
  delete payload.state;   // si passa da changeFollowupState
  await updateRecord(COLLECTION_NAME, id, payload, ctx.uid);
  await writeAudit(ctx, 'followup.updated', 'followup', id, null, payload);
}

export class InvalidFollowupStateError extends Error {
  constructor(public from: string, public to: string) {
    super(`Transizione non ammessa: ${from} → ${to}`);
    this.name = 'InvalidFollowupStateError';
  }
}

export async function changeFollowupState(
  ctx: CrmContextRef,
  id: string,
  to: FollowupState,
  options: { snoozedUntil?: string } = {}
): Promise<void> {
  const current = await getFollowupById(id);
  if (!current) return;

  if (!canTransition(FOLLOWUP_TRANSITIONS, current.state, to)) {
    throw new InvalidFollowupStateError(current.state, to);
  }
  if (current.state === to) return;

  const payload: Record<string, any> = { state: to };
  if (to === 'DONE') payload.completedAt = new Date().toISOString();
  if (to === 'SNOOZED') payload.snoozedUntil = options.snoozedUntil || '';

  await updateRecord(COLLECTION_NAME, id, payload, ctx.uid);
  await writeAudit(ctx, 'followup.state_changed', 'followup', id,
    { state: current.state }, { state: to });
}

export async function reassignFollowup(ctx: CrmContextRef, id: string, assigneeUid: string) {
  const current = await getFollowupById(id);
  await updateRecord(COLLECTION_NAME, id, { assigneeUid }, ctx.uid);
  await writeAudit(ctx, 'followup.reassigned', 'followup', id,
    { assigneeUid: current?.assigneeUid }, { assigneeUid });
}

export async function archiveFollowup(ctx: CrmContextRef, id: string) {
  await archiveRecord(COLLECTION_NAME, id, ctx.uid);
  await writeAudit(ctx, 'followup.archived', 'followup', id);
}

export async function deleteFollowup(ctx: CrmContextRef, id: string) {
  await deleteRecord(COLLECTION_NAME, id);
  await writeAudit(ctx, 'followup.deleted', 'followup', id);
}

/**
 * Viste, filtri e ordinamento dei follow-up.
 *
 * Funzioni pure. Le «viste» sono le combinazioni che si usano davvero ogni
 * giorno — oggi, in ritardo, questa settimana — e non un filtro da comporre a
 * mano ogni volta.
 */


export type FollowupView = 'today' | 'overdue' | 'week' | 'unplanned' | 'done' | 'all' | 'archived';

export const FOLLOWUP_VIEW_LABELS: Record<FollowupView, string> = {
  today: 'Oggi',
  overdue: 'In ritardo',
  week: 'Prossimi 7 giorni',
  unplanned: 'Senza data',
  done: 'Chiusi',
  all: 'Tutti',
  archived: 'Archiviati',
};

/** Stati che contano come «ancora da fare». */
export const OPEN_STATES: FollowupState[] = ['OPEN', 'IN_PROGRESS', 'SNOOZED'];

export interface FollowupFilters {
  search: string;
  view: FollowupView;
  assigneeUids: string[];
  types: FollowupType[];
  priorities: Priority[];
  includeArchived: boolean;
}

export const EMPTY_FOLLOWUP_FILTERS: FollowupFilters = {
  search: '',
  view: 'today',
  assigneeUids: [],
  types: [],
  priorities: [],
  includeArchived: false,
};

export function countFollowupFilters(filters: FollowupFilters): number {
  let count = 0;
  if (filters.search.trim()) count++;
  if (filters.assigneeUids.length) count++;
  if (filters.types.length) count++;
  if (filters.priorities.length) count++;
  if (filters.includeArchived) count++;
  return count;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

/** Data di riferimento: la sospensione sposta la scadenza effettiva. */
export function effectiveDue(followup: CrmFollowup): string {
  if (followup.state === 'SNOOZED' && followup.snoozedUntil) return followup.snoozedUntil.slice(0, 10);
  return (followup.dueDate || '').slice(0, 10);
}

export function isOpen(followup: CrmFollowup): boolean {
  return OPEN_STATES.includes(followup.state);
}

export function isOverdue(followup: CrmFollowup): boolean {
  const due = effectiveDue(followup);
  return isOpen(followup) && !!due && due < todayISO();
}

function matchesView(followup: CrmFollowup, view: FollowupView): boolean {
  const due = effectiveDue(followup);
  const today = todayISO();

  switch (view) {
    case 'today':
      // Oggi include il pregresso: quello che è scaduto va fatto oggi, non
      // nascosto in un'altra vista.
      return isOpen(followup) && !!due && due <= today;
    case 'overdue':
      return isOverdue(followup);
    case 'week': {
      if (!isOpen(followup) || !due) return false;
      const limit = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
      return due >= today && due <= limit;
    }
    case 'unplanned':
      return isOpen(followup) && !due;
    case 'done':
      return followup.state === 'DONE' || followup.state === 'CANCELLED';
    case 'all':
    default:
      return true;
  }
}

export function applyFollowupFilters(
  followups: CrmFollowup[],
  filters: FollowupFilters
): CrmFollowup[] {
  const needle = filters.search.trim().toLowerCase();

  return followups.filter(followup => {
    if (filters.view === 'archived') {
      if (!followup.archived) return false;
    } else {
      if (followup.archived) return false;
      if (!matchesView(followup, filters.view)) return false;
    }
    if (filters.assigneeUids.length > 0 && !filters.assigneeUids.includes(followup.assigneeUid)) return false;
    if (filters.types.length > 0 && !filters.types.includes(followup.type)) return false;
    if (filters.priorities.length > 0 && !filters.priorities.includes(followup.priority)) return false;
    if (needle && ![followup.title, followup.notes].join(' ').toLowerCase().includes(needle)) return false;
    return true;
  });
}

// ----------------------------------------------------------- ordinamento

export type FollowupSortField = 'dueDate' | 'priority' | 'title' | 'state' | 'updatedAt';

export interface FollowupSort {
  field: FollowupSortField;
  direction: 'asc' | 'desc';
}

/** Per scadenza crescente: il più urgente in cima, che è come si lavora. */
export const DEFAULT_FOLLOWUP_SORT: FollowupSort = { field: 'dueDate', direction: 'asc' };

const PRIORITY_ORDER: Record<Priority, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
const STATE_ORDER: Record<FollowupState, number> = {
  OPEN: 0, IN_PROGRESS: 1, SNOOZED: 2, DONE: 3, CANCELLED: 4,
};

export function applyFollowupSort(followups: CrmFollowup[], sort: FollowupSort): CrmFollowup[] {
  const factor = sort.direction === 'asc' ? 1 : -1;

  return [...followups].sort((a, b) => {
    switch (sort.field) {
      case 'priority': return (PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]) * factor;
      case 'title':    return a.title.localeCompare(b.title, 'it') * factor;
      case 'state':    return (STATE_ORDER[a.state] - STATE_ORDER[b.state]) * factor;
      case 'updatedAt': return (toMillis(a.updatedAt) - toMillis(b.updatedAt)) * factor;
      case 'dueDate':
      default: {
        const dateA = effectiveDue(a);
        const dateB = effectiveDue(b);
        // Senza scadenza in fondo in entrambi i versi: è un'assenza di dato.
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;
        return dateA.localeCompare(dateB) * factor;
      }
    }
  });
}

export function buildFollowupView(
  followups: CrmFollowup[],
  filters: FollowupFilters,
  sort: FollowupSort,
  page: number,
  pageSize: number
): Page<CrmFollowup> {
  return paginate(applyFollowupSort(applyFollowupFilters(followups, filters), sort), page, pageSize);
}

/** Quanti record cadono in ciascuna vista: si mostrano accanto alle schede. */
export function countViews(followups: CrmFollowup[]): Record<FollowupView, number> {
  const views: FollowupView[] = ['today', 'overdue', 'week', 'unplanned', 'done', 'all', 'archived'];

  return views.reduce((acc, view) => {
    acc[view] = followups.filter(followup => {
      if (view === 'archived') return followup.archived;
      if (followup.archived) return false;
      return matchesView(followup, view);
    }).length;
    return acc;
  }, {} as Record<FollowupView, number>);
}
