import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { createOAuthState } from '@/lib/server/oauthState';

/**
 * Avvio del collegamento a Google Calendar.
 *
 * È una POST autenticata che restituisce l'URL di Google: il browser poi ci
 * naviga. Prima era una GET con `userId` in query, e chiunque poteva avviare
 * un collegamento a nome di un altro utente.
 */
export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: 'Google Client ID not configured' }, { status: 500 });
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/google/callback`;
  const state = await createOAuthState(auth.user.uid, 'google');

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events');
  // prompt=consent e access_type=offline servono perché Google restituisca il refresh token
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('state', state);

  return NextResponse.json({ url: url.toString() });
}
