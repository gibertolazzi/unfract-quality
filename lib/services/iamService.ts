import { auth, db } from '@/lib/firebase';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, serverTimestamp, onSnapshot } from 'firebase/firestore';
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
    
    try {
      const { auth } = require('@/lib/firebase');
      const { createNotification } = require('./notificationService');
      const currentUser = auth.currentUser;
      if (currentUser) {
        createNotification({
          userId: currentUser.uid,
          title: 'Nuovo membro',
          description: `Un nuovo membro è stato assegnato al progetto con ruolo: ${roleId}`,
          type: 'organization',
          link: '/settings'
        });
      }
    } catch (e) {
      console.error("Error creating member notification:", e);
    }
  }
}

export async function getUserProjectAccess(projectId: string, userId: string): Promise<ProjectMemberAccess | null> {
  const memberId = `${projectId}_${userId}`;
  const memberSnap = await getDoc(doc(db, MEMBERS_COLLECTION, memberId));
  if (!memberSnap.exists()) return null;
  return { id: memberSnap.id, ...memberSnap.data() } as ProjectMemberAccess;
}

/**
 * Ruoli di un utente nei progetti indicati, aggiornati in tempo reale.
 *
 * Gli accessi hanno ID fisso (`<progetto>_<utente>`), quindi si leggono per
 * ID. Prima si cercavano per utente in tutta la collezione, cioè anche nei
 * progetti di altre aziende: con le regole per azienda quella ricerca non è
 * permessa.
 */
export function subscribeUserProjectAccess(
  projectIds: string[],
  userId: string,
  onChange: (accesses: ProjectMemberAccess[]) => void,
): () => void {
  if (projectIds.length === 0) {
    onChange([]);
    return () => {};
  }
  const found = new Map<string, ProjectMemberAccess | null>();
  const unsubscribes = projectIds.map(projectId =>
    onSnapshot(doc(db, MEMBERS_COLLECTION, `${projectId}_${userId}`), snapshot => {
      found.set(projectId, snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } as ProjectMemberAccess : null);
      // Risponde quando ogni progetto ha dato la sua prima risposta.
      if (found.size === projectIds.length) {
        onChange(Array.from(found.values()).filter((access): access is ProjectMemberAccess => access !== null));
      }
    }, error => {
      console.error('Unable to read project access:', error);
      found.set(projectId, null);
      if (found.size === projectIds.length) {
        onChange(Array.from(found.values()).filter((access): access is ProjectMemberAccess => access !== null));
      }
    }),
  );
  return () => unsubscribes.forEach(unsubscribe => unsubscribe());
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
      ...(auth.currentUser ? { senderId: auth.currentUser.uid } : {}),
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
