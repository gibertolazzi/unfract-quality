const fs = require('fs');

let recordDrawer = fs.readFileSync('/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/anagrafica/RecordDrawer.tsx', 'utf8');
recordDrawer = recordDrawer.replace("import { CalendarClock, useState } from 'react';", "import { useState } from 'react';");
if (!recordDrawer.includes('CalendarClock')) {
  recordDrawer = recordDrawer.replace("import { Pencil,", "import { Pencil, CalendarClock,");
}
fs.writeFileSync('/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/anagrafica/RecordDrawer.tsx', recordDrawer, 'utf8');

let oppDrawer = fs.readFileSync('/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/opportunita/OpportunityDrawer.tsx', 'utf8');
oppDrawer = oppDrawer.replace("import { CalendarClock, useState } from 'react';", "import { useState } from 'react';");
if (!oppDrawer.includes('CalendarClock')) {
  oppDrawer = oppDrawer.replace("import { Pencil,", "import { Pencil, CalendarClock,");
}
oppDrawer = oppDrawer.replace(/props\.onQuickFollowup/g, 'onQuickFollowup');
fs.writeFileSync('/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/opportunita/OpportunityDrawer.tsx', oppDrawer, 'utf8');

let oppSection = fs.readFileSync('/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/opportunita/OpportunitySection.tsx', 'utf8');
oppSection = oppSection.replace(/onCreateQuickFollowup/g, 'props.onCreateQuickFollowup');
fs.writeFileSync('/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/opportunita/OpportunitySection.tsx', oppSection, 'utf8');

