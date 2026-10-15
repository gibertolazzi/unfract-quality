'use client';

import React from 'react';
import { Search, X, Rows3 } from 'lucide-react';
import { useTranslation } from '@/contexts/TranslationContext';
import { formatMessage } from '@/lib/i18n/formatMessage';
import { EMPTY_FILTERS, hasActiveFilters, NO_EPIC, PRIORITIES, UNASSIGNED, type BoardFilters, type LaneMode } from '@/lib/boardFilters';

/** Filtri rapidi e corsie della bacheca (lib/boardFilters.ts). */
export function BoardFilterBar({ filters, onFilters, laneMode, onLaneMode, showLanes, assignees, epics, shown, total }: {
  filters: BoardFilters;
  onFilters: (filters: BoardFilters) => void;
  laneMode: LaneMode;
  onLaneMode: (mode: LaneMode) => void;
  /** Le corsie solo sulla bacheca. */
  showLanes: boolean;
  assignees: { uid: string; name: string }[];
  epics: { id: string; title: string }[];
  shown: number;
  total: number;
}) {
  const { t } = useTranslation();
  const active = hasActiveFilters(filters);
  const set = (patch: Partial<BoardFilters>) => onFilters({ ...filters, ...patch });
  const priorityLabels: Record<string, string> = {
    Critical: t.tasks.priorityCritical,
    High: t.tasks.priorityHigh,
    Medium: t.tasks.priorityMedium,
    Low: t.tasks.priorityLow,
  };
  const select = (on: boolean) =>
    `shrink-0 cursor-pointer rounded-full border px-3 py-1.5 text-xs outline-none transition-colors ${on ? 'border-[#006AFF]/60 bg-[#006AFF]/15 text-white' : 'border-white/10 bg-transparent text-white/70 hover:border-white/20'}`;

  return (
    <div className="flex min-w-0 items-center gap-2 overflow-x-auto pb-1">
      <label className="flex min-w-[160px] shrink-0 items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 focus-within:border-white/25 sm:min-w-[200px]">
        <Search size={14} className="shrink-0 text-[#858585]" />
        <input
          value={filters.search}
          onChange={e => set({ search: e.target.value })}
          placeholder={t.tasks.filterSearch}
          aria-label={t.tasks.filterSearch}
          className="w-full min-w-0 bg-transparent text-xs text-white outline-none placeholder:text-[#555]"
        />
      </label>

      <button type="button" onClick={() => set({ mine: !filters.mine })} aria-pressed={filters.mine} className={select(filters.mine)}>
        {t.tasks.filterMine}
      </button>

      <select value={filters.assignee} onChange={e => set({ assignee: e.target.value })} aria-label={t.tasks.filterAnyAssignee} className={select(!!filters.assignee)}>
        <option value="" className="bg-black">{t.tasks.filterAnyAssignee}</option>
        {assignees.map(a => <option key={a.uid} value={a.uid} className="bg-black">{a.name}</option>)}
        <option value={UNASSIGNED} className="bg-black">{t.tasks.filterUnassigned}</option>
      </select>

      <select value={filters.priority} onChange={e => set({ priority: e.target.value })} aria-label={t.tasks.filterAnyPriority} className={select(!!filters.priority)}>
        <option value="" className="bg-black">{t.tasks.filterAnyPriority}</option>
        {PRIORITIES.map(p => <option key={p} value={p} className="bg-black">{priorityLabels[p]}</option>)}
      </select>

      {epics.length > 0 && (
        <select value={filters.epic} onChange={e => set({ epic: e.target.value })} aria-label={t.tasks.filterAnyEpic} className={select(!!filters.epic)}>
          <option value="" className="bg-black">{t.tasks.filterAnyEpic}</option>
          {epics.map(e => <option key={e.id} value={e.id} className="bg-black">{e.title}</option>)}
          <option value={NO_EPIC} className="bg-black">{t.tasks.filterNoEpic}</option>
        </select>
      )}

      {showLanes && (
        <label className={`${select(laneMode !== 'none')} flex items-center gap-1.5`}>
          <Rows3 size={13} className="shrink-0" />
          <select value={laneMode} onChange={e => onLaneMode(e.target.value as LaneMode)} className="cursor-pointer bg-transparent outline-none">
            <option value="none" className="bg-black">{t.tasks.lanesNone}</option>
            <option value="assignee" className="bg-black">{t.tasks.lanesAssignee}</option>
            {epics.length > 0 && <option value="epic" className="bg-black">{t.tasks.lanesEpic}</option>}
            <option value="priority" className="bg-black">{t.tasks.lanesPriority}</option>
          </select>
        </label>
      )}

      {active && (
        <>
          <span className="shrink-0 text-[11px] text-[#858585]">{formatMessage(t.tasks.filterCount, { shown, total })}</span>
          <button
            type="button"
            onClick={() => onFilters(EMPTY_FILTERS)}
            className="flex shrink-0 items-center gap-1 rounded-full px-2 py-1.5 text-xs text-white/60 hover:bg-white/5 hover:text-white"
          >
            <X size={13} />{t.tasks.filterClear}
          </button>
        </>
      )}
    </div>
  );
}
