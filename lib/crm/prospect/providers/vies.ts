/**
 * VIES — il servizio della Commissione Europea che conferma le partite IVA.
 *
 * È l'unica fonte certa e gratuita che abbiamo: da una partita IVA restituisce
 * **ragione sociale e indirizzo ufficiali**. Non fa il contrario — non si cerca
 * per nome — e non dice né settore né dipendenti né fatturato.
 *
 * Tre cose imparate guardando le risposte vere, che un'implementazione scritta
 * a tavolino sbaglierebbe:
 *
 * 1. **Le ragioni sociali lunghe arrivano troncate a 60 caratteri.** «DANIELI &
 *    C. OFFICINE MECCANICHE S.P.A. IN FORMA ABBREVIATA» finisce lì perché è
 *    lunga, non perché l'azienda si chiami così. Va segnalato, o quel nome
 *    finisce tale e quale su una lettera.
 * 2. **«Non trovato» arriva in due forme**: campi a `---` oppure campi vuoti.
 *    Trattarne una sola lascia passare l'altra come se fosse un nome.
 * 3. **«Partita IVA inesistente» e «servizio italiano non disponibile» si
 *    somigliano.** Per distinguerle c'è un secondo endpoint che dichiara lo
 *    stato per paese, ed è la differenza fra «questa azienda non esiste» e
 *    «riprova fra un'ora».
 */

import { IdentityProvider, IdentityOutcome, IdentityResult } from './types';

const BASE = 'https://ec.europa.eu/taxation_customs/vies/rest-api';

/** VIES riempie i campi assenti con `---`, oppure li lascia vuoti. */
function assente(valore: string): boolean {
  const v = String(valore || '').trim();
  return v === '' || v === '---';
}

/** Oltre questa lunghezza la risposta è quasi certamente tagliata. */
const LIMITE_NOME_VIES = 60;

/**
 * Traduce la risposta grezza. Pura: si prova su risposte registrate, ed è
 * quello che fa `crm/verifica/esegui.mjs` con sette aziende vere.
 */
export function parseViesResponse(raw: any, checkedAt: string): IdentityResult {
  const avvisi: string[] = [];
  const valido = raw?.valid === true;

  const nome = assente(raw?.name) ? '' : String(raw.name).trim();
  const indirizzo = assente(raw?.address) ? '' : String(raw.address).trim();

  if (valido && !nome) {
    avvisi.push('La partita IVA risulta attiva ma il titolare non è pubblicato: alcuni Stati non lo espongono.');
  }
  if (nome.length >= LIMITE_NOME_VIES) {
    avvisi.push(`La ragione sociale arriva da VIES troncata a ${LIMITE_NOME_VIES} caratteri: potrebbe essere incompleta.`);
  }

  const luogo = parseIndirizzoItaliano(indirizzo);
  if (valido && indirizzo && !luogo.city) {
    avvisi.push('Indirizzo in un formato non riconosciuto: conservato per intero, non diviso in città e provincia.');
  }

  return {
    exists: valido,
    legalName: nome,
    address: indirizzo.replace(/\s*\n\s*/g, ', ').replace(/,\s*$/, ''),
    street: luogo.street,
    postalCode: luogo.postalCode,
    city: luogo.city,
    province: luogo.province,
    country: valido ? 'IT' : '',
    evidence: 'certain',
    warnings: avvisi,
    checkedAt,
  };
}

/**
 * L'indirizzo italiano arriva su due righe: la via, poi «CAP CITTÀ SIGLA».
 * Quando non combacia si restituisce vuoto invece di indovinare: un indirizzo
 * diviso male è peggio di uno non diviso, perché sembra un dato strutturato.
 */
export function parseIndirizzoItaliano(indirizzo: string): {
  street: string; postalCode: string; city: string; province: string;
} {
  const vuoto = { street: '', postalCode: '', city: '', province: '' };
  const righe = String(indirizzo || '').split('\n').map(r => r.trim()).filter(Boolean);
  if (righe.length === 0) return vuoto;

  const ultima = righe[righe.length - 1];
  const combacia = ultima.match(/^(\d{5})\s+(.+?)\s+([A-Z]{2})$/);
  if (!combacia) return { ...vuoto, street: righe.join(', ') };

  return {
    street: righe.slice(0, -1).join(', '),
    postalCode: combacia[1],
    city: combacia[2].trim(),
    province: combacia[3],
  };
}

/** Lo stato del servizio italiano, per non scambiare un guasto per un'assenza. */
export async function servizioItalianoDisponibile(): Promise<boolean | null> {
  try {
    const risposta = await fetch(`${BASE}/check-status`, { cache: 'no-store' });
    if (!risposta.ok) return null;
    const dati = await risposta.json();
    const italia = (dati?.countries || []).find((c: any) => c?.countryCode === 'IT');
    if (!italia) return null;
    return italia.availability === 'Available';
  } catch {
    return null;
  }
}

export const viesProvider: IdentityProvider = {
  id: 'vies',
  label: 'VIES — Commissione Europea',
  billed: false,

  async lookup(vatNumber: string): Promise<IdentityOutcome> {
    const cifre = String(vatNumber || '').replace(/\D/g, '');
    if (cifre.length !== 11) {
      return { ok: false, failure: {
        code: 'INVALID_INPUT', retryable: false,
        message: 'VIES accetta partite IVA italiane di undici cifre.',
      }};
    }

    let risposta: Response;
    try {
      risposta = await fetch(`${BASE}/check-vat-number`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ countryCode: 'IT', vatNumber: cifre }),
        cache: 'no-store',
      });
    } catch (error) {
      console.error('VIES non raggiungibile:', error);
      return { ok: false, failure: {
        code: 'NETWORK', retryable: true,
        message: 'Non è stato possibile raggiungere VIES. Riprova fra qualche minuto.',
      }};
    }

    if (risposta.status === 429) {
      return { ok: false, failure: {
        code: 'RATE_LIMITED', retryable: true,
        message: 'VIES ha risposto che le richieste sono troppe. Riprova fra qualche minuto.',
      }};
    }
    if (!risposta.ok) {
      // Qui sta la distinzione che conta: prima di dire «non esiste», si
      // guarda se il servizio italiano è in piedi.
      const disponibile = await servizioItalianoDisponibile();
      return { ok: false, failure: {
        code: 'SERVICE_DOWN', retryable: true,
        message: disponibile === false
          ? 'Il servizio italiano di VIES risulta non disponibile in questo momento: la partita IVA non è stata verificata, e questo non significa che non esista.'
          : `VIES ha risposto con un errore (${risposta.status}). La partita IVA non è stata verificata.`,
      }};
    }

    try {
      const dati = await risposta.json();
      return { ok: true, result: parseViesResponse(dati, new Date().toISOString()) };
    } catch (error) {
      console.error('Risposta VIES illeggibile:', error);
      return { ok: false, failure: {
        code: 'UNEXPECTED', retryable: false,
        message: 'VIES ha risposto in un formato non riconosciuto.',
      }};
    }
  },
};
