import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, initializeFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase (prevent re-initialization in development)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore and Auth
// Configure Firestore to use long polling to prevent AbortError during Next.js Hot Reloads
const db = !getApps().length
  ? initializeFirestore(app, { experimentalAutoDetectLongPolling: true } as any)
  : getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

// Export instances
export { app, db, auth, storage, GoogleAuthProvider, signInWithPopup };
