import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Chiave e client di Gemini, solo lato server.
 *
 * Prima il browser chiamava Gemini con `NEXT_PUBLIC_GEMINI_API_KEY`, che
 * finiva nel JavaScript scaricato da chiunque apra l'app: la chiave si poteva
 * copiare e usare a spese di Unfract (segnalazione S09). Ora le chiamate
 * passano dalle route `/api/ai/*` e la chiave non esce dal server.
 *
 * `GEMINI_API_KEY` è quella giusta. Il ripiego su `NEXT_PUBLIC_GEMINI_API_KEY`
 * tiene in piedi le funzioni AI finché la nuova chiave non è impostata sul
 * deploy: letta solo qui, non finisce più nel bundle del browser. Quando
 * `GEMINI_API_KEY` c'è, la vecchia chiave va revocata e il ripiego tolto.
 */

let warned = false;

export function geminiApiKey(): string {
  const key = process.env.GEMINI_API_KEY || '';
  if (key) return key;
  const legacy = process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
  if (legacy && !warned) {
    warned = true;
    console.warn('GEMINI_API_KEY non impostata: uso la vecchia NEXT_PUBLIC_GEMINI_API_KEY. Va sostituita e revocata.');
  }
  return legacy;
}

export function geminiClient(): GoogleGenerativeAI {
  const key = geminiApiKey();
  if (!key) throw new GeminiNotConfiguredError();
  return new GoogleGenerativeAI(key);
}

export class GeminiNotConfiguredError extends Error {
  constructor() {
    super('Il modello AI non è configurato sul server (manca GEMINI_API_KEY).');
    this.name = 'GeminiNotConfiguredError';
  }
}

/** 503 e 429 di Gemini sono temporanei: si riprova con un'attesa crescente. */
export async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const temporary = message.includes('503') || message.includes('429');
      if (!temporary || attempt >= maxRetries) throw error;
      await new Promise(resolve => setTimeout(resolve, attempt * 1500));
    }
  }
}
