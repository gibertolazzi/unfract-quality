import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { tooManyRequestsShared } from '@/lib/server/rateLimit';
import { geminiClient, GeminiNotConfiguredError, withRetry } from '@/lib/server/gemini';
import { AI_CREDITS_EXHAUSTED, aiProjectWorkspace, countAiCall } from '@/lib/server/usage';

export const runtime = 'nodejs';

const MAX_SOURCE = 30_000;

/**
 * Titoli brevi generati con l'AI. Istruzioni e modello li decide il server:
 * il client manda solo il tipo di titolo e il testo da cui ricavarlo.
 *
 * - `meeting`: titolo di un meeting dal suo riepilogo, in italiano o inglese;
 * - `chat`: titolo di una chat dell'AI Hub dal primo messaggio.
 *
 * `projectId` è obbligatorio: il credito si conta sul workspace del progetto.
 */
export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  if (await tooManyRequestsShared(`ai-title:${auth.user.uid}`, 20)) {
    return NextResponse.json({ error: 'Troppe richieste. Riprova fra un minuto.' }, { status: 429 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Richiesta non leggibile.' }, { status: 400 });
  }

  const kind = body?.kind;
  const source = typeof body?.text === 'string' ? body.text.slice(0, MAX_SOURCE) : '';
  if ((kind !== 'meeting' && kind !== 'chat') || !source.trim()) {
    return NextResponse.json({ error: 'Richiesta non valida.' }, { status: 400 });
  }
  const project = await aiProjectWorkspace(auth.user.uid, body?.projectId);
  if (!project.allowed) {
    return NextResponse.json({ error: 'Progetto non trovato.' }, { status: 404 });
  }
  if (project.outOfCredits) {
    return NextResponse.json({ error: AI_CREDITS_EXHAUSTED, code: 'ai-credits-exhausted' }, { status: 402 });
  }

  let systemInstruction: string | undefined;
  let prompt: string;
  if (kind === 'meeting') {
    const english = body?.locale === 'en';
    systemInstruction = english
      ? 'Extract the main topic from the summary and write a title of at most 5 words. Reply only with the title, without markdown or prefixes.'
      : "Estrai l'argomento principale dal riepilogo e scrivi un titolo di massimo 5 parole. Rispondi solo con il titolo, senza markdown o prefissi.";
    prompt = english
      ? `Meeting summary:\n\n${source}\n\nWrite only the title (5 words maximum):`
      : `Riepilogo della riunione:\n\n${source}\n\nScrivi solo il titolo (massimo 5 parole):`;
  } else {
    prompt = `Genera un titolo molto breve (massimo 4-5 parole) per descrivere questo messaggio dell'utente. Restituisci SOLO il titolo senza virgolette e senza altra punteggiatura.\nMessaggio: "${source}"`;
  }

  try {
    const model = geminiClient().getGenerativeModel({ model: 'gemini-3.8-flash', ...(systemInstruction ? { systemInstruction } : {}) });
    const result = await withRetry(() => model.generateContent(prompt));
    await countAiCall(project.workspaceId);
    return NextResponse.json({ title: result.response.text().trim().slice(0, 200) });
  } catch (error) {
    if (error instanceof GeminiNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error('Titolo AI non generato:', error);
    return NextResponse.json({ error: 'Titolo non generato.' }, { status: 502 });
  }
}
