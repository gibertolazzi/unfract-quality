import { beforeEach, describe, expect, it, vi } from 'vitest';
import { jsonRequest } from '../helpers/fakeFirestore';

const mocks = vi.hoisted(() => {
  return {
    verifyIdToken: vi.fn(),
    db: undefined as any,
    send: vi.fn(),
    getValidAccessToken: vi.fn(),
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
vi.mock('resend', () => ({ Resend: class { emails = { send: mocks.send }; } }));
vi.mock('@/lib/oauth', () => ({ getValidAccessToken: mocks.getValidAccessToken }));

const AUTH = { Authorization: 'Bearer good' };

beforeEach(() => {
  mocks.db.store.clear();
  mocks.send.mockReset();
  mocks.send.mockResolvedValue({ data: { id: 'email_1' }, error: null });
  mocks.getValidAccessToken.mockReset();
  mocks.getValidAccessToken.mockResolvedValue(null);
  mocks.verifyIdToken.mockReset();
  mocks.verifyIdToken.mockResolvedValue({ uid: 'u1', email: 'anna@example.com', name: 'Anna' });
  process.env.RESEND_API_KEY = 're_dummy';
  process.env.NEXT_PUBLIC_APP_URL = 'https://app.unfract.com';
});

describe('inviti alle organizzazioni', () => {
  it('403 se chi invita non fa parte dell’organizzazione', async () => {
    mocks.db.store.set('organizations/o1', { name: 'Acme', ownerId: 'other', memberUids: ['other'] });
    const { POST } = await import('@/app/api/email/invite/route');
    const response = await POST(jsonRequest('http://localhost/api/email/invite', { orgId: 'o1', email: 'new@example.com' }, AUTH));
    expect(response.status).toBe(403);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('nome, mittente e link li decide il server', async () => {
    mocks.db.store.set('organizations/o1', { name: 'Acme', ownerId: 'u1', memberUids: ['u1'] });
    const { POST } = await import('@/app/api/email/invite/route');
    const response = await POST(jsonRequest('http://localhost/api/email/invite', {
      orgId: 'o1', email: 'new@example.com',
      inviteLink: 'https://evil.example/phish', orgName: 'Banca', inviterName: 'Supporto',
    }, AUTH));

    expect(response.status).toBe(200);
    const sent = mocks.send.mock.calls[0][0];
    expect(sent.to).toBe('new@example.com');
    // Il link porta un codice casuale, non l'ID dell'organizzazione.
    expect(sent.html).toMatch(/https:\/\/app\.unfract\.com\/invite\/[A-Za-z0-9_-]{32}"/);
    expect(sent.html).not.toContain('/invite/o1');
    expect(sent.html).not.toContain('evil.example');
    expect(sent.html).not.toContain('Banca');
  });

  it('400 con un indirizzo non valido', async () => {
    const { POST } = await import('@/app/api/email/invite/route');
    const response = await POST(jsonRequest('http://localhost/api/email/invite', { orgId: 'o1', email: 'non-una-email' }, AUTH));
    expect(response.status).toBe(400);
  });
});

describe('email all’ospite di un evento', () => {
  const times = { startISO: '2026-10-07T08:00:00.000Z', endISO: '2026-10-07T09:00:00.000Z', timeZone: 'Europe/Rome' };

  it('404 se l’evento non è nel calendario dell’utente', async () => {
    mocks.db.store.set('users/other/events/e1', { title: 'Altrui', guestEmail: 'x@example.com' });
    const { POST } = await import('@/app/api/calendar/notify/route');
    const response = await POST(jsonRequest('http://localhost/api/calendar/notify', { eventId: 'e1', action: 'create', ...times }, AUTH));
    expect(response.status).toBe(404);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('spedisce all’ospite salvato nell’evento, non a quello mandato dal client', async () => {
    mocks.db.store.set('users/u1/events/e1', { title: 'Riunione', guestEmail: 'ospite@example.com', startTime: '10:00', endTime: '11:00' });
    const { POST } = await import('@/app/api/calendar/notify/route');
    const response = await POST(jsonRequest('http://localhost/api/calendar/notify', {
      eventId: 'e1', action: 'create', guestEmail: 'vittima@example.com', ...times,
    }, AUTH));

    expect(response.status).toBe(200);
    const sent = mocks.send.mock.calls[0][0];
    expect(sent.to).toEqual(['ospite@example.com']);
    expect(sent.subject).toBe('Invito: Riunione');
    const ics = Buffer.from(sent.attachments[0].content, 'base64').toString();
    expect(ics).toContain('DTSTART:20261007T080000Z');
  });

  it('un a capo nel titolo non aggiunge righe all’invito né all’oggetto', async () => {
    mocks.db.store.set('users/u1/events/e1', {
      title: 'Riunione\r\nATTENDEE:mailto:intruso@example.com',
      description: 'Ordine; del giorno,\nsecondo punto',
      guestEmail: 'ospite@example.com',
    });
    const { POST } = await import('@/app/api/calendar/notify/route');
    const response = await POST(jsonRequest('http://localhost/api/calendar/notify', { eventId: 'e1', action: 'create', ...times }, AUTH));

    expect(response.status).toBe(200);
    const sent = mocks.send.mock.calls[0][0];
    expect(sent.subject).not.toMatch(/[\r\n]/);
    const lines = Buffer.from(sent.attachments[0].content, 'base64').toString().split('\r\n');
    expect(lines.some(line => line.startsWith('ATTENDEE'))).toBe(false);
    expect(lines).toContain('SUMMARY:Riunione\\nATTENDEE:mailto:intruso@example.com');
    expect(lines).toContain('DESCRIPTION:Ordine\\; del giorno\\,\\nsecondo punto');
  });
});

describe('sincronizzazione del calendario', () => {
  it('legge il calendario dell’utente del token, non quello della query', async () => {
    const { GET } = await import('@/app/api/calendar/sync/route');
    const response = await GET(new Request('http://localhost/api/calendar/sync?userId=victim&timeMin=a&timeMax=b', { headers: AUTH }));
    expect(response.status).toBe(200);
    expect(mocks.getValidAccessToken).toHaveBeenCalledWith('u1', 'google');
    expect(mocks.getValidAccessToken).not.toHaveBeenCalledWith('victim', expect.anything());
  });
});

describe('avvisi di Google Calendar', () => {
  const googleRequest = (channelId: string, token?: string) => new Request('http://localhost/api/calendar/webhooks/google', {
    method: 'POST',
    headers: {
      'x-goog-channel-id': channelId,
      'x-goog-resource-state': 'exists',
      ...(token ? { 'x-goog-channel-token': token } : {}),
    },
  });

  it('ignora avvisi con il vecchio id costruito sullo userId', async () => {
    const { POST } = await import('@/app/api/calendar/webhooks/google/route');
    await POST(googleRequest('google-webhook-u1'));
    expect(mocks.getValidAccessToken).not.toHaveBeenCalled();
  });

  it('ignora avvisi con il segreto sbagliato', async () => {
    mocks.db.store.set('calendar_channels/ch1', { uid: 'u1', provider: 'google', secret: 'right-secret' });
    const { POST } = await import('@/app/api/calendar/webhooks/google/route');
    await POST(googleRequest('ch1', 'wrong-secret'));
    expect(mocks.getValidAccessToken).not.toHaveBeenCalled();
  });

  it('accetta avvisi con il segreto giusto e usa l’utente del canale', async () => {
    mocks.db.store.set('calendar_channels/ch1', { uid: 'u1', provider: 'google', secret: 'right-secret' });
    const { POST } = await import('@/app/api/calendar/webhooks/google/route');
    await POST(googleRequest('ch1', 'right-secret'));
    expect(mocks.getValidAccessToken).toHaveBeenCalledWith('u1', 'google');
  });
});

describe('avvisi di Microsoft', () => {
  it('ignora una cancellazione con clientState uguale allo userId (vecchio schema)', async () => {
    mocks.db.store.set('users/u1/events/e1', { microsoftEventId: 'ms1' });
    const { POST } = await import('@/app/api/calendar/webhooks/microsoft/route');
    await POST(jsonRequest('http://localhost/api/calendar/webhooks/microsoft', {
      value: [{ subscriptionId: 'sub1', clientState: 'u1', changeType: 'deleted', resourceData: { id: 'ms1' } }],
    }));
    expect(mocks.db.store.has('users/u1/events/e1')).toBe(true);
    expect(mocks.getValidAccessToken).not.toHaveBeenCalled();
  });
});

describe('state OAuth', () => {
  it('si usa una volta sola, per il provider giusto e prima della scadenza', async () => {
    const { createOAuthState, consumeOAuthState } = await import('@/lib/server/oauthState');

    const state = await createOAuthState('u1', 'google');
    expect(await consumeOAuthState(state, 'google')).toBe('u1');
    expect(await consumeOAuthState(state, 'google')).toBeNull();

    const other = await createOAuthState('u1', 'google');
    expect(await consumeOAuthState(other, 'microsoft')).toBeNull();

    const expired = await createOAuthState('u1', 'google');
    mocks.db.store.set(`oauth_states/${expired}`, { uid: 'u1', provider: 'google', expiresAt: Date.now() - 1 });
    expect(await consumeOAuthState(expired, 'google')).toBeNull();

    const forged = Buffer.from(JSON.stringify({ userId: 'u1' })).toString('base64');
    expect(await consumeOAuthState(forged, 'google')).toBeNull();
  });
});

describe('stato dei calendari collegati', () => {
  it('dice quali calendari sono collegati, senza i token', async () => {
    mocks.db.store.set('users/u1/integrations/google', { accessToken: 'secret-access', refreshToken: 'secret-refresh' });
    mocks.db.store.set('users/other/integrations/microsoft', { accessToken: 'altrui' });
    const { GET } = await import('@/app/api/calendar/integrations/route');
    const response = await GET(new Request('http://localhost/api/calendar/integrations', { headers: AUTH }));
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({ google: true, microsoft: false });
    expect(text).not.toContain('secret');
  });
});
