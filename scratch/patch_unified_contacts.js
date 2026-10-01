const fs = require('fs');
const filePath = 'components/crm/contatti/UnifiedContactsSection.tsx';
let content = fs.readFileSync(filePath, 'utf8');

if (!content.includes('onRemoveCustomer={props.onArchiveCustomer}')) {
  content = content.replace(
    'onAddCustomer={accountId => {',
    'onRemoveCustomer={props.onArchiveCustomer}\n          onAddCustomer={accountId => {'
  );
}

fs.writeFileSync(filePath, content);
