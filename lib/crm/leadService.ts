import { CrmLead, CrmConsents } from '@/types/crm';
import { LeadState, LEAD_TRANSITIONS, canTransition } from '@/components/crm/constants';
import { CrmContextRef, mapBase, createRecord, updateRecord, archiveRecord, restoreRecord, deleteRecord, getRecords, getRecordById, subscribeToRecords, subscribeToRecord, normalizeEmail, normalizePhone, extractDomain, byUpdatedAtDesc } from './base';
import { writeAudit } from './audit';
import { findDuplicates } from './duplicates';
import { toMillis } from './helpers';

const COLLECTION_NAME = 'crm_leads';

function emptyConsents(): CrmConsents {
  return {
    email: { granted: false, source: '', policyVersion: '' },
    sms: { granted: false, source: '', policyVersion: '' },
  };
}

function mapConsents(data: any): CrmConsents {
  const base = emptyConsents();
  if (!data) return base;
  return {
    email: { ...base.email, ...(data.email || {}) },
    sms: { ...base.sms, ...(data.sms || {}) },
  };
}

export function mapLead(id: string, data: any): CrmLead {
  return {
    ...mapBase(id, data),
    fullName: data.fullName || '',
    companyName: data.companyName || '',
    email: data.email || '',
    emailNormalized: data.emailNormalized || '',
    phone: data.phone || '',
    phoneNormalized: data.phoneNormalized || '',
    address: data.address || '',
    city: data.city || '',
    postalCode: data.postalCode || '',
    country: data.country || '',
    vatNumber: data.vatNumber || '',
    taxCode: data.taxCode || '',
    vatVerifiedAt: data.vatVerifiedAt || null,
    vatSource: data.vatSource || 'manual',
    companyDomain: data.companyDomain || '',
    source: data.source || '',
    ownerUid: data.ownerUid || '',
    state: data.state || 'NEW',
    estimatedValue: typeof data.estimatedValue === 'number' ? data.estimatedValue : 0,
    currency: data.currency || 'EUR',
    notes: data.notes || '',
    lastContactAt: data.lastContactAt,
    nextFollowupAt: data.nextFollowupAt,
    consents: mapConsents(data.consents),
    convertedAt: data.convertedAt,
    convertedAccountId: data.convertedAccountId || '',
    convertedContactId: data.convertedContactId || '',
    convertedCustomerId: data.convertedCustomerId || '',
    convertedOpportunityId: data.convertedOpportunityId || '',
    duplicateOf: data.duplicateOf || '',
    duplicateCandidateIds: data.duplicateCandidateIds || [],
    lostReason: data.lostReason || '',
  };
}

// ------------------------------------------------------------- lettura

export async function getLeads(projectId: string, includeArchived = false) {
  const leads = await getRecords(COLLECTION_NAME, projectId, mapLead, { includeArchived });
  return leads.sort(byUpdatedAtDesc);
}

export function subscribeToLeads(
  projectId: string,
  callback: (leads: CrmLead[]) => void,
  includeArchived = false
) {
  return subscribeToRecords(
    COLLECTION_NAME,
    projectId,
    mapLead,
    // Ordinamento lato client: evita un indice composito.
    (leads) => callback(leads.sort(byUpdatedAtDesc)),
    { includeArchived }
  );
}

export function getLeadById(id: string) {
  return getRecordById(COLLECTION_NAME, id, mapLead);
}

export function subscribeToLead(id: string, callback: (lead: CrmLead | null) => void) {
  return subscribeToRecord(COLLECTION_NAME, id, mapLead, callback);
}

// ------------------------------------------------------------ scrittura

export interface CreateLeadInput {
  fullName: string;
  companyName?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  vatNumber?: string;
  taxCode?: string;
  vatVerifiedAt?: any;
  vatSource?: 'vies' | 'provider' | 'manual';
  companyDomain?: string;
  source?: string;
  ownerUid?: string;
  estimatedValue?: number;
  currency?: string;
  notes?: string;
  consents?: CrmConsents;
}

export interface CreateLeadResult {
  id: string | null;
  /** Possibili duplicati trovati: segnalati, mai fusi automaticamente. */
  duplicates: Awaited<ReturnType<typeof findDuplicates>>;
}

/**
 * Crea un lead e contestualmente cerca possibili duplicati, come richiede la
 * specifica. Il lead viene creato comunque: i candidati restano registrati su
 * `duplicateCandidateIds` perché qualcuno decida a mano.
 */
export async function createLead(
  ctx: CrmContextRef,
  input: CreateLeadInput
): Promise<CreateLeadResult> {
  const email = input.email || '';
  const phone = input.phone || '';
  const domain = input.companyDomain || extractDomain(email);

  const duplicates = await findDuplicates(ctx.projectId, { email, phone, domain, vatNumber: input.vatNumber });

  const id = await createRecord(COLLECTION_NAME, ctx, {
    fullName: input.fullName || '',
    companyName: input.companyName || '',
    email,
    emailNormalized: normalizeEmail(email),
    phone,
    phoneNormalized: normalizePhone(phone),
    address: input.address || '',
    city: input.city || '',
    postalCode: input.postalCode || '',
    country: input.country || '',
    vatNumber: input.vatNumber || '',
    taxCode: input.taxCode || '',
    vatVerifiedAt: input.vatVerifiedAt || null,
    vatSource: input.vatSource || 'manual',
    companyDomain: domain,
    source: input.source || '',
    ownerUid: input.ownerUid || ctx.uid,
    state: 'NEW' as LeadState,
    estimatedValue: input.estimatedValue || 0,
    currency: input.currency || 'EUR',
    notes: input.notes || '',
    lastContactAt: null,
    nextFollowupAt: null,
    consents: input.consents || emptyConsents(),
    convertedAt: null,
    convertedAccountId: '',
    convertedContactId: '',
    convertedCustomerId: '',
    convertedOpportunityId: '',
    duplicateOf: '',
    duplicateCandidateIds: duplicates.map(d => d.id),
    lostReason: '',
  });

  if (id) {
    await writeAudit(ctx, 'lead.created', 'lead', id, null, { fullName: input.fullName }, {
      duplicateCount: duplicates.length,
    });
  }

  return { id, duplicates };
}

export async function updateLead(
  ctx: CrmContextRef,
  id: string,
  updates: Partial<CrmLead>
): Promise<void> {
  const payload: Record<string, any> = { ...updates };

  // Le chiavi normalizzate restano allineate ai valori visibili.
  if (updates.email !== undefined) payload.emailNormalized = normalizeEmail(updates.email);
  if (updates.phone !== undefined) payload.phoneNormalized = normalizePhone(updates.phone);
  if (updates.companyDomain !== undefined) payload.companyDomain = extractDomain(updates.companyDomain);

  // Lo stato non si cambia da qui: si passa da changeLeadState, che valida.
  delete payload.state;

  await updateRecord(COLLECTION_NAME, id, payload, ctx.uid);
  await writeAudit(ctx, 'lead.updated', 'lead', id, null, payload);
}

export class InvalidTransitionError extends Error {
  constructor(public from: string, public to: string) {
    super(`Transizione non ammessa: ${from} → ${to}`);
    this.name = 'InvalidTransitionError';
  }
}

/**
 * «Convertito» non si imposta a mano: ci si arriva solo dalla conversione
 * guidata, che è l'unica a creare azienda, contatto, cliente e opportunità e a
 * portarsi dietro lo storico.
 *
 * Senza questo divieto il lead finirebbe in uno stato **terminale** — da
 * CONVERTED non esce nessuna transizione — con i campi `converted*` vuoti e
 * niente a cui essere collegato: convertito sulla carta, e irrecuperabile
 * dall'interfaccia.
 */
export class ConversionRequiredError extends Error {
  constructor() {
    super('Per convertire un lead si passa dalla conversione guidata: crea cliente, azienda e contatto e trasferisce lo storico.');
    this.name = 'ConversionRequiredError';
  }
}

/**
 * Cambia lo stato del lead validando la transizione.
 * La specifica richiede «validazione dei cambi di stato»: un salto non previsto
 * dalla macchina a stati viene rifiutato, non corretto in silenzio.
 *
 * `viaConversione` lo passa solo `convertLead`: vedi ConversionRequiredError.
 */
export async function changeLeadState(
  ctx: CrmContextRef,
  id: string,
  to: LeadState,
  options: { lostReason?: string; viaConversione?: boolean } = {}
): Promise<void> {
  const lead = await getLeadById(id);
  if (!lead) {
    console.error('Lead non trovato:', id);
    return;
  }

  if (!canTransition(LEAD_TRANSITIONS, lead.state, to)) {
    throw new InvalidTransitionError(lead.state, to);
  }
  if (to === 'CONVERTED' && !options.viaConversione) {
    throw new ConversionRequiredError();
  }
  if (lead.state === to) return;

  const payload: Record<string, any> = { state: to };
  if (to === 'LOST' || to === 'NOT_INTERESTED') {
    payload.lostReason = options.lostReason || '';
  }

  await updateRecord(COLLECTION_NAME, id, payload, ctx.uid);
  await writeAudit(ctx, 'lead.state_changed', 'lead', id, { state: lead.state }, { state: to });
}

export async function assignLead(ctx: CrmContextRef, id: string, ownerUid: string): Promise<void> {
  const lead = await getLeadById(id);
  await updateRecord(COLLECTION_NAME, id, { ownerUid }, ctx.uid);
  await writeAudit(ctx, 'lead.assigned', 'lead', id, { ownerUid: lead?.ownerUid }, { ownerUid });
}

export async function archiveLead(ctx: CrmContextRef, id: string): Promise<void> {
  await archiveRecord(COLLECTION_NAME, id, ctx.uid);
  await writeAudit(ctx, 'lead.archived', 'lead', id);
}

export async function deleteLead(ctx: CrmContextRef, id: string): Promise<void> {
  await deleteRecord(COLLECTION_NAME, id);
  await writeAudit(ctx, 'lead.deleted', 'lead', id);
}

export async function restoreLead(ctx: CrmContextRef, id: string): Promise<void> {
  await restoreRecord(COLLECTION_NAME, id, ctx.uid);
  await writeAudit(ctx, 'lead.restored', 'lead', id);
}

/** Ricalcola i candidati duplicato di un lead esistente. */
export async function refreshLeadDuplicates(ctx: CrmContextRef, id: string) {
  const lead = await getLeadById(id);
  if (!lead) return [];
  const duplicates = await findDuplicates(
    ctx.projectId,
    { email: lead.email, phone: lead.phone, domain: lead.companyDomain },
    id
  );
  await updateRecord(COLLECTION_NAME, id, {
    duplicateCandidateIds: duplicates.map(d => d.id),
  }, ctx.uid);
  return duplicates;
}

/**
 * Filtri, ordinamento e paginazione della lista lead.
 *
 * Funzioni pure: non toccano Firestore, non usano React. Girano sull'array già
 * caricato dal context, il che le rende verificabili e riusabili.
 *
 * NOTA SUI LIMITI: filtro e paginazione avvengono nel browser, sull'insieme
 * completo dei lead del progetto. Va bene fino a qualche migliaio di record;
 * oltre servono query indicizzate e cursori lato server, che la deroga 2
 * esclude dal primo rilascio. Vedi docs/DEROGHE.md.
 */

export type FollowupFilter = 'any' | 'scheduled' | 'missing' | 'overdue';

export interface LeadFilters {
  search: string;
  states: LeadState[];
  ownerUids: string[];
  sources: string[];
  followup: FollowupFilter;
  minValue: number | null;
  maxValue: number | null;
  includeArchived: boolean;
}

export const EMPTY_FILTERS: LeadFilters = {
  search: '',
  states: [],
  ownerUids: [],
  sources: [],
  followup: 'any',
  minValue: null,
  maxValue: null,
  includeArchived: false,
};

export type LeadSortField =
  'updatedAt' | 'createdAt' | 'fullName' | 'companyName' | 'estimatedValue' | 'nextFollowupAt' | 'state';

export interface LeadSort {
  field: LeadSortField;
  direction: 'asc' | 'desc';
}

export const DEFAULT_SORT: LeadSort = { field: 'updatedAt', direction: 'desc' };

// ------------------------------------------------------------- filtro

const todayISO = () => new Date().toISOString().slice(0, 10);

/** Data come stringa ISO, sia che arrivi da Timestamp sia da stringa. */
function asISODate(value: any): string {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  const millis = toMillis(value);
  return millis ? new Date(millis).toISOString().slice(0, 10) : '';
}

/**
 * Ricerca testuale su nome, azienda, email e telefono.
 * Il telefono viene confrontato anche normalizzato, così "+39 02 1234" trova
 * un numero salvato come "0021234".
 */
function matchesSearch(lead: CrmLead, search: string): boolean {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;

  const haystack = [
    lead.fullName, lead.companyName, lead.email, lead.phone,
    lead.companyDomain, lead.source, lead.notes,
  ].join(' ').toLowerCase();

  if (haystack.includes(needle)) return true;

  const digits = normalizePhone(needle);
  return digits.length >= 3 && normalizePhone(lead.phone).includes(digits);
}

function matchesFollowup(lead: CrmLead, filter: FollowupFilter): boolean {
  const next = asISODate(lead.nextFollowupAt);
  switch (filter) {
    case 'scheduled': return !!next;
    case 'missing':   return !next;
    case 'overdue':   return !!next && next < todayISO();
    default:          return true;
  }
}

export function applyLeadFilters(leads: CrmLead[], filters: LeadFilters): CrmLead[] {
  return leads.filter(lead => {
    if (!filters.includeArchived && lead.archived) return false;
    if (filters.states.length > 0 && !filters.states.includes(lead.state)) return false;
    if (filters.ownerUids.length > 0 && !filters.ownerUids.includes(lead.ownerUid)) return false;
    if (filters.sources.length > 0 && !filters.sources.includes(lead.source)) return false;
    if (filters.minValue !== null && lead.estimatedValue < filters.minValue) return false;
    if (filters.maxValue !== null && lead.estimatedValue > filters.maxValue) return false;
    if (!matchesFollowup(lead, filters.followup)) return false;
    if (!matchesSearch(lead, filters.search)) return false;
    return true;
  });
}

/** Quanti filtri sono attivi: serve a mostrarlo accanto al pulsante. */
export function countActiveFilters(filters: LeadFilters): number {
  let count = 0;
  if (filters.search.trim()) count++;
  if (filters.states.length) count++;
  if (filters.ownerUids.length) count++;
  if (filters.sources.length) count++;
  if (filters.followup !== 'any') count++;
  if (filters.minValue !== null || filters.maxValue !== null) count++;
  if (filters.includeArchived) count++;
  return count;
}

// -------------------------------------------------------- ordinamento

/** Ordine della pipeline, non alfabetico: è quello che ha senso vedere. */
const STATE_ORDER: Record<LeadState, number> = {
  NEW: 0, TO_CONTACT: 1, CONTACTED: 2, FOLLOWUP: 3, QUALIFIED: 4,
  PROPOSAL_SENT: 5, NEGOTIATION: 6, CONVERTED: 7, LOST: 8, NOT_INTERESTED: 9,
};

export function applyLeadSort(leads: CrmLead[], sort: LeadSort): CrmLead[] {
  const factor = sort.direction === 'asc' ? 1 : -1;

  return [...leads].sort((a, b) => {
    switch (sort.field) {
      case 'fullName':
        return a.fullName.localeCompare(b.fullName, 'it') * factor;
      case 'companyName':
        return a.companyName.localeCompare(b.companyName, 'it') * factor;
      case 'estimatedValue':
        return (a.estimatedValue - b.estimatedValue) * factor;
      case 'state':
        return (STATE_ORDER[a.state] - STATE_ORDER[b.state]) * factor;
      case 'nextFollowupAt': {
        const dateA = asISODate(a.nextFollowupAt);
        const dateB = asISODate(b.nextFollowupAt);
        // I lead senza prossima azione vanno in fondo in entrambi i versi:
        // sono un'assenza di dato, non un valore minimo.
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;
        return dateA.localeCompare(dateB) * factor;
      }
      case 'createdAt':
        return (toMillis(a.createdAt) - toMillis(b.createdAt)) * factor;
      case 'updatedAt':
      default:
        return (toMillis(a.updatedAt) - toMillis(b.updatedAt)) * factor;
    }
  });
}

// -------------------------------------------------------- paginazione

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export const PAGE_SIZES = [25, 50, 100] as const;

export function paginate<T>(items: T[], page: number, pageSize: number): Page<T> {
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  // Se i filtri riducono i risultati, la pagina corrente può non esistere più.
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    page: safePage,
    pageSize,
    totalItems,
    totalPages,
  };
}

/** Filtro, ordinamento e paginazione in un passaggio solo. */
export function buildLeadView(
  leads: CrmLead[],
  filters: LeadFilters,
  sort: LeadSort,
  page: number,
  pageSize: number
): Page<CrmLead> {
  return paginate(applyLeadSort(applyLeadFilters(leads, filters), sort), page, pageSize);
}
