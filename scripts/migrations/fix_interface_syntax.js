const fs = require('fs');

let oppDrawer = fs.readFileSync('/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/opportunita/OpportunityDrawer.tsx', 'utf8');
oppDrawer = oppDrawer.replace('props.onQuickFollowup?: (days: number) => void;', 'onQuickFollowup?: (days: number) => void;');
oppDrawer = oppDrawer.replace('onChangePhase, onArchive, onRestore, props.onQuickFollowup', 'onChangePhase, onArchive, onRestore, onQuickFollowup');
fs.writeFileSync('/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/opportunita/OpportunityDrawer.tsx', oppDrawer, 'utf8');

let oppSection = fs.readFileSync('/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/opportunita/OpportunitySection.tsx', 'utf8');
oppSection = oppSection.replace('props.onCreateQuickFollowup?: (oppId: string, days: number) => void;', 'onCreateQuickFollowup?: (oppId: string, days: number) => void;');
oppSection = oppSection.replace('onArchive, onRestore, props.onCreateQuickFollowup', 'onArchive, onRestore, onCreateQuickFollowup');
fs.writeFileSync('/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/opportunita/OpportunitySection.tsx', oppSection, 'utf8');

