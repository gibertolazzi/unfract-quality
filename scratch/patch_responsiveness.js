const fs = require('fs');
let content = fs.readFileSync('components/layout/TopBar.tsx', 'utf-8');

// TopBar wrapping and height
content = content.replace(/className="h-\[88px\] w-full flex items-center justify-between px-6 bg-\[#0B0B0B\]"/,
  'className="min-h-[88px] h-auto py-4 md:py-0 w-full flex flex-wrap md:flex-nowrap items-center justify-between px-4 md:px-6 bg-[#0B0B0B] gap-4"');

// Search bar flex shrink
content = content.replace(/<div className="flex-1 flex justify-start relative"/,
  '<div className="w-full md:flex-1 md:flex justify-start relative order-2 md:order-1"');

// Right portion (Island + Notifications + Settings)
content = content.replace(/<div className="flex items-center gap-6 justify-end w-auto lg:w-\[350px\]">/,
  '<div className="flex items-center gap-3 md:gap-6 justify-end w-full md:w-auto lg:w-[350px] order-1 md:order-2">');

fs.writeFileSync('components/layout/TopBar.tsx', content);
