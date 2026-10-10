import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { tooManyRequests } from '@/lib/server/rateLimit';
import { deleteProject } from '@/lib/server/deletions';

export const runtime = 'nodejs';

/**
 * Cancella un progetto con tutto quello che contiene: dati, chat, chat AI e
 * file (vedi lib/server/deletions.ts). Body: `{ projectId }`.
 */
export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  if (tooManyRequests(`delete-project:${auth.user.uid}`, 20)) {
    return NextResponse.json({ error: 'Troppe richieste. Riprova fra un minuto.' }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const projectId = typeof body?.projectId === 'string' ? body.projectId : '';
  try {
    const result = await deleteProject(auth.user.uid, projectId);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Project delete error:', error);
    return NextResponse.json({ error: 'Cancellazione non riuscita. Riprova.' }, { status: 500 });
  }
}
