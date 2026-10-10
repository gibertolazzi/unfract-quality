import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { consumeOAuthState } from '@/lib/server/oauthState';
import { newChannelId, newChannelSecret, saveChannel } from '@/lib/server/calendarChannels';

import { appUrl } from '@/lib/appUrl';
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(`${appUrl()}/calendar?error=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return NextResponse.json({ error: 'Missing code or state' }, { status: 400 });
  }

  try {
    // Lo state è casuale e salvato sul server all'avvio: dice chi ha avviato il collegamento.
    const userId = await consumeOAuthState(state, 'google');
    if (!userId) throw new Error('Invalid or expired state');

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = `${appUrl()}/api/auth/google/callback`;

    if (!clientId || !clientSecret) {
      throw new Error('Google OAuth credentials not configured');
    }

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });

    if (!tokenResponse.ok) {
      const err = await tokenResponse.text();
      console.error('Error fetching Google tokens:', err);
      throw new Error('Failed to exchange code for tokens');
    }

    const tokens = await tokenResponse.json();
    
    const updateData: Record<string, unknown> = {
      accessToken: tokens.access_token,
      expiresAt: Date.now() + (tokens.expires_in * 1000),
      updatedAt: new Date().toISOString()
    };
    if (tokens.refresh_token) {
      updateData.refreshToken = tokens.refresh_token;
    }

    await adminDb.doc(`users/${userId}/integrations/google`).set(updateData, { merge: true });


    // Register Google Calendar Webhook (Hardcore Sync)
    const baseUrl = appUrl();
    if (baseUrl.startsWith('https://')) { // Google requires HTTPS for webhooks
      try {
        // Ogni canale ha un id e un segreto casuali: Google li rimanda in ogni avviso
        // e il webhook accetta solo avvisi con il segreto giusto.
        const channelId = newChannelId();
        const secret = newChannelSecret();
        const watch = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events/watch', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: channelId,
            token: secret,
            type: 'web_hook',
            address: `${baseUrl}/api/calendar/webhooks/google`
          })
        });
        if (watch.ok) {
          const channel = await watch.json().catch(() => ({}));
          await saveChannel(channelId, {
            uid: userId,
            provider: 'google',
            secret,
            expiresAt: channel.expiration ? Number(channel.expiration) : null,
          });
        } else {
          console.error('Google watch registration failed:', watch.status);
        }
      } catch (e) {
        console.error("Failed to register Google Webhook:", e);
      }
    }

    // Redirect to the calendar with a success message

    return NextResponse.redirect(`${appUrl()}/calendar?sync=success`);

  } catch (err) {
    console.error('Google OAuth callback error:', err);
    return NextResponse.redirect(`${appUrl()}/calendar?error=oauth_failed`);
  }
}
