import { describe, expect, it } from 'vitest';

import { createFakeDb } from '../helpers/fakeFirestore';
import { applyTenantMigration, grantKey, planTenantMigration } from '@/lib/server/tenantMigration';

const arrayUnion = (...values: string[]) => ({ __arrayUnion: values });
const NOW = 'ora';

function grant(workspaceId: string, uid: string, role: string, createdAt: string, extra: Record<string, unknown> = {}) {
  return { workspaceId, subjectType: 'user', subjectId: uid, resourceType: 'workspace', resourceId: workspaceId, role, createdAt, ...extra };
}

function seed() {
  const db = createFakeDb();
  const put = (path: string, data: Record<string, unknown>) => db.store.set(path, data);

  // Organizzazione con workspace: un membro con tre accessi casuali (doppioni),
  // uno senza accesso e senza memberUids, e un ex membro con un accesso.
  put('organizations/org1', {
    name: 'Acme', ownerId: 'anna', memberUids: ['anna'],
    members: [{ uid: 'anna', role: 'admin' }, { uid: 'bruno', role: 'member' }],
  });
  put('workspaces/org1', { name: 'Acme', ownerId: 'anna' });
  put('access_grants/rnd1', grant('org1', 'anna', 'member', '2026-09-02'));
  put('access_grants/rnd2', grant('org1', 'anna', 'admin', '2026-09-05'));
  put('access_grants/rnd3', grant('org1', 'anna', 'member', '2026-09-01'));
  put('access_grants/rnd4', grant('org1', 'carlo', 'member', '2026-09-03'));

  // Organizzazione senza workspace.
  put('organizations/org2', { name: 'Beta', ownerId: 'dora', memberUids: ['dora'], members: [{ uid: 'dora', role: 'admin' }] });

  // Workspace personale con l'accesso già a ID fisso: non cambia.
  put('workspaces/ws9', { name: 'Personale', ownerId: 'anna' });
  put('access_grants/ws9_anna', grant('ws9', 'anna', 'admin', '2026-09-01'));

  // Accesso a un progetto con ID casuale, e uno illeggibile.
  put('access_grants/rnd5', { workspaceId: 'org1', subjectType: 'user', subjectId: 'anna', resourceType: 'project', resourceId: 'p1', role: 'admin', createdAt: '2026-09-04' });
  put('access_grants/rotto', { subjectId: 'anna', role: 'admin' });

  // Progetti: uno a posto, uno con un workspace che non esiste.
  put('projects/p1', { workspaceId: 'org1' });
  put('projects/p2', { workspaceId: 'sparito' });
  put('tasks/t1', { projectId: 'p1', workspaceId: 'org1' });
  put('tasks/t2', { projectId: 'p1', workspaceId: 'ws9' });
  put('columns/c1', { projectId: 'cancellato' });
  return db;
}

describe('grantKey', () => {
  it('workspace, progetto e squadra hanno ID <risorsa>_<utente>', () => {
    expect(grantKey(grant('w', 'u', 'admin', ''))).toEqual({ id: 'w_u' });
    expect(grantKey({ workspaceId: 'w', subjectId: 'u', resourceType: 'project', resourceId: 'p' })).toEqual({ id: 'p_u' });
    expect(grantKey({ workspaceId: 'w', subjectId: 'u', resourceType: 'workspace_group', resourceId: 'g' })).toEqual({ id: 'g_u' });
  });

  it('rifiuta accessi incompleti o incoerenti', () => {
    expect(grantKey({ subjectId: 'u' })).toEqual({ error: 'campi mancanti' });
    expect(grantKey(grant('w', 'u', 'admin', '', { resourceId: 'altro' }))).toEqual({ error: 'resourceId diverso da workspaceId' });
  });
});

describe('planTenantMigration', () => {
  it('unisce i doppioni tenendo il ruolo più alto e la data più vecchia', async () => {
    const plan = await planTenantMigration(seed() as any, () => NOW);
    const anna = plan.grantWrites.find(write => write.id === 'org1_anna');
    expect(anna?.data).toMatchObject({ role: 'admin', createdAt: '2026-09-01', workspaceId: 'org1', resourceType: 'workspace' });
    expect(anna?.from.sort()).toEqual(['rnd1', 'rnd2', 'rnd3']);
    expect(plan.grantDeletes.sort()).toEqual(['rnd1', 'rnd2', 'rnd3', 'rnd4', 'rnd5']);
    expect(plan.grantWrites.find(write => write.id === 'p1_anna')?.data.resourceType).toBe('project');
  });

  it('non tocca gli accessi già a posto e segnala quelli illeggibili', async () => {
    const plan = await planTenantMigration(seed() as any, () => NOW);
    expect(plan.grantWrites.some(write => write.id === 'ws9_anna')).toBe(false);
    expect(plan.grantDeletes).not.toContain('ws9_anna');
    expect(plan.invalidGrants).toEqual([{ id: 'rotto', reason: 'campi mancanti' }]);
  });

  it('completa memberUids, il workspace mancante e gli accessi dei membri', async () => {
    const plan = await planTenantMigration(seed() as any, () => NOW);
    expect(plan.memberUids).toEqual([{ orgId: 'org1', add: ['bruno'] }]);
    expect(plan.workspaces).toEqual([{ id: 'org2', data: expect.objectContaining({ name: 'Beta', ownerId: 'dora' }) }]);
    expect(plan.grantWrites.find(write => write.id === 'org1_bruno')).toMatchObject({ reason: 'org-member', data: { role: 'member' } });
    expect(plan.grantWrites.find(write => write.id === 'org2_dora')).toMatchObject({ reason: 'org-member', data: { role: 'admin' } });
  });

  it('lascia a te le decisioni sui casi dubbi', async () => {
    const { review } = await planTenantMigration(seed() as any, () => NOW);
    expect(review.grantsOfNonMembers).toEqual([{ grantId: 'org1_carlo', orgId: 'org1', uid: 'carlo' }]);
    expect(review.projectsWithoutWorkspace).toEqual([{ projectId: 'p2', workspaceId: 'sparito' }]);
    expect(review.tasksWithOtherWorkspace).toEqual([{ taskId: 't2', projectId: 'p1', taskWorkspaceId: 'ws9', projectWorkspaceId: 'org1' }]);
    expect(review.orphans).toEqual({ columns: ['c1'] });
  });
});

describe('applyTenantMigration', () => {
  it('esegue il piano, e rilanciato dopo non trova più niente da fare', async () => {
    const db = seed();
    const result = await applyTenantMigration(db as any, await planTenantMigration(db as any, () => NOW), arrayUnion);
    expect(result).toEqual({ workspaces: 1, organizations: 1, grantsWritten: 5, grantsDeleted: 5 });

    expect(db.store.get('access_grants/org1_anna')).toMatchObject({ role: 'admin', createdAt: '2026-09-01' });
    expect(db.store.has('access_grants/rnd2')).toBe(false);
    expect(db.store.get('organizations/org1')?.memberUids).toEqual(['anna', 'bruno']);
    expect(db.store.get('workspaces/org2')).toMatchObject({ name: 'Beta', ownerId: 'dora' });

    const again = await planTenantMigration(db as any, () => NOW);
    expect(again.grantWrites).toEqual([]);
    expect(again.grantDeletes).toEqual([]);
    expect(again.memberUids).toEqual([]);
    expect(again.workspaces).toEqual([]);
  });
});
