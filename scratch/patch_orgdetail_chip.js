const fs = require('fs');
const filePath = 'components/organization/OrgDetail.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Add import
const importRegex = /import \{ MemberProfileModal \} from '\.\/MemberProfileModal';/;
content = content.replace(importRegex, "import { MemberProfileModal } from './MemberProfileModal';\nimport { MemberChip } from './MemberChip';");

// Replace member map loop
const memberLoopRegex = /\{org\.members\?\.map\(\(member, i\) => \(\n\s*<div\s*key=\{i\}\s*onClick=\{\(\) => setIamMember\(member\)\}\s*className="flex items-center justify-between min-w-\[180px\] h-\[64px\] bg-\[#0E0E0E\] rounded-\[24px\] border border-white\/10 px-4 hover:border-white\/20 transition-all cursor-pointer"\s*>\n\s*<div className="flex items-center gap-3">\n\s*<div className="w-\[34px\] h-\[34px\] rounded-full bg-\[#006AFF\] flex items-center justify-center text-white text-\[12px\] font-bold tracking-wider overflow-hidden">\n\s*\{member\.photoURL \? \(\n\s*<img src=\{member\.photoURL\} alt=\{member\.displayName\} className="w-full h-full object-cover" \/>\n\s*\) : \(\n\s*member\.initials \|\| member\.displayName\.charAt\(0\)\.toUpperCase\(\)\n\s*\)\}\n\s*<\/div>\n\s*<div className="flex flex-col">\n\s*<span className="text-\[14px\] text-white font-medium">\{member\.displayName\}<\/span>\n\s*<span className="text-\[11px\] text-\[#858585\] capitalize">\{member\.role\}<\/span>\n\s*<\/div>\n\s*<\/div>\n\s*<\/div>\n\s*\)\}/;

const newLoop = `{org.members?.map((member, i) => (
            <MemberChip 
              key={i} 
              member={member} 
              orgId={org.id} 
              onClick={() => setIamMember(member)} 
            />
          ))}`;

content = content.replace(memberLoopRegex, newLoop);
fs.writeFileSync(filePath, content);
