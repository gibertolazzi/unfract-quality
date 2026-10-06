import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { createOAuthState } from '@/lib/server/oauthState';

/** Avvio del collegamento a Outlook. Vedi la route Google per il perché della POST autenticata. */
export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const clientId = process.env.MICROSOFT_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: 'Microsoft Client ID not configured' }, { status: 500 });
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/microsoft/callback`;
  const state = await createOAuthState(auth.user.uid, 'microsoft');

  const url = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_mode', 'query');
  url.searchParams.set('scope', 'offline_access Calendars.ReadWrite OnlineMeetings.ReadWrite');
  url.searchParams.set('state', state);

  return NextResponse.json({ url: url.toString() });
}
