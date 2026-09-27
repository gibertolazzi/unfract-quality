/**
 * Il contratto di una fonte di identità.
 *
 * Oggi c'è solo VIES, che è gratuito e ufficiale ma dice poco: ragione sociale
 * e indirizzo, e niente altro. Domani potrebbe esserci una visura camerale, che
 * dice molto di più e si paga a pezzo. Il resto della sezione non deve
 * accorgersene: chiede un'identità e riceve campi con la loro provenienza.
 *
 * Come per i provider del modulo gare, le due metà sono separate di proposito:
 * `lookup` tocca la rete — quindi fallisce, è lenta e gira solo sul server — e
 * `parse` è pura, cioè quella che si può provare su una risposta registrata.
 */

import { EvidenceLevel } from '@/components/crm/ricerca/constants';
import { PublicContact, SocialLink, TechSignal } from '@/types/prospect';
import { PageRole } from '../site/pages';
import { VatFound } from '../site/extract';

export interface IdentityResult {
  /** Se il soggetto risulta esistente presso la fonte. `null` = non si sa. */
  exists: boolean | null;
  legalName: string;
  address: string;
  street: string;
  postalCode: string;
  city: string;
  province: string;
  country: string;
  /** Livello di prova che questa fonte produce. */
  evidence: EvidenceLevel;
  /** Cosa sapere sul risultato: troncamenti, campi assenti, servizio parziale. */
  warnings: string[];
  /** Quando è stata interrogata, in ISO. */
  checkedAt: string;
}

export interface IdentityFailure {
  /** Codice leggibile dal chiamante, per decidere se ritentare. */
  code: 'SERVICE_DOWN' | 'RATE_LIMITED' | 'INVALID_INPUT' | 'NETWORK' | 'UNEXPECTED';
  /** Messaggio da mostrare all'utente così com'è. */
  message: string;
  retryable: boolean;
}

export type IdentityOutcome =
  | { ok: true; result: IdentityResult }
  | { ok: false; failure: IdentityFailure };

export interface IdentityProvider {
  id: string;
  label: string;
  /** Vero se costa: l'interfaccia lo segnala prima del clic. */
  billed: boolean;
  /** Tocca la rete. Solo server. */
  lookup(vatNumber: string): Promise<IdentityOutcome>;
}

// ------------------------------------------------------- Lettura del sito

/**
 * Il contratto di chi legge il sito di un'azienda.
 *
 * Come per l'identità, le due metà sono separate: `read` tocca la rete, quindi
 * gira solo sul server e può fallire in dieci modi; l'aggregazione di ciò che
 * è stato letto è pura e si prova su pagine registrate.
 *
 * Quello che esce di qui è **dichiarato**: l'azienda lo dice di sé. Non
 * diventa certo perché l'abbiamo letto noi.
 */

export interface SitePage {
  url: string;
  role: PageRole;
  status: number;
  html: string;
  headers: Record<string, string>;
}

/** Una pagina che si è provato a leggere, con l'esito. Anche quando è andata male. */
export interface PageOutcome {
  url: string;
  role: PageRole;
  status: number;
  /** Perché non è stata letta, quando non lo è stata. */
  skipped: string;
}

export interface SiteReadResult {
  domain: string;
  /** Dove si è finiti davvero: i redirect cambiano il dominio più spesso di quanto si creda. */
  finalUrl: string;
  pages: PageOutcome[];

  siteTitle: string;
  description: string;
  /** Il testo della pagina «chi siamo», o della home quando quella manca. */
  aboutText: string;
  /** I titoli delle sezioni: cosa vende, con parole sue. */
  headings: string[];

  /** Le partite IVA trovate nel sito, già validate. */
  vatNumbers: VatFound[];
  contacts: PublicContact[];
  /** Caselle riferibili a persone, viste e non raccolte. */
  skippedPersonalContacts: number;
  socialLinks: SocialLink[];
  techStack: TechSignal[];
  declaredClients: string[];
  declaredPartners: string[];

  /** Cosa non si è riusciti a leggere, e perché. Finisce fra le lacune della scheda. */
  warnings: string[];
  fetchedAt: string;
}

export interface SiteFailure {
  code: 'INVALID_INPUT' | 'ROBOTS_DENIED' | 'BLOCKED' | 'NOT_FOUND' | 'NOT_HTML' | 'TIMEOUT' | 'NETWORK' | 'UNEXPECTED';
  message: string;
  retryable: boolean;
}

export type SiteOutcome =
  | { ok: true; result: SiteReadResult }
  | { ok: false; failure: SiteFailure };

export interface SiteReader {
  id: string;
  label: string;
  /** Leggere un sito non costa: resta dichiarato perché lo si veda in interfaccia. */
  billed: boolean;
  /** Come ci si presenta. Si dichiara, non si nasconde. */
  userAgent: string;
  /** Tocca la rete. Solo server. */
  read(domain: string): Promise<SiteOutcome>;
}
