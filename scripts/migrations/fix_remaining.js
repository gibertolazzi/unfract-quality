const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/app/crm/page.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/setFormOpen\(false\)/g, 'setCreateModal(null)');

const start = content.indexOf('{formOpen && (');
if (start !== -1) {
  const end = content.lastIndexOf(')}');
  // wait, the last ')}' is before '</div>\n  );'
  const divEnd = content.lastIndexOf('</div>');
  const replaceStr = content.slice(start, divEnd);
  const newModals = `{createModal === 'contact' && (
        <ContactFormModal
          open
          contact={null}
          accounts={accounts}
          defaultAccountId=""
          policyVersion={PRIVACY_POLICY_VERSION}
          saving={saving}
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
      )}\n    `;
  content = content.replace(replaceStr, newModals);
}

fs.writeFileSync(path, content, 'utf8');
