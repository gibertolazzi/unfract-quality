import { db } from '@/lib/firebase';
import { collection, doc, query, where, onSnapshot, updateDoc, arrayRemove } from 'firebase/firestore';
import { Organization } from '@/types/organization';

export const OrganizationService = {
  subscribe(userUid: string, callback: (orgs: Organization[]) => void) {
    // Solo le organizzazioni di cui l'utente fa parte. Prima le scaricava
    // tutte e filtrava qui: ogni utente riceveva i membri di ogni azienda.
    const q = query(collection(db, 'organizations'), where('memberUids', 'array-contains', userUid));

    return onSnapshot(q, (snapshot) => {
      const fetchedOrgs: Organization[] = [];
      snapshot.forEach(doc => {
        fetchedOrgs.push({ id: doc.id, ...doc.data() } as Organization);
      });
      callback(fetchedOrgs);
    }, (error) => {
      console.error("Error fetching organizations:", error);
      callback([]);
    });
  },

  async update(orgId: string, updates: Partial<Organization>) {
    return await updateDoc(doc(db, 'organizations', orgId), updates);
  },

  async removeProject(orgId: string, projectId: string) {
    return await updateDoc(doc(db, 'projects', projectId), {
      organizationIds: arrayRemove(orgId)
    });
  }
};
