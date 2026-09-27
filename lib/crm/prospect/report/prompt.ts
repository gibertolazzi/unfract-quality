/**
 * Cosa si chiede al modello, e cosa gli si lascia fare.
 *
 * Due sezioni su sei — «perché ci interessano» e «da dove entrare». Sono le
 * due in cui serve una frase scritta bene, e sono anche le due in cui una
 * frase inventata fa meno danno: restano opinioni su fatti che stanno scritti
 * due righe sopra. Identità, recapiti, «cosa non dire» e le fonti **non le
 * tocca**, e non perché ci si fidi poco del modello: perché quelle quattro
 * sono la parte che una persona citerà al telefono.
 *
 * Il prompt riceve **solo valori**, mai le note dei campi vuoti: «il sito ha
 * rifiutato la connessione» è una frase che un modello legge come
 * informazione e riscrive come se fosse un fatto sull'azienda.
 *
 * E la risposta si **controlla** prima di scriverla. Il controllo non è
 * completo — nessun controllo automatico lo è su un testo libero — ma prende
 * il caso che capita davvero: i numeri. Fatturati, dipendenti, anni di
 * fondazione: un modello li produce con naturalezza, e nel report sembrano
 * dati. Se un numero non è nei fatti passati, la risposta si butta.
 */

import { FactSheet } from './facts';

export const PROMPT_VERSION = 'prospect-report-1';

/** I fatti in forma compatta: solo valori, divisi per livello. */
export function factsForPrompt(f: FactSheet): Record<string, any> {
  return {
    certi: {
      ragioneSociale: f.certain.legalName,
      partitaIva: f.certain.vatNumber,
      confermataDaVies: f.certain.vatValid,
      citta: f.certain.city,
      provincia: f.certain.province,
    },
    dichiaratiDallAzienda: {
      sito: f.declared.website,
      descrizione: f.declared.description,
      cosaRaccontaDiSe: f.declared.about,
      titoliDelleSezioni: f.declared.solutions,
      clientiCitati: f.declared.clients,
      partnerCitati: f.declared.partners,
      tecnologieRilevate: f.declared.tech.map(t => `${t.name} (${t.category})`),
      profiliSocial: f.declared.socials.map(s => s.network),
    },
    stimatiDaNoi: {
      settore: f.estimated.sector,
      parolePerCuiLoStimiamo: f.estimated.sectorSignals,
      clienteTipo: f.estimated.idealCustomer?.sectors || [],
    },
  };
}

export function buildPrompt(f: FactSheet, offering: string): string {
  const fatti = JSON.stringify(factsForPrompt(f), null, 2);

  return `Sei un analista commerciale. Scrivi due sezioni di una scheda su un'azienda, in italiano.

REGOLE, in ordine di importanza:
1. Usa SOLO i fatti qui sotto. Non aggiungere nomi, numeri, date, cifre di fatturato, numero di dipendenti, anni di fondazione o clienti che non siano scritti nei fatti.
2. Se una cosa non c'è nei fatti, NON scriverla e non dedurla.
3. Distingui sempre i tre livelli: i dati "certi" vengono da un registro ufficiale, i "dichiarati" li dice l'azienda di sé, gli "stimati" li abbiamo dedotti noi. Quando usi uno stimato, scrivi che è una stima.
4. Niente entusiasmo e niente aggettivi da brochure. Chi legge deve preparare una telefonata.
5. Frasi brevi. Elenchi puntati dove servono.

${offering ? `COSA VENDIAMO NOI: ${offering}` : 'NON sappiamo cosa vendiamo noi: non dire a quale nostra soluzione corrisponde un segnale. Limitati a dire perché questa azienda è interessante e su quale segnale.'}

FATTI:
${fatti}

Rispondi ESATTAMENTE con questo JSON, senza altro testo:
{
  "why_us": "Perché questa azienda ci interessa, e su quale segnale. Massimo 10 righe.",
  "entry_point": "Da dove entrare: il gancio concreto, con scritto da cosa viene. Massimo 10 righe."
}`;
}

export interface AiSections {
  why_us: string;
  entry_point: string;
}

/**
 * Legge la risposta.
 *
 * I modelli avvolgono il JSON in un blocco di codice più o meno una volta su
 * tre, anche quando gli si dice di non farlo: si toglie invece di far fallire
 * la lettura, perché non è un errore che riguarda il contenuto.
 */
export function parseAiSections(raw: string): AiSections | null {
  const pulito = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const inizio = pulito.indexOf('{');
  const fine = pulito.lastIndexOf('}');
  if (inizio < 0 || fine <= inizio) return null;

  try {
    const dati = JSON.parse(pulito.slice(inizio, fine + 1));
    const why = typeof dati?.why_us === 'string' ? dati.why_us.trim() : '';
    const entry = typeof dati?.entry_point === 'string' ? dati.entry_point.trim() : '';
    if (!why || !entry) return null;
    return { why_us: why, entry_point: entry };
  } catch {
    return null;
  }
}

const LIMITE_SEZIONE = 2500;

/** Tutti i numeri di quattro cifre o più che compaiono in un testo. */
export function numeriIn(testo: string): string[] {
  return Array.from(new Set(String(testo || '').match(/\d{4,}/g) || []));
}

export interface AiCheck {
  ok: boolean;
  problems: string[];
}

/**
 * Il controllo sulla risposta.
 *
 * Non è completo e non finge di esserlo: un modello che scrive «sono leader di
 * mercato» passa, perché nessun controllo automatico distingue
 * un'esagerazione da una descrizione. Prende il caso che capita davvero — i
 * numeri — e per il resto c'è l'approvazione di una persona, che è il motivo
 * per cui il report nasce in bozza.
 */
export function validateAiSections(sezioni: AiSections, f: FactSheet): AiCheck {
  const problems: string[] = [];
  const fonte = JSON.stringify(factsForPrompt(f)) + ' ' + f.declared.about;
  const numeriVeri = new Set(numeriIn(fonte));

  for (const [chiave, testo] of Object.entries(sezioni)) {
    if (testo.length > LIMITE_SEZIONE) {
      problems.push(`La sezione «${chiave}» è lunga ${testo.length} caratteri: oltre il limite di ${LIMITE_SEZIONE}.`);
    }
    for (const numero of numeriIn(testo)) {
      if (numeriVeri.has(numero)) continue;
      problems.push(`La sezione «${chiave}» contiene il numero ${numero}, che non è fra i dati raccolti.`);
    }
  }

  return { ok: problems.length === 0, problems };
}
