import { createHash, randomBytes } from 'node:crypto';
import { appUrl } from '@/lib/appUrl';

/**
 * Indirizzi e costanti del server MCP e del suo server di autorizzazione.
 *
 * Unfract è insieme il server MCP (la risorsa, `/api/mcp`) e il server di
 * autorizzazione OAuth 2.1 che rilascia i token per quella risorsa. Gli
 * indirizzi pubblici vengono da `appUrl()`, mai dall'host della richiesta.
 */

/** Acceso in sviluppo e su quality; in prod solo con `MCP_ENABLED=true`. */
export function mcpEnabled(): boolean {
  const flag = process.env.MCP_ENABLED?.trim().toLowerCase();
  if (flag === 'true') return true;
  if (flag === 'false') return false;
  return process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== 'unfract-prod';
}

export const issuer = () => appUrl();
/** URI canonico della risorsa (RFC 8707): è l'audience dei token. */
export const mcpResource = () => `${appUrl()}/api/mcp`;
export const protectedResourceMetadataUrl = () => `${appUrl()}/.well-known/oauth-protected-resource/api/mcp`;
export const authorizationEndpoint = () => `${appUrl()}/oauth/authorize`;
export const tokenEndpoint = () => `${appUrl()}/api/oauth/token`;
export const registrationEndpoint = () => `${appUrl()}/api/oauth/register`;
export const revocationEndpoint = () => `${appUrl()}/api/oauth/revoke`;

/**
 * Permessi che un assistente può chiedere:
 * - `read`: leggere progetti, task, bacheca, documenti, riunioni e il proprio
 *   calendario (niente CRM);
 * - `write`: creare, modificare, spostare e commentare task (niente
 *   cancellazioni). Lo concede l'utente con una spunta nel consenso, che
 *   parte spenta: chiederlo non basta.
 */
export const SCOPES = ['read', 'write'] as const;
export type Scope = (typeof SCOPES)[number];
export const DEFAULT_SCOPES: Scope[] = ['read'];

export const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000;            // 1 ora
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;  // 30 giorni
export const AUTH_CODE_TTL_MS = 10 * 60 * 1000;                // 10 minuti
export const CLIENT_METADATA_TTL_MS = 24 * 60 * 60 * 1000;     // documenti dei client (CIMD), 1 giorno

/** I permessi chiesti, solo quelli che esistono. `null` se ne chiede uno sconosciuto. */
export function parseScopes(raw: unknown): Scope[] | null {
  if (raw === undefined || raw === null || raw === '') return [...DEFAULT_SCOPES];
  if (typeof raw !== 'string') return null;
  const asked = Array.from(new Set(raw.split(' ').map(s => s.trim()).filter(Boolean)));
  if (asked.some(s => !(SCOPES as readonly string[]).includes(s))) return null;
  return asked.length ? (asked as Scope[]) : [...DEFAULT_SCOPES];
}

/**
 * La risorsa chiesta deve essere questo server MCP. Il client la deve mandare
 * (RFC 8707); se manca, c'è una risorsa sola ed è questa.
 */
export function resourceMatches(raw: unknown): boolean {
  if (raw === undefined || raw === null || raw === '') return true;
  if (typeof raw !== 'string') return false;
  const normalize = (value: string) => {
    try {
      const url = new URL(value);
      return `${url.protocol}//${url.host.toLowerCase()}${url.pathname.replace(/\/+$/, '')}`;
    } catch {
      return null;
    }
  };
  return normalize(raw) !== null && normalize(raw) === normalize(mcpResource());
}

/** Segreto casuale con prefisso (token, codici, ID dei client). */
export function randomSecret(prefix: string, bytes = 32): string {
  return `${prefix}${randomBytes(bytes).toString('base64url')}`;
}

/** Impronta di un segreto: nel database si salva questa, mai il segreto. */
export function fingerprint(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

/** PKCE S256 (RFC 7636): base64url(sha256(verifier)) deve essere la challenge. */
export function pkceMatches(verifier: unknown, challenge: unknown): boolean {
  if (typeof verifier !== 'string' || typeof challenge !== 'string') return false;
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) return false;
  return createHash('sha256').update(verifier).digest('base64url') === challenge;
}
