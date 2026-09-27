const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/contatti/UnifiedContactsSection.tsx';
let content = fs.readFileSync(path, 'utf8');

if (!content.includes('EntityDragDropProvider')) {
  content = content.replace(
    "import { UnifiedTable, UnifiedRecord, UnifiedEntity } from './UnifiedTable';",
    "import { UnifiedTable, UnifiedRecord, UnifiedEntity } from './UnifiedTable';\nimport { EntityDragDropProvider } from './EntityDragDropProvider';"
  );
}

// 1. Add data-drop-zone to the tabs
const tabsTarget = `<button
            key={v}
            onClick={() => { setView(v); setPage(1); setSelectedIds([]); }}`;
const tabsReplacement = `<button
            key={v}
            data-drop-zone={\`tab-\${v}\`}
            onClick={() => { setView(v); setPage(1); setSelectedIds([]); }}`;

content = content.replace(tabsTarget, tabsReplacement);

// 2. Add handleDrop and EntityDragDropProvider
const renderTarget = `return (
    <div className="flex flex-col gap-4">`;

const handleDropFn = `
  const handleDrop = (id: string, type: string, targetTab: string) => {
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
       // Wait, UnifiedContactsSection doesn't have a direct "convert" prop, but it has:
       // We can just open the RecordDrawer so the user can click "Trasforma in..."!
       // Or even better, we can open the Create Modal with pre-filled data!
       // But wait, the user wants to CONVERT them.
       // For now, let's open the drawer for that entity, since the drawer has the conversion buttons.
       setDrawer({ kind: type as any, record: record.raw });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <EntityDragDropProvider onDrop={handleDrop} />`;

content = content.replace(renderTarget, handleDropFn);

fs.writeFileSync(path, content, 'utf8');
