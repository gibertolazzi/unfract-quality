/**
 * Il report, composto dai dati raccolti. Senza AI.
 *
 * Non è un ripiego: è **la base**. L'AI, quando c'è, riscrive due sezioni su
 * sei — quelle in cui serve davvero una frase scritta bene — e le altre quattro
 * restano queste. Quando l'AI non c'è, il report è comunque completo e si legge.
 *
 * La conseguenza pratica: un report non è mai «vuoto perché manca la chiave»,
 * e chi approva confronta sempre un testo con i fatti che stanno lì sotto.
 *
 * Le sei sezioni sono quelle del piano (§5), in quest'ordine:
 *
 * 1. **Chi sono** — identità certa e cosa fanno.
 * 2. **Perché ci interessano** — su quale segnale.
 * 3. **Da dove entrare** — il gancio, con la fonte che lo sostiene.
 * 4. **Chi contattare e come** — canali pubblici, con quello consigliato.
 * 5. **Cosa non dire** — i punti che sono stime e non fatti.
 * 6. **Le fonti**, con le date.
 *
 * La quinta è quella che giustifica le altre quattro. Un report che non
 * distingue ciò che è stato verificato da ciò che abbiamo dedotto manda una
 * persona a citare al telefono una cosa che non è vera, e quella telefonata
 * non si recupera.
 */

import { ReportSection } from '@/types/prospect';
import { FactSheet, freshness } from './facts';
import { buildSupplierView } from '../estimate/suppliers';

export interface ComposeOptions {
  /**
   * Cosa vendiamo noi, in una frase. Senza, la sezione «perché ci interessano»
   * elenca i segnali senza poter dire a quale nostra soluzione corrispondono —
   * e lo scrive, invece di fingere di saperlo.
   */
  offering?: string;
}

const righe = (pezzi: (string | false | null | undefined)[]): string =>
  pezzi.filter(Boolean).join('\n');

/** 1. Chi sono. */
function chiSono(f: FactSheet): string {
  const nome = f.certain.legalName || f.displayName;
  const sede = [f.certain.city, f.certain.province && `(${f.certain.province})`].filter(Boolean).join(' ');

  const partita = f.certain.vatNumber
    ? f.certain.vatValid === true
      ? `Partita IVA ${f.certain.vatNumber}, confermata da VIES.`
      : f.certain.vatValid === false
        ? `Partita IVA ${f.certain.vatNumber}: **non risulta presso VIES**. Da verificare prima di usarla.`
        : `Partita IVA ${f.certain.vatNumber}, non ancora verificata.`
    : 'Partita IVA non trovata: l’identità non è confermata da nessun registro.';

  const cosaFa = f.declared.description
    || f.declared.about.split(/(?<=\.)\s/).slice(0, 2).join(' ')
    || (f.declared.solutions.length ? `Dal sito: ${f.declared.solutions.slice(0, 3).join('; ')}.` : '');

  return righe([
    `**${nome}**${sede ? ` — ${sede}` : ''}`,
    partita,
    f.declared.website && `Sito: ${f.declared.website}`,
    cosaFa && `\n${cosaFa}`,
    f.estimated.sector && `\nSettore stimato: ${f.estimated.sector}${f.estimated.sectorCode ? ` (divisione ATECO ${f.estimated.sectorCode})` : ''}. È una stima nostra, non un dato camerale.`,
  ]);
}

/** 2. Perché ci interessano. */
function percheCiInteressano(f: FactSheet, offering: string): string {
  const segnali: string[] = [];

  if (f.declared.tech.length) {
    segnali.push(`Usano ${f.declared.tech.map(t => t.name).join(', ')}: è quello che hanno in casa oggi, letto dal loro sito.`);
  }
  if (f.estimated.sector) {
    segnali.push(`Settore stimato: ${f.estimated.sector}${f.estimated.sectorSignals.length ? ` — ci portano ${f.estimated.sectorSignals.slice(0, 4).join(', ')}` : ''}.`);
  }
  if (f.declared.clients.length) {
    segnali.push(`Dichiarano ${f.declared.clients.length} clienti con nome: ${f.declared.clients.slice(0, 5).join(', ')}${f.declared.clients.length > 5 ? '…' : ''}. Sono nomi veri, non stime.`);
  }
  if (f.estimated.idealCustomer) {
    segnali.push(`Vendono tipicamente a: ${f.estimated.idealCustomer.sectors.join(', ')}.`);
  }

  if (segnali.length === 0) {
    return 'Non ci sono ancora segnali su cui dire se questa azienda ci interessa. Serve leggere il sito, o aspettare che le stime abbiano su cosa lavorare.';
  }

  const apertura = offering
    ? `Noi vendiamo: ${offering}. I segnali su questa azienda:`
    : 'Non è configurato cosa vendiamo, quindi questi sono i segnali, senza dire a quale nostra soluzione corrispondano:';

  return righe([apertura, '', ...segnali.map(s => `- ${s}`)]);
}

/** 3. Da dove entrare. */
function daDoveEntrare(f: FactSheet): string {
  const vista = buildSupplierView(f.declared.tech, f.declared.partners, Boolean(f.declared.collectedAt));

  const ganci = vista.hooks.map(g => `- ${g}`);
  const dalSito = f.declared.solutions.length
    ? `- Le cose che mettono per prime sul sito: ${f.declared.solutions.slice(0, 4).join('; ')}. Sono parole loro, si possono citare.`
    : '';
  const dalleReferenze = f.declared.clients.length
    ? `- Citano ${f.declared.clients.slice(0, 3).join(', ')} fra i clienti: se ne conosciamo qualcuno, quello è il gancio più corto.`
    : '';

  const tutto = [...ganci, dalSito, dalleReferenze].filter(Boolean);
  if (tutto.length === 0) {
    return 'Nessun gancio concreto dai dati raccolti. Il sito non ha lasciato abbastanza: conviene guardarlo a mano prima di chiamare.';
  }
  return righe(['Ogni punto qui sotto viene da qualcosa che è stato letto sul loro sito.', '', ...tutto]);
}

/** 4. Chi contattare e come. */
function chiContattare(f: FactSheet): string {
  if (f.declared.contacts.length === 0 && f.declared.socials.length === 0) {
    return righe([
      'Nessun recapito pubblico trovato nelle pagine lette.',
      '',
      'Non se ne inventano: un indirizzo ricostruito per somiglianza produce rimbalzi e scrive a persone che non risultano da nessuna fonte.',
    ]);
  }

  const pec = f.declared.contacts.filter(c => c.kind === 'pec');
  const email = f.declared.contacts.filter(c => c.kind === 'email');
  const tel = f.declared.contacts.filter(c => c.kind === 'phone');

  // Il consiglio non è una preferenza: il telefono apre una conversazione, la
  // PEC è un canale formale che per un primo contatto commerciale è fuori
  // registro, e un indirizzo generico finisce spesso in una casella che
  // nessuno presidia.
  const consigliato = tel.length
    ? `Consigliato: **telefono ${tel[0].value}**. Su un primo contatto apre una conversazione invece di aspettare una risposta.`
    : email.length
      ? `Consigliato: **${email[0].value}**. È una casella aziendale: la legge chi smista, quindi la prima riga deve dire subito di cosa si tratta.`
      : `Resta solo la PEC. Per un primo contatto commerciale è un canale formale e fuori registro: meglio cercare un numero sul sito.`;

  return righe([
    ...tel.map(c => `- Telefono: ${c.value} — trovato su ${c.foundAt}`),
    ...email.map(c => `- Email aziendale: ${c.value} — trovata su ${c.foundAt}`),
    ...pec.map(c => `- PEC: ${c.value} — trovata su ${c.foundAt}`),
    ...f.declared.socials.map(s => `- ${s.network}: ${s.url}`),
    '',
    consigliato,
    '',
    'Tutti recapiti **aziendali**, presi dalle pagine indicate. Nessun indirizzo di persone: non si raccolgono. I consensi nel CRM restano a «no» — trovare un recapito pubblico non è averne ottenuto uno.',
  ]);
}

/** 5. Cosa non dire. È la sezione che giustifica le altre. */
function cosaNonDire(f: FactSheet): string[] {
  const punti: string[] = [];

  if (f.estimated.sector) {
    punti.push(`Il settore «${f.estimated.sector}» è una stima nostra, dedotta dalle parole del loro sito. Non è il loro codice ATECO camerale.`);
  }
  if (f.estimated.competitors.length) {
    punti.push(`I concorrenti elencati sono una stima fra le aziende che abbiamo già in archivio: non è l'elenco dei loro concorrenti. ${f.estimated.competitorNote}`.trim());
  }
  if (f.estimated.idealCustomer) {
    punti.push('Il cliente-tipo è una generalizzazione di settore, non è dedotto dai loro clienti veri.');
  }
  if (f.certain.vatValid === null && f.certain.vatNumber) {
    punti.push('La partita IVA non è stata verificata da VIES: non dire che è stata controllata.');
  }
  if (f.certain.vatValid === false) {
    punti.push('La partita IVA trovata non risulta presso VIES: non usarla in nessun documento prima di averla verificata.');
  }
  if (!f.declared.description && !f.declared.about) {
    punti.push('Quello che fanno non l’abbiamo letto dal loro sito: non attribuirgli attività che non hanno dichiarato.');
  }
  for (const lacuna of f.gaps.slice(0, 5)) punti.push(lacuna);

  if (punti.length === 0) {
    punti.push('Tutto quello che c’è in questo report è un fatto verificabile: identità da VIES, il resto dichiarato dall’azienda sul proprio sito.');
  }
  return punti;
}

/** 6. Le fonti. */
function leFonti(f: FactSheet): string {
  const quando = freshness(f);
  return righe([
    `- **VIES** (Commissione Europea) — identità: ${quando.identity}.`,
    f.declared.website
      ? `- **${f.declared.website}** — quello che dichiarano: ${quando.declared}.`
      : '- Nessun sito letto.',
    `- **Calcolo nostro** — le stime: ${quando.estimated}.`,
    '',
    'Ogni dato della scheda porta la propria fonte e la propria data: se una di queste sembra vecchia, la scheda si aggiorna e il report si rifà.',
  ]);
}

/**
 * Il report completo, dai soli dati raccolti.
 *
 * `sourceIds` resta vuoto qui: gli id delle fonti stanno sui campi della
 * scheda, e ricopiarli in due posti vorrebbe dire che uno dei due prima o poi
 * è vecchio. Li riempie chi scrive il report, leggendoli dalla scheda.
 */
export function composeReport(f: FactSheet, options: ComposeOptions = {}): {
  sections: ReportSection[];
  caveats: string[];
} {
  const caveats = cosaNonDire(f);

  const sections: ReportSection[] = [
    { key: 'who', title: 'Chi sono', body: chiSono(f), sourceIds: [] },
    { key: 'why_us', title: 'Perché ci interessano', body: percheCiInteressano(f, options.offering || ''), sourceIds: [] },
    { key: 'entry_point', title: 'Da dove entrare', body: daDoveEntrare(f), sourceIds: [] },
    { key: 'who_to_contact', title: 'Chi contattare e come', body: chiContattare(f), sourceIds: [] },
    { key: 'do_not_say', title: 'Cosa non dire', body: caveats.map(c => `- ${c}`).join('\n'), sourceIds: [] },
    { key: 'sources', title: 'Le fonti', body: leFonti(f), sourceIds: [] },
  ];

  return { sections, caveats };
}

/** Le sezioni che l'AI può riscrivere. Le altre quattro non si toccano. */
export const AI_WRITABLE: ReportSection['key'][] = ['why_us', 'entry_point'];
