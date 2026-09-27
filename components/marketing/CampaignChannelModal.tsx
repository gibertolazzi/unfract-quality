import { X, Mail, MessageSquare, ArrowLeft, SplitSquareHorizontal, FileText } from 'lucide-react';
import { useState } from 'react';

interface CampaignChannelModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (channel: 'email', name: string) => void;
}

export function CampaignChannelModal({ open, onClose, onConfirm }: CampaignChannelModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [selected, setSelected] = useState<'email' | 'sms' | null>(null);
  
  // Step 2 state
  const [campaignType, setCampaignType] = useState<'classic' | 'ab'>('classic');
  const [campaignName, setCampaignName] = useState('');

  if (!open) return null;

  const handleClose = () => {
    setStep(1);
    setSelected(null);
    setCampaignName('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="relative flex w-full max-w-[540px] flex-col overflow-hidden rounded-[24px] border border-[#1A1A1A] bg-[#111111] animate-in fade-in zoom-in-95 duration-200">
        <header className="flex items-center justify-between border-b border-[#1A1A1A] px-6 py-5">
          <div className="flex items-center gap-3">
            {step === 2 && (
              <button onClick={() => setStep(1)} className="text-[#858585] hover:text-white transition-colors">
                <ArrowLeft size={18} />
              </button>
            )}
            <div>
              <h2 className="text-[17px] font-medium text-white">
                {step === 1 ? 'Nuova campagna' : 'Crea una campagna email'}
              </h2>
              {step === 1 && <p className="text-xs text-[#858585] mt-0.5">Scegli il canale della tua comunicazione</p>}
            </div>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-1.5 text-[#858585] transition-colors hover:bg-white/5 hover:text-white"
          >
            <X size={18} />
          </button>
        </header>

        {step === 1 ? (
          <div className="flex flex-col p-6">
            <div className="flex flex-col gap-4">
              <button
                onClick={() => setSelected('email')}
                className={`flex items-start gap-4 rounded-2xl border p-5 text-left transition-colors ${
                  selected === 'email' 
                    ? 'border-[#006AFF] bg-[#006AFF]/10' 
                    : 'border-[#1A1A1A] bg-black/40 hover:border-[#2A2A2A]'
                }`}
              >
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
                  selected === 'email' ? 'bg-[#006AFF] text-white' : 'bg-[#1A1A1A] text-[#A3A3A3]'
                }`}>
                  <Mail size={20} />
                </div>
                <div className="flex flex-col gap-1.5 mt-0.5">
                  <span className="text-[15px] font-medium text-white">Email Marketing</span>
                  <span className="text-[13px] text-[#A3A3A3] leading-relaxed">
                    Invia newsletter, promozioni e aggiornamenti ai tuoi contatti usando template personalizzabili.
                  </span>
                </div>
              </button>

              <div className="flex items-start gap-4 rounded-2xl border border-[#1A1A1A] bg-black/40 p-5 opacity-50 relative overflow-hidden">
                <div className="absolute top-4 right-4 rounded-full bg-[#1A1A1A] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#A3A3A3]">
                  Coming soon
                </div>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#1A1A1A] text-[#A3A3A3]">
                  <MessageSquare size={20} />
                </div>
                <div className="flex flex-col gap-1.5 mt-0.5 pr-16">
                  <span className="text-[15px] font-medium text-[#C4C4C4]">Campagna SMS</span>
                  <span className="text-[13px] text-[#858585] leading-relaxed">
                    Raggiungi i tuoi clienti direttamente sul loro smartphone con messaggi brevi e diretti.
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-8">
              <button
                onClick={handleClose}
                className="flex h-11 items-center justify-center rounded-xl px-5 bg-transparent text-[14px] font-medium text-[#A3A3A3] hover:text-white transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={() => selected === 'email' && setStep(2)}
                disabled={selected !== 'email'}
                className="flex h-11 items-center justify-center rounded-xl px-6 bg-[#006AFF] text-[14px] font-medium text-white hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continua
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col p-6">
            <div className="flex gap-4 mb-6">
              <button
                onClick={() => setCampaignType('classic')}
                className={`flex-1 flex flex-col items-center justify-center gap-3 rounded-xl border p-4 transition-colors ${
                  campaignType === 'classic' ? 'border-[#006AFF] bg-[#006AFF]/10 text-white' : 'border-[#1A1A1A] bg-black/40 text-[#858585] hover:text-white hover:border-[#2A2A2A]'
                }`}
              >
                <FileText size={24} />
                <span className="text-[13px] font-medium">Classica</span>
              </button>
              <button
                onClick={() => setCampaignType('ab')}
                className={`flex-1 flex flex-col items-center justify-center gap-3 rounded-xl border p-4 transition-colors ${
                  campaignType === 'ab' ? 'border-[#006AFF] bg-[#006AFF]/10 text-white' : 'border-[#1A1A1A] bg-black/40 text-[#858585] hover:text-white hover:border-[#2A2A2A]'
                }`}
              >
                <SplitSquareHorizontal size={24} />
                <span className="text-[13px] font-medium">Test A/B</span>
              </button>
            </div>

            <p className="text-[13px] text-[#A3A3A3] leading-relaxed mb-6">
              Mantieni vivo l'interesse dei tuoi iscritti condividendo le ultime notizie, promuovendo i tuoi prodotti di maggior successo o annunciando un evento imminente.
            </p>

            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-[13px] font-medium text-white">Nome campagna</label>
                  <span className="text-[11px] text-[#5A5A5A]">{campaignName.length}/128</span>
                </div>
                <input
                  type="text"
                  maxLength={128}
                  value={campaignName}
                  onChange={e => setCampaignName(e.target.value)}
                  className="w-full bg-black border border-[#1A1A1A] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#2A2A2A]"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-medium text-white">Tag</label>
                <button className="w-full flex items-center justify-between bg-black border border-[#1A1A1A] rounded-xl px-4 py-3 text-sm text-[#858585] text-left hover:border-[#2A2A2A] transition-colors">
                  Seleziona tag
                </button>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-medium text-white">Cartella</label>
                <button className="w-full flex items-center justify-between bg-black border border-[#1A1A1A] rounded-xl px-4 py-3 text-sm text-[#858585] text-left hover:border-[#2A2A2A] transition-colors">
                  Aggiungi alla cartella
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-8">
              <button
                onClick={handleClose}
                className="flex h-11 items-center justify-center rounded-xl px-5 bg-transparent text-[14px] font-medium text-[#A3A3A3] hover:text-white transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={() => onConfirm('email', campaignName || 'Nuova Campagna')}
                disabled={!campaignName.trim()}
                className="flex h-11 items-center justify-center rounded-xl px-6 bg-[#006AFF] text-[14px] font-medium text-white hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Crea campagna
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
