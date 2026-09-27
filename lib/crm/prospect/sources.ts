/**
 * La provenienza dei dati.
 *
 * Una riga per ogni raccolta: chi, quando, da dove, quali campi. Non è un log
 * tecnico da guardare quando qualcosa si rompe — è quello che permette di
 * rispondere a «questo indirizzo dove l'avete preso?» con una pagina e una
 * data.
 *
 * Queste righe **non si modificano mai**: una provenienza riscritta non è una
 * provenienza. Si aggiunge e basta, come per l'audit.
 */

import { CrmProspectSource } from '@/types/prospect';
import { SourceKind } from '@/components/crm/ricerca/constants';
import {
  CrmContextRef, createRecord, getRecords, mapBase, byCreatedAtDesc,
} from '../base';
import { writeAudit } from '../audit';
import { PROSPECT_COLLECTIONS, nowIso } from './base';

const COLLECTION_NAME = PROSPECT_COLLECTIONS.sources;

function mapSource(id: string, data: any): CrmProspectSource {
  return {
    ...mapBase(id, data),
    profileId: data.profileId || '',
    searchId: data.searchId || '',
    kind: data.kind || 'manual',
    url: data.url || '',
    fetchedAt: data.fetchedAt || '',
    fields: Array.isArray(data.fields) ? data.fields : [],
    personalData: data.personalData === true,
    snippet: data.snippet || '',
    error: data.error || '',
  };
}

export interface SourceInput {
  profileId: string;
  searchId: string;
  kind: SourceKind;
  url: string;
  fields: string[];
  /** Vero se la raccolta ha toccato dati riferibili a una persona. */
  personalData?: boolean;
  snippet?: string;
  error?: string;
}

/**
 * Registra una raccolta e restituisce l'id, che i campi della scheda si
 * porteranno dietro come `sourceId`.
 *
 * Si registra **anche quando fallisce**: «il sito ha rifiutato la connessione»
 * è un'informazione che serve, e senza questa riga la scheda avrebbe un campo
 * vuoto senza spiegazione.
 */
export async function recordSource(ctx: CrmContextRef, input: SourceInput): Promise<string | null> {
  const id = await createRecord(COLLECTION_NAME, ctx, {
    profileId: input.profileId || '',
    searchId: input.searchId || '',
    kind: input.kind,
    url: input.url || '',
    fetchedAt: nowIso(),
    fields: input.fields || [],
    personalData: input.personalData === true,
    snippet: (input.snippet || '').slice(0, 2000),
    error: input.error || '',
  }, 'integration');

  if (id && input.personalData) {
    // Tracciata a parte perché è la raccolta che fa scattare gli obblighi:
    // deve restare trovabile anche se la scheda viene archiviata.
    await writeAudit(ctx, 'prospect.personal_data_collected', 'prospect_source', id, null, {
      profileId: input.profileId, kind: input.kind, url: input.url, fields: input.fields,
    });
  }
  return id;
}

export async function getSourcesForProfile(projectId: string, profileId: string): Promise<CrmProspectSource[]> {
  const tutte = await getRecords<CrmProspectSource>(COLLECTION_NAME, projectId, mapSource);
  return tutte.filter(s => s.profileId === profileId).sort(byCreatedAtDesc);
}

/**
 * Le raccolte che hanno toccato dati personali.
 *
 * Serve a due domande che arrivano insieme: «cosa avete su questa persona» e
 * «da dove viene». Senza questo filtro si risponderebbe rileggendo tutto.
 */
export async function getPersonalDataSources(projectId: string): Promise<CrmProspectSource[]> {
  const tutte = await getRecords<CrmProspectSource>(COLLECTION_NAME, projectId, mapSource);
  return tutte.filter(s => s.personalData).sort(byCreatedAtDesc);
}
