import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/firebase', () => ({
  auth: { currentUser: null },
  db: {},
}));

vi.mock('@/lib/firebase-admin', async () => {
  const { createFakeDb } = await import('../helpers/fakeFirestore');
  return {
    adminAuth: { verifyIdToken: vi.fn() },
    adminDb: createFakeDb(),
  };
});

describe('Validazione checksum Partita IVA (client & server)', () => {
  it('riconosce partite IVA italiane valide', async () => {
    const { validateItalianVatChecksum } = await import('@/lib/crm/vatService');
    // P.IVA note/reali valide per test
    expect(validateItalianVatChecksum('00743110157')).toBe(true);
    expect(validateItalianVatChecksum('IT00743110157')).toBe(true);
    expect(validateItalianVatChecksum(' 00743110157 ')).toBe(true);
  });

  it('rifiuta partite IVA con checksum errato', async () => {
    const { validateItalianVatChecksum } = await import('@/lib/crm/vatService');
    expect(validateItalianVatChecksum('00743110158')).toBe(false);
    expect(validateItalianVatChecksum('12345678901')).toBe(false);
    expect(validateItalianVatChecksum('00000000000')).toBe(false);
    expect(validateItalianVatChecksum('123')).toBe(false);
  });
});

describe('Route /api/crm/vat/lookup', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.FIREBASE_WEB_API_KEY = 'test-key';
  });

  it('rifiuta richieste non autenticate con 401', async () => {
    const { POST } = await import('@/app/api/crm/vat/lookup/route');
    const req = new Request('http://localhost:3000/api/crm/vat/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vatNumber: '00743110157' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('in caso di errore interno (500) non espone details o messaggi interni al browser (S22)', async () => {
    const { POST } = await import('@/app/api/crm/vat/lookup/route');
    const requestBody = await import('@/lib/server/requestBody');
    vi.spyOn(requestBody, 'readJsonObject').mockRejectedValueOnce(
      new Error('Internal database/credential leak error')
    );

    // Mock guardRequest bypass per arrivare al blocco try/catch dell'elaborazione
    const serverAuth = await import('@/lib/crm/prospect/serverAuth');
    vi.spyOn(serverAuth, 'guardRequest').mockResolvedValueOnce({ ok: true, uid: 'u1' });

    const req = new Request('http://localhost:3000/api/crm/vat/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
      body: JSON.stringify({ vatNumber: '00743110157' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe('Errore interno del server durante la verifica.');
    expect(data.details).toBeUndefined();
    expect(JSON.stringify(data)).not.toContain('Internal database/credential leak');
  });
});
