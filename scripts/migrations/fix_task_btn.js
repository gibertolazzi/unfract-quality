const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/components/unfract/tasks/TaskBoard.tsx';
let content = fs.readFileSync(path, 'utf8');

const oldBtn = `<button onClick={() => openNewTaskModal()} className="flex items-center gap-2 px-4 py-2 bg-[#006AFF] hover:bg-blue-600 text-white rounded-full font-medium transition-colors text-sm">
            <PlusCircle size={16} /> Nuova Task
          </button>`;

const newBtn = `<button onClick={() => openNewTaskModal()} className="h-[46px] px-5 bg-[#002451] border border-[#003B80] text-[#00A6FF] rounded-2xl font-medium flex items-center gap-2.5 transition-colors hover:bg-[#003B80]/80 text-[14px]">
            <PlusCircle size={18} className="text-[#00A6FF]" /> Nuova Task
          </button>`;

content = content.replace(oldBtn, newBtn);
fs.writeFileSync(path, content, 'utf8');
