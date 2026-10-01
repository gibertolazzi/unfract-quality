const fs = require('fs');
const filePath = 'components/crm/dashboard/RiepilogoSection.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const importStr = "import { Folder, Folders, CheckCircle2, DollarSign } from 'lucide-react';\nimport { CrmAccount, CrmContact, CrmDocument, CrmLead, CrmOpportunity } from '@/components/crm/types';";
const newImportStr = "import { Folder, Folders, CheckCircle2, DollarSign } from 'lucide-react';\nimport { CrmAccount, CrmContact, CrmDocument, CrmLead, CrmOpportunity } from '@/components/crm/types';\nimport FolderInteraction from '@/components/ui/folder-interaction';";
content = content.replace(importStr, newImportStr);

const targetBlock = `                <button
                  key={account.id}
                  onClick={() => onFolderClick(account.id)}
                  className="relative flex w-[200px] shrink-0 flex-col gap-2 rounded-xl border border-[#1A1A1A] bg-[#0B0B0B] p-4 text-left transition-colors hover:border-[#0D6EFD] group"
                >
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#0D6EFD] rounded-t-xl" />
                  <div className="flex items-start justify-between">
                    <Folder size={24} className="text-[#858585] group-hover:text-[#0D6EFD] transition-colors" />
                  </div>
                  <div className="mt-2 flex flex-col gap-1">
                    <span className="text-sm font-medium text-white truncate" title={account.displayName || account.legalName}>
                      {account.displayName || account.legalName || 'Azienda senza nome'}
                    </span>
                    <span className="text-[11px] text-[#5A5A5A]">
                      {docCount} {docCount === 1 ? 'document' : 'documents'}
                    </span>
                  </div>
                </button>`;

const newBlock = `                <div key={account.id} className="shrink-0 scale-75 origin-top-left -mr-16">
                  <FolderInteraction 
                    folderName={account.displayName || account.legalName || 'Senza nome'}
                    documentCount={docCount}
                    onClick={() => onFolderClick(account.id)}
                  />
                </div>`;

content = content.replace(targetBlock, newBlock);

fs.writeFileSync(filePath, content);
