'use client';

import { getLeadStateLabel, getOppPhaseLabel, getFollowupStateLabel, getFollowupTypeLabel, getPriorityLabel, getInteractionTypeLabel, getEmailStateLabel, getCustomerStatusLabel } from '@/components/crm/shared/labels';
import { useTranslation } from '@/contexts/TranslationContext';
import { useMemo, useState } from 'react';
import { Plus, Search, LayoutGrid, List } from 'lucide-react';
import {
  CrmOpportunity, CrmCustomer, CrmAccount, CrmLead,
} from '@/components/crm/types';
import {
  OpportunityPhase, OPPORTUNITY_PHASES, OPPORTUNITY_PHASE_COLORS,
} from '@/components/crm/constants';
import {
  OpportunityFilters, EMPTY_OPPORTUNITY_FILTERS, countOpportunityFilters,
  OpportunitySort, DEFAULT_OPPORTUNITY_SORT,
  applyOpportunityFilters, buildOpportunityView, groupByPhase, pipelineTotals,
  CloseFilter, CLOSE_FILTER_LABELS,
} from '@/lib/crm/opportunityFilters';
import { OwnerOption } from '../leads/LeadFiltersBar';
import { TimelineSources } from '@/lib/crm/timeline';
import { inputClass, formatEuro } from '../shared/TableUtils';
import { OpportunityBoard } from './OpportunityBoard';
import { OpportunityTable } from './OpportunityTable';
import { OpportunityFormModal, OpportunityFormValues } from './OpportunityFormModal';
import { OpportunityDrawer } from './OpportunityDrawer';

type ViewMode = 'board' | 'list';

interface OpportunitySectionProps {
  opportunities: CrmOpportunity[];
  customers: CrmCustomer[];
  accounts: CrmAccount[];
  leads: CrmLead[];
  owners: OwnerOption[];
  history: TimelineSources;
  saving?: boolean;
  loading?: boolean;

  onCreate: (values: OpportunityFormValues) => void;
  onUpdate: (id: string, values: OpportunityFormValues) => void;
  onChangePhase: (opportunity: CrmOpportunity, to: OpportunityPhase, options: { lostReason?: string; order?: number }) => void;
  onReorder: (orderedIds: string[]) => void;
  /** Rilascio rifiutato dalla macchina a stati: serve a spiegarlo a chi guarda. */
  onRefusedMove: (from: OpportunityPhase, to: OpportunityPhase) => void;
  onArchive: (opportunity: CrmOpportunity) => void;
  onRestore: (opportunity: CrmOpportunity) => void;
  onCreateQuickFollowup?: (oppId: string, days: number) => void;
}

/**
 * Le opportunità in due letture della stessa cosa: la lavagna per lavorare la
 * pipeline, l'elenco per cercare e confrontare. I filtri valgono per entrambe.
 */
export function OpportunitySection({
  opportunities, customers, accounts, leads, owners, history, saving, loading,
  onCreate, onUpdate, onChangePhase, onReorder, onRefusedMove, onArchive, onRestore, onCreateQuickFollowup,
}: OpportunitySectionProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<ViewMode>('board');
  const [filters, setFilters] = useState<OpportunityFilters>({ ...EMPTY_OPPORTUNITY_FILTERS });
  const [sort, setSort] = useState<OpportunitySort>({ ...DEFAULT_OPPORTUNITY_SORT });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CrmOpportunity | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Nome della controparte: un'opportunità sta su un cliente o su un lead.
  const counterpartyNameById = useMemo(() => {
    const map = new Map<string, string>();
    const accountName = new Map(accounts.map(a => [a.id, a.displayName || a.legalName]));
    customers.forEach(customer => {
      map.set(customer.id, accountName.get(customer.accountId) || t.crm.customer);
    });
    leads.forEach(lead => {
      map.set(lead.id, lead.fullName || lead.companyName || t.crm.lead);
    });
    return map;
  }, [accounts, customers, leads]);

  const counterpartyName = (opportunity: CrmOpportunity) =>
    counterpartyNameById.get(opportunity.customerId || opportunity.leadId) || '';

  const counterpartyKind = (opportunity: CrmOpportunity): 'cliente' | 'lead' | '' =>
    opportunity.customerId ? 'cliente' : opportunity.leadId ? 'lead' : '';

  const ownerName = (uid: string) => owners.find(o => o.uid === uid)?.name || '';

  const filtered = useMemo(
    () => applyOpportunityFilters(opportunities, filters, { counterpartyNameById }),
    [opportunities, filters, counterpartyNameById]
  );

  const columns = useMemo(() => groupByPhase(filtered), [filtered]);

  const listView = useMemo(
    () => buildOpportunityView(opportunities, filters, sort, page, pageSize, { counterpartyNameById }),
    [opportunities, filters, sort, page, pageSize, counterpartyNameById]
  );

  const totals = useMemo(() => pipelineTotals(filtered), [filtered]);
  const activeFilters = countOpportunityFilters(filters);

  // La scheda aperta segue gli aggiornamenti della lista.
  const selected = selectedId ? opportunities.find(o => o.id === selectedId) || null : null;

  const set = (patch: Partial<OpportunityFilters>) => {
    setFilters(prev => ({ ...prev, ...patch }));
    setPage(1);
  };

  const togglePhase = (phase: OpportunityPhase) => {
    set({
      phases: filters.phases.includes(phase)
        ? filters.phases.filter(p => p !== phase)
        : [...filters.phases, phase],
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[16rem] flex-1">
          <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5A5A]" />
          <input
            value={filters.search}
            onChange={e => set({ search: e.target.value })}
            placeholder="Cerca per titolo, controparte, voce…"
            className="w-full rounded-full border border-[#1A1A1A] bg-black/30 py-1.5 pl-8 pr-4 text-xs text-white placeholder:text-[#5A5A5A] focus:border-[#2A2A2A] focus:outline-none"
          />
        </div>

        <select
          value={filters.close}
          onChange={e => set({ close: e.target.value as CloseFilter })}
          className={inputClass}
        >
          {(Object.keys(CLOSE_FILTER_LABELS) as CloseFilter[]).map(key => (
            <option key={key} value={key}>{CLOSE_FILTER_LABELS[key]}</option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => set({ onlyManualProbability: !filters.onlyManualProbability })}
          title="Solo quelle con probabilità impostata a mano"
          className={`rounded-lg border px-3 py-2 text-xs transition-colors ${
            filters.onlyManualProbability
              ? 'border-white/30 bg-white/10 text-white'
              : 'border-[#1A1A1A] text-[#858585] hover:text-white'
          }`}
        >
          Probabilità a mano
        </button>

        <button
          type="button"
          onClick={() => set({ includeClosed: !filters.includeClosed })}
          className={`rounded-lg border px-3 py-2 text-xs transition-colors ${
            filters.includeClosed
              ? 'border-white/30 bg-white/10 text-white'
              : 'border-[#1A1A1A] text-[#858585] hover:text-white'
          }`}
        >
          Chiuse
        </button>

        <div className="flex items-center gap-1 rounded-lg border border-[#1A1A1A] p-0.5">
          <button
            type="button"
            onClick={() => setMode('board')}
            title={t.crm.board}
            className={`rounded p-1.5 transition-colors ${mode === 'board' ? 'bg-white/10 text-white' : 'text-[#5A5A5A] hover:text-white'}`}
          >
            <LayoutGrid size={13} />
          </button>
          <button
            type="button"
            onClick={() => setMode('list')}
            title={t.crm.list}
            className={`rounded p-1.5 transition-colors ${mode === 'list' ? 'bg-white/10 text-white' : 'text-[#5A5A5A] hover:text-white'}`}
          >
            <List size={13} />
          </button>
        </div>


      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {OPPORTUNITY_PHASES.map(phase => {
          const selectedPhase = filters.phases.includes(phase);
          return (
            <button
              key={phase}
              type="button"
              onClick={() => togglePhase(phase)}
              className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 transition-colors ${
                selectedPhase ? 'border-white/40 bg-white/10' : 'border-[#1A1A1A] bg-black/20 hover:border-[#2A2A2A]'
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: OPPORTUNITY_PHASE_COLORS[phase] }} />
              <span className="text-[11px] text-white">{getOppPhaseLabel(phase, t)}</span>
            </button>
          );
        })}

        <span className="ml-auto text-[11px] text-[#5A5A5A]">
          {totals.open} aperte · {formatEuro(totals.openValue)} · previsione {formatEuro(totals.forecast)}
          {activeFilters > 0 && ' (sui filtri attivi)'}
        </span>
      </div>

      {loading ? (
        <p className="text-sm text-[#858585]">Caricamento…</p>
      ) : mode === 'board' ? (
        <OpportunityBoard
          columns={columns}
          counterpartyName={counterpartyName}
          ownerName={ownerName}
          onOpen={opportunity => setSelectedId(opportunity.id)}
          onMove={(opportunity, to, index) => onChangePhase(opportunity, to, { order: index })}
          onReorder={(_phase, orderedIds) => onReorder(orderedIds)}
          onRefused={onRefusedMove}
        />
      ) : (
        <OpportunityTable
          page={listView}
          sort={sort}
          counterpartyName={counterpartyName}
          ownerName={ownerName}
          onSortChange={setSort}
          onPageChange={setPage}
          onPageSizeChange={size => { setPageSize(size); setPage(1); }}
          onOpen={opportunity => setSelectedId(opportunity.id)}
          onArchive={onArchive}
        />
      )}

      {selected && (
        <OpportunityDrawer t={t}
          opportunity={selected}
          counterpartyName={counterpartyName(selected)}
          counterpartyKind={counterpartyKind(selected)}
          history={history}
          ownerName={ownerName}
          onClose={() => setSelectedId(null)}
          onEdit={() => { setEditing(selected); setFormOpen(true); }}
          onArchive={() => onArchive(selected)}
          onRestore={() => onRestore(selected)}
          onChangePhase={(to, lostReason) => onChangePhase(selected, to, { lostReason })}
          onQuickFollowup={days => onCreateQuickFollowup && onCreateQuickFollowup(selected.id, days)}
        />
      )}

      {formOpen && (
        <OpportunityFormModal
          key={editing?.id || 'new-opportunity'}
          open
          opportunity={editing}
          customers={customers}
          accounts={accounts}
          leads={leads}
          owners={owners}
          saving={saving}
          onClose={() => { setFormOpen(false); setEditing(null); }}
          onSubmit={values => {
            if (editing) onUpdate(editing.id, values);
            else onCreate(values);
            setFormOpen(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
