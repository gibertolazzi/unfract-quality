import { ClientError, redirectAllowed, redirectKind, resolveClient, type DocumentFetcher, type McpClient } from '@/lib/server/mcp/clients';
import { issuer, parseScopes, resourceMatches, type Scope } from '@/lib/server/mcp/config';
import { inWorkspace, userWorkspaces, type WorkspaceSummary } from '@/lib/server/mcp/access';
import { createAuthorizationCode } from '@/lib/server/mcp/tokens';
import { disabledWorkspaces, mcpAllowed } from '@/lib/server/mcp/workspaceSettings';

/**
 * La richiesta di autorizzazione (`/oauth/authorize?...`), controllata dal
 * server sia quando la pagina di consenso si apre sia quando l'utente
 * conferma: la pagina non decide nulla.
 *
 * Se il client o l'indirizzo di ritorno non vanno, si mostra l'errore e non
 * si rimanda da nessuna parte: rimandare a un indirizzo non verificato
 * aprirebbe un «open redirect» (OAuth 2.1 §4.1.2.1). Gli altri errori tornano
 * all'app con `error=...`, come prevede OAuth.
 */

export interface AuthorizeParams {
  response_type?: unknown;
  client_id?: unknown;
  redirect_uri?: unknown;
  code_challenge?: unknown;
  code_challenge_method?: unknown;
  state?: unknown;
  scope?: unknown;
  resource?: unknown;
}

export type AuthorizeCheck =
  | { ok: true; client: McpClient; redirectUri: string; state: string | null; scopes: Scope[]; codeChallenge: string }
  /** Errore da mostrare nella pagina. */
  | { ok: false; message: string; redirect?: undefined }
  /** Errore da rimandare all'app. */
  | { ok: false; message: string; redirect: string };

/** Indirizzo di ritorno con i parametri della risposta, `iss` compreso (RFC 9207). */
export function redirectWith(redirectUri: string, params: Record<string, string | null>): string {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(params)) if (value !== null) url.searchParams.set(key, value);
  url.searchParams.set('iss', issuer());
  return url.toString();
}

export async function checkAuthorizeRequest(params: AuthorizeParams, fetcher?: DocumentFetcher): Promise<AuthorizeCheck> {
  let client: McpClient;
  try {
    client = await resolveClient(params.client_id, fetcher);
  } catch (error) {
    return { ok: false, message: error instanceof ClientError ? error.message : 'Client non valido.' };
  }
  if (typeof params.redirect_uri !== 'string' || !redirectAllowed(client, params.redirect_uri)) {
    return { ok: false, message: 'L’indirizzo di ritorno non è tra quelli registrati dall’app.' };
  }
  const redirectUri = params.redirect_uri;
  const state = typeof params.state === 'string' && params.state.length <= 2000 ? params.state : null;
  const fail = (error: string, message: string) =>
    ({ ok: false as const, message, redirect: redirectWith(redirectUri, { error, error_description: message, state }) });

  if (params.response_type !== 'code') return fail('unsupported_response_type', 'È ammesso solo response_type=code.');
  if (params.code_challenge_method !== 'S256') return fail('invalid_request', 'Serve PKCE con code_challenge_method=S256.');
  if (typeof params.code_challenge !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(params.code_challenge)) {
    return fail('invalid_request', 'code_challenge non valida.');
  }
  const scopes = parseScopes(params.scope);
  if (!scopes) return fail('invalid_scope', 'Permessi sconosciuti.');
  if (!resourceMatches(params.resource)) return fail('invalid_target', 'Risorsa sconosciuta.');

  return { ok: true, client, redirectUri, state, scopes, codeChallenge: params.code_challenge };
}

/** Cosa mostra la pagina di consenso. */
export function consentDetails(check: Extract<AuthorizeCheck, { ok: true }>, workspaces: Array<WorkspaceSummary & { disabled?: boolean }>) {
  const kind = redirectKind(check.redirectUri);
  const url = new URL(check.redirectUri);
  return {
    clientName: check.client.name,
    // Nome verificato dal dominio (CIMD) o dichiarato dall'app (DCR).
    verifiedDomain: check.client.kind === 'metadata' ? check.client.domain || null : null,
    redirectHost: kind === 'native' ? url.protocol.slice(0, -1) : url.host,
    // Indirizzi che qualunque programma del computer può usare (spec MCP:
    // avviso in più per localhost).
    localRedirect: kind === 'loopback' || kind === 'native',
    scopes: check.scopes,
    workspaces,
  };
}

export async function authorizeConsent(params: AuthorizeParams, uid: string) {
  const check = await checkAuthorizeRequest(params);
  if (!check.ok) return check;
  const workspaces = await userWorkspaces(uid);
  // Quelli spenti dall'amministratore si mostrano, ma non si possono scegliere.
  const disabled = await disabledWorkspaces(workspaces.map(ws => ws.id));
  return { ...check, details: consentDetails(check, workspaces.map(ws => ({ ...ws, disabled: disabled.has(ws.id) }))) };
}

/** Risposta dell'utente: l'indirizzo a cui mandare il browser. */
export async function authorizeDecision(params: AuthorizeParams, uid: string, decision: { approve: boolean; workspaceId: unknown }) {
  const check = await checkAuthorizeRequest(params);
  if (!check.ok) return check;
  if (!decision.approve) {
    return { ok: true as const, redirect: redirectWith(check.redirectUri, { error: 'access_denied', error_description: 'Accesso negato dall’utente.', state: check.state }) };
  }
  if (typeof decision.workspaceId !== 'string' || !(await inWorkspace(uid, decision.workspaceId))) {
    return { ok: false as const, message: 'Scegli un workspace di cui fai parte.' };
  }
  if (!(await mcpAllowed(decision.workspaceId))) {
    return { ok: false as const, message: 'Gli assistenti AI sono disattivati per questo workspace.' };
  }
  const code = await createAuthorizationCode({
    uid,
    workspaceId: decision.workspaceId,
    clientId: check.client.clientId,
    clientName: check.client.name,
    redirectUri: check.redirectUri,
    codeChallenge: check.codeChallenge,
    scopes: check.scopes,
  });
  return { ok: true as const, redirect: redirectWith(check.redirectUri, { code, state: check.state }) };
}
