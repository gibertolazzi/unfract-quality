const fs = require('fs');

function patchFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Remove module level instantiation
  content = content.replace(/const resend = new Resend\([^)]*\);\n?/g, '');
  
  // Insert instantiation inside POST
  content = content.replace(/export async function POST\([^)]*\)\s*\{/, "export async function POST(req) {\n  const resend = new Resend(process.env.RESEND_API_KEY);");
  content = content.replace(/export async function POST\(req: Request\)\s*\{/, "export async function POST(req: Request) {\n  const resend = new Resend(process.env.RESEND_API_KEY);");
  content = content.replace(/export async function POST\(req: NextRequest\)\s*\{/, "export async function POST(req: NextRequest) {\n  const resend = new Resend(process.env.RESEND_API_KEY);");
  
  fs.writeFileSync(filePath, content);
}

patchFile('app/api/email/invite/route.ts');
patchFile('app/api/email/send/route.ts');
patchFile('app/api/cron/process-emails/route.ts');
patchFile('app/api/crm/email/send/route.ts');
