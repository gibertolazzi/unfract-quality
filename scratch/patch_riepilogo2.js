const fs = require('fs');
const filePath = 'components/crm/dashboard/RiepilogoSection.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const importStrOld = "import FolderInteraction from '@/components/ui/folder-interaction';";
const importStrNew = "import { Folder as FolderInteraction } from '@/components/ui/folder-components';\nimport { FileText } from 'lucide-react';";
content = content.replace(importStrOld, importStrNew);

const targetBlock = `                <div key={account.id} className="shrink-0 scale-75 origin-top-left -mr-16">
                  <FolderInteraction 
                    folderName={account.displayName || account.legalName || 'Senza nome'}
                    documentCount={docCount}
                    onClick={() => onFolderClick(account.id)}
                  />
                </div>`;

const newBlock = `                <div key={account.id} className="shrink-0 flex flex-col items-center gap-3 cursor-pointer group" onClick={() => onFolderClick(account.id)}>
                  <FolderInteraction 
                    label={account.displayName || account.legalName || 'Senza nome'}
                    color="blue"
                    size="lg"
                  />
                  <div className="flex flex-col items-center gap-1 opacity-60 transition-opacity group-hover:opacity-100">
                    <span className="text-white/50 text-[11px] flex items-center gap-1">
                      <FileText size={12} /> {docCount} {docCount === 1 ? "documento" : "documenti"}
                    </span>
                  </div>
                </div>`;

content = content.replace(targetBlock, newBlock);

fs.writeFileSync(filePath, content);
