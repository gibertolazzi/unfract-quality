'use client';

import { LayoutDashboard, Building2, Target, CalendarClock } from 'lucide-react';

export type CrmTab = 'dashboard' | 'contact' | 'opportunity' | 'followup';

const TABS: { key: CrmTab; label: string; Icon: any; ready: boolean }[] = [
  { key: 'contact',     label: 'Contatti & Aziende',    Icon: Building2,     ready: true },
  { key: 'opportunity', label: 'Opportunità & Pipeline', Icon: Target,        ready: true },
  { key: 'followup',    label: 'Follow up',             Icon: CalendarClock, ready: true },
  { key: 'dashboard',   label: 'Riepilogo',             Icon: LayoutDashboard, ready: true },
];

interface CrmNavProps {
  active: CrmTab;
  onChange: (tab: CrmTab) => void;
  counts?: Partial<Record<CrmTab, number>>;
}

export function CrmNav({ active, onChange, counts }: CrmNavProps) {
  return (
    <nav className="flex flex-wrap items-center gap-2">
      {TABS.map(({ key, label, Icon, ready }) => {
        if (!ready) return null;

        const isActive = active === key;
        const count = counts?.[key];

        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            aria-current={isActive ? 'page' : undefined}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-medium transition-colors ${
              isActive 
                ? 'bg-[#0D6EFD]/50 text-white' 
                : 'text-[#858585] hover:bg-white/5 hover:text-white'
            }`}
          >
            <Icon size={16} />
            {label}
            {count !== undefined && count > 0 && (
              <span className={`flex h-5 items-center justify-center rounded-full px-2 text-[11px] font-semibold ${
                isActive ? 'bg-white/20 text-white' : 'bg-white/10 text-[#858585]'
              }`}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
