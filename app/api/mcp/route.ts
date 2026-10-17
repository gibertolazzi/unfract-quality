import { createMcpHandler } from '@modelcontextprotocol/server';
import { appUrl } from '@/lib/appUrl';
import { tooManyRequestsShared } from '@/lib/server/rateLimit';
import { protectedResourceMetadataUrl } from '@/lib/server/mcp/config';
import { CORS_HEADERS, disabled, preflight } from '@/lib/server/mcp/http';
import { verifyAccessToken, type VerifiedToken } from '@/lib/server/mcp/tokens';
import { buildMcpServer } from '@/lib/server/mcp/tools';

/**
 * Il server MCP di Unfract (Streamable HTTP, protocollo 2026-07-28 e, per i
 * client che non l'hanno ancora, le versioni 2025 senza sessione).
 *
 * Ogni richiesta porta il suo token: niente sessioni, va bene con più
 * istanze di App Hosting. Il token si verifica qui, prima dell'SDK; il server
 * MCP si costruisce per quella richiesta, con i permessi di quell'utente.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const handler = createMcpHandler(({ authInfo }) => buildMcpServer(authInfo?.extra?.verified as VerifiedToken));

function challenge(status: 401 | 403, extra = '') {
  // Si chiedono lettura e scrittura: la scrittura la concede l'utente nel
  // consenso, con una spunta che parte spenta.
  const header = `Bearer resource_metadata="${protectedResourceMetadataUrl()}", scope="read write"${extra}`;
  return new Response(JSON.stringify({ error: status === 401 ? 'invalid_token' : 'insufficient_scope' }), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', 'WWW-Authenticate': header },
  });
}

/**
 * Le richieste dai browser devono venire da Unfract stesso (o dagli indirizzi
 * in `MCP_ALLOWED_ORIGINS`): lo chiede la spec contro il DNS rebinding. Le app
 * come Claude e ChatGPT chiamano dai loro server, senza `Origin`.
 */
function originAllowed(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  const allowed = new Set([new URL(appUrl()).origin, ...(process.env.MCP_ALLOWED_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean)]);
  return allowed.has(origin);
}

async function serve(request: Request): Promise<Response> {
  const off = disabled();
  if (off) return off;
  if (!originAllowed(request)) return new Response('Origin not allowed', { status: 403 });

  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const verified = token ? await verifyAccessToken(token) : null;
  if (!verified) return challenge(401, token ? ', error="invalid_token"' : '');
  if (!verified.scopes.includes('read')) return challenge(403, ', error="insufficient_scope"');

  if (await tooManyRequestsShared(`mcp:${verified.grantId}`, 120, 60_000)) {
    return new Response(JSON.stringify({ error: 'Troppe richieste: riprova tra un minuto.' }), {
      status: 429,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', 'Retry-After': '60' },
    });
  }

  const response = await handler.fetch(request, {
    authInfo: { token, clientId: verified.clientId, scopes: verified.scopes, extra: { verified } },
  });
  for (const [key, value] of Object.entries(CORS_HEADERS)) response.headers.set(key, value);
  return response;
}

export const POST = serve;
export const GET = serve;
export const DELETE = serve;
export const OPTIONS = preflight;
