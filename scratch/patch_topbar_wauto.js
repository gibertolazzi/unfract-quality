const fs = require('fs');
let content = fs.readFileSync('components/layout/TopBar.tsx', 'utf-8');

content = content.replace(/w-full md:w-auto lg:w-\[350px\] order-1 md:order-2/,
  'w-auto lg:w-[350px] order-1 md:order-2');

fs.writeFileSync('components/layout/TopBar.tsx', content);
