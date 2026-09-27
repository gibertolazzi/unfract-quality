const fs = require('fs');
const filePath = 'components/tasks/TaskBoard.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Ensure icons are imported
const importRegex = /import \{ Calendar, PlusCircle, Trash2 \} from 'lucide-react';/;
content = content.replace(importRegex, "import { Calendar, PlusCircle, Trash2, Layout, List, CalendarDays } from 'lucide-react';");
if (content.indexOf("Layout, List, CalendarDays") === -1 && content.indexOf("lucide-react") !== -1) {
    content = content.replace("Trash2 }", "Trash2, Layout, List, CalendarDays }");
}

const startStr = `<div className="flex items-center gap-8 mb-8 mt-2 border-b border-white/5 pb-4">`;
const endStr = `        <div className="ml-auto flex items-center gap-4">`;

const startIndex = content.indexOf(startStr);
const endIndex = content.indexOf(endStr);

if (startIndex !== -1 && endIndex !== -1) {
  const newContent = content.substring(0, startIndex) +
    `<div className="relative z-10 flex items-center justify-between mb-8 mt-2">
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
        </nav>
        
` +
    content.substring(endIndex);
  fs.writeFileSync(filePath, newContent);
  console.log("Success");
} else {
  console.log("Not found");
}
