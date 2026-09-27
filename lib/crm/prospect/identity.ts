/**
 * Dall'input alla scheda: l'identità.
 *
 * È il primo percorso completo della sezione, e l'unico che oggi produce una
 * scheda vera. Non costa niente: VIES è gratuito.
 *
 * Quello che succede, nell'ordine, e perché in quest'ordine:
 *
 * 1. si registra la **ricerca**, prima di fare qualunque cosa — così anche un
 *    tentativo fallito lascia traccia di cosa è stato cercato e da chi;
 * 2. si interroga VIES **dalla route server** (dal browser la chiamata non
 *    parte: VIES non manda gli header CORS);
 * 3. si registra la **provenienza**, anche quando la risposta è un errore:
 *    «il servizio era giù» è un'informazione che serve a chi riaprirà la
 *    scheda domani;
 * 4. solo alla fine si scrive la **scheda**.
 *
 * L'ordine inverso — scrivere la scheda e poi annotare da dove viene — lascia
 * dati senza provenienza ogni volta che qualcosa si interrompe a metà.
 */

import { auth } from '@/lib/firebase';
import { CrmContextRef } from '../base';
import { CompanyIdentity } from '@/types/prospect';
import { IdentityResult } from './providers/types';
import { evidenced, missing, lookupKeyFor, nowIso } from './base';
import { recognize } from './recognize';
import { createSearch, setSearchState, attachProfile } from './searches';
import { recordSource } from './sources';
import { createProfile, findProfileByKey, updateProfileArea } from './profiles';

const ENDPOINT = '/api/crm/prospect/identity';

export interface IdentityLookup {
  ok: boolean;
  /** Id della scheda creata o aggiornata. Vuoto quando non se n'è fatta una. */
  profileId: string;
  searchId: string;
  /** Messaggio da mostrare: il motivo del fallimento, o cosa è stato trovato. */
  message: string;
  /** Avvisi sul risultato: troncamenti, campi non pubblicati, formati strani. */
  warnings: string[];
}

/**
 * Chiama la route. Esportata perché la usa anche la lettura del sito: da lì la
 * partita IVA si trova nel footer, e va confermata dalla stessa fonte e nello
 * stesso modo — una seconda copia di questa funzione vorrebbe dire due
 * comportamenti che col tempo divergono.
 */
export async function interrogaVies(vatNumber: string): Promise<
  { ok: true; result: IdentityResult } | { ok: false; message: string; code: string }
> {
  let token = '';
  try {
    token = (await auth.currentUser?.getIdToken()) || '';
  } catch (error) {
    console.error('Impossibile ottenere il token:', error);
  }
  if (!token) {
    return { ok: false, message: 'Sessione scaduta: rientra e riprova.', code: 'NO_TOKEN' };
  }

  try {
    const risposta = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ vatNumber }),
    });
    const dati = await risposta.json().catch(() => ({}));

    if (!risposta.ok) {
      return { ok: false, message: dati?.error || 'Verifica non riuscita.', code: dati?.code || 'HTTP_ERROR' };
    }
    return { ok: true, result: dati.result as IdentityResult };
  } catch (error) {
    console.error('Chiamata alla verifica identità fallita:', error);
    return { ok: false, message: 'Non è stato possibile contattare il server.', code: 'NETWORK' };
  }
}

/**
 * Traduce il risultato nei campi della scheda, ognuno con la sua fonte.
 *
 * La partita IVA arriva come parametro e non dal risultato: è quella che
 * **abbiamo chiesto noi**, e VIES la conferma senza restituirla. Ricavarla
 * dalla risposta significherebbe fidarsi di un campo che non c'è.
 */
export function buildIdentityArea(
  result: IdentityResult,
  sourceId: string,
  vatNumber: string
): CompanyIdentity {
  const quando = result.checkedAt || nowIso();
  const da = (valore: string | null, nota = ''): any =>
    valore === null || valore === '' ? missing(nota || 'Non pubblicato da VIES.', 'certain')
                                     : evidenced(valore, 'vies', sourceId, quando);

  return {
    legalName: da(result.legalName, 'VIES non pubblica il titolare di questa partita IVA.'),
    vatNumber: evidenced(vatNumber, 'vies', sourceId, quando),
    taxCode: missing('VIES non restituisce il codice fiscale.', 'certain'),
    address: da(result.address),
    city: da(result.city, 'Indirizzo in un formato non riconosciuto.'),
    province: da(result.province, 'Indirizzo in un formato non riconosciuto.'),
    country: da(result.country),
    // `exists: null` vuol dire «non verificata», non «non valida». Diventa un
    // campo mancante con il motivo scritto: lasciarlo passare come `false`
    // metterebbe sulla scheda un «non risulta» che nessuno ha accertato.
    vatValid: result.exists === null
      ? missing<boolean>('VIES non ha risposto: la partita IVA non è stata verificata.', 'certain')
      : evidenced<boolean>(result.exists, 'vies', sourceId, quando),
  };
}

/**
 * Cerca per partita IVA e produce la scheda.
 *
 * Le due risposte che non vanno confuse: **la partita IVA non risulta** è un
 * fatto accertato e va scritto sulla scheda; **VIES non ha risposto** non è un
 * fatto, e non deve lasciare sulla scheda un «non risulta» che qualcuno
 * leggerà come una verifica fatta.
 */
export async function lookupByVat(ctx: CrmContextRef, input: string): Promise<IdentityLookup> {
  const riconosciuto = recognize(input);

  if (riconosciuto.kind !== 'vat') {
    return { ok: false, profileId: '', searchId: '', warnings: [],
      message: 'Questa ricerca accetta una partita IVA. Le altre arrivano nelle fasi successive.' };
  }
  if (!riconosciuto.valid) {
    return { ok: false, profileId: '', searchId: '', warnings: [], message: riconosciuto.message };
  }

  const partitaIva = riconosciuto.normalized;
  const searchId = await createSearch(ctx, input, 'vat');
  if (!searchId) {
    return { ok: false, profileId: '', searchId: '', warnings: [],
      message: 'Non è stato possibile registrare la ricerca.' };
  }
  await setSearchState(ctx, searchId, 'RUNNING');

  const esito = await interrogaVies(partitaIva);

  if (!esito.ok) {
    // La fonte si registra lo stesso: il tentativo è avvenuto, e sapere che
    // VIES era giù spiega perché la scheda è ferma a ieri.
    await recordSource(ctx, {
      profileId: '', searchId, kind: 'vies',
      url: 'https://ec.europa.eu/taxation_customs/vies',
      fields: [], error: esito.message,
    });
    await setSearchState(ctx, searchId, 'FAILED', esito.message);
    return { ok: false, profileId: '', searchId, warnings: [], message: esito.message };
  }

  const risultato = esito.result;
  const sourceId = await recordSource(ctx, {
    profileId: '', searchId, kind: 'vies',
    url: 'https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number',
    fields: ['identity.legalName', 'identity.address', 'identity.city', 'identity.province', 'identity.vatValid'],
    // Una ragione sociale può essere un nome di persona, per le ditte
    // individuali: si dichiara, invece di stabilire che un'azienda non è mai
    // una persona.
    personalData: false,
    snippet: JSON.stringify({ name: risultato.legalName, address: risultato.address }),
  });

  const lookupKey = lookupKeyFor(partitaIva, '');
  const esistente = await findProfileByKey(ctx.projectId, lookupKey);
  const nome = risultato.legalName || `Partita IVA ${partitaIva}`;

  const profileId = esistente
    ? esistente.id
    : await createProfile(ctx, { vatNumber: partitaIva, displayName: nome, searchId });

  if (!profileId) {
    await setSearchState(ctx, searchId, 'FAILED', 'Scheda non salvata.');
    return { ok: false, profileId: '', searchId, warnings: risultato.warnings,
      message: 'La verifica è riuscita ma la scheda non è stata salvata.' };
  }

  const identita = buildIdentityArea(risultato, sourceId || '', partitaIva);

  const lacune = risultato.exists === false
    ? ['Questa partita IVA non risulta presso VIES: verifica il numero prima di usarlo.']
    : risultato.warnings;

  await updateProfileArea(ctx, profileId, 'identity', identita, lacune);
  await attachProfile(ctx, searchId, profileId);

  // Una partita IVA che non risulta è una ricerca **completata**: la risposta
  // c'è ed è negativa. Parziale è un'altra cosa — quando qualcosa non si è
  // riusciti a leggere.
  const stato = risultato.warnings.length > 0 ? 'PARTIAL' : 'DONE';
  await setSearchState(ctx, searchId, stato,
    risultato.exists === false ? 'Partita IVA non presente in VIES.' : risultato.warnings.join(' '));

  return {
    ok: true,
    profileId,
    searchId,
    warnings: risultato.warnings,
    message: risultato.exists === false
      ? 'La partita IVA non risulta presso VIES.'
      : `Identità confermata: ${nome}.`,
  };
}
