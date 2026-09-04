import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDGBvpS1mQlWZn7yR9P5nx-hFZ1CEbXxVw",
  authDomain: "unfract.firebaseapp.com",
  projectId: "unfract",
  storageBucket: "unfract.firebasestorage.app",
  messagingSenderId: "124383774820",
  appId: "1:124383774820:web:e7afa7af7e97d352c4b771",
  measurementId: "G-FXE8BDM5ZS"
};

// Initialize Firebase (prevent re-initialization in development)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore and Auth
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

// Export instances
export { app, db, auth, storage, GoogleAuthProvider, signInWithPopup };
