import { tooManyRequestsShared } from '@/lib/server/rateLimit';
import { clientIp, disabled, json, oauthError, preflight, readForm } from '@/lib/server/mcp/http';
import { OAuthError, exchangeCode, refreshTokens } from '@/lib/server/mcp/tokens';

/** Endpoint dei token (OAuth 2.1 §3.2): codice → token, e rinnovo. */
export async function POST(request: Request) {
  const off = disabled();
  if (off) return off;
  const form = await readForm(request);
  if (!form) return oauthError(new OAuthError('invalid_request', 'Corpo della richiesta non valido.'));
  const key = form.client_id ? `mcp-token:${form.client_id.slice(0, 200)}` : `mcp-token-ip:${clientIp(request)}`;
  if (await tooManyRequestsShared(key, 60, 60_000)) {
    return json({ error: 'too_many_requests', error_description: 'Troppe richieste.' }, 429);
  }
  try {
    if (form.grant_type === 'authorization_code') {
      return json(await exchangeCode({
        code: form.code,
        clientId: form.client_id,
        redirectUri: form.redirect_uri,
        codeVerifier: form.code_verifier,
        resource: form.resource,
      }));
    }
    if (form.grant_type === 'refresh_token') {
      return json(await refreshTokens({ refreshToken: form.refresh_token, clientId: form.client_id, scope: form.scope, resource: form.resource }));
    }
    return oauthError(new OAuthError('unsupported_grant_type', 'grant_type ammessi: authorization_code, refresh_token.'));
  } catch (error) {
    return oauthError(error);
  }
}

export const OPTIONS = preflight;
