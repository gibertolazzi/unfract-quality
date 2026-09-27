const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/contatti/UnifiedContactsSection.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  'onDownloadDocument: (document: CrmDocument) => void;\n}',
  'onDownloadDocument: (document: CrmDocument) => void;\n  onDropConvert?: (id: string, type: string, targetType: string) => void;\n}'
);

const oldDrop = `const handleDrop = (id: string, type: string, targetTab: string) => {
    const targetType = targetTab.replace('tab-', '');
    if (type === targetType) return;
    
    // Trova il record originale per la conversione
    const record = allUnifiedRecords.find(r => r.id === id && r.type === type);
    if (!record) return;

    if (targetType === 'customer' || targetType === 'lead' || targetType === 'contact') {
       // Trigger conversion by setting drawer or a conversion state
       // UnfractMVP uses openConversion or similar. 
       // In UnifiedContactsSection we don't have openConversion, but we can set up a conversion
       // Actually, we can use the RecordDrawer which has "Trasforma in Cliente" or similar?
       // Or even better, we can open the Create Modal with pre-filled data!
       // But wait, the user wants to CONVERT them.
       // For now, let's open the drawer for that entity, since the drawer has the conversion buttons.
       setDrawer({ kind: type as any, record: record.raw });
    }
  };`;

const newDrop = `const handleDrop = (id: string, type: string, targetTab: string) => {
    const targetType = targetTab.replace('tab-', '');
    if (type === targetType) return;
    
    const record = allUnifiedRecords.find(r => r.id === id && r.type === type);
    if (!record) return;

    if (props.onDropConvert) {
      props.onDropConvert(id, type, targetType);
      return;
    }

    if (targetType === 'customer' || targetType === 'lead' || targetType === 'contact') {
       setDrawer({ kind: type as any, record: record.raw });
    }
  };`;

content = content.replace(oldDrop, newDrop);
fs.writeFileSync(path, content, 'utf8');
