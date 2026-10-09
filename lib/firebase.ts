import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { authDomainFor } from "./authDomain";

// Your web app's Firebase configuration.
// I valori arrivano solo dall'ambiente: next.config.mjs li controlla e ferma
// la build se mancano (su App Hosting li ricava da FIREBASE_WEBAPP_CONFIG).
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: authDomainFor(
    typeof window !== 'undefined' ? window.location.hostname : undefined,
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  ),
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || undefined,
};

// Initialize Firebase (prevent re-initialization in development)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore and Auth
// Il long polling automatico è già il comportamento predefinito dell'SDK.
// Il vecchio ramo con initializeFirestore non partiva mai: getApps() non è
// più vuoto dopo initializeApp (segnalazione Q06).
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

// Export instances
export { app, db, auth, storage, GoogleAuthProvider, signInWithPopup };
