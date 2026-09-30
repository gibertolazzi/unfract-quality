import { MegaphoneIcon } from '@/components/icons/MegaphoneIcon';
import { Lock } from 'lucide-react';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 h-full flex flex-col items-center justify-center bg-[#080808]">
      <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-6">
        <MegaphoneIcon size={32} className="text-[#858585]" />
      </div>
      <h1 className="text-2xl font-bold text-white mb-2">Marketing</h1>
      <p className="text-[#858585] mb-8 text-center max-w-[400px]">
        La sezione Marketing è in fase di sviluppo. Sarà presto disponibile con nuove funzionalità per gestire le tue campagne.
      </p>
      <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 text-white font-medium">
        <Lock size={16} />
        <span>Presto in arrivo</span>
      </div>
    </div>
  );
}
