const fs = require('fs');
const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
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

getAuth().listUsers(10)
  .then(list => {
    console.log("Users:");
    list.users.forEach(u => console.log(u.uid, u.email));
    
    if (list.users.length > 0) {
      const db = getFirestore();
      return db.collection('projects').add({
        name: 'Untitled Project',
        userId: list.users[0].uid,
        createdAt: new Date()
      }).then(() => console.log("Created project for", list.users[0].uid));
    }
  })
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
