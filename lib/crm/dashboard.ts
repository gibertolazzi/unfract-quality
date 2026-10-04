/**
 * I dati del riepilogo, calcolati qui e non nei componenti.
 *
 * La specifica chiede una cosa precisa su questa pagina: «ogni widget deve
 * rispettare gli stessi permessi dei dati sorgente e indicare quando il
 * risultato è parziale o calcolato su dati incompleti». Per questo ogni
 * funzione restituisce, insieme ai numeri, un elenco di `notes`: sono le
 * avvertenze da mostrare **accanto al numero**, non in fondo alla pagina o
 * nella documentazione. Un numero che nasconde di essere incompleto è peggio
 * di un numero assente.
 *
 * Sui permessi: qui si legge quello che il contesto CRM ha già caricato per il
 * progetto attivo, cioè esattamente i dati che l'utente può già vedere nelle
 * altre schede. Nessun widget allarga la visibilità; nessuno la restringe
 * (la visibilità per ruolo non è imposta da nessuna parte — vedi DEROGHE.md).
 */

import {
  CrmLead, CrmAccount, CrmCustomer, CrmOpportunity, CrmFollowup,
  CrmInteraction, CrmCommunication, CrmDocument,
} from '@/types/crm';
import { LeadState, LEAD_STATES, LEAD_STATE_COLORS, EmailState, FollowupState, FollowupType, OpportunityPhase } from '@/components/crm/constants';
import { toMillis } from './helpers';
import { effectiveDue, isOpen as followupIsOpen } from './followupFilters';
import {
  PhaseSummary, PipelineTotals, groupByPhase, pipelineTotals,
  isOpen as opportunityIsOpen, effectiveValue,
} from './opportunityFilters';
import { buildTimeline, TimelineEntry, TimelineSources } from './timeline';

export const todayISO = () => new Date().toISOString().slice(0, 10);

const addDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

/** Ogni widget porta con sé le proprie avvertenze. */
export interface Widget<T> {
  data: T;
  notes: string[];
}

const live = <T extends { archived: boolean }>(records: T[]) => records.filter(r => !r.archived);

// ------------------------------------------------------- lead per stato

export interface StateSlice {
  state: LeadState;
  label: string;
  color: string;
  count: number;
  /** Quota sul totale, 0-1. Serve alla barra, non si ricalcola nel componente. */
  share: number;
}

export function leadsByState(leads: CrmLead[]): Widget<StateSlice[]> {
  const records = live(leads);
  const total = records.length;

  const data = LEAD_STATES.map(state => {
    const count = records.filter(lead => lead.state === state).length;
    return {
      state,
      label: ({} as any)[state],
      color: LEAD_STATE_COLORS[state],
      count,
      share: total ? count / total : 0,
    };
  });

  const notes: string[] = [];
  const archived = leads.length - total;
  if (archived > 0) {
    notes.push(archived === 1
      ? 'Un lead archiviato non è conteggiato.'
      : `${archived} lead archiviati non sono conteggiati.`);
  }

  return { data, notes };
}

// ------------------------------------------------ opportunità per fase

export interface PipelineWidget {
  phases: PhaseSummary[];
  totals: PipelineTotals;
  /** Quante opportunità usano una probabilità scritta a mano. */
  manualProbability: number;
  /** Quante hanno il valore calcolato dalle righe invece che digitato. */
  computedValue: number;
  maxValue: number;
}

export function pipelineOverview(opportunities: CrmOpportunity[]): Widget<PipelineWidget> {
  const records = live(opportunities);
  const phases = groupByPhase(records);
  const totals = pipelineTotals(opportunities);
  const open = records.filter(opportunityIsOpen);

  const manualProbability = open.filter(o => o.probability !== null).length;
  const computedValue = records.filter(o => o.items.length > 0).length;

  const notes: string[] = [];
  if (open.length > 0) {
    notes.push(
      manualProbability === 0
        ? 'Previsione calcolata solo sulle probabilità suggerite dalla fase: nessuna è stata scritta a mano.'
        : `Previsione mista: ${manualProbability} opportunità su ${open.length} ${manualProbability === 1 ? 'usa' : 'usano'} una probabilità scritta a mano, le altre quella suggerita dalla fase.`
    );
  }
  const noDate = open.filter(o => !o.expectedCloseDate).length;
  if (noDate > 0) {
    notes.push(noDate === 1
      ? 'Un’opportunità aperta non ha una data di chiusura prevista.'
      : `${noDate} opportunità aperte non hanno una data di chiusura prevista.`);
  }

  return {
    data: {
      phases,
      totals,
      manualProbability,
      computedValue,
      maxValue: Math.max(1, ...phases.map(phase => phase.value)),
    },
    notes,
  };
}

// ------------------------------------------------------------ follow-up

export interface FollowupWidget {
  overdue: CrmFollowup[];
  today: CrmFollowup[];
  next: CrmFollowup[];
  unassigned: CrmFollowup[];
}

export function followupBoard(followups: CrmFollowup[], days = 7): Widget<FollowupWidget> {
  const open = live(followups).filter(followupIsOpen);
  const today = todayISO();
  const limit = addDays(days);

  const data: FollowupWidget = {
    overdue: open.filter(f => effectiveDue(f) && effectiveDue(f) < today),
    today: open.filter(f => effectiveDue(f) === today),
    next: open.filter(f => effectiveDue(f) > today && effectiveDue(f) <= limit),
    unassigned: open.filter(f => !f.assigneeUid),
  };

  const notes: string[] = [];
  const undated = open.filter(f => !effectiveDue(f)).length;
  if (undated > 0) {
    notes.push(undated === 1
      ? 'Un follow-up aperto è senza scadenza: non compare in nessuna delle colonne.'
      : `${undated} follow-up aperti sono senza scadenza: non compaiono in nessuna delle colonne.`);
  }
  if (data.overdue.length > 0) {
    notes.push('I rimandati contano la data di rinvio, non quella originale.');
  }

  return { data, notes };
}

// ------------------------------- chiamate e meeting commerciali imminenti

export interface UpcomingContact {
  followup: CrmFollowup;
  due: string;
  typeLabel: string;
}

const CONTACT_TYPES: FollowupType[] = ['call', 'meeting'];

export function upcomingContacts(followups: CrmFollowup[], days = 14): Widget<UpcomingContact[]> {
  const today = todayISO();
  const limit = addDays(days);

  const data = live(followups)
    .filter(followupIsOpen)
    .filter(f => CONTACT_TYPES.includes(f.type))
    .map(f => ({ followup: f, due: effectiveDue(f), typeLabel: ({} as any)[f.type] }))
    .filter(row => row.due && row.due >= today && row.due <= limit)
    .sort((a, b) => a.due.localeCompare(b.due));

  // La specifica chiede «chiamate e meeting commerciali imminenti». Questi
  // sono i follow-up di tipo chiamata o meeting: i meeting veri del prodotto
  // (calendario, partecipanti, registrazione) sono un modulo a parte che il
  // CRM non legge. Va detto qui, non scoperto dopo.
  const notes = [
    'Contiene i follow-up di tipo chiamata o meeting. Gli eventi del calendario del prodotto non sono compresi.',
  ];

  return { data, notes };
}

// ------------------------------------------------- conversioni lead → cliente

export interface ConversionMonth {
  /** `YYYY-MM`. */
  month: string;
  label: string;
  count: number;
}

export function conversionTrend(leads: CrmLead[], months = 6): Widget<ConversionMonth[]> {
  const converted = live(leads).filter(lead => lead.state === 'CONVERTED');

  const buckets: ConversionMonth[] = [];
  const cursor = new Date();
  cursor.setDate(1);
  for (let index = 0; index < months; index++) {
    const month = cursor.toISOString().slice(0, 7);
    buckets.unshift({
      month,
      label: cursor.toLocaleDateString('it-IT', { month: 'short', year: '2-digit' }),
      count: 0,
    });
    cursor.setMonth(cursor.getMonth() - 1);
  }

  let undated = 0;
  let outside = 0;

  converted.forEach(lead => {
    const at = toMillis(lead.convertedAt) || toMillis(lead.updatedAt);
    if (!lead.convertedAt) undated++;
    if (!at) return;

    const month = new Date(at).toISOString().slice(0, 7);
    const bucket = buckets.find(b => b.month === month);
    if (bucket) bucket.count++;
    else outside++;
  });

  const notes: string[] = [];
  if (undated > 0) {
    notes.push(undated === 1
      ? 'Un lead convertito non ha la data di conversione: contato sulla data di ultima modifica.'
      : `${undated} lead convertiti non hanno la data di conversione: contati sulla data di ultima modifica.`);
  }
  if (outside > 0) notes.push(`${outside} conversioni sono precedenti ai mesi mostrati.`);

  return { data: buckets, notes };
}

// ------------------------------------------- attività commerciali recenti

export function recentActivity(sources: TimelineSources, limit = 8): Widget<TimelineEntry[]> {
  const timeline = buildTimeline(sources, {}, {
    kinds: ['interaction', 'followup', 'communication', 'document'],
    includeArchived: false,
    scope: 'project',
  });

  const notes: string[] = [];
  if (timeline.past.length > limit) {
    notes.push(`Mostrate le ultime ${limit} di ${timeline.past.length} attività.`);
  }

  return { data: timeline.past.slice(0, limit), notes };
}

// --------------------------------------------------------- comunicazioni

export interface CommunicationOutcome {
  state: EmailState;
  label: string;
  count: number;
}

/** Gli stati che il primo rilascio può davvero raggiungere. */
const REACHABLE_STATES: EmailState[] = ['DRAFT', 'QUEUED', 'SENT', 'FAILED', 'CANCELLED'];

/** Raggiungibili solo con i webhook del provider: mostrati se esistono lo stesso. */
const WEBHOOK_STATES: EmailState[] = ['DELIVERED', 'BOUNCED'];

export function communicationOutcomes(communications: CrmCommunication[]): Widget<CommunicationOutcome[]> {
  const records = live(communications);
  const countOf = (state: EmailState) => records.filter(record => record.state === state).length;

  const data = [
    ...REACHABLE_STATES,
    // Non si nascondono a prescindere: se un giorno i webhook arriveranno,
    // queste email devono comparire senza che nessuno debba ricordarsi di
    // togliere un filtro da qui.
    ...WEBHOOK_STATES.filter(state => countOf(state) > 0),
  ].map(state => ({ state, label: ({} as any)[state], count: countOf(state) }));

  // La specifica chiede «inviate, consegnate e fallite». «Consegnata» e
  // «respinta» arrivano dai webhook del provider, cioè da una route pubblica
  // che la deroga 2 esclude: mostrarle a zero farebbe credere che nessuna
  // email arriva a destinazione. Se non ce ne sono si dice perché mancano.
  const withWebhookStates = data.some(row => WEBHOOK_STATES.includes(row.state));
  const notes = [
    withWebhookStates
      ? '«Inviata» significa accettata dal provider, non recapitata.'
      : 'Consegnate e respinte non compaiono: richiedono i webhook del provider, fuori dal primo rilascio. «Inviata» significa accettata dal provider, non recapitata.',
  ];

  const failed = data.find(row => row.state === 'FAILED');
  if (failed && failed.count > 0) {
    notes.push(failed.count === 1 ? 'Un invio fallito da riprendere.' : `${failed.count} invii falliti da riprendere.`);
  }

  return { data, notes };
}

// ------------------------------------------------------- clienti recenti

export interface RecentCustomer {
  customer: CrmCustomer;
  name: string;
  since: number;
}

export function recentCustomers(
  customers: CrmCustomer[],
  accounts: CrmAccount[],
  limit = 5
): Widget<RecentCustomer[]> {
  const data = live(customers)
    .map(customer => ({
      customer,
      name: accounts.find(a => a.id === customer.accountId)?.displayName || 'Cliente senza azienda',
      since: toMillis(customer.customerSince) || toMillis(customer.createdAt),
    }))
    .sort((a, b) => b.since - a.since)
    .slice(0, limit);

  const orphans = live(customers).filter(c => !accounts.some(a => a.id === c.accountId)).length;
  const notes = orphans > 0
    ? [orphans === 1
        ? 'Un cliente non ha un’azienda collegata.'
        : `${orphans} clienti non hanno un’azienda collegata.`]
    : [];

  return { data, notes };
}

// ------------------------------- opportunità senza una prossima azione

export interface StaleOpportunity {
  opportunity: CrmOpportunity;
  value: number;
  /** Giorni dall'ultima attività registrata, -1 se non ce n'è mai stata. */
  idleDays: number;
}

/**
 * «Opportunità prive di una prossima azione»: aperte, senza un follow-up
 * ancora da fare. Si aggiunge da quanto tempo non succede niente, perché
 * un'opportunità ferma da due mesi e una di ieri non sono lo stesso problema.
 */
export function opportunitiesWithoutNextAction(
  opportunities: CrmOpportunity[],
  followups: CrmFollowup[],
  interactions: CrmInteraction[]
): Widget<StaleOpportunity[]> {
  const openFollowups = live(followups).filter(followupIsOpen);
  const now = Date.now();

  const data = live(opportunities)
    .filter(opportunityIsOpen)
    .filter(opportunity => !openFollowups.some(f => f.opportunityId === opportunity.id))
    .map(opportunity => {
      const last = Math.max(
        0,
        ...live(interactions)
          .filter(i => i.opportunityId === opportunity.id)
          .map(i => toMillis(i.occurredAt) || toMillis(i.createdAt))
      );
      return {
        opportunity,
        value: effectiveValue(opportunity),
        idleDays: last ? Math.floor((now - last) / 86400000) : -1,
      };
    })
    .sort((a, b) => b.value - a.value);

  const notes: string[] = [];
  if (data.some(row => row.idleDays === -1)) {
    notes.push('«mai» significa che su quell’opportunità non è registrata nessuna interazione, non che non sia successo niente.');
  }

  return { data, notes };
}

// --------------------------------------------- widget non realizzabili

/**
 * Due widget della specifica non esistono in questo rilascio. Sono elencati
 * qui, e mostrati come mancanti nella pagina, invece di essere omessi in
 * silenzio: chi legge il riepilogo deve sapere cosa NON sta guardando.
 */
export const MISSING_WIDGETS: { title: string; reason: string }[] = [
  {
    title: 'Campagne in corso e risultati',
    reason: 'Non c’è un modulo campagne: né entità, né invii massivi. Fuori dal primo rilascio (deroga 3).',
  },
  {
    title: 'Stato di sincronizzazioni e invii',
    reason: 'Non ci sono integrazioni esterne da sincronizzare, e gli invii non hanno una coda da osservare: partono subito o falliscono subito (deroga 2).',
  },
];

// ------------------------------------------------------- pagina intera

export interface DashboardSources {
  leads: CrmLead[];
  accounts: CrmAccount[];
  customers: CrmCustomer[];
  opportunities: CrmOpportunity[];
  followups: CrmFollowup[];
  interactions: CrmInteraction[];
  communications: CrmCommunication[];
  documents: CrmDocument[];
}

export interface Dashboard {
  leadStates: Widget<StateSlice[]>;
  pipeline: Widget<PipelineWidget>;
  followups: Widget<FollowupWidget>;
  contacts: Widget<UpcomingContact[]>;
  conversions: Widget<ConversionMonth[]>;
  activity: Widget<TimelineEntry[]>;
  communications: Widget<CommunicationOutcome[]>;
  customers: Widget<RecentCustomer[]>;
  stale: Widget<StaleOpportunity[]>;
}

export function buildDashboard(sources: DashboardSources): Dashboard {
  return {
    leadStates: leadsByState(sources.leads),
    pipeline: pipelineOverview(sources.opportunities),
    followups: followupBoard(sources.followups),
    contacts: upcomingContacts(sources.followups),
    conversions: conversionTrend(sources.leads),
    activity: recentActivity({
      interactions: sources.interactions,
      followups: sources.followups,
      communications: sources.communications,
      documents: sources.documents,
    }),
    communications: communicationOutcomes(sources.communications),
    customers: recentCustomers(sources.customers, sources.accounts),
    stale: opportunitiesWithoutNextAction(
      sources.opportunities, sources.followups, sources.interactions
    ),
  };
}
