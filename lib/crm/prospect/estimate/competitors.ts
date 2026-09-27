/**
 * I competitor: una stima, sempre, e con un limite dichiarato.
 *
 * Nessun registro pubblica i concorrenti di un'azienda. Il piano prevedeva due
 * segnali (§4): **stesso settore e stessa area**, e **stesse ricerche sul web**.
 * Il secondo richiede un motore di ricerca, che alla fase 5 si è deciso di non
 * prendere. Resta il primo.
 *
 * E resta con un confine che va detto a chi legge, perché è grosso: si cerca
 * **fra le aziende che abbiamo già in archivio**. Non è «i competitor di questa
 * azienda»; è «chi, fra quelli che conosciamo, le somiglia». Se in archivio ci
 * sono otto aziende, escono al massimo otto nomi, e il fatto che ne escano due
 * non significa che il mercato ne abbia due.
 *
 * Scritto così invece che nascosto, perché un elenco di competitor presentato
 * come completo quando non lo è fa preparare una telefonata su un'idea
 * sbagliata del mercato.
 */

import { ConfidenceLevel } from '@/components/crm/ricerca/constants';
import { CompetitorGuess } from '@/types/prospect';

/** Il minimo che serve di un'azienda per dire se somiglia a un'altra. */
export interface CompetitorInput {
  refId: string;
  name: string;
  website: string;
  /** Divisione ATECO stimata. Senza, non entra nel confronto. */
  sectorCode: string;
  province: string;
  region: string;
}

export interface CompetitorEstimate {
  competitors: CompetitorGuess[];
  signals: string[];
  confidence: ConfidenceLevel;
  note: string;
  /** Quante schede sono state guardate: è il numero che dà la misura del limite. */
  consideredCount: number;
}

/**
 * Chi somiglia, fra quelli che abbiamo.
 *
 * Stesso settore **e** stessa provincia viene prima di stesso settore e basta:
 * nel B2B italiano due aziende dello stesso settore a cinquanta chilometri si
 * incontrano davvero sulle stesse gare, due all'altro capo del paese spesso no.
 */
export function estimateCompetitors(
  self: CompetitorInput,
  altre: CompetitorInput[],
  massimo = 10
): CompetitorEstimate {
  const considerate = altre.filter(a => a.refId !== self.refId);

  if (!self.sectorCode) {
    return { competitors: [], signals: [], confidence: 'low', consideredCount: considerate.length,
      note: 'Senza un settore stimato non si può dire chi le somiglia: prima va stabilito il settore.' };
  }

  const stessoSettore = considerate.filter(a => a.sectorCode === self.sectorCode);

  const ordinate = stessoSettore
    .map(a => {
      const stessaProvincia = Boolean(self.province && a.province && a.province === self.province);
      const stessaRegione = Boolean(self.region && a.region && a.region === self.region);
      return { a, stessaProvincia, stessaRegione };
    })
    .sort((x, y) =>
      Number(y.stessaProvincia) - Number(x.stessaProvincia) ||
      Number(y.stessaRegione) - Number(x.stessaRegione) ||
      x.a.name.localeCompare(y.a.name))
    .slice(0, massimo);

  const competitors: CompetitorGuess[] = ordinate.map(({ a, stessaProvincia, stessaRegione }) => ({
    name: a.name,
    website: a.website,
    reason: 'same_sector',
    confidence: stessaProvincia ? 'medium' : stessaRegione ? 'low' : 'low',
  }));

  const inProvincia = ordinate.filter(o => o.stessaProvincia).length;

  const signals = [
    `Stessa divisione ATECO (${self.sectorCode}).`,
    inProvincia > 0
      ? `${inProvincia} ${inProvincia === 1 ? 'ha' : 'hanno'} sede nella stessa provincia (${self.province}).`
      : 'Nessuna ha sede nella stessa provincia.',
    `Confrontate ${considerate.length} schede già in archivio: fuori da queste non si è guardato.`,
  ];

  // Mai «alta»: il segnale resta uno solo, e per giunta su un insieme che è
  // il nostro archivio e non il mercato.
  const confidence: ConfidenceLevel = inProvincia > 0 ? 'medium' : 'low';

  return {
    competitors,
    signals,
    confidence,
    consideredCount: considerate.length,
    note: competitors.length === 0
      ? `Nessuna delle ${considerate.length} schede in archivio è dello stesso settore. Non vuol dire che non esistano concorrenti: vuol dire che noi non ne abbiamo.`
      : 'Elenco limitato alle aziende già in archivio: senza un motore di ricerca non si guarda fuori.',
  };
}
