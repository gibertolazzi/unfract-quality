'use client';

import { CalendarClock, Sparkles, Archive } from 'lucide-react';
import { CrmOpportunity } from '@/components/crm/types';
import { effectiveValue, effectiveProbabilityOf, weightedValueOf } from '@/lib/crm/opportunityFilters';
import { formatEuro, formatDate } from '../shared/TableUtils';

interface OpportunityCardProps {
  opportunity: CrmOpportunity;
  counterpartyName: string;
  ownerName: string;
  dragging?: boolean;
  onOpen: () => void;
}

const isOverdue = (date: string, open: boolean) =>
  !!date && open && date.slice(0, 10) < new Date().toISOString().slice(0, 10);

/** Scheda di un'opportunità sulla lavagna. */
export function OpportunityCard({
  opportunity, counterpartyName, ownerName, dragging, onOpen,
}: OpportunityCardProps) {
  const value = effectiveValue(opportunity);
  const probability = effectiveProbabilityOf(opportunity);
  const manual = opportunity.probability !== null;
  const open = opportunity.phase !== 'WON' && opportunity.phase !== 'LOST';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      className={`flex w-full flex-col gap-2 rounded-xl border bg-[#0F0F0F] px-3 py-2.5 text-left transition-colors ${
        dragging ? 'border-white/30' : 'border-[#1A1A1A] hover:border-[#2A2A2A]'
      } ${opportunity.archived ? 'opacity-50' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-white">{opportunity.title}</span>
        {opportunity.archived && <Archive size={11} className="mt-0.5 shrink-0 text-[#5A5A5A]" />}
      </div>

      {counterpartyName && (
        <span className="text-[11px] text-[#858585]">{counterpartyName}</span>
      )}

      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-[#C4C4C4]">{formatEuro(value)}</span>
        <span
          title={manual
            ? 'Probabilità impostata a mano'
            : 'Probabilità suggerita dalla fase, non impostata a mano'}
          className={`flex items-center gap-1 text-[11px] ${manual ? 'text-white' : 'text-[#5A5A5A]'}`}
        >
          {manual && <Sparkles size={9} />}
          {probability}%
        </span>
      </div>

      <div className="flex items-center justify-between gap-2 text-[10px]">
        <span className="text-[#3F3F3F]">{ownerName || 'Non assegnata'}</span>
        {opportunity.expectedCloseDate ? (
          <span className={`flex items-center gap-1 ${
            isOverdue(opportunity.expectedCloseDate, open) ? 'text-[#EF4444]' : 'text-[#5A5A5A]'
          }`}>
            <CalendarClock size={9} />
            {formatDate(opportunity.expectedCloseDate)}
          </span>
        ) : (
          <span className="text-[#3F3F3F]">Senza data</span>
        )}
      </div>

      {opportunity.items.length > 0 && (
        <span className="text-[10px] text-[#3F3F3F]">
          {opportunity.items.length} {opportunity.items.length === 1 ? 'voce' : 'voci'} · valore calcolato
        </span>
      )}

      <span className="text-[10px] text-[#3F3F3F]">
        Ponderato {formatEuro(weightedValueOf(opportunity))}
      </span>
    </div>
  );
}
