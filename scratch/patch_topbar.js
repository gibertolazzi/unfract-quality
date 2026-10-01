const fs = require('fs');
let content = fs.readFileSync('components/layout/TopBar.tsx', 'utf-8');

// 1. Play buttons -> Add strokeWidth and round
content = content.replace(/<Play size=\{14\} className="text-white\/70" fill="currentColor" \/>/g, 
  '<Play size={14} className="text-white/70 hover:text-white transition-colors" fill="currentColor" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />');

// 2. Hide input spin buttons
content = content.replace(/className="w-12 bg-transparent text-\[15px\] font-bold tracking-wider tabular-nums text-\[#858585\] outline-none placeholder:text-\[#858585\]"/,
  'className="w-10 bg-transparent text-[15px] font-bold tracking-wider tabular-nums text-[#858585] outline-none placeholder:text-[#858585] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-center"');

// 3. Fix TopBar responsiveness
content = content.replace(/w-\[350px\]/g, 'w-auto lg:w-[350px]');

fs.writeFileSync('components/layout/TopBar.tsx', content);
