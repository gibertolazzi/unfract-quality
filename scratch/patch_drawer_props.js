const fs = require('fs');
const filePath = 'components/crm/anagrafica/RecordDrawer.tsx';
let content = fs.readFileSync(filePath, 'utf8');

if (!content.includes('onRemoveCustomer?:')) {
  content = content.replace(
    'onAddCustomer?: (accountId: string) => void;',
    'onAddCustomer?: (accountId: string) => void;\n  onRemoveCustomer?: (customer: CrmCustomer) => void;'
  );
}

if (!content.includes('onRemoveCustomer,')) {
  content = content.replace(
    'onClose, onEdit, onArchive, onDelete, onRestore, onOpen, onAddContact, onAddCustomer, onConvertLead, onCompose, onUploadDocument, onDownloadDocument, onQuickFollowup,',
    'onClose, onEdit, onArchive, onDelete, onRestore, onOpen, onAddContact, onAddCustomer, onRemoveCustomer, onConvertLead, onCompose, onUploadDocument, onDownloadDocument, onQuickFollowup,'
  );
}

const accountTarget = `            {kind === 'account' && !customers.some(c => c.accountId === record.id && !c.archived) && onAddCustomer && (
              <button
                onClick={() => onAddCustomer(record.id)}
                className="flex items-center justify-center gap-2 rounded-xl border border-[#0D6EFD]/20 bg-[#0D6EFD]/10 px-4 py-2.5 text-xs font-medium text-[#0D6EFD] transition-colors hover:bg-[#0D6EFD]/20"
              >
                <Briefcase size={14} /> Nuovo Cliente
              </button>
            )}`;

const newTarget = `            {kind === 'account' && !customers.some(c => c.accountId === record.id && !c.archived) && onAddCustomer && (
              <button
                onClick={() => onAddCustomer(record.id)}
                className="flex items-center justify-center gap-2 rounded-xl border border-[#0D6EFD]/20 bg-[#0D6EFD]/10 px-4 py-2.5 text-xs font-medium text-[#0D6EFD] transition-colors hover:bg-[#0D6EFD]/20"
              >
                <Briefcase size={14} /> Nuovo Cliente
              </button>
            )}
            {kind === 'account' && customers.some(c => c.accountId === record.id && !c.archived) && onRemoveCustomer && (
              <button
                onClick={() => {
                  const customer = customers.find(c => c.accountId === record.id && !c.archived);
                  if (customer) onRemoveCustomer(customer);
                }}
                className="flex items-center justify-center gap-2 rounded-xl border border-[#FF0004]/20 bg-[#FF0004]/10 px-4 py-2.5 text-xs font-medium text-[#FF0004] transition-colors hover:bg-[#FF0004]/20"
              >
                <Trash2 size={14} /> Rimuovi Cliente
              </button>
            )}
            {kind === 'contact' && customers.some(c => c.contactId === record.id && !c.archived) && onRemoveCustomer && (
              <button
                onClick={() => {
                  const customer = customers.find(c => c.contactId === record.id && !c.archived);
                  if (customer) onRemoveCustomer(customer);
                }}
                className="flex items-center justify-center gap-2 rounded-xl border border-[#FF0004]/20 bg-[#FF0004]/10 px-4 py-2.5 text-xs font-medium text-[#FF0004] transition-colors hover:bg-[#FF0004]/20"
              >
                <Trash2 size={14} /> Rimuovi Cliente
              </button>
            )}
            {kind === 'contact' && !customers.some(c => c.contactId === record.id && !c.archived) && onAddCustomer && (
              <button
                onClick={() => onAddCustomer(record.id)}
                className="flex items-center justify-center gap-2 rounded-xl border border-[#0D6EFD]/20 bg-[#0D6EFD]/10 px-4 py-2.5 text-xs font-medium text-[#0D6EFD] transition-colors hover:bg-[#0D6EFD]/20"
              >
                <Briefcase size={14} /> Nuovo Cliente
              </button>
            )}`;

content = content.replace(accountTarget, newTarget);

// Fix the setTab bug as well
content = content.replace("onClick={() => setTab('documenti')}", "onClick={() => setUploading(value => !value)}");

fs.writeFileSync(filePath, content);
