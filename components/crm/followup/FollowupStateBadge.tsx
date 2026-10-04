'use client';

import { getLeadStateLabel, getOppPhaseLabel, getFollowupStateLabel, getFollowupTypeLabel, getPriorityLabel, getInteractionTypeLabel, getEmailStateLabel, getCustomerStatusLabel } from '@/components/crm/shared/labels';
import { useTranslation } from '@/contexts/TranslationContext';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  FollowupState, FOLLOWUP_STATES, FOLLOWUP_STATE_COLORS,
  FOLLOWUP_TRANSITIONS,
} from '@/components/crm/constants';

interface FollowupStateBadgeProps {
  state: FollowupState;
  disabled?: boolean;
  onChange: (next: FollowupState) => void;
}

/**
 * Stato del follow-up. Come per i lead, il menu offre SOLO i passaggi ammessi
 * dalla macchina a stati: l'errore non si può nemmeno scegliere.
 */
export function FollowupStateBadge({ state, disabled, onChange }: FollowupStateBadgeProps) {
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

  const allowed = FOLLOWUP_TRANSITIONS[state];
  const color = FOLLOWUP_STATE_COLORS[state];
  const interactive = !disabled && allowed.length > 0;

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        disabled={!interactive}
        onClick={() => setOpen(!open)}
        title={allowed.length === 0 ? 'Stato finale: non cambia più' : undefined}
        className="flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] disabled:cursor-default"
        style={{ color, backgroundColor: `${color}1A` }}
      >
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
        {getFollowupStateLabel(state, t)}
        {interactive && <ChevronDown size={10} />}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 min-w-[150px] overflow-hidden rounded-xl border border-[#1A1A1A] bg-[#111111] py-1 shadow-xl">
          {FOLLOWUP_STATES.filter(candidate => allowed.includes(candidate)).map(candidate => (
            <button
              key={candidate}
              type="button"
              onClick={() => { onChange(candidate); setOpen(false); }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-[#C4C4C4] hover:bg-white/5 hover:text-white"
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: FOLLOWUP_STATE_COLORS[candidate] }}
              />
              {getFollowupStateLabel(candidate, t)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
