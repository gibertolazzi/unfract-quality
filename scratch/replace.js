const fs = require('fs');
const filePath = 'components/organization/OrgDetail.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const startStr = "{org.members?.map((member, i) => (";
const endStr = "))}";

const startIndex = content.indexOf(startStr);
const endIndex = content.indexOf(endStr, startIndex) + endStr.length;

if (startIndex !== -1 && endIndex !== -1) {
  const newContent = content.substring(0, startIndex) +
    `{org.members?.map((member, i) => (
            <MemberChip 
              key={i} 
              member={member} 
              orgId={org.id} 
              onClick={() => setIamMember(member)} 
            />
          ))}` +
    content.substring(endIndex);
  fs.writeFileSync(filePath, newContent);
} else {
  console.log("Not found");
}
