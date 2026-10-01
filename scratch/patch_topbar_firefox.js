const fs = require('fs');
let content = fs.readFileSync('components/layout/TopBar.tsx', 'utf-8');

content = content.replace(/\[&::-webkit-inner-spin-button\]:appearance-none text-center/,
  '[&::-webkit-inner-spin-button]:appearance-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:m-0');

fs.writeFileSync('components/layout/TopBar.tsx', content);
