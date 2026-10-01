const fs = require('fs');
let content = fs.readFileSync('components/layout/TopBar.tsx', 'utf-8');

// Change popup positioning
content = content.replace(/absolute top-\[54px\] left-1\/2 -translate-x-1\/2 w-\[240px\]/,
  'absolute top-[54px] right-0 md:left-1/2 md:-translate-x-1/2 w-[240px]');

fs.writeFileSync('components/layout/TopBar.tsx', content);
