const fs = require('fs');
let content = fs.readFileSync('/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/dashboard/DashboardSection.tsx', 'utf8');

// I will just replace the whole onClick handler that I messed up
const regex = /onClick=\{\(\) => \{[\s\S]*?className="w-full flex items-center/m;
const replacement = `onClick={() => {
                         if (kind && targetId && onOpenRecord) {
                           onOpenRecord({ kind: kind as any, recordId: targetId });
                         } else {
                           onShowFollowups('today');
                         }
                      }}
                      className="w-full flex items-center`;

content = content.replace(regex, replacement);

fs.writeFileSync('/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/dashboard/DashboardSection.tsx', content, 'utf8');
