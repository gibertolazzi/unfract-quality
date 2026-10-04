import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, initializeFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
// Support Firebase App Hosting which automatically injects FIREBASE_WEBAPP_CONFIG (server-side only)
let firebaseConfig;
if (typeof process !== 'undefined' && process.env && process.env.FIREBASE_WEBAPP_CONFIG) {
  firebaseConfig = JSON.parse(process.env.FIREBASE_WEBAPP_CONFIG);
} else {
  // Client-side fallback to NEXT_PUBLIC variables, or explicitly default to unfract-prod
  firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyBzawm3qUA4XdDYGDlN0llw5U0EGpXkc0g",
    authDomain: typeof window !== 'undefined' && window.location.hostname === 'app.unfract.com'
      ? 'app.unfract.com'
      : process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "unfract-prod.firebaseapp.com",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "unfract-prod",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "unfract-prod.firebasestorage.app",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "688460174746",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:688460174746:web:0209d2d0c3813639069623",
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-CDWXPHH1S8"
  };
}

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
