import { adminDb } from '@/lib/firebase-admin';
import { NO_PERMISSIONS, OWNER_PERMISSIONS, mergeRolePermissions } from '@/lib/iamPermissions';
import type { ModulePermissions } from '@/types/iam';

/**
 * Cosa può vedere un utente collegato via MCP.
 *
 * Il server MCP legge Firestore con l'accesso amministrativo: le regole di
 * Firestore non lo fermano. Per questo ogni controllo che le regole fanno per
 * il browser va rifatto qui, con lo stesso criterio (firestore.rules):
 * - fa parte di un workspace chi è in `organizations/{id}.memberUids` o ne è
 *   il proprietario (`workspaces/{id}.ownerId`);
 * - vede un progetto chi l'ha creato o fa parte del suo workspace.
 *
 * In più valgono i permessi per modulo dell'app (lib/iamPermissions.ts), che
 * le regole non controllano: senza il permesso «Task» un membro non vede le
 * task nemmeno nell'app.
 *
 * Un token MCP è legato a un solo workspace: i progetti degli altri workspace
 * non esistono, per l'assistente. I progetti nati prima dei workspace (senza
 * `workspaceId`) restano fuori.
 *
 * Un oggetto per richiesta: le letture si fanno una volta sola.
 */

const ID = /^[A-Za-z0-9_-]{1,128}$/;

export function validId(value: unknown): value is string {
  return typeof value === 'string' && ID.test(value);
}

export interface McpProject {
  id: string;
  name: string;
  workspaceId: string;
  permissions: ModulePermissions;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
}

/** Se l'utente fa parte del workspace, con lo stesso criterio delle regole. */
export async function inWorkspace(uid: string, workspaceId: string): Promise<boolean> {
  if (!uid || !validId(workspaceId)) return false;
  const [org, workspace] = await Promise.all([
    adminDb.collection('organizations').doc(workspaceId).get(),
    adminDb.collection('workspaces').doc(workspaceId).get(),
  ]);
  const memberUids = org.exists ? org.data()?.memberUids : null;
  if (Array.isArray(memberUids) && memberUids.includes(uid)) return true;
  return workspace.exists && workspace.data()?.ownerId === uid;
}

/** I workspace dell'utente: le organizzazioni di cui è membro e i workspace suoi. */
export async function userWorkspaces(uid: string): Promise<WorkspaceSummary[]> {
  if (!uid) return [];
  const [orgs, owned] = await Promise.all([
    adminDb.collection('organizations').where('memberUids', 'array-contains', uid).get(),
    adminDb.collection('workspaces').where('ownerId', '==', uid).get(),
  ]);
  const result = new Map<string, WorkspaceSummary>();
  for (const org of orgs.docs) {
    if (validId(org.id)) result.set(org.id, { id: org.id, name: String(org.data()?.name || 'Organizzazione') });
  }
  for (const ws of owned.docs) {
    if (validId(ws.id) && !result.has(ws.id)) result.set(ws.id, { id: ws.id, name: String(ws.data()?.name || 'Workspace personale') });
  }
  return Array.from(result.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export class McpAccess {
  private grantsPromise?: Promise<Array<Record<string, any>>>;
  private projectsPromise?: Promise<McpProject[]>;
  private memberPromise?: Promise<boolean>;

  constructor(readonly uid: string, readonly workspaceId: string) {}

  /** L'utente fa ancora parte del workspace del token. */
  member(): Promise<boolean> {
    this.memberPromise ??= inWorkspace(this.uid, this.workspaceId);
    return this.memberPromise;
  }

  private grants() {
    this.grantsPromise ??= adminDb.collection('access_grants').where('subjectId', '==', this.uid).get()
      .then(snap => snap.docs.map(doc => doc.data() || {}).filter(g => g.subjectType === 'user'));
    return this.grantsPromise;
  }

  /** Stesso calcolo di `contexts/IamContext.tsx`. */
  private async permissionsFor(projectId: string, project: Record<string, any>): Promise<ModulePermissions> {
    if (project.userId === this.uid) return OWNER_PERMISSIONS;
    const grants = await this.grants();
    const workspaceAdmin = grants.some(g =>
      g.resourceType === 'workspace' && g.resourceId === this.workspaceId && g.workspaceId === this.workspaceId && g.role === 'admin');
    if (workspaceAdmin) return OWNER_PERMISSIONS;

    const teamIds = new Set(grants.filter(g => g.resourceType === 'workspace_group').map(g => g.resourceId));
    const members = await adminDb.collection('project_members').where('projectId', '==', projectId).get();
    const roleIds = new Set<string>();
    for (const doc of members.docs) {
      const access = doc.data() || {};
      if ((access.userId === this.uid || teamIds.has(access.userId)) && validId(access.roleId)) roleIds.add(access.roleId);
    }
    if (roleIds.size === 0) return NO_PERMISSIONS;

    const roles = await Promise.all(Array.from(roleIds).map(id => adminDb.collection('project_roles').doc(id).get()));
    // Un ruolo di un altro progetto non vale qui.
    return mergeRolePermissions(roles.filter(r => r.exists && r.data()?.projectId === projectId).map(r => r.data()?.permissions));
  }

  /** I progetti del workspace che l'utente vede, con i suoi permessi. */
  projects(): Promise<McpProject[]> {
    this.projectsPromise ??= (async () => {
      if (!(await this.member())) return [];
      const snap = await adminDb.collection('projects').where('workspaceId', '==', this.workspaceId).get();
      const projects = await Promise.all(snap.docs.map(async doc => {
        const data = doc.data() || {};
        if (!validId(doc.id) || data.workspaceId !== this.workspaceId) return null;
        return {
          id: doc.id,
          name: String(data.name || data.title || 'Progetto'),
          workspaceId: this.workspaceId,
          permissions: await this.permissionsFor(doc.id, data),
        } satisfies McpProject;
      }));
      return projects.filter((p): p is McpProject => !!p).sort((a, b) => a.name.localeCompare(b.name));
    })();
    return this.projectsPromise;
  }

  /** Il progetto, se l'utente lo vede in questo workspace. */
  async project(projectId: unknown): Promise<McpProject | null> {
    if (!validId(projectId)) return null;
    return (await this.projects()).find(p => p.id === projectId) || null;
  }
}
