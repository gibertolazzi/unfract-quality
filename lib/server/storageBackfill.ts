import { createHash } from 'node:crypto';

/**
 * Conteggio retroattivo dello spazio dei file.
 *
 * Il server conta i file dalla PR #14: quelli caricati prima non hanno un
 * record in `storage_usage`, quindi cancellarli non libera spazio, e il
 * contatore del workspace era quello scritto dal browser (non affidabile).
 * Qui si assegna ogni file di Storage al suo workspace, dal percorso:
 *
 * - `organizations/{orgId}/…`               → il workspace con lo stesso id
 * - `ai-hub|meetings|documentation|crm/{projectId}/…` → il workspace del progetto
 * - `chats/{chatId}/…`                      → il workspace del progetto della chat
 * - `tasks/{projectId}/…`                   → il workspace del progetto
 * - `tasks/attachments/…` (prima del 10/10)  → il workspace del progetto del task che lo allega
 *
 * Poi si ricalcola `storageUsed` di ogni workspace come somma dei suoi record.
 * Nessuna dipendenza da `lib/firebase-admin`: il database si passa come
 * argomento, così lo usano sia lo script sia i test.
 */

/** Id del record di un file in `storage_usage`. */
export function storageRecordId(path: string): string {
  return createHash('sha256').update(path).digest('hex');
}

export interface StoredObject {
  path: string;
  bytes: number;
}

export interface BackfillPlan {
  /** File con il loro workspace. */
  records: Array<StoredObject & { workspaceId: string }>;
  /** File che non si riescono ad assegnare: restano fuori dal conteggio. */
  unassigned: Array<StoredObject & { reason: string }>;
  /** Byte per workspace dopo il ricalcolo (solo i file assegnati). */
  totals: Record<string, number>;
}

type Db = {
  collection: (name: string) => {
    doc: (id: string) => { get: () => Promise<{ exists: boolean; data: () => Record<string, any> | undefined }> };
    get: () => Promise<{ docs: Array<{ id: string; data: () => Record<string, any> }> }>;
  };
};

const PROJECT_FOLDERS = new Set(['ai-hub', 'meetings', 'documentation', 'crm']);

export async function planStorageBackfill(db: Db, objects: StoredObject[]): Promise<BackfillPlan> {
  const projectWorkspace = new Map<string, string | null>();
  const workspaceOf = async (projectId: string | undefined): Promise<string | null> => {
    if (!projectId) return null;
    if (!projectWorkspace.has(projectId)) {
      const snap = await db.collection('projects').doc(projectId).get();
      const ws = snap.data()?.workspaceId;
      projectWorkspace.set(projectId, typeof ws === 'string' && ws ? ws : null);
    }
    return projectWorkspace.get(projectId) ?? null;
  };

  // Gli allegati dei task non hanno il progetto nel percorso: lo dice il task.
  let attachmentProjects: Map<string, string> | null = null;
  const attachmentProject = async (path: string) => {
    if (!attachmentProjects) {
      attachmentProjects = new Map();
      for (const task of (await db.collection('tasks').get()).docs) {
        const data = task.data();
        for (const attachment of Array.isArray(data.attachments) ? data.attachments : []) {
          if (typeof attachment?.refPath === 'string' && typeof data.projectId === 'string') {
            attachmentProjects.set(attachment.refPath, data.projectId);
          }
        }
      }
    }
    return attachmentProjects.get(path);
  };

  const plan: BackfillPlan = { records: [], unassigned: [], totals: {} };
  for (const object of objects) {
    const [folder, id] = object.path.split('/');
    let workspaceId: string | null = null;
    let reason = 'cartella sconosciuta';

    if (folder === 'organizations') {
      workspaceId = id && (await db.collection('workspaces').doc(id).get()).exists ? id : null;
      reason = 'organizzazione senza workspace';
    } else if (folder === 'tasks' && id && id !== 'attachments') {
      workspaceId = await workspaceOf(id);
      reason = 'progetto inesistente o senza workspace';
    } else if (PROJECT_FOLDERS.has(folder)) {
      workspaceId = await workspaceOf(id);
      reason = 'progetto inesistente o senza workspace';
    } else if (folder === 'chats') {
      const chat = id ? (await db.collection('chats').doc(id).get()).data() : undefined;
      workspaceId = await workspaceOf(chat?.projectId);
      reason = 'chat inesistente o senza progetto';
    } else if (object.path.startsWith('tasks/attachments/')) {
      workspaceId = await workspaceOf(await attachmentProject(object.path));
      reason = 'nessun task allega questo file';
    }

    if (workspaceId) {
      plan.records.push({ ...object, workspaceId });
      plan.totals[workspaceId] = (plan.totals[workspaceId] || 0) + object.bytes;
    } else {
      plan.unassigned.push({ ...object, reason });
    }
  }
  return plan;
}

/**
 * Scrive i record mancanti e ricalcola `storageUsed` di tutti i workspace
 * dalla somma dei record (quelli nuovi e quelli scritti dal server dopo la #14).
 */
export async function applyStorageBackfill(
  db: any,
  plan: BackfillPlan,
  now: () => unknown = () => new Date().toISOString()
): Promise<{ created: number; workspaces: Record<string, number> }> {
  let created = 0;
  for (const record of plan.records) {
    const ref = db.collection('storage_usage').doc(storageRecordId(record.path));
    if ((await ref.get()).exists) continue;
    await ref.set({ path: record.path, workspaceId: record.workspaceId, bytes: record.bytes, uid: null, backfilled: true, createdAt: now() });
    created += 1;
  }

  const sums: Record<string, number> = {};
  for (const record of (await db.collection('storage_usage').get()).docs) {
    const data = record.data();
    if (typeof data.workspaceId === 'string') sums[data.workspaceId] = (sums[data.workspaceId] || 0) + (Number(data.bytes) || 0);
  }

  const workspaces: Record<string, number> = {};
  for (const workspace of (await db.collection('workspaces').get()).docs) {
    const quotas = workspace.data().quotas || {};
    const used = sums[workspace.id] || 0;
    workspaces[workspace.id] = used;
    if ((quotas.storageUsed ?? 0) !== used) {
      await db.collection('workspaces').doc(workspace.id).set({ quotas: { ...quotas, storageUsed: used } }, { merge: true });
    }
  }
  return { created, workspaces };
}
