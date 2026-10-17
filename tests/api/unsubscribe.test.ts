import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeDb } from '../helpers/fakeFirestore';
import {
  generateUnsubscribeToken,
  buildUnsubscribeUrl,
} from '@/lib/server/emailUnsubscribe';

const mocks = vi.hoisted(() => ({
  db: undefined as any,
}));

vi.mock('@/lib/firebase-admin', async () => {
  const { createFakeDb } = await import('../helpers/fakeFirestore');
  mocks.db = createFakeDb();
  return { adminAuth: {}, adminDb: mocks.db };
});

describe('Route /api/email/unsubscribe (Problema A e B)', () => {
  beforeEach(async () => {
    await import('@/lib/firebase-admin');
    mocks.db.store.clear();
  });

  describe('Problema A: Protezione XSS', () => {
    it('non esegue codice iniettato e ripulisce/escapa l’email nella risposta HTML', async () => {
      const { GET } = await import('@/app/api/email/unsubscribe/route');
      const maliciousPayload = '<script>alert(1)</script>';
      const token = generateUnsubscribeToken(maliciousPayload);

      const req = new Request(
        `http://localhost:3000/api/email/unsubscribe?email=${encodeURIComponent(maliciousPayload)}&token=${token}`
      );
      const res = await GET(req);
      const text = await res.text();

      // Il payload non deve mai comparire non-escaped
      expect(text).not.toContain('<script>alert(1)</script>');
      expect(text).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    });

    it('rifiuta e non riflette payload XSS se la firma non è valida', async () => {
      const { GET } = await import('@/app/api/email/unsubscribe/route');
      const maliciousPayload = '"><img src=x onerror=alert(1)>';

      const req = new Request(
        `http://localhost:3000/api/email/unsubscribe?email=${encodeURIComponent(maliciousPayload)}&token=invalid-token`
      );
      const res = await GET(req);
      expect(res.status).toBe(400);
      const text = await res.text();

      expect(text).not.toContain('<img src=x onerror=alert(1)>');
    });
  });

  describe('Problema B: Link firmato e prevenzione disiscrizioni accidentali', () => {
    it('GET: rifiuta link non firmati o con token manomesso (status 400)', async () => {
      const { GET } = await import('@/app/api/email/unsubscribe/route');
      const req = new Request('http://localhost:3000/api/email/unsubscribe?email=user@example.com');
      const res = await GET(req);

      expect(res.status).toBe(400);
      expect(mocks.db.store.has('unsubscribes/user@example.com')).toBe(false);
    });

    it('GET: non disiscrive all’apertura (antivirus/anteprima), ma mostra form di conferma', async () => {
      const { GET } = await import('@/app/api/email/unsubscribe/route');
      const email = 'client@domain.com';
      const token = generateUnsubscribeToken(email);

      const req = new Request(`http://localhost:3000/api/email/unsubscribe?email=${email}&token=${token}`);
      const res = await GET(req);

      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain('Conferma disiscrizione');
      expect(text).toContain('form method="POST"');

      // Cruciale per il Problema B: la GET NON deve scrivere su Firestore!
      expect(mocks.db.store.has(`unsubscribes/${email}`)).toBe(false);
    });

    it('POST (Form Web): disiscrive solo alla conferma esplicita dell’utente', async () => {
      const { POST } = await import('@/app/api/email/unsubscribe/route');
      const email = 'client@domain.com';
      const token = generateUnsubscribeToken(email);

      const formData = new FormData();
      formData.set('email', email);
      formData.set('token', token);

      const req = new Request('http://localhost:3000/api/email/unsubscribe', {
        method: 'POST',
        body: formData,
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain('Disiscrizione completata');

      // Salvataggio avvenuto su unsubscribes
      const saved = mocks.db.store.get(`unsubscribes/${email}`);
      expect(saved).toBeDefined();
      expect(saved.email).toBe(email);
      expect(saved.source).toBe('web_confirmation');
    });

    it('POST (RFC 8058 One-Click): supporta la disiscrizione con un clic dei client di posta', async () => {
      const { POST } = await import('@/app/api/email/unsubscribe/route');
      const email = 'oneclick@domain.com';
      const token = generateUnsubscribeToken(email);

      const formData = new FormData();
      formData.set('List-Unsubscribe', 'One-Click');

      const req = new Request(
        `http://localhost:3000/api/email/unsubscribe?email=${email}&token=${token}`,
        {
          method: 'POST',
          body: formData,
          headers: {
            'Accept': 'application/json',
          },
        }
      );

      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.unsubscribed).toBe(true);

      const saved = mocks.db.store.get(`unsubscribes/${email}`);
      expect(saved).toBeDefined();
      expect(saved.source).toBe('one_click_header');
    });

    it('POST: rifiuta tentativo di disiscrivere un’altra persona con un token non suo', async () => {
      const { POST } = await import('@/app/api/email/unsubscribe/route');
      const victimEmail = 'victim@domain.com';
      const attackerToken = generateUnsubscribeToken('attacker@domain.com');

      const formData = new FormData();
      formData.set('email', victimEmail);
      formData.set('token', attackerToken);

      const req = new Request('http://localhost:3000/api/email/unsubscribe', {
        method: 'POST',
        body: formData,
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      expect(mocks.db.store.has(`unsubscribes/${victimEmail}`)).toBe(false);
    });
  });
});
