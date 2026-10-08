import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireUser } from '@/lib/server/auth';
import { tooManyRequestsShared } from '@/lib/server/rateLimit';
import { createOrgInvite, isOrgMember } from '@/lib/server/orgInvites';

export const runtime = 'nodejs';

/**
 * Link di invito da condividere, generato dal server per un membro
 * dell'organizzazione. Vale per chiunque lo riceva, ma solo 48 ore.
 * Body: `{ orgId }`. Risposta: `{ url, expiresAt }`.
 */
export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const { user } = auth;

  if (await tooManyRequestsShared(`invite-link:${user.uid}`, 10)) {
    return NextResponse.json({ error: 'Troppe richieste. Riprova fra un minuto.' }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const orgId = typeof body?.orgId === 'string' ? body.orgId : '';
  if (!orgId || !/^[A-Za-z0-9_-]{1,128}$/.test(orgId)) {
    return NextResponse.json({ error: 'Organizzazione non valida.' }, { status: 400 });
  }

  const org = (await adminDb.collection('organizations').doc(orgId).get()).data();
  if (!org || !isOrgMember(org, user.uid)) {
    return NextResponse.json({ error: 'Non fai parte di questa organizzazione.' }, { status: 403 });
  }

  const { token, expiresAt } = await createOrgInvite({ orgId, invitedBy: user.uid, kind: 'link' });
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  return NextResponse.json({ url: `${baseUrl}/invite/${token}`, expiresAt });
}
