const fs = require('fs');
const filePath = 'components/documentation/DocList.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const targetStr = '<button \n          onClick={handleCreateNew}\n          disabled={isCreating}\n          className="flex items-center gap-2 bg-[#006AFF]/10 border border-[#006AFF]/20 text-[#006AFF] hover:bg-[#006AFF]/20 transition-colors px-4 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"\n        >';

const newStr = `<button 
          onClick={handleCreateNew}
          disabled={isCreating}
          className="flex items-center gap-2 px-4 py-2 bg-[#002451] border border-[#003B80] text-[#00A6FF] rounded-full font-medium transition-colors hover:bg-[#003B80]/80 text-sm disabled:opacity-50"
        >`;

content = content.replace(targetStr, newStr);
fs.writeFileSync(filePath, content);
