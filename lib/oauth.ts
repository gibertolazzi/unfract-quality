import { adminDb } from '@/lib/firebase-admin';

export async function getValidAccessToken(userId: string, provider: 'google' | 'microsoft'): Promise<string | null> {
  const docRef = adminDb.doc(`users/${userId}/integrations/${provider}`);
  const snapshot = await docRef.get();
  
  if (!snapshot.exists) {
    return null;
  }
  
  const data = snapshot.data();
  if (!data) return null;
  
  const { accessToken, refreshToken, expiresAt } = data;
  
  // If the token is valid for at least 5 more minutes (300000 ms)
  if (expiresAt && Date.now() < expiresAt - 300000) {
    return accessToken;
  }
  
  // Need to refresh
  if (!refreshToken) {
    console.error(`No refresh token available for ${provider}`);
    return null;
  }
  
  try {
    let url = '';
    let body = new URLSearchParams();
    
    if (provider === 'google') {
      url = 'https://oauth2.googleapis.com/token';
      body.append('client_id', process.env.GOOGLE_CLIENT_ID!);
      body.append('client_secret', process.env.GOOGLE_CLIENT_SECRET!);
      body.append('refresh_token', refreshToken);
      body.append('grant_type', 'refresh_token');
    } else if (provider === 'microsoft') {
      url = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
      body.append('client_id', process.env.MICROSOFT_CLIENT_ID!);
      body.append('client_secret', process.env.MICROSOFT_CLIENT_SECRET!);
      body.append('refresh_token', refreshToken);
      body.append('grant_type', 'refresh_token');
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    
    if (!response.ok) {
      throw new Error(`Refresh failed: ${await response.text()}`);
    }
    
    const tokens = await response.json();
    
    const updateData: any = {
      accessToken: tokens.access_token,
      expiresAt: Date.now() + (tokens.expires_in * 1000),
      updatedAt: new Date().toISOString()
    };
    if (tokens.refresh_token) {
      updateData.refreshToken = tokens.refresh_token;
    }
    
    await docRef.set(updateData, { merge: true });
    
    return tokens.access_token;
  } catch (error) {
    console.error(`Error refreshing ${provider} token:`, error);
    return null;
  }
}
