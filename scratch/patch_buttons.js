const fs = require('fs');
const filePath = 'components/organization/OrgDetail.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Members button
const membersBtnRegex = /<button onClick=\{\(\) => setInviteModalOpen\(true\)\} className="w-8 h-8 rounded-full border border-white\/20 flex items-center justify-center text-\[#858585\] hover:text-white hover:bg-white\/10 transition-colors">\n\s*<PlusCircle size=\{16\} \/>\n\s*<\/button>/;
const newMembersBtn = `<button 
            onClick={() => setInviteModalOpen(true)} 
            className="h-[40px] px-4 bg-[#002451] border border-[#003B80] text-[#00A6FF] rounded-xl font-medium flex items-center gap-2 transition-colors hover:bg-[#003B80]/80 text-[13px]"
          >
            <PlusCircle size={16} className="text-[#00A6FF]" />
            Aggiungi Membro
          </button>`;

content = content.replace(membersBtnRegex, newMembersBtn);

// Projects button
const projectsBtnRegex = /<button onClick=\{\(\) => setAssignProjectModalOpen\(true\)\} className="w-8 h-8 rounded-full border border-white\/20 flex items-center justify-center text-\[#858585\] hover:text-white hover:bg-white\/10 transition-colors">\n\s*<PlusCircle size=\{16\} \/>\n\s*<\/button>/;
const newProjectsBtn = `<button 
            onClick={() => setAssignProjectModalOpen(true)} 
            className="h-[40px] px-4 bg-[#002451] border border-[#003B80] text-[#00A6FF] rounded-xl font-medium flex items-center gap-2 transition-colors hover:bg-[#003B80]/80 text-[13px]"
          >
            <PlusCircle size={16} className="text-[#00A6FF]" />
            Aggiungi Progetto
          </button>`;

content = content.replace(projectsBtnRegex, newProjectsBtn);

fs.writeFileSync(filePath, content);
