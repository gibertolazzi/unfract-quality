import { createHash } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';

/**
 * Limite di richieste per chiave (di solito `operazione:uid`).
 *
 * Sta in memoria: ogni istanza del server ha il suo contatore e si azzera a
 * ogni riavvio. Basta per le operazioni economiche; per quelle che costano
 * (AI, email, inviti di calendario) si usa `tooManyRequestsShared`.
 */
const windows = new Map<string, number[]>();

export function tooManyRequests(key: string, limit: number, windowMs = 60_000): boolean {
  const now = Date.now();
  const recent = (windows.get(key) || []).filter(at => now - at < windowMs);
  recent.push(now);
  windows.set(key, recent);
  return recent.length > limit;
}

/**
 * Lo stesso limite, ma contato su Firestore: vale per tutte le istanze e
 * sopravvive ai riavvii (segnalazione S21).
 *
 * Finestra fissa: un documento per chiave in `rate_limits` (solo server), che
 * riparte da zero quando cambia la finestra. `expiresAt` serve a una policy
 * TTL, se la si attiva; senza, resta un documento per utente e operazione.
 *
 * Se Firestore non risponde si ripiega sul contatore in memoria: un guasto
 * del contatore non deve bloccare gli utenti.
 */
export async function tooManyRequestsShared(key: string, limit: number, windowMs = 60_000): Promise<boolean> {
  const now = Date.now();
  const windowStart = now - (now % windowMs);
  // La chiave contiene l'uid: nell'id del documento va come hash.
  const ref = adminDb.collection('rate_limits').doc(createHash('sha256').update(key).digest('hex').slice(0, 40));
  try {
    const count = await adminDb.runTransaction(async transaction => {
      const snapshot = await transaction.get(ref);
      const sameWindow = snapshot.exists && snapshot.get('windowStart') === windowStart;
      const next = (sameWindow ? Number(snapshot.get('count')) || 0 : 0) + 1;
      transaction.set(ref, { windowStart, count: next, expiresAt: Timestamp.fromMillis(windowStart + 2 * windowMs) });
      return next;
    });
    return count > limit;
  } catch (error) {
    console.error('Shared rate limit unavailable, using the local one:', error instanceof Error ? error.message : error);
    return tooManyRequests(key, limit, windowMs);
  }
}
