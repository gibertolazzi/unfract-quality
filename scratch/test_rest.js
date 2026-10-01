const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf-8');
const apiKey = env.match(/NEXT_PUBLIC_FIREBASE_API_KEY="(.*)"/)[1];
const projectId = env.match(/NEXT_PUBLIC_FIREBASE_PROJECT_ID="(.*)"/)[1];

const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents?key=${apiKey}`;

fetch(url)
  .then(res => res.json())
  .then(data => {
    console.log("REST Response:", data);
  })
  .catch(err => console.error(err));
