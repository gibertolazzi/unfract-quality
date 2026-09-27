/**
 * Fondamenta della sezione «Ricerca aziende»: nomi delle collezioni, il
 * portatore di provenienza, la chiave di deduplicazione e la freschezza.
 *
 * Le funzioni di questo file sono **pure**: niente Firebase, niente React. Si
 * provano eseguendole, ed è quello che fa `crm/verifica/esegui.mjs`.
 */

import {
  EvidenceLevel, SourceKind, SOURCE_EVIDENCE,
  FreshnessArea, FRESHNESS_DAYS, ConfidenceLevel,
} from '@/components/crm/ricerca/constants';
import { Evidenced, Estimated } from '@/types/prospect';

/**
 * Le cinque collezioni. Restano separate dalle dieci del CRM: hanno un ciclo
 * di vita diverso — si riempiono da sole, invecchiano, e vanno potute
 * cancellare in blocco se qualcuno esercita il diritto di opposizione.
 */
export const PROSPECT_COLLECTIONS = {
  profiles:   'crm_company_profiles',
  searches:   'crm_prospect_searches',
  reports:    'crm_prospect_reports',
  sources:    'crm_prospect_sources',
  exclusions: 'crm_prospect_exclusions',
} as const;

export const nowIso = (): string => new Date().toISOString();

// ------------------------------------------------------ Portare la verità

/**
 * Un dato che non è stato trovato.
 *
 * Esiste perché la scheda non abbia **buchi muti**: `value: null` con scritto
 * accanto perché. «Non dichiarato dall'azienda» e «il sito ha rifiutato la
 * connessione» portano chi legge a due decisioni diverse, e un campo vuoto le
 * confonde in una sola.
 */
export function missing<T>(note: string, evidence: EvidenceLevel = 'declared'): Evidenced<T> {
  return { value: null, evidence, sourceId: '', at: '', note };
}

/** Un dato trovato, con la fonte che lo sostiene. */
export function evidenced<T>(
  value: T,
  kind: SourceKind,
  sourceId: string,
  at: string = nowIso(),
  note = ''
): Evidenced<T> {
  return { value, evidence: SOURCE_EVIDENCE[kind], sourceId, at, note };
}

/**
 * Una stima. Il tipo obbliga a passare i segnali: una stima senza il perché è
 * un'opinione con l'aria di un dato, ed è esattamente ciò che questa sezione
 * non deve produrre.
 */
export function estimated<T>(
  value: T | null,
  confidence: ConfidenceLevel,
  signals: string[],
  sourceId = '',
  at: string = nowIso(),
  note = ''
): Estimated<T> {
  return { value, evidence: 'estimated', confidence, signals, sourceId, at, note };
}

/** Vero quando il valore c'è davvero: `null`, stringa vuota e liste vuote no. */
export function hasValue<T>(field: Evidenced<T> | undefined | null): boolean {
  if (!field || field.value === null || field.value === undefined) return false;
  if (typeof field.value === 'string') return field.value.trim() !== '';
  if (Array.isArray(field.value)) return field.value.length > 0;
  return true;
}

// ------------------------------------------------------- Identificazione

/**
 * Partita IVA in forma confrontabile: solo cifre, senza il prefisso `IT`.
 *
 * Qui si **normalizza soltanto**. La validazione con la cifra di controllo
 * arriva nella fase dell'identità: dire «non valida» è una conclusione, e va
 * fatta dove c'è anche VIES a smentirla o confermarla.
 */
export function normalizeVat(raw: string): string {
  const pulito = String(raw || '').toUpperCase().replace(/[\s.\-\/]/g, '');
  return pulito.replace(/^IT/, '').replace(/[^0-9]/g, '');
}

/** Dominio confrontabile: minuscolo, senza schema, `www.` e percorso. */
export function normalizeDomain(raw: string): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split(/[\/?#]/)[0]
    .replace(/\.$/, '');
}

/**
 * La chiave con cui si riconosce un'azienda già cercata.
 *
 * La partita IVA vince sul dominio perché è l'unica cosa che un registro
 * ufficiale conferma: due domini diversi possono essere la stessa azienda, e
 * lo stesso dominio può ospitare due società del gruppo.
 */
export function lookupKeyFor(vatNumber: string, domain: string): string {
  const piva = normalizeVat(vatNumber);
  if (piva) return `vat:${piva}`;
  const dominio = normalizeDomain(domain);
  if (dominio) return `domain:${dominio}`;
  return '';
}

// ---------------------------------------------------------- Invecchiare

/** Giorni interi trascorsi da una data ISO. `-1` se la data manca o è illeggibile. */
export function ageInDays(iso: string, now: Date = new Date()): number {
  if (!iso) return -1;
  const quando = Date.parse(iso);
  if (Number.isNaN(quando)) return -1;
  return Math.floor((now.getTime() - quando) / 86_400_000);
}

/**
 * Se un'area della scheda è da rinfrescare.
 *
 * Un'area **mai raccolta** è vecchia per definizione: non avendo niente da
 * mostrare, va rifatta al primo aggiornamento utile.
 */
export function isStale(iso: string, area: FreshnessArea, now: Date = new Date()): boolean {
  const eta = ageInDays(iso, now);
  if (eta < 0) return true;
  return eta >= FRESHNESS_DAYS[area];
}

/** «raccolta 3 giorni fa», da mettere accanto al dato senza farla cercare. */
export function freshnessLabel(iso: string, now: Date = new Date()): string {
  const eta = ageInDays(iso, now);
  if (eta < 0) return 'mai raccolta';
  if (eta === 0) return 'raccolta oggi';
  if (eta === 1) return 'raccolta ieri';
  if (eta < 30) return `raccolta ${eta} giorni fa`;
  const mesi = Math.floor(eta / 30);
  return mesi === 1 ? 'raccolta un mese fa' : `raccolta ${mesi} mesi fa`;
}
