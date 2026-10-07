import { NextResponse } from 'next/server';
import { guardRequest } from '@/lib/crm/prospect/serverAuth';
import { AI_CREDITS_EXHAUSTED, aiProjectWorkspace, countAiCall } from '@/lib/server/usage';

/**
 * Le due sezioni discorsive del report, scritte dal modello.
 *
 * Sta sul server per il motivo che vale più di tutti: **la chiave**. Il
 * prodotto oggi ne tiene una in `NEXT_PUBLIC_GEMINI_API_KEY`, che finisce nel
 * JavaScript servito al browser ed è leggibile da chiunque apra gli strumenti
 * di sviluppo (segnalazione 8 al team). Questa route legge `GEMINI_API_KEY`, e
 * **non ripiega** su quella pubblica: ripiegare vorrebbe dire spostare il
 * problema e chiamarlo risolto.
 *
 * Se la chiave non c'è, la route risponde `200` con `ok: false` e il codice
 * `NOT_CONFIGURED`: non è un errore, è una configurazione che manca, e il
 * report si fa lo stesso senza AI. Un 500 manderebbe l'interfaccia a mostrare
 * un guasto per una cosa che funziona come previsto.
 *
 * Il limite è stretto — cinque al minuto per utente — perché ogni chiamata
 * costa, e un ciclo sbagliato in una pagina si vedrebbe sulla fattura prima
 * che nei log.
 */

export const runtime = 'nodejs';
export const maxDuration = 60;

const MODELLO_PREDEFINITO = 'gemini-3.8-flash';
const LIMITE_PROMPT = 24_000;

export async function POST(request: Request) {
  const guardia = await guardRequest(request, { operation: 'report', limit: 5 });
  if (!guardia.ok) {
    return NextResponse.json({ error: guardia.error }, { status: guardia.status });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      ok: false,
      code: 'NOT_CONFIGURED',
      error: 'Il modello non è configurato sul server (manca GEMINI_API_KEY): il report viene composto dai dati raccolti, senza AI.',
    });
  }

  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Richiesta non leggibile.' }, { status: 400 });
  }

  const prompt = String(payload?.prompt || '');
  if (!prompt.trim()) {
    return NextResponse.json({ error: 'Prompt mancante.' }, { status: 400 });
  }
  if (prompt.length > LIMITE_PROMPT) {
    return NextResponse.json({ error: 'Prompt troppo lungo.', code: 'TOO_LONG' }, { status: 400 });
  }
  // Il credito AI si conta sul workspace del progetto del CRM.
  const progetto = await aiProjectWorkspace(guardia.uid, payload?.projectId);
  if (!progetto.allowed) {
    return NextResponse.json({ error: 'Progetto non trovato.' }, { status: 404 });
  }
  if (progetto.outOfCredits) {
    return NextResponse.json({ error: AI_CREDITS_EXHAUSTED, code: 'ai-credits-exhausted' }, { status: 402 });
  }

  const modello = process.env.PROSPECT_AI_MODEL || MODELLO_PREDEFINITO;

  try {
    const risposta = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modello}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
        }),
        cache: 'no-store',
      }
    );

    if (risposta.status === 429) {
      return NextResponse.json(
        { error: 'Il modello ha risposto che le richieste sono troppe. Riprova fra qualche minuto.', code: 'RATE_LIMITED', retryable: true },
        { status: 503 }
      );
    }
    if (!risposta.ok) {
      const dettaglio = await risposta.text().catch(() => '');
      // Il dettaglio finisce nei log del server, non nella risposta: può
      // contenere pezzi della richiesta, e la richiesta contiene i dati
      // dell'azienda.
      console.error('Modello non disponibile:', risposta.status, dettaglio.slice(0, 500));
      return NextResponse.json(
        { error: `Il modello ha risposto con un errore (${risposta.status}). Il report può essere composto senza AI.`, code: 'UNEXPECTED', retryable: true },
        { status: 503 }
      );
    }

    const dati = await risposta.json();
    const testo = dati?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || '').join('') || '';

    if (!testo.trim()) {
      // Succede quando il modello si rifiuta: la risposta arriva vuota con un
      // motivo accanto. Va detto, non fatto passare per un guasto.
      const motivo = dati?.candidates?.[0]?.finishReason || dati?.promptFeedback?.blockReason || '';
      return NextResponse.json({
        ok: false,
        code: 'REFUSED',
        error: `Il modello non ha prodotto testo${motivo ? ` (${motivo})` : ''}: il report viene composto dai dati raccolti.`,
      });
    }

    await countAiCall(progetto.workspaceId);
    return NextResponse.json({ ok: true, text: testo, model: modello });
  } catch (error) {
    console.error('Chiamata al modello fallita:', error);
    return NextResponse.json(
      { error: 'Non è stato possibile contattare il modello.', code: 'NETWORK', retryable: true },
      { status: 503 }
    );
  }
}
