const fs = require('fs');
const files = [
  { path: '/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/anagrafica/AccountTable.tsx', type: "'account'", name: "account.displayName || account.legalName" },
  { path: '/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/anagrafica/ContactTable.tsx', type: "'contact'", name: "contact.fullName" },
  { path: '/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/anagrafica/CustomerTable.tsx', type: "'customer'", name: "accountName" },
  { path: '/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/leads/LeadTable.tsx', type: "'lead'", name: "lead.fullName || lead.companyName" },
  { path: '/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/contatti/UnifiedTable.tsx', type: "item.type", name: "item.name" },
];

for (const file of files) {
  let content = fs.readFileSync(file.path, 'utf8');
  content = content.replace(/ data-drag-id=\{[^\}]+\} data-drag-type=\{DRAG_TYPE\} data-drag-name=\{DRAG_NAME\}/g, '');
  
  let idVar = '';
  if (file.path.includes('Account')) idVar = 'account.id';
  else if (file.path.includes('Contact')) idVar = 'contact.id';
  else if (file.path.includes('Customer')) idVar = 'customer.id';
  else if (file.path.includes('Lead')) idVar = 'lead.id';
  else if (file.path.includes('Unified')) idVar = 'item.id';
  
  content = content.replace(
    /(<tr[^>]*key=\{[^\}]+\})/,
    "$1 data-drag-id={" + idVar + "} data-drag-type={" + file.type + "} data-drag-name={" + file.name + "}"
  );
  
  fs.writeFileSync(file.path, content, 'utf8');
}
