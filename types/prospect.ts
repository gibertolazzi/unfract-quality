// Modello dati della sezione «Ricerca aziende».
//
// Quattro collezioni Firestore, tutte con i campi comuni del CRM
// (`projectId`, `organizationId`, `version`, `archived`, `origin`):
//
//   crm_company_profiles   la scheda di un'azienda
//   crm_prospect_searches  le ricerche fatte, con esito e costo
//   crm_prospect_reports   i report, in bozza finché qualcuno non li approva
//   crm_prospect_sources   da dove viene ogni singolo dato
//
// La quarta esiste perché «da dove viene questo dato» dev'essere una domanda
// con risposta — davanti a un cliente, e davanti a chi chiede conto di un
// trattamento di dati personali.

import { CrmBase } from '@/types/crm';
import {
  EvidenceLevel, ConfidenceLevel, SearchKind, SearchState,
  SourceKind, ReportState, BilledOperation, ExclusionKind,
} from '@/components/crm/ricerca/constants';

// ------------------------------------------------- Il portatore di verità

/**
 * Un valore con la sua provenienza attaccata.
 *
 * È il mattone di tutta la sezione: nessun campo della scheda è una stringa
 * nuda. Se lo fosse, al primo passaggio di mano nessuno saprebbe più se
 * «Alimentare» l'ha scritto la Camera di commercio, il sito dell'azienda, o
 * noi guardando tre parole in homepage.
 *
 * `value` a `null` significa **non trovato**, e `note` dice perché: non è mai
 * una stringa vuota messa lì per far tornare i conti.
 */
export interface Evidenced<T> {
  value: T | null;
  evidence: EvidenceLevel;
  /** Id del documento in `crm_prospect_sources`. */
  sourceId: string;
  /** Quando è stato raccolto, in ISO. Un dato senza data non è verificabile. */
  at: string;
  /** Perché manca, o cosa lo qualifica. Si mostra accanto al valore. */
  note: string;
}

/** Una stima, con il metodo in chiaro. */
export interface Estimated<T> extends Evidenced<T> {
  evidence: 'estimated';
  confidence: ConfidenceLevel;
  /** I segnali che l'hanno prodotta, in italiano leggibile. */
  signals: string[];
}

// --------------------------------------------------------- Scheda azienda

/** Identità: l'unica parte che può essere certa. */
export interface CompanyIdentity {
  legalName: Evidenced<string>;
  vatNumber: Evidenced<string>;
  taxCode: Evidenced<string>;
  address: Evidenced<string>;
  city: Evidenced<string>;
  province: Evidenced<string>;
  country: Evidenced<string>;
  /** Esito dell'ultima verifica: `true`, `false`, o `null` se il servizio era giù. */
  vatValid: Evidenced<boolean>;
}

/** Quello che l'azienda dichiara di sé, sul proprio sito. */
export interface CompanyDeclared {
  website: Evidenced<string>;
  description: Evidenced<string>;
  /**
   * Il testo della pagina «chi siamo», troncato.
   *
   * Non è un doppione della descrizione: quella è una riga scritta per i
   * motori di ricerca, questo è dove l'azienda spiega cosa fa. È il materiale
   * su cui si stima il settore, e senza di esso la stima non conclude quasi
   * mai — misurato su sei aziende vere.
   */
  aboutText: Evidenced<string>;
  /** Cosa vende, con parole sue. */
  solutions: Evidenced<string[]>;
  /** Settori a cui dice di rivolgersi. */
  targetSectors: Evidenced<string[]>;
  /** Clienti e referenze citati: sono fatti, non stime. */
  declaredClients: Evidenced<string[]>;
  declaredPartners: Evidenced<string[]>;
  /** Solo recapiti aziendali pubblici: `info@`, PEC, centralino. */
  publicContacts: Evidenced<PublicContact[]>;
  /** Link ai profili pubblici. Trovati, mai estratti: vedi PIANO-RICERCA.md §2. */
  socialLinks: Evidenced<SocialLink[]>;
  /** Fornitori tecnologici letti dal sito: fatti verificabili. */
  techStack: Evidenced<TechSignal[]>;
}

export interface PublicContact {
  kind: 'email' | 'pec' | 'phone' | 'form';
  value: string;
  /** La pagina che lo riporta. Senza, il dato non è difendibile. */
  foundAt: string;
}

export interface SocialLink {
  network: string;
  url: string;
}

export interface TechSignal {
  /** Es. «WordPress», «Shopify», «HubSpot». */
  name: string;
  category: string;
  /** Cosa l'ha rivelato: un header, un tag, un file. */
  evidence: string;
}

/** Quello che deduciamo noi. Ogni voce porta il suo metodo. */
export interface CompanyEstimated {
  sector: Estimated<string>;
  /** Codice ATECO, quando lo si riesce a dedurre. */
  atecoCode: Estimated<string>;
  sizeRange: Estimated<string>;
  competitors: Estimated<CompetitorGuess[]>;
  /** Chi comprerebbe quello che vendono: la stima che serve a noi. */
  idealCustomer: Estimated<IdealCustomer>;
}

export interface CompetitorGuess {
  name: string;
  website: string;
  /** Perché è emerso: stesso settore e area, o stesse ricerche. */
  reason: 'same_sector' | 'same_searches';
  confidence: ConfidenceLevel;
}

export interface IdealCustomer {
  sectors: string[];
  sizeRanges: string[];
  areas: string[];
  /** Perché questa azienda sarebbe un buon cliente per noi, o non lo sarebbe. */
  rationale: string;
}

/** Quello che una persona ha corretto a mano. Vuoto finché nessuno tocca niente. */
export interface CompanyOverrides {
  /** Divisione ATECO scelta a mano. La nota dice chi e quando. */
  sectorCode: Evidenced<string>;
}

export interface CrmCompanyProfile extends CrmBase {
  /** Chiave di deduplicazione: partita IVA se c'è, altrimenti il dominio. */
  lookupKey: string;
  displayName: string;

  identity: CompanyIdentity;
  declared: CompanyDeclared;
  estimated: CompanyEstimated;

  /** Quando ciascuna area è stata raccolta: serve a dire quanto è vecchia. */
  collectedAt: { identity: string; declared: string; estimated: string };

  /** Cosa non si è riusciti a leggere, e perché. Si mostra in cima alla scheda. */
  gaps: string[];

  /**
   * Le correzioni fatte a mano. **Vincono sulle stime**, e non sono stime:
   * le ha dichiarate una persona, quindi valgono `declared`.
   *
   * Esistono perché la scheda mostra le parole che hanno deciso il settore, e
   * chi legge può vedere che sono sbagliate. Fargli vedere l'errore senza
   * lasciarglielo correggere è il modo più sicuro di farlo smettere di
   * guardare: correggere il settore risistema anche i competitor e il
   * cliente-tipo, che da quello dipendono.
   */
  overrides: CompanyOverrides;

  /** Collegamenti al CRM, quando dalla scheda è nato qualcosa. */
  linkedAccountId: string;
  linkedLeadId: string;

  /** Id dell'ultima ricerca che l'ha aggiornata. */
  lastSearchId: string;
}

// ------------------------------------------------------------ La ricerca

export interface CrmProspectSearch extends CrmBase {
  /** Il testo scritto dall'utente, così com'era. */
  input: string;
  kind: SearchKind;
  state: SearchState;

  /** Profilo prodotto o aggiornato, quando si è arrivati in fondo. */
  profileId: string;

  /** I candidati proposti per una ricerca per nome, con il motivo. */
  candidates: SearchCandidate[];

  /** Quante operazioni a pagamento ha consumato questa ricerca. */
  billed: Partial<Record<BilledOperation, number>>;

  startedAt: string;
  finishedAt: string;
  /** Messaggio leggibile in caso di esito parziale o fallito. */
  outcome: string;
}

export interface SearchCandidate {
  name: string;
  website: string;
  vatNumber: string;
  /** Perché somiglia a ciò che è stato cercato. Mai una percentuale muta. */
  why: string;
  chosen: boolean;

  /**
   * Da dove viene il candidato. Finché non c'è un motore di ricerca sono tutti
   * roba nostra: una scheda già cercata, un'azienda del CRM, un lead. Il
   * giorno che si collega un motore si aggiunge `web`, e chi legge continua a
   * sapere se quel nome era già in casa o è arrivato da fuori.
   */
  source: 'profile' | 'account' | 'lead' | 'web' | '';
  /** Id del record che l'ha prodotto, per arrivarci con un clic. */
  refId: string;
}

// ------------------------------------------------------------ Provenienza

/**
 * Una riga per ogni raccolta di dati: chi, quando, da dove, cosa.
 *
 * Non è un log tecnico. È quello che permette di rispondere a «questo indirizzo
 * dove l'avete preso?» — che è una domanda che prima o poi arriva, e che va
 * saputa rispondere con una pagina e una data, non con un'alzata di spalle.
 */
export interface CrmProspectSource extends CrmBase {
  profileId: string;
  searchId: string;

  kind: SourceKind;
  /** L'indirizzo esatto da cui viene il dato. */
  url: string;
  /** Quando è stato raccolto, in ISO. */
  fetchedAt: string;

  /** I campi della scheda che questa fonte ha valorizzato. */
  fields: string[];

  /**
   * Vero se questa raccolta ha toccato dati riferibili a una **persona**
   * (nome, email nominativa, ruolo). Cambia gli obblighi, quindi va segnato
   * qui e non dedotto dopo guardando i campi.
   */
  personalData: boolean;

  /** Esito grezzo utile a rifare la lettura senza richiamare la fonte. */
  snippet: string;
  /** Cosa è andato storto, se è andato storto. */
  error: string;
}

// ----------------------------------------------------------- Esclusioni

/**
 * Chi ha chiesto di non essere cercato.
 *
 * Il diritto di opposizione non è un adempimento da mettere in fondo: senza un
 * modo di **trovare** chi l'ha esercitato e di **bloccarne la riricerca**, la
 * prima cosa che succede è che la stessa azienda viene ricercata di nuovo dal
 * collega che non c'era quel giorno.
 *
 * Non si cancella mai: un'esclusione revocata viene archiviata, così resta
 * scritto che c'era stata. Cancellarla renderebbe impossibile dimostrare di
 * averla rispettata.
 */
export interface CrmProspectExclusion extends CrmBase {
  kind: ExclusionKind;
  /** Il valore normalizzato: è su questo che si confronta. */
  value: string;
  /** Com'era scritto nella richiesta. Si mostra, per farlo riconoscere. */
  rawValue: string;

  /** Perché: la richiesta di chi la fa, con parole sue. */
  reason: string;
  /** Chi l'ha chiesto e come è arrivata: «per email dal titolare», ecc. */
  requestedBy: string;
  requestedAt: string;

  /** Quando è stata revocata, e da chi. Vuoti finché è in vigore. */
  liftedBy: string;
  liftedAt: string;
}

// --------------------------------------------------------------- Report

export interface CrmProspectReport extends CrmBase {
  profileId: string;
  state: ReportState;
  title: string;

  /** Le sezioni del documento, nell'ordine in cui si leggono. */
  sections: ReportSection[];

  /** Modello e versione del prompt: un testo AI senza questi non è ripetibile. */
  model: string;
  promptVersion: string;

  /** Chi ha approvato, e quando. Vuoti finché è in bozza. */
  approvedBy: string;
  approvedAt: string;

  /** I punti che sono stime: finiscono nel capitolo «cosa non dire». */
  caveats: string[];
}

export interface ReportSection {
  key: 'who' | 'why_us' | 'entry_point' | 'who_to_contact' | 'do_not_say' | 'sources';
  title: string;
  body: string;
  /** Id delle fonti che sostengono questa sezione. */
  sourceIds: string[];
}
