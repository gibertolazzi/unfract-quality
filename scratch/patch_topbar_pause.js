const fs = require('fs');
let content = fs.readFileSync('components/layout/TopBar.tsx', 'utf-8');

content = content.replace(/<Pause size=\{14\} className="text-\[#00D222\]" \/>/g, 
  '<Pause size={14} className="text-[#00D222]" fill="currentColor" stroke="currentColor" strokeWidth={1} strokeLinejoin="round" />');
content = content.replace(/<Pause size=\{14\} className="text-\[#FFB800\]" \/>/g, 
  '<Pause size={14} className="text-[#FFB800]" fill="currentColor" stroke="currentColor" strokeWidth={1} strokeLinejoin="round" />');

fs.writeFileSync('components/layout/TopBar.tsx', content);
