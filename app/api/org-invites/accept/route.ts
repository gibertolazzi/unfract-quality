import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { tooManyRequests } from '@/lib/server/rateLimit';
import { acceptOrgInvite } from '@/lib/server/orgInvites';

export const runtime = 'nodejs';

/**
 * Accettazione di un invito. Body: `{ token }`. Risposta: `{ orgId }`.
 * L'utente è quello del token Firebase; l'aggiunta all'organizzazione la fa
 * il server, non più il browser.
 */
export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  if (tooManyRequests(`invite-accept:${auth.user.uid}`, 20)) {
    return NextResponse.json({ error: 'Troppe richieste. Riprova fra un minuto.' }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const token = typeof body?.token === 'string' ? body.token : '';

  try {
    const result = await acceptOrgInvite(token, auth.user);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ orgId: result.orgId, alreadyMember: result.alreadyMember });
  } catch (error) {
    console.error('Accettazione invito non riuscita:', error);
    return NextResponse.json({ error: 'Accettazione dell’invito non riuscita.' }, { status: 500 });
  }
}
