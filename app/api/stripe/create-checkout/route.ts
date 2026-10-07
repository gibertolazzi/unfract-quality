import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { requireUser } from '@/lib/server/auth';
import { isPlanId, PLANS } from '@/lib/stripe/plans';
import { adminDb } from '@/lib/firebase-admin';
import { canManageWorkspace } from '@/lib/server/usage';

export const runtime = 'nodejs';

/**
 * Crea la sessione di pagamento Stripe.
 *
 * Il client manda solo il piano (`pro` o `scale`) e il workspace a cui
 * applicarlo. Prezzo, utente ed email li decide il server: prima arrivavano
 * tutti dal browser, senza login. Il piano lo può cambiare solo chi gestisce
 * il workspace (proprietario o amministratore).
 */
export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    console.error('Checkout not configured: missing STRIPE_SECRET_KEY');
    return NextResponse.json({ error: 'Pagamenti non configurati sul server.' }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const plan = body?.plan;
  if (!isPlanId(plan)) {
    return NextResponse.json({ error: 'Piano non valido.' }, { status: 400 });
  }

  const rawQuantity = body?.quantity ?? 1;
  const quantity = Number.isInteger(rawQuantity) && rawQuantity >= 1 && rawQuantity <= 1000 ? rawQuantity : NaN;
  if (Number.isNaN(quantity)) {
    return NextResponse.json({ error: 'Quantità non valida.' }, { status: 400 });
  }

  const workspaceId = typeof body?.workspaceId === 'string' ? body.workspaceId : '';
  if (!(await canManageWorkspace(user.uid, workspaceId))) {
    return NextResponse.json({ error: 'Il piano lo può cambiare solo il proprietario o un amministratore del workspace.' }, { status: 403 });
  }
  const billing = (await adminDb.collection('workspaces').doc(workspaceId).get()).data()?.billing;
  if (['active', 'trialing', 'past_due'].includes(billing?.subscriptionStatus)) {
    return NextResponse.json({ error: 'Questo workspace ha già un abbonamento attivo.' }, { status: 409 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;

  try {
    const stripe = new Stripe(secretKey);
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      allow_promotion_codes: true,
      tax_id_collection: { enabled: true },
      customer_email: user.email || undefined,
      line_items: [{ price: PLANS[plan].priceId, quantity }],
      success_url: `${appUrl}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/dashboard`,
      metadata: { userId: user.uid, plan, workspaceId },
      subscription_data: { metadata: { userId: user.uid, plan, workspaceId } },
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Error in create-checkout:', error);
    return NextResponse.json({ error: 'Impossibile avviare il pagamento.' }, { status: 500 });
  }
}
