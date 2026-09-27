const fs = require('fs');
let content = fs.readFileSync('/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/opportunita/OpportunityDrawer.tsx', 'utf8');

content = content.replace(
  '  props.onQuickFollowup?: (days: number) => void;\n}',
  '  onQuickFollowup?: (days: number) => void;\n}'
);

content = content.replace(
  '  onChangePhase, onArchive, onRestore, props.onQuickFollowup,\n}: OpportunityDrawerProps) {',
  '  onChangePhase, onArchive, onRestore, onQuickFollowup,\n}: OpportunityDrawerProps) {'
);

fs.writeFileSync('/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/opportunita/OpportunityDrawer.tsx', content, 'utf8');
