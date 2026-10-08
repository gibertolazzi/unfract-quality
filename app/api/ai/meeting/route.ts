import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { tooManyRequestsShared } from '@/lib/server/rateLimit';
import { AI_CREDITS_EXHAUSTED, aiProjectWorkspace, countAiCall } from '@/lib/server/usage';
import { GeminiNotConfiguredError } from '@/lib/server/gemini';
import { analyzeMeeting, downloadMeetingAudio, meetingAudioPath } from '@/lib/server/meetingAi';
import { readJsonObject } from '@/lib/server/requestBody';

export const runtime = 'nodejs';
export const maxDuration = 300;

const MAX_TRANSCRIPT = 200_000;

/**
 * Analisi di un meeting registrato: riassunto, decisioni e task.
 *
 * Body: `{ projectId, audioUrl?, transcript? }`. L'audio si usa solo se è un
 * file di Firebase Storage nella cartella del progetto, e solo se l'utente ha
 * accesso a quel progetto. Senza audio si lavora sulla trascrizione.
 */
export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const { uid } = auth.user;

  if (await tooManyRequestsShared(`ai-meeting:${uid}`, 5)) {
    return NextResponse.json({ error: 'Troppe richieste. Riprova fra un minuto.' }, { status: 429 });
  }

  const body = await readJsonObject(request);
  if (!body) {
    return NextResponse.json({ error: 'Richiesta non leggibile.' }, { status: 400 });
  }

  const projectId = typeof body.projectId === 'string' ? body.projectId : '';
  const audioUrl = typeof body.audioUrl === 'string' ? body.audioUrl : '';
  const transcript = typeof body.transcript === 'string' ? body.transcript.slice(0, MAX_TRANSCRIPT) : '';

  const project = await aiProjectWorkspace(uid, projectId);
  if (!project.allowed) {
    return NextResponse.json({ error: 'Progetto non trovato.' }, { status: 404 });
  }
  if (project.outOfCredits) {
    return NextResponse.json({ error: AI_CREDITS_EXHAUSTED, code: 'ai-credits-exhausted' }, { status: 402 });
  }

  let audio = null;
  if (audioUrl) {
    const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '';
    if (!meetingAudioPath(audioUrl, projectId, bucket)) {
      return NextResponse.json({ error: 'Audio non valido per questo progetto.' }, { status: 400 });
    }
    audio = await downloadMeetingAudio(audioUrl);
  }

  if (!audio && !transcript.trim()) {
    return NextResponse.json({ error: 'Niente da analizzare: manca sia l’audio sia la trascrizione.' }, { status: 400 });
  }

  try {
    const result = await analyzeMeeting(audio, transcript);
    await countAiCall(project.workspaceId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof GeminiNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error('Analisi del meeting non riuscita:', error);
    return NextResponse.json({ error: 'L’analisi AI del meeting non è riuscita.' }, { status: 502 });
  }
}
