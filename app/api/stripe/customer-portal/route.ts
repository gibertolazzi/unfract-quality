import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { requireUser } from '@/lib/server/auth';
import { adminDb } from '@/lib/firebase-admin';
import { appUrl } from '@/lib/appUrl';

export const runtime = 'nodejs';

/**
 * Funzione di recesso e gestione abbonamento online (Art. 54-bis Codice del Consumo).
 * Consente al consumatore e al cliente business di visualizzare, annullare o
 * recedere dall'abbonamento Stripe con un solo clic.
 */
export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json({ error: 'Gestione abbonamenti non configurata.' }, { status: 500 });
  }

  try {
    const userSnap = await adminDb.collection('users').doc(user.uid).get();
    const userData = userSnap.data();
    let customerId = userData?.stripeCustomerId;

    // Se non presente nel documento utente, controlla se c'è un workspace associato
    if (!customerId) {
      const workspacesSnap = await adminDb.collection('workspaces')
        .where('billing.paidBy', '==', user.uid)
        .limit(1)
        .get();
      if (!workspacesSnap.empty) {
        customerId = workspacesSnap.docs[0].data()?.billing?.stripeCustomerId;
      }
    }

    if (!customerId) {
      return NextResponse.json(
        { error: 'Nessun abbonamento attivo trovato per questo account.' },
        { status: 404 }
      );
    }

    const stripe = new Stripe(secretKey);
    const baseUrl = appUrl();

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}/dashboard`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    console.error('Error creating customer portal session:', error);
    return NextResponse.json(
      { error: 'Impossibile accedere alla gestione abbonamento. Riprova più tardi.' },
      { status: 500 }
    );
  }
}
