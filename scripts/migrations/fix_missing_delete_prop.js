const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/app/crm/page.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  'onArchiveLead={handleArchive}',
  'onArchiveLead={handleArchive}\n          onDeleteLead={lead => { deleteLead(ctx!, lead.id); toast.info(\'Lead eliminato\'); }}'
);

fs.writeFileSync(path, content, 'utf8');
