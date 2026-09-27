import { db, auth } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { CrmCommunication, CrmContact, CrmLead } from '@/types/crm';
import { EmailState, EMAIL_TRANSITIONS, canTransition } from '@/components/crm/constants';
import { CrmContextRef, mapBase, createRecord, updateRecord, getRecords, getRecordById, subscribeToRecords, subscribeToRecord, byCreatedAtDesc } from './base';
import { writeAudit } from './audit';

const COLLECTION_NAME = 'crm_communications';

/**
 * Livello dati delle comunicazioni. L'invio vero passa dalla route server
 * (fase 7): la chiave del provider non può stare nel browser.
 */

export function mapCommunication(id: string, data: any): CrmCommunication {
  return {
    ...mapBase(id, data),
    channel: 'email',
    state: data.state || 'DRAFT',
    toEmail: data.toEmail || '',
    toContactId: data.toContactId || '',
    fromEmail: data.fromEmail || '',
    replyTo: data.replyTo || '',
    subject: data.subject || '',
    bodyHtml: data.bodyHtml || '',
    bodyText: data.bodyText || '',
    templateId: data.templateId || '',
    templateVars: data.templateVars || {},
    leadId: data.leadId || '',
    customerId: data.customerId || '',
    opportunityId: data.opportunityId || '',
    attachmentIds: data.attachmentIds || [],
    providerName: data.providerName || '',
    providerMessageId: data.providerMessageId || '',
    errorMessage: data.errorMessage || '',
    sentAt: data.sentAt,
    deliveredAt: data.deliveredAt,
    consentChecked: data.consentChecked === true,
    idempotencyKey: data.idempotencyKey || '',
  };
}

export async function getCommunications(projectId: string) {
  const items = await getRecords(COLLECTION_NAME, projectId, mapCommunication);
  return items.sort(byCreatedAtDesc);
}

export function subscribeToCommunications(
  projectId: string,
  callback: (items: CrmCommunication[]) => void
) {
  return subscribeToRecords(
    COLLECTION_NAME, projectId, mapCommunication,
    (items) => callback(items.sort(byCreatedAtDesc))
  );
}

export function getCommunicationById(id: string) {
  return getRecordById(COLLECTION_NAME, id, mapCommunication);
}

export function subscribeToCommunication(id: string, cb: (c: CrmCommunication | null) => void) {
  return subscribeToRecord(COLLECTION_NAME, id, mapCommunication, cb);
}

export type CommunicationLinkField = 'leadId' | 'customerId' | 'opportunityId' | 'toContactId';

export function subscribeToCommunicationsFor(
  projectId: string,
  field: CommunicationLinkField,
  targetId: string,
  callback: (items: CrmCommunication[]) => void
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
        .map(d => mapCommunication(d.id, d.data()))
        .sort(byCreatedAtDesc)
    );
  }, (error) => {
    console.error('Error subscribing to CRM communications:', error);
    callback([]);
  });
}

/**
 * Chiave di idempotenza: la specifica chiede «retry idempotente, senza messaggi
 * duplicati». Stessa bozza + stesso destinatario = stessa chiave, così un
 * secondo invio è riconoscibile come ripetizione.
 */
export function buildIdempotencyKey(communicationId: string, toEmail: string): string {
  return `${communicationId}:${toEmail.trim().toLowerCase()}`;
}

export interface CreateCommunicationInput {
  toEmail: string;
  toContactId?: string;
  fromEmail?: string;
  replyTo?: string;
  subject: string;
  bodyHtml?: string;
  bodyText?: string;
  templateId?: string;
  templateVars?: Record<string, string>;
  leadId?: string;
  customerId?: string;
  opportunityId?: string;
  attachmentIds?: string[];
}

/** Crea la bozza. L'invio è un passaggio separato ed esplicito. */
export async function createDraft(ctx: CrmContextRef, input: CreateCommunicationInput) {
  const id = await createRecord(COLLECTION_NAME, ctx, {
    channel: 'email',
    state: 'DRAFT' as EmailState,
    toEmail: input.toEmail || '',
    toContactId: input.toContactId || '',
    fromEmail: input.fromEmail || '',
    replyTo: input.replyTo || '',
    subject: input.subject || '',
    bodyHtml: input.bodyHtml || '',
    bodyText: input.bodyText || '',
    templateId: input.templateId || '',
    templateVars: input.templateVars || {},
    leadId: input.leadId || '',
    customerId: input.customerId || '',
    opportunityId: input.opportunityId || '',
    attachmentIds: input.attachmentIds || [],
    providerName: '',
    providerMessageId: '',
    errorMessage: '',
    sentAt: null,
    deliveredAt: null,
    consentChecked: false,
    idempotencyKey: '',
  });

  if (id) {
    await updateRecord(COLLECTION_NAME, id, {
      idempotencyKey: buildIdempotencyKey(id, input.toEmail || ''),
    }, ctx.uid);
    await writeAudit(ctx, 'email.draft_created', 'communication', id, null, { to: input.toEmail });
  }
  return id;
}

export class InvalidEmailStateError extends Error {
  constructor(public from: string, public to: string) {
    super(`Transizione non ammessa: ${from} → ${to}`);
    this.name = 'InvalidEmailStateError';
  }
}

export async function changeCommunicationState(
  ctx: CrmContextRef,
  id: string,
  to: EmailState,
  meta: { providerName?: string; providerMessageId?: string; errorMessage?: string } = {}
): Promise<void> {
  const current = await getCommunicationById(id);
  if (!current) return;

  if (!canTransition(EMAIL_TRANSITIONS, current.state, to)) {
    throw new InvalidEmailStateError(current.state, to);
  }
  if (current.state === to) return;

  const payload: Record<string, any> = { state: to };
  if (meta.providerName) payload.providerName = meta.providerName;
  if (meta.providerMessageId) payload.providerMessageId = meta.providerMessageId;
  if (meta.errorMessage) payload.errorMessage = meta.errorMessage;
  if (to === 'SENT') payload.sentAt = new Date().toISOString();
  if (to === 'DELIVERED') payload.deliveredAt = new Date().toISOString();

  await updateRecord(COLLECTION_NAME, id, payload, ctx.uid);
  await writeAudit(ctx, `email.${to.toLowerCase()}`, 'communication', id,
    { state: current.state }, { state: to, ...meta });
}
/**
 * Invio email dal browser: controlli, bozza, chiamata alla route, esito.
 *
 * L'ordine è voluto: prima si registra la bozza su Firestore, poi si spedisce.
 * Se la spedizione fallisce resta un record che dice cosa si voleva mandare e
 * perché non è partito; se si spedisse prima, un errore di scrittura
 * cancellerebbe la traccia di un'email però davvero uscita.
 */


const ENDPOINT = '/api/crm/email/send';

export type EmailBlockReason =
  | 'no-address'
  | 'suppressed'
  | 'no-consent'
  | null;

export interface EmailEligibility {
  allowed: boolean;
  reason: EmailBlockReason;
  message: string;
}

/**
 * Se a questo destinatario si può scrivere.
 *
 * ATTENZIONE: questo controllo vive nel browser. La route non può ripeterlo
 * perché senza SDK admin non legge Firestore, quindi chi sa costruire una
 * richiesta HTTP può scavalcarlo. È una conseguenza diretta della deroga 2:
 * vedi docs/DEROGHE.md e docs/EMAIL.md.
 */
export function canEmailContact(contact: CrmContact): EmailEligibility {
  if (!contact.email) {
    return { allowed: false, reason: 'no-address', message: 'Il contatto non ha un indirizzo email.' };
  }
  if (contact.suppressed) {
    return {
      allowed: false,
      reason: 'suppressed',
      message: contact.suppressedReason
        ? `Contatto escluso dagli invii: ${contact.suppressedReason}`
        : 'Contatto escluso da ogni invio.',
    };
  }
  if (!contact.consents.email.granted) {
    return {
      allowed: false,
      reason: 'no-consent',
      message: 'Nessun consenso email registrato per questo contatto.',
    };
  }
  return { allowed: true, reason: null, message: '' };
}

export function canEmailLead(lead: CrmLead): EmailEligibility {
  if (!lead.email) {
    return { allowed: false, reason: 'no-address', message: 'Il lead non ha un indirizzo email.' };
  }
  if (!lead.consents.email.granted) {
    return {
      allowed: false,
      reason: 'no-consent',
      message: 'Nessun consenso email registrato per questo lead.',
    };
  }
  return { allowed: true, reason: null, message: '' };
}

export interface SendEmailInput {
  toEmail: string;
  toContactId?: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
  templateId?: string;
  templateVars?: Record<string, string>;
  leadId?: string;
  customerId?: string;
  opportunityId?: string;
}

export interface SendEmailResult {
  communicationId: string;
  sent: boolean;
  duplicate: boolean;
  error: string;
}

/**
 * Registra la bozza e la spedisce.
 *
 * La bozza resta anche quando l'invio fallisce: lo stato diventa FAILED con il
 * motivo del provider, invece di sparire.
 */
export async function sendCrmEmail(
  ctx: CrmContextRef,
  input: SendEmailInput
): Promise<SendEmailResult> {
  const result: SendEmailResult = {
    communicationId: '', sent: false, duplicate: false, error: '',
  };

  const communicationId = await createDraft(ctx, {
    toEmail: input.toEmail,
    toContactId: input.toContactId,
    replyTo: input.replyTo,
    subject: input.subject,
    bodyHtml: input.html,
    bodyText: input.text,
    templateId: input.templateId,
    templateVars: input.templateVars,
    leadId: input.leadId,
    customerId: input.customerId,
    opportunityId: input.opportunityId,
  });

  if (!communicationId) {
    result.error = 'Non è stato possibile registrare la bozza: invio annullato.';
    return result;
  }
  result.communicationId = communicationId;

  // La macchina a stati della specifica non ammette DRAFT → SENT: si passa da
  // QUEUED, che è il momento in cui l'email esce dalle nostre mani. Ci si
  // mette PRIMA di spedire, così qualunque fallimento successivo ha uno stato
  // da cui arrivare a FAILED.
  try {
    await changeCommunicationState(ctx, communicationId, 'QUEUED');
  } catch (error) {
    console.error('Error queueing CRM email:', error);
    result.error = 'Non è stato possibile mettere l’email in coda.';
    return result;
  }

  let token = '';
  try {
    token = (await auth.currentUser?.getIdToken()) || '';
  } catch (error) {
    console.error('Error getting Firebase ID token:', error);
  }

  if (!token) {
    result.error = 'Sessione scaduta: esci e rientra prima di inviare.';
    await failDraft(ctx, communicationId, result.error);
    return result;
  }

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        to: input.toEmail,
        subject: input.subject,
        text: input.text,
        html: input.html,
        replyTo: input.replyTo,
        idempotencyKey: buildIdempotencyKey(communicationId, input.toEmail),
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      result.error = data?.error || `Invio non riuscito (${response.status}).`;
      await failDraft(ctx, communicationId, result.error);
      return result;
    }

    result.duplicate = data?.duplicate === true;
    result.sent = true;

    await changeCommunicationState(ctx, communicationId, 'SENT', {
      providerName: 'resend',
      providerMessageId: data?.id || '',
    });

    // Il consenso è stato verificato prima di arrivare qui: resta scritto sul
    // record, perché è la domanda che si fa dopo, non prima.
    await updateRecord('crm_communications', communicationId, { consentChecked: true }, ctx.uid);

    return result;
  } catch (error) {
    console.error('Error calling CRM email route:', error);
    result.error = 'Il server non ha risposto.';
    await failDraft(ctx, communicationId, result.error);
    return result;
  }
}

async function failDraft(ctx: CrmContextRef, id: string, message: string) {
  try {
    await changeCommunicationState(ctx, id, 'FAILED', { errorMessage: message });
  } catch (error) {
    console.error('Error marking CRM email as failed:', error);
  }
  await writeAudit(ctx, 'email.failed', 'communication', id, null, { message });
}
/**
 * Template email con variabili.
 *
 * Funzioni pure: nessun Firestore, nessuna rete. Il rendering è verificabile
 * per conto suo, e la sostituzione delle variabili non fa mai il lavoro a metà
 * — una variabile che non si sa riempire viene segnalata, non lasciata a vista
 * nel testo inviato.
 */

export interface EmailTemplate {
  id: string;
  name: string;
  description: string;
  subject: string;
  body: string;
  /** Variabili che il template si aspetta, ricavate dal testo. */
  variables?: string[];
}

/** `{{nome}}` — spazi ammessi dentro le graffe. */
const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

export function extractVariables(...texts: string[]): string[] {
  const found = new Set<string>();
  texts.forEach(text => {
    let match;
    VARIABLE_PATTERN.lastIndex = 0;
    while ((match = VARIABLE_PATTERN.exec(text || '')) !== null) found.add(match[1]);
  });
  return Array.from(found);
}

export interface RenderResult {
  text: string;
  /** Variabili presenti nel testo e senza valore: la spedizione si ferma. */
  missing: string[];
}

export function render(template: string, values: Record<string, string>): RenderResult {
  const missing = new Set<string>();

  const text = (template || '').replace(VARIABLE_PATTERN, (_, name: string) => {
    const value = values[name];
    if (value === undefined || String(value).trim() === '') {
      missing.add(name);
      // Il segnaposto resta visibile: così l'anteprima mostra il buco invece
      // di far sembrare il testo completo.
      return `{{${name}}}`;
    }
    return String(value);
  });

  return { text, missing: Array.from(missing) };
}

/** Etichette leggibili delle variabili offerte dal CRM. */
export const VARIABLE_LABELS: Record<string, string> = {
  nome: 'Nome del contatto',
  cognome: 'Cognome del contatto',
  nome_completo: 'Nominativo',
  azienda: 'Azienda',
  ruolo: 'Ruolo',
  email: 'Email del destinatario',
  mittente: 'Chi scrive',
  opportunita: 'Titolo dell’opportunità',
  valore: 'Valore dell’opportunità',
  data_oggi: 'Data di oggi',
};

/**
 * Template di partenza. Sono transazionali di proposito: senza backend le
 * campagne non esistono (vedi DEROGHE.md), e un template promozionale
 * inviato a mano è il modo più veloce per finire nello spam.
 */
export const BUILTIN_TEMPLATES: EmailTemplate[] = [
  {
    id: 'follow-up',
    name: 'Ripresa contatto',
    description: 'Dopo una chiamata o un incontro, per non perdere il filo.',
    subject: 'Seguito alla nostra conversazione',
    body: `Buongiorno {{nome}},

la ringrazio per il tempo di oggi.

Come anticipato, le lascio un riepilogo dei punti emersi e resto a disposizione
per qualsiasi chiarimento.

Un cordiale saluto,
{{mittente}}`,
  },
  {
    id: 'proposta',
    name: 'Invio proposta',
    description: 'Accompagna una proposta commerciale già preparata.',
    subject: 'Proposta per {{azienda}}',
    body: `Buongiorno {{nome}},

in allegato trova la proposta per {{azienda}}, preparata sulla base di quanto
ci siamo detti.

Resto a disposizione per rivederla insieme.

Un cordiale saluto,
{{mittente}}`,
  },
  {
    id: 'sollecito',
    name: 'Sollecito gentile',
    description: 'Quando una proposta resta senza risposta.',
    subject: 'Aggiornamento sulla proposta',
    body: `Buongiorno {{nome}},

le scrivo per sapere se ha avuto modo di valutare la proposta inviata il
{{data_invio}}.

Se servono modifiche o chiarimenti, mi dica pure.

Un cordiale saluto,
{{mittente}}`,
  },
  {
    id: 'vuoto',
    name: 'Email vuota',
    description: 'Si scrive tutto a mano.',
    subject: '',
    body: '',
  },
];

/** Valori disponibili a partire dai dati del CRM. */
export interface TemplateContext {
  nome?: string;
  cognome?: string;
  nome_completo?: string;
  azienda?: string;
  ruolo?: string;
  email?: string;
  mittente?: string;
  opportunita?: string;
  valore?: string;
  [key: string]: string | undefined;
}

export function buildValues(context: TemplateContext): Record<string, string> {
  const values: Record<string, string> = {};
  Object.entries(context).forEach(([key, value]) => {
    if (value !== undefined && String(value).trim() !== '') values[key] = String(value);
  });
  values.data_oggi = new Date().toLocaleDateString('it-IT', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
  return values;
}

// -------------------------------------------------------------- opt-out

export interface OptOutConfig {
  /** Indirizzo che riceve le richieste di cancellazione. */
  address: string;
  /** Riferimento del contatto, per ritrovarlo. */
  reference: string;
}

/**
 * Piè di pagina con la revoca del consenso.
 *
 * È un `mailto:` e non un link a un clic: senza backend nessuna pagina
 * pubblica può scrivere su Firestore, quindi una revoca «automatica» sarebbe
 * un pulsante che non fa nulla. Meglio una richiesta che arriva davvero a
 * qualcuno. La soluzione vera — una route che scrive con l'SDK admin — è
 * descritta in docs/EMAIL.md.
 */
export function optOutFooter(config: OptOutConfig): string {
  return `\n\n—\nPer non ricevere più comunicazioni commerciali da noi, risponda a questa email` +
    ` oppure scriva a ${config.address} indicando il riferimento ${config.reference}.` +
    `\nLa richiesta viene registrata e ha effetto su tutti gli invii successivi.`;
}

/** Testo semplice → HTML minimo, senza inventare formattazione. */
export function toHtml(text: string): string {
  const escaped = (text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:14px;line-height:1.6;color:#111">` +
    escaped.split(/\n{2,}/).map(block => `<p>${block.replace(/\n/g, '<br>')}</p>`).join('') +
    `</div>`;
}
