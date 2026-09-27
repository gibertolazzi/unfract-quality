const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/contatti/UnifiedTable.tsx';
let content = fs.readFileSync(path, 'utf8');

const oldClass = 'className="accent-white cursor-pointer"';
const newClass = 'className="appearance-none h-4 w-4 rounded-[4px] border border-[#2A2A2A] bg-[#0B0B0B] checked:bg-[#1A1A1A] checked:border-[#3F3F3F] cursor-pointer transition-all bg-no-repeat bg-center checked:bg-[url(\'data:image/svg+xml,%3Csvg%20viewBox=%220%200%2014%2014%22%20fill=%22none%22%20xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cpath%20d=%22M3%207.5L6%2010.5L11%204%22%20stroke=%22white%22%20stroke-width=%221.5%22%20stroke-linecap=%22round%22%20stroke-linejoin=%22round%22/%3E%3C/svg%3E\')]"';

content = content.replace(new RegExp(oldClass.replace(/[.*+?^$\\{}()|[\\]\\\\]/g, '\\\\$&'), 'g'), newClass);

fs.writeFileSync(path, content, 'utf8');
