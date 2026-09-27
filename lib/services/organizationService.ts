import { db } from '@/lib/firebase';
import { collection, doc, query, onSnapshot, updateDoc, arrayRemove } from 'firebase/firestore';
import { Organization } from '@/types/organization';

export const OrganizationService = {
  subscribe(userUid: string, callback: (orgs: Organization[]) => void) {
    const orgsRef = collection(db, 'organizations');
    const q = query(orgsRef);

    return onSnapshot(q, (snapshot) => {
      const fetchedOrgs: Organization[] = [];
      snapshot.forEach(doc => {
        const data = doc.data() as any;
        const isMember = data.members?.some((m: any) => m.uid === userUid);
        if (isMember) {
          fetchedOrgs.push({ id: doc.id, ...data } as Organization);
        }
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
