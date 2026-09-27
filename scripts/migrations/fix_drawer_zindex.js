const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/anagrafica/RecordDrawer.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  'className="fixed inset-0 z-40 flex justify-end"',
  'className="fixed inset-0 z-[60] flex justify-end"'
);

fs.writeFileSync(path, content, 'utf8');
