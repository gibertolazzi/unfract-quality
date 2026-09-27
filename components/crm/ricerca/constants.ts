// Stati ed enumerazioni della sezione «Ricerca aziende».
//
// Come nel resto del CRM: costanti del codice, non documenti su Firestore. Un
// elenco di stati modificabile dall'utente vuol dire che ogni installazione ha
// regole diverse e che nessuna regola scritta qui vale davvero.
//
// Il perché di ogni scelta sta in docs/PIANO-RICERCA.md.

// ------------------------------------------------- I tre livelli di verità

/**
 * Da dove viene un dato. È la distinzione che tiene in piedi tutta la sezione:
 *
 * - `certain`   — registro ufficiale interrogabile (VIES, domani una visura);
 * - `declared`  — lo dice l'azienda di sé, sul proprio sito;
 * - `estimated` — l'abbiamo dedotto noi, con un metodo che va mostrato.
 *
 * Un competitor stimato mostrato con la stessa faccia della ragione sociale
 * ufficiale fa perdere fiducia allo strumento: chi legge non sa più cosa può
 * ripetere al telefono senza fare figuracce.
 */
export const EVIDENCE_LEVELS = ['certain', 'declared', 'estimated'] as const;
export type EvidenceLevel = typeof EVIDENCE_LEVELS[number];

export const EVIDENCE_LABELS: Record<EvidenceLevel, string> = {
  certain:   'Dato certo',
  declared:  'Dichiarato dall’azienda',
  estimated: 'Stima nostra',
};

/** Frase breve da mostrare accanto al dato, non in un tooltip da cercare. */
export const EVIDENCE_HINTS: Record<EvidenceLevel, string> = {
  certain:   'Da un registro ufficiale.',
  declared:  'Lo dichiara l’azienda sul proprio sito.',
  estimated: 'Dedotto da noi: qui sotto il metodo.',
};

export const EVIDENCE_COLORS: Record<EvidenceLevel, string> = {
  certain:   '#10B981',
  declared:  '#3B82F6',
  estimated: '#F59E0B',
};

/** Quanto ci si può fidare di una stima. Non è una percentuale: sarebbe finta. */
export const CONFIDENCE_LEVELS = ['high', 'medium', 'low'] as const;
export type ConfidenceLevel = typeof CONFIDENCE_LEVELS[number];

export const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  high:   'Segnale forte',
  medium: 'Segnale parziale',
  low:    'Indizio debole',
};

// ------------------------------------------------------------- La ricerca

/** Cosa è stato scritto nel campo di ricerca, riconosciuto automaticamente. */
export const SEARCH_KINDS = ['vat', 'tax_code', 'domain', 'name'] as const;
export type SearchKind = typeof SEARCH_KINDS[number];

export const SEARCH_KIND_LABELS: Record<SearchKind, string> = {
  vat:      'Partita IVA',
  tax_code: 'Codice fiscale',
  domain:   'Sito o dominio',
  name:     'Nome o ragione sociale',
};

export const SEARCH_STATES = ['PENDING', 'RUNNING', 'DONE', 'PARTIAL', 'FAILED'] as const;
export type SearchState = typeof SEARCH_STATES[number];

export const SEARCH_STATE_LABELS: Record<SearchState, string> = {
  PENDING: 'In attesa',
  RUNNING: 'In corso',
  DONE:    'Completata',
  PARTIAL: 'Completata in parte',
  FAILED:  'Non riuscita',
};

/**
 * `PARTIAL` non è un lusso: capita spesso. VIES conferma l'identità ma il sito
 * rifiuta la connessione, e il risultato è una scheda metà piena. Chiamarla
 * `DONE` farebbe credere che quei campi vuoti siano dati che non esistono,
 * invece che dati che non siamo riusciti a leggere.
 */
export const SEARCH_TRANSITIONS: Record<SearchState, SearchState[]> = {
  PENDING: ['RUNNING', 'FAILED'],
  RUNNING: ['DONE', 'PARTIAL', 'FAILED'],
  DONE:    [],
  PARTIAL: [],
  FAILED:  [],
};

// ------------------------------------------------------------- Le fonti

/** Chi ha prodotto un dato. Ogni voce di provenienza ne porta una. */
export const SOURCE_KINDS = ['vies', 'website', 'search_engine', 'registry', 'manual', 'derived', 'ai'] as const;
export type SourceKind = typeof SOURCE_KINDS[number];

export const SOURCE_KIND_LABELS: Record<SourceKind, string> = {
  vies:          'VIES — Commissione Europea',
  website:       'Sito dell’azienda',
  search_engine: 'Motore di ricerca',
  registry:      'Registro imprese',
  manual:        'Inserito a mano',
  derived:       'Calcolato dai dati già raccolti',
  ai:            'Elaborazione AI',
};

/** Il livello di verità che una fonte può produrre, al massimo. */
export const SOURCE_EVIDENCE: Record<SourceKind, EvidenceLevel> = {
  vies:          'certain',
  registry:      'certain',
  website:       'declared',
  manual:        'declared',
  search_engine: 'estimated',
  // Le stime non aggiungono dati: ricombinano quelli che ci sono. Restano una
  // stima anche quando partono da un dato certo — una deduzione corretta su
  // una premessa corretta resta una deduzione.
  derived:       'estimated',
  ai:            'estimated',
};

// -------------------------------------------------------------- I report

export const REPORT_STATES = ['DRAFT', 'APPROVED', 'ARCHIVED'] as const;
export type ReportState = typeof REPORT_STATES[number];

export const REPORT_STATE_LABELS: Record<ReportState, string> = {
  DRAFT:    'Bozza',
  APPROVED: 'Approvato',
  ARCHIVED: 'Archiviato',
};

/**
 * Un report scritto dall'AI **nasce in bozza e ci resta** finché una persona
 * non lo approva: è un documento che qualcuno manderà a un cliente, o su cui
 * imposterà una telefonata. Da `APPROVED` non si torna a `DRAFT`: si scrive
 * una versione nuova, così resta traccia di cosa era stato approvato.
 */
export const REPORT_TRANSITIONS: Record<ReportState, ReportState[]> = {
  DRAFT:    ['APPROVED', 'ARCHIVED'],
  APPROVED: ['ARCHIVED'],
  ARCHIVED: [],
};

// --------------------------------------------------------------- I costi

/**
 * Le operazioni che costano. VIES e la lettura di un sito sono gratuite; il
 * motore di ricerca e l'AI si pagano a chiamata.
 *
 * Uno strumento di prospezione senza freno è un modo elegante di svuotare un
 * budget mentre nessuno guarda: per questo ogni ricerca registra quante
 * chiamate a pagamento ha consumato, e c'è un tetto per progetto.
 */
export const BILLED_OPERATIONS = ['web_search', 'ai_report', 'registry_lookup'] as const;
export type BilledOperation = typeof BILLED_OPERATIONS[number];

export const BILLED_OPERATION_LABELS: Record<BilledOperation, string> = {
  web_search:      'Ricerca sul web',
  ai_report:       'Report scritto dall’AI',
  registry_lookup: 'Visura al registro imprese',
};

/** Operazioni gratuite, elencate perché si veda che lo sono. */
export const FREE_OPERATIONS = ['vies_lookup', 'website_read'] as const;
export type FreeOperation = typeof FREE_OPERATIONS[number];

/**
 * Quante operazioni a pagamento al mese, per progetto, se nessuno configura
 * niente. Volutamente basso: un tetto che non si sente non è un tetto, e
 * alzarlo è una riga di configurazione — accorgersi a fine mese no.
 */
export const DEFAULT_MONTHLY_BUDGET: Record<BilledOperation, number> = {
  web_search:      200,
  ai_report:       50,
  registry_lookup: 0,
};

// ------------------------------------------------------- Le esclusioni

/**
 * Su cosa si può escludere qualcuno dalle ricerche.
 *
 * Quattro chiavi, perché una richiesta di non essere cercati arriva in quattro
 * modi diversi: «la mia partita IVA», «il mio sito», «questo indirizzo»,
 * «la mia azienda si chiama così». Costringere chi riceve la richiesta a
 * tradurla in una sola forma è il modo di far dimenticare metà delle
 * esclusioni.
 */
export const EXCLUSION_KINDS = ['vat', 'domain', 'email', 'name'] as const;
export type ExclusionKind = typeof EXCLUSION_KINDS[number];

export const EXCLUSION_KIND_LABELS: Record<ExclusionKind, string> = {
  vat:    'Partita IVA',
  domain: 'Sito o dominio',
  email:  'Indirizzo email',
  name:   'Nome o ragione sociale',
};

/**
 * Il nome è la chiave **più debole**, e va detto a chi la usa: due aziende
 * possono chiamarsi quasi uguale, e un'esclusione per nome può bloccarne una
 * che non aveva chiesto niente. Partita IVA e dominio sono esatti.
 */
export const EXCLUSION_KIND_HINTS: Record<ExclusionKind, string> = {
  vat:    'Esatta: blocca solo quella partita IVA.',
  domain: 'Esatto: blocca quel dominio, sottodomini esclusi.',
  email:  'Esatto: blocca le ricerche che partono da quell’indirizzo.',
  name:   'Approssimativo: può bloccare anche un’azienda con un nome simile.',
};

// ---------------------------------------------------------- La freschezza

/**
 * Dopo quanti giorni una scheda va considerata vecchia.
 *
 * Non si ricarica da sola: si mostra quanto è vecchia e si lascia decidere.
 * Un aggiornamento automatico su ogni apertura moltiplicherebbe le chiamate a
 * pagamento per il numero di volte che qualcuno guarda una scheda.
 */
export const FRESHNESS_DAYS = {
  /** L'identità cambia di rado: una ragione sociale resta quella per anni. */
  identity: 180,
  /** Il sito cambia più spesso: prodotti, referenze, stack. */
  declared: 30,
  /** Le stime invecchiano con i dati da cui derivano. */
  estimated: 30,
} as const;

export type FreshnessArea = keyof typeof FRESHNESS_DAYS;
