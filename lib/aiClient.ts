import { authedFetch } from '@/lib/authedFetch';

/**
 * Chiamate AI dal browser: passano tutte dalle route `/api/ai/*`, dove sta la
 * chiave di Gemini. Prima il browser chiamava Gemini direttamente con una
 * chiave pubblica (segnalazione S09).
 */

export interface MeetingAnalysis {
  summary: string;
  decisions: string[];
  // Come arrivano dal modello: prima si salvavano così, e così restano.
  tasks: any[];
  transcript?: string;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await authedFetch(path, { method: 'POST', body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Errore AI (${response.status})`);
  return data as T;
}

/** Riassunto, decisioni e task di un meeting, dall'audio salvato e dalla trascrizione. */
export function requestMeetingAnalysis(input: { projectId: string; audioUrl?: string; transcript?: string }): Promise<MeetingAnalysis> {
  return postJson<MeetingAnalysis>('/api/ai/meeting', input);
}

/** Titolo breve di un meeting a partire dal riepilogo. */
export async function requestMeetingTitle(projectId: string, text: string, locale: string): Promise<string> {
  const data = await postJson<{ title: string }>('/api/ai/title', { kind: 'meeting', projectId, text, locale });
  return data.title;
}
