const fs = require('fs');

function patchFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf-8');
  
  content = content.replace(/const stripe = new Stripe\([^)]*\);\n?/g, '');
  content = content.replace(/export async function POST\([^)]*\)\s*\{/, "export async function POST(req: any) {\n  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);");
  
  fs.writeFileSync(filePath, content);
}

patchFile('app/api/stripe/webhook/route.ts');
patchFile('app/api/stripe/create-checkout/route.ts');
