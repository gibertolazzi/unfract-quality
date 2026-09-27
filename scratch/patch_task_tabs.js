const fs = require('fs');
const filePath = 'components/tasks/TaskBoard.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Ensure icons are imported
const importRegex = /import \{ Calendar, PlusCircle, Trash2 \} from 'lucide-react';/;
content = content.replace(importRegex, "import { Calendar, PlusCircle, Trash2, Layout, List, CalendarDays } from 'lucide-react';");

// Replace the nav container
const navRegex = /<div className="flex items-center gap-8 mb-8 mt-2 border-b border-white\/5 pb-4">\n\s*<button \n\s*onClick=\{\(\) => setActiveView\('board'\)\} \n\s*className=\{`flex items-center gap-2 font-semibold text-lg transition-colors pb-4 -mb-\[17px\] border-b-2 \$\{activeView === 'board' \? 'text-\\[#006AFF\\] border-\\[#006AFF\\]' : 'text-\\[#858585\\] border-transparent hover:text-white'\}`\}\n\s*>\n\s*Board\n\s*<\/button>\n\s*<button \n\s*onClick=\{\(\) => setActiveView\('tasklist'\)\} \n\s*className=\{`flex items-center gap-2 font-semibold text-lg transition-colors pb-4 -mb-\[17px\] border-b-2 \$\{activeView === 'tasklist' \? 'text-\\[#006AFF\\] border-\\[#006AFF\\]' : 'text-\\[#858585\\] border-transparent hover:text-white'\}`\}\n\s*>\n\s*Tasklist\n\s*<\/button>\n\s*<button \n\s*onClick=\{\(\) => setActiveView\('timeline'\)\} \n\s*className=\{`flex items-center gap-2 font-semibold text-lg transition-colors pb-4 -mb-\[17px\] border-b-2 \$\{activeView === 'timeline' \? 'text-\\[#006AFF\\] border-\\[#006AFF\\]' : 'text-\\[#858585\\] border-transparent hover:text-white'\}`\}\n\s*>\n\s*Timeline\n\s*<\/button>/;

const newNav = `<div className="relative z-10 flex items-center justify-between mb-8">
        <nav className="flex items-center gap-2">
          <button 
            onClick={() => setActiveView('board')} 
            className={\`flex items-center gap-2 px-4 py-2 text-[14px] rounded-xl transition-colors font-medium \${activeView === 'board' ? 'bg-[#0D6EFD]/50 text-white' : 'text-[#858585] hover:text-white hover:bg-white/5'}\`}
          >
            <Layout size={16} />
            Board
          </button>
          <button 
            onClick={() => setActiveView('tasklist')} 
            className={\`flex items-center gap-2 px-4 py-2 text-[14px] rounded-xl transition-colors font-medium \${activeView === 'tasklist' ? 'bg-[#0D6EFD]/50 text-white' : 'text-[#858585] hover:text-white hover:bg-white/5'}\`}
          >
            <List size={16} />
            Tasklist
          </button>
          <button 
            onClick={() => setActiveView('timeline')} 
            className={\`flex items-center gap-2 px-4 py-2 text-[14px] rounded-xl transition-colors font-medium \${activeView === 'timeline' ? 'bg-[#0D6EFD]/50 text-white' : 'text-[#858585] hover:text-white hover:bg-white/5'}\`}
          >
            <CalendarDays size={16} />
            Timeline
          </button>
        </nav>`;

content = content.replace(navRegex, newNav);

fs.writeFileSync(filePath, content);
