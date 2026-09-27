import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { CrmInteraction } from '@/types/crm';
import { InteractionType, VisibilityLevel } from '@/components/crm/constants';
import {
  CrmContextRef, mapBase, createRecord, updateRecord, archiveRecord,
  getRecords, getRecordById, subscribeToRecords, subscribeToRecord, toMillis,
} from './base';
import { writeAudit } from './audit';

const COLLECTION_NAME = 'crm_interactions';

/** Campi di collegamento: un'interazione ne ha almeno uno valorizzato. */
export type InteractionLinkField =
  'leadId' | 'accountId' | 'contactId' | 'customerId' | 'opportunityId';

export function mapInteraction(id: string, data: any): CrmInteraction {
  return {
    ...mapBase(id, data),
    type: data.type || 'note',
    leadId: data.leadId || '',
    accountId: data.accountId || '',
    contactId: data.contactId || '',
    customerId: data.customerId || '',
    opportunityId: data.opportunityId || '',
    title: data.title || '',
    body: data.body || '',
    outcome: data.outcome || '',
    occurredAt: data.occurredAt,
    linkedMeetingId: data.linkedMeetingId || '',
    linkedTaskId: data.linkedTaskId || '',
    linkedDocumentIds: data.linkedDocumentIds || [],
    linkedCommunicationId: data.linkedCommunicationId || '',
    nextStep: data.nextStep || '',
    visibility: data.visibility || 'team',
    participantUids: data.participantUids || [],
  };
}

function byOccurredAtDesc(a: CrmInteraction, b: CrmInteraction) {
  const timeA = toMillis(a.occurredAt) || toMillis(a.createdAt);
  const timeB = toMillis(b.occurredAt) || toMillis(b.createdAt);
  return timeB - timeA;
}

export async function getInteractions(projectId: string, includeArchived = false) {
  const items = await getRecords(COLLECTION_NAME, projectId, mapInteraction, { includeArchived });
  return items.sort(byOccurredAtDesc);
}

export function subscribeToInteractions(
  projectId: string,
  callback: (interactions: CrmInteraction[]) => void,
  includeArchived = false
) {
  return subscribeToRecords(
    COLLECTION_NAME, projectId, mapInteraction,
    (items) => callback(items.sort(byOccurredAtDesc)),
    { includeArchived }
  );
}

export function getInteractionById(id: string) {
  return getRecordById(COLLECTION_NAME, id, mapInteraction);
}

export function subscribeToInteraction(id: string, cb: (i: CrmInteraction | null) => void) {
  return subscribeToRecord(COLLECTION_NAME, id, mapInteraction, cb);
}

/** Interazioni collegate a una singola entità, dalla più recente. */
export function subscribeToInteractionsFor(
  projectId: string,
  field: InteractionLinkField,
  targetId: string,
  callback: (interactions: CrmInteraction[]) => void
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
    const items = snapshot.docs
      .filter(d => d.data().archived !== true)
      .map(d => mapInteraction(d.id, d.data()))
      .sort(byOccurredAtDesc);
    callback(items);
  }, (error) => {
    console.error('Error subscribing to CRM interactions:', error);
    callback([]);
  });
}

export interface CreateInteractionInput {
  type: InteractionType;
  title: string;
  body?: string;
  outcome?: string;
  occurredAt?: string;
  nextStep?: string;
  visibility?: VisibilityLevel;
  participantUids?: string[];

  leadId?: string;
  accountId?: string;
  contactId?: string;
  customerId?: string;
  opportunityId?: string;

  linkedMeetingId?: string;
  linkedTaskId?: string;
  linkedDocumentIds?: string[];
  linkedCommunicationId?: string;
}

export async function createInteraction(ctx: CrmContextRef, input: CreateInteractionInput) {
  const hasLink = input.leadId || input.accountId || input.contactId
    || input.customerId || input.opportunityId;
  if (!hasLink) {
    console.error('Interazione senza collegamenti: rifiutata');
    return null;
  }

  const id = await createRecord(COLLECTION_NAME, ctx, {
    type: input.type,
    leadId: input.leadId || '',
    accountId: input.accountId || '',
    contactId: input.contactId || '',
    customerId: input.customerId || '',
    opportunityId: input.opportunityId || '',
    title: input.title || '',
    body: input.body || '',
    outcome: input.outcome || '',
    occurredAt: input.occurredAt || new Date().toISOString(),
    linkedMeetingId: input.linkedMeetingId || '',
    linkedTaskId: input.linkedTaskId || '',
    linkedDocumentIds: input.linkedDocumentIds || [],
    linkedCommunicationId: input.linkedCommunicationId || '',
    nextStep: input.nextStep || '',
    visibility: input.visibility || 'team',
    participantUids: input.participantUids || [],
  });

  if (id) await writeAudit(ctx, 'interaction.created', 'interaction', id, null, { type: input.type });
  return id;
}

export async function updateInteraction(ctx: CrmContextRef, id: string, updates: Partial<CrmInteraction>) {
  await updateRecord(COLLECTION_NAME, id, updates, ctx.uid);
  await writeAudit(ctx, 'interaction.updated', 'interaction', id, null, updates);
}

export async function archiveInteraction(ctx: CrmContextRef, id: string) {
  await archiveRecord(COLLECTION_NAME, id, ctx.uid);
  await writeAudit(ctx, 'interaction.archived', 'interaction', id);
}
