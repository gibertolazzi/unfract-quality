const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/contatti/UnifiedContactsSection.tsx';
let content = fs.readFileSync(path, 'utf8');

// Find RecordDrawer usage and add onAddCustomer
content = content.replace(
  'onAddContact={accountId => {',
  `onAddCustomer={accountId => {
            setDefaultAccountId(accountId);
            setDrawer(null);
            setView('customer');
            setFormOpen(true);
          }}
          onAddContact={accountId => {`
);

fs.writeFileSync(path, content, 'utf8');
