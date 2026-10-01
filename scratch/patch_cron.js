const fs = require('fs');
let content = fs.readFileSync('app/api/cron/process-emails/route.ts', 'utf-8');

content = content.replace(/export async function GET\(request: Request\) \{/,
  'export async function GET(request: Request) {\n  const resend = new Resend(process.env.RESEND_API_KEY);');

fs.writeFileSync('app/api/cron/process-emails/route.ts', content);
