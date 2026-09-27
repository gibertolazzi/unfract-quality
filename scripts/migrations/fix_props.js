const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/dashboard/DashboardSection.tsx';
let content = fs.readFileSync(path, 'utf8');

// I need to add onOpenRecord to the destructuring
content = content.replace(
  '  onShowOpportunities,\n  onShowCustomers,\n}: DashboardSectionProps) {',
  '  onShowOpportunities,\n  onShowCustomers,\n  onOpenRecord,\n}: DashboardSectionProps) {'
);

// I used props.onOpenRecord in the replacement, let's change it to just onOpenRecord
content = content.replace(/props\.onOpenRecord/g, 'onOpenRecord');

fs.writeFileSync(path, content, 'utf8');
