import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { tooManyRequests } from '@/lib/server/rateLimit';
import { releaseStoredFile, trackStoredFile } from '@/lib/server/usage';

export const runtime = 'nodejs';

/**
 * Spazio usato dai file del workspace.
 *
 * Body: `{ action: 'track', workspaceId, path }` dopo un caricamento, oppure
 * `{ action: 'release', path }` dopo aver cancellato il file. La dimensione la
 * legge il server da Storage: il browser manda solo il percorso.
 */
export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const idToken = (request.headers.get('authorization') || '').slice(7).trim();

  if (tooManyRequests(`usage-storage:${auth.user.uid}`, 120)) {
    return NextResponse.json({ error: 'Troppe richieste. Riprova fra un minuto.' }, { status: 429 });
  }

  const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '';
  if (!bucket) {
    console.error('Storage usage: NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET is not configured');
    return NextResponse.json({ error: 'Servizio non configurato.' }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const path = typeof body?.path === 'string' ? body.path : '';
  const workspaceId = typeof body?.workspaceId === 'string' ? body.workspaceId : '';

  try {
    const result = body?.action === 'track'
      ? await trackStoredFile({ uid: auth.user.uid, workspaceId, path, idToken, bucket })
      : body?.action === 'release'
        ? await releaseStoredFile({ uid: auth.user.uid, path, idToken, bucket })
        : { ok: false as const, status: 400 as const, error: 'Azione non valida.' };
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ success: true, bytes: result.bytes });
  } catch (error) {
    console.error('Storage usage error:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Spazio usato non aggiornato.' }, { status: 502 });
  }
}
