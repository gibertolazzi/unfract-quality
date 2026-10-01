import { db } from './firebase';
import { collection, getDocs, doc, setDoc, writeBatch, serverTimestamp, query, where } from 'firebase/firestore';
import { Organization } from '@/types/organization';
import { Project } from '@/contexts/ProjectContext';
import { AccessGrant, Workspace } from '@/types/workspace';

export async function migrateToWorkspaces(): Promise<void> {
  const migrationKey = `unfract_workspace_migration_done_v1`;
  if (typeof window !== 'undefined' && localStorage.getItem(migrationKey)) {
    console.log("[Migration] Workspace migration already completed.");
    return;
  }

  console.log("[Migration] Starting Workspace Migration...");

  try {
    // 1. Migrate Organizations to Workspaces
    const orgsSnapshot = await getDocs(collection(db, 'organizations'));
    const workspacesBatch = writeBatch(db);
    const grantsBatch = writeBatch(db);
    let grantsCount = 0;

    const orgs: Organization[] = [];
    orgsSnapshot.forEach(d => {
      orgs.push({ id: d.id, ...d.data() } as Organization);
    });

    for (const org of orgs) {
      const workspaceRef = doc(db, 'workspaces', org.id);
      
      const workspaceData: any = {
        name: org.name,
        ownerId: org.ownerId,
        structureMode: 'teams', // Legacy orgs default to teams mode
        createdAt: org.createdAt || serverTimestamp(),
      };
      
      if (org.bannerGradient) workspaceData.bannerGradient = org.bannerGradient;
      if (org.bannerUrl) workspaceData.bannerUrl = org.bannerUrl;
      if (org.logoUrl) workspaceData.logoUrl = org.logoUrl;

      // We use setDoc in a batch
      workspacesBatch.set(workspaceRef, workspaceData, { merge: true });

      // Create Workspace Access Grants for each member
      if (org.members && Array.isArray(org.members)) {
        for (const member of org.members) {
          const grantRef = doc(collection(db, 'access_grants'));
          const grantData: Partial<AccessGrant> = {
            workspaceId: org.id,
            subjectType: 'user',
            subjectId: member.uid,
            resourceType: 'workspace',
            resourceId: org.id,
            role: member.role || 'member',
            createdAt: serverTimestamp(),
          };
          grantsBatch.set(grantRef, grantData);
          grantsCount++;
        }
      }
    }

    await workspacesBatch.commit();
    if (grantsCount > 0) {
      await grantsBatch.commit();
    }
    console.log(`[Migration] Migrated ${orgs.length} organizations to workspaces and created ${grantsCount} access grants.`);

    // 2. Migrate Projects to Workspaces
    const projectsSnapshot = await getDocs(collection(db, 'projects'));
    const projectsBatch = writeBatch(db);
    const projGrantsBatch = writeBatch(db);
    let projGrantsCount = 0;

    const projects: Project[] = [];
    projectsSnapshot.forEach(d => {
      projects.push({ id: d.id, ...d.data() } as Project);
    });

    // Helper to create a personal workspace for users without orgs
    const getOrCreatePersonalWorkspace = async (userId: string, userName: string = 'Personal') => {
      const q = query(collection(db, 'workspaces'), where('ownerId', '==', userId), where('structureMode', '==', 'flat'));
      const snap = await getDocs(q);
      if (!snap.empty) {
        return snap.docs[0].id;
      }
      // Create new
      const newWsRef = doc(collection(db, 'workspaces'));
      await setDoc(newWsRef, {
        name: `${userName} Workspace`,
        ownerId: userId,
        structureMode: 'flat',
        createdAt: serverTimestamp(),
      });
      // Grant admin
      const grantRef = doc(collection(db, 'access_grants'));
      await setDoc(grantRef, {
        workspaceId: newWsRef.id,
        subjectType: 'user',
        subjectId: userId,
        resourceType: 'workspace',
        resourceId: newWsRef.id,
        role: 'admin',
        createdAt: serverTimestamp(),
      });
      return newWsRef.id;
    };

    for (const proj of projects) {
      let workspaceId = '';

      if (proj.organizationIds && proj.organizationIds.length > 0) {
        // Link to the first organization
        workspaceId = proj.organizationIds[0];
      } else {
        // Create personal workspace if needed
        workspaceId = await getOrCreatePersonalWorkspace(proj.userId, "Personal");
      }

      const projRef = doc(db, 'projects', proj.id);
      projectsBatch.update(projRef, {
        workspaceId: workspaceId,
        creatorId: proj.userId,
      });

      // Grant the creator direct admin access to the project
      const grantRef = doc(collection(db, 'access_grants'));
      projGrantsBatch.set(grantRef, {
        workspaceId: workspaceId,
        subjectType: 'user',
        subjectId: proj.userId,
        resourceType: 'project',
        resourceId: proj.id,
        role: 'admin',
        createdAt: serverTimestamp()
      });
      projGrantsCount++;
    }

    // Nota: in produzione servirebbe un chunking (max 500 op per batch). 
    // Per ora assumiamo un volume modesto.
    await projectsBatch.commit();
    await projGrantsBatch.commit();
    
    console.log(`[Migration] Migrated ${projects.length} projects and created ${projGrantsCount} project grants.`);

    if (typeof window !== 'undefined') {
      localStorage.setItem(migrationKey, 'true');
    }
    
    console.log("[Migration] Workspace Migration Complete!");

  } catch (error) {
    console.error("[Migration] Error during workspace migration:", error);
  }
}
