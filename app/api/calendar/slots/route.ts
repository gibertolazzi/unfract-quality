import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { availableSlots } from '@/lib/server/bookingSlots';
import { tooManyRequests } from '@/lib/server/rateLimit';
import { isDay } from '@/lib/server/timeZone';

const USER_ID = /^[A-Za-z0-9_-]{1,128}$/;

/**
 * Orari liberi per la pagina pubblica di prenotazione. Non serve il login.
 *
 * `date` è il giorno scelto ("YYYY-MM-DD"). Prima arrivava come istante ISO
 * della mezzanotte del browser, che il server in UTC leggeva come il giorno
 * precedente; e gli orari di disponibilità si applicavano in UTC, due ore
 * dopo quelli impostati (segnalazione Q01).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId') || '';
  const day = searchParams.get('date');

  if (!USER_ID.test(userId) || !isDay(day)) {
    return NextResponse.json({ error: 'Utente o data non validi.' }, { status: 400 });
  }

  // Ogni richiesta interroga il calendario dell'utente con i suoi token.
  if (tooManyRequests(`calendar-slots:${userId}`, 120)) {
    return NextResponse.json({ error: 'Troppe richieste. Riprova fra un minuto.' }, { status: 429 });
  }

  try {
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'Utente non trovato.' }, { status: 404 });
    }
    const userData = userDoc.data() || {};
    const { slots, timeZone, bookingDuration, provider } = await availableSlots(userId, userData, day);

    return NextResponse.json({
      slots,
      timeZone,
      bookingDuration,
      provider,
      user: { displayName: userData.displayName || '', photoURL: userData.photoURL || '' },
    });
  } catch (error) {
    console.error('Calendar slots error:', error);
    return NextResponse.json({ error: 'Calendario non raggiungibile. Riprova più tardi.' }, { status: 502 });
  }
}
