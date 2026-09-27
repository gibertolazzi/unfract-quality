/**
 * Conversione guidata: da lead a cliente.
 *
 * La specifica chiede una conversione «guidata» e il «trasferimento dello
 * storico». Qui la conversione non è un pulsante che indovina: propone, mostra
 * cosa creerà e cosa collegherà, e scrive solo dopo la conferma.
 *
 * Niente viene cancellato. Il lead resta, in stato CONVERTED, con i riferimenti
 * a ciò che è diventato; lo storico non viene spostato ma **agganciato** anche
 * alle nuove entità, così resta leggibile da entrambe le parti.
 */

import { db } from '@/lib/firebase';
import { collection, doc, writeBatch, serverTimestamp, increment, arrayUnion } from 'firebase/firestore';
import {
  CrmLead, CrmAccount, CrmContact, CrmCustomer,
  CrmInteraction, CrmFollowup, CrmDocument, CrmCommunication,
} from '@/types/crm';
import { CrmContextRef, buildBasePayload, updateRecord } from './base';
import { normalizeEmail, normalizePhone, extractDomain } from './helpers';
import { writeAudit } from './audit';
import { changeLeadState } from './leads';

/** Lo stato da cui la macchina a stati ammette CONVERTED. */
export const CONVERTIBLE_FROM = 'NEGOTIATION' as const;

export function canConvert(lead: CrmLead): boolean {
  return lead.state === CONVERTIBLE_FROM && !lead.archived;
}

/** Perché non si può convertire, detto in italiano. */
export function conversionBlockReason(lead: CrmLead): string {
  if (lead.archived) return 'Il lead è archiviato: ripristinalo prima di convertirlo.';
  if (lead.state === 'CONVERTED') return 'Questo lead è già stato convertito.';
  if (lead.state === 'LOST' || lead.state === 'NOT_INTERESTED') {
    return 'Il lead è chiuso. La specifica non prevede riaperture: per riprendere la trattativa si crea un lead nuovo.';
  }
  return 'Si converte solo un lead in negoziazione: portalo prima fino a quella fase.';
}

// ------------------------------------------------------------- proposta

export type ChoiceMode = 'create' | 'link' | 'skip';

export interface MatchCandidate {
  id: string;
  label: string;
  /** Su cosa combacia: serve a far capire perché è stato proposto. */
  matchedOn: string[];
}

export interface AccountDraft {
  legalName: string;
  displayName: string;
  website: string;
  vatNumber: string;
  industry: string;
  city: string;
}

export interface ContactDraft {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: string;
}

export interface ConversionProposal {
  accountMode: ChoiceMode;
  accountId: string;
  accountDraft: AccountDraft;
  accountCandidates: MatchCandidate[];

  contactMode: ChoiceMode;
  contactId: string;
  contactDraft: ContactDraft;
  contactCandidates: MatchCandidate[];

  /** Se l'azienda scelta è già cliente, si collega invece di duplicare. */
  existingCustomerId: string;

  monthlyAmount?: number;
  annualAmount?: number;
  oneTimeAmount?: number;

  createOpportunity: boolean;
  opportunityTitle: string;
  opportunityValue: number;
  opportunityCloseDate: string;
}

/** Divide "Mario Rossi" in nome e cognome; l'ultima parola è il cognome. */
function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: '', lastName: parts[0] };
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] };
}

/**
 * Propone cosa fare, senza decidere: se trova un'azienda o un contatto che
 * combaciano propone di collegarli, altrimenti di crearli. La scelta resta
 * di chi converte — è la stessa regola dei duplicati in tutto il modulo.
 */
export function buildConversionProposal(
  lead: CrmLead,
  accounts: CrmAccount[],
  contacts: CrmContact[],
  customers: CrmCustomer[]
): ConversionProposal {
  const domain = lead.companyDomain || extractDomain(lead.email);
  const email = normalizeEmail(lead.email);
  const phone = normalizePhone(lead.phone);
  const company = (lead.companyName || '').trim().toLowerCase();

  const accountCandidates: MatchCandidate[] = accounts
    .filter(account => !account.archived)
    .map(account => {
      const matchedOn: string[] = [];
      if (domain && account.domain === domain) matchedOn.push('dominio');
      if (company && (account.legalName || '').trim().toLowerCase() === company) matchedOn.push('ragione sociale');
      if (company && (account.displayName || '').trim().toLowerCase() === company) matchedOn.push('nome');
      return { id: account.id, label: account.displayName || account.legalName, matchedOn };
    })
    .filter(candidate => candidate.matchedOn.length > 0)
    .sort((a, b) => b.matchedOn.length - a.matchedOn.length);

  const contactCandidates: MatchCandidate[] = contacts
    .filter(contact => !contact.archived)
    .map(contact => {
      const matchedOn: string[] = [];
      if (email && contact.emailNormalized === email) matchedOn.push('email');
      if (phone && contact.phoneNormalized === phone) matchedOn.push('telefono');
      return { id: contact.id, label: contact.fullName, matchedOn };
    })
    .filter(candidate => candidate.matchedOn.length > 0)
    .sort((a, b) => b.matchedOn.length - a.matchedOn.length);

  const accountId = accountCandidates[0]?.id || '';
  const existingCustomer = accountId
    ? customers.find(customer => customer.accountId === accountId && !customer.archived)
    : undefined;

  const { firstName, lastName } = splitName(lead.fullName);

  return {
    accountMode: accountId ? 'link' : 'create',
    accountId,
    accountDraft: {
      legalName: lead.companyName || lead.fullName || '',
      displayName: lead.companyName || lead.fullName || '',
      website: domain,
      vatNumber: '',
      industry: '',
      city: '',
    },
    accountCandidates,

    contactMode: contactCandidates[0]
      ? 'link'
      : (lead.fullName || lead.email ? 'create' : 'skip'),
    contactId: contactCandidates[0]?.id || '',
    contactDraft: {
      firstName,
      lastName,
      email: lead.email || '',
      phone: lead.phone || '',
      role: '',
    },
    contactCandidates,

    existingCustomerId: existingCustomer?.id || '',

    // Un lead in negoziazione ha quasi sempre un valore: proporre
    // l'opportunità evita che la trattativa sparisca dalla pipeline.
    createOpportunity: lead.estimatedValue > 0,
    opportunityTitle: lead.companyName
      ? `Trattativa ${lead.companyName}`
      : `Trattativa ${lead.fullName || 'senza nome'}`,
    opportunityValue: lead.estimatedValue || 0,
    opportunityCloseDate: '',
  };
}

// ------------------------------------------------------------- anteprima

export interface HistoryCounts {
  interactions: number;
  followups: number;
  documents: number;
  communications: number;
  total: number;
}

/** Quanti record dello storico verranno agganciati alle nuove entità. */
export function countHistory(
  leadId: string,
  interactions: CrmInteraction[],
  followups: CrmFollowup[],
  documents: CrmDocument[],
  communications: CrmCommunication[]
): HistoryCounts {
  const counts = {
    interactions: interactions.filter(i => i.leadId === leadId).length,
    followups: followups.filter(f => f.leadId === leadId).length,
    documents: documents.filter(d => d.leadId === leadId).length,
    communications: communications.filter(c => c.leadId === leadId).length,
  };
  return { ...counts, total: counts.interactions + counts.followups + counts.documents + counts.communications };
}

// ------------------------------------------------------------ esecuzione

export interface ConversionResult {
  accountId: string;
  contactId: string;
  customerId: string;
  opportunityId: string;
  historyMoved: number;
  errors: string[];
}

export class ConversionBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConversionBlockedError';
  }
}

/** Firestore accetta al massimo 500 operazioni per batch: si sta sotto. */
const BATCH_SIZE = 400;

interface HistoryRecords {
  interactions: CrmInteraction[];
  followups: CrmFollowup[];
  documents: CrmDocument[];
  communications: CrmCommunication[];
}

/**
 * Esegue la conversione.
 *
 * Ordine voluto: prima si creano le entità, poi si aggancia lo storico, e per
 * ultimo si cambia lo stato del lead. Se qualcosa fallisce a metà, il lead
 * resta in negoziazione e si vede che la conversione non è andata a termine,
 * invece di risultare convertito verso entità che non esistono.
 *
 * Senza backend non c'è una transazione unica su tutto (deroga 2): i singoli
 * blocchi sono atomici, l'insieme no.
 */
export async function convertLead(
  ctx: CrmContextRef,
  lead: CrmLead,
  proposal: ConversionProposal,
  history: HistoryRecords
): Promise<ConversionResult> {
  if (!canConvert(lead)) throw new ConversionBlockedError(conversionBlockReason(lead));

  const result: ConversionResult = {
    accountId: '', contactId: '', customerId: '', opportunityId: '',
    historyMoved: 0, errors: [],
  };

  try {
    // ------------------------------------------------------- 1. azienda
    if (proposal.accountMode === 'link' && proposal.accountId) {
      result.accountId = proposal.accountId;
    } else {
      const ref = doc(collection(db, 'crm_accounts'));
      const domain = extractDomain(proposal.accountDraft.website);
      const batch = writeBatch(db);
      batch.set(ref, {
        legalName: proposal.accountDraft.legalName,
        displayName: proposal.accountDraft.displayName || proposal.accountDraft.legalName,
        domain,
        website: proposal.accountDraft.website,
        industry: proposal.accountDraft.industry,
        sizeRange: '',
        country: 'IT', region: '', city: proposal.accountDraft.city, address: '', postalCode: '',
        vatNumber: proposal.accountDraft.vatNumber, taxCode: '',
        ownerUid: lead.ownerUid || ctx.uid,
        sources: lead.source ? [lead.source] : [],
        notes: '', logoUrl: '', linkedinUrl: '',
        duplicateCandidateIds: [],
        ...buildBasePayload(ctx),
        // Da dove arriva: la provenienza resta leggibile sul record.
        sourceRef: `lead:${lead.id}`,
      });
      await batch.commit();
      result.accountId = ref.id;
    }

    // ------------------------------------------------------ 2. contatto
    if (proposal.contactMode === 'link' && proposal.contactId) {
      result.contactId = proposal.contactId;
    } else if (proposal.contactMode === 'create') {
      const ref = doc(collection(db, 'crm_contacts'));
      const fullName = `${proposal.contactDraft.firstName} ${proposal.contactDraft.lastName}`.trim();
      const batch = writeBatch(db);
      batch.set(ref, {
        firstName: proposal.contactDraft.firstName,
        lastName: proposal.contactDraft.lastName,
        fullName,
        initials: fullName.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join(''),
        role: proposal.contactDraft.role,
        email: proposal.contactDraft.email,
        emailNormalized: normalizeEmail(proposal.contactDraft.email),
        phone: proposal.contactDraft.phone,
        phoneNormalized: normalizePhone(proposal.contactDraft.phone),
        accountId: result.accountId,
        isPrimary: false,
        preferredChannel: '', preferredTime: '',
        // I consensi si portano dietro dal lead: non si ricomincia da zero,
        // e non si inventa un consenso che non c'era.
        consents: lead.consents,
        suppressed: false, suppressedReason: '',
        linkedinUrl: '', photoURL: '', notes: '',
        duplicateCandidateIds: [],
        ...buildBasePayload(ctx),
        sourceRef: `lead:${lead.id}`,
      });
      await batch.commit();
      result.contactId = ref.id;
    }

    // ------------------------------------------------------- 3. cliente
    if (proposal.existingCustomerId) {
      result.customerId = proposal.existingCustomerId;
      // Il nuovo referente si aggiunge a quelli che il cliente ha già.
      if (result.contactId) {
        const batch = writeBatch(db);
        batch.update(doc(db, 'crm_customers', result.customerId), {
          contactIds: arrayUnion(result.contactId),
          updatedAt: serverTimestamp(),
          updatedBy: ctx.uid,
          version: increment(1),
        });
        await batch.commit();
      }
    } else {
      const ref = doc(collection(db, 'crm_customers'));
      const batch = writeBatch(db);
      batch.set(ref, {
        accountId: result.accountId,
        contactIds: result.contactId ? [result.contactId] : [],
        ownerUid: lead.ownerUid || ctx.uid,
        status: 'active',
        linkedProjectIds: [],
        sharedWithProjectFields: [],
        originLeadId: lead.id,
        customerSince: new Date().toISOString(),
        notes: lead.notes || '',
        privateNotes: '',
        ...buildBasePayload(ctx),
      });
      await batch.commit();
      result.customerId = ref.id;
    }

    // --------------------------------------------------- 4. opportunità
    if (proposal.createOpportunity) {
      const ref = doc(collection(db, 'crm_opportunities'));
      const batch = writeBatch(db);
      batch.set(ref, {
        title: proposal.opportunityTitle || 'Trattativa',
        description: '',
        customerId: result.customerId,
        leadId: '',
        ownerUid: lead.ownerUid || ctx.uid,
        value: proposal.opportunityValue || 0,
        currency: 'EUR',
        // Un lead in negoziazione diventa un'opportunità in negoziazione:
        // ricominciare dalla qualificazione perderebbe il lavoro già fatto.
        phase: 'NEGOTIATION',
        probability: null,
        expectedCloseDate: proposal.opportunityCloseDate || '',
        closedAt: null,
        lostReason: '',
        items: [],
        changeLog: [],
        notes: '',
        order: 0,
        ...buildBasePayload(ctx),
        sourceRef: `lead:${lead.id}`,
      });
      await batch.commit();
      result.opportunityId = ref.id;
    }

    // ------------------------------------------------------ 5. storico
    result.historyMoved = await attachHistory(ctx, lead.id, result, history);

    // --------------------------------------------------------- 6. lead
    // Per ultimo, e passando dalla validazione delle transizioni.
    await changeLeadState(ctx, lead.id, 'CONVERTED', { viaConversione: true });

    await updateRecord('crm_leads', lead.id, {
      convertedAt: new Date().toISOString(),
      convertedAccountId: result.accountId,
      convertedContactId: result.contactId,
      convertedCustomerId: result.customerId,
      convertedOpportunityId: result.opportunityId,
    }, ctx.uid);

    await writeAudit(ctx, 'lead.converted', 'lead', lead.id, null, {
      accountId: result.accountId,
      contactId: result.contactId,
      customerId: result.customerId,
      opportunityId: result.opportunityId,
    }, { historyMoved: result.historyMoved });

  } catch (error) {
    console.error('Error converting CRM lead:', error);
    result.errors.push(error instanceof Error ? error.message : 'Conversione non riuscita');
  }

  return result;
}

/**
 * Aggancia lo storico del lead alle nuove entità.
 *
 * `leadId` NON viene tolto: il lead resta e la sua storia deve continuare a
 * essere leggibile da lì. I record acquistano in più i riferimenti a cliente,
 * contatto e azienda, così la stessa storia compare anche sulla scheda cliente.
 */
async function attachHistory(
  ctx: CrmContextRef,
  leadId: string,
  result: ConversionResult,
  history: HistoryRecords
): Promise<number> {
  const links = {
    customerId: result.customerId,
    contactId: result.contactId,
    accountId: result.accountId,
  };

  const targets: { collection: string; ids: string[]; fields: Record<string, string> }[] = [
    {
      collection: 'crm_interactions',
      ids: history.interactions.filter(i => i.leadId === leadId).map(i => i.id),
      fields: links,
    },
    {
      collection: 'crm_followups',
      // I follow-up non hanno un accountId: si collegano a cliente e contatto.
      ids: history.followups.filter(f => f.leadId === leadId).map(f => f.id),
      fields: { customerId: links.customerId, contactId: links.contactId },
    },
    {
      collection: 'crm_documents',
      ids: history.documents.filter(d => d.leadId === leadId).map(d => d.id),
      fields: links,
    },
    {
      collection: 'crm_communications',
      ids: history.communications.filter(c => c.leadId === leadId).map(c => c.id),
      fields: { customerId: links.customerId, toContactId: links.contactId },
    },
  ];

  let moved = 0;

  for (const target of targets) {
    const payload: Record<string, any> = {};
    Object.entries(target.fields).forEach(([key, value]) => { if (value) payload[key] = value; });
    if (Object.keys(payload).length === 0) continue;

    for (let start = 0; start < target.ids.length; start += BATCH_SIZE) {
      const chunk = target.ids.slice(start, start + BATCH_SIZE);
      const batch = writeBatch(db);
      chunk.forEach(id => {
        batch.update(doc(db, target.collection, id), {
          ...payload,
          updatedAt: serverTimestamp(),
          updatedBy: ctx.uid,
          version: increment(1),
        });
      });
      try {
        await batch.commit();
        moved += chunk.length;
      } catch (error) {
        console.error(`Error attaching ${target.collection} to converted lead:`, error);
      }
    }
  }

  return moved;
}
