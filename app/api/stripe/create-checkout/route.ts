import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { requireUser } from '@/lib/server/auth';
import { isPlanId, PLANS } from '@/lib/stripe/plans';

export const runtime = 'nodejs';

/**
 * Crea la sessione di pagamento Stripe.
 *
 * Il client manda solo il piano (`pro` o `scale`). Prezzo, utente ed email li
 * decide il server: prima arrivavano tutti dal browser, senza login.
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
      metadata: { userId: user.uid, plan },
      subscription_data: { metadata: { userId: user.uid, plan } },
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Error in create-checkout:', error);
    return NextResponse.json({ error: 'Impossibile avviare il pagamento.' }, { status: 500 });
  }
}
