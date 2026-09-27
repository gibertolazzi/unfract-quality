const fs = require('fs');

// 1. CalendarClock in RecordDrawer
let recordDrawer = fs.readFileSync('/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/anagrafica/RecordDrawer.tsx', 'utf8');
if (!recordDrawer.includes('CalendarClock,')) {
  recordDrawer = recordDrawer.replace("import {", "import { CalendarClock,");
}
fs.writeFileSync('/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/anagrafica/RecordDrawer.tsx', recordDrawer, 'utf8');

// 2. DashboardSection onOpenRecord
let dashboard = fs.readFileSync('/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/dashboard/DashboardSection.tsx', 'utf8');
dashboard = dashboard.replace(/onOpenRecord\(/g, 'props.onOpenRecord(');
dashboard = dashboard.replace(/&& onOpenRecord/g, '&& props.onOpenRecord');
// Wait, is onOpenRecord in props? Let's check props destructuring
// Actually, I'll just change the props signature to `props: DashboardSectionProps`
dashboard = dashboard.replace(
  '  onShowOpportunities,\n  onShowCustomers,\n  onOpenRecord,\n}: DashboardSectionProps) {',
  '  onShowOpportunities,\n  onShowCustomers,\n}: DashboardSectionProps) {'
);
dashboard = dashboard.replace(
  'export function DashboardSection({',
  'export function DashboardSection(props: DashboardSectionProps) {\nconst {'
);
fs.writeFileSync('/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/dashboard/DashboardSection.tsx', dashboard, 'utf8');

// 3. OpportunityDrawer onQuickFollowup
let oppDrawer = fs.readFileSync('/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/opportunita/OpportunityDrawer.tsx', 'utf8');
oppDrawer = oppDrawer.replace(/onQuickFollowup/g, 'props.onQuickFollowup');
if (!oppDrawer.includes('CalendarClock,')) {
  oppDrawer = oppDrawer.replace("import {", "import { CalendarClock,");
}
// Fix double props
oppDrawer = oppDrawer.replace(/props\.props\.onQuickFollowup/g, 'props.onQuickFollowup');
fs.writeFileSync('/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/opportunita/OpportunityDrawer.tsx', oppDrawer, 'utf8');

// 4. OpportunitySection props
let oppSection = fs.readFileSync('/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/opportunita/OpportunitySection.tsx', 'utf8');
oppSection = oppSection.replace(/props\.onCreateQuickFollowup/g, 'onCreateQuickFollowup');
fs.writeFileSync('/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/opportunita/OpportunitySection.tsx', oppSection, 'utf8');

