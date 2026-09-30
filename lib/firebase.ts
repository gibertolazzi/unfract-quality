import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, initializeFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDGBvpS1mQlWZn7yR9P5nx-hFZ1CEbXxVw",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "unfract.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "unfract",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "unfract.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "124383774820",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:124383774820:web:e7afa7af7e97d352c4b771",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-FXE8BDM5ZS"
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
