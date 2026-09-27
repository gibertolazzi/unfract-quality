const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/app/crm/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add imports
content = content.replace(
  "import { AccountFormValues } from '@/components/unfract/crm/anagrafica/AccountFormModal';",
  "import { AccountFormModal, AccountFormValues } from '@/components/unfract/crm/anagrafica/AccountFormModal';"
);
content = content.replace(
  "import { CustomerFormValues } from '@/components/unfract/crm/anagrafica/CustomerFormModal';",
  "import { CustomerFormModal, CustomerFormValues } from '@/components/unfract/crm/anagrafica/CustomerFormModal';"
);
content = content.replace(
  "import { LeadFormValues } from '@/components/unfract/crm/leads/LeadFormModal';",
  "import { LeadFormModal, LeadFormValues } from '@/components/unfract/crm/leads/LeadFormModal';"
);

// 2. State
content = content.replace(
  'const [formOpen, setFormOpen] = useState(false);',
  `const [createModal, setCreateModal] = useState<'contact' | 'account' | 'lead' | 'customer' | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);`
);

// 3. Dropdown UI
const oldButton = `<button
            type="button"
            onClick={() => { setFormOpen(true); }}
            className="h-[46px] px-5 bg-[#002451] border border-[#003B80] text-[#00A6FF] rounded-2xl font-medium flex items-center gap-2.5 transition-colors hover:bg-[#003B80]/80 text-[14px]"
          >
            <PlusCircle size={18} className="text-[#00A6FF]" />
            New Contact
          </button>`;
const newButton = `<div className="relative">
            <button
              type="button"
              onClick={() => setAddMenuOpen(!addMenuOpen)}
              className="h-[46px] px-5 bg-[#002451] border border-[#003B80] text-[#00A6FF] rounded-2xl font-medium flex items-center gap-2.5 transition-colors hover:bg-[#003B80]/80 text-[14px]"
            >
              <PlusCircle size={18} className="text-[#00A6FF]" />
              Aggiungi...
            </button>
            
            {addMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setAddMenuOpen(false)}></div>
                <div className="absolute right-0 top-[54px] z-50 w-48 rounded-xl border border-[#1A1A1A] bg-[#0B0B0B] p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-200">
                  <button
                    onClick={() => { setCreateModal('account'); setAddMenuOpen(false); }}
                    className="flex w-full items-center px-3 py-2 text-sm text-[#E5E5E5] hover:bg-white/5 rounded-lg transition-colors"
                  >
                    Azienda
                  </button>
                  <button
                    onClick={() => { setCreateModal('contact'); setAddMenuOpen(false); }}
                    className="flex w-full items-center px-3 py-2 text-sm text-[#E5E5E5] hover:bg-white/5 rounded-lg transition-colors"
                  >
                    Contatto
                  </button>
                  <button
                    onClick={() => { setCreateModal('lead'); setAddMenuOpen(false); }}
                    className="flex w-full items-center px-3 py-2 text-sm text-[#E5E5E5] hover:bg-white/5 rounded-lg transition-colors"
                  >
                    Lead
                  </button>
                  <button
                    onClick={() => { setCreateModal('customer'); setAddMenuOpen(false); }}
                    className="flex w-full items-center px-3 py-2 text-sm text-[#E5E5E5] hover:bg-white/5 rounded-lg transition-colors"
                  >
                    Cliente
                  </button>
                </div>
              </>
            )}
          </div>`;
content = content.replace(oldButton, newButton);

// 4. Render modals
const oldModals = `{formOpen && (
        <ContactFormModal
          open={formOpen}
          contact={null}
          accounts={accounts}
          defaultAccountId=""
          onClose={() => setFormOpen(false)}
          onSave={handleCreateContact}
        />
      )}`;
const newModals = `{createModal === 'contact' && (
        <ContactFormModal
          open
          contact={null}
          accounts={accounts}
          defaultAccountId=""
          onClose={() => setCreateModal(null)}
          onSave={handleCreateContact}
        />
      )}
      {createModal === 'account' && (
        <AccountFormModal
          open
          account={null}
          onClose={() => setCreateModal(null)}
          onSave={handleCreateAccount}
        />
      )}
      {createModal === 'lead' && (
        <LeadFormModal
          open
          lead={null}
          owners={owners}
          defaultOwnerUid={user?.uid || ''}
          onClose={() => setCreateModal(null)}
          onSave={handleCreate}
        />
      )}
      {createModal === 'customer' && (
        <CustomerFormModal
          open
          customer={null}
          accounts={accounts}
          defaultAccountId=""
          onClose={() => setCreateModal(null)}
          onSave={handleCreateCustomer}
        />
      )}`;
content = content.replace(oldModals, newModals);

fs.writeFileSync(path, content, 'utf8');
