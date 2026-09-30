import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

if (!getApps().length) {
  try {
    if (process.env.FIREBASE_PRIVATE_KEY) {
      // Local development with explicitly downloaded service account key
      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
    } else {
      // Production (Firebase App Hosting) automatically provides Application Default Credentials
      initializeApp();
    }
  } catch (error: any) {
    // Fallback for build time if ADC is not available
    console.warn('Initializing Firebase Admin with dummy project ID for build-time fallback.');
    initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || 'dummy-project-id' });
  }
}

export const adminDb = getFirestore();
export const adminAuth = getAuth();
