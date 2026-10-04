'use client';

import { getLeadStateLabel, getOppPhaseLabel, getFollowupStateLabel, getFollowupTypeLabel, getPriorityLabel, getInteractionTypeLabel, getEmailStateLabel, getCustomerStatusLabel } from '@/components/crm/shared/labels';
import { useTranslation } from '@/contexts/TranslationContext';
import { useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { LeadFilters, FollowupFilter, EMPTY_FILTERS, countActiveFilters } from '@/lib/crm/leadFilters';
import { LEAD_STATES, LEAD_STATE_COLORS, LeadState } from '@/components/crm/constants';

export interface OwnerOption {
  uid: string;
  name: string;
}

interface LeadFiltersBarProps {
  filters: LeadFilters;
  onChange: (filters: LeadFilters) => void;
  owners: OwnerOption[];
  sources: string[];
  resultCount: number;
  totalCount: number;
}



function Chip({ active, color, onClick, children }: {
  active: boolean; color?: string; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
        active
          ? 'border-transparent text-white'
          : 'border-[#1A1A1A] text-[#858585] hover:border-[#2A2A2A] hover:text-white'
      }`}
      style={active && color ? { backgroundColor: `${color}2E`, color } : undefined}
    >
      {children}
    </button>
  );
}

export function LeadFiltersBar({
  filters, onChange, owners, sources, resultCount, totalCount,
}: LeadFiltersBarProps) {
  const { t } = useTranslation();
  const FOLLOWUP_LABELS: Record<FollowupFilter, string> = {
    any: t.crm.all,
    scheduled: t.crm.withNextAction,
    missing: t.crm.withoutNextAction,
    overdue: t.crm.overdue,
  };
  const [expanded, setExpanded] = useState(false);
  const activeCount = countActiveFilters(filters);

  const set = (patch: Partial<LeadFilters>) => onChange({ ...filters, ...patch });

  const toggleIn = <T,>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter(v => v !== value) : [...list, value];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5A5A]" />
          <input
            value={filters.search}
            onChange={e => set({ search: e.target.value })}
            placeholder="Cerca per nome, azienda, email o telefono…"
            className="w-full rounded-xl border border-[#1A1A1A] bg-black/30 py-2 pl-9 pr-8 text-xs text-white placeholder:text-[#5A5A5A] focus:border-[#2A2A2A] focus:outline-none"
          />
          {filters.search && (
            <button
              type="button"
              onClick={() => set({ search: '' })}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[#5A5A5A] hover:text-white"
            >
              <X size={12} />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs transition-colors ${
            expanded || activeCount > 0
              ? 'border-[#2A2A2A] bg-white/5 text-white'
              : 'border-[#1A1A1A] text-[#858585] hover:text-white'
          }`}
        >
          <SlidersHorizontal size={14} />
          Filtri
          {activeCount > 0 && (
            <span className="rounded-full bg-white/10 px-1.5 text-[10px] text-white">{activeCount}</span>
          )}
        </button>

        {activeCount > 0 && (
          <button
            type="button"
            onClick={() => onChange({ ...EMPTY_FILTERS })}
            className="text-xs text-[#5A5A5A] underline-offset-2 hover:text-white hover:underline"
          >
            Azzera
          </button>
        )}

        <span className="ml-auto text-xs text-[#5A5A5A]">
          {resultCount === totalCount
            ? `${totalCount} lead`
            : `${resultCount} di ${totalCount} lead`}
        </span>
      </div>

      {expanded && (
        <div className="flex flex-col gap-4 rounded-2xl border border-[#1A1A1A] bg-black/20 p-4">
          <div className="flex flex-col gap-2">
            <p className="text-[10px] uppercase tracking-wide text-[#5A5A5A]">Stato</p>
            <div className="flex flex-wrap gap-1.5">
              {LEAD_STATES.map(state => (
                <Chip
                  key={state}
                  active={filters.states.includes(state)}
                  color={LEAD_STATE_COLORS[state]}
                  onClick={() => set({ states: toggleIn<LeadState>(filters.states, state) })}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: LEAD_STATE_COLORS[state] }} />
                  {getLeadStateLabel(state, t)}
                </Chip>
              ))}
            </div>
          </div>

          {owners.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-[10px] uppercase tracking-wide text-[#5A5A5A]">Owner</p>
              <div className="flex flex-wrap gap-1.5">
                {owners.map(owner => (
                  <Chip
                    key={owner.uid}
                    active={filters.ownerUids.includes(owner.uid)}
                    onClick={() => set({ ownerUids: toggleIn(filters.ownerUids, owner.uid) })}
                  >
                    {owner.name}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          {sources.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-[10px] uppercase tracking-wide text-[#5A5A5A]">{t.crm.source}</p>
              <div className="flex flex-wrap gap-1.5">
                {sources.map(source => (
                  <Chip
                    key={source}
                    active={filters.sources.includes(source)}
                    onClick={() => set({ sources: toggleIn(filters.sources, source) })}
                  >
                    {source}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <p className="text-[10px] uppercase tracking-wide text-[#5A5A5A]">Prossima azione</p>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(FOLLOWUP_LABELS) as FollowupFilter[]).map(key => (
                <Chip
                  key={key}
                  active={filters.followup === key}
                  onClick={() => set({ followup: key })}
                >
                  {FOLLOWUP_LABELS[key]}
                </Chip>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-2">
              <p className="text-[10px] uppercase tracking-wide text-[#5A5A5A]">Valore stimato (€)</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={filters.minValue ?? ''}
                  onChange={e => set({ minValue: e.target.value === '' ? null : Number(e.target.value) })}
                  placeholder="min"
                  className="w-24 rounded-lg border border-[#1A1A1A] bg-black/30 px-2 py-1.5 text-xs text-white placeholder:text-[#5A5A5A] focus:outline-none"
                />
                <span className="text-xs text-[#5A5A5A]">—</span>
                <input
                  type="number"
                  value={filters.maxValue ?? ''}
                  onChange={e => set({ maxValue: e.target.value === '' ? null : Number(e.target.value) })}
                  placeholder="max"
                  className="w-24 rounded-lg border border-[#1A1A1A] bg-black/30 px-2 py-1.5 text-xs text-white placeholder:text-[#5A5A5A] focus:outline-none"
                />
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-xs text-[#858585] hover:text-white">
              <input
                type="checkbox"
                checked={filters.includeArchived}
                onChange={e => set({ includeArchived: e.target.checked })}
                className="accent-white"
              />
              Mostra archiviati
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
