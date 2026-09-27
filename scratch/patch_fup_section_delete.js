const fs = require('fs');
const path = 'components/crm/followup/FollowupSection.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add onDelete to props
content = content.replace(
  '  onArchive: (followup: CrmFollowup) => void;',
  '  onArchive: (followup: CrmFollowup) => void;\n  onDelete?: (ids: string[]) => void;'
);

// 2. Add state for selection
content = content.replace(
  '  const [formOpen, setFormOpen] = useState(false);',
  '  const [formOpen, setFormOpen] = useState(false);\n  const [selectedIds, setSelectedIds] = useState<string[]>([]);\n  const [deleteConfirm, setDeleteConfirm] = useState(false);'
);

// 3. Add selection bar above the table/search
// Wait, the search bar is at:
// <div className="flex flex-wrap items-center gap-2">
//   <div className="relative min-w-[16rem] flex-1">
// We should put the selection bar before the search input in that flex container.
const searchContainer = `      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[16rem] flex-1">
          <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5A5A]" />`;

const searchContainerWithSelection = `      <div className="flex flex-wrap items-center gap-2">
        {selectedIds.length > 0 && (
          <div className="flex items-center bg-[#0B0B0B] border border-[#1A1A1A] rounded-lg px-2 py-1 mr-2 animate-in fade-in zoom-in-95 duration-200">
            <span className="text-xs text-[#858585] px-2">{selectedIds.length} selezionati</span>
            <div className="w-[1px] h-4 bg-[#1A1A1A] mx-1"></div>
            <button
              onClick={() => setDeleteConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#EF4444] hover:bg-white/5 rounded-md transition-colors"
            >
              <Trash2 size={13} />
              Elimina
            </button>
          </div>
        )}
        <div className="relative min-w-[16rem] flex-1">
          <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5A5A]" />`;

content = content.replace(searchContainer, searchContainerWithSelection);

// Reset selection on search/filter changes?
// Actually we can just leave it or clear on page change.
content = content.replace(
  'onChange={e => patch({ search: e.target.value })}',
  'onChange={e => { patch({ search: e.target.value }); setSelectedIds([]); }}'
);
content = content.replace(
  'onPageChange={setPage}',
  'onPageChange={p => { setPage(p); setSelectedIds([]); }}'
);

// 4. Add the checkbox column to the table header
const theadOld = `<tr className="border-b border-[#1A1A1A] bg-black/30">
                  <SortableHeaders columns={COLUMNS} sort={sort} onSortChange={setSort} />`;
const theadNew = `<tr className="border-b border-[#1A1A1A] bg-black/30">
                  <th className="w-10 pl-4 py-3">
                    <input 
                      type="checkbox" 
                      className="rounded border-[#333] bg-black/50 checked:bg-[#006AFF] checked:border-[#006AFF] focus:ring-0 focus:ring-offset-0 h-3.5 w-3.5"
                      checked={view.items.length > 0 && selectedIds.length === view.items.length}
                      onChange={e => {
                        if (e.target.checked) setSelectedIds(view.items.map(f => f.id));
                        else setSelectedIds([]);
                      }}
                    />
                  </th>
                  <SortableHeaders columns={COLUMNS} sort={sort} onSortChange={setSort} />`;

content = content.replace(theadOld, theadNew);

// 5. Add the checkbox to the table body rows
const trBodyOld = `                      key={followup.id}
                      className={\`group border-b border-[#131313] transition-colors last:border-0 hover:bg-white/[0.03] \${
                        followup.archived ? 'opacity-50' : ''
                      }\`}
                    >
                      <td className="px-4 py-3">`;
const trBodyNew = `                      key={followup.id}
                      className={\`group border-b border-[#131313] transition-colors last:border-0 hover:bg-white/[0.03] \${
                        followup.archived ? 'opacity-50' : ''
                      }\`}
                    >
                      <td className="w-10 pl-4 py-3">
                        <input 
                          type="checkbox" 
                          className="rounded border-[#333] bg-black/50 checked:bg-[#006AFF] checked:border-[#006AFF] focus:ring-0 focus:ring-offset-0 h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity ui-checked:opacity-100"
                          style={{ opacity: selectedIds.includes(followup.id) ? 1 : undefined }}
                          checked={selectedIds.includes(followup.id)}
                          onChange={e => {
                            if (e.target.checked) setSelectedIds(prev => [...prev, followup.id]);
                            else setSelectedIds(prev => prev.filter(id => id !== followup.id));
                          }}
                        />
                      </td>
                      <td className="px-4 py-3">`;

content = content.replace(trBodyOld, trBodyNew);

// 6. Add the Modal component at the end of the file (before the last closing brace/tag)
// Actually FollowupSection exports default... wait, let's see.
const modalContent = `

function DeleteConfirmModal({ 
  open, 
  count, 
  onClose, 
  onConfirm 
}: { 
  open: boolean; 
  count: number; 
  onClose: () => void; 
  onConfirm: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="relative flex w-full max-w-[340px] flex-col overflow-hidden rounded-[24px] border border-[#1A1A1A] bg-[#111111] animate-in fade-in zoom-in-95 duration-200">
        <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 w-48 h-32 bg-red-600/30 blur-[40px] rounded-full pointer-events-none" />
        
        <div className="flex flex-col items-center gap-4 p-8 pb-6 relative z-10 text-center">
          <div className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[#521414]">
            <Trash2 size={22} className="text-[#EF4444]" />
          </div>
          <h2 className="text-[17px] font-medium text-white">Elimina Follow-up</h2>
          <p className="text-[13px] text-[#A3A3A3] leading-relaxed">
            Sei sicuro di voler eliminare definitivamente <strong className="text-white font-medium">{count === 1 ? 'questo follow-up' : count + ' follow-up'}</strong>? L'operazione non può essere annullata.
          </p>
        </div>
        
        <footer className="flex items-center justify-between border-t border-[#1A1A1A] p-4 relative z-10 bg-transparent">
          <button
            onClick={onClose}
            className="flex h-10 flex-1 items-center justify-center rounded-xl bg-transparent text-[13px] font-medium text-[#A3A3A3] hover:text-white transition-colors"
          >
            Annulla
          </button>
          <button
            onClick={onConfirm}
            className="flex h-10 flex-1 items-center justify-center rounded-xl bg-[#EF4444] text-[13px] font-medium text-white hover:bg-red-600 transition-colors"
          >
            Sì, elimina
          </button>
        </footer>
      </div>
    </div>
  );
}
`;

content += modalContent;

// Render Modal at the end of FollowupSection
const renderModal = `      <DeleteConfirmModal
        open={deleteConfirm}
        count={selectedIds.length}
        onClose={() => setDeleteConfirm(false)}
        onConfirm={() => {
          if (props.onDelete) props.onDelete(selectedIds);
          setSelectedIds([]);
          setDeleteConfirm(false);
        }}
      />
    </div>
  );
}`;

// I need to replace the last </div>\n  );\n} with renderModal
const closingTags = `    </div>
  );
}`;

content = content.replace(closingTags, renderModal);

fs.writeFileSync(path, content);
