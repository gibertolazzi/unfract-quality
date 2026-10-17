import { lookup as dnsLookup, type LookupAddress } from 'node:dns';
import https from 'node:https';
import { isIP } from 'node:net';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { isPublicIp } from '@/lib/server/publicUrl';
import { CLIENT_METADATA_TTL_MS, fingerprint, randomSecret } from '@/lib/server/mcp/config';

/**
 * Le app che si collegano a Unfract (Claude, ChatGPT, Cursor…): i «client»
 * OAuth. Si riconoscono in due modi (spec MCP 2026-07-28, «Client
 * Registration»):
 *
 * - **Documento di metadati (CIMD)**: il `client_id` è un indirizzo https
 *   dell'app (es. `https://claude.ai/oauth/mcp-client.json`); Unfract lo
 *   scarica e ci trova nome e indirizzi di ritorno. È il metodo consigliato:
 *   il nome mostrato all'utente viene dal dominio dell'app.
 * - **Registrazione dinamica (DCR, RFC 7591)**: l'app si registra da sola e
 *   riceve un `client_id`. È deprecata ma molti client la usano ancora. Il
 *   nome lo dichiara l'app: nella pagina di consenso lo si dice.
 *
 * Tutti i client sono «pubblici» (niente segreto): la sicurezza la danno PKCE
 * e gli indirizzi di ritorno registrati, confrontati alla lettera.
 */

export interface McpClient {
  clientId: string;
  name: string;
  redirectUris: string[];
  /** `metadata`: documento sul dominio dell'app; `registered`: nome dichiarato dall'app. */
  kind: 'metadata' | 'registered';
  /** Dominio del documento di metadati (solo `metadata`). */
  domain?: string;
}

export class ClientError extends Error {
  constructor(readonly code: 'invalid_client' | 'invalid_client_metadata' | 'invalid_redirect_uri', message: string) {
    super(message);
    this.name = 'ClientError';
  }
}

const MAX_REDIRECT_URIS = 10;
const MAX_DOCUMENT_BYTES = 20_000;
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
// Schemi che non possono essere un'app installata.
const FORBIDDEN_SCHEMES = new Set(['javascript:', 'data:', 'file:', 'blob:', 'vbscript:', 'about:', 'ftp:', 'ws:', 'wss:']);

export type RedirectKind = 'https' | 'loopback' | 'native';

/**
 * Che tipo di indirizzo di ritorno è, o `null` se non è ammesso.
 * - https, su qualunque dominio;
 * - http solo su localhost (app sul computer, RFC 8252);
 * - schema privato a dominio rovesciato (`com.example.app:/callback`), per le
 *   app installate.
 */
export function redirectKind(raw: unknown): RedirectKind | null {
  if (typeof raw !== 'string' || raw.length > 2000) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.hash || raw.includes('#') || url.username || url.password) return null;
  if (url.protocol === 'https:') return url.hostname ? 'https' : null;
  if (url.protocol === 'http:') return LOOPBACK_HOSTS.has(url.hostname) ? 'loopback' : null;
  const scheme = url.protocol.slice(0, -1);
  if (FORBIDDEN_SCHEMES.has(url.protocol) || !/^[a-z][a-z0-9+.-]*$/.test(scheme) || !scheme.includes('.')) return null;
  return 'native';
}

/**
 * L'indirizzo di ritorno della richiesta è uno di quelli registrati. Confronto
 * alla lettera; per localhost la porta può cambiare (RFC 8252 §7.3).
 */
export function redirectAllowed(client: McpClient, redirectUri: unknown): boolean {
  if (typeof redirectUri !== 'string' || !redirectKind(redirectUri)) return false;
  if (client.redirectUris.includes(redirectUri)) return true;
  if (redirectKind(redirectUri) !== 'loopback') return false;
  const asked = new URL(redirectUri);
  return client.redirectUris.some(registered => {
    if (redirectKind(registered) !== 'loopback') return false;
    const r = new URL(registered);
    return r.hostname === asked.hostname && r.pathname === asked.pathname && r.search === asked.search;
  });
}

function cleanName(raw: unknown, fallback: string): string {
  const name = typeof raw === 'string' ? raw.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 80) : '';
  return name || fallback;
}

function validRedirectList(raw: unknown): string[] {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_REDIRECT_URIS) {
    throw new ClientError('invalid_redirect_uri', `Servono da 1 a ${MAX_REDIRECT_URIS} redirect_uris.`);
  }
  for (const uri of raw) {
    if (!redirectKind(uri)) throw new ClientError('invalid_redirect_uri', `redirect_uri non ammesso: ${String(uri).slice(0, 200)}`);
  }
  return Array.from(new Set(raw as string[]));
}

/** Metadati comuni a DCR e CIMD: solo codice + PKCE, client pubblici. */
function checkGrantMetadata(meta: Record<string, unknown>) {
  const grantTypes = meta.grant_types ?? ['authorization_code'];
  if (!Array.isArray(grantTypes) || !grantTypes.includes('authorization_code')
    || grantTypes.some(g => g !== 'authorization_code' && g !== 'refresh_token')) {
    throw new ClientError('invalid_client_metadata', 'grant_types ammessi: authorization_code, refresh_token.');
  }
  const responseTypes = meta.response_types ?? ['code'];
  if (!Array.isArray(responseTypes) || responseTypes.some(r => r !== 'code')) {
    throw new ClientError('invalid_client_metadata', 'response_types ammesso: code.');
  }
}

// ------------------------------------------------------------ Registrazione dinamica

/**
 * Registra un client (RFC 7591). Si accettano solo client pubblici
 * (`token_endpoint_auth_method: none`): se l'app chiede altro, la risposta
 * dice quello che vale davvero, come permette la RFC.
 */
export async function registerClient(meta: Record<string, unknown>) {
  const redirectUris = validRedirectList(meta.redirect_uris);
  checkGrantMetadata(meta);
  const clientId = randomSecret('unf_client_', 18);
  const name = cleanName(meta.client_name, 'App senza nome');
  const now = Date.now();
  await adminDb.collection('mcp_clients').doc(fingerprint(clientId)).set({
    kind: 'registered',
    clientId,
    name,
    redirectUris,
    applicationType: meta.application_type === 'native' ? 'native' : 'web',
    createdAt: FieldValue.serverTimestamp(),
    // Un client registrato e mai usato si può togliere con una policy TTL.
    expiresAt: Timestamp.fromMillis(now + 90 * 24 * 60 * 60 * 1000),
  });
  return {
    client_id: clientId,
    client_id_issued_at: Math.floor(now / 1000),
    client_name: name,
    redirect_uris: redirectUris,
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
  };
}

// ------------------------------------------------------------ Documento di metadati (CIMD)

/** Un `client_id` che è un indirizzo: https, con un percorso, senza porta né IP. */
export function isMetadataClientId(clientId: string): boolean {
  try {
    const url = new URL(clientId);
    return url.protocol === 'https:' && url.pathname.length > 1 && !url.hash && !url.username && !url.password
      && !url.search && (!url.port || url.port === '443') && !isIP(url.hostname.replace(/^\[|\]$/g, '')) && url.hostname.includes('.');
  } catch {
    return false;
  }
}

export type DocumentFetcher = (url: string) => Promise<unknown>;

/**
 * Scarica il documento di un client senza aprire una porta sulla rete
 * interna (SSRF): la connessione va solo a indirizzi pubblici, controllati
 * sullo stesso risultato DNS usato per connettersi (niente DNS rebinding),
 * niente redirect, al massimo 20 kB e 5 secondi.
 */
export const fetchClientDocument: DocumentFetcher = url => new Promise((resolve, reject) => {
  const lookup = (hostname: string, options: any, callback: any) => {
    dnsLookup(hostname, { all: true, verbatim: true }, (error, addresses: LookupAddress[]) => {
      if (error) return callback(error);
      if (!addresses.length || addresses.some(a => !isPublicIp(a.address))) {
        return callback(new Error(`${hostname} punta a un indirizzo non pubblico.`));
      }
      if (options?.all) return callback(null, addresses);
      return callback(null, addresses[0].address, addresses[0].family);
    });
  };
  const request = https.get(url, { lookup, timeout: 5000, headers: { accept: 'application/json' } }, response => {
    if (response.statusCode !== 200) {
      response.resume();
      return reject(new Error(`Documento del client: HTTP ${response.statusCode}`));
    }
    let size = 0;
    const chunks: Buffer[] = [];
    response.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_DOCUMENT_BYTES) {
        request.destroy(new Error('Documento del client troppo grande.'));
        return;
      }
      chunks.push(chunk);
    });
    response.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('Il documento del client non è JSON.'));
      }
    });
    response.on('error', reject);
  });
  request.on('timeout', () => request.destroy(new Error('Documento del client: tempo scaduto.')));
  request.on('error', reject);
});

/**
 * Il client sa usare il metodo pubblico (`none`), il solo che accettiamo.
 * Un documento può preferire un altro metodo (`token_endpoint_auth_method`)
 * ed elencare in `token_endpoint_auth_methods_supported` anche `none`: è il
 * caso di ChatGPT, che preferisce `private_key_jwt` e sceglie fra i metodi
 * in comune con il nostro server, che dichiara solo `none`.
 */
function supportsPublicAuth(meta: Record<string, unknown>): boolean {
  const preferred = meta.token_endpoint_auth_method ?? 'none';
  if (preferred === 'none') return true;
  const supported = meta.token_endpoint_auth_methods_supported;
  return Array.isArray(supported) && supported.includes('none');
}

function clientFromDocument(clientId: string, doc: unknown): McpClient {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) throw new ClientError('invalid_client', 'Documento del client non valido.');
  const meta = doc as Record<string, unknown>;
  if (meta.client_id !== clientId) throw new ClientError('invalid_client', 'Il client_id del documento non corrisponde al suo indirizzo.');
  if (!supportsPublicAuth(meta)) throw new ClientError('invalid_client', 'Sono ammessi solo client pubblici (token_endpoint_auth_method: none).');
  checkGrantMetadata(meta);
  const domain = new URL(clientId).hostname;
  return { clientId, name: cleanName(meta.client_name, domain), redirectUris: validRedirectList(meta.redirect_uris), kind: 'metadata', domain };
}

// ------------------------------------------------------------ Ricerca

/** Il client, dal database o dal suo documento. `ClientError` se non è valido. */
export async function resolveClient(clientId: unknown, fetcher: DocumentFetcher = fetchClientDocument): Promise<McpClient> {
  if (typeof clientId !== 'string' || !clientId || clientId.length > 500) throw new ClientError('invalid_client', 'client_id mancante.');
  const ref = adminDb.collection('mcp_clients').doc(fingerprint(clientId));

  if (isMetadataClientId(clientId)) {
    const cached = (await ref.get()).data();
    const fresh = cached?.kind === 'metadata' && cached.clientId === clientId
      && typeof cached.fetchedAt === 'number' && Date.now() - cached.fetchedAt < CLIENT_METADATA_TTL_MS;
    if (fresh) {
      return { clientId, name: cached.name, redirectUris: cached.redirectUris, kind: 'metadata', domain: cached.domain };
    }
    let document: unknown;
    try {
      document = await fetcher(clientId);
    } catch (error) {
      throw new ClientError('invalid_client', `Documento del client non raggiungibile: ${error instanceof Error ? error.message : 'errore'}`);
    }
    const client = clientFromDocument(clientId, document);
    await ref.set({
      kind: 'metadata', clientId, name: client.name, redirectUris: client.redirectUris, domain: client.domain,
      fetchedAt: Date.now(), expiresAt: Timestamp.fromMillis(Date.now() + 30 * CLIENT_METADATA_TTL_MS),
    });
    return client;
  }

  const stored = (await ref.get()).data();
  if (!stored || stored.kind !== 'registered' || stored.clientId !== clientId) throw new ClientError('invalid_client', 'Client sconosciuto.');
  return { clientId, name: String(stored.name), redirectUris: stored.redirectUris || [], kind: 'registered' };
}
