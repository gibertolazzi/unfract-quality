const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/contatti/UnifiedContactsSection.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  'const targetRecord = unifiedRecords.find',
  'const targetRecord = allUnifiedRecords.find'
);

fs.writeFileSync(path, content, 'utf8');
