const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/contatti/UnifiedContactsSection.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  'onArchiveLead: (lead: CrmLead) => void;',
  'onArchiveLead: (lead: CrmLead) => void;\n  onDeleteLead?: (lead: CrmLead) => void;'
);

fs.writeFileSync(path, content, 'utf8');
