'use client';

import { getLeadStateLabel, getOppPhaseLabel, getFollowupStateLabel, getFollowupTypeLabel, getPriorityLabel, getInteractionTypeLabel, getEmailStateLabel, getCustomerStatusLabel } from '@/components/crm/shared/labels';
import { useTranslation } from '@/contexts/TranslationContext';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  LeadState, LEAD_STATE_COLORS, LEAD_TRANSITIONS,
} from '@/components/crm/constants';

interface LeadStateBadgeProps {
  state: LeadState;
  /** Se assente il badge è di sola lettura. */
  onChange?: (next: LeadState) => void;
  disabled?: boolean;
}

/**
 * Badge di stato. Quando è modificabile mostra SOLO le transizioni ammesse
 * dalla macchina a stati: la validazione non è un controllo a posteriori, è
 * il menu stesso che non offre le mosse illegali.
 */
export function LeadStateBadge({ state, onChange, disabled }: LeadStateBadgeProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const color = LEAD_STATE_COLORS[state];
  const allowed = LEAD_TRANSITIONS[state];
  const interactive = !!onChange && !disabled && allowed.length > 0;

  const badge = (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
      style={{ backgroundColor: `${color}1F`, color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {getLeadStateLabel(state, t)}
      {interactive && <ChevronDown size={11} className="opacity-60" />}
    </span>
  );

  if (!interactive) {
    return (
      <span title={allowed.length === 0 ? 'Stato terminale: non sono previste transizioni' : undefined}>
        {badge}
      </span>
    );
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button type="button" onClick={() => setOpen(!open)} className="cursor-pointer">
        {badge}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 min-w-[180px] overflow-hidden rounded-xl border border-[#1A1A1A] bg-[#111111] py-1 shadow-xl">
          <p className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-[#5A5A5A]">
            Transizioni possibili
          </p>
          {allowed.map(next => (
            <button
              key={next}
              type="button"
              onClick={() => { onChange!(next); setOpen(false); }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-[#C4C4C4] hover:bg-white/5 hover:text-white"
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: LEAD_STATE_COLORS[next] }} />
              {getLeadStateLabel(next, t)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
