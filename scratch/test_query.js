const fs = require('fs');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const env = fs.readFileSync('.env.local', 'utf-8');
const projectId = env.match(/FIREBASE_PROJECT_ID="(.*)"/)[1];
const clientEmail = env.match(/FIREBASE_CLIENT_EMAIL="(.*)"/)[1];
const privateKey = env.match(/FIREBASE_PRIVATE_KEY="(.*)"/)[1].replace(/\\n/g, '\n');

initializeApp({
  credential: cert({
    projectId,
    clientEmail,
    privateKey,
  }),
});

const db = getFirestore();
db.collection('projects').get()
  .then((snapshot) => {
    console.log("Projects found:", snapshot.size);
    snapshot.forEach(doc => {
      console.log(doc.id, "=>", doc.data());
    });
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
