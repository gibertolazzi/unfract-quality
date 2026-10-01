const fs = require('fs');
const path = 'components/marketing/CampaignSetupView.tsx';
let content = fs.readFileSync(path, 'utf8');

if (!content.startsWith("'use client';") && !content.startsWith('"use client";')) {
  content = "'use client';\n\n" + content;
  fs.writeFileSync(path, content);
}
