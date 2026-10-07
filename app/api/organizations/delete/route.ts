import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { tooManyRequests } from '@/lib/server/rateLimit';
import { deleteOrganization } from '@/lib/server/deletions';

export const runtime = 'nodejs';

/**
 * Cancella un'organizzazione con il suo workspace, gli accessi, i team e gli
 * inviti. Solo il proprietario, e solo se il workspace non ha più progetti.
 * Body: `{ orgId }`.
 */
export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  if (tooManyRequests(`delete-org:${auth.user.uid}`, 20)) {
    return NextResponse.json({ error: 'Troppe richieste. Riprova fra un minuto.' }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const orgId = typeof body?.orgId === 'string' ? body.orgId : '';
  try {
    const result = await deleteOrganization(auth.user.uid, orgId);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Organization delete error:', error);
    return NextResponse.json({ error: 'Cancellazione non riuscita. Riprova.' }, { status: 500 });
  }
}
