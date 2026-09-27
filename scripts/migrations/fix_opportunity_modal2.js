const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/opportunita/OpportunityFormModal.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  '    probability: opportunity?.probability ?? null,\n    expectedCloseDate: (opportunity?.expectedCloseDate || \'\').slice(0, 10),',
  '    probability: opportunity?.probability ?? null,\n    phase: opportunity?.phase || \'QUALIFICATION\',\n    expectedCloseDate: (opportunity?.expectedCloseDate || \'\').slice(0, 10),'
);

fs.writeFileSync(path, content, 'utf8');
