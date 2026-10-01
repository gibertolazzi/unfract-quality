const fs = require('fs');
const filePath = 'components/organization/OrgDetail.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const topBtnRegex = /<button \n\s*onClick=\{\(\) => setInviteModalOpen\(true\)\}\n\s*className="h-\[46px\] px-5 bg-\[#006AFF\] border border-\[#0055CC\] text-white rounded-2xl font-medium flex items-center gap-2\.5 transition-colors hover:bg-blue-600 text-\[14px\]"\n\s*>\n\s*<UserPlus size=\{16\} \/>\n\s*Add members\n\s*<\/button>/;

const newTopBtn = `<button 
            onClick={() => setInviteModalOpen(true)}
            className="h-[46px] px-5 bg-[#002451] border border-[#003B80] text-[#00A6FF] rounded-2xl font-medium flex items-center gap-2.5 transition-colors hover:bg-[#003B80]/80 text-[14px]"
          >
            <UserPlus size={18} className="text-[#00A6FF]" />
            Aggiungi Membri
          </button>`;

content = content.replace(topBtnRegex, newTopBtn);
fs.writeFileSync(filePath, content);
