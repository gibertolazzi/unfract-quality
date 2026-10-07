import Stripe from 'stripe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { jsonRequest } from '../helpers/fakeFirestore';
import { PLANS } from '@/lib/stripe/plans';

const mocks = vi.hoisted(() => {
  return {
    verifyIdToken: vi.fn(),
    db: undefined as any,
    listLineItems: vi.fn(),
    createSession: vi.fn(),
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

// Stripe vero per firma e verifica dei webhook; finte solo le chiamate di rete.
vi.mock('stripe', async importOriginal => {
  const actual: any = await importOriginal();
  const RealStripe = actual.default;
  class FakeStripe extends RealStripe {
    constructor(key: string) {
      super(key);
      (this as any).checkout = { sessions: { listLineItems: mocks.listLineItems, create: mocks.createSession } };
    }
  }
  Object.assign(FakeStripe, RealStripe);
  return { ...actual, default: FakeStripe };
});

const WEBHOOK_SECRET = 'whsec_test_secret';

function signedRequest(event: object, secret = WEBHOOK_SECRET) {
  const payload = JSON.stringify(event);
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret });
  return new Request('http://localhost/api/stripe/webhook', {
    method: 'POST',
    headers: { 'stripe-signature': header, 'Content-Type': 'application/json' },
    body: payload,
  });
}

const completed = (metadata: Record<string, string>) => ({
  id: 'evt_1',
  object: 'event',
  type: 'checkout.session.completed',
  data: { object: { id: 'cs_1', object: 'checkout.session', customer: 'cus_1', subscription: 'sub_1', metadata } },
});

const subscriptionEvent = (type: string, { status, priceId }: { status: string; priceId?: string }) => ({
  id: 'evt_2',
  object: 'event',
  type,
  data: { object: {
    id: 'sub_1', object: 'subscription', customer: 'cus_1', status,
    metadata: { userId: 'u1', workspaceId: 'w1' },
    items: { object: 'list', data: priceId ? [{ price: { id: priceId } }] : [] },
  } },
});

describe('webhook Stripe', () => {
  beforeEach(() => {
    mocks.db.store.clear();
    mocks.listLineItems.mockReset();
    process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
    process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
  });

  it('500 se il secret non è configurato, senza elaborare', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const { POST } = await import('@/app/api/stripe/webhook/route');
    const response = await POST(signedRequest(completed({ userId: 'u1' })));
    expect(response.status).toBe(500);
    expect(mocks.db.store.size).toBe(0);
  });

  it('400 senza firma: il messaggio non viene creduto', async () => {
    const { POST } = await import('@/app/api/stripe/webhook/route');
    const response = await POST(new Request('http://localhost/api/stripe/webhook', {
      method: 'POST',
      body: JSON.stringify(completed({ userId: 'u1', plan: 'scale' })),
    }));
    expect(response.status).toBe(400);
    expect(mocks.db.store.size).toBe(0);
  });

  it('400 con firma fatta con un altro secret', async () => {
    const { POST } = await import('@/app/api/stripe/webhook/route');
    const response = await POST(signedRequest(completed({ userId: 'u1' }), 'whsec_attacker'));
    expect(response.status).toBe(400);
    expect(mocks.db.store.size).toBe(0);
  });

  it('attiva il piano del prezzo pagato, non quello scritto nei metadata', async () => {
    mocks.listLineItems.mockResolvedValue({ data: [{ price: { id: PLANS.pro.priceId } }] });
    const { POST } = await import('@/app/api/stripe/webhook/route');
    const response = await POST(signedRequest(completed({ userId: 'u1', plan: 'scale', planName: 'scale' })));
    expect(response.status).toBe(200);
    expect(mocks.db.store.get('users/u1')).toMatchObject({ plan: 'pro', subscriptionStatus: 'active' });
  });

  it('il piano pagato alza i limiti del workspace scelto, i contatori restano', async () => {
    mocks.db.store.set('workspaces/w1', { name: 'Acme', ownerId: 'u1', quotas: { planTier: 'free', storageUsed: 42, storageLimit: 1_000_000_000, aiCreditsUsed: 7, aiCreditsLimit: 120 } });
    mocks.listLineItems.mockResolvedValue({ data: [{ price: { id: PLANS.pro.priceId } }] });
    const { POST } = await import('@/app/api/stripe/webhook/route');
    const response = await POST(signedRequest(completed({ userId: 'u1', workspaceId: 'w1' })));
    expect(response.status).toBe(200);
    const ws = mocks.db.store.get('workspaces/w1');
    expect(ws.quotas).toMatchObject({ planTier: 'pro', storageLimit: 15_000_000_000, aiCreditsLimit: 1200, storageUsed: 42, aiCreditsUsed: 7 });
    expect(ws.billing).toMatchObject({ plan: 'pro', paidBy: 'u1', stripeSubscriptionId: 'sub_1', subscriptionStatus: 'active' });
  });

  it('abbonamento finito: il workspace torna ai limiti free', async () => {
    mocks.db.store.set('workspaces/w1', { ownerId: 'u1', quotas: { planTier: 'pro', storageUsed: 5, storageLimit: 15_000_000_000, aiCreditsUsed: 0, aiCreditsLimit: 1200 }, billing: { stripeSubscriptionId: 'sub_1', subscriptionStatus: 'active' } });
    const { POST } = await import('@/app/api/stripe/webhook/route');
    const response = await POST(signedRequest(subscriptionEvent('customer.subscription.deleted', { status: 'canceled' })));
    expect(response.status).toBe(200);
    const ws = mocks.db.store.get('workspaces/w1');
    expect(ws.quotas).toMatchObject({ planTier: 'free', storageLimit: 1_000_000_000, aiCreditsLimit: 120, storageUsed: 5 });
    expect(ws.billing.subscriptionStatus).toBe('canceled');
  });

  it('cambio di piano: vale il prezzo in corso; pagamento in ritardo: il piano resta', async () => {
    mocks.db.store.set('workspaces/w1', { ownerId: 'u1', quotas: { planTier: 'pro', storageLimit: 15_000_000_000, aiCreditsLimit: 1200 }, billing: { stripeSubscriptionId: 'sub_1', subscriptionStatus: 'active' } });
    const { POST } = await import('@/app/api/stripe/webhook/route');
    await POST(signedRequest(subscriptionEvent('customer.subscription.updated', { status: 'active', priceId: PLANS.scale.priceId })));
    expect(mocks.db.store.get('workspaces/w1').quotas.planTier).toBe('scale');
    await POST(signedRequest(subscriptionEvent('customer.subscription.updated', { status: 'past_due', priceId: PLANS.scale.priceId })));
    expect(mocks.db.store.get('workspaces/w1').quotas.planTier).toBe('scale');
    expect(mocks.db.store.get('workspaces/w1').billing.subscriptionStatus).toBe('past_due');
  });

  it('l’evento di un vecchio abbonamento non tocca quello attuale', async () => {
    mocks.db.store.set('workspaces/w1', { ownerId: 'u1', quotas: { planTier: 'scale', storageLimit: 100_000_000_000, aiCreditsLimit: 2500 }, billing: { stripeSubscriptionId: 'sub_2', subscriptionStatus: 'active' } });
    const { POST } = await import('@/app/api/stripe/webhook/route');
    await POST(signedRequest(subscriptionEvent('customer.subscription.deleted', { status: 'canceled' })));
    expect(mocks.db.store.get('workspaces/w1').quotas.planTier).toBe('scale');
  });

  it('non attiva nulla se il prezzo non corrisponde a un piano', async () => {
    mocks.listLineItems.mockResolvedValue({ data: [{ price: { id: 'price_unknown' } }] });
    const { POST } = await import('@/app/api/stripe/webhook/route');
    const response = await POST(signedRequest(completed({ userId: 'u1' })));
    expect(response.status).toBe(200);
    expect(mocks.db.store.has('users/u1')).toBe(false);
  });
});

describe('checkout Stripe', () => {
  beforeEach(() => {
    mocks.createSession.mockReset();
    mocks.createSession.mockResolvedValue({ id: 'cs_1', url: 'https://checkout.stripe.com/x' });
    mocks.verifyIdToken.mockReset();
    mocks.verifyIdToken.mockResolvedValue({ uid: 'u1', email: 'anna@example.com', name: 'Anna' });
    process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
    mocks.db.store.clear();
    mocks.db.store.set('workspaces/w1', { name: 'Acme', ownerId: 'u1' });
    mocks.db.store.set('workspaces/w2', { name: 'Altro', ownerId: 'u9' });
    mocks.db.store.set('access_grants/w2_u1', { subjectType: 'user', subjectId: 'u1', resourceType: 'workspace', workspaceId: 'w2', role: 'member' });
  });

  it('usa il prezzo del server e l’utente del token, ignorando ciò che manda il client', async () => {
    const { POST } = await import('@/app/api/stripe/create-checkout/route');
    const response = await POST(jsonRequest('http://localhost/api/stripe/create-checkout',
      { plan: 'scale', workspaceId: 'w1', priceId: 'price_cheap', userId: 'someone-else', planName: 'pro' },
      { Authorization: 'Bearer good' }));

    expect(response.status).toBe(200);
    const args = mocks.createSession.mock.calls[0][0];
    expect(args.line_items).toEqual([{ price: PLANS.scale.priceId, quantity: 1 }]);
    expect(args.metadata).toEqual({ userId: 'u1', plan: 'scale', workspaceId: 'w1' });
    expect(args.subscription_data.metadata).toEqual({ userId: 'u1', plan: 'scale', workspaceId: 'w1' });
    expect(args.customer_email).toBe('anna@example.com');
  });

  it('403 se l’utente non gestisce il workspace (membro semplice o workspace mancante)', async () => {
    const { POST } = await import('@/app/api/stripe/create-checkout/route');
    for (const workspaceId of ['w2', 'nessuno', undefined]) {
      const response = await POST(jsonRequest('http://localhost/api/stripe/create-checkout', { plan: 'pro', workspaceId }, { Authorization: 'Bearer good' }));
      expect(response.status).toBe(403);
    }
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it('409 se il workspace ha già un abbonamento attivo', async () => {
    mocks.db.store.get('workspaces/w1').billing = { subscriptionStatus: 'active' };
    const { POST } = await import('@/app/api/stripe/create-checkout/route');
    const response = await POST(jsonRequest('http://localhost/api/stripe/create-checkout', { plan: 'pro', workspaceId: 'w1' }, { Authorization: 'Bearer good' }));
    expect(response.status).toBe(409);
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it('400 con un piano sconosciuto', async () => {
    const { POST } = await import('@/app/api/stripe/create-checkout/route');
    const response = await POST(jsonRequest('http://localhost/api/stripe/create-checkout', { plan: 'enterprise' }, { Authorization: 'Bearer good' }));
    expect(response.status).toBe(400);
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it('400 con una quantità non valida', async () => {
    const { POST } = await import('@/app/api/stripe/create-checkout/route');
    const response = await POST(jsonRequest('http://localhost/api/stripe/create-checkout', { plan: 'pro', quantity: -3, workspaceId: 'w1' }, { Authorization: 'Bearer good' }));
    expect(response.status).toBe(400);
  });
});
