import { adminDb } from '@/lib/firebase-admin';

/**
 * Se l'utente può lavorare su un progetto.
 *
 * Stesso criterio del client (`WorkspaceContext` e `ProjectContext`): un
 * progetto appartiene a un workspace, e l'utente lo vede se ha un
 * `access_grants` su quel workspace. I progetti creati prima dei workspace
 * non hanno `workspaceId`: lì vale chi li ha creati.
 *
 * Finché le regole di Firestore restano aperte (segnalazione S02) chiunque
 * può scriversi un `access_grants`: questo controllo diventa solido insieme
 * alle nuove regole.
 */
export async function canAccessProject(uid: string, projectId: string): Promise<boolean> {
  if (!uid || !projectId || !/^[A-Za-z0-9_-]{1,128}$/.test(projectId)) return false;

  const project = await adminDb.collection('projects').doc(projectId).get();
  if (!project.exists) return false;
  const data = project.data() || {};

  if (data.userId === uid || data.creatorId === uid) return true;
  if (typeof data.workspaceId !== 'string' || !data.workspaceId) return false;

  const grants = await adminDb.collection('access_grants')
    .where('subjectId', '==', uid)
    .get();
  return grants.docs.some(grant => {
    const g = grant.data();
    return g.subjectType === 'user' && g.resourceType === 'workspace' && g.workspaceId === data.workspaceId;
  });
}
