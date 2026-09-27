/**
 * Esecuzione dell'importazione su Firestore.
 *
 * Non passa da createLead/createAccount/createContact di proposito: quelle
 * fanno una query duplicati e una voce di audit per record, che su mille righe
 * diventano migliaia di operazioni. Qui i duplicati sono già stati calcolati in
 * memoria (plan.ts) e l'audit è uno solo per importazione, con il suo
 * identificativo stampato su ogni record.
 */

import { db } from '@/lib/firebase';
import { collection, doc, writeBatch, serverTimestamp, increment } from 'firebase/firestore';
import { CrmConsents } from '@/types/crm';
import { CrmContextRef, buildBasePayload } from '../base';
import { normalizeEmail, normalizePhone, extractDomain } from '../helpers';
import { writeAudit } from '../audit';
import { ImportEntity } from './mapping';
import { ImportPlan, DuplicatePolicy, PlannedRow, willImport, DEFAULT_IMPORTED_STATE } from './plan';

/** Firestore accetta al massimo 500 operazioni per batch: si sta sotto. */
const BATCH_SIZE = 400;

const COLLECTIONS: Record<ImportEntity, string> = {
  lead: 'crm_leads',
  account: 'crm_accounts',
  contact: 'crm_contacts',
};

export interface ImportOptions {
  policy: DuplicatePolicy;
  /** Fonte da scrivere sui record che non ne portano una dal file. */
  defaultSource: string;
  ownerUid: string;
  /** Versione dell'informativa associata ai consensi dichiarati nel file. */
  policyVersion: string;
  fileName: string;
}

export interface ImportOutcome {
  batchId: string;
  created: string[];
  updated: string[];
  skipped: number;
  /** Righe non scritte per un errore di Firestore, con il motivo. */
  failed: { lineNumber: number; reason: string }[];
}

// ------------------------------------------------------------- payload

function consentsFrom(values: Record<string, any>, options: ImportOptions): CrmConsents {
  const granted = values.consentEmail === true;
  const consent = {
    granted,
    source: `import:${options.fileName}`,
    // La data del consenso è quella dichiarata dal file, non quella di oggi:
    // senza colonna dedicata resta assente, ed è corretto così.
    policyVersion: granted ? options.policyVersion : '',
  };
  return {
    email: consent,
    // Nessun file porta un consenso SMS verificabile, e senza backend gli SMS
    // non partono comunque: resta negato.
    sms: { granted: false, source: `import:${options.fileName}`, policyVersion: '' },
  };
}

function leadPayload(values: Record<string, any>, options: ImportOptions) {
  const email = values.email || '';
  const phone = values.phone || '';
  return {
    fullName: values.fullName || '',
    companyName: values.companyName || '',
    email,
    emailNormalized: normalizeEmail(email),
    phone,
    phoneNormalized: normalizePhone(phone),
    address: values.address || '',
    city: values.city || '',
    postalCode: values.postalCode || '',
    country: values.country || 'IT',
    companyDomain: values.companyDomain || extractDomain(email),
    source: values.source || options.defaultSource,
    ownerUid: options.ownerUid,
    state: values.state || DEFAULT_IMPORTED_STATE,
    estimatedValue: typeof values.estimatedValue === 'number' ? values.estimatedValue : 0,
    currency: 'EUR',
    notes: values.notes || '',
    lastContactAt: values.lastContactAt || null,
    nextFollowupAt: values.nextFollowupAt || null,
    consents: consentsFrom(values, options),
    convertedAt: null,
    convertedAccountId: '',
    convertedContactId: '',
    convertedCustomerId: '',
    convertedOpportunityId: '',
    duplicateOf: '',
    duplicateCandidateIds: [] as string[],
    lostReason: '',
  };
}

function accountPayload(values: Record<string, any>, options: ImportOptions) {
  const website = values.website || '';
  return {
    legalName: values.legalName || '',
    displayName: values.displayName || values.legalName || '',
    domain: extractDomain(website),
    website,
    industry: values.industry || '',
    sizeRange: values.sizeRange || '',
    country: values.country || 'IT',
    region: values.region || '',
    city: values.city || '',
    address: values.address || '',
    postalCode: values.postalCode || '',
    vatNumber: values.vatNumber || '',
    taxCode: values.taxCode || '',
    ownerUid: options.ownerUid,
    sources: [values.source || options.defaultSource].filter(Boolean),
    notes: values.notes || '',
    logoUrl: '',
    linkedinUrl: values.linkedinUrl || '',
    duplicateCandidateIds: [] as string[],
  };
}

function contactPayload(values: Record<string, any>, options: ImportOptions, accountId: string) {
  const email = values.email || '';
  const phone = values.phone || '';
  const fullName = values.fullName || [values.firstName, values.lastName].filter(Boolean).join(' ');
  return {
    firstName: values.firstName || '',
    lastName: values.lastName || '',
    fullName,
    initials: fullName.split(/\s+/).filter(Boolean).slice(0, 2).map((p: string) => p[0].toUpperCase()).join(''),
    role: values.role || '',
    email,
    emailNormalized: normalizeEmail(email),
    phone,
    phoneNormalized: normalizePhone(phone),
    accountId,
    isPrimary: false,
    preferredChannel: '' as const,
    preferredTime: '',
    consents: consentsFrom(values, options),
    suppressed: false,
    suppressedReason: '',
    linkedinUrl: values.linkedinUrl || '',
    photoURL: '',
    notes: values.notes || '',
    duplicateCandidateIds: [] as string[],
  };
}

/**
 * Campi che un aggiornamento su record esistente può toccare: solo quelli
 * arrivati dal file e non vuoti. Un'importazione non deve cancellare dati già
 * presenti perché la colonna corrispondente era vuota nel foglio.
 */
function updatePayload(entity: ImportEntity, values: Record<string, any>, options: ImportOptions) {
  const full = entity === 'lead'
    ? leadPayload(values, options)
    : entity === 'account'
      ? accountPayload(values, options)
      : contactPayload(values, options, values.accountId || '');

  const payload: Record<string, any> = {};
  Object.entries(full).forEach(([key, value]) => {
    if (value === '' || value === null || value === 0) return;
    if (Array.isArray(value) && value.length === 0) return;
    payload[key] = value;
  });

  // Lo stato non si sovrascrive da un'importazione: cambierebbe senza passare
  // dalla validazione delle transizioni.
  delete payload.state;
  delete payload.consents;
  delete payload.ownerUid;

  return payload;
}

// ------------------------------------------------------------ esecuzione

export interface ImportProgress {
  written: number;
  total: number;
}

/**
 * Scrive il piano. `onProgress` viene chiamato a ogni batch: su file grandi
 * l'operazione dura, e la schermata deve poterlo dire.
 */
export async function runImport(
  ctx: CrmContextRef,
  plan: ImportPlan,
  options: ImportOptions,
  onProgress?: (progress: ImportProgress) => void
): Promise<ImportOutcome> {
  const collectionName = COLLECTIONS[plan.entity];
  const batchId = `imp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

  const toWrite = plan.rows.filter(row => willImport(row, options.policy));
  const outcome: ImportOutcome = {
    batchId,
    created: [],
    updated: [],
    skipped: plan.rows.length - toWrite.length,
    failed: [],
  };

  const importStamp = {
    origin: 'import' as const,
    provider: options.fileName,
    sourceRef: batchId,
    // Nessuno ha riletto riga per riga: i record importati restano da approvare.
    approvalStatus: 'pending' as const,
  };

  for (let start = 0; start < toWrite.length; start += BATCH_SIZE) {
    const chunk = toWrite.slice(start, start + BATCH_SIZE);
    const batch = writeBatch(db);
    const created: string[] = [];
    const updated: string[] = [];

    chunk.forEach((row: PlannedRow) => {
      const isUpdate =
        options.policy === 'update' &&
        row.duplicate?.scope === 'existing' &&
        row.duplicate.reference;

      if (isUpdate) {
        const id = row.duplicate!.reference;
        batch.update(doc(db, collectionName, id), {
          ...updatePayload(plan.entity, row.values, options),
          externalId: row.values.externalId || '',
          updatedAt: serverTimestamp(),
          updatedBy: ctx.uid,
          version: increment(1),
        });
        updated.push(id);
        return;
      }

      const ref = doc(collection(db, collectionName));
      const payload =
        plan.entity === 'lead' ? leadPayload(row.values, options)
        : plan.entity === 'account' ? accountPayload(row.values, options)
        : contactPayload(row.values, options, row.values.accountId || '');

      batch.set(ref, {
        ...payload,
        ...buildBasePayload(ctx, 'import'),
        ...importStamp,
        externalId: row.values.externalId || '',
        // Il duplicato trovato resta segnalato sul record, mai fuso in automatico.
        duplicateCandidateIds: row.duplicate?.scope === 'existing' ? [row.duplicate.reference] : [],
      });
      created.push(ref.id);
    });

    try {
      await batch.commit();
      outcome.created.push(...created);
      outcome.updated.push(...updated);
    } catch (error) {
      console.error('Error committing CRM import batch:', error);
      const reason = error instanceof Error ? error.message : 'Scrittura non riuscita';
      chunk.forEach(row => outcome.failed.push({ lineNumber: row.lineNumber, reason }));
    }

    onProgress?.({ written: Math.min(start + chunk.length, toWrite.length), total: toWrite.length });
  }

  await writeAudit(ctx, 'import.run', plan.entity, batchId, null, {
    fileName: options.fileName,
    policy: options.policy,
  }, {
    batchId,
    created: outcome.created.length,
    updated: outcome.updated.length,
    skipped: outcome.skipped,
    failed: outcome.failed.length,
    fields: plan.mappedFields,
  });

  return outcome;
}

/**
 * Annulla un'importazione archiviando i record creati.
 * Vale solo sui record creati: gli aggiornamenti a record preesistenti non si
 * ripristinano da qui, perché i valori di prima non sono conservati.
 */
export async function rollbackImport(
  ctx: CrmContextRef,
  entity: ImportEntity,
  outcome: ImportOutcome
): Promise<number> {
  const collectionName = COLLECTIONS[entity];
  let archived = 0;

  for (let start = 0; start < outcome.created.length; start += BATCH_SIZE) {
    const chunk = outcome.created.slice(start, start + BATCH_SIZE);
    const batch = writeBatch(db);
    chunk.forEach(id => {
      batch.update(doc(db, collectionName, id), {
        archived: true,
        archivedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: ctx.uid,
        version: increment(1),
      });
    });
    try {
      await batch.commit();
      archived += chunk.length;
    } catch (error) {
      console.error('Error rolling back CRM import batch:', error);
    }
  }

  await writeAudit(ctx, 'import.rollback', entity, outcome.batchId, null, null, {
    batchId: outcome.batchId,
    archived,
    updatedNotReverted: outcome.updated.length,
  });

  return archived;
}
