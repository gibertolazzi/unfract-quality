import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/calendar?error=${error}`);
  }

  if (!code || !state) {
    return NextResponse.json({ error: 'Missing code or state' }, { status: 400 });
  }

  try {
    const { userId } = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
    if (!userId) throw new Error("Invalid state");

    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/microsoft/callback`;

    if (!clientId || !clientSecret) {
      throw new Error('Microsoft OAuth credentials not configured');
    }

    const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });

    if (!tokenResponse.ok) {
      const err = await tokenResponse.text();
      console.error('Error fetching Microsoft tokens:', err);
      throw new Error('Failed to exchange code for tokens');
    }

    const tokens = await tokenResponse.json();
    
    const updateData: any = {
      accessToken: tokens.access_token,
      expiresAt: Date.now() + (tokens.expires_in * 1000),
      updatedAt: new Date().toISOString()
    };
    if (tokens.refresh_token) {
      updateData.refreshToken = tokens.refresh_token;
    }

    await adminDb.doc(`users/${userId}/integrations/microsoft`).set(updateData, { merge: true });


    // Register Microsoft Graph Webhook (Hardcore Sync)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    if (appUrl.startsWith('https://')) { // MS requires HTTPS
      try {
        const expirationDateTime = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(); // MS webhooks expire in 3 days max
        await fetch('https://graph.microsoft.com/v1.0/subscriptions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            changeType: 'updated,deleted',
            notificationUrl: `${appUrl}/api/calendar/webhooks/microsoft`,
            resource: 'me/events',
            expirationDateTime,
            clientState: userId
          })
        });
      } catch (e) {
        console.error("Failed to register Microsoft Webhook:", e);
      }
    }

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/calendar?sync=success`);


  } catch (err: any) {
    console.error('Microsoft OAuth callback error:', err);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/calendar?error=oauth_failed`);
  }
}
