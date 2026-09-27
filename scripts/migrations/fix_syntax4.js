const fs = require('fs');

let oppSection = fs.readFileSync('/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/opportunita/OpportunitySection.tsx', 'utf8');
oppSection = oppSection.replace(
  'props.onCreateQuickFollowup?: (oppId: string, days: number) => void;\n}',
  'onCreateQuickFollowup?: (oppId: string, days: number) => void;\n}'
);
oppSection = oppSection.replace(
  '  onArchive, onRestore, props.onCreateQuickFollowup,\n}: OpportunitySectionProps) {',
  '  onArchive, onRestore, onCreateQuickFollowup,\n}: OpportunitySectionProps) {'
);
oppSection = oppSection.replace(/props\.props\.onCreateQuickFollowup/g, 'onCreateQuickFollowup');
oppSection = oppSection.replace(/props\.onCreateQuickFollowup/g, 'onCreateQuickFollowup');

fs.writeFileSync('/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/opportunita/OpportunitySection.tsx', oppSection, 'utf8');
