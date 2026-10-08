import { NextResponse } from 'next/server';
import { websiteReader } from '@/lib/crm/prospect/providers/website';
import { guardRequest } from '@/lib/crm/prospect/serverAuth';
import { normalizeDomain } from '@/lib/crm/prospect/base';
import { readJsonObject } from '@/lib/server/requestBody';

/**
 * Lettura del sito di un'azienda.
 *
 * Sta sul server per gli stessi motivi della verifica delle partite IVA, più
 * uno che vale solo qui: dal browser di un utente la lettura partirebbe **dal
 * suo indirizzo IP**, e un sito che decide di bloccarci bloccherebbe lui.
 *
 * Il limite è più stretto di quello di VIES — una lettura sono fino a cinque
 * pagine di un server che non ci ha invitati, non una chiamata sola.
 *
 * Non scrive niente: restituisce ciò che ha letto, e il browser decide cosa
 * farne. Senza SDK admin questa route non può scrivere su Firestore.
 */

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  const guardia = await guardRequest(request, { operation: 'site', limit: 10 });
  if (!guardia.ok) {
    return NextResponse.json({ error: guardia.error }, { status: guardia.status });
  }

  const payload = await readJsonObject(request);
  if (!payload) {
    return NextResponse.json({ error: 'Richiesta non leggibile.' }, { status: 400 });
  }

  const dominio = normalizeDomain(String(payload.domain || ''));
  if (!dominio || !dominio.includes('.')) {
    return NextResponse.json(
      { error: 'Serve un dominio, per esempio «illy.com».', code: 'INVALID_INPUT' },
      { status: 400 }
    );
  }

  const esito = await websiteReader.read(dominio);

  if (!esito.ok) {
    // Un sito che ci blocca o che dice di no nel robots.txt **non è un errore
    // nostro**: è una risposta, e va scritta sulla scheda come tale. Per
    // questo torna 200 con `ok: false`, e non un 4xx che l'interfaccia
    // mostrerebbe come un guasto.
    const risposta = esito.failure.code === 'ROBOTS_DENIED' || esito.failure.code === 'BLOCKED';
    if (risposta) {
      return NextResponse.json({ ok: false, code: esito.failure.code, error: esito.failure.message });
    }
    return NextResponse.json(
      { error: esito.failure.message, code: esito.failure.code, retryable: esito.failure.retryable },
      { status: esito.failure.retryable ? 503 : 400 }
    );
  }

  return NextResponse.json({ ok: true, result: esito.result });
}
