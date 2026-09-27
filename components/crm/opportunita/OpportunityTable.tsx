'use client';

import { Archive, Sparkles } from 'lucide-react';
import { CrmOpportunity } from '@/components/crm/types';
import { OPPORTUNITY_PHASE_LABELS, OPPORTUNITY_PHASE_COLORS } from '@/components/crm/constants';
import { Page } from '@/lib/crm/leadFilters';
import {
  OpportunitySort, OpportunitySortField,
  effectiveValue, effectiveProbabilityOf, weightedValueOf, isOpen,
} from '@/lib/crm/opportunityFilters';
import {
  ColumnDef, SortableHeaders, Pagination, EmptyState, formatDate, formatEuro, Pill,
} from '../shared/TableUtils';

interface OpportunityTableProps {
  page: Page<CrmOpportunity>;
  sort: OpportunitySort;
  counterpartyName: (opportunity: CrmOpportunity) => string;
  ownerName: (uid: string) => string;
  onSortChange: (sort: OpportunitySort) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onOpen: (opportunity: CrmOpportunity) => void;
  onArchive: (opportunity: CrmOpportunity) => void;
}

const COLUMNS: ColumnDef<OpportunitySortField>[] = [
  { field: 'title',             label: 'Opportunità' },
  { field: 'phase',             label: 'Fase' },
  { field: 'value',             label: 'Valore',    align: 'right', initial: 'desc' },
  { field: 'weighted',          label: 'Ponderato', align: 'right', initial: 'desc' },
  { field: 'expectedCloseDate', label: 'Chiusura prevista' },
  { field: 'updatedAt',         label: 'Aggiornato', initial: 'desc' },
];

export function OpportunityTable({
  page, sort, counterpartyName, ownerName,
  onSortChange, onPageChange, onPageSizeChange, onOpen, onArchive,
}: OpportunityTableProps) {
  if (page.totalItems === 0) {
    return <EmptyState title="Nessuna opportunità corrisponde ai filtri" hint="Azzera i filtri, oppure creane una nuova da un cliente o da un lead" />;
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-2xl border border-[#1A1A1A]">
        <table className="w-full min-w-[900px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[#1A1A1A] bg-black/30">
              <SortableHeaders columns={COLUMNS} sort={sort} onSortChange={onSortChange} />
              <th className="px-4 py-3 text-right text-[10px] font-medium uppercase tracking-wide text-[#5A5A5A]">
                Owner
              </th>
              <th className="w-10" />
            </tr>
          </thead>

          <tbody>
            {page.items.map(opportunity => {
              const manual = opportunity.probability !== null;
              const overdue =
                !!opportunity.expectedCloseDate &&
                isOpen(opportunity) &&
                opportunity.expectedCloseDate.slice(0, 10) < today;

              return (
                <tr
                  key={opportunity.id}
                  className={`group border-b border-[#131313] transition-colors last:border-0 hover:bg-white/[0.03] ${
                    opportunity.archived ? 'opacity-50' : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => onOpen(opportunity)} className="flex flex-col items-start text-left">
                      <span className="text-xs font-medium text-white group-hover:underline">
                        {opportunity.title}
                      </span>
                      <span className="text-[11px] text-[#5A5A5A]">
                        {counterpartyName(opportunity) || 'Controparte non risolta'}
                      </span>
                    </button>
                  </td>

                  <td className="px-4 py-3">
                    <Pill
                      color={OPPORTUNITY_PHASE_COLORS[opportunity.phase]}
                      label={OPPORTUNITY_PHASE_LABELS[opportunity.phase]}
                    />
                  </td>

                  <td className="px-4 py-3 text-right">
                    <span className="text-xs text-[#C4C4C4]">{formatEuro(effectiveValue(opportunity))}</span>
                    {opportunity.items.length > 0 && (
                      <span className="block text-[10px] text-[#3F3F3F]" title="Somma delle voci">calcolato</span>
                    )}
                  </td>

                  <td className="px-4 py-3 text-right">
                    <span className="text-xs text-[#C4C4C4]">{formatEuro(weightedValueOf(opportunity))}</span>
                    <span
                      className={`flex items-center justify-end gap-1 text-[10px] ${manual ? 'text-[#858585]' : 'text-[#3F3F3F]'}`}
                      title={manual ? 'Probabilità impostata a mano' : 'Probabilità suggerita dalla fase'}
                    >
                      {manual && <Sparkles size={8} />}
                      {effectiveProbabilityOf(opportunity)}%
                    </span>
                  </td>

                  <td className="px-4 py-3">
                    <span className={`text-xs ${overdue ? 'text-[#EF4444]' : 'text-[#858585]'}`}>
                      {opportunity.expectedCloseDate ? formatDate(opportunity.expectedCloseDate) : '—'}
                    </span>
                  </td>

                  <td className="px-4 py-3 text-xs text-[#5A5A5A]">{formatDate(opportunity.updatedAt)}</td>

                  <td className="px-4 py-3 text-right text-xs text-[#858585]">
                    {ownerName(opportunity.ownerUid) || <span className="text-[#3F3F3F]">Non assegnata</span>}
                  </td>

                  <td className="px-2 py-3">
                    {!opportunity.archived && (
                      <button
                        type="button"
                        onClick={() => onArchive(opportunity)}
                        title="Archivia"
                        className="rounded p-1 text-[#3F3F3F] opacity-0 transition-opacity hover:text-[#EF4444] group-hover:opacity-100"
                      >
                        <Archive size={13} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Pagination page={page} onPageChange={onPageChange} onPageSizeChange={onPageSizeChange} />
    </div>
  );
}
