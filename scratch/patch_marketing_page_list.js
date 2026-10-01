const fs = require('fs');
const path = 'app/(authenticated)/marketing/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// Add imports
content = content.replace(
  "import { useState } from 'react';",
  "import { useState, useEffect } from 'react';\nimport { EmailCampaign } from '@/types/marketing';\nimport { subscribeToCampaigns, deleteCampaign } from '@/lib/services/marketingService';\nimport { Edit2, Trash2, Mail, Calendar, Loader2 } from 'lucide-react';\nimport Link from 'next/link';"
);

// Add state
const statePattern = `  const [activeTab, setActiveTab] = useState<'campaigns' | 'models' | 'stats' | 'settings'>('campaigns');
  const { activeProjectId } = useProject();`;
const newState = `  const [activeTab, setActiveTab] = useState<'campaigns' | 'models' | 'stats' | 'settings'>('campaigns');
  const { activeProjectId } = useProject();
  
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeProjectId) return;
    const unsub = subscribeToCampaigns(activeProjectId, (data) => {
      // sort by createdAt desc if possible
      data.sort((a, b) => {
        if (!a.createdAt || !b.createdAt) return 0;
        return b.createdAt.toMillis() - a.createdAt.toMillis();
      });
      setCampaigns(data);
      setLoading(false);
    });
    return () => unsub();
  }, [activeProjectId]);`;

content = content.replace(statePattern, newState);

// Update content area for 'campaigns' tab
const emptyStatePattern = `{activeTab === 'campaigns' && (
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center pb-24">
          <img 
            src="/unfractvoidbox.png" 
            alt="No campaigns" 
            className="w-72 h-auto mb-6"
          />
          <h2 className="text-[24px] font-semibold text-white mb-2">
            You haven't created any campaign!
          </h2>
          <p className="text-[#858585] text-[15px] text-center max-w-sm leading-relaxed">
            Click on "Create campaign" and start designing your first marketing campaign.
          </p>
        </div>
      )}`;

const newListPattern = `{activeTab === 'campaigns' && (
        <div className="relative z-10 flex-1 flex flex-col pb-24">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="animate-spin text-[#858585]" />
            </div>
          ) : campaigns.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center">
              <img 
                src="/unfractvoidbox.png" 
                alt="No campaigns" 
                className="w-72 h-auto mb-6"
              />
              <h2 className="text-[24px] font-semibold text-white mb-2">
                Non hai ancora creato nessuna campagna!
              </h2>
              <p className="text-[#858585] text-[15px] text-center max-w-sm leading-relaxed">
                Clicca su "Nuova campagna" e inizia a progettare la tua prima comunicazione marketing.
              </p>
            </div>
          ) : (
            <div className="bg-[#0B0B0B] border border-[#1A1A1A] rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[#1A1A1A] bg-black/30">
                    <th className="px-5 py-3 text-[10px] font-medium uppercase tracking-wide text-[#5A5A5A]">Nome campagna</th>
                    <th className="px-5 py-3 text-[10px] font-medium uppercase tracking-wide text-[#5A5A5A]">Stato</th>
                    <th className="px-5 py-3 text-[10px] font-medium uppercase tracking-wide text-[#5A5A5A]">Data creazione</th>
                    <th className="px-5 py-3 text-right">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1A1A1A]">
                  {campaigns.map(camp => (
                    <tr key={camp.id} className="group hover:bg-white/5 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#1A1A1A] text-[#858585]">
                            <Mail size={14} />
                          </div>
                          <Link href={\`/marketing/campaigns/\${camp.id}\`} className="text-sm font-medium text-white hover:text-[#00A6FF] transition-colors">
                            {camp.name}
                          </Link>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={\`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border \${
                          camp.status === 'draft' ? 'bg-[#333]/30 border-[#333]/50 text-[#C4C4C4]' :
                          camp.status === 'scheduled' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                          'bg-green-500/10 border-green-500/20 text-green-400'
                        }\`}>
                          {camp.status === 'draft' ? 'Bozza' : camp.status === 'scheduled' ? 'Programmata' : 'Inviata'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-xs text-[#858585]">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={13} className="opacity-70" />
                          {camp.createdAt ? new Date(camp.createdAt.toMillis()).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link href={\`/marketing/campaigns/\${camp.id}\`} className="p-1.5 rounded-lg text-[#858585] hover:text-white hover:bg-[#1A1A1A] transition-colors" title="Modifica">
                            <Edit2 size={16} />
                          </Link>
                          <button onClick={() => { if(confirm('Sicuro di voler eliminare questa campagna?')) deleteCampaign(camp.id); }} className="p-1.5 rounded-lg text-[#EF4444] hover:bg-red-500/10 transition-colors" title="Elimina">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}`;

content = content.replace(emptyStatePattern, newListPattern);

// Adjust button text (already adjusted, just making sure)

fs.writeFileSync(path, content);
