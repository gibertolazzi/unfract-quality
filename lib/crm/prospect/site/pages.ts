/**
 * Quali pagine leggere, e quante.
 *
 * Non si scarica un sito: si leggono **poche pagine scelte**, quelle che in
 * Italia contengono quasi sempre quello che serve. L'alternativa — seguire i
 * link finché ce ne sono — è un crawler, cioè un'altra cosa: consuma banda di
 * qualcuno che non l'ha chiesto, si fa bloccare, e per la scheda di
 * un'azienda non aggiunge niente che non stia già in cinque pagine.
 *
 * L'ordine non è casuale. La partita IVA sta quasi sempre nelle note legali o
 * nei contatti, quindi quelle vengono prima: se il sito ci lascia leggere una
 * pagina sola, tanto vale che sia quella che confermerà l'identità.
 */

export const PAGE_ROLES = ['home', 'legale', 'contatti', 'azienda', 'clienti', 'partner'] as const;
export type PageRole = typeof PAGE_ROLES[number];

export const PAGE_ROLE_LABELS: Record<PageRole, string> = {
  home:     'Home',
  legale:   'Note legali o privacy',
  contatti: 'Contatti',
  azienda:  'Chi siamo',
  clienti:  'Clienti e referenze',
  partner:  'Partner',
};

/** L'ordine in cui vale la pena spendere le poche letture che ci si concede. */
const PRIORITA: PageRole[] = ['legale', 'contatti', 'azienda', 'clienti', 'partner'];

const SEGNALI: Record<PageRole, RegExp> = {
  home:     /^$/,
  legale:   /(?:note[-_ ]?legali|privacy|cookie[-_ ]?policy|legal|impressum|termini|condizioni|dati[-_ ]?societari)/i,
  contatti: /(?:contatt|contact|dove[-_ ]?siamo|sedi?\b|kontakt|scrivici|richiedi[-_ ]?informazioni)/i,
  azienda:  /(?:chi[-_ ]?siamo|about|azienda|company|la[-_ ]?nostra[-_ ]?storia|profilo|who[-_ ]?we[-_ ]?are)/i,
  clienti:  /(?:client|customer|referenz|reference|case[-_ ]?stud|success[-_ ]?stor|portfolio|testimonial|lavori)/i,
  partner:  /(?:partner|rivenditor|dealer|reseller|collabora)/i,
};

/**
 * «Servizio clienti» non è «i nostri clienti».
 *
 * Trovato leggendo illy.com: la pagina `/servizio-clienti` finiva classificata
 * come pagina di referenze, e i loghi della sua interfaccia — «Storefront
 * Reference Architecture», «Abbonamento caffè» — finivano sulla scheda come
 * clienti dichiarati. Un elenco di clienti inventati è la cosa che fa chiudere
 * lo strumento dopo il secondo utilizzo, e questa riga è ciò che lo impedisce.
 */
const NON_SONO_REFERENZE = /(?:servizio[-_ ]?client|area[-_ ]?client|client[-_ ]?area|customer[-_ ]?(?:care|service|support)|assistenza|supporto|help[-_ ]?center|accedi|login|my[-_ ]?account)/i;

/** I file che non sono pagine: scaricarli non dà testo da leggere. */
const NON_PAGINE = /\.(?:pdf|zip|rar|docx?|xlsx?|pptx?|jpe?g|png|gif|svg|webp|mp4|mp3|avi|css|js|ico|xml|json)(?:$|\?)/i;

/**
 * Da `href` a indirizzo assoluto, o stringa vuota se non va seguito.
 *
 * Si resta **sullo stesso host**: un link a un fornitore o a un social è utile
 * altrove, non qui, e seguirlo significherebbe leggere il sito di qualcun
 * altro sotto il nome di questa azienda.
 */
export function assolutizza(href: string, baseUrl: string): string {
  const grezzo = String(href || '').trim();
  if (!grezzo || grezzo.startsWith('#') || /^(?:mailto|tel|javascript|data):/i.test(grezzo)) return '';

  let indirizzo: URL;
  let base: URL;
  try {
    base = new URL(baseUrl);
    indirizzo = new URL(grezzo, base);
  } catch { return ''; }

  if (indirizzo.protocol !== 'http:' && indirizzo.protocol !== 'https:') return '';

  const senzaWww = (h: string) => h.replace(/^www\./i, '').toLowerCase();
  if (senzaWww(indirizzo.hostname) !== senzaWww(base.hostname)) return '';
  if (NON_PAGINE.test(indirizzo.pathname)) return '';

  indirizzo.hash = '';
  return indirizzo.toString();
}

/** Che tipo di pagina promette di essere, guardando indirizzo e testo del link. */
export function classificaLink(url: string, testo: string): PageRole | '' {
  let percorso = '';
  try { percorso = decodeURIComponent(new URL(url).pathname); } catch { percorso = url; }
  const materiale = `${percorso} ${String(testo || '')}`;

  for (const ruolo of PRIORITA) {
    if (!SEGNALI[ruolo].test(materiale)) continue;
    if (ruolo === 'clienti' && NON_SONO_REFERENZE.test(materiale)) continue;
    return ruolo;
  }
  return '';
}

export interface PageChoice {
  url: string;
  role: PageRole;
  /** Il testo del link che ci ha portati lì: si mostra, non si deduce dopo. */
  label: string;
}

/**
 * Le pagine da leggere dopo la home, una per ruolo.
 *
 * Una sola per ruolo: dieci pagine «clienti» dello stesso sito dicono la
 * stessa cosa dieci volte, e ogni lettura in più è tempo di un server che non
 * ci ha invitati.
 */
export function scegliPagine(html: string, baseUrl: string, massimo = 4): PageChoice[] {
  const perRuolo = new Map<PageRole, PageChoice>();

  for (const tag of String(html || '').match(/<a\b[^>]*>[\s\S]*?<\/a>/gi) || []) {
    const apertura = (tag.match(/<a\b[^>]*>/i) || [''])[0];
    const href = (apertura.match(/href\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i) || []);
    const valore = href[2] ?? href[3] ?? href[4] ?? '';
    const url = assolutizza(valore.replace(/&amp;/g, '&'), baseUrl);
    if (!url || url.replace(/\/+$/, '') === baseUrl.replace(/\/+$/, '')) continue;

    const testo = tag.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const ruolo = classificaLink(url, testo);
    if (!ruolo || perRuolo.has(ruolo)) continue;

    perRuolo.set(ruolo, { url, role: ruolo, label: testo.slice(0, 80) });
  }

  return PRIORITA
    .map(ruolo => perRuolo.get(ruolo))
    .filter((scelta): scelta is PageChoice => Boolean(scelta))
    .slice(0, massimo);
}
