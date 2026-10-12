import { NextResponse } from 'next/server';
import type { Part } from '@google/generative-ai';
import { z } from 'zod';
import { requireUser } from '@/lib/server/auth';
import { tooManyRequestsShared } from '@/lib/server/rateLimit';
import { geminiClient, GeminiNotConfiguredError, withRetry } from '@/lib/server/gemini';
import { AI_CREDITS_EXHAUSTED, aiProjectWorkspace, countAiCall } from '@/lib/server/usage';
import { readJsonObject } from '@/lib/server/requestBody';

export const runtime = 'nodejs';

const MAX_TEXT = 20_000;
const MAX_CONTEXT = 100_000;
const MAX_HISTORY = 50;
const MAX_ATTACHMENTS = 5;
// Gemini accetta allegati inline fino a circa 20 MB in tutto.
const MAX_ATTACHMENT_BASE64 = 20 * 1024 * 1024 * 4 / 3;

const HistoryMessage = z.object({ role: z.enum(['user', 'model']), content: z.string() });
const Attachment = z.object({ data: z.string(), mimeType: z.string() });

/** Le voci di una lista che rispettano lo schema; il resto si scarta. */
function validItems<T>(value: unknown, schema: z.ZodType<T>): T[] {
  return (Array.isArray(value) ? value : []).flatMap(item => {
    const parsed = schema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

/**
 * Risposta della chat dell'AI Hub.
 *
 * Body: `{ projectId, text, history, projectContext, attachments? }`, dove `history` è
 * `[{ role: 'user' | 'model', content }]` e gli allegati sono
 * `{ data: base64, mimeType }`. Le istruzioni di sistema le scrive il server:
 * il client manda solo il contesto del progetto che ci va dentro.
 */
export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  if (await tooManyRequestsShared(`ai-chat:${auth.user.uid}`, 20)) {
    return NextResponse.json({ error: 'Troppe richieste. Riprova fra un minuto.' }, { status: 429 });
  }

  const body = await readJsonObject(request);
  if (!body) {
    return NextResponse.json({ error: 'Richiesta non leggibile.' }, { status: 400 });
  }

  const text = typeof body.text === 'string' ? body.text.slice(0, MAX_TEXT) : '';
  const projectContext = typeof body.projectContext === 'string' ? body.projectContext.slice(0, MAX_CONTEXT) : '';
  // Le voci malformate si scartano una per una, senza respingere la richiesta.
  const history = validItems(Array.isArray(body.history) ? body.history.slice(-MAX_HISTORY) : [], HistoryMessage)
    .map(m => ({ role: m.role, parts: [{ text: m.content.slice(0, MAX_TEXT) }] }));
  const attachments = validItems(body.attachments, Attachment).slice(0, MAX_ATTACHMENTS);

  const attachmentSize = attachments.reduce((total, a) => total + a.data.length, 0);
  if (attachmentSize > MAX_ATTACHMENT_BASE64) {
    return NextResponse.json({ error: 'Allegati troppo grandi.' }, { status: 413 });
  }
  if (!text.trim() && attachments.length === 0) {
    return NextResponse.json({ error: 'Messaggio vuoto.' }, { status: 400 });
  }
  // Il credito si conta sul workspace del progetto.
  const project = await aiProjectWorkspace(auth.user.uid, body.projectId);
  if (!project.allowed) {
    return NextResponse.json({ error: 'Progetto non trovato.' }, { status: 404 });
  }
  if (project.outOfCredits) {
    return NextResponse.json({ error: AI_CREDITS_EXHAUSTED, code: 'ai-credits-exhausted' }, { status: 402 });
  }

  const isEn = body.locale === 'en';
  const systemInstruction = isEn
    ? `You are Unfract AI, the strategic assistant for enterprise projects.\n\nProject context:\n${projectContext}\n\nRespond professionally and concisely in English. Only consider open tasks: do not suggest or tag completed tasks as next actions. If you mention an existing task, use [TASK:id] only for an ID present in the open tasks list.\n1. If the user asks you to create a new task (or you agree to do so), you MUST create it by writing AT THE VERY END of your response the exact block:\n$CREATE_TASK$\n{"title": "Short title", "priority": "High", "description": "Extended description", "category": "General"}\n$END_TASK$\n\nThe system will intercept this block and create the task in the real database!`
    : `Sei Unfract AI, l'assistente strategico del progetto aziendale. \n\nContesto del progetto:\n${projectContext}\n\nRispondi in modo professionale e conciso in italiano. Considera solo le attività ancora aperte: non proporre né taggare come prossime azioni le attività completate. Se menzioni un'attività esistente, usa [TASK:id] solo per un ID presente nell'elenco delle attività aperte.\n1. Se l'utente ti chiede di creare una nuova task (o accetti di farlo), DEVI crearla scrivendo ALLA FINE della tua risposta l'esatto blocco:\n$CREATE_TASK$\n{"title": "Titolo breve", "priority": "High", "description": "Descrizione estesa", "category": "General"}\n$END_TASK$\n\nIl sistema intercetterà questo blocco e creerà la task nel database reale!`;

  try {
    const model = geminiClient().getGenerativeModel({ model: 'gemini-3.8-flash', systemInstruction });
    const chat = model.startChat({ history, generationConfig: { maxOutputTokens: 8192 } });
    const parts: Part[] = [{ text }];
    for (const a of attachments) parts.push({ inlineData: { data: a.data, mimeType: a.mimeType } });

    const result = await withRetry(() => chat.sendMessage(parts));
    await countAiCall(project.workspaceId);
    return NextResponse.json({ text: result.response.text() });
  } catch (error) {
    if (error instanceof GeminiNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error('Risposta AI Hub non generata:', error);
    return NextResponse.json({ error: 'Risposta AI non generata.' }, { status: 502 });
  }
}
