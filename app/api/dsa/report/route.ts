import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { tooManyRequestsShared, getClientIp } from '@/lib/server/rateLimit';

export const runtime = 'nodejs';

/** Limite dimensione massima payload: 64 KB */
const MAX_PAYLOAD_BYTES = 64 * 1024;

/** Limite segnalazioni: massimo 5 segnalazioni ogni 10 minuti per indirizzo IP */
const IP_RATE_LIMIT = 5;
const IP_RATE_WINDOW_MS = 10 * 60_000;

/** Limiti di lunghezza per i campi */
const MAX_LOCATION_LENGTH = 1000;
const MAX_REASON_LENGTH = 5000;
const MIN_REASON_LENGTH = 10;
const MAX_NAME_LENGTH = 200;
const MAX_EMAIL_LENGTH = 254;
const MAX_CATEGORY_LENGTH = 100;

/**
 * Meccanismo di notifica e azione (Notice and Action) - Articolo 16 Digital Services Act (DSA, Regolamento UE 2022/2065).
 * Consente a qualsiasi individuo o ente di segnalare la presenza di contenuti ritenuti illegali
 * o lesivi del diritto d'autore/privacy/altri diritti.
 *
 * Resta pubblica senza login come richiesto dal DSA, protetta con limite di richieste per IP
 * e limiti rigidi sulla dimensione del payload e dei campi per evitare saturazione e abusi.
 */
export async function POST(request: Request) {
  try {
    // 1. Controllo dimensione payload prima del processing
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > MAX_PAYLOAD_BYTES) {
      return NextResponse.json(
        { error: 'Dimensione della richiesta superiore al limite consentito (max 64 KB).' },
        { status: 413 }
      );
    }

    // 2. Limite richieste per IP
    const clientIp = getClientIp(request);
    if (await tooManyRequestsShared(`dsa-report:${clientIp}`, IP_RATE_LIMIT, IP_RATE_WINDOW_MS)) {
      return NextResponse.json(
        { error: 'Troppe segnalazioni inviate da questo indirizzo di rete. Riprova fra 10 minuti.' },
        { status: 429 }
      );
    }

    // 3. Lettura e parsing sicuro del body
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Richiesta non valida: corpo non leggibile.' }, { status: 400 });
    }

    const {
      contentLocation,
      reason,
      category,
      claimantName,
      claimantEmail,
      goodFaithConfirmed,
    } = body;

    // 4. Verifiche obbligatorie ex Art. 16(2) DSA e controllo lunghezze massime
    if (!contentLocation || !String(contentLocation).trim()) {
      return NextResponse.json({ error: 'Indicazione del contenuto o URL mancante.' }, { status: 400 });
    }
    const cleanLocation = String(contentLocation).trim();
    if (cleanLocation.length > MAX_LOCATION_LENGTH) {
      return NextResponse.json(
        { error: `Il campo posizione/URL non può superare i ${MAX_LOCATION_LENGTH} caratteri.` },
        { status: 400 }
      );
    }

    if (!reason || !String(reason).trim() || String(reason).trim().length < MIN_REASON_LENGTH) {
      return NextResponse.json(
        { error: `Fornisci una spiegazione motivata (minimo ${MIN_REASON_LENGTH} caratteri).` },
        { status: 400 }
      );
    }
    const cleanReason = String(reason).trim();
    if (cleanReason.length > MAX_REASON_LENGTH) {
      return NextResponse.json(
        { error: `La spiegazione motivata non può superare i ${MAX_REASON_LENGTH} caratteri.` },
        { status: 400 }
      );
    }

    const cleanCategory = String(category || 'copyright_or_illegal_content').trim();
    if (cleanCategory.length > MAX_CATEGORY_LENGTH) {
      return NextResponse.json({ error: 'Categoria di segnalazione non valida.' }, { status: 400 });
    }

    const cleanName = String(claimantName || '').trim();
    if (cleanName.length > MAX_NAME_LENGTH) {
      return NextResponse.json(
        { error: `Il nome del segnalante non può superare i ${MAX_NAME_LENGTH} caratteri.` },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
    const cleanEmail = String(claimantEmail || '').trim().toLowerCase();
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      return NextResponse.json({ error: 'Indirizzo email di contatto non valido.' }, { status: 400 });
    }
    if (cleanEmail.length > MAX_EMAIL_LENGTH) {
      return NextResponse.json(
        { error: `L’indirizzo email non può superare i ${MAX_EMAIL_LENGTH} caratteri.` },
        { status: 400 }
      );
    }

    if (!goodFaithConfirmed) {
      return NextResponse.json(
        { error: 'È richiesta la dichiarazione di buona fede ex Art. 16 DSA.' },
        { status: 400 }
      );
    }

    const reportId = `dsa_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const reportData = {
      reportId,
      contentLocation: cleanLocation,
      reason: cleanReason,
      category: cleanCategory,
      claimantName: cleanName,
      claimantEmail: cleanEmail,
      goodFaithConfirmed: true,
      status: 'pending_review',
      createdAt: new Date().toISOString(),
      clientIp: clientIp !== 'unknown-ip' ? clientIp : null,
    };

    if (adminDb) {
      await adminDb.collection('dsa_reports').doc(reportId).set(reportData);
    }

    console.log(`[DSA Report ${reportId}] Ricevuta segnalazione per: ${reportData.contentLocation}`);

    return NextResponse.json({
      success: true,
      reportId,
      message: 'Segnalazione presa in carico. Riceverai una notifica dell’esito all’indirizzo indicato ai sensi del Digital Services Act.',
    });
  } catch (error) {
    console.error('Error processing DSA report:', error);
    return NextResponse.json({ error: 'Errore durante l’invio della segnalazione.' }, { status: 500 });
  }
}
