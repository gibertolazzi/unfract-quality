/**
 * I fornitori: dove si può essere onesti e utili insieme.
 *
 * Il piano (§4) separa due cose che di solito vengono confuse:
 *
 * - **i fornitori tecnologici sono fatti.** CMS, hosting, CDN, analytics,
 *   e-commerce, chat: si leggono dal sito, e sono verificabili da chiunque
 *   riapra la pagina. Per chi vende soluzioni digitali sono anche il gancio
 *   migliore che esista — dicono cosa usano oggi e dove fa male;
 * - **i fornitori dichiarati** sono la pagina «partner», quando c'è.
 *
 * Oltre a questo, per il B2B privato, **i fornitori non sono pubblici**. La
 * scheda lo scrive invece di riempire il riquadro: un elenco di fornitori
 * inventati è la cosa che fa chiudere lo strumento dopo il secondo utilizzo.
 *
 * Questo file quindi non stima quasi niente. Raggruppa fatti e dichiara un
 * buco, ed è esattamente quello che deve fare.
 */

import { TechSignal } from '@/types/prospect';

export interface SupplierGroup {
  category: string;
  items: TechSignal[];
}

export interface SupplierView {
  /** Fatti: raggruppati per categoria, ognuno con cosa l'ha rivelato. */
  technology: SupplierGroup[];
  /** Dichiarati dall'azienda sulla propria pagina partner. */
  declaredPartners: string[];
  /** Il gancio commerciale, quando la tecnologia ne suggerisce uno. */
  hooks: string[];
  /** Cosa non si sa, e perché. Si mostra, non si tace. */
  gaps: string[];
}

/** L'ordine in cui le categorie interessano a chi deve vendere qualcosa. */
const ORDINE = ['E-commerce', 'CMS', 'Site builder', 'Marketing', 'Chat', 'Analytics', 'Framework', 'Hosting', 'CDN', 'Server'];

/**
 * Cosa dice di un'azienda la tecnologia che ha in casa.
 *
 * Sono osservazioni, non promesse di vendita: il gancio è un'apertura, e la
 * frase dice **su cosa** si è aperta, così chi telefona non cita una cosa che
 * non ha visto.
 */
const GANCI: { quando: (nomi: string[], categorie: string[]) => boolean; frase: string }[] = [
  { quando: (_, cat) => cat.includes('E-commerce') && !cat.includes('Marketing'),
    frase: 'Vende online ma non ha strumenti di marketing automation riconoscibili: è il salto che di solito viene chiesto subito dopo.' },
  { quando: (nomi) => nomi.includes('Wix') || nomi.includes('Squarespace'),
    frase: 'Il sito è su un costruttore chiuso: chi ci arriva di solito ha già trovato il limite e cerca qualcosa di proprio.' },
  { quando: (_, cat) => !cat.includes('Analytics'),
    frase: 'Nessuno strumento di analisi riconosciuto: non stanno misurando cosa succede sul sito.' },
  { quando: (_, cat) => cat.includes('Marketing'),
    frase: 'Hanno già una piattaforma di marketing: c’è un budget, e c’è qualcuno che se ne occupa.' },
  { quando: (_, cat) => cat.includes('Chat'),
    frase: 'Hanno una chat sul sito: qualcuno risponde, quindi esiste un processo commerciale a cui agganciarsi.' },
];

export function buildSupplierView(tech: TechSignal[], partners: string[], sitoLetto: boolean): SupplierView {
  const categorie = Array.from(new Set(tech.map(t => t.category)));

  const technology: SupplierGroup[] = ORDINE
    .filter(categoria => categorie.includes(categoria))
    .map(categoria => ({ category: categoria, items: tech.filter(t => t.category === categoria) }));

  // Le categorie che non sono in elenco non si buttano: sarebbe un dato letto
  // e poi perso senza che nessuno lo sappia.
  for (const categoria of categorie) {
    if (ORDINE.includes(categoria)) continue;
    technology.push({ category: categoria, items: tech.filter(t => t.category === categoria) });
  }

  const nomi = tech.map(t => t.name);
  const hooks = tech.length > 0
    ? GANCI.filter(g => g.quando(nomi, categorie)).map(g => g.frase)
    : [];

  const gaps: string[] = [];
  if (!sitoLetto) {
    gaps.push('Il sito non è stato letto: le tecnologie in uso non si conoscono.');
  } else if (tech.length === 0) {
    gaps.push('Nessuna tecnologia riconosciuta fra quelle che il lettore sa riconoscere: può essere un sito fatto su misura.');
  }
  if (partners.length === 0) {
    gaps.push('L’azienda non pubblica una pagina di partner.');
  }
  // Il buco vero, e va detto sempre: è la differenza fra uno strumento onesto
  // e uno che riempie un riquadro per non lasciarlo vuoto.
  gaps.push('I fornitori di un’azienda privata non sono un dato pubblico: qui c’è solo ciò che l’azienda espone da sé.');

  return { technology, declaredPartners: partners, hooks, gaps };
}
