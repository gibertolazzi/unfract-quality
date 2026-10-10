import { FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { adminDb } from '@/lib/firebase-admin';
import { canManageWorkspace, releaseRemovedFiles } from '@/lib/server/usage';

/**
 * Cancellazione di progetti e organizzazioni, dal server.
 *
 * Prima il browser cancellava solo il documento del progetto: colonne, task,
 * ruoli e accessi restavano nel database senza più un progetto. Le
 * organizzazioni non si potevano cancellare affatto. Qui si cancella anche ciò
 * che dipende da loro, dopo aver controllato chi lo chiede.
 *
 * Di un progetto si cancella tutto: i dati di ogni collezione con il suo
 * `projectId` (le stesse delle regole di Firestore), le chat con i loro
 * messaggi, le chat AI e i file su Storage, che si tolgono anche dallo spazio
 * usato del workspace. Prima restavano documentazione, meeting, chat, chat AI,
 * CRM e file: dati orfani che nessuno poteva più aprire.
 */

export const ID = /^[A-Za-z0-9_-]{1,128}$/;
const CHUNK = 400; // sotto il limite di 500 scritture per batch

/** Le collezioni con `projectId` (vedi `projectCollections()` in firestore.rules), più le chat AI. */
export const PROJECT_COLLECTIONS = [
  'tasks', 'columns', 'epics', 'documentation', 'documents', 'meetings',
  'project_roles', 'project_members', 'access_requests', 'email_campaigns',
  'crm_accounts', 'crm_audit', 'crm_communications', 'crm_company_profiles',
  'crm_contacts', 'crm_custom_lists', 'crm_customers', 'crm_documents',
  'crm_followups', 'crm_interactions', 'crm_leads', 'crm_opportunities',
  'crm_prospect_exclusions', 'crm_prospect_reports', 'crm_prospect_searches',
  'crm_prospect_sources', 'crm_saved_views',
  'ai_chats',
] as const;

/** Cartelle di Storage con il progetto nel percorso (vedi storage.rules). */
const PROJECT_FOLDERS = ['meetings', 'documentation', 'tasks', 'ai-hub', 'crm'];

export type DeleteResult =
  | { ok: true; deleted: number }
  | { ok: false; status: 400 | 403 | 404 | 409; error: string };

type Ref = FirebaseFirestore.DocumentReference;

async function refsWhere(collection: string, field: string, value: string): Promise<Ref[]> {
  const snap = await adminDb.collection(collection).where(field, '==', value).get();
  return snap.docs.map(d => d.ref);
}

function bucket() {
  return getStorage().bucket(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || undefined);
}

/** File sotto le cartelle indicate, più quelli indicati per nome. */
async function filesToDelete(prefixes: string[], extra: string[]): Promise<string[]> {
  const listed = await Promise.all(prefixes.map(prefix => bucket().getFiles({ prefix }).then(([files]) => files.map(f => f.name))));
  return Array.from(new Set([...listed.flat(), ...extra]));
}

async function deleteFiles(paths: string[]): Promise<void> {
  for (let i = 0; i < paths.length; i += 50) {
    await Promise.all(paths.slice(i, i + 50).map(path => bucket().file(path).delete({ ignoreNotFound: true })));
  }
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

  const linked = await Promise.all(PROJECT_COLLECTIONS.map(collection => adminDb.collection(collection).where('projectId', '==', projectId).get()));
  const chats = await adminDb.collection('chats').where('projectId', '==', projectId).get();
  const messages = await Promise.all(chats.docs.map(chat => refsWhere('messages', 'chatId', chat.id)));
  const grants = (await adminDb.collection('access_grants').where('resourceId', '==', projectId).get())
    .docs.filter(d => d.data().resourceType === 'project').map(d => d.ref);

  // Allegati dei task caricati prima del 10 ottobre, senza il progetto nel percorso.
  const tasks = linked[PROJECT_COLLECTIONS.indexOf('tasks')].docs;
  const legacyAttachments = tasks.flatMap(task => (task.data().attachments || []) as { refPath?: unknown }[])
    .map(attachment => attachment.refPath)
    .filter((path): path is string => typeof path === 'string' && path.startsWith('tasks/attachments/'));
  const files = await filesToDelete(
    [...PROJECT_FOLDERS.map(folder => `${folder}/${projectId}/`), ...chats.docs.map(chat => `chats/${chat.id}/`)],
    legacyAttachments,
  );

  // Prima i file (e il loro spazio), poi i documenti, il progetto per ultimo:
  // se qualcosa si interrompe, si può riprovare.
  await deleteFiles(files);
  await releaseRemovedFiles(files);
  const deleted = await deleteAll([
    ...linked.flatMap(snap => snap.docs.map(d => d.ref)), ...messages.flat(), ...chats.docs.map(d => d.ref), ...grants,
  ]);
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

  // Banner e logo.
  const files = await filesToDelete([`organizations/${orgId}/`], []);
  await deleteFiles(files);
  await releaseRemovedFiles(files);

  const linked = await Promise.all([
    refsWhere('access_grants', 'workspaceId', orgId),
    refsWhere('workspace_groups', 'workspaceId', orgId),
    refsWhere('org_invites', 'orgId', orgId),
  ]);
  const deleted = await deleteAll([...linked.flat(), adminDb.collection('workspaces').doc(orgId)]);
  await orgRef.delete();
  return { ok: true, deleted: deleted + 1 };
}
