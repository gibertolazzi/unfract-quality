import { NextResponse } from 'next/server';
import { viesProvider } from '@/lib/crm/prospect/providers/vies';
import { partitaIvaValida } from '@/lib/crm/prospect/recognize';
import { guardRequest } from '@/lib/crm/prospect/serverAuth';

/**
 * Verifica di una partita IVA presso VIES.
 *
 * Sta sul server per due motivi, nessuno dei quali è una preferenza: VIES non
 * manda gli header CORS, quindi dal browser la chiamata non parte proprio; e
 * una chiamata a un servizio esterno fatta dal browser di ogni utente è
 * impossibile da limitare.
 *
 * Autenticazione, variabili d'ambiente senza ripieghi e limite di richieste
 * per utente stanno in `lib/crm/prospect/serverAuth.ts`, condivisi con le
 * altre route della sezione: venti verifiche al minuto per utente, perché un
 * ciclo sbagliato in una pagina non si trasformi in un abuso del servizio
 * della Commissione.
 *
 * Non scrive niente: restituisce il risultato, e il browser decide cosa farne.
 * Senza SDK admin questa route non può scrivere su Firestore.
 */

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const guardia = await guardRequest(request, { operation: 'identity', limit: 20 });
  if (!guardia.ok) {
    return NextResponse.json({ error: guardia.error }, { status: guardia.status });
  }

  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Richiesta non leggibile.' }, { status: 400 });
  }

  const vatNumber = String(payload?.vatNumber || '').trim();
  if (!vatNumber) {
    return NextResponse.json({ error: 'Partita IVA mancante.' }, { status: 400 });
  }

  // Si ferma prima di disturbare VIES: una partita IVA con la cifra di
  // controllo sbagliata è un errore di battitura, non un'azienda che non
  // risulta, e le due cose vanno dette in modo diverso.
  if (!partitaIvaValida(vatNumber)) {
    return NextResponse.json({
      error: 'Non è una partita IVA italiana valida: la cifra di controllo non torna.',
      code: 'INVALID_CHECKSUM',
    }, { status: 400 });
  }

  const esito = await viesProvider.lookup(vatNumber);

  if (!esito.ok) {
    return NextResponse.json(
      { error: esito.failure.message, code: esito.failure.code, retryable: esito.failure.retryable },
      { status: esito.failure.retryable ? 503 : 400 }
    );
  }

  return NextResponse.json({ result: esito.result });
}
