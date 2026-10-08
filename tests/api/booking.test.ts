import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { jsonRequest } from '../helpers/fakeFirestore';

const mocks = vi.hoisted(() => ({
  db: undefined as any,
  getValidAccessToken: vi.fn(),
  fetch: vi.fn(),
  tooManyRequests: vi.fn(),
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
vi.mock('@/lib/server/rateLimit', () => ({
  tooManyRequests: mocks.tooManyRequests,
  tooManyRequestsShared: async (...args: unknown[]) => mocks.tooManyRequests(...args),
}));

// Lunedì 12 ottobre 2026, ora legale: le 09:00 di Roma sono le 07:00 UTC.
const DAY = '2026-10-12';
const NINE_ROME = '2026-10-12T07:00:00.000Z';

let googleEvents: any[] = [];
let googleCreate: { ok: boolean } = { ok: true };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-06T10:00:00Z'));
  mocks.db.store.clear();
  mocks.db.store.set('users/host1', {
    displayName: 'Anna',
    bookingDuration: 30,
    settings: { timezone: 'Europe/Rome' },
  });
  googleEvents = [];
  googleCreate = { ok: true };
  mocks.tooManyRequests.mockReset();
  mocks.tooManyRequests.mockReturnValue(false);
  mocks.getValidAccessToken.mockReset();
  mocks.getValidAccessToken.mockImplementation(async (_uid: string, provider: string) => (provider === 'google' ? 'g-token' : null));
  mocks.fetch.mockReset();
  mocks.fetch.mockImplementation(async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      return new Response(JSON.stringify({ id: 'ev1' }), { status: googleCreate.ok ? 200 : 403 });
    }
    return new Response(JSON.stringify({ items: googleEvents }), { status: 200 });
  });
  vi.stubGlobal('fetch', mocks.fetch);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function getSlots(query: string) {
  const { GET } = await import('@/app/api/calendar/slots/route');
  return GET(new Request(`http://localhost/api/calendar/slots?${query}`));
}

async function book(body: Record<string, unknown>) {
  const { POST } = await import('@/app/api/calendar/book/route');
  return POST(jsonRequest('http://localhost/api/calendar/book', body));
}

const GUEST = { userId: 'host1', guestName: 'Marco', guestEmail: 'marco@example.com' };

describe('orari prenotabili', () => {
  it('la disponibilità vale nel fuso dell’utente', async () => {
    const response = await getSlots(`userId=host1&date=${DAY}`);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.timeZone).toBe('Europe/Rome');
    expect(data.provider).toBe('google');
    // 09:00–18:00 a Roma, slot da 30 minuti: dalle 07:00 alle 15:30 UTC.
    expect(data.slots[0]).toBe(NINE_ROME);
    expect(data.slots.at(-1)).toBe('2026-10-12T15:30:00.000Z');
    expect(data.slots).toHaveLength(18);
    // Il calendario si legge da mezzanotte a mezzanotte di Roma.
    const calendarUrl = new URL(mocks.fetch.mock.calls[0][0]);
    expect(calendarUrl.searchParams.get('timeMin')).toBe('2026-10-11T22:00:00.000Z');
    expect(calendarUrl.searchParams.get('timeMax')).toBe('2026-10-12T22:00:00.000Z');
  });

  it('con l’ora solare le 09:00 sono le 08:00 UTC', async () => {
    const data = await (await getSlots('userId=host1&date=2026-11-02')).json();
    expect(data.slots[0]).toBe('2026-11-02T08:00:00.000Z');
  });

  it('gli impegni nel calendario tolgono gli slot', async () => {
    googleEvents = [{ start: { dateTime: '2026-10-12T09:00:00+02:00' }, end: { dateTime: '2026-10-12T10:00:00+02:00' } }];
    const data = await (await getSlots(`userId=host1&date=${DAY}`)).json();
    expect(data.slots).not.toContain(NINE_ROME);
    expect(data.slots).not.toContain('2026-10-12T07:30:00.000Z');
    expect(data.slots[0]).toBe('2026-10-12T08:00:00.000Z');
  });

  it('domenica nessuno slot', async () => {
    const data = await (await getSlots('userId=host1&date=2026-10-11')).json();
    expect(data.slots).toEqual([]);
  });

  it('senza calendario collegato nessuno slot', async () => {
    mocks.getValidAccessToken.mockResolvedValue(null);
    const data = await (await getSlots(`userId=host1&date=${DAY}`)).json();
    expect(data.provider).toBeNull();
    expect(data.slots).toEqual([]);
  });

  it('se il calendario non risponde, nessuno slot mostrato come libero', async () => {
    mocks.fetch.mockResolvedValue(new Response('{}', { status: 500 }));
    const response = await getSlots(`userId=host1&date=${DAY}`);
    expect(response.status).toBe(502);
  });

  it('400 con una data non valida', async () => {
    expect((await getSlots('userId=host1&date=2026-10-12T00:00:00.000Z')).status).toBe(400);
    expect((await getSlots('userId=../x&date=2026-10-12')).status).toBe(400);
  });
});

describe('prenotazione pubblica', () => {
  it('crea l’evento su Google nel fuso dell’utente e manda l’invito', async () => {
    const response = await book({ ...GUEST, slot: NINE_ROME });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({ success: true, start: NINE_ROME, end: '2026-10-12T07:30:00.000Z', provider: 'google' });

    const [url, init] = mocks.fetch.mock.calls.find(([, init]) => init?.method === 'POST')!;
    expect(url).toContain('sendUpdates=all');
    expect(url).toContain('conferenceDataVersion=1');
    expect(init.headers.Authorization).toBe('Bearer g-token');
    const event = JSON.parse(init.body);
    expect(event.start).toEqual({ dateTime: NINE_ROME, timeZone: 'Europe/Rome' });
    expect(event.attendees).toEqual([{ email: 'marco@example.com', displayName: 'Marco' }]);
  });

  it('409 se lo slot è occupato o fuori disponibilità', async () => {
    googleEvents = [{ start: { dateTime: '2026-10-12T09:00:00+02:00' }, end: { dateTime: '2026-10-12T10:00:00+02:00' } }];
    expect((await book({ ...GUEST, slot: NINE_ROME })).status).toBe(409);
    // Le 20:00 di Roma sono fuori orario.
    expect((await book({ ...GUEST, slot: '2026-10-12T18:00:00.000Z' })).status).toBe(409);
    // Non allineato agli slot.
    expect((await book({ ...GUEST, slot: '2026-10-12T08:10:00.000Z' })).status).toBe(409);
    expect(mocks.fetch.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('due ospiti sullo stesso slot: passa solo il primo', async () => {
    expect((await book({ ...GUEST, slot: NINE_ROME })).status).toBe(200);
    expect((await book({ ...GUEST, guestEmail: 'altro@example.com', slot: NINE_ROME })).status).toBe(409);
  });

  it('se il calendario rifiuta, 502 e lo slot torna libero', async () => {
    googleCreate = { ok: false };
    expect((await book({ ...GUEST, slot: NINE_ROME })).status).toBe(502);
    expect(Array.from(mocks.db.store.keys() as Iterable<string>).some(key => key.startsWith('booking_locks/'))).toBe(false);
  });

  it('409 se l’utente non ha un calendario collegato', async () => {
    mocks.getValidAccessToken.mockResolvedValue(null);
    expect((await book({ ...GUEST, slot: NINE_ROME })).status).toBe(409);
  });

  it('400 con dati non validi', async () => {
    expect((await book({ ...GUEST, slot: 'domani' })).status).toBe(400);
    expect((await book({ ...GUEST, guestEmail: 'non-una-email', slot: NINE_ROME })).status).toBe(400);
    expect((await book({ ...GUEST, guestName: '', slot: NINE_ROME })).status).toBe(400);
    expect((await book({ ...GUEST, userId: 'a/b', slot: NINE_ROME })).status).toBe(400);
  });

  it('429 oltre il limite di prenotazioni per utente', async () => {
    mocks.tooManyRequests.mockImplementation((key: string) => key === 'calendar-book:host1');
    expect((await book({ ...GUEST, slot: NINE_ROME })).status).toBe(429);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it('404 se l’utente non esiste', async () => {
    expect((await book({ ...GUEST, userId: 'nessuno', slot: NINE_ROME })).status).toBe(404);
  });
});
