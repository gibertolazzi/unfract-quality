const fs = require('fs');
const filePath = 'components/organization/OrgDetail.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const regex = /<div \n              key=\{i\} \n              className="flex items-center justify-between min-w-\[180px\] h-\[64px\] bg-\[#0E0E0E\] rounded-\[24px\] border border-white\/10 px-4 hover:border-white\/20 transition-all"/g;

const newDiv = `<div 
              key={i} 
              onClick={() => setIamMember(member)}
              className="flex items-center justify-between min-w-[180px] h-[64px] bg-[#0E0E0E] rounded-[24px] border border-white/10 px-4 hover:border-white/20 transition-all cursor-pointer"`;

content = content.replace(regex, newDiv);
fs.writeFileSync(filePath, content);
