const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/app/crm/page.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  'createLead, updateLead, changeLeadState, assignLead, archiveLead, InvalidTransitionError,',
  'createLead, updateLead, changeLeadState, assignLead, archiveLead, deleteLead, InvalidTransitionError,'
);

fs.writeFileSync(path, content, 'utf8');
