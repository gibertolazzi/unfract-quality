const fs = require('fs');
const path = 'lib/crm/followupService.ts';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  'await deleteRecord(COLLECTION_NAME, id, ctx.uid);',
  'await deleteRecord(COLLECTION_NAME, id);'
);

fs.writeFileSync(path, content);
