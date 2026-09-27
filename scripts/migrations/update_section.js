const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/contatti/UnifiedContactsSection.tsx';
let content = fs.readFileSync(path, 'utf8');

// Add state for selectedIds and deleteConfirm
content = content.replace(
  'const [composing, setComposing] = useState<CrmContact | null>(null);',
  'const [composing, setComposing] = useState<CrmContact | null>(null);\n  const [selectedIds, setSelectedIds] = useState<string[]>([]);\n  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean, targets: UnifiedRecord[] }>({ open: false, targets: [] });'
);

// Clear selection on view/search change
content = content.replace(
  'onChange={e => { setSearch(e.target.value); setPage(1); }}',
  'onChange={e => { setSearch(e.target.value); setPage(1); setSelectedIds([]); }}'
);
content = content.replace(
  "onClick={() => { setView(v); setPage(1); }}",
  "onClick={() => { setView(v); setPage(1); setSelectedIds([]); }}"
);

// Add mass delete button when selectedIds > 0
// It will be placed next to the search bar
content = content.replace(
  '<div className="flex flex-wrap items-center gap-2">',
  `<div className="flex flex-wrap items-center gap-2">
      {selectedIds.length > 0 && (
        <div className="flex items-center bg-[#0B0B0B] border border-[#1A1A1A] rounded-lg px-2 py-1 mr-2 animate-in fade-in zoom-in-95 duration-200">
          <span className="text-xs text-[#858585] px-2">{selectedIds.length} selezionati</span>
          <div className="w-[1px] h-4 bg-[#1A1A1A] mx-1"></div>
          <button
            onClick={() => {
              const targets = unified.filter(r => selectedIds.includes(r.id));
              setDeleteConfirm({ open: true, targets });
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#EF4444] hover:bg-white/5 rounded-md transition-colors"
          >
            <Trash2 size={13} />
            Elimina
          </button>
        </div>
      )}`
);

// Add Trash2 to lucide imports
content = content.replace(
  "import { Search, PlusCircle } from 'lucide-react';",
  "import { Search, PlusCircle, Trash2 } from 'lucide-react';"
);

// Pass selectedIds and selection handlers to UnifiedTable
content = content.replace(
  '<UnifiedTable\n        records={paginated}\n        onOpen={record => {',
  `<UnifiedTable
        records={paginated}
        selectedIds={selectedIds}
        onSelect={(id, checked) => setSelectedIds(prev => checked ? [...prev, id] : prev.filter(x => x !== id))}
        onSelectAll={(checked) => setSelectedIds(checked ? paginated.map(r => r.id) : [])}
        onOpen={record => {`
);

fs.writeFileSync(path, content, 'utf8');
