import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { inWorkspace } from '@/lib/server/mcp/access';
import { mcpAllowed } from '@/lib/server/mcp/workspaceSettings';
import {
  ACCESS_TOKEN_TTL_MS, AUTH_CODE_TTL_MS, REFRESH_TOKEN_TTL_MS, fingerprint, mcpResource, parseScopes, pkceMatches,
  randomSecret, resourceMatches, type Scope,
} from '@/lib/server/mcp/config';

/**
 * Codici, token e collegamenti del server di autorizzazione.
 *
 * - Un **collegamento** (`mcp_grants`) è il consenso di un utente a un'app su
 *   un workspace, con i permessi scelti. Si vede e si revoca dalle
 *   impostazioni; revocato, tutti i suoi token smettono subito di valere.
 * - Il **codice** (`mcp_codes`) vale 10 minuti e una volta sola, ed è legato
 *   a client, indirizzo di ritorno e PKCE.
 * - I **token** (`mcp_tokens`): accesso per un'ora, rinnovo per 30 giorni.
 *   Il token di rinnovo cambia a ogni uso; se uno vecchio torna (qualcuno
 *   l'ha copiato), il collegamento si chiude.
 *
 * Nel database si salva solo l'impronta (SHA-256) di codici e token: chi
 * legge il database non può usarli. Tutte le raccolte sono chiuse al browser
 * (firestore.rules). `expireAt` serve a una policy TTL di Firestore, se la si
 * attiva; i controlli usano `expiresAtMs`.
 */

export class OAuthError extends Error {
  constructor(readonly error: string, readonly description: string, readonly status = 400) {
    super(description);
    this.name = 'OAuthError';
  }
}

export interface TokenSet {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token: string;
  scope: string;
}

export interface VerifiedToken {
  grantId: string;
  uid: string;
  workspaceId: string;
  clientId: string;
  clientName: string;
  scopes: Scope[];
}

const grants = () => adminDb.collection('mcp_grants');
const tokens = () => adminDb.collection('mcp_tokens');
const codes = () => adminDb.collection('mcp_codes');

const expiry = (ms: number) => ({ expiresAtMs: Date.now() + ms, expireAt: Timestamp.fromMillis(Date.now() + ms) });

// ------------------------------------------------------------ Codice

export async function createAuthorizationCode(input: {
  uid: string; workspaceId: string; clientId: string; clientName: string; redirectUri: string;
  codeChallenge: string; scopes: Scope[];
}): Promise<string> {
  const code = randomSecret('unf_code_');
  await codes().doc(fingerprint(code)).set({ ...input, resource: mcpResource(), ...expiry(AUTH_CODE_TTL_MS) });
  return code;
}

/** Scambia il codice con i token (`grant_type=authorization_code`). */
export async function exchangeCode(input: {
  code: unknown; clientId: unknown; redirectUri: unknown; codeVerifier: unknown; resource: unknown;
}): Promise<TokenSet> {
  if (typeof input.code !== 'string' || !input.code) throw new OAuthError('invalid_request', 'Manca il codice.');
  if (!resourceMatches(input.resource)) throw new OAuthError('invalid_target', 'Risorsa sconosciuta.');
  const ref = codes().doc(fingerprint(input.code));

  // I controlli stanno nella transazione: chi ha il codice ma non il
  // verificatore PKCE non riesce nemmeno a «bruciarlo».
  const outcome = await adminDb.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data()! : null;
    if (!data) return { error: new OAuthError('invalid_grant', 'Codice non valido o già usato.') };
    // Un codice usato due volte: qualcuno l'ha intercettato. Si chiude il
    // collegamento nato dal primo uso (OAuth 2.1 §4.1.3).
    if (data.usedAt) return { error: new OAuthError('invalid_grant', 'Codice non valido o già usato.'), reusedGrant: data.grantId as string | undefined };
    if (Number(data.expiresAtMs) < Date.now()) return { error: new OAuthError('invalid_grant', 'Codice scaduto.') };
    if (data.clientId !== input.clientId) return { error: new OAuthError('invalid_grant', 'Il codice è di un altro client.') };
    // OAuth 2.1: se il client manda redirect_uri deve essere lo stesso.
    if (input.redirectUri !== undefined && input.redirectUri !== data.redirectUri) {
      return { error: new OAuthError('invalid_grant', 'redirect_uri diverso da quello della richiesta.') };
    }
    if (!pkceMatches(input.codeVerifier, data.codeChallenge)) return { error: new OAuthError('invalid_grant', 'PKCE non valido.') };
    tx.update(ref, { usedAt: Date.now() });
    return { data };
  });

  if ('error' in outcome) {
    if (outcome.reusedGrant) await revokeGrant(outcome.reusedGrant);
    throw outcome.error;
  }
  const data = outcome.data;
  if (!(await inWorkspace(data.uid, data.workspaceId))) throw new OAuthError('invalid_grant', 'L’utente non fa più parte del workspace.');
  if (!(await mcpAllowed(data.workspaceId))) throw new OAuthError('invalid_grant', 'Gli assistenti AI sono disattivati per questo workspace.');

  const grantRef = grants().doc();
  await grantRef.set({
    uid: data.uid,
    workspaceId: data.workspaceId,
    clientId: data.clientId,
    clientName: data.clientName,
    scopes: data.scopes,
    resource: data.resource,
    createdAt: FieldValue.serverTimestamp(),
    lastUsedAtMs: Date.now(),
    revokedAt: null,
  });
  await ref.update({ grantId: grantRef.id });
  return issueTokens(grantRef.id, data.clientId, data.scopes);
}

// ------------------------------------------------------------ Token

async function issueTokens(grantId: string, clientId: string, scopes: Scope[]): Promise<TokenSet> {
  const access = randomSecret('unf_at_');
  const refresh = randomSecret('unf_rt_');
  const batch = adminDb.batch();
  batch.set(tokens().doc(fingerprint(access)), { kind: 'access', grantId, clientId, scopes, ...expiry(ACCESS_TOKEN_TTL_MS) });
  batch.set(tokens().doc(fingerprint(refresh)), { kind: 'refresh', grantId, clientId, scopes, usedAt: null, ...expiry(REFRESH_TOKEN_TTL_MS) });
  await batch.commit();
  return {
    access_token: access,
    token_type: 'Bearer',
    expires_in: Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
    refresh_token: refresh,
    scope: scopes.join(' '),
  };
}

/** Rinnovo (`grant_type=refresh_token`), con rotazione e controllo del riuso. */
export async function refreshTokens(input: { refreshToken: unknown; clientId: unknown; scope: unknown; resource: unknown }): Promise<TokenSet> {
  if (typeof input.refreshToken !== 'string' || !input.refreshToken) throw new OAuthError('invalid_request', 'Manca refresh_token.');
  if (!resourceMatches(input.resource)) throw new OAuthError('invalid_target', 'Risorsa sconosciuta.');
  const ref = tokens().doc(fingerprint(input.refreshToken));

  // Spento dall'amministratore: si rifiuta prima di consumare il token, così
  // riaccendendo l'assistente riprende senza doversi ricollegare.
  const pending = (await ref.get()).data();
  if (pending?.kind === 'refresh' && !pending.usedAt) {
    const pendingGrant = (await grants().doc(String(pending.grantId)).get()).data();
    if (pendingGrant && !(await mcpAllowed(pendingGrant.workspaceId))) {
      throw new OAuthError('invalid_grant', 'Gli assistenti AI sono disattivati per questo workspace.');
    }
  }

  const outcome = await adminDb.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data()! : null;
    if (!data || data.kind !== 'refresh') return { error: 'missing' as const };
    if (data.usedAt) return { error: 'reused' as const, grantId: data.grantId as string };
    tx.update(ref, { usedAt: Date.now() });
    return { data };
  });

  if ('error' in outcome) {
    if (outcome.error === 'reused') await revokeGrant(outcome.grantId);
    throw new OAuthError('invalid_grant', 'Token di rinnovo non valido.');
  }
  const data = outcome.data;
  if (Number(data.expiresAtMs) < Date.now()) throw new OAuthError('invalid_grant', 'Token di rinnovo scaduto.');
  if (data.clientId !== input.clientId) throw new OAuthError('invalid_grant', 'Il token è di un altro client.');

  const grant = (await grants().doc(data.grantId).get()).data();
  if (!grant || grant.revokedAt) throw new OAuthError('invalid_grant', 'Collegamento revocato.');
  if (!(await inWorkspace(grant.uid, grant.workspaceId))) {
    await revokeGrant(data.grantId);
    throw new OAuthError('invalid_grant', 'L’utente non fa più parte del workspace.');
  }

  // Si possono chiedere meno permessi, non di più.
  let scopes = grant.scopes as Scope[];
  if (input.scope !== undefined && input.scope !== '') {
    const asked = parseScopes(input.scope);
    if (!asked || asked.some(s => !scopes.includes(s))) throw new OAuthError('invalid_scope', 'Permessi oltre quelli concessi.');
    scopes = asked;
  }
  return issueTokens(data.grantId, data.clientId, scopes);
}

/** Il token di accesso, se vale ancora. Nessun dettaglio sul perché no. */
export async function verifyAccessToken(token: string): Promise<VerifiedToken | null> {
  if (!token.startsWith('unf_at_') || token.length > 200) return null;
  const data = (await tokens().doc(fingerprint(token)).get()).data();
  if (!data || data.kind !== 'access' || Number(data.expiresAtMs) < Date.now()) return null;
  const grantRef = grants().doc(String(data.grantId));
  const grant = (await grantRef.get()).data();
  if (!grant || grant.revokedAt || grant.resource !== mcpResource()) return null;
  // «Ultimo uso» per le impostazioni, al massimo una scrittura ogni 5 minuti.
  if (!(Number(grant.lastUsedAtMs) > Date.now() - 5 * 60 * 1000)) {
    grantRef.update({ lastUsedAtMs: Date.now() }).catch(() => undefined);
  }
  return {
    grantId: grantRef.id,
    uid: String(grant.uid),
    workspaceId: String(grant.workspaceId),
    clientId: String(grant.clientId),
    clientName: String(grant.clientName || ''),
    scopes: (Array.isArray(data.scopes) ? data.scopes : []) as Scope[],
  };
}

/** Revoca da parte del client (RFC 7009): chiude tutto il collegamento. */
export async function revokeToken(token: unknown, clientId: unknown): Promise<void> {
  if (typeof token !== 'string' || !token || token.length > 200) return;
  const data = (await tokens().doc(fingerprint(token)).get()).data();
  if (!data || (clientId !== undefined && data.clientId !== clientId)) return;
  await revokeGrant(String(data.grantId));
}

export async function revokeGrant(grantId: string): Promise<void> {
  if (!grantId) return;
  const ref = grants().doc(grantId);
  if ((await ref.get()).exists) await ref.update({ revokedAt: Date.now() });
}

// ------------------------------------------------------------ Impostazioni

export interface ConnectionSummary {
  id: string;
  clientName: string;
  workspaceId: string;
  scopes: string[];
  createdAt: number | null;
  lastUsedAt: number | null;
}

/** I collegamenti attivi dell'utente. */
export async function listConnections(uid: string): Promise<ConnectionSummary[]> {
  const snap = await grants().where('uid', '==', uid).get();
  return snap.docs
    .map(doc => ({ id: doc.id, data: doc.data() || {} }))
    .filter(({ data }) => !data.revokedAt)
    .map(({ id, data }) => ({
      id,
      clientName: String(data.clientName || ''),
      workspaceId: String(data.workspaceId || ''),
      scopes: Array.isArray(data.scopes) ? data.scopes : [],
      createdAt: typeof data.createdAt?.toMillis === 'function' ? data.createdAt.toMillis() : null,
      lastUsedAt: Number(data.lastUsedAtMs) || null,
    }))
    .sort((a, b) => (b.lastUsedAt || 0) - (a.lastUsedAt || 0));
}

/** Revoca un collegamento dell'utente. `false` se non è suo. */
export async function revokeConnection(uid: string, grantId: unknown): Promise<boolean> {
  if (typeof grantId !== 'string' || !/^[A-Za-z0-9]{1,64}$/.test(grantId)) return false;
  const data = (await grants().doc(grantId).get()).data();
  if (!data || data.uid !== uid) return false;
  await revokeGrant(grantId);
  return true;
}
