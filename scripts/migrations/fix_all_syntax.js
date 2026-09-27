const fs = require('fs');

// 1. RecordDrawer
let recordDrawer = fs.readFileSync('/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/anagrafica/RecordDrawer.tsx', 'utf8');
if (!recordDrawer.includes('CalendarClock,')) {
  recordDrawer = recordDrawer.replace("import { Pencil,", "import { Pencil, CalendarClock,");
}
fs.writeFileSync('/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/anagrafica/RecordDrawer.tsx', recordDrawer, 'utf8');

// 2. OpportunityDrawer
let oppDrawer = fs.readFileSync('/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/opportunita/OpportunityDrawer.tsx', 'utf8');
if (!oppDrawer.includes('CalendarClock,')) {
  oppDrawer = oppDrawer.replace("import { Pencil,", "import { Pencil, CalendarClock,");
}
oppDrawer = oppDrawer.replace(/props\.onQuickFollowup/g, 'onQuickFollowup');
fs.writeFileSync('/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/opportunita/OpportunityDrawer.tsx', oppDrawer, 'utf8');

// 3. OpportunitySection
let oppSection = fs.readFileSync('/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/opportunita/OpportunitySection.tsx', 'utf8');
oppSection = oppSection.replace(/props\.onCreateQuickFollowup/g, 'onCreateQuickFollowup');
fs.writeFileSync('/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/opportunita/OpportunitySection.tsx', oppSection, 'utf8');

