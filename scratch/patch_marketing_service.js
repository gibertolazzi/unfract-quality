const fs = require('fs');
const path = 'lib/services/marketingService.ts';
let content = fs.readFileSync(path, 'utf8');

const importTarget = "import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, serverTimestamp } from 'firebase/firestore';";
const importReplacement = "import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, serverTimestamp, onSnapshot } from 'firebase/firestore';";
if (content.includes(importTarget)) {
  content = content.replace(importTarget, importReplacement);
}

const additions = `
export function subscribeToCampaigns(projectId: string, onUpdate: (campaigns: EmailCampaign[]) => void): () => void {
  const q = query(collection(db, CAMPAIGNS_COLLECTION), where('projectId', '==', projectId));
  return onSnapshot(q, (snap) => {
    onUpdate(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as EmailCampaign)));
  });
}

export async function deleteCampaign(id: string): Promise<void> {
  await deleteDoc(doc(db, CAMPAIGNS_COLLECTION, id));
}
`;

content += additions;

fs.writeFileSync(path, content);
