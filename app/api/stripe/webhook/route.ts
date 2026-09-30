import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb } from '@/lib/firebase-admin';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(req: Request) {
  const payload = await req.text();
  const signature = req.headers.get('stripe-signature');

  let event;

  try {
    if (!signature || !endpointSecret) {
      console.warn("⚠️ Webhook secret non configurato o firma assente, bypasso la validazione.");
      event = JSON.parse(payload);
    } else {
      event = stripe.webhooks.constructEvent(payload, signature, endpointSecret);
    }
  } catch (err: any) {
    console.error('Webhook signature verification failed.', err.message);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      
      if (userId) {
        console.log(`✅ Successo! Aggiornamento piano per l'utente: ${userId}`);
        
        // Identifica il piano in base al prezzo pagato
        // Pro = 10 euro (1000 centesimi), Scale = 25 euro (2500 centesimi)
        // Nota: session.amount_total contiene il totale moltiplicato per i membri del team
        // Per sicurezza, guardiamo il line_items o semplicemente facciamo un controllo sul totale.
        // Poiché usiamo i checkout, per distinguere i piani l'ideale sarebbe averli in metadata.
        // Al momento usiamo una stima, ma puoi aggiornare il metadata alla creazione del checkout.
        const planType = session.metadata?.planName || 'pro';

        await adminDb.collection('users').doc(userId).set({
          plan: planType,
          stripeCustomerId: session.customer,
          stripeSubscriptionId: session.subscription,
          subscriptionStatus: 'active',
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }
      break;
    
    case 'customer.subscription.deleted':
    case 'customer.subscription.updated':
      // Se l'utente cancella l'abbonamento
      const subscription = event.data.object as Stripe.Subscription;
      // Cerchiamo l'utente tramite stripeCustomerId
      const usersRef = await adminDb.collection('users').where('stripeCustomerId', '==', subscription.customer).get();
      if (!usersRef.empty) {
        const userDoc = usersRef.docs[0];
        if (subscription.status === 'canceled') {
          await userDoc.ref.update({
            plan: 'free',
            subscriptionStatus: 'canceled'
          });
          console.log(`❌ Abbonamento cancellato per l'utente ${userDoc.id}`);
        }
      }
      break;

    default:
      console.log(`ℹ️ Evento ricevuto e ignorato: ${event.type}`);
  }

  return NextResponse.json({ received: true });
}
