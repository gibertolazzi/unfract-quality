/**
 * Migrazione dei dati per le regole per azienda (fase 2, passo 2).
 *
 * Le nuove regole di Firestore decidono chi vede cosa leggendo un solo
 * documento di accesso con ID fisso:
 *
 * - workspace:        `access_grants/<workspace>_<utente>`
 * - progetto:         `access_grants/<progetto>_<utente>`
 * - squadra:          `access_grants/<squadra>_<utente>`
 *
 * Oggi quasi tutti gli accessi hanno un ID casuale, e alcuni sono duplicati
 * (la vecchia migrazione nel browser li moltiplicava). Qui si calcola un piano:
 *
 * - accessi: uno per ID fisso, con il ruolo più alto fra i doppioni e la data
 *   di creazione più vecchia; gli altri si cancellano;
 * - organizzazioni: `memberUids` completo (lo usa l'elenco delle
 *   organizzazioni, PR #28) e un accesso al workspace per ogni membro;
 * - workspace mancanti delle organizzazioni: si creano;
 * - da decidere a mano, senza modifiche: progetti senza workspace, task con un
 *   workspace diverso da quello del progetto, accessi di chi non è più membro,
 *   documenti di progetti cancellati.
 *
 * Il piano non scrive niente; `applyTenantMigration` lo esegue. Rilanciato
 * dopo l'esecuzione, il piano risulta vuoto. Il database si passa come
 * argomento, come in `storageBackfill.ts`, così lo usano script e test.
 */

type Data = Record<string, any>;

type Db = {
  collection: (name: string) => {
    doc: (id: string) => {
      set: (data: Data) => Promise<unknown>;
      update: (data: Data) => Promise<unknown>;
      delete: () => Promise<unknown>;
    };
    get: () => Promise<{ docs: Array<{ id: string; data: () => Data | undefined }> }>;
  };
};

export interface GrantData {
  workspaceId: string;
  subjectType: string;
  subjectId: string;
  resourceType: string;
  resourceId: string;
  role: string;
  createdAt: unknown;
}

export interface TenantMigrationPlan {
  /** Accessi da scrivere con ID fisso: `from` sono gli ID che sostituiscono. */
  grantWrites: Array<{ id: string; data: GrantData; from: string[]; reason: 'normalize' | 'org-member' }>;
  /** Accessi da cancellare: ID casuali o doppioni, già confluiti in `grantWrites`. */
  grantDeletes: string[];
  /** Accessi illeggibili (campi mancanti): restano come sono. */
  invalidGrants: Array<{ id: string; reason: string }>;
  /** Utenti da aggiungere a `memberUids`, per organizzazione. */
  memberUids: Array<{ orgId: string; add: string[] }>;
  /** Workspace delle organizzazioni che non ce l'hanno. */
  workspaces: Array<{ id: string; data: Data }>;
  /** Da decidere a mano: il piano non li cambia. */
  review: {
    projectsWithoutWorkspace: Array<{ projectId: string; workspaceId: string | null }>;
    tasksWithOtherWorkspace: Array<{ taskId: string; projectId: string; taskWorkspaceId: string; projectWorkspaceId: string }>;
    grantsOfNonMembers: Array<{ grantId: string; orgId: string; uid: string }>;
    orphans: Record<string, string[]>;
  };
}

const ROLE_RANK: Record<string, number> = { admin: 3, editor: 2, member: 1, viewer: 0 };
const rank = (role: unknown) => ROLE_RANK[String(role)] ?? 0;

/** Collezioni legate a un progetto con `projectId`. */
export const PROJECT_LINKED = [
  'tasks', 'columns', 'epics', 'documentation', 'meetings', 'chats', 'ai_chats',
  'project_roles', 'project_members', 'crm_accounts', 'crm_audit', 'crm_followups',
] as const;

const DEFAULT_QUOTAS = { planTier: 'free', storageUsed: 0, storageLimit: 1_000_000_000, aiCreditsUsed: 0, aiCreditsLimit: 120 };

const text = (value: unknown) => (typeof value === 'string' && value ? value : null);

/** ID fisso di un accesso, o il motivo per cui non si può calcolare. */
export function grantKey(data: Data): { id: string } | { error: string } {
  const subjectId = text(data.subjectId);
  const resourceType = text(data.resourceType);
  const resourceId = text(data.resourceId);
  const workspaceId = text(data.workspaceId);
  if (!subjectId || !resourceType || !resourceId || !workspaceId) return { error: 'campi mancanti' };
  if (resourceType === 'workspace' && resourceId !== workspaceId) return { error: 'resourceId diverso da workspaceId' };
  return { id: `${resourceId}_${subjectId}` };
}

function millis(value: unknown): number {
  if (value && typeof value === 'object' && 'toMillis' in value && typeof (value as any).toMillis === 'function') return (value as any).toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') return Date.parse(value) || Infinity;
  return Infinity;
}

async function all(db: Db, name: string) {
  return (await db.collection(name).get()).docs.map(doc => ({ id: doc.id, data: doc.data() || {} }));
}

export async function planTenantMigration(db: Db, now: () => unknown = () => new Date()): Promise<TenantMigrationPlan> {
  const [grants, organizations, workspaces, projects] = await Promise.all(
    ['access_grants', 'organizations', 'workspaces', 'projects'].map(name => all(db, name)),
  );
  const plan: TenantMigrationPlan = {
    grantWrites: [], grantDeletes: [], invalidGrants: [], memberUids: [], workspaces: [],
    review: { projectsWithoutWorkspace: [], tasksWithOtherWorkspace: [], grantsOfNonMembers: [], orphans: {} },
  };

  // 1. Accessi: raggruppati per ID fisso.
  const groups = new Map<string, Array<{ id: string; data: Data }>>();
  for (const grant of grants) {
    const key = grantKey(grant.data);
    if ('error' in key) { plan.invalidGrants.push({ id: grant.id, reason: key.error }); continue; }
    groups.set(key.id, [...(groups.get(key.id) || []), grant]);
  }

  const finalGrants = new Map<string, GrantData>();
  for (const [id, group] of groups) {
    const best = group.reduce((a, b) => (rank(b.data.role) > rank(a.data.role) ? b : a));
    const oldest = group.reduce((a, b) => (millis(b.data.createdAt) < millis(a.data.createdAt) ? b : a));
    const data: GrantData = {
      workspaceId: best.data.workspaceId,
      subjectType: best.data.subjectType || 'user',
      subjectId: best.data.subjectId,
      resourceType: best.data.resourceType,
      resourceId: best.data.resourceId,
      role: text(best.data.role) || 'member',
      createdAt: oldest.data.createdAt ?? now(),
    };
    finalGrants.set(id, data);
    const current = group.find(grant => grant.id === id);
    const same = current
      && (Object.keys(data) as Array<keyof GrantData>).every(field => field === 'createdAt' || current.data[field] === data[field]);
    if (!same) plan.grantWrites.push({ id, data, from: group.map(grant => grant.id), reason: 'normalize' });
    plan.grantDeletes.push(...group.filter(grant => grant.id !== id).map(grant => grant.id));
  }

  // 2. Organizzazioni: memberUids, workspace e accesso di ogni membro.
  const workspaceIds = new Set(workspaces.map(ws => ws.id));
  for (const org of organizations) {
    const members: Data[] = Array.isArray(org.data.members) ? org.data.members : [];
    const memberUids: string[] = Array.isArray(org.data.memberUids) ? org.data.memberUids : [];
    const uids = members.map(member => text(member?.uid)).filter((uid): uid is string => !!uid);
    const add = uids.filter(uid => !memberUids.includes(uid));
    if (add.length) plan.memberUids.push({ orgId: org.id, add });

    if (!workspaceIds.has(org.id)) {
      plan.workspaces.push({
        id: org.id,
        data: {
          name: text(org.data.name) || 'Workspace',
          ownerId: text(org.data.ownerId),
          structureMode: 'teams',
          quotas: { ...DEFAULT_QUOTAS },
          createdAt: now(),
        },
      });
      workspaceIds.add(org.id);
    }

    for (const member of members) {
      const uid = text(member?.uid);
      if (!uid) continue;
      const id = `${org.id}_${uid}`;
      if (finalGrants.has(id)) continue;
      const role = member.role === 'admin' || org.data.ownerId === uid ? 'admin' : 'member';
      const data: GrantData = { workspaceId: org.id, subjectType: 'user', subjectId: uid, resourceType: 'workspace', resourceId: org.id, role, createdAt: now() };
      finalGrants.set(id, data);
      plan.grantWrites.push({ id, data, from: [], reason: 'org-member' });
    }

    const allMembers = new Set([...memberUids, ...uids]);
    for (const [id, grant] of finalGrants) {
      if (grant.resourceType === 'workspace' && grant.workspaceId === org.id && !allMembers.has(grant.subjectId)) {
        plan.review.grantsOfNonMembers.push({ grantId: id, orgId: org.id, uid: grant.subjectId });
      }
    }
  }

  // 3. Da decidere a mano.
  const projectWorkspace = new Map(projects.map(project => [project.id, text(project.data.workspaceId)]));
  for (const [projectId, workspaceId] of projectWorkspace) {
    if (!workspaceId || !workspaceIds.has(workspaceId)) plan.review.projectsWithoutWorkspace.push({ projectId, workspaceId });
  }
  for (const name of PROJECT_LINKED) {
    const docs = await all(db, name);
    const orphans = docs.filter(doc => !projectWorkspace.has(doc.data.projectId)).map(doc => doc.id);
    if (orphans.length) plan.review.orphans[name] = orphans;
    if (name !== 'tasks') continue;
    for (const task of docs) {
      const projectWs = projectWorkspace.get(task.data.projectId);
      const taskWs = text(task.data.workspaceId);
      if (taskWs && projectWs && taskWs !== projectWs) {
        plan.review.tasksWithOtherWorkspace.push({ taskId: task.id, projectId: task.data.projectId, taskWorkspaceId: taskWs, projectWorkspaceId: projectWs });
      }
    }
  }

  return plan;
}

/**
 * Esegue il piano. Prima scrive (workspace, memberUids, accessi con ID fisso),
 * poi cancella i vecchi accessi: se si interrompe a metà nessuno perde
 * l'accesso, e rilanciando il piano riprende da dove era rimasto.
 */
export async function applyTenantMigration(
  db: Db,
  plan: TenantMigrationPlan,
  arrayUnion: (...values: string[]) => unknown,
): Promise<{ workspaces: number; organizations: number; grantsWritten: number; grantsDeleted: number }> {
  for (const workspace of plan.workspaces) await db.collection('workspaces').doc(workspace.id).set(workspace.data);
  for (const org of plan.memberUids) await db.collection('organizations').doc(org.orgId).update({ memberUids: arrayUnion(...org.add) });
  for (const grant of plan.grantWrites) await db.collection('access_grants').doc(grant.id).set(grant.data as unknown as Data);
  for (const id of plan.grantDeletes) await db.collection('access_grants').doc(id).delete();
  return {
    workspaces: plan.workspaces.length,
    organizations: plan.memberUids.length,
    grantsWritten: plan.grantWrites.length,
    grantsDeleted: plan.grantDeletes.length,
  };
}
