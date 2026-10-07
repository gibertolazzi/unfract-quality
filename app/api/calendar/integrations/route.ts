import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireUser } from '@/lib/server/auth';

/**
 * Quali calendari ha collegato l'utente, senza i token.
 *
 * Prima il browser leggeva direttamente `users/{uid}/integrations/*`, che
 * contiene `accessToken` e `refreshToken`. Con le regole di Firestore quei
 * documenti sono solo del server: al browser basta sapere se esistono.
 */
export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const uid = auth.user.uid;

  try {
    const [google, microsoft] = await Promise.all([
      adminDb.doc(`users/${uid}/integrations/google`).get(),
      adminDb.doc(`users/${uid}/integrations/microsoft`).get(),
    ]);
    return NextResponse.json({ google: google.exists, microsoft: microsoft.exists });
  } catch (error) {
    console.error('Calendar integrations status error:', error);
    return NextResponse.json({ error: 'Stato dei calendari non disponibile.' }, { status: 500 });
  }
}
