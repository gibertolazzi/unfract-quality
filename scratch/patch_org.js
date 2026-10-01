const fs = require('fs');

let content = fs.readFileSync('app/(authenticated)/organization/page.tsx', 'utf-8');

// Add memberUids array
content = content.replace(/ownerId: user\.uid,\n\s*memberCount: 1,/,
  "ownerId: user.uid,\n        memberUids: [user.uid],\n        memberCount: 1,");

fs.writeFileSync('app/(authenticated)/organization/page.tsx', content);
