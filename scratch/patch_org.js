const fs = require('fs');
const filePath = 'app/(authenticated)/organization/page.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const targetStr = '<button \n          onClick={() => setIsCreateModalOpen(true)}\n          className="h-[46px] px-5 bg-[#002451] border border-[#003B80] text-[#00A6FF] rounded-2xl font-medium flex items-center gap-2.5 transition-colors hover:bg-[#003B80]/80 text-[14px]"\n        >\n          <PlusCircle size={18} className="text-[#00A6FF]" />\n          Aggiungi Organizzazione\n        </button>';

const newStr = `<button 
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#002451] border border-[#003B80] text-[#00A6FF] rounded-full font-medium transition-colors hover:bg-[#003B80]/80 text-sm"
        >
          <PlusCircle size={16} className="text-[#00A6FF]" />
          Aggiungi Organizzazione
        </button>`;

content = content.replace(targetStr, newStr);
fs.writeFileSync(filePath, content);
