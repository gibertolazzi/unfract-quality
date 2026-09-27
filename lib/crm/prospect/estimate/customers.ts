/**
 * I clienti: due cose diverse, tenute separate.
 *
 * - **I clienti dichiarati** sono fatti. Referenze, case study, loghi in
 *   homepage: nomi veri, già utili, e già raccolti alla fase 4.
 * - **Il cliente-tipo** è una stima, e risponde alla domanda che serve davvero
 *   a chi vende: *questa azienda è un buon lead per me?*
 *
 * La stima si fa da una cosa sola: **chi compra, in generale, da un'azienda di
 * quel settore** (`ateco.ts`, campo `serveA`). È una generalizzazione, e come
 * tale viene presentata — non è dedotta dai clienti veri di questa azienda,
 * perché di quelli conosciamo i nomi e non i settori.
 *
 * Due casi in cui la stima **non si fa**, ed è la parte che conta:
 *
 * - **i settori orizzontali** — software, consulenza, marketing, ricerca del
 *   personale — vendono a chiunque. Elencare mezza economia come «cliente-tipo»
 *   sarebbe vero e inutile insieme;
 * - **quando l'azienda i clienti li dichiara**, quei nomi valgono più di
 *   qualunque generalizzazione, e la scheda lo dice a chi legge invece di
 *   mettere le due cose alla pari.
 */

import { ConfidenceLevel } from '@/components/crm/ricerca/constants';
import { IdealCustomer } from '@/types/prospect';
import { sectorByCode, sectorLabel } from './ateco';

export interface CustomerEstimate {
  value: IdealCustomer | null;
  confidence: ConfidenceLevel;
  signals: string[];
  note: string;
}

export function estimateIdealCustomer(
  sectorCode: string,
  declaredClients: string[]
): CustomerEstimate {
  if (!sectorCode) {
    return { value: null, confidence: 'low', signals: [],
      note: 'Senza un settore stimato non si può dire a chi vendono.' };
  }

  const def = sectorByCode(sectorCode);
  if (!def) {
    return { value: null, confidence: 'low', signals: [],
      note: 'Settore non riconosciuto fra quelli in elenco.' };
  }

  if (def.orizzontale) {
    return { value: null, confidence: 'low', signals: [`Settore ${def.code} — ${def.label}.`],
      note: `${def.label} vende a qualunque settore: il cliente-tipo non si deduce dal settore. ${
        declaredClients.length > 0
          ? `Guarda i ${declaredClients.length} clienti che dichiara: quelli sono nomi veri.`
          : 'Servirebbe la sua pagina clienti, che il sito non pubblica.'
      }` };
  }

  const settori = (def.serveA || []).map(sectorLabel).filter(Boolean);
  if (settori.length === 0) {
    return { value: null, confidence: 'low', signals: [`Settore ${def.code} — ${def.label}.`],
      note: `Per ${def.label} il cliente non è un'altra azienda: è il consumatore finale o un committente pubblico.` };
  }

  const signals = [
    `Settore stimato: ${def.code} — ${def.label}.`,
    `Chi compra, in generale, da un'azienda di questo settore: ${settori.join(', ')}.`,
  ];
  if (declaredClients.length > 0) {
    signals.push(`Attenzione: l'azienda dichiara ${declaredClients.length} clienti con nome e cognome. Quelli sono fatti, questa è una generalizzazione.`);
  }

  const value: IdealCustomer = {
    sectors: settori,
    // La dimensione non si ricava dal sito, e dedurla da quanto è curato
    // sarebbe un'invenzione con l'aria di un'analisi. Serve una visura.
    sizeRanges: [],
    // Nemmeno l'area: che un'azienda venda vicino a casa è un luogo comune,
    // non un dato, e messo qui sembrerebbe verificato.
    areas: [],
    rationale: `Stima generica di settore: ${def.label} vende tipicamente a ${settori.join(', ')}. ` +
      'Non è dedotta dai clienti veri di questa azienda. Dimensione e area non si ricavano dal sito.',
  };

  // Mai «alta»: è una generalizzazione su una stima. Due incertezze in fila
  // non fanno una certezza.
  const confidence: ConfidenceLevel = declaredClients.length > 0 ? 'low' : 'medium';

  return { value, confidence, signals, note: '' };
}
