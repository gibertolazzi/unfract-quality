const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/contatti/UnifiedContactsSection.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  'className={`${inputClass} w-full pl-8`}',
  'className="w-full rounded-full border border-[#1A1A1A] bg-black/30 py-1.5 pl-8 pr-4 text-xs text-white placeholder:text-[#5A5A5A] focus:border-[#2A2A2A] focus:outline-none"'
);

// We should also remove the "Nuovo" button from UnifiedContactsSection, since it's now in the header.
// Or leave it? "La parte di creazione contatti la terrei sempre in alto a destra" implies they don't want it scattered.
content = content.replace(/<button\s+type="button"\s+onClick=\{\(\) => \{ setEditing\(null\); setFormOpen\(true\); \}\}\s+className="ml-auto flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-medium text-black transition-opacity hover:opacity-90"\s*>\s*<Plus size=\{14\} \/>\s*\{NEW_LABELS\[view\] \|\| 'Nuovo'\}\s*<\/button>/g, "");

fs.writeFileSync(path, content, 'utf8');
