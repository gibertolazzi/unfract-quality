const fs = require('fs');
const path = 'app/(authenticated)/marketing/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add state for delete confirm
const stateOld = `const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [loading, setLoading] = useState(true);`;
const stateNew = `const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);`;
content = content.replace(stateOld, stateNew);

// 2. Change the trash button onClick
const buttonOld = `button onClick={() => { if(confirm('Sicuro di voler eliminare questa campagna?')) deleteCampaign(camp.id); }} className="p-1.5 rounded-lg text-[#EF4444] hover:bg-red-500/10 transition-colors" title="Elimina">`;
const buttonNew = `button onClick={() => setDeleteConfirm(camp.id)} className="p-1.5 rounded-lg text-[#EF4444] hover:bg-red-500/10 transition-colors" title="Elimina">`;
content = content.replace(buttonOld, buttonNew);

// 3. Add the DeleteConfirmModal inline and its rendering logic
const closingBraces = `    </div>
  );
}`;

const modalCode = `

function DeleteConfirmModal({ 
  open, 
  onClose, 
  onConfirm 
}: { 
  open: boolean; 
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
          <h2 className="text-[17px] font-medium text-white">Elimina campagna</h2>
          <p className="text-[13px] text-[#A3A3A3] leading-relaxed">
            Sei sicuro di voler eliminare definitivamente <strong className="text-white font-medium">questa campagna</strong>? L'operazione non può essere annullata.
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

const renderModal = `
      <DeleteConfirmModal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => {
          if (deleteConfirm) {
            deleteCampaign(deleteConfirm);
            setDeleteConfirm(null);
          }
        }}
      />
    </div>
  );
}`;

content = content.replace(closingBraces, renderModal + modalCode);

fs.writeFileSync(path, content);
