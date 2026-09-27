import {
  LeadState, OpportunityPhase, FollowupState, FollowupType, Priority,
  InteractionType, EmailState, RecordOrigin, ApprovalState, VisibilityLevel
} from '@/types/crm';

export type {
  LeadState, OpportunityPhase, FollowupState, FollowupType, Priority,
  InteractionType, EmailState, RecordOrigin, ApprovalState, VisibilityLevel
};

// Stati e transizioni del CRM.
// Sono imposti dalla specifica (docs/requisiti/specifica-crm.pdf) e NON sono
// configurabili dall'utente: vivono qui come costanti, non su Firestore.

// ---------------------------------------------------------------- Lead

export const LEAD_STATES = [
  'NEW', 'TO_CONTACT', 'CONTACTED', 'FOLLOWUP', 'QUALIFIED',
  'PROPOSAL_SENT', 'NEGOTIATION', 'CONVERTED', 'LOST', 'NOT_INTERESTED',
] as const;


/**
 * Transizioni ammesse. La specifica chiede «validazione dei cambi di stato».
 * CONVERTED, LOST e NOT_INTERESTED sono terminali: la specifica li definisce
 * tali e non prevede riapertura. Per riaprire un lead perso si crea un lead
 * nuovo, collegato al precedente.
 */
export const LEAD_TRANSITIONS: Record<LeadState, LeadState[]> = {
  NEW:            ['TO_CONTACT', 'LOST', 'NOT_INTERESTED'],
  TO_CONTACT:     ['CONTACTED', 'LOST', 'NOT_INTERESTED'],
  CONTACTED:      ['FOLLOWUP', 'QUALIFIED', 'LOST', 'NOT_INTERESTED'],
  FOLLOWUP:       ['CONTACTED', 'QUALIFIED', 'LOST', 'NOT_INTERESTED'],
  QUALIFIED:      ['PROPOSAL_SENT', 'LOST', 'NOT_INTERESTED'],
  PROPOSAL_SENT:  ['NEGOTIATION', 'LOST', 'NOT_INTERESTED'],
  NEGOTIATION:    ['CONVERTED', 'LOST', 'NOT_INTERESTED'],
  CONVERTED:      [],
  LOST:           [],
  NOT_INTERESTED: [],
};

export const LEAD_STATE_LABELS: Record<LeadState, string> = {
  NEW:            'Nuovo',
  TO_CONTACT:     'Da contattare',
  CONTACTED:      'Contattato',
  FOLLOWUP:       'In follow-up',
  QUALIFIED:      'Qualificato',
  PROPOSAL_SENT:  'Proposta inviata',
  NEGOTIATION:    'In negoziazione',
  CONVERTED:      'Convertito',
  LOST:           'Perso',
  NOT_INTERESTED: 'Non interessato',
};

export const LEAD_STATE_COLORS: Record<LeadState, string> = {
  NEW:            '#6B7280',
  TO_CONTACT:     '#0EA5E9',
  CONTACTED:      '#3B82F6',
  FOLLOWUP:       '#6366F1',
  QUALIFIED:      '#8B5CF6',
  PROPOSAL_SENT:  '#A855F7',
  NEGOTIATION:    '#F59E0B',
  CONVERTED:      '#10B981',
  LOST:           '#EF4444',
  NOT_INTERESTED: '#71717A',
};

// -------------------------------------------------------- Opportunità

export const OPPORTUNITY_PHASES = [
  'QUALIFICATION', 'DISCOVERY', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST',
] as const;


export const OPPORTUNITY_TRANSITIONS: Record<OpportunityPhase, OpportunityPhase[]> = {
  QUALIFICATION: ['DISCOVERY', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'],
  DISCOVERY:     ['QUALIFICATION', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'],
  PROPOSAL:      ['QUALIFICATION', 'DISCOVERY', 'NEGOTIATION', 'WON', 'LOST'],
  NEGOTIATION:   ['QUALIFICATION', 'DISCOVERY', 'PROPOSAL', 'WON', 'LOST'],
  WON:           ['QUALIFICATION', 'DISCOVERY', 'PROPOSAL', 'NEGOTIATION', 'LOST'],
  LOST:          ['QUALIFICATION', 'DISCOVERY', 'PROPOSAL', 'NEGOTIATION', 'WON'],
};

export const OPPORTUNITY_PHASE_LABELS: Record<OpportunityPhase, string> = {
  QUALIFICATION: 'Qualificazione',
  DISCOVERY:     'Analisi',
  PROPOSAL:      'Proposta',
  NEGOTIATION:   'Negoziazione',
  WON:           'Vinta',
  LOST:          'Persa',
};

export const OPPORTUNITY_PHASE_COLORS: Record<OpportunityPhase, string> = {
  QUALIFICATION: '#6B7280',
  DISCOVERY:     '#3B82F6',
  PROPOSAL:      '#8B5CF6',
  NEGOTIATION:   '#F59E0B',
  WON:           '#10B981',
  LOST:          '#EF4444',
};

/**
 * Probabilità SUGGERITA dalla fase. La specifica chiede che «i dati calcolati
 * restino distinti dai valori modificati manualmente»: questo valore non
 * sovrascrive mai `probability` se l'utente l'ha impostata a mano.
 */
export const OPPORTUNITY_PHASE_PROBABILITY: Record<OpportunityPhase, number> = {
  QUALIFICATION: 10,
  DISCOVERY:     25,
  PROPOSAL:      50,
  NEGOTIATION:   75,
  WON:           100,
  LOST:          0,
};

// ----------------------------------------------------------- Follow-up

export const FOLLOWUP_STATES = ['OPEN', 'IN_PROGRESS', 'DONE', 'SNOOZED', 'CANCELLED'] as const;

export const FOLLOWUP_TRANSITIONS: Record<FollowupState, FollowupState[]> = {
  OPEN:        ['IN_PROGRESS', 'DONE', 'SNOOZED', 'CANCELLED'],
  IN_PROGRESS: ['DONE', 'SNOOZED', 'CANCELLED'],
  SNOOZED:     ['OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED'],
  DONE:        [],
  CANCELLED:   [],
};

export const FOLLOWUP_STATE_LABELS: Record<FollowupState, string> = {
  OPEN:        'Aperto',
  IN_PROGRESS: 'In corso',
  DONE:        'Completato',
  SNOOZED:     'Rimandato',
  CANCELLED:   'Annullato',
};

export const FOLLOWUP_TYPES = ['call', 'email', 'sms', 'meeting', 'internal', 'note'] as const;

export const FOLLOWUP_TYPE_LABELS: Record<FollowupType, string> = {
  call:     'Chiamata',
  email:    'Email',
  sms:      'SMS',
  meeting:  'Meeting',
  internal: 'Attività interna',
  note:     'Nota',
};

export const FOLLOWUP_STATE_COLORS: Record<FollowupState, string> = {
  OPEN:        '#0EA5E9',
  IN_PROGRESS: '#6366F1',
  DONE:        '#10B981',
  SNOOZED:     '#F59E0B',
  CANCELLED:   '#71717A',
};

export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

export const PRIORITY_LABELS: Record<Priority, string> = {
  LOW:      'Bassa',
  MEDIUM:   'Media',
  HIGH:     'Alta',
  CRITICAL: 'Critica',
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  LOW:      '#71717A',
  MEDIUM:   '#3B82F6',
  HIGH:     '#F59E0B',
  CRITICAL: '#EF4444',
};

// --------------------------------------------------------- Interazioni

export const INTERACTION_TYPES = ['call', 'email', 'sms', 'meeting', 'note', 'activity'] as const;

export const INTERACTION_TYPE_LABELS: Record<InteractionType, string> = {
  call:     'Telefonata',
  email:    'Email',
  sms:      'SMS',
  meeting:  'Meeting',
  note:     'Nota',
  activity: 'Attività',
};

// ------------------------------------------------------ Comunicazioni

export const EMAIL_STATES = [
  'DRAFT', 'QUEUED', 'SENT', 'DELIVERED', 'BOUNCED', 'FAILED', 'CANCELLED',
] as const;

/**
 * DELIVERED e BOUNCED richiedono i webhook del provider, cioè una route
 * pubblica lato server: con la deroga 2 non sono raggiungibili. Restano nel
 * tipo perché la specifica li prevede e per non dover migrare i dati quando
 * il backend arriverà.
 */
export const EMAIL_TRANSITIONS: Record<EmailState, EmailState[]> = {
  DRAFT:     ['QUEUED', 'CANCELLED'],
  QUEUED:    ['SENT', 'FAILED', 'CANCELLED'],
  SENT:      ['DELIVERED', 'BOUNCED'],
  DELIVERED: [],
  BOUNCED:   [],
  FAILED:    ['QUEUED'],   // retry
  CANCELLED: [],
};

export const EMAIL_STATE_LABELS: Record<EmailState, string> = {
  DRAFT:     'Bozza',
  QUEUED:    'In coda',
  SENT:      'Inviata',
  DELIVERED: 'Consegnata',
  BOUNCED:   'Respinta',
  FAILED:    'Fallita',
  CANCELLED: 'Annullata',
};

// ----------------------------------------------------- Campi comuni

export const RECORD_ORIGINS = ['manual', 'ai', 'import', 'integration'] as const;

export const APPROVAL_STATES = ['pending', 'approved', 'modified', 'rejected'] as const;

export const VISIBILITY_LEVELS = ['team', 'commercial', 'private'] as const;
/**
 * `commercial` = visibile a chi ha ruolo commerciale, non agli utenti DEV.
 * Con la deroga 2 è applicata dalla UI e non imposta lato server: vedi
 * docs/DEROGHE.md.
 */

// -------------------------------------------------------- Validazione

/** Dice se un cambio di stato è ammesso dalla macchina a stati. */
export function canTransition<T extends string>(
  transitions: Record<T, T[]>,
  from: T,
  to: T
): boolean {
  if (from === to) return true;
  return (transitions[from] || []).includes(to);
}
