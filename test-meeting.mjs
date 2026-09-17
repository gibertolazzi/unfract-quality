import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDGBvpS1mQlWZn7yR9P5nx-hFZ1CEbXxVw",
  authDomain: "unfract.firebaseapp.com",
  projectId: "unfract",
  storageBucket: "unfract.firebasestorage.app",
  messagingSenderId: "124383774820",
  appId: "1:124383774820:web:e7afa7af7e97d352c4b771",
  measurementId: "G-FXE8BDM5ZS"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

async function checkMeeting(id) {
  const docRef = doc(db, 'meetings', id);
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    console.log(`Meeting ${id} found:`, snap.data());
  } else {
    console.log(`Meeting ${id} not found.`);
  }
}

async function run() {
  await checkMeeting('LLsxBlRnNg6ew3tgOhkR');
  await checkMeeting('asvtCo3RftM0BuQsMHKC');
  await checkMeeting('r8NewcZHQUzgGHHRG5If');
  process.exit(0);
}

run();
