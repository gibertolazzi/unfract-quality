const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/lib/firebase.ts';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  'import { getFirestore } from "firebase/firestore";',
  'import { getFirestore, initializeFirestore } from "firebase/firestore";'
);

content = content.replace(
  'const db = getFirestore(app);',
  `// Configure Firestore to use long polling to prevent AbortError during Next.js Hot Reloads
const db = !getApps().length
  ? initializeFirestore(app, { experimentalAutoDetectLongPolling: true } as any)
  : getFirestore(app);`
);

fs.writeFileSync(path, content, 'utf8');
