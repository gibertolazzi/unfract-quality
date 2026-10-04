'use client';

import { LayoutDashboard, Building2, Target, CalendarClock } from 'lucide-react';
import { useTranslation } from '@/contexts/TranslationContext';

export type CrmTab = 'dashboard' | 'contact' | 'opportunity' | 'followup';

const getTabs = (t: any): { key: CrmTab, label: string, Icon: any, ready: boolean }[] => [
  { key: 'contact',     label: t.crm.navContacts,    Icon: Building2,     ready: true },
  { key: 'opportunity', label: t.crm.navOpportunities, Icon: Target,        ready: true },
  { key: 'followup',    label: t.crm.navFollowup,             Icon: CalendarClock, ready: true },
  { key: 'dashboard',   label: t.crm.navDashboard,             Icon: LayoutDashboard, ready: true },
];

interface CrmNavProps {
  active: CrmTab;
  onChange: (tab: CrmTab) => void;
  counts?: Partial<Record<CrmTab, number>>;
}

export function CrmNav({ active, onChange, counts }: CrmNavProps) {
  const { t } = useTranslation();
  const tabs = getTabs(t);

  return (
    <nav className="flex flex-wrap items-center gap-2">
      {tabs.map(({ key, label, Icon, ready }) => {
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
