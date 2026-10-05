import { doc, updateDoc, increment, runTransaction } from 'firebase/firestore';
import { db } from './firebase';
import { WorkspaceQuotas } from '@/types/workspace';

const currentCreditPeriod = () => {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
};

const defaultQuotas = (): WorkspaceQuotas => ({
  planTier: 'free',
  storageUsed: 0,
  storageLimit: 1_000_000_000,
  aiCreditsUsed: 0,
  aiCreditsLimit: 120,
  aiCreditsPeriod: currentCreditPeriod(),
});

// Backfill missing quota fields on legacy and partially initialized workspaces.
export async function ensureWorkspaceQuotas(workspaceId: string) {
  const wsRef = doc(db, 'workspaces', workspaceId);
  await runTransaction(db, async transaction => {
    const snap = await transaction.get(wsRef);
    if (!snap.exists()) throw new Error(`Workspace ${workspaceId} does not exist`);
    const current = snap.data().quotas || {};
    const defaults = defaultQuotas();
    const missing: Partial<WorkspaceQuotas> = {};
    (Object.keys(defaults) as Array<keyof WorkspaceQuotas>).forEach(key => {
      if (current[key] === undefined || current[key] === null) missing[key] = defaults[key] as never;
    });
    if (current.aiCreditsPeriod === undefined || current.aiCreditsPeriod === null) {
      missing.aiCreditsUsed = 0;
      missing.aiCreditsPeriod = defaults.aiCreditsPeriod;
    }
    if (Object.keys(missing).length) transaction.set(wsRef, { quotas: missing }, { merge: true });
  });
}

export async function incrementAiUsage(workspaceId: string, credits: number = 1): Promise<boolean> {
  if (!workspaceId || !Number.isFinite(credits) || credits <= 0) return false;
  try {
    await ensureWorkspaceQuotas(workspaceId);
    const wsRef = doc(db, 'workspaces', workspaceId);
    const period = currentCreditPeriod();
    await runTransaction(db, async transaction => {
      const snap = await transaction.get(wsRef);
      const quotas = snap.data()?.quotas || {};
      const used = quotas.aiCreditsPeriod === period ? Number(quotas.aiCreditsUsed) || 0 : 0;
      transaction.update(wsRef, {
        'quotas.aiCreditsUsed': used + credits,
        'quotas.aiCreditsPeriod': period,
      });
    });
    return true;
  } catch (err) {
    console.error("Failed to increment AI usage:", err);
    return false;
  }
}

export async function incrementStorageUsage(workspaceId: string, bytes: number): Promise<boolean> {
  if (!workspaceId || !Number.isFinite(bytes) || bytes <= 0) return false;
  try {
    await ensureWorkspaceQuotas(workspaceId);
    const wsRef = doc(db, 'workspaces', workspaceId);
    await updateDoc(wsRef, {
      'quotas.storageUsed': increment(bytes)
    });
    return true;
  } catch (err) {
    console.error("Failed to increment storage usage:", err);
    return false;
  }
}

export async function decrementStorageUsage(workspaceId: string, bytes: number): Promise<boolean> {
  if (!workspaceId || !Number.isFinite(bytes) || bytes <= 0) return false;
  try {
    await ensureWorkspaceQuotas(workspaceId);
    const wsRef = doc(db, 'workspaces', workspaceId);
    await runTransaction(db, async transaction => {
      const snap = await transaction.get(wsRef);
      const currentUsage = Number(snap.data()?.quotas?.storageUsed) || 0;
      transaction.update(wsRef, {
        'quotas.storageUsed': Math.max(0, currentUsage - bytes),
      });
    });
    return true;
  } catch (err) {
    console.error('Failed to decrement storage usage:', err);
    return false;
  }
}
