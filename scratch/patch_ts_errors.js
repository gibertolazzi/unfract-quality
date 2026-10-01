const fs = require('fs');
const filePath = 'components/crm/anagrafica/RecordDrawer.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Fix contactId -> contactIds.includes
content = content.replace(/c => c\.contactId === record\.id/g, 'c => c.contactIds?.includes(record.id)');

fs.writeFileSync(filePath, content);

const filePath2 = 'components/crm/contatti/UnifiedContactsSection.tsx';
let content2 = fs.readFileSync(filePath2, 'utf8');
content2 = content2.replace(/else props\.onArchiveCustomer\(liveDrawer\.record\);/g, "else if (liveDrawer.kind === 'customer') props.onArchiveCustomer(liveDrawer.record);");
content2 = content2.replace(/else props\.onRestoreCustomer\(liveDrawer\.record\);/g, "else if (liveDrawer.kind === 'customer') props.onRestoreCustomer(liveDrawer.record);");
fs.writeFileSync(filePath2, content2);

const filePath3 = 'components/crm/anagrafica/AnagraficaSection.tsx';
let content3 = fs.readFileSync(filePath3, 'utf8');
content3 = content3.replace(/else onArchiveCustomer\(liveDrawer\.record\);/g, "else if (liveDrawer.kind === 'customer') onArchiveCustomer(liveDrawer.record);");
content3 = content3.replace(/else onRestoreCustomer\(liveDrawer\.record\);/g, "else if (liveDrawer.kind === 'customer') onRestoreCustomer(liveDrawer.record);");
fs.writeFileSync(filePath3, content3);
