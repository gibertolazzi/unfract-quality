/**
 * Stimare il settore dalle parole che l'azienda usa per descriversi.
 *
 * È la stima da cui dipendono le altre: i competitor si cercano nello stesso
 * settore, e il cliente-tipo si deduce da chi compra da quel settore. Se
 * sbaglia questa, sbagliano tutte — motivo per cui **mostra le parole che
 * l'hanno decisa** e per cui rinuncia più spesso di quanto un classificatore
 * normale farebbe.
 *
 * «Impianti» e «climatizzazione» hanno portato lì: chi legge lo vede, e se ha
 * sbagliato lo corregge. Un settore senza le sue parole è un'etichetta che
 * nessuno può contestare, ed è esattamente ciò che questa sezione non produce.
 */

import { ConfidenceLevel } from '@/components/crm/ricerca/constants';
import { SECTORS, SectorDef } from './ateco';

export interface SectorGuess {
  /** Divisione ATECO a due cifre. Vuoto quando non si è concluso niente. */
  code: string;
  label: string;
  confidence: ConfidenceLevel;
  /** Le parole trovate nel testo che hanno portato qui. In chiaro. */
  signals: string[];
  /** Il settore arrivato secondo, quando c'era: serve a spiegare l'incertezza. */
  runnerUp: string;
  /** Perché non si è concluso niente, quando non si è concluso niente. */
  note: string;
}

const NIENTE: SectorGuess = {
  code: '', label: '', confidence: 'low', signals: [], runnerUp: '',
  note: 'Le parole del sito non ricadono in nessuna delle divisioni riconosciute.',
};

/** Il testo in forma confrontabile: minuscolo, senza accenti né punteggiatura. */
export function normalizeText(raw: string): string {
  return String(raw || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Quante volte la parola compare **intera**, non dentro un'altra.
 *
 * Le occorrenze contano, ma fino a un tetto: un'azienda che scrive «caffè»
 * quaranta volte sta dicendo qualcosa, e trattarlo come una parola trovata una
 * volta sola buttava via il segnale — misurato su illy.com, che restava senza
 * settore. Senza tetto, però, una parola ripetuta da un menù deciderebbe da
 * sola il settore di un'azienda che fa altro.
 */
export function occorrenze(testo: string, parola: string): number {
  const cercata = normalizeText(parola);
  if (!cercata) return 0;

  const spaziato = ' ' + testo + ' ';
  const ago = ' ' + cercata + ' ';
  let quante = 0;
  let da = spaziato.indexOf(ago);
  while (da !== -1) {
    quante++;
    // Si riparte dallo spazio finale: due parole consecutive uguali si
    // contano entrambe.
    da = spaziato.indexOf(ago, da + ago.length - 1);
  }
  return quante;
}

const TETTO_CHIAVE = 3;
const TETTO_FORTE = 2;

interface Punteggio {
  def: SectorDef;
  punti: number;
  trovate: string[];
}

/** «caffe» quando compare una volta, «caffe (12 volte)» quando insiste. */
function etichetta(parola: string, quante: number): string {
  return quante > 1 ? `${parola} (${quante} volte)` : parola;
}

function punteggia(testo: string): Punteggio[] {
  return SECTORS
    .map(def => {
      const trovate: string[] = [];
      let punti = 0;

      const viste = new Set<string>();

      for (const parola of def.strong || []) {
        const quante = occorrenze(testo, parola);
        if (quante === 0) continue;
        // Una parola che da sola dice quasi tutto vale il doppio: «pastificio»
        // non lascia dubbi, «produzione» sì.
        punti += 2 * Math.min(quante, TETTO_FORTE);
        viste.add(parola);
        trovate.push(etichetta(parola, quante));
      }
      for (const parola of def.keywords) {
        const quante = occorrenze(testo, parola);
        if (quante === 0 || viste.has(parola)) continue;
        punti += Math.min(quante, TETTO_CHIAVE);
        viste.add(parola);
        trovate.push(etichetta(parola, quante));
      }

      return { def, punti, trovate };
    })
    .filter(p => p.punti > 0)
    .sort((a, b) => b.punti - a.punti || a.def.code.localeCompare(b.def.code));
}

/**
 * Il settore, da tutto ciò che l'azienda dice di sé.
 *
 * La confidenza non è un numero travestito: dipende da **quanto** il settore
 * vincente stacca il secondo. Due settori appaiati con lo stesso punteggio
 * sono un'azienda che fa due cose, o un testo troppo generico — in tutti e due
 * i casi la risposta onesta è «forse», non una scelta a caso fra i due.
 */
export function estimateSector(pezzi: string[]): SectorGuess {
  const testo = normalizeText(pezzi.filter(Boolean).join(' '));
  if (!testo) {
    return { ...NIENTE, note: 'Il sito non ha lasciato testo su cui stimare il settore.' };
  }

  const classifica = punteggia(testo);
  if (classifica.length === 0) return NIENTE;

  const primo = classifica[0];
  const secondo = classifica[1];
  const stacco = primo.punti - (secondo?.punti || 0);

  // Una parola generica trovata una volta non è un settore: è una parola.
  // «bar» dentro la pagina di un pastificio classificava un pastificio come
  // ristorazione, e nessuno se ne sarebbe accorto guardando la scheda.
  if (primo.punti < 2) {
    return {
      code: '', label: '', confidence: 'low', signals: primo.trovate,
      runnerUp: secondo ? secondo.def.label : '',
      note: `Un solo indizio debole (${primo.trovate.map(p => `«${p}»`).join(', ')}): troppo poco per concludere un settore.`,
    };
  }

  let confidence: ConfidenceLevel = 'low';
  if (primo.punti >= 6 && stacco >= 3) confidence = 'high';
  else if (primo.punti >= 3 && stacco >= 2) confidence = 'medium';

  // Un pareggio non è una stima: è la constatazione che il testo dice due
  // cose. Sceglierne una a caso produrrebbe competitor e clienti-tipo di un
  // settore che non c'entra, e nessuno risalirebbe più all'errore.
  if (secondo && stacco === 0) {
    return {
      code: '', label: '', confidence: 'low',
      signals: [...primo.trovate, ...secondo.trovate],
      runnerUp: secondo.def.label,
      note: `Il sito parla in parti uguali di «${primo.def.label}» e «${secondo.def.label}»: il settore va scelto a mano.`,
    };
  }

  return {
    code: primo.def.code,
    label: primo.def.label,
    confidence,
    signals: primo.trovate,
    runnerUp: secondo ? secondo.def.label : '',
    note: '',
  };
}

/** La frase da mettere accanto al settore, che dice come ci si è arrivati. */
export function describeSector(guess: SectorGuess): string {
  if (!guess.code) return guess.note;
  const parole = guess.signals.map(p => `«${p}»`).join(', ');
  const base = `Divisione ATECO ${guess.code} — ${guess.label}. Ci portano ${parole}.`;
  const dubbio = guess.runnerUp ? ` Secondo candidato: ${guess.runnerUp}.` : '';
  const limite = ' Il codice completo a sei cifre richiede una visura camerale.';
  return base + dubbio + limite;
}
