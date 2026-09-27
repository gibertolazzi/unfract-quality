const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/app/crm/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// For DashboardSection: add onOpenRecord
content = content.replace(
  'onShowOpportunities={() => setTab(\'opportunity\')}\n            onShowCustomers={() => setTab(\'contact\')}',
  'onShowOpportunities={() => setTab(\'opportunity\')}\n            onShowCustomers={() => setTab(\'contact\')}\n            onOpenRecord={({ kind, recordId }) => {\n              const rec = (kind === \'lead\' ? leads : kind === \'account\' ? accounts : kind === \'contact\' ? contacts : customers).find(r => r.id === recordId);\n              if (rec) {\n                setDrawer({ kind: kind as any, record: rec as any });\n                setTab(\'contact\');\n              }\n            }}'
);

// For RecordDrawer inside tab === 'contact' and tab === 'opportunity':
// Actually in page.tsx the Drawer is not rendered directly!
// It is rendered inside UnifiedContactsSection.tsx and OpportunitySection.tsx!
// Wait, so I need to pass onQuickFollowup through UnifiedContactsSection and OpportunitySection?
// Let's check UnifiedContactsSection!
