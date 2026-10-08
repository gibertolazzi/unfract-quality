import { beforeEach, describe, expect, it, vi } from 'vitest';
import { jsonRequest } from '../helpers/fakeFirestore';

const mocks = vi.hoisted(() => ({
  verifyIdToken: vi.fn(),
  db: undefined as any,
}));

vi.mock('@/lib/firebase-admin', async () => {
  const { createFakeDb } = await import('../helpers/fakeFirestore');
  mocks.db = createFakeDb();
  return { adminAuth: { verifyIdToken: mocks.verifyIdToken }, adminDb: mocks.db };
});
vi.mock('firebase-admin/firestore', () => ({
  FieldValue: { arrayRemove: (...values: unknown[]) => ({ __arrayRemove: values }) },
}));
vi.mock('@/lib/server/rateLimit', () => ({ tooManyRequests: () => false }));

const AUTH = { Authorization: 'Bearer good' };
const as = (uid: string) => mocks.verifyIdToken.mockResolvedValue({ uid, email: `${uid}@example.com` });
const has = (path: string) => mocks.db.store.has(path);

async function call(route: 'projects' | 'organizations', body: unknown, uid: string) {
  as(uid);
  const { POST } = route === 'projects'
    ? await import('@/app/api/projects/delete/route')
    : await import('@/app/api/organizations/delete/route');
  const response = await POST(jsonRequest(`http://localhost/api/${route}/delete`, body, AUTH));
  return { status: response.status, body: await response.json() };
}

beforeEach(async () => {
  await import('@/lib/firebase-admin');
  const s = mocks.db.store;
  s.clear();
  mocks.verifyIdToken.mockReset();
  s.set('workspaces/w1', { name: 'Acme', ownerId: 'anna' });
  s.set('access_grants/w1_anna', { subjectType: 'user', subjectId: 'anna', resourceType: 'workspace', workspaceId: 'w1', role: 'admin' });
  s.set('access_grants/w1_bruno', { subjectType: 'user', subjectId: 'bruno', resourceType: 'workspace', workspaceId: 'w1', role: 'member' });
  s.set('access_grants/w1_carla', { subjectType: 'user', subjectId: 'carla', resourceType: 'workspace', workspaceId: 'w1', role: 'admin' });
  s.set('projects/p1', { name: 'Sito', userId: 'anna', creatorId: 'anna', workspaceId: 'w1' });
  s.set('columns/c1', { projectId: 'p1', title: 'To Do' });
  s.set('columns/c2', { projectId: 'p1', title: 'Done' });
  s.set('tasks/t1', { projectId: 'p1', title: 'Task' });
  s.set('epics/e1', { projectId: 'p1' });
  s.set('project_members/p1_bruno', { projectId: 'p1', userId: 'bruno' });
  s.set('project_roles/r1', { projectId: 'p1', name: 'Editor' });
  s.set('access_requests/q1', { projectId: 'p1', status: 'pending' });
  s.set('access_grants/p1_anna', { subjectType: 'user', subjectId: 'anna', resourceType: 'project', resourceId: 'p1', workspaceId: 'w1' });
  s.set('documentation/d1', { projectId: 'p1', title: 'Doc' });
  s.set('columns/altro', { projectId: 'p2', title: 'To Do' });
});

describe('cancellazione di un progetto', () => {
  it('chi l’ha creato lo cancella insieme a colonne, task, ruoli e accessi', async () => {
    const res = await call('projects', { projectId: 'p1' }, 'anna');
    expect(res.status).toBe(200);
    for (const path of ['projects/p1', 'columns/c1', 'columns/c2', 'tasks/t1', 'epics/e1', 'project_members/p1_bruno',
      'project_roles/r1', 'access_requests/q1', 'access_grants/p1_anna']) {
      expect(has(path), path).toBe(false);
    }
    // Restano i contenuti, gli altri progetti e l'accesso al workspace.
    expect(has('documentation/d1')).toBe(true);
    expect(has('columns/altro')).toBe(true);
    expect(has('access_grants/w1_anna')).toBe(true);
  });

  it('un amministratore del workspace può cancellarlo', async () => {
    expect((await call('projects', { projectId: 'p1' }, 'carla')).status).toBe(200);
    expect(has('projects/p1')).toBe(false);
  });

  it('un membro semplice o un estraneo no, e non si tocca nulla', async () => {
    const member = await call('projects', { projectId: 'p1' }, 'bruno');
    expect(member.status).toBe(403);
    expect(member.body.error).toMatch(/amministratore/);
    expect((await call('projects', { projectId: 'p1' }, 'zeno')).status).toBe(403);
    expect(has('projects/p1')).toBe(true);
    expect(has('columns/c1')).toBe(true);
  });

  it('ID non valido o progetto inesistente', async () => {
    expect((await call('projects', { projectId: '../users/anna' }, 'anna')).status).toBe(400);
    expect((await call('projects', { projectId: 'nessuno' }, 'anna')).status).toBe(404);
  });

  it('senza login: 401', async () => {
    const { POST } = await import('@/app/api/projects/delete/route');
    const response = await POST(jsonRequest('http://localhost/api/projects/delete', { projectId: 'p1' }));
    expect(response.status).toBe(401);
    expect(has('projects/p1')).toBe(true);
  });
});

describe('cancellazione di un’organizzazione', () => {
  beforeEach(() => {
    const s = mocks.db.store;
    s.set('organizations/o1', { name: 'Nuova', ownerId: 'anna', members: [{ uid: 'anna' }, { uid: 'bruno' }] });
    s.set('workspaces/o1', { name: 'Nuova', ownerId: 'anna' });
    s.set('access_grants/o1_anna', { subjectType: 'user', subjectId: 'anna', resourceType: 'workspace', workspaceId: 'o1', role: 'admin' });
    s.set('access_grants/o1_bruno', { subjectType: 'user', subjectId: 'bruno', resourceType: 'workspace', workspaceId: 'o1', role: 'member' });
    s.set('workspace_groups/g1', { workspaceId: 'o1', name: 'Vendite' });
    s.set('org_invites/h1', { orgId: 'o1', kind: 'link' });
    s.set('org_invites/h2', { orgId: 'altra', kind: 'link' });
    s.set('projects/collegato', { name: 'Collegato', workspaceId: 'w1', organizationIds: ['o1', 'o2'] });
  });

  it('il proprietario la cancella con workspace, accessi, team e inviti; i progetti collegati si scollegano', async () => {
    const res = await call('organizations', { orgId: 'o1' }, 'anna');
    expect(res.status).toBe(200);
    for (const path of ['organizations/o1', 'workspaces/o1', 'access_grants/o1_anna', 'access_grants/o1_bruno',
      'workspace_groups/g1', 'org_invites/h1']) {
      expect(has(path), path).toBe(false);
    }
    expect(has('org_invites/h2')).toBe(true);
    expect(has('workspaces/w1')).toBe(true);
    expect(mocks.db.store.get('projects/collegato').organizationIds).toEqual(['o2']);
  });

  it('solo il proprietario', async () => {
    const res = await call('organizations', { orgId: 'o1' }, 'bruno');
    expect(res.status).toBe(403);
    expect(has('organizations/o1')).toBe(true);
    expect(has('workspaces/o1')).toBe(true);
  });

  it('se il workspace ha ancora progetti la rifiuta e non tocca nulla', async () => {
    mocks.db.store.set('projects/p9', { name: 'Ancora qui', workspaceId: 'o1' });
    const res = await call('organizations', { orgId: 'o1' }, 'anna');
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/1 progetto/);
    expect(has('organizations/o1')).toBe(true);
    expect(has('access_grants/o1_bruno')).toBe(true);
  });
});
