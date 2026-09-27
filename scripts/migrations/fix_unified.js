const fs = require('fs');

let unified = fs.readFileSync('/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/contatti/UnifiedContactsSection.tsx', 'utf8');

if (!unified.includes('onCreateQuickFollowup?: (targetId: string, kind: string, days: number) => void;')) {
  unified = unified.replace(
    '  onCreateAccount: (values: AccountFormValues) => void;',
    '  onCreateQuickFollowup?: (targetId: string, kind: string, days: number) => void;\n  onCreateAccount: (values: AccountFormValues) => void;'
  );
  
  // Also pass it from props to RecordDrawer
  unified = unified.replace(
    'onDownloadDocument={props.onDownloadDocument}',
    'onDownloadDocument={props.onDownloadDocument}\n          onQuickFollowup={days => props.onCreateQuickFollowup && props.onCreateQuickFollowup(liveDrawer.record.id, liveDrawer.kind, days)}'
  );
}

fs.writeFileSync('/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/contatti/UnifiedContactsSection.tsx', unified, 'utf8');
