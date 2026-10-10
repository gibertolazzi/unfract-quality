import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { canAccessProject } from '@/lib/server/projectAccess';
import { PLAN_QUOTAS, type PlanTier } from '@/lib/stripe/plans';
import { storageRecordId as recordId } from '@/lib/server/storageBackfill';

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
 *
 * I limiti del piano si applicano qui: finiti i crediti del mese le route AI
 * rispondono 402, e un file che supera lo spazio viene rifiutato e cancellato.
 */

export const DEFAULT_QUOTAS = {
  planTier: 'free',
  storageUsed: 0,
  storageLimit: PLAN_QUOTAS.free.storageLimit,
  aiCreditsUsed: 0,
  aiCreditsLimit: PLAN_QUOTAS.free.aiCreditsLimit,
} as const;

export const AI_CREDITS_EXHAUSTED =
  'Crediti AI esauriti per questo mese. Si ricaricano il primo del mese, oppure passa a un piano superiore.';
export const STORAGE_FULL =
  'Spazio esaurito per questo workspace: il file non è stato salvato. Libera spazio o passa a un piano superiore.';

export function creditPeriod(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

const ID = /^[A-Za-z0-9_-]{1,128}$/;

/**
 * Per le route AI: se l'utente può lavorare sul progetto, su quale workspace
 * contare il credito (`null` per i progetti nati prima dei workspace) e se i
 * crediti del mese sono finiti.
 */
export async function aiProjectWorkspace(
  uid: string,
  projectId: unknown,
  now = new Date()
): Promise<{ allowed: boolean; workspaceId: string | null; outOfCredits: boolean }> {
  if (typeof projectId !== 'string' || !(await canAccessProject(uid, projectId))) {
    return { allowed: false, workspaceId: null, outOfCredits: false };
  }
  const raw = (await adminDb.collection('projects').doc(projectId).get()).data()?.workspaceId;
  const workspaceId = typeof raw === 'string' && ID.test(raw) ? raw : null;
  return { allowed: true, workspaceId, outOfCredits: workspaceId ? await aiCreditsExhausted(workspaceId, now) : false };
}

/** Crediti del mese finiti. Un workspace che non esiste non ha limiti da applicare. */
export async function aiCreditsExhausted(workspaceId: string, now = new Date()): Promise<boolean> {
  const snap = await adminDb.collection('workspaces').doc(workspaceId).get();
  if (!snap.exists) return false;
  const quotas = withDefaults(snap.data()?.quotas);
  const used = quotas.aiCreditsPeriod === creditPeriod(now) ? Number(quotas.aiCreditsUsed) || 0 : 0;
  return used >= Number(quotas.aiCreditsLimit);
}

/** Proprietario o amministratore del workspace: può gestirne piano e contenuti. */
export async function canManageWorkspace(uid: string, workspaceId: string): Promise<boolean> {
  if (!uid || !ID.test(workspaceId)) return false;
  const workspace = (await adminDb.collection('workspaces').doc(workspaceId).get()).data();
  if (!workspace) return false;
  if (workspace.ownerId === uid) return true;
  const grants = await adminDb.collection('access_grants').where('subjectId', '==', uid).get();
  return grants.docs.some(grant => {
    const g = grant.data();
    return g.subjectType === 'user' && g.resourceType === 'workspace' && g.workspaceId === workspaceId && g.role === 'admin';
  });
}

/**
 * Applica i limiti di un piano al workspace, lasciando stare i contatori.
 * `billing` tiene il collegamento con l'abbonamento Stripe.
 */
export async function applyWorkspacePlan(
  workspaceId: string,
  tier: PlanTier | null,
  billing: Record<string, unknown>,
  options: { onlySubscription?: string } = {}
): Promise<boolean> {
  if (!ID.test(workspaceId)) return false;
  const ref = adminDb.collection('workspaces').doc(workspaceId);
  return adminDb.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists) return false;
    const current = snap.data() || {};
    // Un evento di un abbonamento vecchio non tocca quello nuovo.
    if (options.onlySubscription && current.billing?.stripeSubscriptionId !== options.onlySubscription) return false;
    const quotas = withDefaults(current.quotas);
    tx.set(ref, {
      quotas: tier ? { ...quotas, planTier: tier, ...PLAN_QUOTAS[tier] } : quotas,
      billing: { ...(current.billing || {}), ...billing, updatedAt: new Date().toISOString() },
    }, { merge: true });
    return true;
  });
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

/**
 * Cartelle in cui l'app carica file (le stesse delle regole di Storage). Gli
 * spazi sono ammessi: allegati, documenti e AI Hub tengono il nome originale
 * del file («Foto 1.png»). Esclusi solo i caratteri di controllo.
 */
const STORAGE_PATH = /^(organizations|meetings|documentation|tasks|chats|ai-hub|crm)\/[^\x00-\x1f\x7f]{1,900}$/;

export function validStoragePath(path: string): boolean {
  return STORAGE_PATH.test(path) && !path.includes('..') && !path.includes('//');
}

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

/** Cancella un file da Storage con il token dell'utente (valgono le regole di Storage). */
export async function deleteStorageObject(path: string, idToken: string, bucket: string): Promise<boolean> {
  const url = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(path)}`;
  const response = await fetch(url, { method: 'DELETE', headers: { Authorization: `Firebase ${idToken}` }, cache: 'no-store' });
  return response.ok || response.status === 404;
}

export type UsageResult =
  | { ok: true; bytes: number }
  | { ok: false; status: 400 | 403 | 404 | 409 | 413; error: string };

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
  const outcome = await adminDb.runTransaction(async tx => {
    const record = await tx.get(recordRef);
    if (record.exists) return 'tracked' as const;
    const workspace = await tx.get(workspaceRef);
    const quotas = withDefaults(workspace.data()?.quotas);
    const used = Number(quotas.storageUsed) || 0;
    if (used + bytes > Number(quotas.storageLimit)) return 'full' as const;
    tx.set(recordRef, { path: input.path, workspaceId: input.workspaceId, bytes, uid: input.uid, createdAt: FieldValue.serverTimestamp() });
    tx.set(workspaceRef, { quotas: { ...quotas, storageUsed: used + bytes } }, { merge: true });
    return 'tracked' as const;
  });

  if (outcome === 'full') {
    // Il file è già su Storage: senza conteggio non deve restarci.
    if (!(await deleteStorageObject(input.path, input.idToken, input.bucket))) {
      console.error('Storage full: unable to delete rejected upload', input.path);
    }
    return { ok: false, status: 413, error: STORAGE_FULL };
  }
  return { ok: true, bytes };
}

/**
 * Toglie dal conteggio file che il server ha appena cancellato (progetti e
 * organizzazioni cancellati, lib/server/deletions.ts). Restituisce i byte tolti.
 */
export async function releaseRemovedFiles(paths: string[]): Promise<number> {
  let released = 0;
  for (const path of paths) {
    const recordRef = adminDb.collection('storage_usage').doc(recordId(path));
    await adminDb.runTransaction(async tx => {
      const record = await tx.get(recordRef);
      if (!record.exists) return;
      const bytes = Number(record.data()?.bytes) || 0;
      const workspaceRef = adminDb.collection('workspaces').doc(String(record.data()?.workspaceId));
      const workspace = await tx.get(workspaceRef);
      if (workspace.exists) {
        const quotas = withDefaults(workspace.data()?.quotas);
        tx.set(workspaceRef, { quotas: { ...quotas, storageUsed: Math.max(0, (Number(quotas.storageUsed) || 0) - bytes) } }, { merge: true });
      }
      tx.delete(recordRef);
      released += bytes;
    });
  }
  return released;
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
