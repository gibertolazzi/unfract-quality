import {
  SCOPES, authorizationEndpoint, issuer, registrationEndpoint, revocationEndpoint, tokenEndpoint,
} from '@/lib/server/mcp/config';
import { disabled, json, preflight } from '@/lib/server/mcp/http';

/**
 * Metadati del server di autorizzazione (RFC 8414), serviti a
 * `/.well-known/oauth-authorization-server` (riscrittura in next.config.mjs).
 *
 * Solo codice di autorizzazione con PKCE S256 e client pubblici. Registrazione
 * con documento di metadati (consigliata) o dinamica (deprecata, per i client
 * che non conoscono l'altra).
 */
export async function GET() {
  return disabled() ?? json({
    issuer: issuer(),
    authorization_endpoint: authorizationEndpoint(),
    token_endpoint: tokenEndpoint(),
    registration_endpoint: registrationEndpoint(),
    revocation_endpoint: revocationEndpoint(),
    scopes_supported: SCOPES,
    response_types_supported: ['code'],
    response_modes_supported: ['query'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    revocation_endpoint_auth_methods_supported: ['none'],
    client_id_metadata_document_supported: true,
    authorization_response_iss_parameter_supported: true,
  }, 200, { 'Cache-Control': 'public, max-age=3600' });
}

export const OPTIONS = preflight;
