import { existsSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeDb, jsonRequest } from '../helpers/fakeFirestore';

const mocks = vi.hoisted(() => {
  return {
    verifyIdToken: vi.fn(),
    db: undefined as any,
  };
});

vi.mock('@/lib/firebase-admin', async () => {
  const { createFakeDb } = await import('../helpers/fakeFirestore');
  mocks.db = createFakeDb();
  return { adminAuth: { verifyIdToken: mocks.verifyIdToken }, adminDb: mocks.db };
});

// Carica il modulo finto prima di ogni test, così `mocks.db` esiste già.
beforeEach(async () => {
  await import('@/lib/firebase-admin');
});
vi.mock('resend', () => ({ Resend: class { emails = { send: vi.fn() }; } }));

const BASE = 'http://localhost:3000';

// Ogni route che agisce a nome di un utente deve rifiutare chi non è autenticato.
const routes: Array<{ name: string; load: () => Promise<any>; method: 'GET' | 'POST'; path: string; body?: unknown }> = [
  { name: 'email/invite', load: () => import('@/app/api/email/invite/route'), method: 'POST', path: '/api/email/invite', body: { orgId: 'o1', email: 'a@b.it' } },
  { name: 'ai/meeting', load: () => import('@/app/api/ai/meeting/route'), method: 'POST', path: '/api/ai/meeting', body: { projectId: 'p1', transcript: 'x' } },
  { name: 'ai/title', load: () => import('@/app/api/ai/title/route'), method: 'POST', path: '/api/ai/title', body: { kind: 'chat', text: 'x' } },
  { name: 'ai/chat', load: () => import('@/app/api/ai/chat/route'), method: 'POST', path: '/api/ai/chat', body: { text: 'x' } },
  { name: 'calendar/notify', load: () => import('@/app/api/calendar/notify/route'), method: 'POST', path: '/api/calendar/notify', body: { eventId: 'e1' } },
  { name: 'calendar/sync', load: () => import('@/app/api/calendar/sync/route'), method: 'GET', path: '/api/calendar/sync?userId=victim&timeMin=a&timeMax=b' },
  { name: 'calendar/integrations', load: () => import('@/app/api/calendar/integrations/route'), method: 'GET', path: '/api/calendar/integrations' },
  { name: 'calendar/create', load: () => import('@/app/api/calendar/create/route'), method: 'POST', path: '/api/calendar/create', body: { userId: 'victim', event: { id: 'e1' } } },
  { name: 'stripe/create-checkout', load: () => import('@/app/api/stripe/create-checkout/route'), method: 'POST', path: '/api/stripe/create-checkout', body: { plan: 'pro' } },
  { name: 'auth/google', load: () => import('@/app/api/auth/google/route'), method: 'POST', path: '/api/auth/google' },
  { name: 'auth/microsoft', load: () => import('@/app/api/auth/microsoft/route'), method: 'POST', path: '/api/auth/microsoft' },
  { name: 'projects/delete', load: () => import('@/app/api/projects/delete/route'), method: 'POST', path: '/api/projects/delete', body: { projectId: 'p1' } },
  { name: 'organizations/delete', load: () => import('@/app/api/organizations/delete/route'), method: 'POST', path: '/api/organizations/delete', body: { orgId: 'o1' } },
];

describe('route che richiedono il login', () => {
  beforeEach(() => {
    mocks.verifyIdToken.mockReset();
    mocks.verifyIdToken.mockRejectedValue(new Error('invalid token'));
    process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
    process.env.RESEND_API_KEY = 're_dummy';
    process.env.GOOGLE_CLIENT_ID = 'google-client';
    process.env.MICROSOFT_CLIENT_ID = 'ms-client';
  });

  for (const route of routes) {
    it(`${route.name}: 401 senza token`, async () => {
      const handler = (await route.load())[route.method];
      const response = await handler(jsonRequest(BASE + route.path, route.body ?? {}, {}, route.method));
      expect(response.status).toBe(401);
    });

    it(`${route.name}: 401 con token non valido`, async () => {
      const handler = (await route.load())[route.method];
      const response = await handler(jsonRequest(BASE + route.path, route.body ?? {}, { Authorization: 'Bearer forged' }, route.method));
      expect(response.status).toBe(401);
    });
  }

  it('la vecchia GET di avvio OAuth con userId non esiste più', async () => {
    const google = await import('@/app/api/auth/google/route');
    const microsoft = await import('@/app/api/auth/microsoft/route');
    expect((google as any).GET).toBeUndefined();
    expect((microsoft as any).GET).toBeUndefined();
  });

  it('il relay aperto /api/email/send è stato eliminato', () => {
    expect(existsSync('app/api/email/send/route.ts')).toBe(false);
  });

  it('createFakeDb è isolato per file di test', () => {
    expect(createFakeDb().store.size).toBe(0);
  });
});
