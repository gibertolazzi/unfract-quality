/**
 * La lista di esclusione: chi non va più cercato.
 *
 * È il requisito 4 del §8 del piano, e non è un adempimento da mettere in
 * fondo. Il diritto di opposizione senza un modo di **trovare** chi l'ha
 * esercitato e di **bloccarne la riricerca** dura fino al primo collega che
 * quel giorno non c'era: rifà la stessa ricerca, e lo strumento ricomincia da
 * capo su qualcuno che aveva chiesto di essere lasciato in pace.
 *
 * Tre cose su come è fatta:
 *
 * 1. **Si controlla prima di qualunque cosa.** Non dopo aver interrogato VIES,
 *    non dopo aver letto il sito: prima. Una ricerca bloccata non deve aver
 *    toccato la rete.
 * 2. **Non si cancella.** Un'esclusione revocata si archivia, con chi l'ha
 *    revocata e quando. Cancellarla renderebbe impossibile dimostrare di
 *    averla rispettata nel periodo in cui era in vigore.
 * 3. **Blocca anche il passaggio al CRM**, non solo la ricerca. Chi ha chiesto
 *    di non essere cercato non deve trovarsi in un elenco da chiamare, e una
 *    scheda raccolta prima della richiesta è esattamente il modo in cui ci
 *    finirebbe.
 *
 * Le funzioni di confronto sono **pure** e si provano eseguendole.
 */

import { CrmProspectExclusion } from '@/types/prospect';
import { ExclusionKind, EXCLUSION_KIND_LABELS } from '@/components/crm/ricerca/constants';
import {
  CrmContextRef, createRecord, updateRecord, getRecords, subscribeToRecords,
  mapBase, byCreatedAtDesc, normalizeEmail,
} from '../base';
import { writeAudit } from '../audit';
import { PROSPECT_COLLECTIONS, nowIso, normalizeVat, normalizeDomain } from './base';
import { matchCompanyNames, normalizeCompanyName } from './names';

const COLLECTION_NAME = PROSPECT_COLLECTIONS.exclusions;

function mapExclusion(id: string, data: any): CrmProspectExclusion {
  return {
    ...mapBase(id, data),
    kind: data.kind || 'domain',
    value: data.value || '',
    rawValue: data.rawValue || '',
    reason: data.reason || '',
    requestedBy: data.requestedBy || '',
    requestedAt: data.requestedAt || '',
    liftedBy: data.liftedBy || '',
    liftedAt: data.liftedAt || '',
  };
}

// -------------------------------------------------------------- confronto

/** Il valore in forma confrontabile, secondo il tipo di chiave. */
export function normalizeExclusionValue(kind: ExclusionKind, raw: string): string {
  switch (kind) {
    case 'vat':    return normalizeVat(raw);
    case 'domain': return normalizeDomain(raw);
    case 'email':  return normalizeEmail(raw);
    case 'name':   return normalizeCompanyName(raw);
    default:       return String(raw || '').trim().toLowerCase();
  }
}

/** Le chiavi con cui si presenta un soggetto da confrontare con la lista. */
export interface ExclusionTarget {
  vatNumber?: string;
  domain?: string;
  email?: string;
  name?: string;
}

/**
 * Vero se questa esclusione copre quel soggetto.
 *
 * Partita IVA, dominio e email si confrontano **esatti**. Il nome no: due
 * aziende possono chiamarsi quasi uguale, e qui si usa lo stesso confronto
 * della ricerca per nome. Sul nome si è volutamente **larghi**: fra escludere
 * per errore un'azienda che non aveva chiesto niente e cercare qualcuno che
 * aveva chiesto di essere lasciato in pace, il primo errore si ripara con una
 * telefonata e il secondo no.
 */
export function exclusionMatches(exclusion: CrmProspectExclusion, target: ExclusionTarget): boolean {
  if (exclusion.archived) return false;
  const valore = exclusion.value;
  if (!valore) return false;

  switch (exclusion.kind) {
    case 'vat':
      return Boolean(target.vatNumber) && normalizeVat(target.vatNumber!) === valore;
    case 'domain':
      return Boolean(target.domain) && normalizeDomain(target.domain!) === valore;
    case 'email':
      return Boolean(target.email) && normalizeEmail(target.email!) === valore;
    case 'name':
      return Boolean(target.name) && matchCompanyNames(target.name!, valore).kind !== '';
    default:
      return false;
  }
}

/** La prima esclusione che copre il soggetto, o `null`. Pura. */
export function findExclusion(
  exclusions: CrmProspectExclusion[],
  target: ExclusionTarget
): CrmProspectExclusion | null {
  return exclusions.find(e => exclusionMatches(e, target)) || null;
}

/**
 * Cosa mostrare quando una ricerca è bloccata.
 *
 * Dice **perché** e **da quando**, non «operazione non consentita»: chi legge
 * deve poter capire se è un errore — il nome che somiglia a un altro — o una
 * richiesta vera da rispettare.
 */
export function describeExclusion(exclusion: CrmProspectExclusion): string {
  const quando = exclusion.requestedAt
    ? new Date(exclusion.requestedAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })
    : '';
  const dettagli = [
    exclusion.requestedBy && `richiesta da ${exclusion.requestedBy}`,
    quando && `il ${quando}`,
  ].filter(Boolean).join(', ');

  return `Questo soggetto è nella lista di esclusione (${EXCLUSION_KIND_LABELS[exclusion.kind]}: ${exclusion.rawValue || exclusion.value})`
    + (dettagli ? `, ${dettagli}` : '')
    + '. Non si cerca e non si porta nel CRM.'
    + (exclusion.reason ? ` Motivo registrato: ${exclusion.reason}` : '');
}

// ------------------------------------------------------------- Firestore

export async function getExclusions(projectId: string): Promise<CrmProspectExclusion[]> {
  // Gli archiviati si leggono comunque: servono a dimostrare cosa era in
  // vigore e quando. `exclusionMatches` li scarta da solo.
  const tutte = await getRecords<CrmProspectExclusion>(COLLECTION_NAME, projectId, mapExclusion, { includeArchived: true });
  return tutte.sort(byCreatedAtDesc);
}

export function subscribeToExclusions(projectId: string, callback: (e: CrmProspectExclusion[]) => void) {
  return subscribeToRecords<CrmProspectExclusion>(COLLECTION_NAME, projectId, mapExclusion,
    elenco => callback(elenco.sort(byCreatedAtDesc)), { includeArchived: true });
}

export interface ExclusionInput {
  kind: ExclusionKind;
  value: string;
  reason: string;
  requestedBy: string;
}

export async function addExclusion(ctx: CrmContextRef, input: ExclusionInput): Promise<string | null> {
  const valore = normalizeExclusionValue(input.kind, input.value);
  if (!valore) {
    console.error('Esclusione senza valore riconoscibile:', input);
    return null;
  }

  const id = await createRecord(COLLECTION_NAME, ctx, {
    kind: input.kind,
    value: valore,
    rawValue: String(input.value || '').trim(),
    reason: input.reason || '',
    requestedBy: input.requestedBy || '',
    requestedAt: nowIso(),
    liftedBy: '',
    liftedAt: '',
  }, 'manual');

  if (id) {
    await writeAudit(ctx, 'prospect.exclusion_added', 'prospect_exclusion', id, null, {
      kind: input.kind, value: valore, requestedBy: input.requestedBy,
    });
  }
  return id;
}

/**
 * Revoca un'esclusione. **Non la cancella**: la archivia, con chi e quando.
 *
 * Una lista da cui si può cancellare non dimostra niente: fra sei mesi, alla
 * domanda «avete continuato a cercarli?», la risposta deve poter essere una
 * riga con una data, non l'assenza di una riga.
 */
export async function liftExclusion(ctx: CrmContextRef, id: string, why: string): Promise<void> {
  await updateRecord(COLLECTION_NAME, id, {
    archived: true,
    archivedAt: nowIso(),
    liftedBy: ctx.uid,
    liftedAt: nowIso(),
    reason: why,
  }, ctx.uid);
  await writeAudit(ctx, 'prospect.exclusion_lifted', 'prospect_exclusion', id, null, { why });
}

/**
 * Il controllo da fare prima di cercare o di portare qualcosa nel CRM.
 *
 * Legge la lista a ogni chiamata invece di tenersela in memoria: una lista di
 * esclusione vecchia di dieci minuti è una lista che non vale, e il costo di
 * una lettura in più è trascurabile rispetto a quello di una ricerca fatta su
 * chi aveva chiesto di non esserlo.
 */
export async function checkExcluded(
  projectId: string,
  target: ExclusionTarget
): Promise<CrmProspectExclusion | null> {
  try {
    return findExclusion(await getExclusions(projectId), target);
  } catch (error) {
    // Se la lista non si legge **non si procede**: non sapere se qualcuno è
    // escluso non è come sapere che non lo è.
    console.error('Lista di esclusione non leggibile:', error);
    throw new Error('La lista di esclusione non è leggibile: la ricerca è stata fermata per prudenza.');
  }
}
