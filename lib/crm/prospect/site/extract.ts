/**
 * Leggere una pagina e ricavarne **fatti**.
 *
 * Tutto quello che esce da qui è qualcosa che l'azienda ha scritto sul proprio
 * sito: è materiale *dichiarato*, mai certo e mai stimato. Il livello lo
 * assegna `SOURCE_EVIDENCE.website`, e non c'è modo che una funzione di questo
 * file produca qualcosa di diverso.
 *
 * Due regole che hanno deciso più di metà del codice qui sotto:
 *
 * - **Niente indovinelli.** Nessuna email ricostruita per somiglianza, nessun
 *   numero di telefono pescato dal testo, nessun indirizzo dedotto. Si scrive
 *   ciò che è scritto, con la pagina che lo riporta.
 * - **Solo recapiti aziendali.** Un `info@` è un recapito dell'azienda; un
 *   `mario.rossi@` è il dato personale di una persona. Il secondo **non si
 *   raccoglie**: si conta, e il conteggio finisce fra le lacune della scheda,
 *   così chi guarda sa che c'era qualcosa e sa perché non c'è.
 *
 * Funzioni pure, su HTML passato come stringa: si provano su pagine registrate.
 */

import { PublicContact, SocialLink, TechSignal } from '@/types/prospect';
import { partitaIvaValida } from '../recognize';

// ------------------------------------------------------------- Il testo

const ENTITA: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  agrave: 'à', egrave: 'è', eacute: 'é', igrave: 'ì', ograve: 'ò', ugrave: 'ù',
  Agrave: 'À', Egrave: 'È', Eacute: 'É', Igrave: 'Ì', Ograve: 'Ò', Ugrave: 'Ù',
  euro: '€', deg: '°', laquo: '«', raquo: '»', hellip: '…', ndash: '–', mdash: '—',
};

export function decodeEntities(testo: string): string {
  return String(testo || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, esa) => String.fromCodePoint(parseInt(esa, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (intero, nome) => ENTITA[nome] ?? intero);
}

/**
 * Da HTML a testo leggibile.
 *
 * I tag diventano **uno spazio**, non niente: `<span>P.IVA</span><span>0074…`
 * senza quello spazio si legge `P.IVA0074…`, e l'etichetta smette di essere
 * riconoscibile. Script e stili si buttano interi — dentro c'è codice, e il
 * codice pieno di stringhe produce falsi riconoscimenti a ogni riga.
 */
export function toText(html: string): string {
  return decodeEntities(
    String(html || '')
      .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]+>/g, ' ')
  ).replace(/\s+/g, ' ').trim();
}

/** Il contenuto di un attributo, quando c'è. */
function attributo(tag: string, nome: string): string {
  const combacia = tag.match(new RegExp(nome + '\\s*=\\s*("([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i'));
  if (!combacia) return '';
  return decodeEntities(combacia[2] ?? combacia[3] ?? combacia[4] ?? '').trim();
}

// ------------------------------------------------------------ Partita IVA

const ETICHETTE_IVA =
  /(?:partita\s*i\.?\s*v\.?\s*a\.?|p\.?\s*i\.?\s*v\.?\s*a\.?|p\.?\s*i\.?\b|vat\s*(?:number|no\.?|id|reg\.?)?|c\.?\s*f\.?\s*(?:e|\/|-)?\s*p\.?\s*iva|codice\s*fiscale)/gi;

export interface VatFound {
  value: string;
  /** Le parole intorno: servono a far vedere **dove** è stata letta. */
  context: string;
}

/**
 * Le partite IVA scritte nella pagina.
 *
 * Si cerca **a partire dall'etichetta**, non le undici cifre in libertà: in una
 * pagina qualunque undici cifre di fila sono anche un numero d'ordine, un IBAN
 * spezzato o un codice prodotto. E si tiene solo ciò che supera la cifra di
 * controllo, perché un numero accanto alla scritta «P.IVA» può comunque essere
 * un refuso del sito.
 */
export function estraiPartiteIva(html: string): VatFound[] {
  const testo = toText(html);
  const trovate: VatFound[] = [];
  const viste = new Set<string>();

  ETICHETTE_IVA.lastIndex = 0;
  let etichetta: RegExpExecArray | null;
  while ((etichetta = ETICHETTE_IVA.exec(testo)) !== null) {
    const coda = testo.slice(etichetta.index + etichetta[0].length, etichetta.index + etichetta[0].length + 40);
    const numero = coda.match(/^[\s:.\-]*(?:IT)?[\s.\-]*((?:\d[\s.\-]?){11})/i);
    if (!numero) continue;

    const cifre = numero[1].replace(/\D/g, '');
    if (cifre.length !== 11 || !partitaIvaValida(cifre) || viste.has(cifre)) continue;

    viste.add(cifre);
    trovate.push({
      value: cifre,
      context: testo.slice(Math.max(0, etichetta.index - 30), etichetta.index + etichetta[0].length + 30).trim(),
    });
  }

  return trovate;
}

// -------------------------------------------------------------- Contatti

/**
 * Le caselle che appartengono all'azienda, non a una persona.
 *
 * È una lista **chiusa**, ed è una scelta: il criterio opposto — «prendi tutto
 * tranne quello che sembra un nome» — sbaglia sui cognomi che sembrano parole e
 * raccoglie dati personali per errore. Qui l'errore possibile è l'altro, cioè
 * scartare un `commerciale.nord@`: si perde un recapito, non si raccoglie una
 * persona.
 */
const CASELLE_AZIENDALI = [
  'info', 'contact', 'contacts', 'contatti', 'contatto', 'mail', 'email', 'posta',
  'commerciale', 'sales', 'vendite', 'ufficiovendite', 'preventivi',
  'amministrazione', 'amm', 'contabilita', 'fatturazione', 'fatture',
  'segreteria', 'direzione', 'ufficio', 'reception', 'centralino',
  'marketing', 'comunicazione', 'press', 'stampa', 'ufficiostampa',
  'support', 'supporto', 'assistenza', 'help', 'helpdesk', 'servizioclienti', 'customercare',
  'ordini', 'orders', 'acquisti', 'purchasing', 'logistica', 'spedizioni',
  'hr', 'risorseumane', 'jobs', 'lavoraconnoi', 'recruiting', 'selezione',
  'privacy', 'dpo', 'legal', 'legale', 'qualita', 'quality',
  'export', 'estero', 'italia', 'shop', 'store', 'booking', 'prenotazioni',
  'hello', 'ciao', 'pec', 'amministrazione.pec', 'sede',
];

/** Caselle che esistono per non essere scritte: raccoglierle è rumore. */
const CASELLE_INUTILI = ['noreply', 'no-reply', 'donotreply', 'mailer-daemon', 'postmaster', 'abuse'];

const DOMINI_FINTI = /(?:example\.(?:com|org)|sentry\.io|wixpress\.com|domain\.com|email\.com|tuodominio|yourdomain|\.png|\.jpg|\.gif|\.svg|\.webp)$/i;

function localPart(email: string): string {
  return email.split('@')[0].toLowerCase();
}

/** Una casella è aziendale se il suo nome è in elenco, anche con un suffisso. */
export function emailAziendale(email: string): boolean {
  const locale = localPart(email);
  if (CASELLE_INUTILI.some(c => locale === c || locale.startsWith(c))) return false;
  return CASELLE_AZIENDALI.some(c => locale === c || locale.startsWith(c + '.') || locale.startsWith(c + '-') || locale.startsWith(c + '_'));
}

const DOMINI_PEC = /(?:^|\.)(?:pec\.[a-z.]+|legalmail\.it|postecert\.it|pec\.it|arubapec\.it|registerpec\.it|sicurezzapostale\.it|cert\.legalmail\.it)$/i;

export function emailPec(email: string): boolean {
  const [locale, dominio = ''] = email.toLowerCase().split('@');
  return locale.includes('pec') || DOMINI_PEC.test(dominio);
}

/**
 * Una casella che **sembra** riferita a una persona: `mario.rossi@`,
 * `m-bianchi@`. Serve solo per le PEC, che sfuggono all'elenco chiuso.
 */
export function sembraNominativa(email: string): boolean {
  return /^[a-z]{2,}[._-][a-z]{2,}$/.test(localPart(email));
}

export interface ContactsFound {
  contacts: PublicContact[];
  /**
   * Quante caselle riferibili a persone sono state viste e **non raccolte**.
   * Il numero finisce fra le lacune: un campo vuoto senza questo conteggio
   * farebbe credere che il sito non pubblichi contatti.
   */
  skippedPersonal: number;
}

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9][a-z0-9.-]*\.[a-z]{2,}/gi;

/**
 * I recapiti pubblici di una pagina.
 *
 * I telefoni si prendono **solo dai link `tel:`**. Cercarli nel testo con
 * un'espressione regolare significa raccogliere partite IVA, CAP, codici
 * prodotto e anni: un `tel:` invece è il sito che dichiara «questo è un
 * numero da chiamare», e non c'è niente da interpretare.
 */
export function estraiContatti(html: string, pageUrl: string): ContactsFound {
  const contacts: PublicContact[] = [];
  const viste = new Set<string>();
  let skippedPersonal = 0;

  const candidate = new Set<string>();
  for (const tag of String(html || '').match(/<a\b[^>]*>/gi) || []) {
    const href = attributo(tag, 'href');
    if (/^mailto:/i.test(href)) candidate.add(decodeEntities(href.slice(7).split('?')[0]).trim().toLowerCase());
  }
  for (const trovata of toText(html).match(EMAIL) || []) candidate.add(trovata.toLowerCase());

  for (const email of Array.from(candidate)) {
    if (!email || DOMINI_FINTI.test(email) || viste.has(email)) continue;
    if (CASELLE_INUTILI.some(c => localPart(email).startsWith(c))) continue;

    const pec = emailPec(email);
    // Una PEC quasi mai si chiama `info@`: si chiama come l'azienda, e
    // l'elenco chiuso la scarterebbe. È anche il recapito che vale di più —
    // è quello depositato in Camera di commercio — quindi si tiene, a meno
    // che non abbia la forma di un nome di persona: le ditte individuali ce
    // l'hanno così, e quello è un dato personale come gli altri.
    if (!emailAziendale(email) && !(pec && !sembraNominativa(email))) { skippedPersonal++; continue; }

    viste.add(email);
    contacts.push({ kind: pec ? 'pec' : 'email', value: email, foundAt: pageUrl });
  }

  for (const tag of String(html || '').match(/<a\b[^>]*>/gi) || []) {
    const href = attributo(tag, 'href');
    if (!/^tel:/i.test(href)) continue;
    const numero = href.slice(4).replace(/[\s().-]/g, '');
    if (!/^\+?\d{6,15}$/.test(numero) || viste.has(numero)) continue;
    viste.add(numero);
    contacts.push({ kind: 'phone', value: numero, foundAt: pageUrl });
  }

  return { contacts, skippedPersonal };
}

// ---------------------------------------------------------------- Social

const RETI: { network: string; host: RegExp }[] = [
  { network: 'LinkedIn',  host: /(?:^|\.)linkedin\.com$/i },
  { network: 'Facebook',  host: /(?:^|\.)facebook\.com$/i },
  { network: 'Instagram', host: /(?:^|\.)instagram\.com$/i },
  { network: 'X',         host: /(?:^|\.)(?:twitter\.com|x\.com)$/i },
  { network: 'YouTube',   host: /(?:^|\.)(?:youtube\.com|youtu\.be)$/i },
  { network: 'TikTok',    host: /(?:^|\.)tiktok\.com$/i },
  { network: 'Vimeo',     host: /(?:^|\.)vimeo\.com$/i },
  { network: 'Xing',      host: /(?:^|\.)xing\.com$/i },
];

/** Bottoni «condividi»: puntano al social ma non sono il profilo dell'azienda. */
const CONDIVISIONE = /(?:\/sharer|\/share|\/intent\/|shareArticle|sharing\/share|\/dialog\/)/i;

/**
 * I profili social ufficiali: **il link, mai il contenuto**.
 *
 * Trovare e mostrare l'indirizzo di una pagina pubblica è lecito e basta a chi
 * deve preparare una telefonata. Estrarne i post o i dipendenti no: le
 * condizioni d'uso lo vietano e sono dati personali. La differenza sta tutta
 * qui, ed è voluta (PIANO-RICERCA.md §2).
 */
export function estraiSocial(html: string): SocialLink[] {
  const trovati: SocialLink[] = [];
  const reti = new Set<string>();

  for (const tag of String(html || '').match(/<a\b[^>]*>/gi) || []) {
    const href = attributo(tag, 'href');
    if (!/^https?:\/\//i.test(href) || CONDIVISIONE.test(href)) continue;

    let host = '';
    let percorso = '';
    try {
      const indirizzo = new URL(href);
      host = indirizzo.hostname;
      percorso = indirizzo.pathname;
    } catch { continue; }

    const rete = RETI.find(r => r.host.test(host));
    // Un link alla home del social non è un profilo: `facebook.com/` da solo
    // non dice niente, e metterlo sulla scheda fa perdere tempo a chi ci clicca.
    if (!rete || reti.has(rete.network) || percorso.replace(/\/+$/, '') === '') continue;

    reti.add(rete.network);
    trovati.push({ network: rete.network, url: href.split('?')[0] });
  }

  return trovati;
}

// ------------------------------------------------------------ Tecnologie

interface Firma {
  name: string;
  category: string;
  /** Cosa la rivela nell'HTML. */
  html?: RegExp;
  /** Cosa la rivela negli header della risposta. */
  header?: { nome: string; valore?: RegExp };
  /** Come si dice a voce: finisce dentro la scheda, non in un log. */
  come: string;
}

/**
 * Le tecnologie che un sito espone da sé.
 *
 * Sono l'unica parte di «fornitori» che è un **fatto verificabile** e non una
 * stima: il resto della catena di fornitura di un'azienda privata non è
 * pubblico, e la scheda lo scrive invece di riempire il riquadro
 * (PIANO-RICERCA.md §4). Per chi vende soluzioni digitali sono anche il gancio
 * migliore che esista: dicono cosa usano oggi.
 */
const FIRME: Firma[] = [
  { name: 'WordPress',     category: 'CMS',        html: /\/wp-(?:content|includes)\//i,                come: 'percorsi /wp-content/ nella pagina' },
  { name: 'Drupal',        category: 'CMS',        html: /(?:\/sites\/default\/files\/|Drupal\.settings)/i, come: 'percorsi e variabili di Drupal' },
  { name: 'Joomla',        category: 'CMS',        html: /\/media\/(?:jui|system)\/js\//i,               come: 'percorsi /media/jui/ nella pagina' },
  { name: 'TYPO3',         category: 'CMS',        html: /\/typo3(?:conf|temp)\//i,                      come: 'percorsi /typo3conf/ nella pagina' },
  { name: 'Shopify',       category: 'E-commerce', html: /cdn\.shopify\.com|Shopify\.theme/i,            come: 'risorse servite da cdn.shopify.com' },
  { name: 'WooCommerce',   category: 'E-commerce', html: /woocommerce/i,                                 come: 'fogli di stile di WooCommerce' },
  { name: 'Magento',       category: 'E-commerce', html: /\/static\/version\d+\/frontend\/|Magento_/i,   come: 'percorsi statici di Magento' },
  { name: 'PrestaShop',    category: 'E-commerce', html: /prestashop/i,                                  come: 'riferimenti a PrestaShop nella pagina' },
  { name: 'Wix',           category: 'Site builder', html: /static\.parastorage\.com|wix\.com/i,         come: 'risorse di Wix nella pagina' },
  { name: 'Squarespace',   category: 'Site builder', html: /squarespace\.com|static1\.squarespace/i,     come: 'risorse di Squarespace nella pagina' },
  { name: 'Webflow',       category: 'Site builder', html: /webflow\.(?:com|io)|data-wf-page/i,          come: 'attributi data-wf-page di Webflow' },
  { name: 'Next.js',       category: 'Framework',  html: /\/_next\/static\//i,                           come: 'percorsi /_next/static/' },
  { name: 'Nuxt',          category: 'Framework',  html: /\/_nuxt\//i,                                   come: 'percorsi /_nuxt/' },
  { name: 'Google Analytics', category: 'Analytics', html: /googletagmanager\.com\/gtag\/js|google-analytics\.com/i, come: 'script di Google Analytics' },
  { name: 'Google Tag Manager', category: 'Analytics', html: /googletagmanager\.com\/gtm\.js/i,          come: 'script di Tag Manager' },
  { name: 'Matomo',        category: 'Analytics',  html: /matomo\.(?:js|php)|piwik\.js/i,                come: 'script di Matomo' },
  { name: 'Hotjar',        category: 'Analytics',  html: /static\.hotjar\.com/i,                         come: 'script di Hotjar' },
  { name: 'Plausible',     category: 'Analytics',  html: /plausible\.io\/js/i,                           come: 'script di Plausible' },
  { name: 'HubSpot',       category: 'Marketing',  html: /js\.hs-(?:scripts|analytics)\.com/i,           come: 'script di HubSpot' },
  { name: 'Mailchimp',     category: 'Marketing',  html: /(?:chimpstatic\.com|list-manage\.com)/i,       come: 'moduli di Mailchimp' },
  { name: 'ActiveCampaign',category: 'Marketing',  html: /activehosted\.com/i,                           come: 'script di ActiveCampaign' },
  { name: 'Salesforce Pardot', category: 'Marketing', html: /pardot\.com|pi\.pardot/i,                   come: 'script di Pardot' },
  { name: 'Intercom',      category: 'Chat',       html: /widget\.intercom\.io|intercomcdn/i,            come: 'widget di Intercom' },
  { name: 'Zendesk',       category: 'Chat',       html: /zdassets\.com|zendesk\.com\/embeddable/i,      come: 'widget di Zendesk' },
  { name: 'Tawk.to',       category: 'Chat',       html: /embed\.tawk\.to/i,                             come: 'widget di Tawk.to' },
  { name: 'Crisp',         category: 'Chat',       html: /client\.crisp\.chat/i,                         come: 'widget di Crisp' },
  { name: 'Cloudflare',    category: 'CDN',        header: { nome: 'server', valore: /cloudflare/i },    come: 'header «server: cloudflare»' },
  { name: 'Vercel',        category: 'Hosting',    header: { nome: 'x-vercel-id' },                      come: 'header x-vercel-id' },
  { name: 'Netlify',       category: 'Hosting',    header: { nome: 'x-nf-request-id' },                  come: 'header x-nf-request-id' },
  { name: 'Amazon CloudFront', category: 'CDN',    header: { nome: 'x-amz-cf-id' },                      come: 'header x-amz-cf-id' },
  { name: 'Nginx',         category: 'Server',     header: { nome: 'server', valore: /nginx/i },         come: 'header «server: nginx»' },
  { name: 'Apache',        category: 'Server',     header: { nome: 'server', valore: /apache/i },        come: 'header «server: apache»' },
  { name: 'Microsoft IIS', category: 'Server',     header: { nome: 'server', valore: /iis|microsoft/i }, come: 'header «server: IIS»' },
];

export function estraiTecnologie(html: string, headers: Record<string, string> = {}): TechSignal[] {
  const sorgente = String(html || '');
  const minuscoli: Record<string, string> = {};
  for (const [chiave, valore] of Object.entries(headers)) minuscoli[chiave.toLowerCase()] = String(valore || '');

  const trovate: TechSignal[] = [];
  for (const firma of FIRME) {
    let rivelata = '';

    if (firma.html && firma.html.test(sorgente)) rivelata = firma.come;

    if (!rivelata && firma.header) {
      const valore = minuscoli[firma.header.nome];
      if (valore !== undefined && (!firma.header.valore || firma.header.valore.test(valore))) rivelata = firma.come;
    }

    if (!rivelata) continue;
    if (trovate.some(t => t.name === firma.name)) continue;
    trovate.push({ name: firma.name, category: firma.category, evidence: rivelata });
  }

  // La firma `generator` è quella che i CMS scrivono di sé: quando c'è, è più
  // attendibile di qualunque indizio dedotto dai percorsi.
  const generator = (sorgente.match(/<meta\b[^>]*name\s*=\s*["']generator["'][^>]*>/i) || [])[0];
  if (generator) {
    const contenuto = attributo(generator, 'content');
    if (contenuto && !trovate.some(t => contenuto.toLowerCase().includes(t.name.toLowerCase()))) {
      trovate.push({ name: contenuto.split(/\s+\d/)[0].trim(), category: 'CMS', evidence: 'meta generator della pagina' });
    }
  }

  return trovate;
}

// ------------------------------------------------- Cosa dice di sé il sito

/** La descrizione che il sito dà di sé, dalle sue stesse meta. */
export function estraiDescrizione(html: string): string {
  const sorgente = String(html || '');
  for (const espressione of [
    /<meta\b[^>]*name\s*=\s*["']description["'][^>]*>/i,
    /<meta\b[^>]*property\s*=\s*["']og:description["'][^>]*>/i,
  ]) {
    const tag = (sorgente.match(espressione) || [])[0];
    if (!tag) continue;
    const contenuto = attributo(tag, 'content').replace(/\s+/g, ' ').trim();
    if (contenuto) return contenuto.slice(0, 500);
  }
  return '';
}

export function estraiTitoloPagina(html: string): string {
  const combacia = String(html || '').match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return combacia ? decodeEntities(combacia[1]).replace(/\s+/g, ' ').trim().slice(0, 200) : '';
}

const TITOLI_INUTILI = /^(?:home|chi siamo|about|contatti|contact|news|blog|menu|cerca|search|cookie|privacy|newsletter|seguici|follow us)$/i;

/**
 * Cosa vende, **con parole sue**: i titoli delle sezioni della pagina.
 *
 * Non è un'analisi, è una citazione. Un `<h2>` in homepage è quello che
 * l'azienda ha scelto di far leggere per primo, e come punto di partenza per
 * una telefonata vale più di qualunque classificazione automatica. La
 * classificazione vera arriva alla fase delle stime, e sarà dichiarata tale.
 */
export function estraiTitoli(html: string, massimo = 12): string[] {
  const trovati: string[] = [];
  const viste = new Set<string>();

  for (const tag of String(html || '').match(/<h[123]\b[^>]*>[\s\S]*?<\/h[123]>/gi) || []) {
    const testo = toText(tag);
    const chiave = testo.toLowerCase();
    if (!testo || testo.length < 3 || testo.length > 120) continue;
    if (TITOLI_INUTILI.test(testo) || viste.has(chiave)) continue;
    viste.add(chiave);
    trovati.push(testo);
    if (trovati.length >= massimo) break;
  }

  return trovati;
}

const ALT_INUTILI = /^(?:logo|logos?|image|immagine|img|icon|icona|foto|picture|banner|slide\s*\d*|placeholder|cliente|clienti|partner|partners?|linkedin|facebook|instagram|youtube|twitter|tiktok|x)$/i;

/**
 * I loghi dei social in fondo alla pagina.
 *
 * Trovato leggendo danieli.com: nella pagina delle referenze finivano
 * «Danieli on Linkedin» e «Danieli on Instagram» fra i clienti dichiarati.
 * Sono le icone del piè di pagina, che sta su tutte le pagine del sito.
 */
const ALT_SOCIAL = /\b(?:on|su)\s+(?:linkedin|facebook|instagram|youtube|twitter|tiktok|vimeo|x)\b/i;

/**
 * I nomi letti dai loghi di una pagina «clienti» o «partner».
 *
 * È il testo alternativo delle immagini, cioè ciò che il sito scrive per chi
 * non le vede: un nome per esteso, quasi sempre. Si ripulisce da ciò che non è
 * un nome («logo», «immagine», i nomi di file) e si prende solo su pagine che
 * dichiarano di parlare di clienti o partner — altrove gli stessi loghi sono
 * quelli delle certificazioni o dei metodi di pagamento.
 */
export function estraiNomiDaLoghi(html: string, opzioni: { escludi?: string[]; massimo?: number } = {}): string[] {
  const massimo = opzioni.massimo ?? 40;
  // Il nome dell'azienda stessa: il suo logo è in testa a ogni pagina, e senza
  // questo filtro comparirebbe come primo dei propri clienti.
  const propri = (opzioni.escludi || []).map(v => v.toLowerCase()).filter(v => v.length >= 3);
  const nomi: string[] = [];
  const viste = new Set<string>();

  for (const tag of String(html || '').match(/<img\b[^>]*>/gi) || []) {
    let nome = attributo(tag, 'alt').replace(/\s+/g, ' ').trim();
    if (!nome) nome = attributo(tag, 'title').replace(/\s+/g, ' ').trim();
    // Via i suffissi che descrivono l'immagine e non l'azienda.
    nome = nome.replace(/\s*[-–|]?\s*(?:logo|logotipo|immagine|image)\s*$/i, '').trim();

    const chiave = nome.toLowerCase();
    if (!nome || nome.length < 2 || nome.length > 60) continue;
    if (ALT_INUTILI.test(nome) || ALT_SOCIAL.test(nome)) continue;
    if (/\.(?:png|jpe?g|gif|svg|webp)$/i.test(nome) || viste.has(chiave)) continue;
    if (propri.some(proprio => chiave.includes(proprio))) continue;

    viste.add(chiave);
    nomi.push(nome);
    if (nomi.length >= massimo) break;
  }

  return nomi;
}

/**
 * Il testo leggibile di una pagina, senza l'impalcatura.
 *
 * Serve alla stima del settore, e serve perché senza di esso quella stima non
 * ha su cosa lavorare: provata contro sei aziende vere, con la sola meta
 * description e i titoli, quattro volte su sei si fermava davanti a due
 * settori appaiati e una volta non concludeva niente. La descrizione di un
 * sito è una riga scritta per Google; la pagina «chi siamo» è dove un'azienda
 * spiega davvero cosa fa.
 *
 * Menù, intestazione e piè di pagina si buttano: sono uguali su tutte le
 * pagine del sito e portano le stesse parole ovunque, il che è il modo più
 * rapido di far somigliare fra loro aziende che non si somigliano.
 */
export function estraiTestoPrincipale(html: string, massimo = 4000): string {
  const senzaImpalcatura = String(html || '')
    .replace(/<nav\b[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<header\b[\s\S]*?<\/header>/gi, ' ')
    .replace(/<footer\b[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<form\b[\s\S]*?<\/form>/gi, ' ');

  const principale = senzaImpalcatura.match(/<(main|article)\b[\s\S]*?<\/\1>/i);
  return toText(principale ? principale[0] : senzaImpalcatura).slice(0, massimo);
}
