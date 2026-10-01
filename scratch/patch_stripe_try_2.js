const fs = require('fs');

function patchFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Remove the old stripe initialization
  content = content.replace(/const stripe = new Stripe\(process\.env\.STRIPE_SECRET_KEY as string\);\n?/g, '');
  
  // Inject inside POST
  content = content.replace(/export async function POST\([^)]*\)\s*\{/, 
    "export async function POST(req: any) {\n  if (!process.env.STRIPE_SECRET_KEY) {\n    return new Response(JSON.stringify({ error: 'Manca la chiave STRIPE_SECRET_KEY nel server.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });\n  }\n  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });");
  
  fs.writeFileSync(filePath, content);
}

patchFile('app/api/stripe/webhook/route.ts');
patchFile('app/api/stripe/create-checkout/route.ts');
