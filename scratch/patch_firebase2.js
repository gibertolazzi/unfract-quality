const fs = require('fs');

let content = fs.readFileSync('lib/firebase.ts', 'utf-8');

content = content.replace(/}\n}/g, '}');

fs.writeFileSync('lib/firebase.ts', content);
