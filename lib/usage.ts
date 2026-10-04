import { doc, updateDoc, increment, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { WorkspaceQuotas } from '@/types/workspace';

// Helper to ensure the workspace has a quotas object initialized
async function ensureQuotasExist(workspaceId: string) {
  const wsRef = doc(db, 'workspaces', workspaceId);
  const snap = await getDoc(wsRef);
  if (snap.exists()) {
    const data = snap.data();
    if (!data.quotas) {
      await updateDoc(wsRef, {
        quotas: {
          planTier: 'free',
          storageUsed: 0,
          storageLimit: 1000000000, // 1GB default free
          aiCreditsUsed: 0,
          aiCreditsLimit: 120 // 120 default free
        }
      });
    }
  }
}

export async function incrementAiUsage(workspaceId: string, credits: number = 1) {
  if (!workspaceId) return;
  try {
    await ensureQuotasExist(workspaceId);
    const wsRef = doc(db, 'workspaces', workspaceId);
    await updateDoc(wsRef, {
      'quotas.aiCreditsUsed': increment(credits)
    });
  } catch (err) {
    console.error("Failed to increment AI usage:", err);
  }
}

export async function incrementStorageUsage(workspaceId: string, bytes: number) {
  if (!workspaceId || bytes <= 0) return;
  try {
    await ensureQuotasExist(workspaceId);
    const wsRef = doc(db, 'workspaces', workspaceId);
    await updateDoc(wsRef, {
      'quotas.storageUsed': increment(bytes)
    });
  } catch (err) {
    console.error("Failed to increment storage usage:", err);
  }
}
