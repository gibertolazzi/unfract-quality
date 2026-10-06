import { beforeEach, describe, expect, it, vi } from 'vitest';
import { jsonRequest } from '../helpers/fakeFirestore';

const mocks = vi.hoisted(() => ({
  verifyIdToken: vi.fn(),
  db: undefined as any,
  send: vi.fn(),
}));

vi.mock('@/lib/firebase-admin', async () => {
  const { createFakeDb } = await import('../helpers/fakeFirestore');
  mocks.db = createFakeDb();
  return { adminAuth: { verifyIdToken: mocks.verifyIdToken }, adminDb: mocks.db };
});
beforeEach(async () => {
  await import('@/lib/firebase-admin');
});
vi.mock('resend', () => ({ Resend: class { emails = { send: mocks.send }; } }));

import { hashInviteToken } from '@/lib/server/orgInvites';

const AUTH = { Authorization: 'Bearer good' };
const users: Record<string, any> = {
  anna: { uid: 'anna', email: 'anna@example.com', name: 'Anna', picture: 'https://p/anna.png' },
  bruno: { uid: 'bruno', email: 'bruno@example.com', name: 'Bruno' },
  carla: { uid: 'carla', email: 'carla@example.com', name: 'Carla' },
};
const as = (name: keyof typeof users) => mocks.verifyIdToken.mockResolvedValue(users[name]);

beforeEach(() => {
  mocks.db.store.clear();
  mocks.send.mockReset();
  mocks.send.mockResolvedValue({ data: { id: 'email_1' }, error: null });
  mocks.verifyIdToken.mockReset();
  process.env.RESEND_API_KEY = 're_dummy';
  process.env.NEXT_PUBLIC_APP_URL = 'https://app.unfract.com';
  mocks.db.store.set('organizations/o1', {
    name: 'Acme', ownerId: 'anna', memberUids: ['anna'], memberCount: 1,
    members: [{ uid: 'anna', email: 'anna@example.com', role: 'admin' }],
  });
});

async function emailInvite(email: string): Promise<string> {
  as('anna');
  const { POST } = await import('@/app/api/email/invite/route');
  const response = await POST(jsonRequest('http://localhost/api/email/invite', { orgId: 'o1', email }, AUTH));
  expect(response.status).toBe(200);
  const html: string = mocks.send.mock.calls.at(-1)![0].html;
  return html.match(/\/invite\/([A-Za-z0-9_-]+)"/)![1];
}

async function accept(token: string, who: keyof typeof users) {
  as(who);
  const { POST } = await import('@/app/api/org-invites/accept/route');
  const response = await POST(jsonRequest('http://localhost/api/org-invites/accept', { token }, AUTH));
  return { status: response.status, body: await response.json() };
}

const org = () => mocks.db.store.get('organizations/o1');
const grantsOf = (uid: string): Array<[string, any]> => Array.from(mocks.db.store.entries() as Iterable<[string, any]>)
  .filter(([path, data]) => path.startsWith('access_grants/') && data.subjectId === uid);

describe('inviti via email', () => {
  it('salva solo l’impronta del codice, con destinatario e scadenza', async () => {
    const token = await emailInvite('Bruno@Example.com');
    expect(mocks.db.store.has(`org_invites/${token}`)).toBe(false);
    const invite = mocks.db.store.get(`org_invites/${hashInviteToken(token)}`);
    expect(invite).toMatchObject({ orgId: 'o1', kind: 'email', email: 'bruno@example.com', invitedBy: 'anna', usedAt: null });
    expect(invite.expiresAt - Date.now()).toBeGreaterThan(6.9 * 24 * 3600 * 1000);
  });

  it('il destinatario entra: membro, uid, conteggio e accesso al workspace', async () => {
    const token = await emailInvite('bruno@example.com');
    const result = await accept(token, 'bruno');

    expect(result).toEqual({ status: 200, body: { orgId: 'o1', alreadyMember: false } });
    expect(org().memberUids).toEqual(['anna', 'bruno']);
    expect(org().memberCount).toBe(2);
    expect(org().members.at(-1)).toMatchObject({ uid: 'bruno', email: 'bruno@example.com', role: 'member' });
    expect(grantsOf('bruno')).toHaveLength(1);
    expect(grantsOf('bruno')[0][1]).toMatchObject({ workspaceId: 'o1', resourceType: 'workspace', subjectType: 'user' });
  });

  it('chi non è il destinatario non entra, anche con il link', async () => {
    const token = await emailInvite('bruno@example.com');
    const result = await accept(token, 'carla');
    expect(result.status).toBe(403);
    expect(org().memberUids).toEqual(['anna']);
    expect(grantsOf('carla')).toHaveLength(0);
  });

  it('si usa una volta sola', async () => {
    const token = await emailInvite('bruno@example.com');
    expect((await accept(token, 'bruno')).status).toBe(200);
    mocks.db.store.set('organizations/o1', { ...org(), memberUids: ['anna'], members: org().members.slice(0, 1) });
    expect((await accept(token, 'bruno')).status).toBe(404);
  });

  it('scaduto non vale più', async () => {
    const token = await emailInvite('bruno@example.com');
    const key = `org_invites/${hashInviteToken(token)}`;
    mocks.db.store.set(key, { ...mocks.db.store.get(key), expiresAt: Date.now() - 1 });
    expect((await accept(token, 'bruno')).status).toBe(404);
    expect(org().memberUids).toEqual(['anna']);
  });

  it('chi è già membro non viene duplicato', async () => {
    const token = await emailInvite('anna@example.com');
    const result = await accept(token, 'anna');
    expect(result.body).toEqual({ orgId: 'o1', alreadyMember: true });
    expect(org().members).toHaveLength(1);
    expect(org().memberCount).toBe(1);
  });
});

describe('vecchio link con l’ID dell’organizzazione', () => {
  it('non fa più entrare nessuno', async () => {
    const result = await accept('o1', 'carla');
    expect(result.status).toBe(404);
    expect(org().memberUids).toEqual(['anna']);
  });

  it('un codice inventato non fa entrare', async () => {
    const result = await accept('a'.repeat(32), 'carla');
    expect(result.status).toBe(404);
  });
});

describe('link da condividere', () => {
  async function createLink(who: keyof typeof users) {
    as(who);
    const { POST } = await import('@/app/api/org-invites/link/route');
    const response = await POST(jsonRequest('http://localhost/api/org-invites/link', { orgId: 'o1' }, AUTH));
    return { status: response.status, body: await response.json() };
  }

  it('lo crea solo un membro dell’organizzazione', async () => {
    expect((await createLink('carla')).status).toBe(403);
    const { status, body } = await createLink('anna');
    expect(status).toBe(200);
    expect(body.url).toMatch(/^https:\/\/app\.unfract\.com\/invite\/[A-Za-z0-9_-]{32}$/);
  });

  it('vale per più persone fino alla scadenza', async () => {
    const { body } = await createLink('anna');
    const token = body.url.split('/invite/')[1];
    expect((await accept(token, 'bruno')).status).toBe(200);
    expect((await accept(token, 'carla')).status).toBe(200);
    expect(org().memberUids).toEqual(['anna', 'bruno', 'carla']);

    const key = `org_invites/${hashInviteToken(token)}`;
    mocks.db.store.set(key, { ...mocks.db.store.get(key), expiresAt: Date.now() - 1 });
    expect((await accept(token, 'carla')).status).toBe(404);
  });
});
