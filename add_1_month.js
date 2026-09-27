const fs = require('fs');

const button30 = `<button type="button" onClick={() => props.onQuickFollowup(30)} className="px-3 py-1 rounded bg-[#1A1A1A] hover:bg-[#2A2A2A] text-[11px] text-white transition-colors">Tra 1 mese</button>`;

// 1. RecordDrawer
let recordDrawer = fs.readFileSync('/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/anagrafica/RecordDrawer.tsx', 'utf8');
recordDrawer = recordDrawer.replace(
  '<button type="button" onClick={() => props.onQuickFollowup(7)} className="px-3 py-1 rounded bg-[#1A1A1A] hover:bg-[#2A2A2A] text-[11px] text-white transition-colors">Tra 1 settimana</button>',
  `<button type="button" onClick={() => props.onQuickFollowup(7)} className="px-3 py-1 rounded bg-[#1A1A1A] hover:bg-[#2A2A2A] text-[11px] text-white transition-colors">Tra 1 sett.</button>\n              ${button30}`
);
fs.writeFileSync('/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/anagrafica/RecordDrawer.tsx', recordDrawer, 'utf8');

// 2. OpportunityDrawer
let oppDrawer = fs.readFileSync('/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/opportunita/OpportunityDrawer.tsx', 'utf8');
oppDrawer = oppDrawer.replace(
  '<button type="button" onClick={() => props.onQuickFollowup(7)} className="px-3 py-1 rounded bg-[#1A1A1A] hover:bg-[#2A2A2A] text-[11px] text-white transition-colors">Tra 1 settimana</button>',
  `<button type="button" onClick={() => props.onQuickFollowup(7)} className="px-3 py-1 rounded bg-[#1A1A1A] hover:bg-[#2A2A2A] text-[11px] text-white transition-colors">Tra 1 sett.</button>\n              ${button30}`
);
fs.writeFileSync('/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/opportunita/OpportunityDrawer.tsx', oppDrawer, 'utf8');

// 3. page.tsx to handle the toast logic dynamically (Tra 30 giorni -> Tra 1 mese)
let pageTsx = fs.readFileSync('/Users/giacomobertolazzi/unfractmvp/app/crm/page.tsx', 'utf8');
pageTsx = pageTsx.replace(
  "toast.success(`Follow-up impostato per tra ${days} ${days === 1 ? 'giorno' : 'giorni'}`);",
  "const timeLabel = days === 30 ? '1 mese' : `tra ${days} ${days === 1 ? 'giorno' : 'giorni'}`;\n    toast.success(`Follow-up impostato per ${timeLabel}`);"
);
fs.writeFileSync('/Users/giacomobertolazzi/unfractmvp/app/crm/page.tsx', pageTsx, 'utf8');

