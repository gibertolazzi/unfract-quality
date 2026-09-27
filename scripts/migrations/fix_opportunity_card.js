const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/opportunita/OpportunityCard.tsx';
let content = fs.readFileSync(path, 'utf8');

// Replace button with div
content = content.replace(
  '<button\n      type="button"',
  '<div\n      role="button"\n      tabIndex={0}'
);
content = content.replace(
  '</button>',
  '</div>'
);

fs.writeFileSync(path, content, 'utf8');
