const fs = require('fs');

function cleanFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  content = content.replace(/try \{\n    if \(\!process\.env\.STRIPE_SECRET_KEY\) throw new Error\('STRIPE_SECRET_KEY is missing'\);\n    const stripe = new Stripe\(process\.env\.STRIPE_SECRET_KEY, \{\n      apiVersion: '2023-10-16',\n    \}\);/, 'try {');
  fs.writeFileSync(filePath, content);
}

cleanFile('app/api/stripe/create-checkout/route.ts');
