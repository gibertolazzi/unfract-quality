const fs = require('fs');
const filePath = 'app/(authenticated)/marketing/page.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const targetRegex = /className="h-\[46px\] px-5 bg-\[#002451\] border border-\[#003B80\] text-\[#00A6FF\] rounded-2xl font-medium flex items-center gap-2\.5 transition-colors hover:bg-\[#003B80\]\/80 text-\[14px\] disabled:opacity-50"\n\s*>\n\s*<PlusCircle size=\{18\}/;

const newStr = `className="flex items-center gap-2 px-4 py-2 bg-[#002451] border border-[#003B80] text-[#00A6FF] rounded-full font-medium transition-colors hover:bg-[#003B80]/80 text-sm disabled:opacity-50"
        >
          <PlusCircle size={16}`;

content = content.replace(targetRegex, newStr);
fs.writeFileSync(filePath, content);
