const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/opportunita/OpportunityDrawer.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/props\.onQuickFollowup/g, 'onQuickFollowup');

fs.writeFileSync(path, content, 'utf8');
