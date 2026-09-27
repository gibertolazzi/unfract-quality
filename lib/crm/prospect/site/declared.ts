/**
 * Da quello che si è letto, la parte «dichiarato» della scheda.
 *
 * Una funzione sola, pura, e il motivo per cui è sola: è qui che si decide
 * come viene mostrato un campo che **non** è stato trovato. Sparso in dieci
 * punti, quel giudizio diventerebbe dieci giudizi diversi, e la scheda
 * mostrerebbe a volte un vuoto muto e a volte una spiegazione.
 *
 * La regola è una: **niente resta vuoto senza il suo perché**. «Il sito non lo
 * dichiara» e «la pagina non è stata letta» portano chi legge a due decisioni
 * diverse, e un campo vuoto le confonde in una sola.
 */

import { CompanyDeclared } from '@/types/prospect';
import { SiteReadResult } from '../providers/types';
import { evidenced, missing } from '../base';

/** Se una pagina di quel ruolo non è stata letta, dice perché; altrimenti ''. */
function nonLetta(result: SiteReadResult, ruolo: string): string {
  const esito = result.pages.find(p => p.role === ruolo);
  if (!esito) return '';
  return esito.skipped;
}

export function buildDeclaredArea(result: SiteReadResult, sourceId: string): CompanyDeclared {
  const quando = result.fetchedAt;
  const da = <T,>(valore: T | null, nota: string) =>
    valore === null ? missing<T>(nota) : evidenced<T>(valore, 'website', sourceId, quando);

  const elenco = (valori: string[], nota: string) => valori.length > 0
    ? evidenced<string[]>(valori, 'website', sourceId, quando)
    : missing<string[]>(nota);

  const clientiNonLetti = nonLetta(result, 'clienti');
  const partnerNonLetti = nonLetta(result, 'partner');

  return {
    website: da<string>(result.finalUrl || `https://${result.domain}`, ''),

    description: result.description
      ? evidenced<string>(result.description, 'website', sourceId, quando)
      : result.siteTitle
        // Il titolo non è una descrizione, e va detto: è quasi sempre il nome
        // dell'azienda con uno slogan attaccato.
        ? evidenced<string>(result.siteTitle, 'website', sourceId, quando,
            'Dal titolo della pagina: il sito non pubblica una descrizione.')
        : missing<string>('Il sito non pubblica né una descrizione né un titolo leggibile.'),

    aboutText: result.aboutText
      ? evidenced<string>(result.aboutText, 'website', sourceId, quando,
          'Testo della pagina in cui l’azienda spiega cosa fa, troncato.')
      : missing<string>('Nessuna pagina leggibile in cui l’azienda spieghi cosa fa.'),

    solutions: elenco(result.headings,
      'Nessun titolo di sezione leggibile in home: cosa vende va letto a mano.'),

    // Il settore non si legge dal sito: si stima, e quella è un'altra cosa con
    // un'altra faccia. Riempirlo qui vorrebbe dire far passare per dichiarata
    // una classificazione fatta da noi.
    targetSectors: missing<string[]>('I settori si stimano dal testo del sito: arrivano con le stime.'),

    declaredClients: elenco(result.declaredClients, clientiNonLetti
      ? `La pagina dei clienti non è stata letta: ${clientiNonLetti}.`
      : 'Il sito non pubblica una pagina di clienti o referenze.'),

    declaredPartners: elenco(result.declaredPartners, partnerNonLetti
      ? `La pagina dei partner non è stata letta: ${partnerNonLetti}.`
      : 'Il sito non pubblica una pagina di partner.'),

    publicContacts: result.contacts.length > 0
      ? evidenced(result.contacts, 'website', sourceId, quando,
          result.skippedPersonalContacts > 0
            ? `Solo recapiti aziendali: ${result.skippedPersonalContacts} indirizzi riferibili a persone non sono stati raccolti.`
            : '')
      : missing<typeof result.contacts>(result.skippedPersonalContacts > 0
          ? `Nessun recapito aziendale: i ${result.skippedPersonalContacts} indirizzi trovati sono riferibili a persone e non si raccolgono.`
          : 'Nessun recapito pubblico trovato nelle pagine lette.'),

    socialLinks: result.socialLinks.length > 0
      ? evidenced(result.socialLinks, 'website', sourceId, quando)
      : missing<typeof result.socialLinks>('Nessun profilo social collegato dal sito.'),

    techStack: result.techStack.length > 0
      ? evidenced(result.techStack, 'website', sourceId, quando)
      : missing<typeof result.techStack>('Nessuna tecnologia riconosciuta fra quelle che il lettore sa riconoscere.'),
  };
}

/**
 * Le lacune da mostrare in cima alla scheda.
 *
 * Sono gli avvisi della lettura, non un riassunto scritto dopo: se una pagina
 * è stata rifiutata, chi guarda la scheda deve saperlo prima di concludere che
 * quell'azienda non pubblica i suoi clienti.
 */
export function gapsFromSite(result: SiteReadResult): string[] {
  return result.warnings.slice(0, 10);
}
