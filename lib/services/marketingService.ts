import { db } from '@/lib/firebase';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { EmailCampaign } from '@/types/marketing';

const CAMPAIGNS_COLLECTION = 'email_campaigns';

export async function createCampaign(projectId: string, name: string): Promise<string> {
  const ref = doc(collection(db, CAMPAIGNS_COLLECTION));
  await setDoc(ref, {
    projectId,
    name,
    status: 'draft',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return ref.id;
}

export async function getCampaign(id: string): Promise<EmailCampaign | null> {
  const snap = await getDoc(doc(db, CAMPAIGNS_COLLECTION, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as EmailCampaign;
}

export async function updateCampaign(id: string, data: Partial<EmailCampaign>): Promise<void> {
  await updateDoc(doc(db, CAMPAIGNS_COLLECTION, id), {
    ...data,
    updatedAt: serverTimestamp()
  });
}

export function subscribeToCampaigns(projectId: string, onUpdate: (campaigns: EmailCampaign[]) => void): () => void {
  const q = query(collection(db, CAMPAIGNS_COLLECTION), where('projectId', '==', projectId));
  return onSnapshot(q, (snap) => {
    onUpdate(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as EmailCampaign)));
  });
}

export async function deleteCampaign(id: string): Promise<void> {
  await deleteDoc(doc(db, CAMPAIGNS_COLLECTION, id));
}
