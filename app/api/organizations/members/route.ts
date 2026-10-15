import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { tooManyRequests } from '@/lib/server/rateLimit';
import { readJsonObject } from '@/lib/server/requestBody';
import { manageOrgMember, type MemberAction, type MemberRole } from '@/lib/server/orgMembers';

export const runtime = 'nodejs';

/**
 * Espelli, esci, sospendi, riattiva, cambia ruolo, silenzia nelle chat (vedi
 * lib/server/orgMembers.ts).
 * Body: `{ orgId, uid, action: 'remove' | 'suspend' | 'reactivate' | 'role' | 'mute' | 'unmute', role? }`.
 * Per uscire da soli: `action: 'remove'` con il proprio `uid`.
 */
export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  if (tooManyRequests(`org-members:${auth.user.uid}`, 30)) {
    return NextResponse.json({ error: 'Troppe richieste. Riprova fra un minuto.' }, { status: 429 });
  }

  const body = await readJsonObject(request);
  if (!body) return NextResponse.json({ error: 'Richiesta non leggibile.' }, { status: 400 });

  try {
    const result = await manageOrgMember(auth.user.uid, {
      orgId: typeof body.orgId === 'string' ? body.orgId : '',
      uid: typeof body.uid === 'string' ? body.uid : '',
      action: body.action as MemberAction,
      role: body.role as MemberRole | undefined,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Organization member error:', error);
    return NextResponse.json({ error: 'Operazione non riuscita. Riprova.' }, { status: 500 });
  }
}
