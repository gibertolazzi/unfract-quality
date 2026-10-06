import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// Niente ripiego su un progetto finto: se le credenziali sono sbagliate,
// l'errore deve comparire qui e subito, non più tardi in un punto qualsiasi.
if (!getApps().length) {
  if (process.env.FIREBASE_PRIVATE_KEY) {
    // Local development: chiave di un service account, solo in .env.local
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
}

export const adminDb = getFirestore();
export const adminAuth = getAuth();
