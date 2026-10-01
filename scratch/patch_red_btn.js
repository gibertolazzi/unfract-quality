const fs = require('fs');
const filePath = 'components/crm/anagrafica/RecordDrawer.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const oldClass = 'border border-[#FF0004]/20 bg-[#FF0004]/10';
const newClass = 'border border-transparent bg-[#FF0004]/10';

content = content.replace(new RegExp(oldClass.replace(/\[/g, '\\[').replace(/\]/g, '\\]'), 'g'), newClass);

fs.writeFileSync(filePath, content);
