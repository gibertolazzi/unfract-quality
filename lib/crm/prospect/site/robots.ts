/**
 * `robots.txt`: leggerlo e rispettarlo.
 *
 * Non è una gentilezza. È la sola dichiarazione che un sito pubblica su cosa
 * accetta che un programma legga, e ignorarla è la differenza fra raccogliere
 * dati pubblici e farsi bloccare — o peggio, doverlo spiegare a qualcuno.
 *
 * Il file si presenta come un testo, ma ha tre regole che è facile sbagliare e
 * che qui sono scritte apposta:
 *
 * 1. **Vince la regola più lunga**, non la prima. `Disallow: /` seguito da
 *    `Allow: /azienda/` significa «tutto chiuso tranne quella cartella»: chi si
 *    ferma alla prima riga legge l'esatto contrario.
 * 2. **A parità di lunghezza vince `Allow`.** È la lettura del protocollo, ed è
 *    anche la meno invadente in caso di dubbio.
 * 3. **Il gruppo si sceglie per nome, e `*` è il ripiego.** Se un sito ha
 *    scritto una regola per noi, quella vale e le regole generiche non si
 *    guardano più: mescolarle vorrebbe dire non rispettare nessuna delle due.
 *
 * Funzioni pure: si provano eseguendole, ed è quello che fa `crm/verifica`.
 */

export interface RobotsRule {
  allow: boolean;
  /** Il percorso dichiarato, con i suoi `*` e il suo eventuale `$`. */
  pattern: string;
}

export interface RobotsGroup {
  agents: string[];
  rules: RobotsRule[];
  /** Secondi fra una pagina e l'altra. `0` se il sito non ne chiede. */
  crawlDelay: number;
}

export interface Robots {
  groups: RobotsGroup[];
  sitemaps: string[];
}

/** Nessun file, nessuna restrizione: è la lettura corretta di un 404. */
export const ROBOTS_LIBERO: Robots = { groups: [], sitemaps: [] };

/** Un file che chiude tutto: si usa quando il server sbaglia e non si sa. */
export const ROBOTS_CHIUSO: Robots = {
  groups: [{ agents: ['*'], rules: [{ allow: false, pattern: '/' }], crawlDelay: 0 }],
  sitemaps: [],
};

/**
 * Legge il testo di un `robots.txt`.
 *
 * Righe sconosciute e righe malformate si ignorano: il protocollo lo prevede, e
 * un file con un refuso non deve diventare un motivo per leggere tutto.
 */
export function parseRobots(testo: string): Robots {
  const groups: RobotsGroup[] = [];
  const sitemaps: string[] = [];
  let corrente: RobotsGroup | null = null;
  // Due `User-agent:` di fila descrivono lo **stesso** gruppo: le regole che
  // seguono valgono per entrambi, e aprire un gruppo nuovo le perderebbe.
  let ultimaEraAgente = false;

  for (const grezza of String(testo || '').split(/\r?\n/)) {
    const riga = grezza.split('#')[0].trim();
    if (!riga) continue;

    const divisore = riga.indexOf(':');
    if (divisore < 0) continue;

    const campo = riga.slice(0, divisore).trim().toLowerCase();
    const valore = riga.slice(divisore + 1).trim();

    if (campo === 'user-agent') {
      if (!corrente || !ultimaEraAgente) {
        corrente = { agents: [], rules: [], crawlDelay: 0 };
        groups.push(corrente);
      }
      corrente.agents.push(valore.toLowerCase());
      ultimaEraAgente = true;
      continue;
    }

    if (campo === 'sitemap') {
      sitemaps.push(valore);
      continue;
    }

    if (!corrente) continue;
    ultimaEraAgente = false;

    if (campo === 'disallow') {
      // `Disallow:` senza valore significa «niente è vietato»: è il modo
      // canonico di aprire tutto, e trattarlo come `/` chiuderebbe il sito.
      if (valore) corrente.rules.push({ allow: false, pattern: valore });
      continue;
    }
    if (campo === 'allow') {
      if (valore) corrente.rules.push({ allow: true, pattern: valore });
      continue;
    }
    if (campo === 'crawl-delay') {
      const secondi = Number(valore.replace(',', '.'));
      if (Number.isFinite(secondi) && secondi > 0) corrente.crawlDelay = secondi;
    }
  }

  return { groups, sitemaps };
}

/**
 * Il gruppo che vale per noi: quello col nostro nome, altrimenti `*`.
 *
 * `null` vuol dire che il file non dice niente sul nostro conto **e** non ha
 * regole generiche: allora non c'è nulla da rispettare.
 */
export function groupFor(robots: Robots, agent: string): RobotsGroup | null {
  const nome = String(agent || '').toLowerCase();
  const nostro = robots.groups.find(g => g.agents.some(a => a !== '*' && nome.includes(a)));
  if (nostro) return nostro;
  return robots.groups.find(g => g.agents.includes('*')) || null;
}

/** Il percorso dichiarato diventa un'espressione: `*` è qualunque cosa, `$` la fine. */
function aRegex(pattern: string): RegExp {
  const ancorato = pattern.endsWith('$');
  const corpo = ancorato ? pattern.slice(0, -1) : pattern;
  const scappato = corpo.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp('^' + scappato + (ancorato ? '$' : ''));
}

/**
 * Se il gruppo permette quel percorso.
 *
 * Vince la regola con il percorso **più lungo**; a parità, vince `Allow`.
 * Nessuna regola che combacia significa permesso: `robots.txt` elenca ciò che
 * è vietato, non ciò che è consentito.
 */
export function pathAllowed(group: RobotsGroup | null, path: string): boolean {
  if (!group || group.rules.length === 0) return true;
  const percorso = path.startsWith('/') ? path : '/' + path;

  let vincente: RobotsRule | null = null;
  for (const regola of group.rules) {
    if (!aRegex(regola.pattern).test(percorso)) continue;
    if (!vincente) { vincente = regola; continue; }
    if (regola.pattern.length > vincente.pattern.length) { vincente = regola; continue; }
    if (regola.pattern.length === vincente.pattern.length && regola.allow) vincente = regola;
  }

  return vincente ? vincente.allow : true;
}

/** La domanda per intero: questo indirizzo lo possiamo leggere? */
export function robotsAllows(robots: Robots, agent: string, path: string): boolean {
  return pathAllowed(groupFor(robots, agent), path);
}

/** Quanto aspettare fra una pagina e l'altra, entro un limite ragionevole. */
export function crawlDelayFor(robots: Robots, agent: string, massimo = 10): number {
  const gruppo = groupFor(robots, agent);
  if (!gruppo || gruppo.crawlDelay <= 0) return 0;
  return Math.min(gruppo.crawlDelay, massimo);
}
