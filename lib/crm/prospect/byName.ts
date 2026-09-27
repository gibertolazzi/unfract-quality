/**
 * Cercare un'azienda per nome, senza motore di ricerca.
 *
 * È il terzo percorso della sezione, ed è quello **volutamente incompleto**.
 * Il perché sta in `providers/search.ts`: un nome non è una chiave, e per
 * trasformarlo in un'azienda serve un indice che nessuno regala. La decisione
 * presa il 17 settembre 2026 è di non pagarlo e di non aggirarlo indovinando.
 *
 * Quello che resta si può fare gratis, ed è tutt'altro che inutile: si guarda
 * **in casa**. Schede già raccolte, aziende del CRM, lead. Il piano lo chiede
 * al §3 per un motivo pratico — non ricercare da zero un'azienda che è già in
 * casa è il modo di evitare che due commerciali arrivino sullo stesso cliente.
 *
 * E quando in casa non c'è niente, la ricerca lo dice insieme a cosa fare:
 * scrivere la partita IVA o l'indirizzo del sito, che sono gratuiti e portano
 * a una scheda vera.
 */

import { CrmContextRef } from '../base';
import { SearchCandidate } from '@/types/prospect';
import { buildCandidates, NameSource } from './names';
import { webSearchProvider } from './providers/search';
import { recognize } from './recognize';
import { createSearch, setSearchState, setCandidates } from './searches';
import { getProfiles } from './profiles';
import { getAccounts } from '../accounts';
import { getLeads } from '../leads';

export interface NameLookup {
  ok: boolean;
  searchId: string;
  candidates: SearchCandidate[];
  message: string;
  /** Vero quando la ricerca sul web non è stata fatta perché non è attiva. */
  webSkipped: boolean;
}

/**
 * Tutto quello che in casa ha un nome d'azienda.
 *
 * Gli archiviati **si guardano**: un cliente archiviato l'anno scorso resta un
 * cliente che qualcuno ha già lavorato, e riproporlo come azienda nuova è
 * esattamente l'errore che questa ricerca deve evitare.
 */
export async function fontiInterne(projectId: string): Promise<NameSource[]> {
  const fonti: NameSource[] = [];

  try {
    for (const scheda of await getProfiles(projectId)) {
      fonti.push({
        name: scheda.displayName,
        altName: (scheda.identity?.legalName?.value as string) || '',
        website: (scheda.declared?.website?.value as string) || '',
        vatNumber: (scheda.identity?.vatNumber?.value as string) || '',
        source: 'profile',
        refId: scheda.id,
      });
    }
  } catch (error) {
    console.error('Schede non lette:', error);
  }

  try {
    for (const azienda of await getAccounts(projectId, true)) {
      fonti.push({
        name: azienda.displayName || azienda.legalName,
        altName: azienda.legalName,
        website: azienda.website || azienda.domain,
        vatNumber: azienda.vatNumber,
        source: 'account',
        refId: azienda.id,
      });
    }
  } catch (error) {
    console.error('Aziende non lette:', error);
  }

  try {
    for (const lead of await getLeads(projectId, true)) {
      if (!lead.companyName) continue;
      fonti.push({
        name: lead.companyName,
        website: lead.companyDomain,
        source: 'lead',
        refId: lead.id,
      });
    }
  } catch (error) {
    console.error('Lead non letti:', error);
  }

  return fonti;
}

export async function lookupByName(ctx: CrmContextRef, input: string): Promise<NameLookup> {
  const riconosciuto = recognize(input);
  if (riconosciuto.kind !== 'name') {
    return { ok: false, searchId: '', candidates: [], webSkipped: false,
      message: 'Questa ricerca accetta un nome o una ragione sociale.' };
  }

  const nome = riconosciuto.normalized;
  const searchId = await createSearch(ctx, input, 'name');
  if (!searchId) {
    return { ok: false, searchId: '', candidates: [], webSkipped: false,
      message: 'Non è stato possibile registrare la ricerca.' };
  }
  await setSearchState(ctx, searchId, 'RUNNING');

  const candidati = buildCandidates(nome, await fontiInterne(ctx.projectId));
  if (candidati.length > 0) await setCandidates(ctx, searchId, candidati);

  // Il motore si interroga **attraverso il contratto**, anche adesso che
  // risponde «non sono configurato». Così il giorno che se ne collega uno vero
  // non c'è niente da riscrivere qui, e nel frattempo il messaggio che l'utente
  // legge viene dal provider e non da una frase inventata in questo punto.
  const web = await webSearchProvider.search(nome);
  const webSkipped = !web.ok && web.failure.code === 'NOT_CONFIGURED';
  const limite = !web.ok ? web.failure.message : '';

  const messaggio = candidati.length > 0
    ? `${candidati.length} ${candidati.length === 1 ? 'azienda già in archivio somiglia' : 'aziende già in archivio somigliano'} a «${nome}». ${limite}`
    : `«${nome}» non risulta fra le aziende già in archivio. ${limite}`;

  // Mai `DONE`: sul web non si è guardato. Dichiararla completata vorrebbe
  // dire far credere che quell'azienda non esista, quando non l'abbiamo
  // cercata dove si sarebbe trovata.
  await setSearchState(ctx, searchId, 'PARTIAL', messaggio);

  return { ok: true, searchId, candidates: candidati, webSkipped, message: messaggio };
}
