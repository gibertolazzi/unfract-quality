import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { readJsonObject } from '@/lib/server/requestBody';
import { tooManyRequestsShared } from '@/lib/server/rateLimit';
import { authorizeConsent, authorizeDecision, type AuthorizeParams } from '@/lib/server/mcp/authorize';
import { disabled } from '@/lib/server/mcp/http';

/**
 * La pagina di consenso (`/oauth/authorize`) chiama questa route con il token
 * Firebase dell'utente: `check` per sapere cosa mostrare, `approve` o `deny`
 * per rispondere. Il token va nell'intestazione, non in un cookie: un altro
 * sito non può far confermare l'utente a sua insaputa (CSRF).
 */

const PARAMS = ['response_type', 'client_id', 'redirect_uri', 'code_challenge', 'code_challenge_method', 'state', 'scope', 'resource'] as const;

function pickParams(raw: unknown): AuthorizeParams {
  const source = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  return Object.fromEntries(PARAMS.map(key => [key, typeof source[key] === 'string' ? source[key] : undefined]));
}

export async function POST(request: Request) {
  const off = disabled();
  if (off) return off;
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  if (await tooManyRequestsShared(`mcp-authorize:${auth.user.uid}`, 30, 60_000)) {
    return NextResponse.json({ error: 'Troppe richieste, riprova tra poco.' }, { status: 429 });
  }
  const body = await readJsonObject(request);
  if (!body) return NextResponse.json({ error: 'Richiesta non valida.' }, { status: 400 });
  const params = pickParams(body.params);

  try {
    if (body.action === 'check') {
      const result = await authorizeConsent(params, auth.user.uid);
      if (!result.ok) return NextResponse.json({ error: result.message, redirect: result.redirect ?? null }, { status: 400 });
      return NextResponse.json({ details: result.details });
    }
    if (body.action === 'approve' || body.action === 'deny') {
      const result = await authorizeDecision(params, auth.user.uid, { approve: body.action === 'approve', workspaceId: body.workspaceId, allowWrite: body.allowWrite });
      if (!result.ok) return NextResponse.json({ error: result.message, redirect: result.redirect ?? null }, { status: 400 });
      return NextResponse.json({ redirect: result.redirect });
    }
  } catch (error) {
    console.error('MCP authorize failed:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Errore interno, riprova.' }, { status: 500 });
  }
  return NextResponse.json({ error: 'Azione sconosciuta.' }, { status: 400 });
}
