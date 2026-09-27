const fs = require('fs');
const filePath = 'components/crm/anagrafica/AnagraficaSection.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const targetStr = `          onAddContact={accountId => {
            setEditing(null);
            setDefaultAccountId(accountId);
            setDrawer(null);
            onEntityChange('contact');
            setFormOpen(true);
          }}
        />`;

const newStr = `          onAddContact={accountId => {
            setEditing(null);
            setDefaultAccountId(accountId);
            setDrawer(null);
            onEntityChange('contact');
            setFormOpen(true);
          }}
          onAddCustomer={accountId => {
            setEditing(null);
            setDefaultAccountId(accountId);
            setDrawer(null);
            onEntityChange('customer');
            setFormOpen(true);
          }}
          onRemoveCustomer={onArchiveCustomer}
        />`;

if (content.includes(targetStr)) {
  content = content.replace(targetStr, newStr);
  fs.writeFileSync(filePath, content);
} else {
  console.log("Could not find target string in AnagraficaSection.tsx");
}
