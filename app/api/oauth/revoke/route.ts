import { disabled, json, preflight, readForm } from '@/lib/server/mcp/http';
import { revokeToken } from '@/lib/server/mcp/tokens';

/**
 * Revoca di un token (RFC 7009): chiude il collegamento intero. Risponde 200
 * anche se il token non esiste, come vuole la RFC.
 */
export async function POST(request: Request) {
  const off = disabled();
  if (off) return off;
  const form = await readForm(request);
  if (!form) return json({ error: 'invalid_request' }, 400);
  try {
    await revokeToken(form.token, form.client_id);
  } catch (error) {
    console.error('MCP revoke failed:', error instanceof Error ? error.message : error);
  }
  return json({});
}

export const OPTIONS = preflight;
