/**
 * Da una scheda alle sue stime.
 *
 * Una funzione sola e pura: riceve quello che c'è sulla scheda, restituisce
 * l'area «stimato» per intero. Nessuna stima viene prodotta altrove, ed è
 * voluto — sparse in tre punti, le regole su quando rinunciare diventerebbero
 * tre regole diverse, e la scheda mostrerebbe a volte un vuoto spiegato e a
 * volte un valore messo lì per non lasciare il riquadro vuoto.
 *
 * Tutto quello che esce di qui porta `evidence: 'estimated'` e i segnali che
 * l'hanno prodotto. Non c'è modo che una funzione di questo file produca un
 * dato certo: il tipo `Estimated<T>` obbliga a passare i segnali.
 */

import { CompanyEstimated, CompanyDeclared, CompanyIdentity, CompetitorGuess, IdealCustomer } from '@/types/prospect';
import { estimated } from '../base';
import { estimateSector, describeSector, SectorGuess } from './sector';
import { sectorLabel } from './ateco';
import { estimateCompetitors, CompetitorInput } from './competitors';
import { estimateIdealCustomer } from './customers';

export interface EstimateInput {
  refId: string;
  identity: CompanyIdentity;
  declared: CompanyDeclared;
  /** Le altre schede in archivio, per i competitor. */
  others: CompetitorInput[];
  sourceId: string;
  at: string;
  /**
   * La divisione ATECO corretta a mano, se qualcuno l'ha corretta. Vince sulla
   * stima, e **tutto quello che dipende dal settore riparte da qui**: sono i
   * competitor e il cliente-tipo a rendere utile la correzione, non la riga
   * del settore in sé.
   */
  sectorOverride?: string;
}

/** Il testo su cui si stima il settore: tutto ciò che l'azienda dice di sé. */
export function testoPerSettore(declared: CompanyDeclared): string[] {
  const descrizione = (declared.description?.value as string) || '';
  // Il pezzo che pesa di più: la meta description è una riga scritta per i
  // motori di ricerca, la pagina «chi siamo» è dove l'azienda dice cosa fa.
  const racconto = (declared.aboutText?.value as string) || '';
  const soluzioni = (declared.solutions?.value as string[]) || [];
  const settori = (declared.targetSectors?.value as string[]) || [];
  return [descrizione, racconto, ...soluzioni, ...settori];
}

export function buildEstimatedArea(input: EstimateInput): CompanyEstimated {
  const { identity, declared, others, sourceId, at } = input;

  // ------------------------------------------------------------- settore
  const stimato = estimateSector(testoPerSettore(declared));

  const corretto = String(input.sectorOverride || '').trim();
  const etichettaCorretta = corretto ? sectorLabel(corretto) : '';

  // Una correzione a mano non diventa una stima migliore: resta una cosa
  // diversa, e i segnali lo dicono. Ma da qui in poi vale quella.
  const settore: SectorGuess = corretto && etichettaCorretta
    ? {
        code: corretto,
        label: etichettaCorretta,
        confidence: 'high',
        signals: [`Corretto a mano: la stima diceva ${stimato.label || 'niente'}.`],
        runnerUp: '',
        note: '',
      }
    : stimato;

  const sector = settore.code
    ? estimated<string>(settore.label, settore.confidence, settore.signals, sourceId, at,
        corretto ? 'Scelto a mano: non è una stima nostra né un dato camerale.' : describeSector(settore))
    : estimated<string>(null, 'low', settore.signals, sourceId, at, settore.note);

  const atecoCode = settore.code
    ? estimated<string>(settore.code, settore.confidence, settore.signals, sourceId, at,
        'Divisione a due cifre. Il codice completo lo assegna la Camera di commercio e si legge in una visura.')
    : estimated<string>(null, 'low', [], sourceId, at,
        'Serve prima un settore stimato; il codice completo richiede comunque una visura.');

  // ---------------------------------------------------------- dimensione
  // Non si stima. Dedurla da quanto è curato il sito sarebbe un'invenzione
  // con l'aria di un'analisi, e chi legge non avrebbe modo di accorgersene.
  const sizeRange = estimated<string>(null, 'low', [], sourceId, at,
    'La dimensione non si ricava dal sito: serve una visura camerale o un bilancio depositato.');

  // ---------------------------------------------------------- competitor
  const io: CompetitorInput = {
    refId: input.refId,
    name: (identity.legalName?.value as string) || '',
    website: (declared.website?.value as string) || '',
    sectorCode: settore.code,
    province: (identity.province?.value as string) || '',
    region: '',
  };
  const concorrenti = estimateCompetitors(io, others);

  const competitors = concorrenti.competitors.length > 0
    ? estimated<CompetitorGuess[]>(concorrenti.competitors, concorrenti.confidence, concorrenti.signals,
        sourceId, at, concorrenti.note)
    : estimated<CompetitorGuess[]>(null, 'low', concorrenti.signals, sourceId, at, concorrenti.note);

  // -------------------------------------------------------- cliente-tipo
  const clienti = estimateIdealCustomer(settore.code, (declared.declaredClients?.value as string[]) || []);

  const idealCustomer = clienti.value
    ? estimated<IdealCustomer>(clienti.value, clienti.confidence, clienti.signals, sourceId, at, clienti.note)
    : estimated<IdealCustomer>(null, 'low', clienti.signals, sourceId, at, clienti.note);

  return { sector, atecoCode, sizeRange, competitors, idealCustomer };
}
