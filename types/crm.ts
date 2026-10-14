// Entità del CRM, secondo docs/requisiti/specifica-crm.pdf.
// Gli stati stanno in constants.ts, non qui.
//
// I timestamp sono `any` perché Firestore restituisce Timestamp ma in scrittura
// riceve serverTimestamp(): è la convenzione già usata in Project, Meeting e Chat.

export type LeadState = 'NEW' | 'TO_CONTACT' | 'CONTACTED' | 'FOLLOWUP' | 'QUALIFIED' | 'PROPOSAL_SENT' | 'NEGOTIATION' | 'CONVERTED' | 'LOST' | 'NOT_INTERESTED';
export type OpportunityPhase = 'QUALIFICATION' | 'DISCOVERY' | 'PROPOSAL' | 'NEGOTIATION' | 'WON' | 'LOST';
export type FollowupState = 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'SNOOZED' | 'CANCELLED';
export type FollowupType = 'call' | 'email' | 'sms' | 'meeting' | 'internal' | 'note';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type InteractionType = 'call' | 'email' | 'sms' | 'meeting' | 'note' | 'activity';
export type EmailState = 'DRAFT' | 'QUEUED' | 'SENT' | 'DELIVERED' | 'BOUNCED' | 'FAILED' | 'CANCELLED';
export type RecordOrigin = 'manual' | 'ai' | 'import' | 'integration';
export type ApprovalState = 'pending' | 'approved' | 'modified' | 'rejected';
export type VisibilityLevel = 'team' | 'commercial' | 'private';

/**
 * Campi presenti su OGNI record CRM, richiesti dalla specifica.
 *
 * `organizationId` è valorizzato ma non usato per filtrare: la partizione è
 * `projectId` (deroga 1, vedi docs/DEROGHE.md). Tenerlo popolato rende una
 * futura migrazione una riscrittura di query invece che una migrazione di dati.
 */
export interface CrmBase {
  id: string;
  projectId: string;
  organizationId: string;

  createdAt: any;
  updatedAt: any;
  createdBy: string;
  updatedBy: string;

  /** Incrementato a ogni modifica. */
  version: number;
  origin: RecordOrigin;

  /** Archiviazione logica: i record non si cancellano mai. */
  archived: boolean;
  archivedAt?: any;

  // Valorizzati solo per dati generati da AI o importati.
  provider?: string;
  externalId?: string;
  sourceRef?: string;
  approvalStatus?: ApprovalState;
}

/** Consenso al trattamento, con fonte, data e versione dell'informativa. */
export interface CrmConsent {
  granted: boolean;
  source: string;
  grantedAt?: any;
  /** Versione dell'informativa accettata. */
  policyVersion: string;
}

export interface CrmConsents {
  email: CrmConsent;
  sms: CrmConsent;
}

// ------------------------------------------------------------------ Lead

export interface CrmLead extends CrmBase {
  /** Nominativo così come acquisito, prima della normalizzazione in contatto. */
  fullName: string;
  companyName: string;
  email: string;
  /** Email in minuscolo e senza spazi: chiave per il rilevamento duplicati. */
  emailNormalized: string;
  phone: string;
  phoneNormalized: string;

  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;

  // Dati fiscali e verifica
  vatNumber?: string;
  taxCode?: string;
  vatVerifiedAt?: any;
  vatSource?: 'vies' | 'provider' | 'manual';

  /** Dominio ricavato dall'email o dal sito: seconda chiave per i duplicati. */
  companyDomain: string;

  source: string;
  ownerUid: string;
  state: LeadState;
  estimatedValue: number;
  currency: string;
  notes: string;

  lastContactAt?: any;
  nextFollowupAt?: any;

  consents: CrmConsents;

  /** Valorizzati quando lo stato diventa CONVERTED. */
  convertedAt?: any;
  convertedAccountId?: string;
  convertedContactId?: string;
  convertedCustomerId?: string;
  convertedOpportunityId?: string;

  /** Lead segnalati come possibili duplicati, non fusi automaticamente. */
  duplicateOf?: string;
  duplicateCandidateIds: string[];

  lostReason?: string;
}

// --------------------------------------------------------------- Azienda

export interface CrmAccount extends CrmBase {
  legalName: string;
  displayName: string;
  domain: string;
  website: string;
  industry: string;
  /** Fascia dipendenti, es. "11-50". */
  sizeRange: string;

  country: string;
  region: string;
  city: string;
  address: string;
  postalCode: string;

  // Dati fiscali, opzionali secondo la specifica.
  vatNumber: string;
  taxCode: string;
  vatVerifiedAt?: any;
  vatSource?: 'vies' | 'provider' | 'manual';

  ownerUid: string;
  sources: string[];
  notes: string;

  logoUrl: string;
  linkedinUrl: string;

  duplicateCandidateIds: string[];
}

// -------------------------------------------------------------- Contatto

export interface CrmContact extends CrmBase {
  firstName: string;
  lastName: string;
  fullName: string;
  initials: string;

  role: string;
  email: string;
  emailNormalized: string;
  phone: string;
  phoneNormalized: string;

  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;

  accountId: string;
  /** Contatto principale dell'azienda. */
  isPrimary: boolean;

  /** Canale preferito e fascia oraria, come da specifica. */
  preferredChannel: 'email' | 'phone' | 'sms' | '';
  preferredTime: string;

  consents: CrmConsents;
  /** Esclusione permanente da qualsiasi invio. */
  suppressed: boolean;
  suppressedReason: string;

  linkedinUrl: string;
  photoURL: string;
  notes: string;

  duplicateCandidateIds: string[];
}

// --------------------------------------------------------------- Cliente

export interface CrmCustomer extends CrmBase {
  accountId: string;
  contactIds: string[];
  ownerUid: string;

  status: 'active' | 'inactive' | 'suspended';

  monthlyAmount?: number;
  annualAmount?: number;
  oneTimeAmount?: number;


  /** Progetti collegati. Il progetto riceve solo ciò che è autorizzato qui. */
  linkedProjectIds: string[];
  /** Campi che il cliente autorizza a esporre lato progetto. */
  sharedWithProjectFields: string[];

  /** Derivato da un lead convertito, se esiste. */
  originLeadId?: string;

  customerSince?: any;
  notes: string;
  /** Note riservate: mai esposte agli utenti DEV. */
  privateNotes: string;
}

// ----------------------------------------------------------- Opportunità

export interface CrmOpportunityItem {
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface CrmOpportunityChange {
  at: any;
  by: string;
  field: string;
  from: any;
  to: any;
}

export interface CrmOpportunity extends CrmBase {
  title: string;
  description: string;

  /** Uno dei due è valorizzato: la specifica richiede cliente o lead. */
  customerId: string;
  leadId: string;

  ownerUid: string;
  value: number;
  currency: string;

  phase: OpportunityPhase;
  /** Impostata a mano; se assente vale quella suggerita dalla fase. */
  probability: number | null;

  expectedCloseDate: string;   // ISO date
  closedAt?: any;
  lostReason: string;

  items: CrmOpportunityItem[];
  /** Cronologia delle modifiche, richiesta dalla specifica. */
  changeLog: CrmOpportunityChange[];

  notes: string;
  /** Posizione nella colonna del kanban. */
  order: number;
}

// ----------------------------------------------------------- Interazione

export interface CrmInteraction extends CrmBase {
  type: InteractionType;

  // Collegamenti: almeno uno valorizzato.
  leadId: string;
  accountId: string;
  contactId: string;
  customerId: string;
  opportunityId: string;

  title: string;
  body: string;
  /** Esito della telefonata, dell'email, del meeting. */
  outcome: string;
  occurredAt: any;

  /** Agganci a ciò che esiste già nel prodotto. */
  linkedMeetingId: string;
  linkedTaskId: string;
  linkedDocumentIds: string[];
  linkedCommunicationId: string;

  nextStep: string;
  visibility: VisibilityLevel;
  participantUids: string[];
}

// ------------------------------------------------------------- Follow-up

export interface CrmFollowup extends CrmBase {
  type: FollowupType;
  title: string;
  notes: string;

  assigneeUid: string;
  priority: Priority;
  dueDate: string;             // ISO date
  state: FollowupState;
  snoozedUntil?: string;
  completedAt?: any;

  // Collegamenti: almeno uno valorizzato.
  leadId: string;
  contactId: string;
  customerId: string;
  opportunityId: string;
  linkedMeetingId: string;

  /** Da dove nasce: inserimento manuale, meeting, email, proposta AI, regola o sequenza. */
  createdFrom: 'manual' | 'meeting' | 'email' | 'sms' | 'ai' | 'rule' | 'sequence';
  automation?: {
    ruleId?: string;
    sequenceId?: string;
    enrollmentId?: string;
    stepIndex?: number;
    mode: 'task' | 'auto_send' | 'draft';
    templateId?: string;
    executedAt?: string;
    error?: string;
  };
  dedupeKey?: string;
  linkedCalendarEventId: string;
}

// --------------------------------------------------------- Comunicazione

export interface CrmCommunication extends CrmBase {
  channel: 'email';            // 'sms' arriverà col backend
  state: EmailState;

  toEmail: string;
  toContactId: string;
  fromEmail: string;
  replyTo: string;

  subject: string;
  bodyHtml: string;
  bodyText: string;
  templateId: string;
  templateVars: Record<string, string>;

  // Collegamenti CRM.
  leadId: string;
  customerId: string;
  opportunityId: string;

  attachmentIds: string[];

  /** Esito provider. */
  providerName: string;
  providerMessageId: string;
  errorMessage: string;
  sentAt?: any;
  deliveredAt?: any;

  /** Consenso verificato al momento dell'invio. */
  consentChecked: boolean;
  /** Chiave anti-duplicazione sui retry. */
  idempotencyKey: string;
}

// ------------------------------------------------------------- Documento

export interface CrmDocumentVersion {
  version: number;
  storagePath: string;
  downloadUrl: string;
  sizeBytes: number;
  uploadedAt: any;
  uploadedBy: string;
}

export interface CrmDocument extends CrmBase {
  fileName: string;
  mimeType: string;
  extension: string;
  sizeBytes: number;

  storagePath: string;
  downloadUrl: string;

  // Collegamenti: almeno uno valorizzato.
  leadId: string;
  accountId: string;
  contactId: string;
  customerId: string;
  opportunityId: string;
  interactionId: string;
  communicationId: string;
  linkedMeetingId: string;

  tags: string[];
  visibility: VisibilityLevel;
  /** Versioni precedenti: non si sovrascrive mai in modo distruttivo. */
  versions: CrmDocumentVersion[];

  /** Data oltre la quale il documento va eliminato secondo policy. */
  retentionUntil?: string;

  /** Riempiti quando arriverà il backend (estrazione testo, OCR, antivirus). */
  extractedText: string;
  scanStatus: 'skipped' | 'pending' | 'clean' | 'infected';
}

// ----------------------------------------------------------------- Audit

export interface CrmAuditEntry {
  id: string;
  projectId: string;
  organizationId: string;

  action: string;              // es. 'lead.state_changed', 'email.sent'
  entityType: string;
  entityId: string;

  actorUid: string;
  at: any;

  before?: any;
  after?: any;
  meta?: Record<string, any>;
}

// ----------------------------------------------------------- Viste salvate

/**
 * Vista salvata della lista lead: combinazione di filtri, ordinamento e
 * dimensione pagina. Richiesta dalla specifica («viste salvate»).
 *
 * Undicesima collezione, aggiunta in fase 2: le viste devono seguire la persona
 * fra dispositivi, quindi non possono stare in localStorage.
 */
export interface CrmSavedView extends CrmBase {
  name: string;
  entity: 'lead';
  ownerUid: string;
  /** Visibile a tutto il progetto invece che al solo autore. */
  shared: boolean;
  /** Serializzazione di LeadFilters, LeadSort e pageSize. */
  filters: any;
  sort: any;
  pageSize: number;
}

// ----------------------------------------------------------- Liste personalizzate

export interface CrmCustomList extends CrmBase {
  name: string;
  ownerUid: string;
  entityIds: string[];
}
