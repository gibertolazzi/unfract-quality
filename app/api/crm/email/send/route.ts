import { NextResponse } from 'next/server';
import { Resend } from 'resend';

/**
 * Invio email del CRM.
 *
 * È l'unica route server del modulo, e l'unico punto in cui la deroga 2
 * («solo frontend») non regge: la chiave Resend non può stare nel browser,
 * perché chiunque apra gli strumenti di sviluppo la leggerebbe e potrebbe
 * spedire dal dominio dell'azienda.
 *
 * DIFFERENZE VOLUTE da app/api/email/send/route.ts già presente nel prodotto:
 *
 * 1. Qui serve autenticazione. Quella route accetta chiunque conosca l'URL:
 *    è un relay aperto sul dominio notifications@unfract.com. Vedi
 *    docs/SEGNALAZIONI-TEAM.md.
 * 2. Nessun valore di ripiego per le chiavi. Se mancano, la route risponde 500
 *    e lo dice: un default nel codice è una chiave pubblicata.
 * 3. Chiave di idempotenza: un doppio clic o un retry non spediscono due volte.
 *
 * COSA QUESTA ROUTE NON PUÒ FARE: verificare il consenso del destinatario.
 * Senza SDK admin non legge Firestore, quindi il controllo su consenso e
 * soppressione avviene nel browser prima della chiamata ed è falsificabile da
 * chi sa costruire una richiesta. Vedi docs/EMAIL.md e docs/DEROGHE.md.
 */

export const runtime = 'nodejs';

/** Verifica l'ID token Firebase senza SDK admin, con la chiave web pubblica. */
async function verifyIdToken(idToken: string, apiKey: string): Promise<{ uid: string; email: string } | null> {
  try {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!response.ok) return null;

    const data = await response.json();
    const user = data?.users?.[0];
    if (!user?.localId) return null;

    return { uid: user.localId, email: user.email || '' };
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return null;
  }
}

/**
 * Chiavi di idempotenza già servite, con il momento in cui sono arrivate.
 *
 * Sta in memoria: su Vercel ogni istanza ha la sua e si azzera a ogni riavvio.
 * Ferma il doppio clic e il retry immediato, NON una duplicazione a distanza di
 * ore o fra istanze diverse. Per quello serve una collezione condivisa, cioè
 * un backend.
 */
const servedKeys = new Map<string, number>();
const IDEMPOTENCY_TTL = 10 * 60 * 1000;

/** Invii per utente, per non trasformare un errore in una campagna. */
const rateWindow = new Map<string, number[]>();
const RATE_LIMIT = 30;
const RATE_WINDOW = 60 * 1000;

function tooManyRequests(uid: string): boolean {
  const now = Date.now();
  const recent = (rateWindow.get(uid) || []).filter(at => now - at < RATE_WINDOW);
  recent.push(now);
  rateWindow.set(uid, recent);
  return recent.length > RATE_LIMIT;
}

function prune() {
  const now = Date.now();
  servedKeys.forEach((at, key) => {
    if (now - at > IDEMPOTENCY_TTL) servedKeys.delete(key);
  });
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

export async function POST(request: any) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const resendKey = process.env.RESEND_API_KEY;
  const firebaseApiKey = process.env.FIREBASE_WEB_API_KEY;
  const fromAddress = process.env.CRM_EMAIL_FROM;

  // Nessun ripiego: senza configurazione la route non spedisce e lo dichiara,
  // invece di partire con una chiave scritta nel codice.
  if (!resendKey || !firebaseApiKey || !fromAddress) {
    console.error('CRM email route not configured: missing RESEND_API_KEY, FIREBASE_WEB_API_KEY or CRM_EMAIL_FROM');
    return NextResponse.json(
      { error: 'Invio email non configurato sul server.' },
      { status: 500 }
    );
  }

  const authorization = request.headers.get('authorization') || '';
  const idToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!idToken) {
    return NextResponse.json({ error: 'Autenticazione mancante.' }, { status: 401 });
  }

  const user = await verifyIdToken(idToken, firebaseApiKey);
  if (!user) {
    return NextResponse.json({ error: 'Autenticazione non valida.' }, { status: 401 });
  }

  if (tooManyRequests(user.uid)) {
    return NextResponse.json(
      { error: 'Troppi invii in poco tempo. Riprova fra un minuto.' },
      { status: 429 }
    );
  }

  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Richiesta non leggibile.' }, { status: 400 });
  }

  const { to, subject, text, html, replyTo, idempotencyKey } = payload || {};

  if (!to || !EMAIL_PATTERN.test(String(to))) {
    return NextResponse.json({ error: 'Destinatario non valido.' }, { status: 400 });
  }
  if (!subject || !String(subject).trim()) {
    return NextResponse.json({ error: 'Oggetto mancante.' }, { status: 400 });
  }
  if (!text || !String(text).trim()) {
    return NextResponse.json({ error: 'Testo mancante.' }, { status: 400 });
  }
  if (!idempotencyKey || !String(idempotencyKey).trim()) {
    return NextResponse.json({ error: 'Chiave di idempotenza mancante.' }, { status: 400 });
  }

  // Un segnaposto non sostituito non deve finire in una email a un cliente.
  if (/\{\{\s*[a-zA-Z0-9_.]+\s*\}\}/.test(`${subject} ${text}`)) {
    return NextResponse.json(
      { error: 'Il testo contiene variabili non sostituite.' },
      { status: 400 }
    );
  }

  prune();
  const key = `${user.uid}:${idempotencyKey}`;
  if (servedKeys.has(key)) {
    return NextResponse.json({ duplicate: true, id: '' }, { status: 200 });
  }
  servedKeys.set(key, Date.now());

  try {
        const result = await resend.emails.send({
      from: fromAddress,
      to: String(to),
      subject: String(subject),
      text: String(text),
      html: html ? String(html) : undefined,
      replyTo: replyTo ? String(replyTo) : undefined,
    });

    if (result.error) {
      // La chiave viene liberata: l'invio non è avvenuto, il retry è legittimo.
      servedKeys.delete(key);
      console.error('Resend rejected CRM email:', result.error);
      return NextResponse.json(
        { error: result.error.message || 'Il provider ha rifiutato l’invio.' },
        { status: 502 }
      );
    }

    return NextResponse.json({ id: result.data?.id || '', duplicate: false });
  } catch (error) {
    servedKeys.delete(key);
    console.error('Error sending CRM email:', error);
    return NextResponse.json({ error: 'Invio non riuscito.' }, { status: 500 });
  }
}
