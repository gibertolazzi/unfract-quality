const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/anagrafica/RecordDrawer.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  'onClose, onEdit, onArchive, onDelete, onRestore, onOpen, onAddContact, onCompose, onUploadDocument, onDownloadDocument,',
  'onClose, onEdit, onArchive, onDelete, onRestore, onOpen, onAddContact, onAddCustomer, onCompose, onUploadDocument, onDownloadDocument,'
);

fs.writeFileSync(path, content, 'utf8');
