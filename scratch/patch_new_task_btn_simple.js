const fs = require('fs');
const filePath = 'components/tasks/TaskBoard.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const targetStr = '<button onClick={() => openNewTaskModal()} className="h-[46px] px-5 bg-[#002451] border border-[#003B80] text-[#00A6FF] rounded-2xl font-medium flex items-center gap-2.5 transition-colors hover:bg-[#003B80]/80 text-[14px]">' + '\n' +
'            <PlusCircle size={18} className="text-[#00A6FF]" /> Nuova Task' + '\n' +
'          </button>';

const replacementStr = '<button onClick={() => openNewTaskModal()} className="flex items-center gap-2 px-4 py-2 bg-[#002451] border border-[#003B80] text-[#00A6FF] rounded-full font-medium transition-colors hover:bg-[#003B80]/80 text-sm">' + '\n' +
'            <PlusCircle size={16} className="text-[#00A6FF]" /> Nuova Task' + '\n' +
'          </button>';

const newContent = content.replace(targetStr, replacementStr);
fs.writeFileSync(filePath, newContent);

