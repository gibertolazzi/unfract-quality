const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/app/crm/page.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace("import { Plus, Upload } from 'lucide-react';", "import { Plus, PlusCircle, Upload } from 'lucide-react';");

const oldBtn = `<button
            type="button"
            onClick={() => { setFormOpen(true); }}
            className="flex items-center gap-2 rounded-xl bg-[#001D4A] border border-[#003B99] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#002661]"
          >
            <Plus size={14} />
            New Contact
          </button>`;

const newBtn = `<button
            type="button"
            onClick={() => { setFormOpen(true); }}
            className="h-[46px] px-5 bg-[#002451] border border-[#003B80] text-[#00A6FF] rounded-2xl font-medium flex items-center gap-2.5 transition-colors hover:bg-[#003B80]/80 text-[14px]"
          >
            <PlusCircle size={18} className="text-[#00A6FF]" />
            New Contact
          </button>`;

content = content.replace(oldBtn, newBtn);
fs.writeFileSync(path, content, 'utf8');
