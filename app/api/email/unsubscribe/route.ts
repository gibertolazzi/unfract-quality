import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

/**
 * Endpoint per la disiscrizione dalle email (RFC 8058 e Codice Privacy art. 130).
 * Supporta sia GET (clic dell'utente dal footer) che POST (One-Click Unsubscribe dai client email).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = (searchParams.get('email') || '').trim().toLowerCase();

  if (email && adminDb) {
    try {
      await adminDb.collection('unsubscribes').doc(email).set({
        email,
        unsubscribedAt: new Date().toISOString(),
        source: 'email_footer_click',
      }, { merge: true });
    } catch (err) {
      console.error('Error saving unsubscribe:', err);
    }
  }

  // Pagina di conferma amichevole e chiara
  return new Response(
    `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <title>Disiscrizione Confermata - Unfract</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0B0B0B; color: #FFF; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
    .card { background: #141414; border: 1px solid rgba(255,255,255,0.1); border-radius: 24px; padding: 40px; max-width: 480px; text-align: center; }
    h1 { font-size: 24px; margin-bottom: 12px; font-weight: 600; }
    p { color: #858585; font-size: 14px; line-height: 1.6; margin-bottom: 24px; }
    .badge { display: inline-block; background: rgba(0, 106, 255, 0.15); color: #006AFF; padding: 6px 14px; border-radius: 99px; font-size: 13px; font-weight: 500; margin-bottom: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">Disiscrizione completata</div>
    <h1>Non riceverai più nostre email</h1>
    <p>L'indirizzo <strong>${email || 'richiesto'}</strong> è stato rimosso dalle liste di comunicazione promozionale di Unfract. Potrai sempre gestire le preferenze del tuo account direttamente dalle impostazioni.</p>
  </div>
</body>
</html>`,
    {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    }
  );
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = (searchParams.get('email') || '').trim().toLowerCase();

  if (email && adminDb) {
    try {
      await adminDb.collection('unsubscribes').doc(email).set({
        email,
        unsubscribedAt: new Date().toISOString(),
        source: 'one_click_header',
      }, { merge: true });
    } catch (err) {
      console.error('Error saving one-click unsubscribe:', err);
    }
  }

  return NextResponse.json({ ok: true, email, unsubscribed: true });
}
