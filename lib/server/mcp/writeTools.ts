import { randomBytes } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import itDictionary from '@/lib/i18n/locales/it.json';
import { formatMessage } from '@/lib/i18n/formatMessage';
import { canWriteModule } from '@/lib/iamPermissions';
import {
  columnCategory, completedAtUpdate, displayColumnId, entryBlock, firstColumnOf, moveBlock, sortColumns, type MoveBlock, type MoveContext,
} from '@/lib/taskWorkflow';
import { inWorkspace, validId, type McpProject } from '@/lib/server/mcp/access';
import { notifyAssignment, notifyRequester, type Actor } from '@/lib/server/mcp/notify';

/**
 * Le modifiche che un assistente può fare (permesso «write»): creare una
 * task, cambiarne i campi, spostarla di colonna, commentarla. Niente
 * cancellazioni.
 *
 * Valgono le stesse regole dell'app:
 * - permesso «Task» in scrittura sul progetto (lib/iamPermissions.ts);
 * - transizioni e condizioni del flusso (lib/taskWorkflow.ts), con «admin»
 *   = permesso «Impostazioni» in scrittura, come nella bacheca;
 * - assegnatario e richiedente ricevono le notifiche (lib/server/mcp/notify.ts).
 *
 * Ogni task toccata porta `lastModifiedVia` (e `createdVia` se nuova) con il
 * nome dell'app: si vede che l'ha fatto un assistente.
 */

export interface WriteContext {
  uid: string;
  workspaceId: string;
  clientName: string;
  project(projectId: unknown): Promise<McpProject | null>;
  names(): Promise<Map<string, string>>;
}

export type WriteOutcome = { data?: unknown; error?: string; projectId?: string };

const NOT_FOUND = 'Non trovato, oppure non hai il permesso di vederlo.';
const NO_WRITE = 'Non hai il permesso di modificare le task di questo progetto.';
const t = itDictionary.tasks;

const BLOCK_TEXT: Record<MoveBlock, string> = {
  transition: t.moveBlockTransition,
  assignee: t.moveBlockAssignee,
  dueDate: t.moveBlockDueDate,
  assigneeOnly: t.moveBlockAssigneeOnly,
  adminOnly: t.moveBlockAdminOnly,
};

async function columnsOf(projectId: string) {
  const snap = await adminDb.collection('columns').where('projectId', '==', projectId).get();
  return sortColumns(snap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) })));
}

function blockMessage(block: MoveBlock, columns: any[], fromId: string | null | undefined, toId: string) {
  const name = (id?: string | null) => columns.find(c => c.id === id)?.title || '';
  return `${formatMessage(BLOCK_TEXT[block], { from: name(fromId), to: name(toId) })} (regola del flusso di lavoro)`;
}

async function actorOf(ctx: WriteContext): Promise<Actor> {
  return { uid: ctx.uid, name: (await ctx.names()).get(ctx.uid) || 'Utente', clientName: ctx.clientName };
}

const via = (ctx: WriteContext) => ({ type: 'mcp', client: ctx.clientName.slice(0, 80), at: new Date().toISOString() });

/** Il progetto, se l'utente può scriverci le task. */
async function writableProject(ctx: WriteContext, projectId: unknown): Promise<{ project: McpProject; error?: undefined } | { project?: undefined; error: string }> {
  const project = await ctx.project(projectId);
  if (!project) return { error: NOT_FOUND };
  if (!canWriteModule(project.permissions, 'tasks')) return { error: NO_WRITE };
  return { project };
}

/** La task e il suo progetto, se l'utente può modificarla. */
type Writable =
  | { error: string; task?: undefined }
  | { error?: undefined; ref: FirebaseFirestore.DocumentReference; task: any; project: McpProject };

async function writableTask(ctx: WriteContext, taskId: unknown): Promise<Writable> {
  if (!validId(taskId)) return { error: NOT_FOUND };
  const ref = adminDb.collection('tasks').doc(taskId);
  const snap = await ref.get();
  const task = snap.exists ? { id: snap.id, ...(snap.data() as any) } : null;
  if (!task || !validId(task.projectId)) return { error: NOT_FOUND };
  const { project, error } = await writableProject(ctx, task.projectId);
  if (!project) return { error: error || NOT_FOUND };
  return { ref, task, project };
}

/** Assegnatario: «me», un membro del workspace, oppure null per toglierlo. */
async function resolveAssignee(ctx: WriteContext, raw: string | null | undefined): Promise<{ uid: string | null; name: string | null } | { error: string }> {
  if (raw === null) return { uid: null, name: null };
  const uid = raw === 'me' ? ctx.uid : raw;
  if (!uid || !validId(uid) || !(await inWorkspace(uid, ctx.workspaceId))) {
    return { error: 'L’assegnatario deve essere un membro del workspace (usa list_people per gli uid).' };
  }
  return { uid, name: (await ctx.names()).get(uid) || null };
}

async function validEpic(projectId: string, epicId: string | null | undefined): Promise<boolean> {
  if (epicId === null || epicId === undefined) return true;
  if (!validId(epicId)) return false;
  return (await adminDb.collection('epics').doc(epicId).get()).data()?.projectId === projectId;
}

const moveContext = (ctx: WriteContext, project: McpProject): MoveContext =>
  ({ uid: ctx.uid, isAdmin: canWriteModule(project.permissions, 'settings') });

// ------------------------------------------------------------ Strumenti

export async function createTask(ctx: WriteContext, args: {
  projectId: string; title: string; description?: string; priority?: string; due?: string;
  assigneeUid?: string; columnId?: string; epicId?: string;
}): Promise<WriteOutcome> {
  const { project, error } = await writableProject(ctx, args.projectId);
  if (!project) return { error };
  const columns = await columnsOf(project.id);
  const column = args.columnId
    ? columns.find(c => c.id === args.columnId)
    : firstColumnOf(columns, 'todo') ?? columns[0];
  if (!column) return { error: args.columnId ? 'Colonna non trovata in questo progetto (vedi get_board).' : 'Il progetto non ha colonne.' };

  const assignee = args.assigneeUid ? await resolveAssignee(ctx, args.assigneeUid) : { uid: null, name: null };
  if ('error' in assignee) return { error: assignee.error, projectId: project.id };
  if (!(await validEpic(project.id, args.epicId))) return { error: 'Epic non trovata in questo progetto.', projectId: project.id };

  const draft = { columnId: null, assigneeUid: assignee.uid, date: args.due ?? null };
  const block = entryBlock(draft, column, moveContext(ctx, project));
  if (block) return { error: blockMessage(block, columns, null, column.id), projectId: project.id };

  const ref = adminDb.collection('tasks').doc();
  const task = {
    title: args.title.trim(),
    description: args.description?.trim() || '',
    priority: args.priority || 'Medium',
    category: 'General',
    columnId: column.id,
    epicId: args.epicId || null,
    date: args.due || null,
    assigneeUid: assignee.uid,
    assignee: assignee.name,
    projectId: project.id,
    workspaceId: ctx.workspaceId,
    requesterUid: ctx.uid,
    createdBy: ctx.uid,
    lastModifiedBy: ctx.uid,
    createdVia: via(ctx),
    lastModifiedVia: via(ctx),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    order: 999,
    assignees: 1,
    comments: [],
    attachments: [],
    mentions: [],
    ...(columnCategory(column) === 'done' ? { completedAt: new Date().toISOString() } : {}),
  };
  await ref.set(task);
  await notifyAssignment(assignee.uid, task, ref.id, await actorOf(ctx));
  return { projectId: project.id, data: { created: true, taskId: ref.id, column: column.title, assignee: assignee.name } };
}

export async function updateTask(ctx: WriteContext, args: {
  taskId: string; title?: string; description?: string; priority?: string; due?: string | null;
  assigneeUid?: string | null; epicId?: string | null;
}): Promise<WriteOutcome> {
  const found = await writableTask(ctx, args.taskId);
  if (found.error !== undefined) return { error: found.error };
  const { ref, task, project } = found;

  const changes: Record<string, unknown> = {};
  if (args.title !== undefined) changes.title = args.title.trim();
  if (args.description !== undefined) changes.description = args.description.trim();
  if (args.priority !== undefined) changes.priority = args.priority;
  if (args.due !== undefined) changes.date = args.due;
  if (args.epicId !== undefined) {
    if (!(await validEpic(project.id, args.epicId))) return { error: 'Epic non trovata in questo progetto.', projectId: project.id };
    changes.epicId = args.epicId;
  }
  let newAssignee: string | null = null;
  if (args.assigneeUid !== undefined) {
    const assignee = await resolveAssignee(ctx, args.assigneeUid);
    if ('error' in assignee) return { error: assignee.error, projectId: project.id };
    changes.assigneeUid = assignee.uid;
    changes.assignee = assignee.name;
    if (assignee.uid !== task.assigneeUid) newAssignee = assignee.uid;
  }
  if (Object.keys(changes).length === 0) return { error: 'Nessuna modifica indicata.', projectId: project.id };

  await ref.update({ ...changes, lastModifiedBy: ctx.uid, lastModifiedVia: via(ctx), updatedAt: FieldValue.serverTimestamp() });
  const actor = await actorOf(ctx);
  const updated = { ...task, ...changes };
  await notifyAssignment(newAssignee, updated, task.id, actor);
  await notifyRequester(updated, task.id, actor, 'La task per cui hai fatto richiesta è stata aggiornata.');
  return { projectId: project.id, data: { updated: true, taskId: task.id, fields: Object.keys(changes).filter(k => k !== 'assignee') } };
}

export async function moveTask(ctx: WriteContext, args: { taskId: string; columnId: string }): Promise<WriteOutcome> {
  const found = await writableTask(ctx, args.taskId);
  if (found.error !== undefined) return { error: found.error };
  const { ref, task, project } = found;
  const columns = await columnsOf(project.id);
  const target = columns.find(c => c.id === args.columnId);
  if (!target) return { error: 'Colonna non trovata in questo progetto (vedi get_board).', projectId: project.id };
  if (task.columnId === target.id) return { projectId: project.id, data: { moved: false, reason: 'La task è già in questa colonna.' } };

  const block = moveBlock(task, target.id, columns, moveContext(ctx, project));
  if (block) return { error: blockMessage(block, columns, task.columnId, target.id), projectId: project.id };

  // In fondo alla colonna, come la bacheca (components/tasks/TaskBoard.tsx).
  const siblings = await adminDb.collection('tasks').where('projectId', '==', project.id).get();
  const last = siblings.docs
    .map(doc => doc.data() || {})
    .filter(other => displayColumnId(other, columns) === target.id)
    .reduce((max, other) => Math.max(max, Number(other.order) || 0), -1);
  await ref.update({
    columnId: target.id,
    order: last + 1,
    ...completedAtUpdate(task, target.id, columns),
    lastModifiedBy: ctx.uid,
    lastModifiedVia: via(ctx),
    updatedAt: FieldValue.serverTimestamp(),
  });
  await notifyRequester(task, task.id, await actorOf(ctx), 'La task per cui hai fatto richiesta è stata aggiornata.');
  return { projectId: project.id, data: { moved: true, taskId: task.id, column: target.title, status: columnCategory(target) } };
}

export async function addComment(ctx: WriteContext, args: { taskId: string; text: string }): Promise<WriteOutcome> {
  const found = await writableTask(ctx, args.taskId);
  if (found.error !== undefined) return { error: found.error };
  const { ref, task, project } = found;
  const actor = await actorOf(ctx);
  const comment = {
    id: `${Date.now()}${randomBytes(3).toString('hex')}`,
    text: args.text.trim(),
    author: actor.name,
    authorUid: ctx.uid,
    mentions: [],
    createdAt: new Date().toISOString(),
    via: via(ctx),
  };
  await ref.update({ comments: FieldValue.arrayUnion(comment), lastModifiedBy: ctx.uid, lastModifiedVia: via(ctx), updatedAt: FieldValue.serverTimestamp() });
  await notifyRequester(task, task.id, actor, 'È stato aggiunto un commento alla task.');
  return { projectId: project.id, data: { commented: true, taskId: task.id } };
}
