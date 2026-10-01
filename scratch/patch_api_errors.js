const fs = require('fs');

// Fix req vs request
let content = fs.readFileSync('app/api/crm/email/send/route.ts', 'utf-8');
content = content.replace(/export async function POST\(req: any\) \{/, 'export async function POST(request: any) {');
fs.writeFileSync('app/api/crm/email/send/route.ts', content);

// Fix resend scope in cron
let cronContent = fs.readFileSync('app/api/cron/process-emails/route.ts', 'utf-8');
// The cron file probably had `resend` used inside another function?
// Let's check where it's used.
