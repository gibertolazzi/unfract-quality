const fs = require('fs');

function cleanFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  content = content.replace(/\{ apiVersion: '2023-10-16' \}/, 'undefined');
  fs.writeFileSync(filePath, content);
}

cleanFile('app/api/stripe/create-checkout/route.ts');
cleanFile('app/api/stripe/webhook/route.ts');
