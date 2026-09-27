const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/contatti/UnifiedContactsSection.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add prop to interface
content = content.replace(
  'onDropConvert?: (id: string, type: string, targetType: string) => void;\n}',
  'onDropConvert?: (id: string, type: string, targetType: string) => void;\n  onCreateQuickFollowup?: (targetId: string, kind: string, days: number) => void;\n}'
);

// 2. Add it to RecordDrawer
content = content.replace(
  'onUploadDocument={props.onUploadDocument}\n        />',
  'onUploadDocument={props.onUploadDocument}\n          onQuickFollowup={days => props.onCreateQuickFollowup && props.onCreateQuickFollowup(liveDrawer.record.id, liveDrawer.kind, days)}\n        />'
);

// Also for lead drawer? Wait, lead has its own drawer in LeadSection? No, Lead doesn't use RecordDrawer! Lead uses LeadDrawer.
// Wait, `liveDrawer.kind !== 'lead'`. If it's a lead, what is rendered?
