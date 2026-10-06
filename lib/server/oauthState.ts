import { randomBytes } from 'node:crypto';
import { adminDb } from '@/lib/firebase-admin';

/**
 * Parametro `state` del collegamento OAuth a Google e Microsoft.
 *
 * Prima era `base64({ userId })`: chiunque poteva costruirlo e far finire i
 * token di un calendario sull'account di un altro. Ora è un valore casuale,
 * salvato sul server con l'utente che ha avviato il collegamento, valido
 * dieci minuti e utilizzabile una volta sola.
 */

export type OAuthProvider = 'google' | 'microsoft';

const COLLECTION = 'oauth_states';
const TTL_MS = 10 * 60_000;

export async function createOAuthState(uid: string, provider: OAuthProvider): Promise<string> {
  const state = randomBytes(32).toString('base64url');
  await adminDb.collection(COLLECTION).doc(state).set({
    uid,
    provider,
    expiresAt: Date.now() + TTL_MS,
  });
  return state;
}

/** Restituisce l'utente che ha avviato il collegamento e cancella lo state. */
export async function consumeOAuthState(state: string, provider: OAuthProvider): Promise<string | null> {
  if (!state || !/^[A-Za-z0-9_-]{20,100}$/.test(state)) return null;
  const ref = adminDb.collection(COLLECTION).doc(state);

  return adminDb.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return null;
    transaction.delete(ref);

    const data = snapshot.data() || {};
    if (data.provider !== provider) return null;
    if (typeof data.expiresAt !== 'number' || data.expiresAt < Date.now()) return null;
    return typeof data.uid === 'string' && data.uid ? data.uid : null;
  });
}
