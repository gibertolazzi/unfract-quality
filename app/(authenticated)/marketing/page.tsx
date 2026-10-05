'use client';

import { useProject } from '@/contexts/ProjectContext';
import { MegaphoneIcon } from '@/components/icons/MegaphoneIcon';
import { Archive, TrendingUp, PlusCircle } from 'lucide-react';
import { createCampaign } from '@/lib/services/marketingService';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { EmailCampaign } from '@/types/marketing';
import { subscribeToCampaigns, deleteCampaign } from '@/lib/services/marketingService';
import { Edit2, Trash2, Mail, Calendar, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { CampaignChannelModal } from '@/components/marketing/CampaignChannelModal';
import { MarketingSettingsView } from '@/components/marketing/MarketingSettingsView';
import { Settings } from 'lucide-react';
import { useTranslation } from '@/contexts/TranslationContext';

export default function MarketingPage() {
    const { locale } = useTranslation();
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [showChannelModal, setShowChannelModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'campaigns' | 'models' | 'stats' | 'settings'>('campaigns');
  const { activeProjectId } = useProject();
  
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

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
  }, [activeProjectId]);

  if (!activeProjectId) {
    return <p className="text-sm text-[#858585]">Seleziona un progetto per usare la sezione Marketing.</p>;
  }

  return (
    <div className="relative flex flex-col h-full w-full">
      {/* Background shaders with motion pulse (copied from AI Hub) */}
      <div className="absolute -inset-8 z-0 pointer-events-none overflow-hidden rounded-[31px] bg-[#050505]">
        <div className="absolute bottom-[-30%] left-1/2 -translate-x-1/2 w-[1200px] h-[800px] bg-white opacity-[0.06] blur-[140px] rounded-full" />
        <div className="absolute bottom-[-45%] left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-[#006AFF] opacity-[0.35] blur-[140px] rounded-full animate-[pulse_6s_ease-in-out_infinite]" />
      </div>

      {/* Top Nav Area */}
      <div className="relative z-10 flex items-center justify-between mb-8">
                <nav className="flex items-center gap-2">
          <button 
            onClick={() => setActiveTab('campaigns')}
            className={`flex items-center gap-2 px-4 py-2 text-[14px] rounded-xl transition-colors font-medium ${activeTab === 'campaigns' ? 'bg-[#0D6EFD]/50 text-white' : 'text-[#858585] hover:text-white hover:bg-white/5'}`}
          >
            <MegaphoneIcon size={16} />
            Campaigns
          </button>
          <button 
            onClick={() => setActiveTab('models')}
            className={`flex items-center gap-2 px-4 py-2 text-[14px] rounded-xl transition-colors font-medium ${activeTab === 'models' ? 'bg-[#0D6EFD]/50 text-white' : 'text-[#858585] hover:text-white hover:bg-white/5'}`}
          >
            <Archive size={16} />
            Models
          </button>
          <button 
            onClick={() => setActiveTab('stats')}
            className={`flex items-center gap-2 px-4 py-2 text-[14px] rounded-xl transition-colors font-medium ${activeTab === 'stats' ? 'bg-[#0D6EFD]/50 text-white' : 'text-[#858585] hover:text-white hover:bg-white/5'}`}
          >
            <TrendingUp size={16} />
            Stats
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-4 py-2 text-[14px] rounded-xl transition-colors font-medium ${activeTab === 'settings' ? 'bg-[#0D6EFD]/50 text-white' : 'text-[#858585] hover:text-white hover:bg-white/5'}`}
          >
            <Settings size={16} />
            Impostazioni
          </button>
        </nav>

        <button 
          onClick={() => {
            if (!activeProjectId || isCreating) return;
            setShowChannelModal(true);
          }}
          disabled={isCreating}
          className="flex items-center gap-2 px-4 py-2 bg-[#002451] border border-[#003B80] text-[#00A6FF] rounded-full font-medium transition-colors hover:bg-[#003B80]/80 text-sm disabled:opacity-50"
        >
          <PlusCircle size={16} className="text-[#00A6FF]" />
          {isCreating ? 'Creazione...' : 'New Campaign'}
        </button>
      </div>

      {/* Empty State Area */}
            {/* Content Area */}
      {activeTab === 'campaigns' && (
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
                          <Link href={`/marketing/campaigns/${camp.id}`} className="text-sm font-medium text-white hover:text-[#00A6FF] transition-colors">
                            {camp.name}
                          </Link>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border ${
                          camp.status === 'draft' ? 'bg-[#333]/30 border-[#333]/50 text-[#C4C4C4]' :
                          camp.status === 'scheduled' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                          'bg-green-500/10 border-green-500/20 text-green-400'
                        }`}>
                          {camp.status === 'draft' ? 'Bozza' : camp.status === 'scheduled' ? 'Programmata' : 'Inviata'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-xs text-[#858585]">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={13} className="opacity-70" />
                          {camp.createdAt ? new Date(camp.createdAt.toMillis()).toLocaleDateString(locale === 'it' ? 'it-IT' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link href={`/marketing/campaigns/${camp.id}`} className="p-1.5 rounded-lg text-[#858585] hover:text-white hover:bg-[#1A1A1A] transition-colors" title="Modifica">
                            <Edit2 size={16} />
                          </Link>
                          <button onClick={() => setDeleteConfirm(camp.id)} className="p-1.5 rounded-lg text-[#EF4444] hover:bg-red-500/10 transition-colors" title="Elimina">
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
      )}
      
      {activeTab === 'settings' && (
        <MarketingSettingsView projectId={activeProjectId} />
      )}
      <CampaignChannelModal 
        open={showChannelModal}
        onClose={() => setShowChannelModal(false)}
        onConfirm={async (channel, name) => {
          if (!activeProjectId) return;
          setShowChannelModal(false);
          setIsCreating(true);
          try {
            const id = await createCampaign(activeProjectId, name);
            router.push(`/marketing/campaigns/${id}`);
          } catch(e) {
            setIsCreating(false);
          }
        }}
      />

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
}

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

