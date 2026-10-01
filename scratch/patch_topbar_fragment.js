const fs = require('fs');
let content = fs.readFileSync('components/layout/TopBar.tsx', 'utf-8');

content = content.replace(/\{\!timerRunning \&\& \!isTimerActive \? \(\n\s*<input/,
  '{!timerRunning && !isTimerActive ? (\n                  <>\n                    <input');

content = content.replace(/<span className="text-\[10px\] uppercase tracking-wider text-\[#858585\]\/70 font-semibold ml-\[-4px\]">min<\/span>\n\s*\) : \(/,
  '<span className="text-[10px] uppercase tracking-wider text-[#858585]/70 font-semibold ml-[-4px]">min</span>\n                  </>\n                ) : (');

fs.writeFileSync('components/layout/TopBar.tsx', content);
