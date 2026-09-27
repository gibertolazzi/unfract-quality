const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/lib/firebase.ts';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  `// Initialize Firebase (prevent re-initialization in development)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Configure Firestore to use long polling to prevent AbortError during Next.js Hot Reloads
const db = !getApps().length
  ? initializeFirestore(app, { experimentalAutoDetectLongPolling: true } as any)
  : getFirestore(app);`,
  `// Initialize Firebase (prevent re-initialization in development)
let app;
let db;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
  // Configure Firestore to use long polling to prevent AbortError during Next.js Hot Reloads
  db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true } as any);
} else {
  app = getApp();
  db = getFirestore(app);
}`
);

fs.writeFileSync(path, content, 'utf8');
