import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import {
  canonicalizeEmail,
  verifyUnsubscribeToken,
  escapeHtml,
} from '@/lib/server/emailUnsubscribe';

export const runtime = 'nodejs';

function renderHtmlPage(title: string, content: string, status = 200): Response {
  const html = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)} - Unfract</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0B0B0B;
      color: #FFFFFF;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
    }
    .card {
      background: #141414;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 24px;
      padding: 40px;
      max-width: 480px;
      width: 100%;
      text-align: center;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    }
    h1 { font-size: 22px; margin-bottom: 12px; font-weight: 600; letter-spacing: -0.02em; }
    p { color: #858585; font-size: 14px; line-height: 1.6; margin-bottom: 24px; }
    .badge {
      display: inline-block;
      background: rgba(0, 106, 255, 0.15);
      color: #006AFF;
      padding: 6px 14px;
      border-radius: 99px;
      font-size: 13px;
      font-weight: 500;
      margin-bottom: 16px;
    }
    .badge-error {
      background: rgba(239, 68, 68, 0.15);
      color: #EF4444;
    }
    .badge-success {
      background: rgba(16, 185, 129, 0.15);
      color: #10B981;
    }
    .btn-confirm {
      background: #006AFF;
      color: #FFFFFF;
      border: none;
      border-radius: 12px;
      padding: 12px 24px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      width: 100%;
      transition: background 0.2s ease;
    }
    .btn-confirm:hover { background: #0056d6; }
    .subtext { font-size: 12px; color: #666; margin-top: 16px; margin-bottom: 0; }
  </style>
</head>
<body>
  <div class="card">
    ${content}
  </div>
</body>
</html>`;

  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

/**
 * Endpoint per la disiscrizione dalle email (RFC 8058 e Codice Privacy art. 130).
 *
 * GET:
 * - Verifica la firma crittografica del link (HMAC).
 * - Mostra la schermata con pulsante «Conferma» per evitare che crawler,
 *   antivirus o scanner disiscrivano l'utente in automatico.
 * - Non esegue la disiscrizione su Firestore al semplice clic di apertura (GET).
 * - Protezione XSS: l'indirizzo email viene sempre sanificato prima del rendering.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawEmail = searchParams.get('email') || '';
  const token = searchParams.get('token') || '';
  const email = canonicalizeEmail(rawEmail);

  if (!email || !token || !verifyUnsubscribeToken(email, token)) {
    return renderHtmlPage(
      'Link non valido',
      `<div class="badge badge-error">Richiesta non autorizzata</div>
       <h1>Link di disiscrizione non valido</h1>
       <p>Il link che hai aperto non è valido o è stato modificato. Se desideri gestire le preferenze email, accedi al tuo account Unfract.</p>`,
      400
    );
  }

  const safeEmail = escapeHtml(email);
  const safeToken = escapeHtml(token);

  return renderHtmlPage(
    'Conferma Disiscrizione',
    `<div class="badge">Gestione Comunicazioni</div>
     <h1>Vuoi disiscriverti?</h1>
     <p>Conferma la cancellazione dell'indirizzo <strong>${safeEmail}</strong> dalle liste di comunicazione commerciale e promozionale di Unfract.</p>
     <form method="POST" action="/api/email/unsubscribe">
       <input type="hidden" name="email" value="${safeEmail}" />
       <input type="hidden" name="token" value="${safeToken}" />
       <button type="submit" class="btn-confirm">Conferma disiscrizione</button>
     </form>
     <p class="subtext">Se hai aperto questo link per errore, puoi semplicemente chiudere questa pagina.</p>`,
    200
  );
}

/**
 * POST:
 * - Supporta sia l'RFC 8058 One-Click Unsubscribe dai client di posta
 *   (body `List-Unsubscribe=One-Click` con parametri query)
 *   sia la conferma tramite form web dal browser.
 * - Registra la disiscrizione su Firestore (collection `unsubscribes`).
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  let email = canonicalizeEmail(url.searchParams.get('email') || '');
  let token = url.searchParams.get('token') || '';
  let isOneClick = false;

  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
    try {
      const formData = await request.formData();
      const formEmail = formData.get('email');
      const formToken = formData.get('token');
      if (typeof formEmail === 'string' && formEmail) {
        email = canonicalizeEmail(formEmail);
      }
      if (typeof formToken === 'string' && formToken) {
        token = formToken;
      }
      if (formData.get('List-Unsubscribe') === 'One-Click') {
        isOneClick = true;
      }
    } catch {
      // Ignora errore di parsing e ripiega su parametri URL
    }
  } else if (contentType.includes('application/json')) {
    try {
      const json = await request.json();
      if (json && typeof json === 'object') {
        if (typeof json.email === 'string') email = canonicalizeEmail(json.email);
        if (typeof json.token === 'string') token = json.token;
      }
    } catch {
      // Ignora errore di parsing
    }
  }

  // Verifica validità e firma
  if (!email || !token || !verifyUnsubscribeToken(email, token)) {
    const wantsJson = (request.headers.get('accept') || '').includes('application/json') || isOneClick;
    if (wantsJson) {
      return NextResponse.json({ error: 'Token di disiscrizione non valido o mancante.' }, { status: 400 });
    }
    return renderHtmlPage(
      'Errore Disiscrizione',
      `<div class="badge badge-error">Errore</div>
       <h1>Impossibile completare la disiscrizione</h1>
       <p>Il link di disiscrizione non è valido o la firma crittografica non corrisponde.</p>`,
      400
    );
  }

  if (adminDb) {
    try {
      await adminDb.collection('unsubscribes').doc(email).set({
        email,
        unsubscribedAt: new Date().toISOString(),
        source: isOneClick ? 'one_click_header' : 'web_confirmation',
      }, { merge: true });
    } catch (err) {
      console.error('Error saving unsubscribe record:', err);
      return NextResponse.json({ error: 'Errore durante il salvataggio della disiscrizione.' }, { status: 500 });
    }
  }

  const wantsJson = (request.headers.get('accept') || '').includes('application/json') || isOneClick;
  if (wantsJson) {
    return NextResponse.json({ ok: true, email, unsubscribed: true });
  }

  const safeEmail = escapeHtml(email);
  return renderHtmlPage(
    'Disiscrizione Confermata',
    `<div class="badge badge-success">Disiscrizione completata</div>
     <h1>Non riceverai più nostre email</h1>
     <p>L'indirizzo <strong>${safeEmail}</strong> è stato rimosso dalle liste di comunicazione promozionale di Unfract. Potrai sempre gestire le preferenze del tuo account direttamente dalle impostazioni.</p>`,
    200
  );
}
