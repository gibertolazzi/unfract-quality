import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { canManageWorkspace } from '@/lib/server/usage';

/**
 * Cancellazione di progetti e organizzazioni, dal server.
 *
 * Prima il browser cancellava solo il documento del progetto: colonne, task,
 * ruoli e accessi restavano nel database senza più un progetto. Le
 * organizzazioni non si potevano cancellare affatto. Qui si cancella anche ciò
 * che dipende da loro, dopo aver controllato chi lo chiede.
 *
 * Restano, di proposito, i contenuti: documentazione, meeting, chat, chat AI,
 * CRM e file caricati.
 */

export const ID = /^[A-Za-z0-9_-]{1,128}$/;
const CHUNK = 400; // sotto il limite di 500 scritture per batch

export type DeleteResult =
  | { ok: true; deleted: number }
  | { ok: false; status: 400 | 403 | 404 | 409; error: string };

type Ref = FirebaseFirestore.DocumentReference;

async function refsWhere(collection: string, field: string, value: string): Promise<Ref[]> {
  const snap = await adminDb.collection(collection).where(field, '==', value).get();
  return snap.docs.map(d => d.ref);
}

async function deleteAll(refs: Ref[]): Promise<number> {
  const unique = Array.from(new Map(refs.map(r => [r.path, r])).values());
  for (let i = 0; i < unique.length; i += CHUNK) {
    const batch = adminDb.batch();
    unique.slice(i, i + CHUNK).forEach(ref => batch.delete(ref));
    await batch.commit();
  }
  return unique.length;
}

/** Lo cancella chi l'ha creato o un amministratore del suo workspace. */
export async function deleteProject(uid: string, projectId: string): Promise<DeleteResult> {
  if (!ID.test(projectId)) return { ok: false, status: 400, error: 'Progetto non valido.' };

  const projectRef = adminDb.collection('projects').doc(projectId);
  const project = (await projectRef.get()).data();
  if (!project) return { ok: false, status: 404, error: 'Progetto non trovato.' };

  const isCreator = project.userId === uid || project.creatorId === uid;
  const workspaceId = typeof project.workspaceId === 'string' ? project.workspaceId : '';
  if (!isCreator && !(workspaceId && await canManageWorkspace(uid, workspaceId))) {
    return { ok: false, status: 403, error: 'Solo chi ha creato il progetto o un amministratore del workspace può cancellarlo.' };
  }

  const linked = await Promise.all(
    ['columns', 'tasks', 'epics', 'project_members', 'project_roles', 'access_requests']
      .map(collection => refsWhere(collection, 'projectId', projectId)),
  );
  const grants = (await adminDb.collection('access_grants').where('resourceId', '==', projectId).get())
    .docs.filter(d => d.data().resourceType === 'project').map(d => d.ref);

  // Il progetto per ultimo: se qualcosa si interrompe, si può riprovare.
  const deleted = await deleteAll([...linked.flat(), ...grants]);
  await projectRef.delete();
  return { ok: true, deleted: deleted + 1 };
}

/**
 * La cancella solo chi la possiede, e solo quando il suo workspace non ha più
 * progetti: altrimenti resterebbero progetti senza workspace.
 */
export async function deleteOrganization(uid: string, orgId: string): Promise<DeleteResult> {
  if (!ID.test(orgId)) return { ok: false, status: 400, error: 'Organizzazione non valida.' };

  const orgRef = adminDb.collection('organizations').doc(orgId);
  const org = (await orgRef.get()).data();
  if (!org) return { ok: false, status: 404, error: 'Organizzazione non trovata.' };
  if (org.ownerId !== uid) {
    return { ok: false, status: 403, error: 'Solo chi possiede l’organizzazione può cancellarla.' };
  }

  const projects = await adminDb.collection('projects').where('workspaceId', '==', orgId).get();
  if (!projects.empty) {
    return {
      ok: false, status: 409,
      error: `Il workspace ha ancora ${projects.docs.length === 1 ? '1 progetto' : `${projects.docs.length} progetti`}: cancellali prima di cancellare l’organizzazione.`,
    };
  }

  // Progetti di altri workspace collegati a questa organizzazione: si scollegano.
  const linkedProjects = await adminDb.collection('projects').where('organizationIds', 'array-contains', orgId).get();
  for (let i = 0; i < linkedProjects.docs.length; i += CHUNK) {
    const batch = adminDb.batch();
    linkedProjects.docs.slice(i, i + CHUNK).forEach(d => batch.update(d.ref, { organizationIds: FieldValue.arrayRemove(orgId) }));
    await batch.commit();
  }

  const linked = await Promise.all([
    refsWhere('access_grants', 'workspaceId', orgId),
    refsWhere('workspace_groups', 'workspaceId', orgId),
    refsWhere('org_invites', 'orgId', orgId),
  ]);
  const deleted = await deleteAll([...linked.flat(), adminDb.collection('workspaces').doc(orgId)]);
  await orgRef.delete();
  return { ok: true, deleted: deleted + 1 };
}
