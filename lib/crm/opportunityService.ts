import { CrmOpportunity, CrmOpportunityItem } from '@/types/crm';
import { OpportunityPhase, OPPORTUNITY_TRANSITIONS, OPPORTUNITY_PHASE_PROBABILITY, canTransition, OPPORTUNITY_PHASES } from '@/components/crm/constants';
import { db } from '@/lib/firebase';
import { doc, writeBatch, serverTimestamp, increment } from 'firebase/firestore';
import { CrmContextRef, mapBase, createRecord, updateRecord, archiveRecord, restoreRecord, getRecords, getRecordById, subscribeToRecords, subscribeToRecord } from './base';
import { writeAudit } from './audit';
import { toMillis } from './helpers';
import { Page, paginate } from './leadFilters';

const COLLECTION_NAME = 'crm_opportunities';

export function mapOpportunity(id: string, data: any): CrmOpportunity {
  return {
    ...mapBase(id, data),
    title: data.title || 'Opportunità senza titolo',
    description: data.description || '',
    customerId: data.customerId || '',
    leadId: data.leadId || '',
    ownerUid: data.ownerUid || '',
    value: typeof data.value === 'number' ? data.value : 0,
    currency: data.currency || 'EUR',
    phase: data.phase || 'QUALIFICATION',
    // null significa «non impostata a mano»: vale quella suggerita dalla fase.
    probability: typeof data.probability === 'number' ? data.probability : null,
    expectedCloseDate: data.expectedCloseDate || '',
    closedAt: data.closedAt,
    lostReason: data.lostReason || '',
    items: data.items || [],
    changeLog: data.changeLog || [],
    notes: data.notes || '',
    order: typeof data.order === 'number' ? data.order : 0,
  };
}

/**
 * Probabilità da mostrare: quella scritta a mano se c'è, altrimenti quella
 * suggerita dalla fase. La specifica chiede che «i dati calcolati restino
 * distinti dai valori modificati manualmente»: per questo non si scrive mai
 * il valore suggerito dentro `probability`.
 */
export function effectiveProbability(opportunity: CrmOpportunity): number {
  if (opportunity.probability !== null) return opportunity.probability;
  return OPPORTUNITY_PHASE_PROBABILITY[opportunity.phase];
}

export function isProbabilityManual(opportunity: CrmOpportunity): boolean {
  return opportunity.probability !== null;
}

/** Valore ponderato sulla probabilità, per le previsioni di chiusura. */
export function weightedValue(opportunity: CrmOpportunity): number {
  return opportunity.value * (effectiveProbability(opportunity) / 100);
}

/** Totale delle voci: quantità per prezzo unitario. */
function totalOfItems(items: CrmOpportunityItem[] = []): number {
  return items.reduce((sum, item) => sum + (item.quantity || 0) * (item.unitPrice || 0), 0);
}

function byOrder(a: CrmOpportunity, b: CrmOpportunity) {
  return a.order - b.order;
}

export async function getOpportunities(projectId: string, includeArchived = false) {
  const items = await getRecords(COLLECTION_NAME, projectId, mapOpportunity, { includeArchived });
  return items.sort(byOrder);
}

export function subscribeToOpportunities(
  projectId: string,
  callback: (opportunities: CrmOpportunity[]) => void,
  includeArchived = false
) {
  return subscribeToRecords(
    COLLECTION_NAME, projectId, mapOpportunity,
    (items) => callback(items.sort(byOrder)),
    { includeArchived }
  );
}

export function getOpportunityById(id: string) {
  return getRecordById(COLLECTION_NAME, id, mapOpportunity);
}

export function subscribeToOpportunity(id: string, callback: (o: CrmOpportunity | null) => void) {
  return subscribeToRecord(COLLECTION_NAME, id, mapOpportunity, callback);
}

export interface CreateOpportunityInput {
  title: string;
  description?: string;
  /** Uno dei due è obbligatorio, come richiede la specifica. */
  customerId?: string;
  leadId?: string;
  ownerUid?: string;
  value?: number;
  currency?: string;
  expectedCloseDate?: string;
  items?: CrmOpportunityItem[];
  notes?: string;
  order?: number;
}

export async function createOpportunity(ctx: CrmContextRef, input: CreateOpportunityInput) {
  if (!input.customerId && !input.leadId) {
    console.error('Opportunità senza cliente né lead: rifiutata');
    return null;
  }

  const id = await createRecord(COLLECTION_NAME, ctx, {
    title: input.title || 'Opportunità senza titolo',
    description: input.description || '',
    customerId: input.customerId || '',
    leadId: input.leadId || '',
    ownerUid: input.ownerUid || ctx.uid,
    // Con delle voci il valore è la loro somma, sempre: `value` resta la sola
    // fonte per i totali della pagina e non deve poter divergere.
    value: (input.items || []).length > 0 ? totalOfItems(input.items) : (input.value || 0),
    currency: input.currency || 'EUR',
    phase: 'QUALIFICATION' as OpportunityPhase,
    probability: null,
    expectedCloseDate: input.expectedCloseDate || '',
    closedAt: null,
    lostReason: '',
    items: input.items || [],
    changeLog: [],
    notes: input.notes || '',
    order: input.order || 0,
  });

  if (id) await writeAudit(ctx, 'opportunity.created', 'opportunity', id, null, { title: input.title });
  return id;
}

/** Aggiunge una voce alla cronologia delle modifiche richiesta dalla specifica. */
function appendChange(current: CrmOpportunity, uid: string, field: string, from: any, to: any) {
  return [
    ...current.changeLog,
    { at: new Date().toISOString(), by: uid, field, from: from ?? null, to: to ?? null },
  ];
}

export async function updateOpportunity(
  ctx: CrmContextRef,
  id: string,
  updates: Partial<CrmOpportunity>
): Promise<void> {
  const current = await getOpportunityById(id);
  if (!current) return;

  const payload: Record<string, any> = { ...updates };
  // La fase si cambia da changeOpportunityPhase, che valida la transizione.
  delete payload.phase;

  // Il valore resta allineato alle voci: se ci sono, comanda la loro somma.
  if (payload.items !== undefined) {
    payload.value = payload.items.length > 0 ? totalOfItems(payload.items) : (payload.value ?? current.value);
  }

  let changeLog = current.changeLog;
  ['value', 'probability', 'expectedCloseDate', 'ownerUid', 'title'].forEach(field => {
    if (payload[field] !== undefined && payload[field] !== (current as any)[field]) {
      changeLog = appendChange({ ...current, changeLog }, ctx.uid, field, (current as any)[field], payload[field]);
    }
  });

  // Le voci si registrano come totale e numero di righe: l'array intero
  // renderebbe la cronologia illeggibile senza dire di più.
  if (payload.items !== undefined) {
    const summarize = (items: CrmOpportunityItem[]) => ({
      count: items.length,
      total: items.reduce((sum, item) => sum + (item.quantity || 0) * (item.unitPrice || 0), 0),
    });
    const before = summarize(current.items);
    const after = summarize(payload.items);
    if (before.count !== after.count || before.total !== after.total) {
      changeLog = appendChange({ ...current, changeLog }, ctx.uid, 'items', before, after);
    }
  }

  payload.changeLog = changeLog;

  await updateRecord(COLLECTION_NAME, id, payload, ctx.uid);
  await writeAudit(ctx, 'opportunity.updated', 'opportunity', id, null, updates);
}

export class InvalidPhaseError extends Error {
  constructor(public from: string, public to: string) {
    super(`Passaggio di fase non ammesso: ${from} → ${to}`);
    this.name = 'InvalidPhaseError';
  }
}

export async function changeOpportunityPhase(
  ctx: CrmContextRef,
  id: string,
  to: OpportunityPhase,
  options: { lostReason?: string; order?: number } = {}
): Promise<void> {
  const current = await getOpportunityById(id);
  if (!current) return;

  if (!canTransition(OPPORTUNITY_TRANSITIONS, current.phase, to)) {
    throw new InvalidPhaseError(current.phase, to);
  }
  if (current.phase === to) return;

  const payload: Record<string, any> = {
    phase: to,
    changeLog: appendChange(current, ctx.uid, 'phase', current.phase, to),
  };
  if (options.order !== undefined) payload.order = options.order;
  if (to === 'WON' || to === 'LOST') {
    payload.closedAt = new Date().toISOString();
    if (to === 'LOST') payload.lostReason = options.lostReason || '';
  }

  await updateRecord(COLLECTION_NAME, id, payload, ctx.uid);
  await writeAudit(ctx, 'opportunity.phase_changed', 'opportunity', id,
    { phase: current.phase }, { phase: to });
}

export async function archiveOpportunity(ctx: CrmContextRef, id: string) {
  await archiveRecord(COLLECTION_NAME, id, ctx.uid);
  await writeAudit(ctx, 'opportunity.archived', 'opportunity', id);
}

export async function restoreOpportunity(ctx: CrmContextRef, id: string) {
  await restoreRecord(COLLECTION_NAME, id, ctx.uid);
  await writeAudit(ctx, 'opportunity.restored', 'opportunity', id);
}

/**
 * Riscrive la posizione delle opportunità di una colonna, nell'ordine dato.
 *
 * Serve al trascinamento sulla lavagna: la posizione è una preferenza di chi
 * guarda, non un dato commerciale, quindi NON finisce nella cronologia delle
 * modifiche — che resta leggibile per i cambi che contano.
 */
export async function reorderOpportunities(
  ctx: CrmContextRef,
  orderedIds: string[]
): Promise<void> {
  if (orderedIds.length === 0) return;

  try {
    const batch = writeBatch(db);
    orderedIds.forEach((id, index) => {
      batch.update(doc(db, COLLECTION_NAME, id), {
        order: index,
        updatedAt: serverTimestamp(),
        updatedBy: ctx.uid,
        version: increment(1),
      });
    });
    await batch.commit();
  } catch (error) {
    console.error('Error reordering CRM opportunities:', error);
  }
}
/**
 * Filtri, ordinamento, paginazione e totali delle opportunità.
 *
 * Funzioni pure come gli altri moduli di filtro: nessun Firestore, nessun
 * React. Stesso limite dichiarato altrove: tutto gira nel browser
 * sull'insieme completo del progetto (deroga 2).
 */


// ---------------------------------------------------------------- valori

/** Totale delle voci: quantità per prezzo unitario. */
export function itemsTotal(items: CrmOpportunityItem[]): number {
  return items.reduce((sum, item) => sum + (item.quantity || 0) * (item.unitPrice || 0), 0);
}

/**
 * Il valore è calcolato dalle voci quando ce ne sono, altrimenti è quello
 * scritto a mano. La specifica vuole i dati calcolati distinti da quelli
 * inseriti: qui la distinzione è visibile, non nascosta in un totale unico.
 */
export function hasComputedValue(opportunity: { items: CrmOpportunityItem[] }): boolean {
  return (opportunity.items || []).length > 0;
}

export function effectiveValue(opportunity: CrmOpportunity): number {
  return hasComputedValue(opportunity) ? itemsTotal(opportunity.items) : opportunity.value;
}

export function effectiveProbabilityOf(opportunity: CrmOpportunity): number {
  return opportunity.probability !== null
    ? opportunity.probability
    : OPPORTUNITY_PHASE_PROBABILITY[opportunity.phase];
}

export function weightedValueOf(opportunity: CrmOpportunity): number {
  return effectiveValue(opportunity) * (effectiveProbabilityOf(opportunity) / 100);
}

/** Aperte = non ancora chiuse. Sono quelle che contano per la previsione. */
export function isOpen(opportunity: CrmOpportunity): boolean {
  return opportunity.phase !== 'WON' && opportunity.phase !== 'LOST';
}

// ---------------------------------------------------------------- filtri

export type CloseFilter = 'any' | 'overdue' | 'thisMonth' | 'nextMonth' | 'missing';

export interface OpportunityFilters {
  search: string;
  phases: OpportunityPhase[];
  ownerUids: string[];
  /** Limita a una sola controparte, cliente o lead. */
  counterpartyId: string;
  minValue: number | null;
  maxValue: number | null;
  close: CloseFilter;
  /** Solo quelle con probabilità impostata a mano. */
  onlyManualProbability: boolean;
  includeArchived: boolean;
  /** Le chiuse sono escluse di default: affollano senza aggiungere nulla. */
  includeClosed: boolean;
}

export const EMPTY_OPPORTUNITY_FILTERS: OpportunityFilters = {
  search: '',
  phases: [],
  ownerUids: [],
  counterpartyId: '',
  minValue: null,
  maxValue: null,
  close: 'any',
  onlyManualProbability: false,
  includeArchived: false,
  includeClosed: true,
};

export function countOpportunityFilters(filters: OpportunityFilters): number {
  let count = 0;
  if (filters.search.trim()) count++;
  if (filters.phases.length) count++;
  if (filters.ownerUids.length) count++;
  if (filters.counterpartyId) count++;
  if (filters.minValue !== null || filters.maxValue !== null) count++;
  if (filters.close !== 'any') count++;
  if (filters.onlyManualProbability) count++;
  if (filters.includeArchived) count++;
  if (filters.includeClosed) count++;
  return count;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

function monthBounds(offset: number): [string, string] {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset + 1, 0));
  return [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)];
}

function matchesClose(opportunity: CrmOpportunity, filter: CloseFilter): boolean {
  const date = (opportunity.expectedCloseDate || '').slice(0, 10);
  switch (filter) {
    case 'missing':   return !date;
    // Una chiusura scaduta conta solo se l'opportunità è ancora aperta:
    // su una già vinta o persa non è un ritardo.
    case 'overdue':   return !!date && date < todayISO() && isOpen(opportunity);
    case 'thisMonth': { const [from, to] = monthBounds(0); return !!date && date >= from && date <= to; }
    case 'nextMonth': { const [from, to] = monthBounds(1); return !!date && date >= from && date <= to; }
    default:          return true;
  }
}

export interface OpportunityContext {
  /** Nome della controparte per id (cliente o lead): la ricerca lo usa. */
  counterpartyNameById: Map<string, string>;
}

export function applyOpportunityFilters(
  opportunities: CrmOpportunity[],
  filters: OpportunityFilters,
  context: OpportunityContext
): CrmOpportunity[] {
  const needle = filters.search.trim().toLowerCase();

  return opportunities.filter(opportunity => {
    if (!filters.includeArchived && opportunity.archived) return false;
    // Un filtro esplicito su una fase chiusa vince sul nascondere le chiuse.
    if (!filters.includeClosed && !isOpen(opportunity) && !filters.phases.includes(opportunity.phase)) return false;
    if (filters.phases.length > 0 && !filters.phases.includes(opportunity.phase)) return false;
    if (filters.ownerUids.length > 0 && !filters.ownerUids.includes(opportunity.ownerUid)) return false;

    if (filters.counterpartyId) {
      const id = opportunity.customerId || opportunity.leadId;
      if (id !== filters.counterpartyId) return false;
    }

    const value = effectiveValue(opportunity);
    if (filters.minValue !== null && value < filters.minValue) return false;
    if (filters.maxValue !== null && value > filters.maxValue) return false;

    if (filters.onlyManualProbability && opportunity.probability === null) return false;
    if (!matchesClose(opportunity, filters.close)) return false;

    if (needle) {
      const counterparty =
        context.counterpartyNameById.get(opportunity.customerId || opportunity.leadId) || '';
      const haystack = [
        opportunity.title, opportunity.description, opportunity.notes, counterparty,
        ...opportunity.items.map(item => item.name),
      ].join(' ').toLowerCase();
      if (!haystack.includes(needle)) return false;
    }

    return true;
  });
}

// ----------------------------------------------------------- ordinamento

export type OpportunitySortField =
  'title' | 'value' | 'weighted' | 'phase' | 'expectedCloseDate' | 'updatedAt';

export interface OpportunitySort {
  field: OpportunitySortField;
  direction: 'asc' | 'desc';
}

export const DEFAULT_OPPORTUNITY_SORT: OpportunitySort = { field: 'value', direction: 'desc' };

const PHASE_ORDER: Record<OpportunityPhase, number> = {
  QUALIFICATION: 0, DISCOVERY: 1, PROPOSAL: 2, NEGOTIATION: 3, WON: 4, LOST: 5,
};

export function applyOpportunitySort(
  opportunities: CrmOpportunity[],
  sort: OpportunitySort
): CrmOpportunity[] {
  const factor = sort.direction === 'asc' ? 1 : -1;

  return [...opportunities].sort((a, b) => {
    switch (sort.field) {
      case 'title':    return a.title.localeCompare(b.title, 'it') * factor;
      case 'value':    return (effectiveValue(a) - effectiveValue(b)) * factor;
      case 'weighted': return (weightedValueOf(a) - weightedValueOf(b)) * factor;
      case 'phase':    return (PHASE_ORDER[a.phase] - PHASE_ORDER[b.phase]) * factor;
      case 'expectedCloseDate': {
        const dateA = (a.expectedCloseDate || '').slice(0, 10);
        const dateB = (b.expectedCloseDate || '').slice(0, 10);
        // Senza data di chiusura si va in fondo in entrambi i versi: è
        // un'assenza di dato, non una data lontanissima.
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;
        return dateA.localeCompare(dateB) * factor;
      }
      case 'updatedAt':
      default:         return (toMillis(a.updatedAt) - toMillis(b.updatedAt)) * factor;
    }
  });
}

export function buildOpportunityView(
  opportunities: CrmOpportunity[],
  filters: OpportunityFilters,
  sort: OpportunitySort,
  page: number,
  pageSize: number,
  context: OpportunityContext
): Page<CrmOpportunity> {
  return paginate(
    applyOpportunitySort(applyOpportunityFilters(opportunities, filters, context), sort),
    page,
    pageSize
  );
}

// --------------------------------------------------------------- totali

export interface PhaseSummary {
  phase: OpportunityPhase;
  items: CrmOpportunity[];
  count: number;
  value: number;
  weighted: number;
}

/**
 * Le opportunità divise per fase, nell'ordine della pipeline. Dentro ogni fase
 * vale `order`, che è quello che l'utente stabilisce trascinando le schede.
 */
export function groupByPhase(opportunities: CrmOpportunity[]): PhaseSummary[] {
  return OPPORTUNITY_PHASES.map(phase => {
    const items = opportunities
      .filter(opportunity => opportunity.phase === phase)
      .sort((a, b) => (a.order - b.order) || (effectiveValue(b) - effectiveValue(a)));

    return {
      phase,
      items,
      count: items.length,
      value: items.reduce((sum, item) => sum + effectiveValue(item), 0),
      weighted: items.reduce((sum, item) => sum + weightedValueOf(item), 0),
    };
  });
}

export interface PipelineTotals {
  open: number;
  openValue: number;
  forecast: number;
  wonValue: number;
  lostValue: number;
}

export function pipelineTotals(opportunities: CrmOpportunity[]): PipelineTotals {
  const live = opportunities.filter(o => !o.archived);
  const open = live.filter(isOpen);

  return {
    open: open.length,
    openValue: open.reduce((sum, o) => sum + effectiveValue(o), 0),
    forecast: open.reduce((sum, o) => sum + weightedValueOf(o), 0),
    wonValue: live.filter(o => o.phase === 'WON').reduce((sum, o) => sum + effectiveValue(o), 0),
    lostValue: live.filter(o => o.phase === 'LOST').reduce((sum, o) => sum + effectiveValue(o), 0),
  };
}

export const CLOSE_FILTER_LABELS: Record<CloseFilter, string> = {
  any: 'Qualsiasi chiusura',
  overdue: 'Chiusura scaduta',
  thisMonth: 'Chiude questo mese',
  nextMonth: 'Chiude il mese prossimo',
  missing: 'Senza data di chiusura',
};
