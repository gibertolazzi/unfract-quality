import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeDb, jsonRequest } from '../helpers/fakeFirestore';

const mocks = vi.hoisted(() => ({
  db: undefined as any,
}));

vi.mock('@/lib/firebase-admin', async () => {
  const { createFakeDb } = await import('../helpers/fakeFirestore');
  mocks.db = createFakeDb();
  return { adminAuth: {}, adminDb: mocks.db };
});

describe('Route /api/dsa/report (Problema D: Segnalazione DSA pubblica e protetta)', () => {
  beforeEach(async () => {
    await import('@/lib/firebase-admin');
    mocks.db.store.clear();
  });

  const validReport = {
    contentLocation: 'https://app.unfract.com/documentation/doc-123',
    reason: 'Questo documento viola i diritti di proprietà intellettuale.',
    category: 'copyright',
    claimantName: 'Mario Rossi',
    claimantEmail: 'mario.rossi@example.com',
    goodFaithConfirmed: true,
  };

  it('funziona pubblicamente senza autenticazione (richiesto da Art. 16 DSA)', async () => {
    const { POST } = await import('@/app/api/dsa/report/route');
    const req = jsonRequest('http://localhost:3000/api/dsa/report', validReport);

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.reportId).toBeDefined();

    // Verifichiamo che sia salvato nel DB
    const reportKey = Array.from(mocks.db.store.keys()).find(k => String(k).startsWith('dsa_reports/')) as string | undefined;
    expect(reportKey).toBeDefined();
    const saved = mocks.db.store.get(reportKey!);
    expect(saved.contentLocation).toBe(validReport.contentLocation);
    expect(saved.claimantEmail).toBe(validReport.claimantEmail);
    expect(saved.status).toBe('pending_review');
  });

  it('rifiuta richieste con Content-Length superiore a 64 KB (status 413)', async () => {
    const { POST } = await import('@/app/api/dsa/report/route');
    const req = new Request('http://localhost:3000/api/dsa/report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'content-length': '70000', // 70 KB
      },
      body: JSON.stringify(validReport),
    });

    const res = await POST(req);
    expect(res.status).toBe(413);
    const data = await res.json();
    expect(data.error).toContain('limite consentito');
  });

  it('applica rate limiting per IP (status 429 dopo 5 richieste)', async () => {
    const { POST } = await import('@/app/api/dsa/report/route');
    const ip = '198.51.100.42';

    for (let i = 0; i < 5; i++) {
      const req = jsonRequest('http://localhost:3000/api/dsa/report', validReport, {
        'x-forwarded-for': ip,
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
    }

    // La sesta richiesta dallo stesso IP deve ricevere 429
    const spamReq = jsonRequest('http://localhost:3000/api/dsa/report', validReport, {
      'x-forwarded-for': ip,
    });
    const spamRes = await POST(spamReq);
    expect(spamRes.status).toBe(429);
    const data = await spamRes.json();
    expect(data.error).toContain('Troppe segnalazioni');
  });

  it('rifiuta campi che superano i limiti massimi di lunghezza (status 400)', async () => {
    const { POST } = await import('@/app/api/dsa/report/route');

    // contentLocation > 1000 caratteri
    const reqLongLocation = jsonRequest('http://localhost:3000/api/dsa/report', {
      ...validReport,
      contentLocation: 'a'.repeat(1001),
    }, { 'x-forwarded-for': '10.0.0.1' });
    const resLocation = await POST(reqLongLocation);
    expect(resLocation.status).toBe(400);

    // reason > 5000 caratteri
    const reqLongReason = jsonRequest('http://localhost:3000/api/dsa/report', {
      ...validReport,
      reason: 'x'.repeat(5001),
    }, { 'x-forwarded-for': '10.0.0.2' });
    const resReason = await POST(reqLongReason);
    expect(resReason.status).toBe(400);

    // reason < 10 caratteri
    const reqShortReason = jsonRequest('http://localhost:3000/api/dsa/report', {
      ...validReport,
      reason: 'troppo',
    }, { 'x-forwarded-for': '10.0.0.3' });
    const resShortReason = await POST(reqShortReason);
    expect(resShortReason.status).toBe(400);

    // claimantName > 200 caratteri
    const reqLongName = jsonRequest('http://localhost:3000/api/dsa/report', {
      ...validReport,
      claimantName: 'n'.repeat(201),
    }, { 'x-forwarded-for': '10.0.0.4' });
    const resName = await POST(reqLongName);
    expect(resName.status).toBe(400);

    // claimantEmail non valida
    const reqInvalidEmail = jsonRequest('http://localhost:3000/api/dsa/report', {
      ...validReport,
      claimantEmail: 'non-un-email',
    }, { 'x-forwarded-for': '10.0.0.5' });
    const resEmail = await POST(reqInvalidEmail);
    expect(resEmail.status).toBe(400);
  });
});
