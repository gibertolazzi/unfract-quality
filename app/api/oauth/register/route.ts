import { readJsonObject } from '@/lib/server/requestBody';
import { tooManyRequestsShared } from '@/lib/server/rateLimit';
import { ClientError, registerClient } from '@/lib/server/mcp/clients';
import { clientIp, disabled, json, preflight } from '@/lib/server/mcp/http';

/**
 * Registrazione dinamica dei client (RFC 7591). Chiunque può registrarsi, ma
 * registrarsi non dà accesso a niente: serve comunque il consenso di un
 * utente. I limiti evitano di riempire il database.
 */
export async function POST(request: Request) {
  const off = disabled();
  if (off) return off;
  if (await tooManyRequestsShared(`mcp-register:${clientIp(request)}`, 10, 60 * 60_000)
    || await tooManyRequestsShared('mcp-register:all', 300, 60 * 60_000)) {
    return json({ error: 'too_many_requests', error_description: 'Troppe registrazioni, riprova più tardi.' }, 429);
  }
  const body = await readJsonObject(request);
  if (!body) return json({ error: 'invalid_client_metadata', error_description: 'Serve un JSON.' }, 400);
  try {
    return json(await registerClient(body), 201);
  } catch (error) {
    if (error instanceof ClientError) return json({ error: error.code, error_description: error.message }, 400);
    console.error('MCP client registration failed:', error instanceof Error ? error.message : error);
    return json({ error: 'server_error', error_description: 'Errore interno.' }, 500);
  }
}

export const OPTIONS = preflight;
