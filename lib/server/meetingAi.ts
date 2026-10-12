import { geminiApiKey, geminiClient } from '@/lib/server/gemini';

/**
 * Riassunto, decisioni e task di un meeting, con Gemini.
 *
 * È la logica che prima stava in `lib/gemini.ts` e girava nel browser con la
 * chiave pubblica. L'audio ora lo scarica il server da Firebase Storage
 * (vedi `meetingAudioPath`), così il browser non deve rimandarlo.
 */

export interface MeetingAnalysis {
  summary: string;
  decisions: string[];
  tasks: { title: string; assignee?: string; priority?: string }[];
  transcript?: string;
}

const MAX_AUDIO_BYTES = 200 * 1024 * 1024;
const GEMINI_BASE = 'https://generativelanguage.googleapis.com';

/**
 * Percorso dell'audio di un meeting, se l'URL è un download di Firebase
 * Storage del nostro bucket e sta nella cartella del progetto indicato.
 * Altrimenti `null`: il server non scarica indirizzi qualsiasi.
 */
export function meetingAudioPath(audioUrl: string, projectId: string, bucket: string): string | null {
  let url: URL;
  try {
    url = new URL(audioUrl);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.hostname !== 'firebasestorage.googleapis.com' || url.port) return null;

  const match = url.pathname.match(/^\/v0\/b\/([^/]+)\/o\/([^/]+)$/);
  if (!match || !bucket || decodeURIComponent(match[1]) !== bucket) return null;

  const path = decodeURIComponent(match[2]);
  if (!path.startsWith(`meetings/${projectId}/`) || path.includes('..')) return null;
  return path;
}

/** Scarica l'audio, con un tetto di dimensione. `null` se non riesce. */
export async function downloadMeetingAudio(audioUrl: string): Promise<{ data: Buffer; mimeType: string } | null> {
  try {
    const response = await fetch(audioUrl, { redirect: 'error', cache: 'no-store' });
    if (!response.ok) {
      console.error('Audio del meeting non scaricato:', response.status);
      return null;
    }
    const declared = Number(response.headers.get('content-length') || 0);
    if (declared > MAX_AUDIO_BYTES) return null;
    const data = Buffer.from(await response.arrayBuffer());
    if (data.length > MAX_AUDIO_BYTES) return null;
    const mimeType = (response.headers.get('content-type') || 'audio/webm').split(';')[0];
    return { data, mimeType: mimeType.startsWith('audio/') ? mimeType : 'audio/webm' };
  } catch (error) {
    console.error('Audio del meeting non scaricato:', error);
    return null;
  }
}

/** Carica l'audio sulla File API di Gemini. `null` se non riesce: si prosegue col solo testo. */
async function uploadToGemini(audio: { data: Buffer; mimeType: string }): Promise<{ uri: string; mimeType: string } | null> {
  const key = geminiApiKey();
  try {
    const start = await fetch(`${GEMINI_BASE}/upload/v1beta/files?key=${key}`, {
      method: 'POST',
      headers: {
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': String(audio.data.length),
        'X-Goog-Upload-Header-Content-Type': audio.mimeType,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ file: { display_name: 'meeting_audio.webm' } }),
    });
    const uploadUrl = start.ok ? start.headers.get('x-goog-upload-url') : null;
    if (!uploadUrl) {
      console.error('Avvio upload su Gemini non riuscito:', start.status);
      return null;
    }

    const upload = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'upload, finalize',
        'X-Goog-Upload-Offset': '0',
      },
      body: new Uint8Array(audio.data),
    });
    if (!upload.ok) {
      console.error('Upload su Gemini non riuscito:', upload.status);
      return null;
    }

    const info = await upload.json();
    let state = info.file?.state;
    // Gemini impiega qualche secondo a preparare gli audio lunghi.
    for (let attempt = 0; state === 'PROCESSING' && attempt < 60; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const status = await fetch(`${GEMINI_BASE}/v1beta/${info.file.name}?key=${key}`);
      state = (await status.json()).state;
    }
    if (state !== 'ACTIVE') {
      console.error('Gemini non ha elaborato l’audio, si prosegue col testo. Stato:', state);
      return null;
    }
    return { uri: info.file.uri, mimeType: info.file.mimeType };
  } catch (error) {
    console.error('Upload su Gemini non riuscito, si prosegue col testo:', error);
    return null;
  }
}

function buildPrompt(hasAudio: boolean, transcript: string, locale: 'it' | 'en' = 'it'): string {
  if (locale === 'en') {
    return `
You are an AI assistant specialized in analyzing business meetings.
${hasAudio ? "Listen to the audio attached to this message." : 'Read the following meeting transcript:'}
${transcript ? `Here is a partial/raw transcript (use it as context for analysis):\n${transcript}\n` : ''}

You must extract the following information and output EXACTLY this JSON format (no other text, strictly valid JSON).
All output fields (summary, decisions, task titles) must be strictly in English.

{
  "summary": "A conversational summary of max 3 paragraphs of the meeting in English.",
  "decisions": ["Decision 1", "Decision 2"],
  "tasks": [
    {
      "title": "Task title in English",
      "assignee": "Person name (if specified, otherwise empty string)",
      "priority": "LOW" // Possible values: LOW, MEDIUM, HIGH, CRITICAL. Choose the most appropriate priority.
    }
  ]
}
`;
  }

  return `
Sei un assistente AI specializzato nell'analisi dei meeting aziendali.
${hasAudio ? "Ascolta l'audio allegato a questo messaggio." : 'Leggi la seguente trascrizione del meeting:'}
${transcript ? `Ecco una trascrizione parziale/grezza (usala come base per l'analisi):\n${transcript}\n` : ''}

Devi estrarre le seguenti informazioni ed emettere ESATTAMENTE questo formato JSON (nessun altro testo, solo JSON valido).
Tutti i campi estratti (summary, decisions, titoli dei task) devono essere rigorosamente in italiano.

{
  "summary": "Un riassunto discorsivo di max 3 paragrafi del meeting in italiano.",
  "decisions": ["Decisione 1", "Decisione 2"],
  "tasks": [
    {
      "title": "Titolo del task in italiano",
      "assignee": "Nome persona (se specificato, altrimenti vuoto)",
      "priority": "LOW" // Valori possibili: LOW, MEDIUM, HIGH, CRITICAL. Scegli la priorità più adatta.
    }
  ]
}
`;
}

export async function analyzeMeeting(audio: { data: Buffer; mimeType: string } | null, transcript: string, locale: 'it' | 'en' = 'it'): Promise<MeetingAnalysis> {
  const genAI = geminiClient();
  const file = audio ? await uploadToGemini(audio) : null;
  const prompt = buildPrompt(!!file, transcript, locale);

  // Stessi modelli e stessi tentativi della versione che girava nel browser.
  const modelsToTry = file
    ? ['gemini-3.5-transcribe', 'gemini-3.8-flash', 'gemini-3.6-flash']
    : ['gemini-3.8-flash', 'gemini-3.6-flash'];
  const MAX_RETRIES = 3;
  let lastError: unknown;

  for (const modelName of modelsToTry) {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const responseMimeType = modelName.includes('transcribe') ? 'text/plain' : 'application/json';
        const model = genAI.getGenerativeModel({ model: modelName, generationConfig: { responseMimeType } });
        const result = file
          ? await model.generateContent([prompt, { fileData: { mimeType: file.mimeType, fileUri: file.uri } }])
          : await model.generateContent(prompt);
        const text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(text);
        return {
          summary: String(parsed.summary || ''),
          decisions: Array.isArray(parsed.decisions) ? parsed.decisions.map(String) : [],
          tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
          ...(typeof parsed.transcript === 'string' ? { transcript: parsed.transcript } : {}),
        };
      } catch (error: any) {
        lastError = error;
        const message = String(error?.message || '');
        if ((message.includes('503') || message.includes('429')) && attempt < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, attempt * 2000));
          continue;
        }
        console.error(`Modello ${modelName} non riuscito dopo ${attempt} tentativi:`, message || error);
        break;
      }
    }
  }
  throw lastError ?? new Error('Nessun modello ha risposto.');
}
