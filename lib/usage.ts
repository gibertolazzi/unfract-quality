import { deleteObject, ref } from 'firebase/storage';
import { storage } from './firebase';
import { authedFetch } from './authedFetch';

/**
 * Contatori di consumo dal browser: non li scrive più il browser.
 *
 * I crediti AI li conta il server quando chiama il modello. Per lo spazio, il
 * browser dice al server quale file ha caricato o cancellato, e il server ne
 * legge la dimensione vera da Storage (vedi `lib/server/usage.ts`).
 */

/**
 * Spazio del workspace esaurito: il server ha rifiutato il file e l'ha già
 * cancellato da Storage. Il messaggio è pronto da mostrare all'utente.
 */
export class StorageLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageLimitError';
  }
}

/** Il messaggio per l'utente: quello dello spazio esaurito, altrimenti `fallback`. */
export function uploadErrorMessage(error: unknown, fallback: string): string {
  return error instanceof StorageLimitError ? error.message : fallback;
}

async function storageUsage(body: Record<string, string>): Promise<boolean> {
  try {
    const response = await authedFetch('/api/usage/storage', { method: 'POST', body: JSON.stringify(body) });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      if (response.status === 413) throw new StorageLimitError(data.error || 'Spazio esaurito per questo workspace.');
      console.error('Spazio usato non aggiornato:', data.error || response.status);
    }
    return response.ok;
  } catch (error) {
    if (error instanceof StorageLimitError) throw error;
    console.error('Spazio usato non aggiornato:', error);
    return false;
  }
}

/**
 * Dopo un caricamento: il file conta nello spazio del workspace.
 * Se lo spazio è finito lancia `StorageLimitError` (il file non c'è più).
 */
export async function trackUpload(workspaceId: string | null | undefined, storagePath: string): Promise<boolean> {
  if (!workspaceId || !storagePath) return false;
  return storageUsage({ action: 'track', workspaceId, path: storagePath });
}

/** Cancella un file e, se era conteggiato, lo toglie dallo spazio del workspace. */
export async function deleteStoredFile(
  storagePath: string,
  options: { workspaceId?: string; bytes?: number; usageTracked?: boolean } = {}
): Promise<void> {
  if (!storagePath) return;
  try {
    await deleteObject(ref(storage, storagePath));
  } catch (error) {
    if ((error as { code?: string })?.code !== 'storage/object-not-found') throw error;
  }
  // Il server toglie i byte solo se il file non c'è più e non l'ha già fatto.
  if (options.usageTracked) await storageUsage({ action: 'release', path: storagePath });
}
