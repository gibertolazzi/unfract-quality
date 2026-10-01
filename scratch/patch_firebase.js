const fs = require('fs');

let content = fs.readFileSync('lib/firebase.ts', 'utf-8');

const replacement = `
// Support Firebase App Hosting which automatically injects FIREBASE_WEBAPP_CONFIG (server-side only)
let firebaseConfig;
if (typeof process !== 'undefined' && process.env && process.env.FIREBASE_WEBAPP_CONFIG) {
  firebaseConfig = JSON.parse(process.env.FIREBASE_WEBAPP_CONFIG);
} else {
  // Client-side fallback to NEXT_PUBLIC variables, or explicitly default to unfract-prod
  firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyBzawm3qUA4XdDYGDlN0llw5U0EGpXkc0g",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "unfract-prod.firebaseapp.com",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "unfract-prod",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "unfract-prod.firebasestorage.app",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "688460174746",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:688460174746:web:0209d2d0c3813639069623",
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-CDWXPHH1S8"
  };
}
`;

content = content.replace(/\/\/ Support Firebase App Hosting[\s\S]*?};/, replacement.trim());

fs.writeFileSync('lib/firebase.ts', content);
