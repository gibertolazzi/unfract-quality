import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Timestamp } from 'firebase-admin/firestore';

const mocks = vi.hoisted(() => ({ db: undefined as any, send: vi.fn() }));

vi.mock('@/lib/firebase-admin', async () => {
  const { createFakeDb } = await import('../helpers/fakeFirestore');
  mocks.db = createFakeDb();
  return { adminAuth: {}, adminDb: mocks.db };
});
beforeEach(async () => {
  await import('@/lib/firebase-admin');
});
vi.mock('resend', () => ({ Resend: class { emails = { send: mocks.send }; } }));

const OLD = Timestamp.fromMillis(Date.now() - 10 * 60_000);
const queued = (recipientId: string, extra: Record<string, unknown> = {}) => ({
  processed: false, recipientId, type: 'assignment', authorName: 'Bruno', taskTitle: 'Preventivo', createdAt: OLD, ...extra,
});
const queue = (id: string) => mocks.db.store.get(`notifications_queue/${id}`);

async function runCron() {
  const { GET } = await import('@/app/api/cron/process-emails/route');
  const response = await GET(new Request('http://localhost/api/cron/process-emails', { headers: { authorization: 'Bearer cron' } }));
  return response.json();
}

beforeEach(() => {
  vi.stubEnv('CRON_SECRET', 'cron');
  vi.stubEnv('RESEND_API_KEY', 're_test');
  mocks.db.store.clear();
  mocks.db.store.set('users/anna', { email: 'anna@example.com', displayName: 'Anna', settings: {} });
  mocks.db.store.set('users/senza-email', { settings: {} });
  mocks.send.mockReset();
  mocks.send.mockResolvedValue({ data: { id: 'resend-1' }, error: null });
});
afterEach(() => vi.unstubAllEnvs());

describe('cron delle email di notifica', () => {
  it('raggruppa le notifiche scadute dello stesso utente in un solo invio', async () => {
    mocks.db.store.set('notifications_queue/q1', queued('anna'));
    mocks.db.store.set('notifications_queue/q2', queued('anna', { type: 'mention' }));
    const result = await runCron();

    expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(mocks.send.mock.calls[0][0]).toMatchObject({ to: ['anna@example.com'], subject: 'Hai 2 nuove notifiche in Unfract' });
    expect(queue('q1')).toMatchObject({ processed: true, resendId: 'resend-1' });
    expect(queue('q2')).toMatchObject({ processed: true, resendId: 'resend-1' });
    expect(result).toMatchObject({ sentCount: 1, processedCount: 2 });
  });

  it('chiude senza inviare: preferenza spenta, email mancante, troppi tentativi', async () => {
    mocks.db.store.set('notifications_queue/spenta', queued('anna', { type: 'changes' }));
    mocks.db.store.set('notifications_queue/senza', queued('senza-email'));
    mocks.db.store.set('notifications_queue/fallita', queued('anna', { attempts: 5 }));
    await runCron();

    expect(mocks.send).not.toHaveBeenCalled();
    expect(queue('spenta')).toMatchObject({ processed: true });
    expect(queue('senza')).toMatchObject({ processed: true, lastError: 'Recipient email is missing' });
    expect(queue('fallita')).toMatchObject({ processed: true, lastError: 'Abandoned after 5 attempts' });
  });

  it('lascia in coda quelle non ancora scadute', async () => {
    mocks.db.store.set('notifications_queue/fresca', queued('anna', { createdAt: Timestamp.now() }));
    await runCron();
    expect(mocks.send).not.toHaveBeenCalled();
    expect(queue('fresca').processed).toBe(false);
  });

  it('se Resend rifiuta, la notifica resta in coda con l’errore', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.send.mockResolvedValue({ data: null, error: { message: 'rate limited' } });
    mocks.db.store.set('notifications_queue/q1', queued('anna'));
    const result = await runCron();
    expect(queue('q1')).toMatchObject({ processed: false, lastError: 'rate limited' });
    expect(result.errors).toEqual(['anna: rate limited']);
  });

  it('accetta autenticazione tramite query param ?key= e metodo POST', async () => {
    const { POST } = await import('@/app/api/cron/process-emails/route');
    mocks.db.store.set('notifications_queue/q1', queued('anna'));
    const response = await POST(new Request('http://localhost/api/cron/process-emails?key=cron'));
    const result = await response.json();
    expect(response.status).toBe(200);
    expect(result.sentCount).toBe(1);
  });

  it('bypassa l’attesa se force=true è presente nei parametri', async () => {
    const { GET } = await import('@/app/api/cron/process-emails/route');
    mocks.db.store.set('notifications_queue/fresca', queued('anna', { createdAt: Timestamp.now() }));
    const response = await GET(new Request('http://localhost/api/cron/process-emails?key=cron&force=true'));
    const result = await response.json();
    expect(result.sentCount).toBe(1);
    expect(queue('fresca').processed).toBe(true);
  });
});
