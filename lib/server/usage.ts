import { createHash } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { canAccessProject } from '@/lib/server/projectAccess';

/**
 * Contatori di consumo dei workspace (crediti AI e spazio dei file), dal server.
 *
 * Prima li aggiornava il browser, quindi chiunque poteva azzerarli o gonfiarli
 * (segnalazione N09). Ora:
 * - i crediti AI li conta la route che chiama il modello, sul workspace del
 *   progetto per cui lavora;
 * - lo spazio si conta per file: il server legge la dimensione vera da Storage
 *   e la registra una volta sola in `storage_usage`; quando il file non c'è
 *   più, la toglie.
 * Le regole di Firestore non permettono più al browser di scrivere i contatori.
 */

export const DEFAULT_QUOTAS = {
  planTier: 'free',
  storageUsed: 0,
  storageLimit: 1_000_000_000,
  aiCreditsUsed: 0,
  aiCreditsLimit: 120,
} as const;

export function creditPeriod(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

const ID = /^[A-Za-z0-9_-]{1,128}$/;

/**
 * Per le route AI: se l'utente può lavorare sul progetto e su quale workspace
 * contare il credito (`null` per i progetti nati prima dei workspace).
 */
export async function aiProjectWorkspace(uid: string, projectId: unknown): Promise<{ allowed: boolean; workspaceId: string | null }> {
  if (typeof projectId !== 'string' || !(await canAccessProject(uid, projectId))) return { allowed: false, workspaceId: null };
  const workspaceId = (await adminDb.collection('projects').doc(projectId).get()).data()?.workspaceId;
  return { allowed: true, workspaceId: typeof workspaceId === 'string' && ID.test(workspaceId) ? workspaceId : null };
}

/** Se l'utente fa parte del workspace (accesso o proprietario). */
export async function canUseWorkspace(uid: string, workspaceId: string): Promise<boolean> {
  if (!uid || !ID.test(workspaceId)) return false;
  const workspace = await adminDb.collection('workspaces').doc(workspaceId).get();
  if (!workspace.exists) return false;
  if (workspace.data()?.ownerId === uid) return true;
  const grants = await adminDb.collection('access_grants').where('subjectId', '==', uid).get();
  return grants.docs.some(grant => {
    const g = grant.data();
    return g.subjectType === 'user' && g.resourceType === 'workspace' && g.workspaceId === workspaceId;
  });
}

/** Quote complete: i campi mancanti prendono il valore predefinito. */
function withDefaults(quotas: Record<string, any> | undefined) {
  const q = { ...DEFAULT_QUOTAS, ...(quotas || {}) } as Record<string, any>;
  for (const [key, value] of Object.entries(DEFAULT_QUOTAS)) {
    if (q[key] === undefined || q[key] === null) q[key] = value;
  }
  return q;
}

/** Aggiunge crediti AI al mese in corso. Non blocca nulla: conta soltanto. */
export async function addAiCredits(workspaceId: string, credits = 1, now = new Date()): Promise<void> {
  if (!ID.test(workspaceId) || !(credits > 0)) return;
  const ref = adminDb.collection('workspaces').doc(workspaceId);
  const period = creditPeriod(now);
  await adminDb.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const quotas = withDefaults(snap.data()?.quotas);
    const used = quotas.aiCreditsPeriod === period ? Number(quotas.aiCreditsUsed) || 0 : 0;
    tx.set(ref, { quotas: { ...quotas, aiCreditsUsed: used + credits, aiCreditsPeriod: period } }, { merge: true });
  });
}

/** Conta un credito senza far fallire la risposta all'utente. */
export async function countAiCall(workspaceId: string | null): Promise<void> {
  if (!workspaceId) return;
  try {
    await addAiCredits(workspaceId, 1);
  } catch (error) {
    console.error('Credito AI non registrato:', error instanceof Error ? error.message : error);
  }
}

// ------------------------------------------------------------------ spazio dei file

/** Cartelle in cui l'app carica file (le stesse delle regole di Storage). */
const STORAGE_PATH = /^(organizations|meetings|documentation|tasks\/attachments|chats|ai-hub|crm)\/[^\s]{1,900}$/;

export function validStoragePath(path: string): boolean {
  return STORAGE_PATH.test(path) && !path.includes('..') && !path.includes('//');
}

const recordId = (path: string) => createHash('sha256').update(path).digest('hex');

/**
 * Dimensione del file su Storage, letta con il token dell'utente: valgono le
 * regole di Storage, e il server non ha bisogno di altri permessi.
 * `null` se il file non esiste.
 */
export async function storedFileSize(path: string, idToken: string, bucket: string): Promise<number | null> {
  const url = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(path)}`;
  const response = await fetch(url, { headers: { Authorization: `Firebase ${idToken}` }, cache: 'no-store' });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Storage metadata ${response.status}`);
  const size = Number((await response.json())?.size);
  if (!Number.isFinite(size) || size < 0) throw new Error('Storage metadata without size');
  return size;
}

export type UsageResult =
  | { ok: true; bytes: number }
  | { ok: false; status: 400 | 403 | 404 | 409; error: string };

/** Registra un file appena caricato e ne somma la dimensione. Ripeterlo non conta due volte. */
export async function trackStoredFile(input: {
  uid: string; workspaceId: string; path: string; idToken: string; bucket: string;
}): Promise<UsageResult> {
  if (!validStoragePath(input.path)) return { ok: false, status: 400, error: 'Percorso non valido.' };
  if (!(await canUseWorkspace(input.uid, input.workspaceId))) {
    return { ok: false, status: 403, error: 'Non fai parte di questo workspace.' };
  }

  const recordRef = adminDb.collection('storage_usage').doc(recordId(input.path));
  const existing = (await recordRef.get()).data();
  if (existing) return { ok: true, bytes: Number(existing.bytes) || 0 };

  const bytes = await storedFileSize(input.path, input.idToken, input.bucket);
  if (bytes === null) return { ok: false, status: 404, error: 'File non trovato.' };

  const workspaceRef = adminDb.collection('workspaces').doc(input.workspaceId);
  await adminDb.runTransaction(async tx => {
    const record = await tx.get(recordRef);
    if (record.exists) return;
    const workspace = await tx.get(workspaceRef);
    const quotas = withDefaults(workspace.data()?.quotas);
    tx.set(recordRef, { path: input.path, workspaceId: input.workspaceId, bytes, uid: input.uid, createdAt: FieldValue.serverTimestamp() });
    tx.set(workspaceRef, { quotas: { ...quotas, storageUsed: (Number(quotas.storageUsed) || 0) + bytes } }, { merge: true });
  });
  return { ok: true, bytes };
}

/** Toglie dal conteggio un file che non c'è più. Se esiste ancora, non tocca nulla. */
export async function releaseStoredFile(input: {
  uid: string; path: string; idToken: string; bucket: string;
}): Promise<UsageResult> {
  if (!validStoragePath(input.path)) return { ok: false, status: 400, error: 'Percorso non valido.' };

  const recordRef = adminDb.collection('storage_usage').doc(recordId(input.path));
  const record = (await recordRef.get()).data();
  // File caricati prima del conteggio dal server: non ci sono byte da togliere.
  if (!record) return { ok: true, bytes: 0 };

  if ((await storedFileSize(input.path, input.idToken, input.bucket)) !== null) {
    return { ok: false, status: 409, error: 'Il file esiste ancora.' };
  }

  const workspaceRef = adminDb.collection('workspaces').doc(String(record.workspaceId));
  let released = 0;
  await adminDb.runTransaction(async tx => {
    const current = await tx.get(recordRef);
    if (!current.exists) return;
    const workspace = await tx.get(workspaceRef);
    released = Number(current.data()?.bytes) || 0;
    if (workspace.exists) {
      const quotas = withDefaults(workspace.data()?.quotas);
      tx.set(workspaceRef, { quotas: { ...quotas, storageUsed: Math.max(0, (Number(quotas.storageUsed) || 0) - released) } }, { merge: true });
    }
    tx.delete(recordRef);
  });
  return { ok: true, bytes: released };
}
