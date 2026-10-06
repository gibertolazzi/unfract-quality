/**
 * Il lettore di siti.
 *
 * Legge poche pagine del sito di un'azienda e ne ricava fatti dichiarati:
 * partita IVA, recapiti aziendali, profili social, tecnologie usate, clienti e
 * partner citati. Gratis, e senza chiedere niente a nessuno.
 *
 * **Ci si presenta per quel che si è.** `User-Agent: UnfractCRM`, `robots.txt`
 * letto e rispettato, una pagina alla volta. Travestirsi da Chrome funziona —
 * tre siti su dieci, nel campione del piano, chiudono la porta a un bot
 * dichiarato — ed è esattamente la scorciatoia che mette un'azienda nei guai
 * il giorno che qualcuno se ne accorge. Dove ci chiudono la porta, **il campo
 * resta vuoto e la scheda scrive perché**.
 *
 * Il resto sono limiti, tutti deliberati:
 *
 * - **cinque pagine al massimo**, scelte per ruolo (`site/pages.ts`);
 * - **dieci secondi** per pagina, poi si rinuncia a quella e si va avanti;
 * - **un tetto di byte**: una homepage da venti megabyte non è una pagina da
 *   leggere, è un problema di qualcun altro;
 * - **solo HTML**: un PDF o un JSON non si interpretano qui;
 * - **solo indirizzi pubblici**: il dominio e ogni redirect si ricontrollano
 *   prima di ogni richiesta (`lib/server/publicUrl.ts`), altrimenti il server
 *   si potrebbe usare per leggere indirizzi interni.
 */

import {
  SiteReader, SiteOutcome, SiteReadResult, SitePage, PageOutcome, SiteFailure,
} from './types';
import {
  parseRobots, robotsAllows, crawlDelayFor, ROBOTS_LIBERO, ROBOTS_CHIUSO, Robots,
} from '../site/robots';
import { scegliPagine, PageRole, PAGE_ROLE_LABELS } from '../site/pages';
import {
  estraiPartiteIva, estraiContatti, estraiSocial, estraiTecnologie,
  estraiDescrizione, estraiTitoloPagina, estraiTitoli, estraiNomiDaLoghi,
  estraiTestoPrincipale,
} from '../site/extract';
import { normalizeDomain, nowIso } from '../base';
import { assertPublicUrl, UnsafeUrlError } from '@/lib/server/publicUrl';

/**
 * Come ci si presenta.
 *
 * `PROSPECT_BOT_INFO_URL` va impostata prima di usare la sezione su dati veri:
 * un bot che dichiara un nome ma non dice dove scrivere per farsi escludere è
 * a metà strada, e la metà che manca è quella che serve a chi riceve le
 * richieste. Senza, il nome resta comunque dichiarato.
 */
export function userAgent(): string {
  const info = (typeof process !== 'undefined' && process.env?.PROSPECT_BOT_INFO_URL) || '';
  return info
    ? `UnfractCRM/1.0 (+${info}; ricerca aziende B2B)`
    : 'UnfractCRM/1.0 (ricerca aziende B2B)';
}

const TIMEOUT_MS = 10_000;
const MAX_BYTES = 1_500_000;
const MAX_PAGINE = 5;
const MAX_REDIRECT = 5;

function headersDi(risposta: Response): Record<string, string> {
  const raccolti: Record<string, string> = {};
  risposta.headers.forEach((valore, chiave) => { raccolti[chiave.toLowerCase()] = valore; });
  return raccolti;
}

/**
 * Una richiesta con scadenza: senza, una pagina lenta blocca tutta la lettura.
 *
 * I redirect si seguono a mano, uno per uno, per ricontrollare ogni
 * destinazione: un sito pubblico può rimandare a un indirizzo interno.
 */
async function prendi(url: string, accetta: string): Promise<Response> {
  const stop = new AbortController();
  const scadenza = setTimeout(() => stop.abort(), TIMEOUT_MS);
  try {
    let indirizzo = url;
    for (let salti = 0; ; salti++) {
      await assertPublicUrl(indirizzo);
      const risposta = await fetch(indirizzo, {
        headers: { 'User-Agent': userAgent(), Accept: accetta, 'Accept-Language': 'it,en;q=0.8' },
        redirect: 'manual',
        signal: stop.signal,
        cache: 'no-store',
      });
      const destinazione = risposta.headers.get('location');
      if (risposta.status < 300 || risposta.status >= 400 || !destinazione) return risposta;

      await risposta.body?.cancel();
      if (salti >= MAX_REDIRECT) throw new Error(`Più di ${MAX_REDIRECT} redirect`);
      indirizzo = new URL(destinazione, indirizzo).toString();
    }
  } finally {
    clearTimeout(scadenza);
  }
}

/**
 * Com'è andata la lettura del `robots.txt`. Cinque casi, e non vanno confusi:
 * quattro di questi finiscono sulla scheda come frasi diverse, perché portano
 * chi legge a decisioni diverse.
 */
export type EsitoRobots = 'letto' | 'assente' | 'rifiutato' | 'errore-server' | 'timeout' | 'irraggiungibile';

/**
 * Il `robots.txt` del sito.
 *
 * Un 404 vuol dire «nessuna restrizione» ed è la lettura corretta. Un errore
 * del server o una connessione caduta vogliono dire **non lo so**, e allora si
 * sta fermi: leggere lo stesso sarebbe decidere al posto di chi non ha
 * risposto.
 *
 * L'esito torna insieme alle regole perché sono tre situazioni diverse e
 * l'utente ha diritto a saperle distinte. Nella prima versione non lo era, e
 * `marchesini.com` — un dominio che non esiste più — produceva il messaggio
 * «il sito dichiara di non voler essere letto»: una frase falsa su un'azienda
 * che non aveva dichiarato proprio niente.
 */
export async function leggiRobots(origine: string): Promise<{ robots: Robots; esito: EsitoRobots }> {
  try {
    const risposta = await prendi(`${origine}/robots.txt`, 'text/plain,*/*');
    if (risposta.status === 404 || risposta.status === 410) return { robots: ROBOTS_LIBERO, esito: 'assente' };
    // 401, 403 e 429 sul `robots.txt` non sono un guasto: sono la risposta di
    // chi non vuole programmi. technogym.com fa esattamente questo.
    if ([401, 403, 429].includes(risposta.status)) return { robots: ROBOTS_CHIUSO, esito: 'rifiutato' };
    if (!risposta.ok) return { robots: ROBOTS_CHIUSO, esito: 'errore-server' };
    const testo = (await risposta.text()).slice(0, 200_000);
    return { robots: parseRobots(testo), esito: 'letto' };
  } catch (error: any) {
    console.error('robots.txt non leggibile:', error);
    return { robots: ROBOTS_CHIUSO, esito: error?.name === 'AbortError' ? 'timeout' : 'irraggiungibile' };
  }
}

/**
 * Perché non si legge: una frase diversa per ogni motivo.
 *
 * Sono tutte varianti di «il campo resta vuoto», ma chi guarda la scheda ci
 * fa cose diverse: un dominio sbagliato si corregge, un sito che rifiuta i
 * programmi si guarda a mano, un servizio lento si riprova domani. Un
 * messaggio solo per tutti e quattro i casi manderebbe a cercare l'errore
 * dove non c'è.
 */
export function motivoDelNo(dominio: string, esito: EsitoRobots): SiteFailure {
  if (esito === 'irraggiungibile') {
    return { code: 'NETWORK', retryable: true,
      message: `${dominio} non risponde: non è stato possibile leggerne nemmeno il robots.txt. Controlla che l’indirizzo sia giusto.` };
  }
  if (esito === 'timeout') {
    return { code: 'TIMEOUT', retryable: true,
      message: `${dominio} non ha risposto entro ${TIMEOUT_MS / 1000} secondi nemmeno per il robots.txt: può essere lento, oppure lasciare cadere in silenzio le richieste dei programmi dichiarati.` };
  }
  if (esito === 'rifiutato') {
    return { code: 'BLOCKED', retryable: false,
      message: `${dominio} rifiuta le richieste di un programma dichiarato: risponde di no già al suo robots.txt. Il sito va guardato a mano.` };
  }
  if (esito === 'errore-server') {
    return { code: 'NETWORK', retryable: true,
      message: `Il server di ${dominio} ha risposto con un errore al suo robots.txt: senza sapere cosa permette, il sito non si legge.` };
  }
  return { code: 'ROBOTS_DENIED', retryable: false,
    message: 'Il sito dichiara nel suo robots.txt di non voler essere letto da programmi. Non si insiste.' };
}

const attendi = (secondi: number) =>
  secondi > 0 ? new Promise(risolvi => setTimeout(risolvi, secondi * 1000)) : Promise.resolve();

/**
 * Mette insieme quello che è stato letto. **Pura**: è la metà che si prova su
 * pagine registrate, ed è quella dove si annidano gli errori che nessuno
 * vedrebbe a occhio.
 */
export function aggregaPagine(
  pagine: SitePage[],
  esiti: PageOutcome[],
  domain: string,
  finalUrl: string,
  fetchedAt: string = nowIso()
): SiteReadResult {
  const home = pagine.find(p => p.role === 'home') || pagine[0];
  const avvisi: string[] = [];

  /** Come si chiama l'azienda, per non contarla fra i propri clienti. */
  const propri = [domain.split('.')[0], ...(home ? estraiTitoloPagina(home.html).split(/[|\u2013\u2014\-:]/) : [])]
    .map(v => v.trim())
    .filter(v => v.length >= 3);

  const vatNumbers: SiteReadResult['vatNumbers'] = [];
  const contacts: SiteReadResult['contacts'] = [];
  const socialLinks: SiteReadResult['socialLinks'] = [];
  const techStack: SiteReadResult['techStack'] = [];
  let skippedPersonalContacts = 0;
  let declaredClients: string[] = [];
  let declaredPartners: string[] = [];

  const vistiVat = new Set<string>();
  const vistiContatti = new Set<string>();
  const visteReti = new Set<string>();
  const visteTecnologie = new Set<string>();

  for (const pagina of pagine) {
    for (const iva of estraiPartiteIva(pagina.html)) {
      if (vistiVat.has(iva.value)) continue;
      vistiVat.add(iva.value);
      vatNumbers.push(iva);
    }

    const recapiti = estraiContatti(pagina.html, pagina.url);
    skippedPersonalContacts += recapiti.skippedPersonal;
    for (const recapito of recapiti.contacts) {
      if (vistiContatti.has(recapito.value)) continue;
      vistiContatti.add(recapito.value);
      contacts.push(recapito);
    }

    for (const social of estraiSocial(pagina.html)) {
      if (visteReti.has(social.network)) continue;
      visteReti.add(social.network);
      socialLinks.push(social);
    }

    for (const tecnologia of estraiTecnologie(pagina.html, pagina.headers)) {
      if (visteTecnologie.has(tecnologia.name)) continue;
      visteTecnologie.add(tecnologia.name);
      techStack.push(tecnologia);
    }

    // I loghi si leggono **solo** dove la pagina dichiara di parlare di
    // clienti o partner: altrove gli stessi loghi sono certificazioni, metodi
    // di pagamento o sponsor, e finirebbero in elenco come clienti.
    if (pagina.role === 'clienti') declaredClients = estraiNomiDaLoghi(pagina.html, { escludi: propri });
    if (pagina.role === 'partner') declaredPartners = estraiNomiDaLoghi(pagina.html, { escludi: propri });
  }

  for (const esito of esiti) {
    if (!esito.skipped) continue;
    avvisi.push(`${PAGE_ROLE_LABELS[esito.role]}: ${esito.skipped}`);
  }

  if (vatNumbers.length === 0) {
    avvisi.push('Nessuna partita IVA trovata nelle pagine lette: l’identità resta da confermare a mano.');
  }
  if (vatNumbers.length > 1) {
    // Succede nei gruppi societari, e non è un errore: è una scelta che deve
    // fare una persona, non una funzione che prende la prima.
    avvisi.push(`Trovate ${vatNumbers.length} partite IVA diverse: va scelta quella giusta prima di confermare l’identità.`);
  }
  if (skippedPersonalContacts > 0) {
    avvisi.push(`${skippedPersonalContacts} indirizzi riferibili a persone non sono stati raccolti: si raccolgono solo i recapiti aziendali.`);
  }
  if (contacts.length === 0) {
    avvisi.push('Nessun recapito aziendale pubblico trovato nelle pagine lette.');
  }

  return {
    domain,
    finalUrl,
    pages: esiti,
    siteTitle: home ? estraiTitoloPagina(home.html) : '',
    description: home ? estraiDescrizione(home.html) : '',
    // La pagina «chi siamo» quando c'è, la home quando non c'è: è lì che
    // un'azienda spiega cosa fa, e la stima del settore non ha altro.
    // La pagina «chi siamo» **e** la home: la prima racconta la storia, la
    // seconda dice cosa vendono oggi, e il settore si legge meglio nelle due
    // insieme che in una sola.
    aboutText: [
      estraiTestoPrincipale(pagine.find(p => p.role === 'azienda')?.html || '', 3000),
      estraiTestoPrincipale(home?.html || '', 3000),
    ].filter(Boolean).join(' ').slice(0, 6000),
    headings: home ? estraiTitoli(home.html) : [],
    vatNumbers,
    contacts,
    skippedPersonalContacts,
    socialLinks,
    techStack,
    declaredClients,
    declaredPartners,
    warnings: avvisi,
    fetchedAt,
  };
}

/** Scarica una pagina, entro i limiti. `null` con il motivo se non si può. */
async function leggiPagina(url: string, role: PageRole): Promise<{ pagina: SitePage | null; esito: PageOutcome }> {
  try {
    const risposta = await prendi(url, 'text/html,application/xhtml+xml');
    const tipo = risposta.headers.get('content-type') || '';

    if (!risposta.ok) {
      const motivo = risposta.status === 403
        ? 'il sito ha rifiutato la connessione a un programma dichiarato (403)'
        : `il server ha risposto ${risposta.status}`;
      return { pagina: null, esito: { url, role, status: risposta.status, skipped: motivo } };
    }
    if (!/text\/html|application\/xhtml/i.test(tipo)) {
      return { pagina: null, esito: { url, role, status: risposta.status, skipped: `non è una pagina HTML (${tipo.split(';')[0] || 'tipo non dichiarato'})` } };
    }

    const html = (await risposta.text()).slice(0, MAX_BYTES);
    return {
      pagina: { url: risposta.url || url, role, status: risposta.status, html, headers: headersDi(risposta) },
      esito: { url: risposta.url || url, role, status: risposta.status, skipped: '' },
    };
  } catch (error: any) {
    if (error instanceof UnsafeUrlError) {
      return { pagina: null, esito: { url, role, status: 0, skipped: 'rimanda a un indirizzo non pubblico, non letta' } };
    }
    const scaduta = error?.name === 'AbortError';
    console.error('Pagina non letta:', url, error);
    return { pagina: null, esito: { url, role, status: 0,
      skipped: scaduta ? `nessuna risposta entro ${TIMEOUT_MS / 1000} secondi` : 'connessione non riuscita' } };
  }
}

export const websiteReader: SiteReader = {
  id: 'website',
  label: 'Sito dell’azienda',
  billed: false,
  get userAgent() { return userAgent(); },

  async read(domain: string): Promise<SiteOutcome> {
    const dominio = normalizeDomain(domain);
    if (!dominio || !dominio.includes('.')) {
      return { ok: false, failure: { code: 'INVALID_INPUT', retryable: false,
        message: 'Serve un dominio, per esempio «illy.com».' } };
    }

    const origine = `https://${dominio}`;
    try {
      await assertPublicUrl(`${origine}/`);
    } catch (error) {
      // Un errore del DNS qui non si decide: lo racconta leggiRobots, con la
      // frase giusta per un dominio che non risponde.
      if (error instanceof UnsafeUrlError) {
        return { ok: false, failure: { code: 'INVALID_INPUT', retryable: false, message: error.message } };
      }
    }

    const { robots, esito } = await leggiRobots(origine);
    const nostroNome = userAgent();

    if (!robotsAllows(robots, nostroNome, '/')) {
      return { ok: false, failure: motivoDelNo(dominio, esito) };
    }

    const pausa = crawlDelayFor(robots, nostroNome);

    const primaLettura = await leggiPagina(`${origine}/`, 'home');
    if (!primaLettura.pagina) {
      const esito = primaLettura.esito;
      const code = esito.status === 403 ? 'BLOCKED' : esito.status === 404 ? 'NOT_FOUND' : esito.status === 0 ? 'NETWORK' : 'UNEXPECTED';
      return { ok: false, failure: { code, retryable: code === 'NETWORK',
        message: `La home di ${dominio} non è stata letta: ${esito.skipped}.` } };
    }

    const pagine: SitePage[] = [primaLettura.pagina];
    const esiti: PageOutcome[] = [primaLettura.esito];
    const finalUrl = primaLettura.pagina.url;

    for (const scelta of scegliPagine(primaLettura.pagina.html, finalUrl, MAX_PAGINE - 1)) {
      let percorso = '/';
      try { percorso = new URL(scelta.url).pathname; } catch { /* resta '/' */ }

      if (!robotsAllows(robots, nostroNome, percorso)) {
        esiti.push({ url: scelta.url, role: scelta.role, status: 0,
          skipped: 'esclusa dal robots.txt del sito' });
        continue;
      }

      await attendi(pausa);
      const lettura = await leggiPagina(scelta.url, scelta.role);
      esiti.push(lettura.esito);
      if (lettura.pagina) pagine.push(lettura.pagina);
    }

    return { ok: true, result: aggregaPagine(pagine, esiti, dominio, finalUrl) };
  },
};
