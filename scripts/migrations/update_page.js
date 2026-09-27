const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/app/crm/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// Update imports
content = content.replace('archiveLead, restoreLead }', 'archiveLead, restoreLead, deleteLead }');
content = content.replace('archiveAccount, restoreAccount }', 'archiveAccount, restoreAccount, deleteAccount }');
content = content.replace('archiveContact, restoreContact }', 'archiveContact, restoreContact, deleteContact }');
content = content.replace('archiveCustomer, restoreCustomer }', 'archiveCustomer, restoreCustomer, deleteCustomer }');

// Pass down
content = content.replace(
  'onArchiveAccount={account => { archiveAccount(ctx!, account.id); toast.info(\'Azienda archiviata\'); }}',
  'onArchiveAccount={account => { archiveAccount(ctx!, account.id); toast.info(\'Azienda archiviata\'); }}\n          onDeleteAccount={account => { deleteAccount(ctx!, account.id); toast.info(\'Azienda eliminata\'); }}'
);
content = content.replace(
  'onArchiveContact={contact => { archiveContact(ctx!, contact.id); toast.info(\'Contatto archiviato\'); }}',
  'onArchiveContact={contact => { archiveContact(ctx!, contact.id); toast.info(\'Contatto archiviato\'); }}\n          onDeleteContact={contact => { deleteContact(ctx!, contact.id); toast.info(\'Contatto eliminato\'); }}'
);
content = content.replace(
  'onArchiveCustomer={customer => { archiveCustomer(ctx!, customer.id); toast.info(\'Cliente archiviato\'); }}',
  'onArchiveCustomer={customer => { archiveCustomer(ctx!, customer.id); toast.info(\'Cliente archiviato\'); }}\n          onDeleteCustomer={customer => { deleteCustomer(ctx!, customer.id); toast.info(\'Cliente eliminato\'); }}'
);
content = content.replace(
  'onArchiveLead={lead => { archiveLead(ctx!, lead.id); toast.info(\'Lead archiviato\'); }}',
  'onArchiveLead={lead => { archiveLead(ctx!, lead.id); toast.info(\'Lead archiviato\'); }}\n          onDeleteLead={lead => { deleteLead(ctx!, lead.id); toast.info(\'Lead eliminato\'); }}'
);

fs.writeFileSync(path, content, 'utf8');
