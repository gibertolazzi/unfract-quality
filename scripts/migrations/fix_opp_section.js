const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/opportunita/OpportunitySection.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  'onArchive: (opportunity: CrmOpportunity) => void;\n  onRestore: (opportunity: CrmOpportunity) => void;\n}',
  'onArchive: (opportunity: CrmOpportunity) => void;\n  onRestore: (opportunity: CrmOpportunity) => void;\n  onCreateQuickFollowup?: (oppId: string, days: number) => void;\n}'
);

content = content.replace(
  '  onChangePhase={(to, lostReason) => onChangePhase(selected, to, { lostReason })}\n        />',
  '  onChangePhase={(to, lostReason) => onChangePhase(selected, to, { lostReason })}\n          onQuickFollowup={days => props.onCreateQuickFollowup && props.onCreateQuickFollowup(selected.id, days)}\n        />'
);

fs.writeFileSync(path, content, 'utf8');
