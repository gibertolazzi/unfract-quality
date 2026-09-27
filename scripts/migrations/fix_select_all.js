const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/contatti/UnifiedContactsSection.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Separate allUnifiedRecords and paginatedUnifiedRecords
content = content.replace(
  'const unifiedRecords: UnifiedRecord[] = useMemo(() => {',
  'const allUnifiedRecords: UnifiedRecord[] = useMemo(() => {'
);
content = content.replace(
  'return all.slice((page - 1) * pageSize, page * pageSize);\n  }, [props.leads, props.accounts, props.contacts, props.customers, search, props.loading, indexes, page, pageSize]);',
  'return all;\n  }, [props.leads, props.accounts, props.contacts, props.customers, search, props.loading, indexes]);\n\n  const unifiedRecords = useMemo(() => allUnifiedRecords.slice((page - 1) * pageSize, page * pageSize), [allUnifiedRecords, page, pageSize]);'
);

// 2. Change mass delete to use allUnifiedRecords instead of unifiedRecords (if we want them to delete things not on this page too, which they do, because they select all!)
content = content.replace(
  'const targets = unifiedRecords.filter(r => selectedIds.includes(r.id));',
  'const targets = allUnifiedRecords.filter(r => selectedIds.includes(r.id));'
);

// 3. Change onSelectAll to use allUnifiedRecords so that clicking select all selects everything matching the current search/filter, not just the page.
content = content.replace(
  'onSelectAll={(checked) => setSelectedIds(checked ? unifiedRecords.map(r => r.id) : [])}',
  'onSelectAll={(checked) => setSelectedIds(checked ? allUnifiedRecords.map(r => r.id) : [])}'
);

fs.writeFileSync(path, content, 'utf8');
