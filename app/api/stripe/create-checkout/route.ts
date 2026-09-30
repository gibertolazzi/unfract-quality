import { NextResponse } from 'next/server';
import Stripe from 'stripe';


export async function POST(req: any) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return new Response(JSON.stringify({ error: 'Manca la chiave STRIPE_SECRET_KEY nel server.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, undefined);
  try {
    const { priceId, userId, userEmail, quantity, planName } = await req.json();

    if (!priceId) {
      return NextResponse.json({ error: 'Manca priceId.' }, { status: 400 });
    }
    
    if (!userId) {
      return NextResponse.json({ error: 'Devi effettuare il login per abbonarti.' }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      allow_promotion_codes: true,
      tax_id_collection: {
        enabled: true,
      },
      customer_email: userEmail || undefined,
      line_items: [
        {
          price: priceId,
          quantity: quantity || 1, // Calcolato in base al numero di utenti del team
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard`,
      metadata: {
        userId: userId,
        planName: planName || 'pro',
      },
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (err: any) {
    console.error('Error in create-checkout:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
