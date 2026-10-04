/**
 * Timeline unica: interazioni, follow-up, comunicazioni e documenti di
 * un'entità, in un solo elenco ordinato.
 *
 * Funzione pura. Non legge Firestore: riceve i record già caricati e li
 * compone. Quello che manca qui manca perché non è stato ancora caricato, non
 * perché la timeline l'abbia perso.
 */

import {
  CrmInteraction, CrmFollowup, CrmCommunication, CrmDocument,
} from '@/types/crm';
import { FollowupState } from '@/components/crm/constants';
import { toMillis } from './helpers';
import { getInteractionTypeLabel, getFollowupStateLabel, getFollowupTypeLabel, getEmailStateLabel } from '@/components/crm/shared/labels';

export type TimelineKind = 'interaction' | 'followup' | 'communication' | 'document';

export const TIMELINE_KIND_LABELS: Record<TimelineKind, string> = {
  interaction: 'Interazioni',
  followup: 'Follow-up',
  communication: 'Email',
  document: 'Documenti',
};

export const TIMELINE_KIND_COLORS: Record<TimelineKind, string> = {
  interaction: '#3B82F6',
  followup: '#F59E0B',
  communication: '#8B5CF6',
  document: '#10B981',
};

export interface TimelineEntry {
  id: string;
  kind: TimelineKind;
  /** Millisecondi: già risolti da Timestamp o da stringa ISO. */
  at: number;
  title: string;
  subtitle: string;
  detail: string;
  /** Etichetta del sottotipo: «Telefonata», «Consegnata», «Completato». */
  badge: string;
  actorUid: string;
  /** Archiviato: si mostra solo se richiesto, e sbiadito. */
  archived: boolean;
}

/** A quale entità appartiene la timeline che si sta componendo. */
export interface TimelineRef {
  leadId?: string;
  accountId?: string;
  contactId?: string;
  customerId?: string;
  opportunityId?: string;
}

export interface TimelineSources {
  interactions: CrmInteraction[];
  followups: CrmFollowup[];
  communications: CrmCommunication[];
  documents: CrmDocument[];
}

export interface TimelineOptions {
  kinds: TimelineKind[];
  includeArchived: boolean;
  /**
   * `ref` (predefinito) = la timeline di un'entità. `project` = tutto quello
   * che è successo nel progetto, ignorando il riferimento: serve al riepilogo,
   * che mostra le attività recenti senza sapere a chi appartengono.
   */
  scope?: 'ref' | 'project';
}

export const ALL_KINDS: TimelineKind[] = ['interaction', 'followup', 'communication', 'document'];

export const DEFAULT_TIMELINE_OPTIONS: TimelineOptions = {
  kinds: ALL_KINDS,
  includeArchived: false,
  scope: 'ref',
};

/** Vero se il record punta ad almeno una delle entità della timeline. */
function belongsTo(record: Record<string, any>, ref: TimelineRef): boolean {
  const keys: (keyof TimelineRef)[] = ['leadId', 'accountId', 'contactId', 'customerId', 'opportunityId'];
  return keys.some(key => {
    const wanted = ref[key];
    return !!wanted && record[key] === wanted;
  });
}

/** Il primo testo non vuoto, tagliato a una riga leggibile. */
function summarize(...candidates: string[]): string {
  const text = candidates.find(candidate => (candidate || '').trim()) || '';
  const single = text.replace(/\s+/g, ' ').trim();
  return single.length > 160 ? `${single.slice(0, 157)}…` : single;
}

export interface Timeline {
  /** Follow-up ancora da fare, dal più vicino nel tempo. */
  upcoming: TimelineEntry[];
  /** Tutto ciò che è già successo, dal più recente. */
  past: TimelineEntry[];
  /** Conteggi per tipo, calcolati prima del filtro sui tipi. */
  counts: Record<TimelineKind, number>;
  total: number;
}

const OPEN_STATES: FollowupState[] = ['OPEN', 'IN_PROGRESS', 'SNOOZED'];

/**
 * Compone la timeline.
 *
 * I follow-up ancora aperti stanno in un elenco a parte invece che mescolati
 * al resto: non sono cose successe, sono cose da fare. Mischiarli allo storico
 * fa sembrare fatto quello che è solo programmato.
 */
export function buildTimeline(
  sources: TimelineSources,
  ref: TimelineRef,
  options: TimelineOptions = DEFAULT_TIMELINE_OPTIONS
): Timeline {
  // Con `scope: 'project'` non si filtra per entità: passa tutto.
  const belongs = options.scope === 'project'
    ? () => true
    : (record: Record<string, any>) => belongsTo(record, ref);

  const entries: TimelineEntry[] = [];
  const counts: Record<TimelineKind, number> = {
    interaction: 0, followup: 0, communication: 0, document: 0,
  };

  const push = (entry: TimelineEntry) => {
    counts[entry.kind]++;
    if (!options.kinds.includes(entry.kind)) return;
    if (entry.archived && !options.includeArchived) return;
    entries.push(entry);
  };

  sources.interactions.filter(belongs).forEach(record => {
    push({
      id: record.id,
      kind: 'interaction',
      at: toMillis(record.occurredAt) || toMillis(record.createdAt),
      title: summarize(record.title, getInteractionTypeLabel(record.type as any, { crm: {} } as any)),
      subtitle: record.outcome || '',
      detail: summarize(record.body, record.nextStep),
      badge: getInteractionTypeLabel(record.type as any, { crm: {} } as any) || record.type,
      actorUid: record.createdBy,
      archived: record.archived,
    });
  });

  sources.followups.filter(belongs).forEach(record => {
    push({
      id: record.id,
      kind: 'followup',
      // Un follow-up si colloca alla sua scadenza, non a quando è stato creato.
      at: record.dueDate ? Date.parse(record.dueDate) : toMillis(record.createdAt),
      title: record.title,
      subtitle: getFollowupStateLabel(record.state as any, { crm: {} } as any),
      detail: summarize(record.notes),
      badge: getFollowupTypeLabel(record.type as any, { crm: {} } as any) || record.type,
      actorUid: record.assigneeUid || record.createdBy,
      archived: record.archived,
    });
  });

  sources.communications.filter(belongs).forEach(record => {
    push({
      id: record.id,
      kind: 'communication',
      at: toMillis(record.sentAt) || toMillis(record.createdAt),
      title: summarize(record.subject, '(senza oggetto)'),
      subtitle: record.toEmail,
      detail: summarize(record.bodyText, record.errorMessage),
      badge: getEmailStateLabel(record.state as any, { crm: {} } as any) || record.state,
      actorUid: record.createdBy,
      archived: record.archived,
    });
  });

  sources.documents.filter(belongs).forEach(record => {
    push({
      id: record.id,
      kind: 'document',
      at: toMillis(record.createdAt),
      title: record.fileName,
      subtitle: record.extension ? record.extension.toUpperCase() : '',
      detail: record.tags.join(', '),
      badge: record.versions.length > 1 ? `v${record.versions.length}` : 'Documento',
      actorUid: record.createdBy,
      archived: record.archived,
    });
  });

  const now = Date.now();
  const openFollowupIds = new Set(
    sources.followups.filter(record => OPEN_STATES.includes(record.state)).map(record => record.id)
  );

  const upcoming = entries
    .filter(entry => entry.kind === 'followup' && openFollowupIds.has(entry.id) && entry.at >= now)
    .sort((a, b) => a.at - b.at);

  const upcomingIds = new Set(upcoming.map(entry => entry.id));
  const past = entries
    .filter(entry => !(entry.kind === 'followup' && upcomingIds.has(entry.id)))
    .sort((a, b) => b.at - a.at);

  return {
    upcoming,
    past,
    counts,
    total: counts.interaction + counts.followup + counts.communication + counts.document,
  };
}

/** Raggruppa per giorno, per le intestazioni dell'elenco. */
export function groupByDay(entries: TimelineEntry[]): { day: string; entries: TimelineEntry[] }[] {
  const groups: { day: string; entries: TimelineEntry[] }[] = [];

  entries.forEach(entry => {
    const day = entry.at ? new Date(entry.at).toISOString().slice(0, 10) : '';
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.entries.push(entry);
    else groups.push({ day, entries: [entry] });
  });

  return groups;
}
