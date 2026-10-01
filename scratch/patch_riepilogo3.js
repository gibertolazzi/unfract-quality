const fs = require('fs');
const filePath = 'components/crm/dashboard/RiepilogoSection.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const oldClass = 'className="shrink-0 flex flex-col items-center gap-3 cursor-pointer group"';
const oldBlock = `                <div key={account.id} className="shrink-0 scale-75 origin-top-left -mr-16 flex flex-col items-center gap-3 cursor-pointer group" onClick={() => onFolderClick(account.id)}>`;

// Actually, in patch_riepilogo2 I wrote:
// <div key={account.id} className="shrink-0 flex flex-col items-center gap-3 cursor-pointer group" onClick={() => onFolderClick(account.id)}>
// Wait, I overwrote the whole div! Let's check what I actually wrote in patch_riepilogo2.js:
