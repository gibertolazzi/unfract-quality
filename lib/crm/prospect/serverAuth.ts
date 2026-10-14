import { tooManyRequestsShared } from '@/lib/server/rateLimit';

/**
 * L'autenticazione delle route della sezione, in un posto solo.
 *
 * Era già scritta dentro la route dell'identità. Alla seconda route sarebbe
 * diventata una copia, e una copia di un controllo di sicurezza è il modo in
 * cui una correzione finisce applicata a metà.
 *
 * Due regole, entrambe già valide per la route delle email del CRM:
 *
 * - **si fallisce chiusi**: qualunque cosa vada storta nella verifica del
 *   token è un «no», mai un «probabilmente sì»;
 * - **nessun valore di ripiego** per le variabili d'ambiente: se manca la
 *   configurazione la route lo dice, invece di funzionare a metà.
 *
 * Senza SDK admin la verifica passa da `identitytoolkit`, come nel resto del
 * prodotto: è una chiamata in più per richiesta, ed è il prezzo della deroga
 * che tiene il CRM senza backend.
 */

export interface AuthOk {
  ok: true;
  uid: string;
}

export interface AuthKo {
  ok: false;
  status: 401 | 429 | 500;
  error: string;
}

export type AuthResult = AuthOk | AuthKo;

async function verificaToken(idToken: string, apiKey: string): Promise<string> {
  try {
    const risposta = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!risposta.ok) return '';
    const dati = await risposta.json();
    return dati?.users?.[0]?.localId || '';
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return '';
  }
}

export interface GuardOptions {
  /** Nome dell'operazione: entra nel conteggio, così due route non si sommano. */
  operation: string;
  /** Quante richieste per utente nella finestra. */
  limit: number;
  windowMs?: number;
}

/**
 * Autentica la richiesta e applica il limite. Da chiamare per prima cosa in
 * ogni route della sezione, prima di leggere il corpo: un corpo malformato da
 * un utente non autenticato non merita nemmeno di essere interpretato.
 */
export async function guardRequest(request: Request, options: GuardOptions): Promise<AuthResult> {
  const autorizzazione = request.headers.get('authorization') || '';
  const idToken = autorizzazione.startsWith('Bearer ') ? autorizzazione.slice(7).trim() : '';
  if (!idToken) return { ok: false, status: 401, error: 'Autenticazione mancante.' };

  const apiKey = process.env.FIREBASE_WEB_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  let uid = '';

  if (apiKey) {
    uid = await verificaToken(idToken, apiKey);
  }

  // Fallback con Firebase Admin SDK se apiKey non è impostata o identitytoolkit fallisce
  if (!uid) {
    try {
      const { adminAuth } = await import('@/lib/firebase-admin');
      const decoded = await adminAuth.verifyIdToken(idToken);
      uid = decoded?.uid || '';
    } catch {
      // Token non valido o Admin SDK non configurato
    }
  }

  if (!uid) {
    return { ok: false, status: 401, error: 'Autenticazione non valida o sessione scaduta.' };
  }

  const finestraMs = options.windowMs ?? 60_000;
  // Il limite vale **per utente** ed è condiviso fra le istanze (S21): un ciclo
  // sbagliato in una pagina non deve diventare un abuso a nome del progetto.
  if (await tooManyRequestsShared(`prospect-${options.operation}:${uid}`, options.limit, finestraMs)) {
    return { ok: false, status: 429,
      error: `Troppe richieste in poco tempo. Riprova fra ${Math.round(finestraMs / 1000)} secondi.` };
  }

  return { ok: true, uid };
}
