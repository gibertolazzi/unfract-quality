"use server";

import { verifyIdToken } from '@/lib/server/auth';
import { tooManyRequests } from '@/lib/server/rateLimit';
import { geminiClient } from '@/lib/server/gemini';

const MAX_PROMPT = 8_000;
const MAX_CONTEXT = 20_000;

// Le istruzioni le decide il server: prima le mandava il client, quindi la
// funzione era un accesso libero al modello con istruzioni a piacere.
const SYSTEM_INSTRUCTION = `Sei un eccellente assistente AI integrato in un editor documentale aziendale.
Devi generare il contenuto usando ESCLUSIVAMENTE codice Markdown (es. ## Titoli, **grassetto**, * liste).
NON formattare mai in HTML.
Usa SEMPRE Markdown per creare elenchi, intestazioni e testi.
NON racchiudere la risposta in backtick.`;

/**
 * Genera contenuto per l'editor dei documenti.
 *
 * Le server action non ricevono header personalizzati, quindi l'ID token
 * dell'utente arriva come primo argomento e viene verificato qui.
 */
export async function generateDocContent(idToken: string, prompt: string, context = '') {
  const user = await verifyIdToken(idToken);
  if (!user) throw new Error('Autenticazione richiesta.');
  if (tooManyRequests(`doc-ai:${user.uid}`, 20)) throw new Error('Troppe richieste. Riprova fra un minuto.');

  const cleanPrompt = String(prompt || '').slice(0, MAX_PROMPT);
  if (!cleanPrompt.trim()) throw new Error('Prompt mancante.');
  const cleanContext = String(context || '').slice(0, MAX_CONTEXT);

  try {
    const model = geminiClient().getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: cleanContext ? `${SYSTEM_INSTRUCTION}\n${cleanContext}` : SYSTEM_INSTRUCTION,
    });

    const result = await model.generateContent(cleanPrompt);
    let response = result.response.text();
    response = response.replace(/^\s*\`\`\`(html|markdown|md)?/g, '').replace(/\`\`\`\s*$/g, '').trim();
    return response;
  } catch (error) {
    console.error("AI Generation Error:", error);
    throw new Error("Failed to generate content");
  }
}
