import { db } from '@/lib/firebase';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, serverTimestamp } from 'firebase/firestore';
import { CustomRole, ProjectMemberAccess, AccessRequest, AppModule, PermissionLevel } from '@/types/iam';

const ROLES_COLLECTION = 'project_roles';
const MEMBERS_COLLECTION = 'project_members';
const REQUESTS_COLLECTION = 'access_requests';

export async function createRole(projectId: string, name: string, permissions: Record<AppModule, PermissionLevel>): Promise<string> {
  const roleRef = doc(collection(db, ROLES_COLLECTION));
  await setDoc(roleRef, { projectId, name, permissions, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return roleRef.id;
}

export async function getProjectRoles(projectId: string): Promise<CustomRole[]> {
  const q = query(collection(db, ROLES_COLLECTION), where('projectId', '==', projectId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CustomRole));
}

export async function assignUserRole(projectId: string, userId: string, roleId: string): Promise<void> {
  const memberId = `${projectId}_${userId}`;
  if (roleId === 'none') {
    await deleteDoc(doc(db, MEMBERS_COLLECTION, memberId));
  } else {
    await setDoc(doc(db, MEMBERS_COLLECTION, memberId), { projectId, userId, roleId, assignedAt: serverTimestamp() });
  }
}

export async function getUserProjectAccess(projectId: string, userId: string): Promise<ProjectMemberAccess | null> {
  const memberId = `${projectId}_${userId}`;
  const memberSnap = await getDoc(doc(db, MEMBERS_COLLECTION, memberId));
  if (!memberSnap.exists()) return null;
  return { id: memberSnap.id, ...memberSnap.data() } as ProjectMemberAccess;
}

export async function requestModuleAccess(projectId: string, userId: string, module: AppModule, requestedLevel: 'read' | 'write'): Promise<void> {
  const requestRef = doc(collection(db, REQUESTS_COLLECTION));
  
  await setDoc(requestRef, {
    projectId,
    userId,
    module,
    requestedLevel,
    status: 'pending',
    createdAt: serverTimestamp()
  });

  // Fetch project to find the owner
  const projectSnap = await getDoc(doc(db, 'projects', projectId));
  if (projectSnap.exists()) {
    const ownerId = projectSnap.data().userId;
    
    // Create a notification for the owner
    const notifRef = doc(collection(db, 'notifications'));
    await setDoc(notifRef, {
      userId: ownerId,
      title: 'Nuova Richiesta di Accesso',
      description: `Un membro ha richiesto i permessi di ${requestedLevel === 'write' ? 'Scrittura' : 'Lettura'} per il modulo ${module.toUpperCase()}`,
      type: 'access_request',
      read: false,
      createdAt: serverTimestamp(),
      link: '/settings',
      metadata: {
        requestId: requestRef.id,
        projectId,
        requesterId: userId,
        module,
        requestedLevel
      }
    });
  }
}

export async function resolveAccessRequest(requestId: string, status: 'approved' | 'rejected'): Promise<void> {
  await setDoc(doc(db, REQUESTS_COLLECTION, requestId), { status, resolvedAt: serverTimestamp() }, { merge: true });
}
