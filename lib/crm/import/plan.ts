/**
 * Dal file mappato al piano di importazione: un record per riga, con errori,
 * avvisi e duplicati già calcolati.
 *
 * Il confronto con l'esistente avviene in memoria sui record già caricati dalla
 * pagina, non con una query per riga: con la deroga 2 (nessun backend) mille
 * righe significherebbero mille letture Firestore. Vedi docs/DEROGHE.md.
 */

import { CrmLead, CrmAccount, CrmContact } from '@/types/crm';
import { TableRow } from './parse';
import { LeadState } from '@/components/crm/constants';
import { normalizeEmail, normalizePhone, extractDomain } from '../helpers';
import {
  ImportEntity, TargetField, TARGET_FIELDS, IDENTIFYING_FIELDS,
  ColumnMapping, coerce, splitName,
} from './mapping';

export type DuplicateScope = 'existing' | 'file';

export interface DuplicateHit {
  scope: DuplicateScope;
  /** Id del record esistente, oppure numero di riga nel file. */
  reference: string;
  label: string;
  matchedOn: string[];
}

export interface PlannedRow {
  /** Numero di riga nel foglio, quello che l'utente legge in Excel. */
  lineNumber: number;
  /** Valori convertiti, pronti per la scrittura. */
  values: Record<string, any>;
  errors: string[];
  warnings: string[];
  duplicate: DuplicateHit | null;
  /** Escludi questa riga dall'importazione. */
  excluded: boolean;
}

export interface ImportPlan {
  entity: ImportEntity;
  rows: PlannedRow[];
  mappedFields: string[];
  /** Colonne del file lasciate fuori dalla mappatura. */
  ignoredColumns: string[];
}

export type DuplicatePolicy = 'skip' | 'import' | 'update';

// --------------------------------------------------------------- indice

interface ExistingIndex {
  byEmail: Map<string, { id: string; label: string }>;
  byPhone: Map<string, { id: string; label: string }>;
  byName: Map<string, { id: string; label: string }>;
  byDomain: Map<string, { id: string; label: string }>;
  byExternalId: Map<string, { id: string; label: string }>;
}

const emptyIndex = (): ExistingIndex => ({
  byEmail: new Map(), byPhone: new Map(), byName: new Map(),
  byDomain: new Map(), byExternalId: new Map(),
});

/** Chiave nome+azienda: due "Mario Rossi" di aziende diverse non sono lo stesso. */
const nameKey = (name: string, company: string) =>
  `${(name || '').trim().toLowerCase()}|${(company || '').trim().toLowerCase()}`;

export interface ExistingRecords {
  leads: CrmLead[];
  accounts: CrmAccount[];
  contacts: CrmContact[];
}

function buildIndex(entity: ImportEntity, existing: ExistingRecords): ExistingIndex {
  const index = emptyIndex();
  const put = (map: Map<string, any>, key: string, value: { id: string; label: string }) => {
    if (key && !map.has(key)) map.set(key, value);
  };

  if (entity === 'lead') {
    existing.leads.forEach(lead => {
      const entry = { id: lead.id, label: lead.fullName || lead.companyName || lead.email };
      put(index.byEmail, lead.emailNormalized, entry);
      put(index.byPhone, lead.phoneNormalized, entry);
      put(index.byName, nameKey(lead.fullName, lead.companyName), entry);
      put(index.byExternalId, lead.externalId || '', entry);
    });
  } else if (entity === 'account') {
    existing.accounts.forEach(account => {
      const entry = { id: account.id, label: account.displayName || account.legalName };
      put(index.byDomain, account.domain, entry);
      put(index.byName, nameKey(account.legalName || account.displayName, ''), entry);
      put(index.byExternalId, account.externalId || '', entry);
      // La partita IVA identifica l'azienda meglio del nome.
      put(index.byPhone, account.vatNumber ? `vat:${account.vatNumber}` : '', entry);
    });
  } else {
    existing.contacts.forEach(contact => {
      const entry = { id: contact.id, label: contact.fullName || contact.email };
      put(index.byEmail, contact.emailNormalized, entry);
      put(index.byPhone, contact.phoneNormalized, entry);
      put(index.byName, nameKey(contact.fullName, ''), entry);
      put(index.byExternalId, contact.externalId || '', entry);
    });
  }

  return index;
}

// ----------------------------------------------------------------- piano

/** Chiavi di confronto di una riga già convertita. */
function keysOf(entity: ImportEntity, values: Record<string, any>) {
  const email = normalizeEmail(values.email || '');
  const phone = normalizePhone(values.phone || '');

  if (entity === 'account') {
    return {
      email: '',
      phone: values.vatNumber ? `vat:${values.vatNumber}` : '',
      domain: extractDomain(values.website || values.domain || ''),
      name: nameKey(values.legalName || values.displayName || '', ''),
      externalId: values.externalId || '',
    };
  }
  if (entity === 'contact') {
    return {
      email, phone, domain: '',
      name: nameKey(values.fullName || `${values.firstName || ''} ${values.lastName || ''}`, ''),
      externalId: values.externalId || '',
    };
  }
  return {
    email, phone,
    domain: '',
    name: nameKey(values.fullName || '', values.companyName || ''),
    externalId: values.externalId || '',
  };
}

export interface BuildPlanInput {
  entity: ImportEntity;
  rows: TableRow[];
  mapping: ColumnMapping;
  existing: ExistingRecords;
}

export function buildImportPlan({
  entity, rows, mapping, existing,
}: BuildPlanInput): ImportPlan {
  const fields = TARGET_FIELDS[entity];
  const fieldByKey = new Map<string, TargetField>(fields.map(f => [f.key, f]));
  const index = buildIndex(entity, existing);

  const mappedFields = Array.from(new Set(Object.values(mapping).filter(Boolean)));
  const ignoredColumns = Object.entries(mapping).filter(([, key]) => !key).map(([column]) => column);
  const identifying = IDENTIFYING_FIELDS[entity];

  // Duplicati interni al file: si popola mentre si scorre.
  const seen = emptyIndex();

  const planned: PlannedRow[] = rows.map(({ line: lineNumber, values: row }) => {
    const values: Record<string, any> = {};
    const errors: string[] = [];
    const warnings: string[] = [];

    Object.entries(mapping).forEach(([column, key]) => {
      if (!key) return;
      const field = fieldByKey.get(key);
      if (!field) return;

      const result = coerce(field, row[column] ?? '');
      if (result.error) errors.push(result.error);
      if (result.warning) warnings.push(result.warning);

      // Un errore non azzera un valore già valido arrivato da un'altra colonna
      // mappata sullo stesso campo.
      if (!result.error && (result.value !== '' || values[key] === undefined)) {
        values[key] = result.value;
      }
    });

    // Nome e cognome: si completano a vicenda.
    if (entity === 'contact') {
      if (!values.firstName && !values.lastName && values.fullName) {
        const split = splitName(values.fullName);
        values.firstName = split.firstName;
        values.lastName = split.lastName;
      }
      if (!values.fullName) {
        values.fullName = [values.firstName, values.lastName].filter(Boolean).join(' ');
      }
    }
    if (entity === 'account' && !values.displayName) values.displayName = values.legalName || '';
    if (entity === 'account' && !values.legalName) values.legalName = values.displayName || '';

    if (!identifying.some(key => String(values[key] || '').trim())) {
      const labels = identifying.map(key => fieldByKey.get(key)?.label || key).join(', ');
      errors.push(`Riga senza dati identificativi (serve almeno uno fra: ${labels})`);
    }

    // Duplicati: prima dentro al file, poi contro l'esistente.
    const keys = keysOf(entity, values);
    let duplicate: DuplicateHit | null = null;

    const lookup = (source: ExistingIndex, scope: DuplicateScope) => {
      const matches: { hit: { id: string; label: string }; on: string }[] = [];
      if (keys.externalId && source.byExternalId.has(keys.externalId)) {
        matches.push({ hit: source.byExternalId.get(keys.externalId)!, on: 'ID di origine' });
      }
      if (keys.email && source.byEmail.has(keys.email)) {
        matches.push({ hit: source.byEmail.get(keys.email)!, on: 'email' });
      }
      if (keys.phone && source.byPhone.has(keys.phone)) {
        matches.push({ hit: source.byPhone.get(keys.phone)!, on: keys.phone.startsWith('vat:') ? 'partita IVA' : 'telefono' });
      }
      if (keys.domain && source.byDomain.has(keys.domain)) {
        matches.push({ hit: source.byDomain.get(keys.domain)!, on: 'dominio' });
      }
      if (keys.name && !keys.name.startsWith('|') && source.byName.has(keys.name)) {
        matches.push({ hit: source.byName.get(keys.name)!, on: 'nome' });
      }
      if (matches.length === 0) return null;

      // Tutte le corrispondenze che puntano allo stesso record si sommano.
      const primary = matches[0].hit;
      const sameRecord = matches.filter(m => m.hit.id === primary.id);
      return {
        scope,
        reference: primary.id,
        label: primary.label,
        matchedOn: sameRecord.map(m => m.on),
      } as DuplicateHit;
    };

    duplicate = lookup(seen, 'file') || lookup(index, 'existing');

    const remember = (map: Map<string, any>, key: string) => {
      if (key && !map.has(key)) {
        map.set(key, { id: String(lineNumber), label: `riga ${lineNumber}` });
      }
    };
    remember(seen.byEmail, keys.email);
    remember(seen.byPhone, keys.phone);
    remember(seen.byDomain, keys.domain);
    remember(seen.byExternalId, keys.externalId);
    if (!keys.name.startsWith('|')) remember(seen.byName, keys.name);

    return { lineNumber, values, errors, warnings, duplicate, excluded: false };
  });

  return { entity, rows: planned, mappedFields, ignoredColumns };
}

// ----------------------------------------------------------------- conteggi

export interface PlanCounts {
  total: number;
  importable: number;
  withErrors: number;
  withWarnings: number;
  duplicatesExisting: number;
  duplicatesInFile: number;
  excluded: number;
}

/** Dice se una riga finirà davvero su Firestore, data la politica sui duplicati. */
export function willImport(row: PlannedRow, policy: DuplicatePolicy): boolean {
  if (row.excluded || row.errors.length > 0) return false;
  if (row.duplicate && policy === 'skip') return false;
  // Un doppione interno al file va scritto una volta sola, qualunque politica.
  if (row.duplicate?.scope === 'file' && policy !== 'import') return false;
  return true;
}

export function countPlan(plan: ImportPlan, policy: DuplicatePolicy): PlanCounts {
  return {
    total: plan.rows.length,
    importable: plan.rows.filter(row => willImport(row, policy)).length,
    withErrors: plan.rows.filter(row => row.errors.length > 0).length,
    withWarnings: plan.rows.filter(row => row.warnings.length > 0).length,
    duplicatesExisting: plan.rows.filter(row => row.duplicate?.scope === 'existing').length,
    duplicatesInFile: plan.rows.filter(row => row.duplicate?.scope === 'file').length,
    excluded: plan.rows.filter(row => row.excluded).length,
  };
}

/** Stato di default dei lead importati, se il file non porta una colonna stato. */
export const DEFAULT_IMPORTED_STATE: LeadState = 'NEW';
