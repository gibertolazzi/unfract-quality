const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/contatti/UnifiedTable.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace("import { tableClass, thClass, tdClass } from '../shared/table';", `
const tableClass = "w-full text-left border-collapse";
const thClass = "px-4 py-3 text-[10px] font-medium uppercase tracking-wide text-[#5A5A5A] border-b border-[#1A1A1A]";
const tdClass = "px-4 py-3 text-xs text-[#858585] border-b border-[#1A1A1A]";
`);

content = content.replace('LeadStateLabel', 'LEAD_STATE_LABELS');
content = content.replace('LeadStateLabel[record.type]', 'LEAD_STATE_LABELS[record.type]');

fs.writeFileSync(path, content, 'utf8');
