/**
 * Capire cosa è stato scritto nel campo di ricerca.
 *
 * Un campo solo, quattro possibilità: partita IVA, codice fiscale, sito, nome.
 * Chiedere all'utente di dichiararlo con un menù a tendina è il modo più rapido
 * di farlo sbagliare — chi incolla `IT 00743110157` da una email non ha voglia
 * di scegliere anche la categoria.
 *
 * Funzioni pure: si provano eseguendole, ed è quello che fa `crm/verifica`.
 */

import { SearchKind } from '@/components/crm/ricerca/constants';
import { normalizeVat, normalizeDomain } from './base';

// ------------------------------------------------------- Partita IVA

/**
 * Validazione della partita IVA italiana: undici cifre con cifra di controllo.
 *
 * L'algoritmo è quello del DPR 605/1973 — una variante di Luhn. Le cifre in
 * posizione pari (la prima, la terza…) si sommano; quelle in posizione dispari
 * si raddoppiano, e se superano nove si sottrae nove. La cifra di controllo
 * porta il totale al multiplo di dieci successivo.
 *
 * Serve perché una partita IVA scritta male non venga mandata a VIES per poi
 * tornare «non valida»: sono due risposte diverse — *questa non è una partita
 * IVA* e *questa partita IVA non risulta* — e confonderle fa cercare un errore
 * dove non c'è.
 *
 * Nota: era già scritta e provata nel modulo gare, che però è uscito dal
 * progetto (docs/RICERCA-FONDAMENTA.md §8). Qui è riscritta, e riprovata sulle
 * stesse aziende reali.
 */
export function partitaIvaValida(raw: string): boolean {
  const cifre = normalizeVat(raw);
  if (!/^\d{11}$/.test(cifre)) return false;

  let somma = 0;
  for (let i = 0; i < 10; i++) {
    const cifra = Number(cifre[i]);
    if (i % 2 === 0) {
      somma += cifra;
    } else {
      const doppio = cifra * 2;
      somma += doppio > 9 ? doppio - 9 : doppio;
    }
  }
  const controllo = (10 - (somma % 10)) % 10;
  return controllo === Number(cifre[10]);
}

// ----------------------------------------------------- Codice fiscale

const DISPARI: Record<string, number> = {
  '0': 1, '1': 0, '2': 5, '3': 7, '4': 9, '5': 13, '6': 15, '7': 17, '8': 19, '9': 21,
  A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21, K: 2, L: 4, M: 18,
  N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14, U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23,
};
const PARI: Record<string, number> = {
  '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  A: 0, B: 1, C: 2, D: 3, E: 4, F: 5, G: 6, H: 7, I: 8, J: 9, K: 10, L: 11, M: 12,
  N: 13, O: 14, P: 15, Q: 16, R: 17, S: 18, T: 19, U: 20, V: 21, W: 22, X: 23, Y: 24, Z: 25,
};
const RESTO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Codice fiscale di persona fisica: sedici caratteri con lettera di controllo.
 *
 * Nella ricerca aziende capita con le ditte individuali, dove il codice
 * fiscale del titolare è l'unico identificativo che qualcuno ha sottomano.
 * Quello delle società invece è un numero di undici cifre e coincide con la
 * partita IVA: lo copre `partitaIvaValida`.
 */
export function codiceFiscaleValido(raw: string): boolean {
  const cf = String(raw || '').toUpperCase().replace(/\s/g, '');
  if (!/^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/.test(cf)) return false;

  let somma = 0;
  for (let i = 0; i < 15; i++) {
    const carattere = cf[i];
    somma += i % 2 === 0 ? DISPARI[carattere] : PARI[carattere];
  }
  return RESTO[somma % 26] === cf[15];
}

// ------------------------------------------------------ Riconoscimento

export interface Recognized {
  kind: SearchKind;
  /** Il valore ripulito, pronto da usare: cifre per la partita IVA, dominio senza schema. */
  normalized: string;
  /** Vero quando la forma è valida. Un nome è sempre valido: è testo libero. */
  valid: boolean;
  /** Cosa dire a chi ha scritto, quando c'è qualcosa da dire. */
  message: string;
}

const PATTERN_DOMINIO = /^(?:https?:\/\/)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}(?:[\/?#].*)?$/i;
const PATTERN_EMAIL = /^[^\s@]+@([^\s@]+\.[a-z]{2,})$/i;

/**
 * Riconosce l'input. L'ordine conta: si va dal più specifico al più generico,
 * perché `illy.com` è anche un nome plausibile e `00743110157` è anche una
 * stringa.
 */
export function recognize(raw: string): Recognized {
  const testo = String(raw || '').trim();
  if (!testo) {
    return { kind: 'name', normalized: '', valid: false, message: 'Scrivi una partita IVA, un sito o il nome di un’azienda.' };
  }

  // Un'email: si tiene il dominio. Capita di incollare il contatto invece del
  // sito, e il dominio è comunque la cosa giusta da cercare.
  const email = testo.match(PATTERN_EMAIL);
  if (email) {
    const dominio = normalizeDomain(email[1]);
    return {
      kind: 'domain', normalized: dominio, valid: !!dominio,
      message: `Cercata l’azienda del dominio ${dominio}, ricavato dall’indirizzo email.`,
    };
  }

  // Undici cifre: è una partita IVA, valida o meno che sia.
  const soloCifre = normalizeVat(testo);
  if (/^\d{11}$/.test(soloCifre)) {
    const valida = partitaIvaValida(soloCifre);
    return {
      kind: 'vat', normalized: soloCifre, valid: valida,
      message: valida ? '' : 'Undici cifre, ma la cifra di controllo non torna: probabilmente c’è un errore di battitura.',
    };
  }

  // Sedici caratteri nella forma del codice fiscale.
  const possibileCf = testo.toUpperCase().replace(/\s/g, '');
  if (/^[A-Z0-9]{16}$/.test(possibileCf)) {
    const valido = codiceFiscaleValido(possibileCf);
    return {
      kind: 'tax_code', normalized: possibileCf, valid: valido,
      message: valido ? '' : 'Sedici caratteri, ma il carattere di controllo non torna.',
    };
  }

  // Un numero di cifre diverso da undici non è una partita IVA: dirlo subito
  // evita una ricerca per nome su una stringa di numeri, che non troverà nulla.
  if (/^\d+$/.test(soloCifre) && soloCifre.length > 4) {
    return {
      kind: 'vat', normalized: soloCifre, valid: false,
      message: `Una partita IVA italiana ha undici cifre, questa ne ha ${soloCifre.length}.`,
    };
  }

  if (PATTERN_DOMINIO.test(testo)) {
    const dominio = normalizeDomain(testo);
    return { kind: 'domain', normalized: dominio, valid: !!dominio, message: '' };
  }

  return { kind: 'name', normalized: testo.replace(/\s+/g, ' '), valid: true, message: '' };
}

/** Frase da mostrare sotto il campo, per far vedere cosa si sta per cercare. */
export function describeRecognition(r: Recognized): string {
  if (!r.normalized) return '';
  switch (r.kind) {
    case 'vat':      return r.valid ? `Partita IVA ${r.normalized}: si interroga VIES.` : r.message;
    case 'tax_code': return r.valid ? `Codice fiscale ${r.normalized}.` : r.message;
    case 'domain':   return r.message || `Sito ${r.normalized}: si legge la pagina e si cerca la partita IVA.`;
    case 'name':     return `«${r.normalized}»: si cerca sul web, e i risultati vanno scelti.`;
  }
}
