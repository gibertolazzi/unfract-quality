const fs = require('fs');
let content = fs.readFileSync('components/layout/AppShell.tsx', 'utf-8');

// Padding on main
content = content.replace(/className="flex-1 p-6 pt-0 overflow-hidden"/,
  'className="flex-1 p-3 md:p-6 pt-0 overflow-hidden"');

// Padding and border radius on inner div
content = content.replace(/className="w-full h-full bg-black\/20 rounded-\[31px\] border border-\[#1A1A1A\] p-8 overflow-y-auto"/,
  'className="w-full h-full bg-black/20 rounded-[20px] md:rounded-[31px] border border-[#1A1A1A] p-4 md:p-8 overflow-y-auto"');

fs.writeFileSync('components/layout/AppShell.tsx', content);
