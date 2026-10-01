require('dotenv').config({ path: '.env.local' });
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});

const db = getFirestore();
db.collection('test').limit(1).get()
  .then(() => {
    console.log("Firestore is accessible!");
    process.exit(0);
  })
  .catch(err => {
    console.error("Error accessing Firestore:", err.message);
    process.exit(1);
  });
