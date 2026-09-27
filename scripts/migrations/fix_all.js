const fs = require('fs');

// 1. Fix RecordDrawer
let recordDrawer = fs.readFileSync('/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/anagrafica/RecordDrawer.tsx', 'utf8');
if (!recordDrawer.includes('CalendarClock')) {
  recordDrawer = recordDrawer.replace("import { Pencil,", "import { Pencil, CalendarClock,");
}
fs.writeFileSync('/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/anagrafica/RecordDrawer.tsx', recordDrawer, 'utf8');

// 2. Fix DashboardSection
let dashboard = fs.readFileSync('/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/dashboard/DashboardSection.tsx', 'utf8');
dashboard = dashboard.replace(/f\.accountId \? 'account' : /g, '');
dashboard = dashboard.replace(/\|\| f\.accountId /g, '');
fs.writeFileSync('/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/dashboard/DashboardSection.tsx', dashboard, 'utf8');

// 3. Fix OpportunityDrawer
let oppDrawer = fs.readFileSync('/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/opportunita/OpportunityDrawer.tsx', 'utf8');
if (!oppDrawer.includes('CalendarClock')) {
  oppDrawer = oppDrawer.replace("import { Pencil,", "import { Pencil, CalendarClock,");
}
fs.writeFileSync('/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/opportunita/OpportunityDrawer.tsx', oppDrawer, 'utf8');

// 4. Fix OpportunitySection
let oppSection = fs.readFileSync('/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/opportunita/OpportunitySection.tsx', 'utf8');
oppSection = oppSection.replace(
  '  onArchive, onRestore,\n}: OpportunitySectionProps) {',
  '  onArchive, onRestore, onCreateQuickFollowup,\n}: OpportunitySectionProps) {'
);
oppSection = oppSection.replace(/props\.onCreateQuickFollowup/g, 'onCreateQuickFollowup');
fs.writeFileSync('/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/opportunita/OpportunitySection.tsx', oppSection, 'utf8');

// 5. Fix page.tsx quick followup handler to not use accountId
let pageTsx = fs.readFileSync('/Users/giacomobertolazzi/unfractmvp/app/crm/page.tsx', 'utf8');
pageTsx = pageTsx.replace(
  "} else if (kind === 'account') {\n      targetKey = 'accountId';\n      const r = accounts.find(a => a.id === targetId);\n      name = r ? (r.displayName || r.legalName) : name;\n    ",
  ""
);
fs.writeFileSync('/Users/giacomobertolazzi/unfractmvp/app/crm/page.tsx', pageTsx, 'utf8');

