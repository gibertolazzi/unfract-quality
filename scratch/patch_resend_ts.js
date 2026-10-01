const fs = require('fs');

function patchFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf-8');
  
  content = content.replace(/export async function POST\(req\) \{/, "export async function POST(req: any) {");
  
  fs.writeFileSync(filePath, content);
}

patchFile('app/api/email/invite/route.ts');
patchFile('app/api/email/send/route.ts');
