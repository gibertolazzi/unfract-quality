const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/contatti/UnifiedContactsSection.tsx';
let content = fs.readFileSync(path, 'utf8');

const regex = /function DeleteConfirmModal[\s\S]*?^}/m;
const newModal = `function DeleteConfirmModal({ 
  open, 
  targets, 
  onClose, 
  onConfirm 
}: { 
  open: boolean; 
  targets: UnifiedRecord[]; 
  onClose: () => void; 
  onConfirm: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="relative flex w-full max-w-[340px] flex-col overflow-hidden rounded-[24px] border border-[#1A1A1A] bg-[#111111] animate-in fade-in zoom-in-95 duration-200">
        {/* Motion gradient blob */}
        <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 w-48 h-32 bg-red-600/30 blur-[40px] rounded-full pointer-events-none" />
        
        <div className="flex flex-col items-center gap-4 p-8 pb-6 relative z-10 text-center">
          <div className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[#521414]">
            <Trash2 size={22} className="text-[#EF4444]" />
          </div>
          <h2 className="text-[17px] font-medium text-white">Confirm Deletion</h2>
          <p className="text-[13px] text-[#A3A3A3] leading-relaxed">
            Please confirm that you wish to remove <strong className="text-white font-medium">{targets.length === 1 ? targets[0].name : targets.length + ' contacts'}</strong>. Once deleted, this data cannot be recovered
          </p>
        </div>
        
        <footer className="flex items-center justify-between border-t border-[#1A1A1A] p-4 relative z-10 bg-transparent">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl px-4 py-3 text-[13px] font-medium text-[#858585] hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-[#521414] border border-[#EF4444] px-4 py-3 text-[13px] font-medium text-[#EF4444] hover:bg-[#6A1A1A] transition-colors"
          >
            Delete
          </button>
        </footer>
      </div>
    </div>
  );
}`;

content = content.replace(regex, newModal);
fs.writeFileSync(path, content, 'utf8');
