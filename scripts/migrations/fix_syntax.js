const fs = require('fs');
let content = fs.readFileSync('/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/dashboard/DashboardSection.tsx', 'utf8');

content = content.replace(
  '}: DashboardSectionProps) {',
  '} = props;'
);

fs.writeFileSync('/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/dashboard/DashboardSection.tsx', content, 'utf8');
