const fs = require('fs');

function patchFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Move stripe initialization inside try block and add version
  content = content.replace(/const stripe = new Stripe\(process\.env\.STRIPE_SECRET_KEY as string\);\n\s*try \{/,
    `try {\n    if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is missing');\n    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {\n      apiVersion: '2023-10-16',\n    });`);
  
  fs.writeFileSync(filePath, content);
}

patchFile('app/api/stripe/webhook/route.ts');
patchFile('app/api/stripe/create-checkout/route.ts');
