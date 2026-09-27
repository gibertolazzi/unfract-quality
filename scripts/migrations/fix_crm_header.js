const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/app/crm/page.tsx';
let content = fs.readFileSync(path, 'utf8');

const newHeader = `<header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold text-white">CRM</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-xs text-white transition-colors hover:bg-white/5"
          >
            <Upload size={14} />
            Import
          </button>
          <button
            type="button"
            onClick={() => { setFormOpen(true); }}
            className="flex items-center gap-2 rounded-xl bg-[#001D4A] border border-[#003B99] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#002661]"
          >
            <Plus size={14} />
            New Contact
          </button>
        </div>
      </header>`;

content = content.replace(/<header className="flex flex-wrap items-center justify-between gap-3">[\s\S]*?<\/header>/m, newHeader);

// Add the modal at the bottom
const modalStr = `      {formOpen && (
        <ContactFormModal
          open={formOpen}
          contact={null}
          accounts={accounts}
          defaultAccountId=""
          policyVersion={PRIVACY_POLICY_VERSION}
          saving={saving}
          onClose={() => setFormOpen(false)}
          onSubmit={(values) => {
             handleCreateContact(values);
             setFormOpen(false);
          }}
        />
      )}`;

// Wait, is ContactFormModal imported in page.tsx? Yes, it is: import { ContactFormValues } from '@/components/unfract/crm/anagrafica/ContactFormModal';
// but maybe not the component itself. Let's check imports.
if (!content.includes('import { ContactFormModal')) {
    content = content.replace("import { ContactFormValues } from '@/components/unfract/crm/anagrafica/ContactFormModal';", "import { ContactFormModal, ContactFormValues } from '@/components/unfract/crm/anagrafica/ContactFormModal';");
}

if (!content.includes('<ContactFormModal\n          open={formOpen}')) {
    content = content.replace("    </div>\n  );\n}", modalStr + "\n    </div>\n  );\n}");
}

fs.writeFileSync(path, content, 'utf8');
