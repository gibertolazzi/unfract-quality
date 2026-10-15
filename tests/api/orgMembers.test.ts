import { beforeEach, describe, expect, it, vi } from 'vitest';
import { jsonRequest } from '../helpers/fakeFirestore';
import { isActiveOrgMember } from '@/lib/server/orgMembers';

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
  FieldValue: {
    arrayRemove: (...values: unknown[]) => ({ __arrayRemove: values }),
    arrayUnion: (...values: unknown[]) => ({ __arrayUnion: values }),
    serverTimestamp: () => 'now',
  },
}));
vi.mock('@/lib/server/rateLimit', () => ({ tooManyRequests: () => false }));

const AUTH = { Authorization: 'Bearer good' };
const data = (path: string) => mocks.db.store.get(path);
const has = (path: string) => mocks.db.store.has(path);

async function call(uid: string | null, body: Record<string, unknown>) {
  if (uid) mocks.verifyIdToken.mockResolvedValue({ uid, email: `${uid}@example.com` });
  else mocks.verifyIdToken.mockRejectedValue(new Error('no'));
  const { POST } = await import('@/app/api/organizations/members/route');
  const response = await POST(jsonRequest('http://localhost/api/organizations/members', { orgId: 'o1', ...body }, AUTH));
  return { status: response.status, body: await response.json() };
}

const member = (uid: string, role = 'member') => ({ uid, email: `${uid}@example.com`, displayName: uid, initials: uid[0], role });

beforeEach(async () => {
  await import('@/lib/firebase-admin');
  const s = mocks.db.store;
  s.clear();
  mocks.verifyIdToken.mockReset();
  // anna proprietaria, bruno admin, carla e dario membri.
  s.set('organizations/o1', {
    name: 'Acme', ownerId: 'anna',
    members: [member('anna', 'admin'), member('bruno', 'admin'), member('carla'), member('dario')],
    memberUids: ['anna', 'bruno', 'carla', 'dario'], memberCount: 4,
  });
  s.set('projects/p1', { name: 'Di Carla', workspaceId: 'o1', userId: 'carla', creatorId: 'carla' });
  s.set('projects/p2', { name: 'Di Anna', workspaceId: 'o1', userId: 'anna', creatorId: 'anna' });
  s.set('projects/p3', { name: 'Personale di Carla', workspaceId: 'wc', userId: 'carla', creatorId: 'carla' });
  s.set('chats/ch1', { projectId: 'p1', members: ['anna', 'carla'] });
  s.set('chats/ch2', { projectId: 'p3', members: ['carla'] });
  s.set('access_grants/o1_carla', { subjectType: 'user', subjectId: 'carla', resourceType: 'workspace', resourceId: 'o1', workspaceId: 'o1', role: 'member' });
  s.set('access_grants/p1_carla', { subjectType: 'user', subjectId: 'carla', resourceType: 'project', resourceId: 'p1', workspaceId: 'o1', role: 'admin' });
  s.set('access_grants/g1_carla', { subjectType: 'user', subjectId: 'carla', resourceType: 'workspace_group', resourceId: 'g1', workspaceId: 'o1', role: 'member' });
  s.set('access_grants/wc_carla', { subjectType: 'user', subjectId: 'carla', resourceType: 'workspace', resourceId: 'wc', workspaceId: 'wc', role: 'admin' });
  s.set('project_members/p1_carla', { projectId: 'p1', userId: 'carla', roleId: 'r1' });
  s.set('project_members/p3_carla', { projectId: 'p3', userId: 'carla', roleId: 'r3' });
});

describe('espellere', () => {
  it('un admin espelle un membro: perde accesso, chat e ruoli; i suoi progetti passano alla proprietaria', async () => {
    const res = await call('bruno', { uid: 'carla', action: 'remove' });
    expect(res.status).toBe(200);
    const org = data('organizations/o1');
    expect(org.memberUids).toEqual(['anna', 'bruno', 'dario']);
    expect(org.members.map((m: any) => m.uid)).toEqual(['anna', 'bruno', 'dario']);
    expect(org.memberCount).toBe(3);
    expect(res.body.memberUids).toEqual(['anna', 'bruno', 'dario']);

    expect(data('projects/p1')).toMatchObject({ userId: 'anna', creatorId: 'anna', transferredFrom: 'carla' });
    expect(data('projects/p3')).toMatchObject({ userId: 'carla', creatorId: 'carla' });
    expect(data('chats/ch1').members).toEqual(['anna']);
    expect(data('chats/ch2').members).toEqual(['carla']);

    expect(has('access_grants/o1_carla')).toBe(false);
    expect(has('access_grants/p1_carla')).toBe(false);
    expect(has('access_grants/g1_carla')).toBe(false);
    expect(has('access_grants/wc_carla')).toBe(true);
    expect(has('project_members/p1_carla')).toBe(false);
    expect(has('project_members/p3_carla')).toBe(true);
  });

  it('un membro non espelle nessuno', async () => {
    const res = await call('carla', { uid: 'dario', action: 'remove' });
    expect(res.status).toBe(403);
    expect(data('organizations/o1').memberUids).toContain('dario');
  });

  it('nessuno espelle la proprietaria; un admin lo espelle solo lei', async () => {
    expect((await call('bruno', { uid: 'anna', action: 'remove' })).status).toBe(403);
    await mocks.db.store.set('organizations/o1', {
      ...data('organizations/o1'),
      members: [...data('organizations/o1').members, member('elena', 'admin')],
      memberUids: [...data('organizations/o1').memberUids, 'elena'],
    });
    expect((await call('bruno', { uid: 'elena', action: 'remove' })).status).toBe(403);
    expect((await call('anna', { uid: 'elena', action: 'remove' })).status).toBe(200);
  });

  it('chi è fuori dall’organizzazione non può fare niente', async () => {
    expect((await call('zeno', { uid: 'carla', action: 'remove' })).status).toBe(403);
    expect((await call(null, { uid: 'carla', action: 'remove' })).status).toBe(401);
  });
});

describe('lasciare l’organizzazione', () => {
  it('ognuno esce da solo, la proprietaria no', async () => {
    expect((await call('carla', { uid: 'carla', action: 'remove' })).status).toBe(200);
    expect(data('organizations/o1').memberUids).not.toContain('carla');
    expect(data('projects/p1').userId).toBe('anna');
    expect((await call('anna', { uid: 'anna', action: 'remove' })).status).toBe(403);
  });
});

describe('sospendere e riattivare', () => {
  it('sospeso: resta nell’elenco senza accesso; riattivato torna come prima', async () => {
    const res = await call('bruno', { uid: 'carla', action: 'suspend' });
    expect(res.status).toBe(200);
    let org = data('organizations/o1');
    expect(org.memberUids).toEqual(['anna', 'bruno', 'dario']);
    expect(org.members.find((m: any) => m.uid === 'carla')).toMatchObject({ suspended: true });
    expect(org.memberCount).toBe(3);
    expect(has('access_grants/o1_carla')).toBe(false);
    expect(has('access_grants/p1_carla')).toBe(true);
    expect(has('access_grants/g1_carla')).toBe(true);
    expect(has('project_members/p1_carla')).toBe(true);
    expect(data('chats/ch1').members).toEqual(['anna']);
    expect(data('projects/p1').userId).toBe('anna');
    expect(data('org_suspensions/o1_carla')).toMatchObject({ chatIds: ['ch1'], suspendedBy: 'bruno' });

    expect((await call('bruno', { uid: 'carla', action: 'suspend' })).status).toBe(409);
    expect(isActiveOrgMember(org, 'carla')).toBe(false);

    expect((await call('bruno', { uid: 'carla', action: 'reactivate' })).status).toBe(200);
    org = data('organizations/o1');
    expect(org.memberUids).toContain('carla');
    expect(org.members.find((m: any) => m.uid === 'carla').suspended).toBeUndefined();
    expect(data('access_grants/o1_carla')).toMatchObject({ resourceType: 'workspace', workspaceId: 'o1', role: 'member' });
    expect(data('chats/ch1').members).toEqual(['anna', 'carla']);
    expect(has('org_suspensions/o1_carla')).toBe(false);
  });

  it('un sospeso non gestisce gli altri', async () => {
    await call('anna', { uid: 'bruno', action: 'suspend' });
    expect((await call('bruno', { uid: 'carla', action: 'suspend' })).status).toBe(403);
  });
});

describe('cambiare ruolo', () => {
  it('solo la proprietaria, e cambia anche l’accesso al workspace', async () => {
    expect((await call('bruno', { uid: 'carla', action: 'role', role: 'admin' })).status).toBe(403);
    expect((await call('anna', { uid: 'carla', action: 'role', role: 'admin' })).status).toBe(200);
    expect(data('organizations/o1').members.find((m: any) => m.uid === 'carla').role).toBe('admin');
    expect(data('access_grants/o1_carla').role).toBe('admin');
    expect(data('access_grants/p1_carla').role).toBe('admin');
    expect((await call('anna', { uid: 'carla', action: 'role', role: 'boss' })).status).toBe(400);
  });
});
