import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where, writeBatch } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from './firebase';

/**
 * Organizzazione, workspace e accesso del creatore.
 *
 * Il workspace di un'organizzazione ha lo stesso ID dell'organizzazione, e chi
 * la crea riceve un `access_grants` di amministratore su quel workspace: è
 * quello che fa comparire l'organizzazione nel selettore dei workspace.
 *
 * Prima li creava `lib/workspaceMigration.ts`, che girava nel browser di
 * chiunque aprisse l'app e riscriveva workspace e accessi di tutte le aziende
 * (azzerando i contatori di consumo e duplicando gli accessi). Con le regole di
 * Firestore quella migrazione viene bloccata, quindi ora workspace e accesso
 * nascono insieme all'organizzazione.
 */

const DEFAULT_QUOTAS = {
  planTier: 'free',
  storageUsed: 0,
  storageLimit: 1_000_000_000,
  aiCreditsUsed: 0,
  aiCreditsLimit: 120,
} as const;

/** ID dell'accesso del creatore: fisso, così non si duplica. */
export function ownerGrantId(orgId: string, uid: string): string {
  return `${orgId}_${uid}`;
}

function ownerGrant(orgId: string, uid: string) {
  return {
    workspaceId: orgId,
    subjectType: 'user',
    subjectId: uid,
    resourceType: 'workspace',
    resourceId: orgId,
    role: 'admin',
    createdAt: serverTimestamp(),
  };
}

function newWorkspace(name: string, uid: string) {
  return {
    name,
    ownerId: uid,
    structureMode: 'teams',
    quotas: { ...DEFAULT_QUOTAS },
    createdAt: serverTimestamp(),
  };
}

/** Crea organizzazione, workspace e accesso del creatore in un'unica scrittura. */
export async function createOrganization(user: User, name: string): Promise<string> {
  const orgRef = doc(collection(db, 'organizations'));
  const batch = writeBatch(db);
  batch.set(orgRef, {
    name,
    ownerId: user.uid,
    memberUids: [user.uid],
    memberCount: 1,
    bannerGradient: 'from-[#0061FF] to-[#00D2FF]',
    members: [{
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || 'Utente',
      photoURL: user.photoURL || '',
      initials: (user.displayName || 'U').charAt(0).toUpperCase(),
      role: 'admin',
    }],
    createdAt: serverTimestamp(),
  });
  batch.set(doc(db, 'workspaces', orgRef.id), newWorkspace(name, user.uid));
  batch.set(doc(db, 'access_grants', ownerGrantId(orgRef.id, user.uid)), ownerGrant(orgRef.id, user.uid));
  await batch.commit();
  return orgRef.id;
}

/**
 * Per le organizzazioni create quando la vecchia migrazione era già bloccata:
 * se chi le possiede non ha ancora workspace o accesso, li aggiunge. Non
 * cambia un workspace che esiste già, salvo dargli il nome se manca.
 */
export async function ensureOwnedOrgWorkspace(org: { id: string; name?: string; ownerId?: string }, uid: string): Promise<void> {
  if (!org.id || org.ownerId !== uid) return;

  const grants = await getDocs(query(
    collection(db, 'access_grants'),
    where('subjectType', '==', 'user'),
    where('subjectId', '==', uid),
    where('resourceType', '==', 'workspace'),
  ));
  const hasGrant = grants.docs.some(grant => grant.data().workspaceId === org.id);

  const workspaceRef = doc(db, 'workspaces', org.id);
  const workspace = await getDoc(workspaceRef);
  const name = org.name || 'Workspace';
  if (!workspace.exists()) {
    await setDoc(workspaceRef, newWorkspace(name, uid));
  } else if (!workspace.data().name) {
    await setDoc(workspaceRef, { name }, { merge: true });
  }

  if (!hasGrant) {
    await setDoc(doc(db, 'access_grants', ownerGrantId(org.id, uid)), ownerGrant(org.id, uid));
  }
}
