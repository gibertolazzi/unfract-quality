import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  db: undefined as any,
  getValidAccessToken: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock('@/lib/firebase-admin', async () => {
  const { createFakeDb } = await import('../helpers/fakeFirestore');
  mocks.db = createFakeDb();
  return { adminAuth: {}, adminDb: mocks.db };
});

// Carica il modulo finto prima di ogni test, così `mocks.db` esiste già.
beforeEach(async () => {
  await import('@/lib/firebase-admin');
});
vi.mock('@/lib/oauth', () => ({ getValidAccessToken: mocks.getValidAccessToken }));

beforeEach(() => {
  mocks.db.store.clear();
  mocks.db.store.set('users/u1', { settings: { timezone: 'Europe/Rome' } });
  mocks.db.store.set('users/u1/events/e1', { title: 'Call', googleEventId: 'g1', microsoftEventId: 'm1', startTime: '09:00', endTime: '10:00' });
  mocks.db.store.set('calendar_channels/ch1', { uid: 'u1', provider: 'google', secret: 's3cret' });
  mocks.db.store.set('calendar_channels/sub1', { uid: 'u1', provider: 'microsoft', secret: 's3cret' });
  mocks.getValidAccessToken.mockReset();
  mocks.getValidAccessToken.mockResolvedValue('token');
  mocks.fetch.mockReset();
  vi.stubGlobal('fetch', mocks.fetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('avvisi dei calendari: orari nel fuso dell’utente', () => {
  it('Google: un evento spostato alle 15:00 di Roma resta alle 15:00', async () => {
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify({
      items: [{ id: 'g1', summary: 'Call', start: { dateTime: '2026-10-12T15:00:00+02:00' }, end: { dateTime: '2026-10-12T16:30:00+02:00' } }],
    })));
    const { POST } = await import('@/app/api/calendar/webhooks/google/route');
    await POST(new Request('http://localhost/api/calendar/webhooks/google', {
      method: 'POST',
      headers: { 'x-goog-channel-id': 'ch1', 'x-goog-channel-token': 's3cret', 'x-goog-resource-state': 'exists' },
    }));

    const event = mocks.db.store.get('users/u1/events/e1');
    expect(event.startTime).toBe('15:00');
    expect(event.endTime).toBe('16:30');
    expect(event.date).toBe('2026-10-12T13:00:00.000Z');
  });

  it('Google: più eventi cambiati, una sola query per cercarli', async () => {
    mocks.db.store.set('users/u1/events/e2', { title: 'Demo', googleEventId: 'g2' });
    mocks.db.store.set('users/u1/events/e3', { title: 'Altro', googleEventId: 'g9' });
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify({
      items: [
        { id: 'g1', summary: 'Call spostata', start: { dateTime: '2026-10-12T15:00:00+02:00' }, end: { dateTime: '2026-10-12T16:00:00+02:00' } },
        { id: 'g2', status: 'cancelled' },
        { id: 'g-sconosciuto', summary: 'Non è in Unfract', start: { dateTime: '2026-10-12T10:00:00+02:00' }, end: { dateTime: '2026-10-12T11:00:00+02:00' } },
      ],
    })));
    const collection = vi.spyOn(mocks.db, 'collection');
    const { POST } = await import('@/app/api/calendar/webhooks/google/route');
    await POST(new Request('http://localhost/api/calendar/webhooks/google', {
      method: 'POST',
      headers: { 'x-goog-channel-id': 'ch1', 'x-goog-channel-token': 's3cret', 'x-goog-resource-state': 'exists' },
    }));

    expect(collection.mock.calls.filter(([name]) => name === 'users/u1/events')).toHaveLength(1);
    expect(mocks.db.store.get('users/u1/events/e1').title).toBe('Call spostata');
    expect(mocks.db.store.has('users/u1/events/e2')).toBe(false);
    expect(mocks.db.store.get('users/u1/events/e3')).toEqual({ title: 'Altro', googleEventId: 'g9' });
    collection.mockRestore();
  });

  it('Microsoft: gli orari UTC di Graph diventano ora di Roma', async () => {
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify({
      subject: 'Call', start: { dateTime: '2026-11-02T13:00:00.0000000' }, end: { dateTime: '2026-11-02T14:15:00.0000000' },
    })));
    const { POST } = await import('@/app/api/calendar/webhooks/microsoft/route');
    await POST(new Request('http://localhost/api/calendar/webhooks/microsoft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: [{ subscriptionId: 'sub1', clientState: 's3cret', changeType: 'updated', resourceData: { id: 'm1' } }] }),
    }));

    const event = mocks.db.store.get('users/u1/events/e1');
    // Novembre, ora solare: le 13:00 UTC sono le 14:00 a Roma.
    expect(event.startTime).toBe('14:00');
    expect(event.endTime).toBe('15:15');
  });
});
