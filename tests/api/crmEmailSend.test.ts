import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeDb, jsonRequest } from '../helpers/fakeFirestore';
import { generateUnsubscribeToken } from '@/lib/server/emailUnsubscribe';

const mocks = vi.hoisted(() => ({
  db: undefined as any,
  resendSend: vi.fn(),
}));

vi.mock('@/lib/firebase-admin', async () => {
  const { createFakeDb } = await import('../helpers/fakeFirestore');
  mocks.db = createFakeDb();
  return { adminAuth: {}, adminDb: mocks.db };
});

vi.mock('resend', () => ({
  Resend: class {
    emails = {
      send: mocks.resendSend,
    };
  },
}));

describe('Route /api/crm/email/send (Problema C: Rispetto delle disiscrizioni)', () => {
  const originalFetch = global.fetch;

  beforeEach(async () => {
    await import('@/lib/firebase-admin');
    mocks.db.store.clear();
    mocks.resendSend.mockReset();
    mocks.resendSend.mockResolvedValue({ data: { id: 'msg_123' }, error: null });

    process.env.RESEND_API_KEY = 're_test_key';
    process.env.FIREBASE_WEB_API_KEY = 'test_firebase_web_key';
    process.env.CRM_EMAIL_FROM = 'Unfract CRM <crm@unfract.com>';

    // Mock autenticazione Firebase identitytoolkit
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('identitytoolkit.googleapis.com')) {
        return new Response(JSON.stringify({
          users: [{ localId: 'crm-user-1', email: 'sales@unfract.com' }],
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return originalFetch(url);
    });
  });

  const validPayload = {
    to: 'customer@client.com',
    subject: 'Offerta personalizzata',
    text: 'Gentile cliente, ecco la proposta per te. Disiscrizione: {{unsubscribe_url}}',
    html: '<p>Offerta Unfract. <a href="{{unsubscribe_url}}">Disiscriviti</a></p>',
    idempotencyKey: 'idemp-1',
  };

  const authedHeader = { Authorization: 'Bearer valid-id-token' };

  it('spedisce normalmente l’email se il destinatario NON è disiscritto', async () => {
    const { POST } = await import('@/app/api/crm/email/send/route');
    const req = jsonRequest('http://localhost:3000/api/crm/email/send', validPayload, authedHeader);

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe('msg_123');

    // Verifica che Resend sia stato invocato con List-Unsubscribe firmato e placeholder sostituito
    expect(mocks.resendSend).toHaveBeenCalledTimes(1);
    const callArgs = mocks.resendSend.mock.calls[0][0];

    const expectedToken = generateUnsubscribeToken('customer@client.com');
    expect(callArgs.to).toBe('customer@client.com');
    expect(callArgs.headers['List-Unsubscribe']).toContain(`token=${expectedToken}`);
    expect(callArgs.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    expect(callArgs.text).toContain(`token=${expectedToken}`);
    expect(callArgs.html).toContain(`token=${expectedToken}`);
    expect(callArgs.text).not.toContain('{{unsubscribe_url}}');
    expect(callArgs.html).not.toContain('{{unsubscribe_url}}');
  });

  it('salta l’invio (403) e avvisa se il destinatario si è disiscritto (in unsubscribes)', async () => {
    // Salviamo l'indirizzo nella collection unsubscribes
    mocks.db.store.set('unsubscribes/customer@client.com', {
      email: 'customer@client.com',
      unsubscribedAt: new Date().toISOString(),
      source: 'web_confirmation',
    });

    const { POST } = await import('@/app/api/crm/email/send/route');
    const req = jsonRequest('http://localhost:3000/api/crm/email/send', validPayload, authedHeader);

    const res = await POST(req);
    expect(res.status).toBe(403);

    const data = await res.json();
    expect(data.skipped).toBe(true);
    expect(data.unsubscribed).toBe(true);
    expect(data.error).toContain('disiscritto');

    // Cruciale: Resend NON deve essere stato chiamato!
    expect(mocks.resendSend).not.toHaveBeenCalled();
  });

  it('il controllo disiscrizioni è case-insensitive', async () => {
    mocks.db.store.set('unsubscribes/user@domain.com', {
      email: 'user@domain.com',
      unsubscribedAt: new Date().toISOString(),
    });

    const { POST } = await import('@/app/api/crm/email/send/route');
    const req = jsonRequest('http://localhost:3000/api/crm/email/send', {
      ...validPayload,
      to: 'User@Domain.COM',
      idempotencyKey: 'idemp-diff-case',
    }, authedHeader);

    const res = await POST(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.skipped).toBe(true);
    expect(mocks.resendSend).not.toHaveBeenCalled();
  });
});
