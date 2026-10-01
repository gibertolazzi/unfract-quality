const fs = require('fs');
const path = 'components/crm/followup/FollowupSection.tsx';
let content = fs.readFileSync(path, 'utf8');

const target = `      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[14rem] flex-1">
          <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5A5A]" />`;

const replacement = `      <div className="flex flex-wrap items-center gap-2">
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
        <div className="relative min-w-[14rem] flex-1">
          <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5A5A]" />`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync(path, content);
  console.log("Success");
} else {
  console.log("Failed to find target");
}
