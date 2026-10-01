const fs = require('fs');
const filePath = 'components/crm/anagrafica/RecordDrawer.tsx';
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(/\{lead\.role &&/g, "{(lead as any).role &&");
content = content.replace(/\{lead\.role\}/g, "{(lead as any).role}");
content = content.replace(/\{lead\.companyWebsite &&/g, "{(lead as any).companyWebsite &&");
content = content.replace(/\{lead\.companyWebsite\}/g, "{(lead as any).companyWebsite}");

fs.writeFileSync(filePath, content);
