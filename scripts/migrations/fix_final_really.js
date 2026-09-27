const fs = require('fs');

// 1. RecordDrawer - add CalendarClock to lucide-react import
let recordDrawer = fs.readFileSync('/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/anagrafica/RecordDrawer.tsx', 'utf8');
if (!recordDrawer.includes('CalendarClock,') && recordDrawer.includes('lucide-react')) {
  recordDrawer = recordDrawer.replace("import {", "import { CalendarClock,");
}
fs.writeFileSync('/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/anagrafica/RecordDrawer.tsx', recordDrawer, 'utf8');

// 2. OpportunityDrawer - add CalendarClock and fix props
let oppDrawer = fs.readFileSync('/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/opportunita/OpportunityDrawer.tsx', 'utf8');
if (!oppDrawer.includes('CalendarClock,') && oppDrawer.includes('lucide-react')) {
  oppDrawer = oppDrawer.replace("import {", "import { CalendarClock,");
}
oppDrawer = oppDrawer.replace(/onQuickFollowup\(/g, 'props.onQuickFollowup(');
oppDrawer = oppDrawer.replace(/\{onQuickFollowup/g, '{props.onQuickFollowup');
oppDrawer = oppDrawer.replace(/props\.props\./g, 'props.');
fs.writeFileSync('/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/opportunita/OpportunityDrawer.tsx', oppDrawer, 'utf8');

// 3. OpportunitySection - fix props
let oppSection = fs.readFileSync('/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/opportunita/OpportunitySection.tsx', 'utf8');
oppSection = oppSection.replace(/onCreateQuickFollowup && onCreateQuickFollowup/g, 'props.onCreateQuickFollowup && props.onCreateQuickFollowup');
oppSection = oppSection.replace(/props\.props\./g, 'props.');
fs.writeFileSync('/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/opportunita/OpportunitySection.tsx', oppSection, 'utf8');

