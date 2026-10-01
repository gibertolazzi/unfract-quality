const fs = require('fs');
const path = 'components/marketing/CampaignSetupView.tsx';
let content = fs.readFileSync(path, 'utf8');

const target = "onClick={() => router.push(`/marketing/editor/${campaign.id}`)}";
const replacement = "onClick={() => router.push(`/marketing/templates/${campaign.id}`)}";

content = content.replace(target, replacement);

fs.writeFileSync(path, content);
