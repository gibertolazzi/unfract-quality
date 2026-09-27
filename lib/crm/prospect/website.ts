/**
 * Dall'indirizzo di un sito alla scheda.
 *
 * È il secondo percorso completo della sezione, e il primo che produce una
 * scheda **piena**: identità confermata più tutto quello che l'azienda
 * dichiara di sé. Non costa niente — né la lettura del sito né VIES.
 *
 * La catena, che è quella misurata nel piano (§2: sei partite IVA su dieci
 * trovate in homepage, sei su sei confermate da VIES):
 *
 *   dominio → lettura del sito → partita IVA dal footer → VIES conferma
 *
 * L'ordine delle scritture è lo stesso della ricerca per partita IVA, e per lo
 * stesso motivo: **prima la provenienza, poi il dato**. Al contrario, ogni
 * interruzione a metà lascerebbe sulla scheda campi che nessuno sa più da dove
 * vengono.
 *
 * Una cosa che questa funzione **non** fa: scegliere fra due partite IVA. Nei
 * gruppi societari il sito ne espone più d'una, e prendere la prima
 * significherebbe attribuire la scheda alla capogruppo o alla controllata a
 * caso. In quel caso la scheda resta senza identità confermata e lo dice.
 */

import { auth } from '@/lib/firebase';
import { CrmContextRef } from '../base';
import { SiteReadResult } from './providers/types';
import { lookupKeyFor, normalizeDomain } from './base';
import { recognize } from './recognize';
import { createSearch, setSearchState, attachProfile } from './searches';
import { recordSource } from './sources';
import {
  createProfile, findProfileByKey, updateProfileArea, promoteLookupKey,
} from './profiles';
import { buildDeclaredArea, gapsFromSite } from './site/declared';
import { interrogaVies, buildIdentityArea } from './identity';

const ENDPOINT = '/api/crm/prospect/site';

export interface WebsiteLookup {
  ok: boolean;
  profileId: string;
  searchId: string;
  message: string;
  warnings: string[];
  /** Vero se la partita IVA trovata sul sito è stata confermata da VIES. */
  identityConfirmed: boolean;
}

type EsitoSito =
  | { ok: true; result: SiteReadResult }
  | { ok: false; message: string; code: string; risposta: boolean };

/**
 * Chiama la route che legge il sito.
 *
 * «Il sito ci ha bloccati» torna come **risposta**, non come errore: è un
 * fatto sull'azienda, e come tale va scritto sulla scheda invece di comparire
 * come un guasto dello strumento.
 */
async function leggiSito(domain: string): Promise<EsitoSito> {
  let token = '';
  try {
    token = (await auth.currentUser?.getIdToken()) || '';
  } catch (error) {
    console.error('Impossibile ottenere il token:', error);
  }
  if (!token) {
    return { ok: false, message: 'Sessione scaduta: rientra e riprova.', code: 'NO_TOKEN', risposta: false };
  }

  try {
    const risposta = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ domain }),
    });
    const dati = await risposta.json().catch(() => ({}));

    if (!risposta.ok) {
      return { ok: false, message: dati?.error || 'Lettura non riuscita.', code: dati?.code || 'HTTP_ERROR', risposta: false };
    }
    if (dati?.ok === false) {
      return { ok: false, message: dati?.error || 'Il sito non si è lasciato leggere.', code: dati?.code || 'BLOCKED', risposta: true };
    }
    return { ok: true, result: dati.result as SiteReadResult };
  } catch (error) {
    console.error('Chiamata alla lettura del sito fallita:', error);
    return { ok: false, message: 'Non è stato possibile contattare il server.', code: 'NETWORK', risposta: false };
  }
}

/**
 * La partita IVA da confermare, quando ce n'è **una sola**.
 *
 * Con zero non c'è niente da confermare; con più d'una la scelta è di una
 * persona, e questo è il punto in cui uno strumento del genere di solito
 * sbaglia in silenzio.
 */
export function vatDaConfermare(result: SiteReadResult): string {
  return result.vatNumbers.length === 1 ? result.vatNumbers[0].value : '';
}

export async function lookupByDomain(ctx: CrmContextRef, input: string): Promise<WebsiteLookup> {
  const riconosciuto = recognize(input);
  const vuoto = { profileId: '', searchId: '', warnings: [] as string[], identityConfirmed: false };

  if (riconosciuto.kind !== 'domain') {
    return { ok: false, ...vuoto,
      message: 'Questa ricerca accetta un indirizzo di sito, per esempio «illy.com».' };
  }

  const dominio = normalizeDomain(riconosciuto.normalized);
  const searchId = await createSearch(ctx, input, 'domain');
  if (!searchId) {
    return { ok: false, ...vuoto, message: 'Non è stato possibile registrare la ricerca.' };
  }
  await setSearchState(ctx, searchId, 'RUNNING');

  const esito = await leggiSito(dominio);

  if (!esito.ok) {
    await recordSource(ctx, {
      profileId: '', searchId, kind: 'website',
      url: `https://${dominio}/`, fields: [], error: esito.message,
    });
    // Un rifiuto del sito è una ricerca **completata in parte**: si è arrivati
    // in fondo e la risposta è stata «no». Un guasto di rete no: quello è un
    // tentativo che non ha prodotto niente.
    await setSearchState(ctx, searchId, esito.risposta ? 'PARTIAL' : 'FAILED', esito.message);
    return { ok: esito.risposta, ...vuoto, searchId, message: esito.message,
      warnings: esito.risposta ? [esito.message] : [] };
  }

  const sito = esito.result;

  const sourceId = await recordSource(ctx, {
    profileId: '', searchId, kind: 'website',
    url: sito.finalUrl || `https://${dominio}/`,
    fields: [
      'declared.website', 'declared.description', 'declared.solutions',
      'declared.publicContacts', 'declared.socialLinks', 'declared.techStack',
      'declared.declaredClients', 'declared.declaredPartners',
    ],
    // I recapiti raccolti sono caselle aziendali per costruzione: le caselle
    // riferibili a persone vengono scartate in lettura (site/extract.ts), non
    // filtrate qui. Se un giorno quella regola cambia, va cambiato anche
    // questo `false`, e per questo è scritto con il suo motivo accanto.
    personalData: false,
    snippet: JSON.stringify({
      pages: sito.pages.map(p => p.url),
      vat: sito.vatNumbers.map(v => v.value),
      tech: sito.techStack.map(t => t.name),
    }),
  });

  // ------------------------------------------------- l'identità, se si può
  const partitaIva = vatDaConfermare(sito);
  let identita = null as ReturnType<typeof buildIdentityArea> | null;
  const avvisi = [...sito.warnings];

  if (partitaIva) {
    const vies = await interrogaVies(partitaIva);
    if (vies.ok) {
      const sorgenteVies = await recordSource(ctx, {
        profileId: '', searchId, kind: 'vies',
        url: 'https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number',
        fields: ['identity.legalName', 'identity.address', 'identity.city', 'identity.province', 'identity.vatValid'],
        personalData: false,
        snippet: JSON.stringify({ name: vies.result.legalName, address: vies.result.address }),
      });
      identita = buildIdentityArea(vies.result, sorgenteVies || '', partitaIva);
      avvisi.push(...vies.result.warnings);
      if (vies.result.exists === false) {
        avvisi.push('La partita IVA pubblicata sul sito non risulta presso VIES: va verificata prima di usarla.');
      }
    } else {
      await recordSource(ctx, {
        profileId: '', searchId, kind: 'vies',
        url: 'https://ec.europa.eu/taxation_customs/vies',
        fields: [], error: vies.message,
      });
      avvisi.push(`Partita IVA trovata sul sito ma non confermata: ${vies.message}`);
    }
  }

  // --------------------------------------------------------- la scheda
  const confermata = Boolean(identita && identita.vatValid.value === true);
  const chiaveIva = confermata ? lookupKeyFor(partitaIva, '') : '';
  const chiaveDominio = lookupKeyFor('', dominio);

  const esistente = (chiaveIva ? await findProfileByKey(ctx.projectId, chiaveIva) : null)
    || await findProfileByKey(ctx.projectId, chiaveDominio);

  const nome = (identita?.legalName.value as string) || sito.siteTitle || dominio;

  const profileId = esistente
    ? esistente.id
    : await createProfile(ctx, {
        vatNumber: confermata ? partitaIva : '',
        domain: dominio,
        displayName: nome,
        searchId,
      });

  if (!profileId) {
    await setSearchState(ctx, searchId, 'FAILED', 'Scheda non salvata.');
    return { ok: false, ...vuoto, searchId, warnings: avvisi,
      message: 'Il sito è stato letto ma la scheda non è stata salvata.' };
  }

  if (esistente && chiaveIva && esistente.lookupKey !== chiaveIva) {
    await promoteLookupKey(ctx, profileId, chiaveIva);
  }

  await updateProfileArea(ctx, profileId, 'declared', buildDeclaredArea(sito, sourceId || ''), gapsFromSite(sito));
  if (identita) await updateProfileArea(ctx, profileId, 'identity', identita, avvisi.slice(0, 10));
  await attachProfile(ctx, searchId, profileId);

  const parziale = avvisi.length > 0 || sito.pages.some(p => p.skipped);
  await setSearchState(ctx, searchId, parziale ? 'PARTIAL' : 'DONE', avvisi.join(' '));

  return {
    ok: true,
    profileId,
    searchId,
    warnings: avvisi,
    identityConfirmed: confermata,
    message: confermata
      ? `Sito letto e identità confermata: ${nome}.`
      : partitaIva
        ? 'Sito letto. La partita IVA trovata non è stata confermata: la scheda resta senza identità certa.'
        : 'Sito letto. Nessuna partita IVA nelle pagine lette: l’identità va confermata a mano.',
  };
}
