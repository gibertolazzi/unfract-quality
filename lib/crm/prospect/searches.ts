/**
 * Il registro delle ricerche.
 *
 * Ogni ricerca lascia una riga: cosa è stato cercato, da chi, quando, con che
 * esito e **quante operazioni a pagamento ha consumato**. Da qui esce il
 * conteggio che il tetto di spesa confronta con il budget del mese.
 */

import { CrmProspectSearch, SearchCandidate } from '@/types/prospect';
import {
  SearchKind, SearchState, SEARCH_TRANSITIONS, SEARCH_STATE_LABELS,
  BilledOperation,
} from '@/components/crm/ricerca/constants';
import { canTransition } from '@/components/crm/constants';
import {
  CrmContextRef, createRecord, updateRecord, getRecords, subscribeToRecords,
  mapBase, byCreatedAtDesc, toMillis,
} from '../base';
import { writeAudit } from '../audit';
import { PROSPECT_COLLECTIONS, nowIso } from './base';
import { BudgetUsage, budgetPeriod, sumUsage } from './budget';

const COLLECTION_NAME = PROSPECT_COLLECTIONS.searches;

function mapSearch(id: string, data: any): CrmProspectSearch {
  return {
    ...mapBase(id, data),
    input: data.input || '',
    kind: data.kind || 'name',
    state: data.state || 'PENDING',
    profileId: data.profileId || '',
    candidates: Array.isArray(data.candidates) ? data.candidates : [],
    billed: data.billed && typeof data.billed === 'object' ? data.billed : {},
    startedAt: data.startedAt || '',
    finishedAt: data.finishedAt || '',
    outcome: data.outcome || '',
  };
}

export class InvalidSearchTransitionError extends Error {
  constructor(from: SearchState, to: SearchState) {
    super(`Da «${SEARCH_STATE_LABELS[from]}» non si passa a «${SEARCH_STATE_LABELS[to]}»`);
    this.name = 'InvalidSearchTransitionError';
  }
}

export async function createSearch(
  ctx: CrmContextRef,
  input: string,
  kind: SearchKind
): Promise<string | null> {
  const id = await createRecord(COLLECTION_NAME, ctx, {
    input: String(input || '').slice(0, 300),
    kind,
    state: 'PENDING' as SearchState,
    profileId: '',
    candidates: [],
    billed: {},
    startedAt: nowIso(),
    finishedAt: '',
    outcome: '',
  }, 'integration');

  if (id) await writeAudit(ctx, 'prospect.search_started', 'prospect_search', id, null, { input, kind });
  return id;
}

async function getSearchById(projectId: string, id: string): Promise<CrmProspectSearch | null> {
  const tutte = await getRecords<CrmProspectSearch>(COLLECTION_NAME, projectId, mapSearch, { includeArchived: true });
  return tutte.find(s => s.id === id) || null;
}

/**
 * Cambia lo stato validando la transizione, come ovunque nel CRM: un salto non
 * previsto viene rifiutato, non corretto in silenzio.
 */
export async function setSearchState(
  ctx: CrmContextRef,
  id: string,
  to: SearchState,
  outcome = ''
): Promise<void> {
  const ricerca = await getSearchById(ctx.projectId, id);
  if (!ricerca) {
    console.error('Ricerca non trovata:', id);
    return;
  }
  if (!canTransition(SEARCH_TRANSITIONS, ricerca.state, to)) {
    throw new InvalidSearchTransitionError(ricerca.state, to);
  }
  if (ricerca.state === to) return;

  const payload: Record<string, any> = { state: to, outcome };
  if (to === 'DONE' || to === 'PARTIAL' || to === 'FAILED') payload.finishedAt = nowIso();

  await updateRecord(COLLECTION_NAME, id, payload, ctx.uid);
  await writeAudit(ctx, 'prospect.search_state_changed', 'prospect_search', id,
    { state: ricerca.state }, { state: to, outcome });
}

export async function attachProfile(ctx: CrmContextRef, id: string, profileId: string): Promise<void> {
  await updateRecord(COLLECTION_NAME, id, { profileId }, ctx.uid);
}

export async function setCandidates(ctx: CrmContextRef, id: string, candidates: SearchCandidate[]): Promise<void> {
  await updateRecord(COLLECTION_NAME, id, { candidates }, ctx.uid);
}

/**
 * Segna quale candidato è stato scelto, e restituisce quello scelto.
 *
 * La scelta resta scritta anche quando poi non porta a niente: fra sei mesi,
 * davanti a una scheda sbagliata, la domanda è «chi ha scelto questo nome, e
 * fra quali altri» — e senza questa riga non ha risposta.
 */
export async function markCandidateChosen(
  ctx: CrmContextRef,
  id: string,
  refId: string
): Promise<SearchCandidate | null> {
  const ricerca = await getSearchById(ctx.projectId, id);
  if (!ricerca) return null;

  const scelto = ricerca.candidates.find(c => c.refId === refId) || null;
  if (!scelto) return null;

  const aggiornati = ricerca.candidates.map(c => ({ ...c, chosen: c.refId === refId }));
  await updateRecord(COLLECTION_NAME, id, { candidates: aggiornati }, ctx.uid);
  await writeAudit(ctx, 'prospect.candidate_chosen', 'prospect_search', id, null,
    { refId, name: scelto.name, fra: ricerca.candidates.length });

  return { ...scelto, chosen: true };
}

/**
 * Annota un'operazione a pagamento **appena consumata**.
 *
 * Si scrive dopo la chiamata, non prima: contare in anticipo farebbe pagare
 * anche i tentativi che non sono mai partiti. Il rischio opposto — una
 * chiamata fatta e non contata perché la scrittura fallisce — è più raro e
 * meno grave di un budget che si consuma da solo.
 */
export async function recordBilled(
  ctx: CrmContextRef,
  id: string,
  operation: BilledOperation,
  quante = 1
): Promise<void> {
  const ricerca = await getSearchById(ctx.projectId, id);
  if (!ricerca) return;
  const billed = { ...ricerca.billed };
  billed[operation] = (billed[operation] || 0) + quante;
  await updateRecord(COLLECTION_NAME, id, { billed }, ctx.uid);
}

export async function getSearches(projectId: string): Promise<CrmProspectSearch[]> {
  const tutte = await getRecords<CrmProspectSearch>(COLLECTION_NAME, projectId, mapSearch);
  return tutte.sort(byCreatedAtDesc);
}

export function subscribeToSearches(projectId: string, callback: (s: CrmProspectSearch[]) => void) {
  return subscribeToRecords<CrmProspectSearch>(COLLECTION_NAME, projectId, mapSearch,
    ricerche => callback(ricerche.sort(byCreatedAtDesc)));
}

/** Le ricerche del mese indicato (`AAAA-MM`), archiviate comprese: hanno speso lo stesso. */
export function searchesInPeriod(searches: CrmProspectSearch[], period: string): CrmProspectSearch[] {
  return searches.filter(s => {
    const quando = toMillis(s.createdAt);
    if (!quando) return false;
    return budgetPeriod(new Date(quando)) === period;
  });
}

/** Il consumo del mese, da confrontare con il budget. */
export async function monthlyUsage(projectId: string, when: Date = new Date()): Promise<BudgetUsage> {
  const tutte = await getRecords<CrmProspectSearch>(COLLECTION_NAME, projectId, mapSearch, { includeArchived: true });
  return sumUsage(searchesInPeriod(tutte, budgetPeriod(when)).map(s => s.billed));
}
