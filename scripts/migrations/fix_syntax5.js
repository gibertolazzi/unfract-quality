const fs = require('fs');

let recordDrawer = fs.readFileSync('/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/anagrafica/RecordDrawer.tsx', 'utf8');
recordDrawer = recordDrawer.replace("import { Pencil, CalendarClock,", "import { Pencil,");
recordDrawer = recordDrawer.replace("import { Pencil,", "import { Pencil, CalendarClock,");
fs.writeFileSync('/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/anagrafica/RecordDrawer.tsx', recordDrawer, 'utf8');

let oppDrawer = fs.readFileSync('/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/opportunita/OpportunityDrawer.tsx', 'utf8');
oppDrawer = oppDrawer.replace("import { Pencil, CalendarClock,", "import { Pencil,");
oppDrawer = oppDrawer.replace("import { Pencil,", "import { Pencil, CalendarClock,");
oppDrawer = oppDrawer.replace(/onQuickFollowup/g, 'props.onQuickFollowup');
oppDrawer = oppDrawer.replace(/props\.props\.onQuickFollowup/g, 'props.onQuickFollowup');
fs.writeFileSync('/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/opportunita/OpportunityDrawer.tsx', oppDrawer, 'utf8');

let oppSection = fs.readFileSync('/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/opportunita/OpportunitySection.tsx', 'utf8');
oppSection = oppSection.replace(/onCreateQuickFollowup/g, 'props.onCreateQuickFollowup');
oppSection = oppSection.replace(/props\.props\.onCreateQuickFollowup/g, 'props.onCreateQuickFollowup');
fs.writeFileSync('/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/opportunita/OpportunitySection.tsx', oppSection, 'utf8');

