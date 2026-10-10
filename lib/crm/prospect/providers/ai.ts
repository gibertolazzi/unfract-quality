/**
 * Il contratto di chi scrive le due sezioni discorsive del report.
 *
 * Come per il motore di ricerca, il contratto esiste anche quando
 * l'implementazione non c'è: il resto del codice è scritto contro questo, e
 * quando l'AI non è configurata **il report si fa lo stesso**, composto dai
 * dati raccolti (`report/compose.ts`). Non è un ripiego mascherato da scelta:
 * la versione senza AI è la base, e l'AI riscrive due sezioni su sei.
 *
 * La chiave sta **solo sul server**: questa route legge `GEMINI_API_KEY`, e se
 * non c'è dice che non c'è.
 */

export interface AiFailure {
  code: 'NOT_CONFIGURED' | 'RATE_LIMITED' | 'REFUSED' | 'UNREADABLE' | 'NETWORK' | 'UNEXPECTED';
  message: string;
  retryable: boolean;
}

export type AiOutcome =
  | { ok: true; text: string; model: string }
  | { ok: false; failure: AiFailure };

export interface AiProvider {
  id: string;
  label: string;
  billed: boolean;
  configured: boolean;
  write(prompt: string): Promise<AiOutcome>;
}

/** Quella che non c'è: risponde dicendo cosa manca, e il report si fa senza. */
export const aiNonConfigurata: AiProvider = {
  id: 'nessuna',
  label: 'Nessun modello configurato',
  billed: false,
  configured: false,

  async write(): Promise<AiOutcome> {
    return { ok: false, failure: {
      code: 'NOT_CONFIGURED',
      retryable: false,
      message: 'Il modello non è configurato sul server: il report è stato composto dai dati raccolti, senza AI.',
    }};
  },
};
