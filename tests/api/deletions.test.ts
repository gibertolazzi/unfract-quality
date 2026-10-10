import { beforeEach, describe, expect, it, vi } from 'vitest';
import { jsonRequest } from '../helpers/fakeFirestore';
import { storageRecordId } from '@/lib/server/storageBackfill';

const mocks = vi.hoisted(() => ({
  verifyIdToken: vi.fn(),
  db: undefined as any,
  /** File su Storage, per nome. */
  files: new Set<string>(),
  storageDown: false,
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
vi.mock('firebase-admin/storage', () => ({
  getStorage: () => ({
    bucket: () => ({
      getFiles: async ({ prefix }: { prefix: string }) => [Array.from(mocks.files).filter(name => name.startsWith(prefix)).map(name => ({ name }))],
      file: (name: string) => ({
        delete: async () => {
          if (mocks.storageDown) throw new Error('Storage non raggiungibile');
          mocks.files.delete(name);
        },
      }),
    }),
  }),
}));

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
  mocks.files.clear();
  mocks.storageDown = false;
  s.set('workspaces/w1', { name: 'Acme', ownerId: 'anna', quotas: { storageUsed: 1500, storageLimit: 1e9 } });
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
  s.set('meetings/m1', { projectId: 'p1' });
  s.set('crm_accounts/a1', { projectId: 'p1', name: 'Cliente' });
  s.set('crm_audit/x1', { projectId: 'p1' });
  s.set('ai_chats/ai1', { projectId: 'p1', userId: 'bruno' });
  s.set('chats/ch1', { projectId: 'p1', members: ['anna', 'bruno'] });
  s.set('messages/msg1', { chatId: 'ch1', senderId: 'anna' });
  s.set('messages/msg2', { chatId: 'ch1', senderId: 'bruno' });
  s.set('columns/altro', { projectId: 'p2', title: 'To Do' });
  s.set('chats/ch2', { projectId: 'p2', members: ['anna'] });
  s.set('messages/msg3', { chatId: 'ch2', senderId: 'anna' });
  s.set('tasks/t1', { projectId: 'p1', title: 'Task', attachments: [{ refPath: 'tasks/attachments/1_vecchio.pdf' }] });
  for (const name of ['meetings/p1/1.webm', 'documentation/p1/d1/foto.png', 'tasks/p1/1_a.pdf', 'tasks/attachments/1_vecchio.pdf',
    'ai-hub/p1/1_dati.csv', 'crm/p1/2026/1-offerta.pdf', 'chats/ch1/1_0_foto.png',
    'meetings/p2/1.webm', 'chats/ch2/x.png', 'tasks/attachments/2_altro.pdf', 'organizations/o1/banner_1']) {
    mocks.files.add(name);
  }
  // Due file del progetto già contati nello spazio del workspace (1000 + 300 byte).
  s.set(`storage_usage/${storageRecordId('meetings/p1/1.webm')}`, { path: 'meetings/p1/1.webm', workspaceId: 'w1', bytes: 1000 });
  s.set(`storage_usage/${storageRecordId('chats/ch1/1_0_foto.png')}`, { path: 'chats/ch1/1_0_foto.png', workspaceId: 'w1', bytes: 300 });
});

describe('cancellazione di un progetto', () => {
  it('chi l’ha creato lo cancella con tutto quello che contiene', async () => {
    const res = await call('projects', { projectId: 'p1' }, 'anna');
    expect(res.status).toBe(200);
    for (const path of ['projects/p1', 'columns/c1', 'columns/c2', 'tasks/t1', 'epics/e1', 'project_members/p1_bruno',
      'project_roles/r1', 'access_requests/q1', 'access_grants/p1_anna', 'documentation/d1', 'meetings/m1',
      'crm_accounts/a1', 'crm_audit/x1', 'ai_chats/ai1', 'chats/ch1', 'messages/msg1', 'messages/msg2']) {
      expect(has(path), path).toBe(false);
    }
    // Restano gli altri progetti, le loro chat e l'accesso al workspace.
    for (const path of ['columns/altro', 'chats/ch2', 'messages/msg3', 'access_grants/w1_anna', 'workspaces/w1']) {
      expect(has(path), path).toBe(true);
    }
  });

  it('cancella i file del progetto e li toglie dallo spazio usato', async () => {
    expect((await call('projects', { projectId: 'p1' }, 'anna')).status).toBe(200);
    expect(Array.from(mocks.files).sort()).toEqual(['chats/ch2/x.png', 'meetings/p2/1.webm', 'organizations/o1/banner_1', 'tasks/attachments/2_altro.pdf']);
    expect(mocks.db.store.get('workspaces/w1').quotas.storageUsed).toBe(200);
    expect(has(`storage_usage/${storageRecordId('meetings/p1/1.webm')}`)).toBe(false);
  });

  it('se Storage non risponde non cancella il progetto, e si può riprovare', async () => {
    mocks.storageDown = true;
    expect((await call('projects', { projectId: 'p1' }, 'anna')).status).toBe(500);
    expect(has('projects/p1')).toBe(true);
    expect(has('documentation/d1')).toBe(true);
    mocks.storageDown = false;
    expect((await call('projects', { projectId: 'p1' }, 'anna')).status).toBe(200);
    expect(has('projects/p1')).toBe(false);
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
    expect(mocks.files.has('organizations/o1/banner_1')).toBe(false);
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
