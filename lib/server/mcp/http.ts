import { NextResponse } from 'next/server';
import { mcpEnabled } from '@/lib/server/mcp/config';
import { OAuthError } from '@/lib/server/mcp/tokens';

/**
 * Risposte delle route OAuth e MCP.
 *
 * Metadati, registrazione, token e revoca si chiamano anche da client che
 * girano nel browser (es. MCP Inspector): CORS aperto. Non c'è rischio, non
 * usano cookie: valgono solo i segreti nella richiesta.
 */

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, MCP-Protocol-Version, Mcp-Method, Mcp-Name',
  'Access-Control-Expose-Headers': 'WWW-Authenticate',
};

const NO_STORE = { 'Cache-Control': 'no-store', Pragma: 'no-cache' };

export function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { ...CORS_HEADERS, ...NO_STORE, ...headers } });
}

export function oauthError(error: unknown) {
  if (error instanceof OAuthError) {
    return json({ error: error.error, error_description: error.description }, error.status);
  }
  console.error('OAuth error:', error instanceof Error ? error.message : error);
  return json({ error: 'server_error', error_description: 'Errore interno.' }, 500);
}

export function preflight() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/** Spento (prod senza `MCP_ENABLED=true`): le route rispondono come se non esistessero. */
export function disabled(): NextResponse | null {
  return mcpEnabled() ? null : NextResponse.json({ error: 'Not found' }, { status: 404 });
}

/** L'IP dichiarato dal client: serve solo a dividere i limiti, non a fidarsi. */
export function clientIp(request: Request): string {
  return (request.headers.get('x-forwarded-for') || '').split(',')[0].trim().slice(0, 64) || 'unknown';
}

/** Corpo `application/x-www-form-urlencoded` (token e revoca, RFC 6749) o JSON. */
export async function readForm(request: Request): Promise<Record<string, string> | null> {
  const type = request.headers.get('content-type') || '';
  try {
    if (type.includes('application/x-www-form-urlencoded')) {
      const params = new URLSearchParams(await request.text());
      const result: Record<string, string> = {};
      for (const [key, value] of params) {
        // Un parametro ripetuto è un errore (RFC 6749 §3.1).
        if (key in result) return null;
        result[key] = value;
      }
      return result;
    }
    if (type.includes('application/json')) {
      const body = await request.json();
      if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
      return Object.fromEntries(Object.entries(body).filter(([, v]) => typeof v === 'string')) as Record<string, string>;
    }
  } catch {
    return null;
  }
  return null;
}
