import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';

/**
 * Autenticazione delle route server.
 *
 * Regola: l'utente si ricava SEMPRE dall'ID token Firebase, mai da un
 * `userId` mandato dal client. Un `userId` nella richiesta è un dato che
 * chiunque può scrivere; il token lo firma Firebase.
 */

export interface AuthenticatedUser {
  uid: string;
  email: string;
  name: string;
  picture?: string;
}

export type AuthResult =
  | { ok: true; user: AuthenticatedUser }
  | { ok: false; response: NextResponse };

/** Verifica un ID token Firebase. Qualunque errore è un «no». */
export async function verifyIdToken(idToken: string): Promise<AuthenticatedUser | null> {
  if (!idToken) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    return {
      uid: decoded.uid,
      email: decoded.email || '',
      name: decoded.name || decoded.email || 'Utente',
      picture: decoded.picture || '',
    };
  } catch {
    return null;
  }
}

/** Legge `Authorization: Bearer <token>` e restituisce l'utente o una risposta 401. */
export async function requireUser(request: Request): Promise<AuthResult> {
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) {
    return { ok: false, response: NextResponse.json({ error: 'Autenticazione richiesta.' }, { status: 401 }) };
  }

  const user = await verifyIdToken(token);
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: 'Token non valido o scaduto.' }, { status: 401 }) };
  }
  return { ok: true, user };
}
