const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/opportunita/OpportunityDrawer.tsx';
let content = fs.readFileSync(path, 'utf8');

if (!content.includes('onQuickFollowup?: (days: number) => void;')) {
  content = content.replace(
    '  onChangePhase: (to: OpportunityPhase, lostReason?: string) => void;\n}',
    '  onChangePhase: (to: OpportunityPhase, lostReason?: string) => void;\n  onQuickFollowup?: (days: number) => void;\n}'
  );
}

fs.writeFileSync(path, content, 'utf8');
