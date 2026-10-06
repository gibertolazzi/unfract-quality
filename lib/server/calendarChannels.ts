import { randomBytes, timingSafeEqual } from 'node:crypto';
import { adminDb } from '@/lib/firebase-admin';

/**
 * Canali con cui Google e Microsoft avvisano Unfract dei cambi di calendario.
 *
 * Prima l'utente si ricavava da ciò che arrivava nell'avviso (`channel-id` o
 * `clientState`), quindi chiunque poteva mandare un avviso falso a nome di un
 * altro. Ora ogni canale ha un segreto casuale, salvato qui insieme all'utente:
 * l'avviso è accettato solo se riporta quel segreto.
 *
 * Chiave del documento: l'id del canale Google o l'id della subscription
 * Microsoft, cioè il valore che il provider rimanda in ogni avviso.
 */

export type ChannelProvider = 'google' | 'microsoft';

const COLLECTION = 'calendar_channels';

export function newChannelSecret(): string {
  return randomBytes(32).toString('base64url');
}

export function newChannelId(): string {
  return `unfract-${randomBytes(16).toString('hex')}`;
}

export async function saveChannel(
  channelId: string,
  data: { uid: string; provider: ChannelProvider; secret: string; expiresAt?: number | null }
): Promise<void> {
  await adminDb.collection(COLLECTION).doc(channelId).set({
    ...data,
    expiresAt: data.expiresAt ?? null,
    createdAt: Date.now(),
  });
}

function sameSecret(expected: string, received: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Restituisce l'utente del canale solo se provider e segreto corrispondono. */
export async function resolveChannel(
  channelId: string | null | undefined,
  provider: ChannelProvider,
  secret: string | null | undefined
): Promise<string | null> {
  if (!channelId || !secret || channelId.includes('/')) return null;
  const snapshot = await adminDb.collection(COLLECTION).doc(channelId).get();
  if (!snapshot.exists) return null;

  const data = snapshot.data() || {};
  if (data.provider !== provider || typeof data.secret !== 'string') return null;
  if (!sameSecret(data.secret, secret)) return null;
  return typeof data.uid === 'string' && data.uid ? data.uid : null;
}
