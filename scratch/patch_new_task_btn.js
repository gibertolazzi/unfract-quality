const fs = require('fs');
const filePath = 'components/tasks/TaskBoard.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const oldBtnRegex = /<button onClick=\{\(\) => openNewTaskModal\(\)\} className="h-\[46px\] px-5 bg-\\[#002451\\] border border-\\[#003B80\\] text-\\[#00A6FF\\] rounded-2xl font-medium flex items-center gap-2\.5 transition-colors hover:bg-\\[#003B80\\]\/80 text-\[14px\]">\n\s*<PlusCircle size=\{18\} className="text-\\[#00A6FF\\]" \/> Nuova Task\n\s*<\/button>/;

const newBtn = `<button onClick={() => openNewTaskModal()} className="px-4 py-2 bg-[#002451] border border-[#003B80] text-[#00A6FF] rounded-full font-medium flex items-center gap-2 transition-colors hover:bg-[#003B80]/80 text-sm">
            <PlusCircle size={16} className="text-[#00A6FF]" /> Nuova Task
          </button>`;

content = content.replace(oldBtnRegex, newBtn);

fs.writeFileSync(filePath, content);
