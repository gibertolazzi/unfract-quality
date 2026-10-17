import { SCOPES, issuer, mcpResource } from '@/lib/server/mcp/config';
import { disabled, json, preflight } from '@/lib/server/mcp/http';

/**
 * Metadati della risorsa protetta (RFC 9728), serviti a
 * `/.well-known/oauth-protected-resource/api/mcp` (riscrittura in
 * next.config.mjs). Da qui l'assistente scopre dove fare il login.
 */
export async function GET() {
  return disabled() ?? json({
    resource: mcpResource(),
    authorization_servers: [issuer()],
    scopes_supported: SCOPES,
    bearer_methods_supported: ['header'],
    resource_name: 'Unfract',
  }, 200, { 'Cache-Control': 'public, max-age=3600' });
}

export const OPTIONS = preflight;
