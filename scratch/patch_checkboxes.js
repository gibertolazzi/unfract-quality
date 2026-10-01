const fs = require('fs');
const path = 'components/crm/followup/FollowupSection.tsx';
let content = fs.readFileSync(path, 'utf8');

const oldHeaderCb = `                    <input 
                      type="checkbox" 
                      className="rounded border-[#333] bg-black/50 checked:bg-[#006AFF] checked:border-[#006AFF] focus:ring-0 focus:ring-offset-0 h-3.5 w-3.5"
                      checked={view.items.length > 0 && selectedIds.length === view.items.length}`;

const newHeaderCb = `                    <input 
                      type="checkbox" 
                      className="appearance-none h-4 w-4 rounded-[4px] border border-[#2A2A2A] bg-[#0B0B0B] checked:bg-[#1A1A1A] checked:border-[#3F3F3F] cursor-pointer transition-all bg-no-repeat bg-center checked:bg-[url('data:image/svg+xml,%3Csvg%20viewBox=%220%200%2014%2014%22%20fill=%22none%22%20xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cpath%20d=%22M3%207.5L6%2010.5L11%204%22%20stroke=%22white%22%20stroke-width=%221.5%22%20stroke-linecap=%22round%22%20stroke-linejoin=%22round%22/%3E%3C/svg%3E')]"
                      checked={view.items.length > 0 && selectedIds.length === view.items.length}`;

content = content.replace(oldHeaderCb, newHeaderCb);

const oldBodyCb = `                        <input 
                          type="checkbox" 
                          className="rounded border-[#333] bg-black/50 checked:bg-[#006AFF] checked:border-[#006AFF] focus:ring-0 focus:ring-offset-0 h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity ui-checked:opacity-100"
                          style={{ opacity: selectedIds.includes(followup.id) ? 1 : undefined }}`;

const newBodyCb = `                        <input 
                          type="checkbox" 
                          className="appearance-none h-4 w-4 rounded-[4px] border border-[#2A2A2A] bg-[#0B0B0B] checked:bg-[#1A1A1A] checked:border-[#3F3F3F] cursor-pointer transition-all bg-no-repeat bg-center checked:bg-[url('data:image/svg+xml,%3Csvg%20viewBox=%220%200%2014%2014%22%20fill=%22none%22%20xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cpath%20d=%22M3%207.5L6%2010.5L11%204%22%20stroke=%22white%22%20stroke-width=%221.5%22%20stroke-linecap=%22round%22%20stroke-linejoin=%22round%22/%3E%3C/svg%3E')]"
                          /* Rimosso opacity-0 per renderlo sempre visibile come in contatti */`;

content = content.replace(oldBodyCb, newBodyCb);

// Also remove the inline style opacity that was compensating for group-hover opacity
content = content.replace(
  '                          style={{ opacity: selectedIds.includes(followup.id) ? 1 : undefined }}\n',
  ''
);

fs.writeFileSync(path, content);
