"use server";

import { verifyIdToken } from '@/lib/server/auth';
import { tooManyRequests } from '@/lib/server/rateLimit';
import { geminiClient } from '@/lib/server/gemini';
import { AI_CREDITS_EXHAUSTED, aiProjectWorkspace, countAiCall } from '@/lib/server/usage';

const MAX_PROMPT = 8_000;
const MAX_CONTEXT = 20_000;

// Le istruzioni le decide il server: prima le mandava il client, quindi la
// funzione era un accesso libero al modello con istruzioni a piacere.
const SYSTEM_INSTRUCTION_IT = `Sei un eccellente assistente AI integrato in un editor documentale aziendale.
Devi generare il contenuto usando ESCLUSIVAMENTE codice Markdown (es. ## Titoli, **grassetto**, * liste).
NON formattare mai in HTML.
Usa SEMPRE Markdown per creare elenchi, intestazioni e testi.
NON racchiudere la risposta in backtick.
Rispondi rigorosamente in italiano.`;

const SYSTEM_INSTRUCTION_EN = `You are an expert AI assistant integrated into an enterprise documentation editor.
You MUST generate content EXCLUSIVELY using standard Markdown (e.g. ## Headings, **bold**, * lists).
NEVER format as HTML.
ALWAYS use Markdown to create lists, headings, and text.
Do NOT enclose your entire response in triple backticks.
Always respond strictly in English.`;

/**
 * Genera contenuto per l'editor dei documenti.
 *
 * Le server action non ricevono header personalizzati, quindi l'ID token
 * dell'utente arriva come primo argomento e viene verificato qui.
 */
export async function generateDocContent(
  idToken: string, projectId: string, prompt: string, context = '', locale: 'it' | 'en' = 'it'
): Promise<{ text: string; error?: undefined } | { error: string; text?: undefined }> {
  const user = await verifyIdToken(idToken);
  if (!user) throw new Error('Autenticazione richiesta.');
  if (tooManyRequests(`doc-ai:${user.uid}`, 20)) throw new Error('Troppe richieste. Riprova fra un minuto.');
  // Il credito si conta sul workspace del progetto del documento.
  const project = await aiProjectWorkspace(user.uid, projectId);
  if (!project.allowed) throw new Error('Progetto non trovato.');
  // Le server action in produzione nascondono il messaggio degli errori:
  // questo lo si restituisce, così l'utente sa perché non è stato generato nulla.
  if (project.outOfCredits) return { error: AI_CREDITS_EXHAUSTED };

  const cleanPrompt = String(prompt || '').slice(0, MAX_PROMPT);
  if (!cleanPrompt.trim()) throw new Error('Prompt mancante.');
  const cleanContext = String(context || '').slice(0, MAX_CONTEXT);
  const baseInstruction = locale === 'en' ? SYSTEM_INSTRUCTION_EN : SYSTEM_INSTRUCTION_IT;

  try {
    const model = geminiClient().getGenerativeModel({
      // gemini-1.5-flash non esiste più (404): stesso modello delle altre route AI.
      model: 'gemini-3.8-flash',
      systemInstruction: cleanContext ? `${baseInstruction}\n${cleanContext}` : baseInstruction,
    });

    const result = await model.generateContent(cleanPrompt);
    let response = result.response.text();
    response = response.replace(/^\s*\`\`\`(html|markdown|md)?/g, '').replace(/\`\`\`\s*$/g, '').trim();
    await countAiCall(project.workspaceId);
    return { text: response };
  } catch (error) {
    console.error("AI Generation Error:", error);
    throw new Error("Failed to generate content");
  }
}
