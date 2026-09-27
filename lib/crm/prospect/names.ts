/**
 * Confrontare due ragioni sociali.
 *
 * Serve a rispondere a una domanda sola, che però vale parecchio: **questa
 * azienda ce l'abbiamo già in casa?** Ricercare da zero un cliente che è già
 * nel CRM è il modo classico di far arrivare due commerciali sullo stesso
 * nome, e nessuno se ne accorge finché non telefonano tutti e due.
 *
 * Il confronto non restituisce una percentuale. Una percentuale muta — «82% di
 * somiglianza» — non aiuta nessuno a decidere: chi legge deve sapere **su cosa**
 * i due nomi si assomigliano, e deciderlo lui. Qui torna il tipo di
 * corrispondenza e le parole che l'hanno prodotta.
 *
 * Funzioni pure: si provano eseguendole.
 */

import { SearchCandidate } from '@/types/prospect';

/**
 * Le forme societarie. Si tolgono perché non dicono niente sull'identità:
 * «Rossi S.r.l.» e «Rossi S.p.A.» dopo una trasformazione sono la stessa
 * azienda, e due nomi che differiscono solo per la sigla non devono sembrare
 * due aziende diverse.
 */
const SIGLE = new Set([
  'spa', 'srl', 'srls', 'sas', 'snc', 'sapa', 'sarl', 'scarl', 'scrl', 'scpa',
  'ss', 'soc', 'societa', 'cooperativa', 'coop', 'consortile', 'unipersonale',
  'semplice', 'responsabilita', 'limitata', 'azioni', 'accomandita',
  'sl', 'sa', 'ag', 'gmbh', 'ltd', 'limited', 'inc', 'llc', 'bv', 'nv', 'plc',
  'oy', 'ab', 'as', 'aps', 'kg', 'ohg', 'sro', 'kft', 'corp', 'co',
]);

/**
 * Parole che ci sono in mezza Italia.
 *
 * Restano nel nome — «Rossi Impianti» non è «Rossi» — ma non contano come
 * indizio: due aziende che condividono solo «impianti» non sono la stessa
 * azienda, e trattarlo come una corrispondenza riempirebbe l'elenco di nomi
 * che non c'entrano niente.
 */
const GENERICI = new Set([
  'gruppo', 'group', 'holding', 'italia', 'italy', 'italiana', 'italiano',
  'international', 'internazionale', 'europe', 'europa', 'global', 'world',
  'industrie', 'industria', 'industriale', 'industries', 'industrial',
  'servizi', 'service', 'services', 'sistemi', 'systems', 'system',
  'tecnologie', 'technologies', 'technology', 'tech', 'solutions', 'soluzioni',
  'company', 'azienda', 'impresa', 'imprese', 'officine', 'officina',
  'fratelli', 'figli', 'commerciale', 'produzione', 'lavorazione',
  'nuova', 'nuovo', 'centro', 'studio', 'consulting', 'consulenza', 'partners',
]);

/**
 * Il nome in forma confrontabile: minuscolo, senza accenti, senza
 * punteggiatura, senza forma societaria.
 *
 * L'ordine dei passaggi conta, e il primo è quello che si sbaglia: «S.p.A.»
 * va ricomposta in `spa` **prima** di togliere la punteggiatura, altrimenti
 * diventa tre lettere sciolte e la forma societaria non si riconosce più —
 * con il risultato che «Rossi S.r.l.» e «Rossi S.p.A.» sembrano due aziende
 * diverse. L'ho scoperto così, con un controllo che falliva.
 *
 * La `&` diventa «e»: «Danieli & C.» e «Danieli e C.» sono lo stesso nome
 * scritto da due persone diverse.
 */
export function normalizeCompanyName(raw: string): string {
  const pulito = String(raw || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    // «S.p.A.» prima dev'essere una parola sola, altrimenti la punteggiatura
    // la spezza in tre lettere e la forma societaria non si riconosce più.
    .replace(/\b[a-z](?:\s*\.\s*[a-z])+\s*\.?/g, sigla => sigla.replace(/[^a-z]/g, ''))
    .replace(/&/g, ' e ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  return pulito
    .split(' ')
    .filter(parola => parola && !SIGLE.has(parola))
    .join(' ');
}

/** Le parole che dicono qualcosa: né sigle, né parole da mezza Italia. */
export function distinctiveTokens(raw: string): string[] {
  return normalizeCompanyName(raw)
    .split(' ')
    .filter(parola => parola.length >= 3 && !GENERICI.has(parola));
}

export type NameMatchKind = 'exact' | 'contained' | 'partial' | '';

export interface NameMatch {
  kind: NameMatchKind;
  /** Le parole che i due nomi hanno in comune, e che contano. */
  shared: string[];
}

const NIENTE: NameMatch = { kind: '', shared: [] };

/** Vero se `contenitore` contiene `contenuto` come sequenza di parole intere. */
function contieneParole(contenitore: string, contenuto: string): boolean {
  if (!contenuto) return false;
  return (' ' + contenitore + ' ').includes(' ' + contenuto + ' ');
}

/**
 * Quanto due ragioni sociali si somigliano, e su cosa.
 *
 * Quattro esiti, dal più forte al più debole. Il più debole — `partial` — è
 * volutamente **stretto**: una parola sola in comune vale solo se è lunga e se
 * è tutto quello che il nome più corto ha da dire. «Rossi Impianti» e
 * «Bianchi Impianti» non corrispondono, ed è giusto così.
 */
export function matchCompanyNames(a: string, b: string): NameMatch {
  const na = normalizeCompanyName(a);
  const nb = normalizeCompanyName(b);
  if (!na || !nb) return NIENTE;

  if (na === nb) return { kind: 'exact', shared: distinctiveTokens(a) };

  const ta = distinctiveTokens(a);
  const tb = distinctiveTokens(b);
  const comuni = ta.filter(parola => tb.includes(parola));

  if (contieneParole(na, nb) || contieneParole(nb, na)) {
    return { kind: 'contained', shared: comuni };
  }
  if (comuni.length === 0) return NIENTE;
  if (comuni.length >= 2) return { kind: 'partial', shared: comuni };

  const piuCorto = Math.min(ta.length, tb.length);
  if (piuCorto === 1 && comuni[0].length >= 5) return { kind: 'partial', shared: comuni };

  return NIENTE;
}

/**
 * Perché questo nome somiglia a quello cercato, in italiano.
 *
 * Va scritto accanto al candidato, non in un tooltip: chi sceglie deve poter
 * capire in un secondo se è la sua azienda o un'omonima.
 */
export function describeMatch(match: NameMatch, nomeTrovato: string): string {
  if (match.kind === 'exact') return `Stesso nome: «${nomeTrovato}».`;
  if (match.kind === 'contained') return `«${nomeTrovato}» contiene per intero quello che hai cercato.`;
  if (match.kind === 'partial') {
    const parole = match.shared.map(p => `«${p}»`).join(', ');
    return `«${nomeTrovato}» ha in comune ${match.shared.length === 1 ? 'la parola' : 'le parole'} ${parole}.`;
  }
  return '';
}

/** L'ordine in cui vanno mostrati: prima le corrispondenze più forti. */
export const MATCH_ORDER: Record<NameMatchKind, number> = {
  exact: 0, contained: 1, partial: 2, '': 3,
};

// --------------------------------------------------- Cercare fra i nostri

/**
 * Una cosa che ha un nome e che potrebbe essere l'azienda cercata: una scheda
 * già raccolta, un'azienda del CRM, un lead.
 *
 * Il tipo è volutamente minimo — non conosce né Firestore né i tipi del CRM —
 * perché questa funzione si possa provare eseguendola su tre oggetti scritti
 * a mano, invece che su un database.
 */
export interface NameSource {
  name: string;
  /** Un secondo nome, quando c'è: ragione sociale contro nome d'insegna. */
  altName?: string;
  website?: string;
  vatNumber?: string;
  source: 'profile' | 'account' | 'lead';
  refId: string;
}

const ETICHETTE: Record<NameSource['source'], string> = {
  profile: 'una scheda già raccolta',
  account: 'un’azienda del CRM',
  lead:    'un lead',
};

/** Prima le schede, poi le aziende, poi i lead: dal più completo al più magro. */
const PRIORITA_FONTE: Record<NameSource['source'], number> = { profile: 0, account: 1, lead: 2 };

/**
 * I candidati che abbiamo già in casa, ordinati per quanto somigliano.
 *
 * Non sceglie mai da sola. Una ricerca per nome che «trova» l'azienda
 * sbagliata e ci costruisce sopra un report è peggio di una che non trova
 * niente: qui si propone, con scritto perché, e decide chi cerca.
 *
 * Quando la stessa azienda risulta da più parti — è già cliente **e** c'è un
 * lead aperto — si mostra una riga sola che le nomina entrambe. Due righe
 * uguali costringono chi legge a capire da sé che sono la stessa cosa, ed è
 * proprio l'informazione che gli serve.
 */
export function buildCandidates(query: string, fonti: NameSource[], massimo = 12): SearchCandidate[] {
  interface Trovato {
    fonte: NameSource;
    match: NameMatch;
    nomeVisto: string;
    anche: NameSource['source'][];
  }

  const perNome = new Map<string, Trovato>();

  for (const fonte of fonti) {
    // Si prova contro tutti i nomi che il record porta: la ragione sociale
    // ufficiale e il nome con cui lo chiamano in azienda sono spesso diversi,
    // e chi cerca scrive il secondo.
    let migliore: NameMatch = NIENTE;
    let nomeVisto = fonte.name;
    for (const nome of [fonte.name, fonte.altName || '']) {
      if (!nome) continue;
      const match = matchCompanyNames(query, nome);
      if (match.kind && MATCH_ORDER[match.kind] < MATCH_ORDER[migliore.kind]) {
        migliore = match;
        nomeVisto = nome;
      }
    }
    if (!migliore.kind) continue;

    const chiave = normalizeCompanyName(nomeVisto);
    const gia = perNome.get(chiave);

    if (!gia) {
      perNome.set(chiave, { fonte, match: migliore, nomeVisto, anche: [] });
      continue;
    }
    // Stessa azienda da una fonte diversa: si tiene quella più completa e si
    // annota l'altra.
    if (!gia.anche.includes(fonte.source) && fonte.source !== gia.fonte.source) {
      gia.anche.push(fonte.source);
    }
    if (PRIORITA_FONTE[fonte.source] < PRIORITA_FONTE[gia.fonte.source]) {
      gia.anche = gia.anche.filter(s => s !== fonte.source);
      if (!gia.anche.includes(gia.fonte.source)) gia.anche.push(gia.fonte.source);
      gia.fonte = fonte;
      gia.match = migliore;
      gia.nomeVisto = nomeVisto;
    }
  }

  return Array.from(perNome.values())
    .sort((a, b) => {
      const forza = MATCH_ORDER[a.match.kind] - MATCH_ORDER[b.match.kind];
      if (forza !== 0) return forza;
      const fonte = PRIORITA_FONTE[a.fonte.source] - PRIORITA_FONTE[b.fonte.source];
      if (fonte !== 0) return fonte;
      return a.nomeVisto.localeCompare(b.nomeVisto);
    })
    .slice(0, massimo)
    .map(({ fonte, match, nomeVisto, anche }) => {
      const dove = [ETICHETTE[fonte.source], ...anche.map(s => ETICHETTE[s])];
      const ultima = dove.pop();
      const elenco = dove.length ? `${dove.join(', ')} e ${ultima}` : ultima;
      return {
        name: nomeVisto,
        website: fonte.website || '',
        vatNumber: fonte.vatNumber || '',
        why: `${describeMatch(match, nomeVisto)} È già ${elenco}.`,
        chosen: false,
        source: fonte.source,
        refId: fonte.refId,
      };
    });
}
