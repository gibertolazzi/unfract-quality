import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

/**
 * Meccanismo di notifica e azione (Notice and Action) - Articolo 16 Digital Services Act (DSA, Regolamento UE 2022/2065).
 * Consente a qualsiasi individuo o ente di segnalare la presenza di contenuti ritenuti illegali
 * o lesivi del diritto d'autore/privacy/altri diritti.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Richiesta non valida.' }, { status: 400 });
    }

    const {
      contentLocation,
      reason,
      category,
      claimantName,
      claimantEmail,
      goodFaithConfirmed,
    } = body;

    // Verifiche obbligatorie ex Art. 16(2) DSA
    if (!contentLocation || !String(contentLocation).trim()) {
      return NextResponse.json({ error: 'Indicazione del contenuto o URL mancante.' }, { status: 400 });
    }

    if (!reason || !String(reason).trim() || String(reason).trim().length < 10) {
      return NextResponse.json({ error: 'Fornisci una spiegazione motivata (minimo 10 caratteri).' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
    if (!claimantEmail || !emailRegex.test(String(claimantEmail).trim())) {
      return NextResponse.json({ error: 'Indirizzo email di contatto non valido.' }, { status: 400 });
    }

    if (!goodFaithConfirmed) {
      return NextResponse.json({ error: 'È richiesta la dichiarazione di buona fede ex Art. 16 DSA.' }, { status: 400 });
    }

    const reportId = `dsa_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const reportData = {
      reportId,
      contentLocation: String(contentLocation).trim(),
      reason: String(reason).trim(),
      category: category || 'copyright_or_illegal_content',
      claimantName: String(claimantName || '').trim(),
      claimantEmail: String(claimantEmail).trim().toLowerCase(),
      goodFaithConfirmed: true,
      status: 'pending_review',
      createdAt: new Date().toISOString(),
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
