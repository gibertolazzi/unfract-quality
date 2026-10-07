import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
vi.mock('firebase-admin/firestore', () => ({ FieldValue: { serverTimestamp: () => 'now' } }));
vi.mock('@/lib/server/rateLimit', () => ({ tooManyRequests: () => false }));

const AUTH = { Authorization: 'Bearer token-anna' };
const BUCKET = 'unfract-test.firebasestorage.app';
const fetchMock = vi.fn();
/** File su Storage: percorso → dimensione. */
let files: Record<string, number>;

async function usage(body: unknown, uid = 'anna') {
  mocks.verifyIdToken.mockResolvedValue({ uid, email: `${uid}@example.com` });
  const { POST } = await import('@/app/api/usage/storage/route');
  const response = await POST(jsonRequest('http://localhost/api/usage/storage', body, AUTH));
  return { status: response.status, body: await response.json() };
}
const used = (ws = 'w1') => mocks.db.store.get(`workspaces/${ws}`).quotas.storageUsed;

beforeEach(async () => {
  await import('@/lib/firebase-admin');
  mocks.db.store.clear();
  mocks.verifyIdToken.mockReset();
  fetchMock.mockReset();
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = BUCKET;
  files = { 'chats/c1/foto.png': 2048, 'tasks/attachments/a.pdf': 1000 };
  fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
    expect(url.startsWith(`https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/`)).toBe(true);
    // Il server legge i metadati con il token dell'utente, non con permessi propri.
    expect((init.headers as Record<string, string>).Authorization).toBe('Firebase token-anna');
    const path = decodeURIComponent(url.split('/o/')[1]);
    return path in files ? Response.json({ name: path, size: String(files[path]) }) : new Response('{}', { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  const s = mocks.db.store;
  s.set('workspaces/w1', { name: 'Acme', ownerId: 'anna', quotas: { planTier: 'pro', storageUsed: 500, storageLimit: 5e9, aiCreditsUsed: 3, aiCreditsLimit: 1000 } });
  s.set('workspaces/w2', { name: 'Altro', ownerId: 'zeno' });
  s.set('access_grants/w1_bruno', { subjectType: 'user', subjectId: 'bruno', resourceType: 'workspace', workspaceId: 'w1' });
});
afterEach(() => vi.unstubAllGlobals());

describe('spazio dei file', () => {
  it('somma la dimensione vera letta da Storage, una volta sola', async () => {
    expect((await usage({ action: 'track', workspaceId: 'w1', path: 'chats/c1/foto.png', bytes: 1 })).body.bytes).toBe(2048);
    expect(used()).toBe(2548);
    // Ripetuto (prima la chat contava ogni file due volte): non cambia nulla.
    await usage({ action: 'track', workspaceId: 'w1', path: 'chats/c1/foto.png' });
    expect(used()).toBe(2548);
    // I limiti del piano restano quelli del workspace.
    expect(mocks.db.store.get('workspaces/w1').quotas).toMatchObject({ planTier: 'pro', storageLimit: 5e9, aiCreditsLimit: 1000, aiCreditsUsed: 3 });
  });

  it('un membro del workspace può registrare file, un estraneo no', async () => {
    expect((await usage({ action: 'track', workspaceId: 'w1', path: 'tasks/attachments/a.pdf' }, 'bruno')).status).toBe(200);
    expect((await usage({ action: 'track', workspaceId: 'w2', path: 'chats/c1/foto.png' })).status).toBe(403);
    expect(mocks.db.store.get('workspaces/w2').quotas).toBeUndefined();
  });

  it('file inesistente o percorso fuori dalle cartelle dell’app: niente conteggio', async () => {
    expect((await usage({ action: 'track', workspaceId: 'w1', path: 'chats/c1/nessuno.png' })).status).toBe(404);
    for (const path of ['users/anna/x', 'chats/../users/x', '', 'chats/c1/a b']) {
      expect((await usage({ action: 'track', workspaceId: 'w1', path })).status).toBe(400);
    }
    expect(used()).toBe(500);
  });

  it('cancellato il file, i byte si tolgono una volta sola; se esiste ancora, no', async () => {
    await usage({ action: 'track', workspaceId: 'w1', path: 'chats/c1/foto.png' });
    expect((await usage({ action: 'release', path: 'chats/c1/foto.png' })).status).toBe(409);
    expect(used()).toBe(2548);

    delete files['chats/c1/foto.png'];
    expect((await usage({ action: 'release', path: 'chats/c1/foto.png' })).body.bytes).toBe(2048);
    expect(used()).toBe(500);
    expect((await usage({ action: 'release', path: 'chats/c1/foto.png' })).body.bytes).toBe(0);
    expect(used()).toBe(500);
  });

  it('un workspace senza quote parte dai valori predefiniti', async () => {
    mocks.db.store.set('workspaces/w3', { name: 'Vecchio', ownerId: 'anna' });
    await usage({ action: 'track', workspaceId: 'w3', path: 'tasks/attachments/a.pdf' });
    expect(mocks.db.store.get('workspaces/w3').quotas).toEqual({
      planTier: 'free', storageUsed: 1000, storageLimit: 1_000_000_000, aiCreditsUsed: 0, aiCreditsLimit: 120,
    });
  });

  it('azione sconosciuta: 400', async () => {
    expect((await usage({ action: 'reset', workspaceId: 'w1' })).status).toBe(400);
  });
});

describe('crediti AI', () => {
  it('si azzerano al cambio di mese', async () => {
    const { addAiCredits } = await import('@/lib/server/usage');
    mocks.db.store.get('workspaces/w1').quotas.aiCreditsPeriod = '2026-09';
    await addAiCredits('w1', 1, new Date('2026-10-07T10:00:00Z'));
    expect(mocks.db.store.get('workspaces/w1').quotas).toMatchObject({ aiCreditsUsed: 1, aiCreditsPeriod: '2026-10' });
    await addAiCredits('w1', 2, new Date('2026-10-20T10:00:00Z'));
    expect(mocks.db.store.get('workspaces/w1').quotas.aiCreditsUsed).toBe(3);
  });
});
