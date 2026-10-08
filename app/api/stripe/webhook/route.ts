import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb } from '@/lib/firebase-admin';
import { planForPrice } from '@/lib/stripe/plans';
import { applyWorkspacePlan } from '@/lib/server/usage';

export const runtime = 'nodejs';

/**
 * Webhook di Stripe.
 *
 * La firma è sempre obbligatoria. Prima, se mancava l'header
 * `stripe-signature` o il secret, il messaggio veniva accettato così com'era:
 * chiunque poteva fingersi Stripe e attivare un piano a pagamento.
 *
 * Il piano attivato dipende dal prezzo effettivamente pagato, non dai metadata.
 * I limiti (spazio, crediti AI) passano al workspace scelto al checkout; se
 * l'abbonamento finisce, il workspace torna ai limiti free.
 */

/** Stati in cui l'abbonamento non dà più diritto al piano. */
const ENDED = ['canceled', 'unpaid', 'incomplete_expired'];
export async function POST(req: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secretKey || !endpointSecret) {
    console.error('Stripe webhook not configured: missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET');
    return NextResponse.json({ error: 'Webhook non configurato.' }, { status: 500 });
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Firma mancante.' }, { status: 400 });
  }

  const stripe = new Stripe(secretKey);
  const payload = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed.', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Firma non valida.' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        if (!userId) break;

        const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 10 });
        const plan = lineItems.data.map(item => planForPrice(item.price?.id)).find(Boolean) || null;
        if (!plan) {
          console.error(`Checkout ${session.id}: nessun prezzo corrisponde a un piano noto, piano non attivato.`);
          break;
        }

        await adminDb.collection('users').doc(userId).set({
          plan,
          stripeCustomerId: session.customer,
          stripeSubscriptionId: session.subscription,
          subscriptionStatus: 'active',
          updatedAt: new Date().toISOString(),
        }, { merge: true });

        const workspaceId = session.metadata?.workspaceId;
        if (workspaceId) {
          const applied = await applyWorkspacePlan(workspaceId, plan, {
            plan,
            paidBy: userId,
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription,
            subscriptionStatus: 'active',
          });
          if (!applied) console.error(`Checkout ${session.id}: workspace ${workspaceId} non trovato, limiti non aggiornati.`);
        } else {
          console.error(`Checkout ${session.id}: nessun workspace nei metadata, limiti non aggiornati.`);
        }
        console.log(`Piano ${plan} attivato per l'utente ${userId}${workspaceId ? ` sul workspace ${workspaceId}` : ''}`);
        break;
      }

      case 'customer.subscription.deleted':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const ended = event.type === 'customer.subscription.deleted' || ENDED.includes(subscription.status);
        const usersRef = await adminDb.collection('users').where('stripeCustomerId', '==', subscription.customer).get();
        if (!usersRef.empty && ended) {
          const userDoc = usersRef.docs[0];
          await userDoc.ref.update({ plan: 'free', subscriptionStatus: subscription.status });
          console.log(`Abbonamento cancellato per l'utente ${userDoc.id}`);
        }

        const workspaceId = subscription.metadata?.workspaceId;
        if (workspaceId) {
          // Attivo: il piano del prezzo in corso (anche dopo un cambio di piano).
          // Finito: limiti free. Altri stati (es. pagamento in ritardo): si
          // aggiorna solo lo stato, Stripe riprova a incassare.
          const paidPlan = (subscription.items?.data || []).map(item => planForPrice(item.price?.id)).find(Boolean) || null;
          const tier = ended ? 'free' : ['active', 'trialing'].includes(subscription.status) ? paidPlan : null;
          await applyWorkspacePlan(workspaceId, tier, {
            ...(tier ? { plan: tier } : {}),
            subscriptionStatus: ended ? 'canceled' : subscription.status,
          }, { onlySubscription: subscription.id });
        }
        break;
      }

      default:
        console.log(`Evento Stripe ignorato: ${event.type}`);
    }
  } catch (error) {
    // 500 così Stripe riprova: la firma era valida, il problema è nostro.
    console.error('Stripe webhook processing error:', error);
    return NextResponse.json({ error: 'Elaborazione non riuscita.' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
