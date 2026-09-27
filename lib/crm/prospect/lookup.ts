/**
 * Un campo solo, e la sezione capisce da sé cosa ci hai scritto.
 *
 * È il punto d'ingresso di tutta la ricerca. Chiedere all'utente di dichiarare
 * con un menù a tendina se sta scrivendo una partita IVA o un nome è il modo
 * più rapido di farlo sbagliare: chi incolla `IT 00743110157` da una email non
 * ha voglia di scegliere anche la categoria.
 *
 * | Cosa scrivi | Cosa succede | Costa |
 * |---|---|---|
 * | `00743110157` | VIES, e la scheda in un colpo | no |
 * | `illy.com` | si legge il sito, se ne prende la P.IVA, VIES conferma | no |
 * | `Illycaffè` | si guarda in archivio e si propongono i candidati | no |
 * | un codice fiscale di 16 caratteri | si dice che non è interrogabile | — |
 *
 * La terza riga è quella monca, e lo dichiara: senza un motore di ricerca a
 * pagamento non si va sul web. Vedi `providers/search.ts`.
 */

import { CrmContextRef } from '../base';
import { SearchCandidate } from '@/types/prospect';
import { SearchKind } from '@/components/crm/ricerca/constants';
import { recognize, describeRecognition } from './recognize';
import { markCandidateChosen } from './searches';
import { lookupByVat } from './identity';
import { lookupByDomain } from './website';
import { lookupByName, NameLookup } from './byName';
import { runEstimates } from './estimates';
import { checkExcluded, describeExclusion, ExclusionTarget } from './exclusions';
import { normalizeVat, normalizeDomain } from './base';
import { writeAudit } from '../audit';

export interface SearchOutcome {
  ok: boolean;
  kind: SearchKind | '';
  /** Valorizzato quando si è arrivati a una scheda. */
  profileId: string;
  searchId: string;
  message: string;
  warnings: string[];
  /** Valorizzati solo dalla ricerca per nome. */
  candidates: SearchCandidate[];
}

const VUOTO = { profileId: '', searchId: '', warnings: [] as string[], candidates: [] as SearchCandidate[] };

/**
 * Le stime si calcolano subito, appena la scheda esiste.
 *
 * Costano zero — ricombinano dati già raccolti, senza toccare la rete — e una
 * scheda senza stime è mezza scheda: chiedere all'utente un secondo clic per
 * avere quello che si poteva dargli subito è un modo di far sembrare vuoto uno
 * strumento che vuoto non è.
 *
 * Se falliscono **non fanno fallire la ricerca**: l'identità e quello che il
 * sito dichiara sono già stati scritti, e valgono anche da soli.
 */
async function stimaSubito(ctx: CrmContextRef, profileId: string, avvisi: string[]): Promise<string[]> {
  if (!profileId) return avvisi;
  try {
    const esito = await runEstimates(ctx, profileId);
    return esito.ok ? avvisi : [...avvisi, esito.message];
  } catch (error) {
    console.error('Stime non calcolate:', error);
    return [...avvisi, 'Le stime non sono state calcolate: la scheda resta con identità e dichiarato.'];
  }
}

function daNome(esito: NameLookup): SearchOutcome {
  return {
    ok: esito.ok, kind: 'name', profileId: '', searchId: esito.searchId,
    message: esito.message, warnings: [], candidates: esito.candidates,
  };
}

/** Con cosa ci si presenta alla lista di esclusione, dato quello che è stato scritto. */
export function exclusionTargetFor(kind: string, normalized: string, input: string): ExclusionTarget {
  if (kind === 'vat') return { vatNumber: normalizeVat(normalized) };
  if (kind === 'domain') return { domain: normalizeDomain(normalized) };
  if (kind === 'name') return { name: input };
  return {};
}

/** Quello che succede quando si preme invio. */
export async function runSearch(ctx: CrmContextRef, input: string): Promise<SearchOutcome> {
  const riconosciuto = recognize(input);

  if (!riconosciuto.valid && riconosciuto.kind !== 'name') {
    return { ok: false, kind: riconosciuto.kind, ...VUOTO, message: riconosciuto.message };
  }

  // La lista di esclusione si guarda **per prima**: prima di registrare la
  // ricerca, prima di toccare la rete. Una ricerca bloccata non deve aver
  // interrogato niente e non deve lasciare una scheda.
  try {
    const esclusione = await checkExcluded(ctx.projectId,
      exclusionTargetFor(riconosciuto.kind, riconosciuto.normalized, input));

    if (esclusione) {
      // Il tentativo si registra: serve a sapere che qualcuno ci ha provato, e
      // che il blocco ha funzionato. Non si crea però una ricerca — sarebbe
      // una riga in più su un soggetto che ha chiesto di non essere cercato.
      await writeAudit(ctx, 'prospect.search_blocked', 'prospect_exclusion', esclusione.id, null,
        { input, kind: riconosciuto.kind });
      return { ok: false, kind: riconosciuto.kind, ...VUOTO, message: describeExclusion(esclusione) };
    }
  } catch (error: any) {
    return { ok: false, kind: riconosciuto.kind, ...VUOTO,
      message: error?.message || 'La lista di esclusione non è leggibile: la ricerca è stata fermata per prudenza.' };
  }

  if (riconosciuto.kind === 'vat') {
    const esito = await lookupByVat(ctx, input);
    return { ok: esito.ok, kind: 'vat', profileId: esito.profileId, searchId: esito.searchId,
      message: esito.message, warnings: await stimaSubito(ctx, esito.profileId, esito.warnings), candidates: [] };
  }

  if (riconosciuto.kind === 'domain') {
    const esito = await lookupByDomain(ctx, input);
    return { ok: esito.ok, kind: 'domain', profileId: esito.profileId, searchId: esito.searchId,
      message: esito.message, warnings: await stimaSubito(ctx, esito.profileId, esito.warnings), candidates: [] };
  }

  if (riconosciuto.kind === 'tax_code') {
    // Il codice fiscale di sedici caratteri è quello di una **persona**: non
    // esiste un registro pubblico e gratuito che risponda da lì, e le persone
    // non sono l'oggetto di questa sezione.
    return { ok: false, kind: 'tax_code', ...VUOTO,
      message: `${describeRecognition(riconosciuto)}: nessun registro pubblico risponde da un codice fiscale di sedici caratteri. Cerca per partita IVA, per sito, o per nome.` };
  }

  return daNome(await lookupByName(ctx, input));
}

/**
 * Da un candidato proposto alla scheda vera.
 *
 * Il salto lo fa una persona, sempre: qui si prende quello che ha scelto e lo
 * si porta sul percorso giusto — la partita IVA se ce l'ha, altrimenti il
 * sito. Se non ha né l'una né l'altro non si inventa niente: si dice cosa
 * manca.
 */
export async function chooseCandidate(
  ctx: CrmContextRef,
  searchId: string,
  refId: string
): Promise<SearchOutcome> {
  const scelto = await markCandidateChosen(ctx, searchId, refId);
  if (!scelto) {
    return { ok: false, kind: 'name', ...VUOTO, searchId,
      message: 'Il candidato scelto non è più fra quelli proposti: rifai la ricerca.' };
  }

  if (scelto.vatNumber) return runSearch(ctx, scelto.vatNumber);
  if (scelto.website) return runSearch(ctx, scelto.website);

  return { ok: false, kind: 'name', ...VUOTO, searchId,
    message: `Di «${scelto.name}» sappiamo solo il nome: senza partita IVA né sito non c'è da dove partire. Aggiungi uno dei due e ricerca.` };
}
