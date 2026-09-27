'use client';

import { useMemo, useState } from 'react';
import { Plus, Search, Archive, CalendarClock, Trash2, Link2 } from 'lucide-react';
import {
  CrmFollowup, CrmLead, CrmCustomer, CrmAccount, CrmOpportunity,
} from '@/components/crm/types';
import {
  FollowupState, FOLLOWUP_TYPE_LABELS, PRIORITY_LABELS, PRIORITY_COLORS,
} from '@/components/crm/constants';
import {
  FollowupFilters, EMPTY_FOLLOWUP_FILTERS, FollowupView, FOLLOWUP_VIEW_LABELS,
  FollowupSort, DEFAULT_FOLLOWUP_SORT, FollowupSortField,
  buildFollowupView, countViews, effectiveDue, isOverdue,
} from '@/lib/crm/followupFilters';
import { OwnerOption } from '../leads/LeadFiltersBar';
import {
  ColumnDef, SortableHeaders, Pagination, EmptyState, formatDate, inputClass,
} from '../shared/TableUtils';
import { FollowupStateBadge } from './FollowupStateBadge';
import { FollowupFormModal, FollowupFormValues } from './FollowupFormModal';

interface FollowupSectionProps {
  followups: CrmFollowup[];
  leads: CrmLead[];
  customers: CrmCustomer[];
  accounts: CrmAccount[];
  opportunities: CrmOpportunity[];
  owners: OwnerOption[];
  currentUid: string;
  saving?: boolean;
  loading?: boolean;
  /**
   * Vista da cui partire. La usa il riepilogo, che arriva qui già sapendo cosa
   * si vuole vedere («in ritardo», «oggi»). Vale all'apertura: da lì in poi
   * comanda chi guarda.
   */
  initialView?: FollowupView;
  onCreate: (values: FollowupFormValues) => void;
  onUpdate: (id: string, values: FollowupFormValues) => void;
  onChangeState: (followup: CrmFollowup, next: FollowupState) => void;
  onArchive: (followup: CrmFollowup) => void;
  onDelete?: (ids: string[]) => void;
}

const VIEWS: FollowupView[] = ['today', 'overdue', 'week', 'unplanned', 'done', 'all', 'archived'];

const COLUMNS: ColumnDef<FollowupSortField>[] = [
  { field: 'title',    label: 'Da fare' },
  { field: 'dueDate',  label: 'Scadenza' },
  { field: 'priority', label: 'Priorità' },
  { field: 'state',    label: 'Stato' },
];

/**
 * I follow-up con le viste che si usano davvero. «Oggi» include il pregresso:
 * quello che è scaduto va fatto oggi, non nascosto in un'altra scheda.
 */
export function FollowupSection({
  followups, leads, customers, accounts, opportunities, owners, currentUid,
  saving, loading, initialView, onCreate, onUpdate, onChangeState, onArchive, onDelete,
}: FollowupSectionProps) {
  const [filters, setFilters] = useState<FollowupFilters>({
    ...EMPTY_FOLLOWUP_FILTERS,
    ...(initialView ? { view: initialView } : {}),
  });
  const [sort, setSort] = useState<FollowupSort>({ ...DEFAULT_FOLLOWUP_SORT });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [editing, setEditing] = useState<CrmFollowup | null>(null);

  const counts = useMemo(() => countViews(followups), [followups]);
  const view = useMemo(
    () => buildFollowupView(followups, filters, sort, page, pageSize),
    [followups, filters, sort, page, pageSize]
  );

  const ownerName = (uid: string) => owners.find(o => o.uid === uid)?.name || '';
  const accountName = (accountId: string) =>
    accounts.find(a => a.id === accountId)?.displayName || 'Cliente';

  /** A cosa è attaccato il follow-up, detto in una riga. */
  const linkOf = (followup: CrmFollowup): string => {
    if (followup.opportunityId) {
      const opportunity = opportunities.find(o => o.id === followup.opportunityId);
      if (opportunity) return opportunity.title;
    }
    if (followup.customerId) {
      const customer = customers.find(c => c.id === followup.customerId);
      if (customer) return accountName(customer.accountId);
    }
    if (followup.leadId) {
      const lead = leads.find(l => l.id === followup.leadId);
      if (lead) return lead.fullName || lead.companyName;
    }
    return '';
  };

  const set = (patch: Partial<FollowupFilters>) => {
    setFilters(prev => ({ ...prev, ...patch }));
    setPage(1);
  };

  const mine = filters.assigneeUids.length === 1 && filters.assigneeUids[0] === currentUid;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {selectedIds.length > 0 && (
          <div className="flex items-center bg-[#0B0B0B] border border-[#1A1A1A] rounded-lg px-2 py-1 mr-2 animate-in fade-in zoom-in-95 duration-200">
            <span className="text-xs text-[#858585] px-2">{selectedIds.length} selezionati</span>
            <div className="w-[1px] h-4 bg-[#1A1A1A] mx-1"></div>
            <button
              onClick={() => setDeleteConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#EF4444] hover:bg-white/5 rounded-md transition-colors"
            >
              <Trash2 size={13} />
              Elimina
            </button>
          </div>
        )}
        <div className="relative min-w-[14rem] flex-1">
          <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5A5A]" />
          <input
            value={filters.search}
            onChange={e => { set({ search: e.target.value }); setSelectedIds([]); }}
            placeholder="Cerca fra i follow-up…"
            className="w-full rounded-full border border-[#1A1A1A] bg-black/30 py-1.5 pl-8 pr-4 text-xs text-white placeholder:text-[#5A5A5A] focus:border-[#2A2A2A] focus:outline-none"
          />
        </div>

        <button
          type="button"
          onClick={() => set({ assigneeUids: mine ? [] : [currentUid] })}
          className={`rounded-lg border px-3 py-2 text-xs transition-colors ${
            mine ? 'border-white/30 bg-white/10 text-white' : 'border-[#1A1A1A] text-[#858585] hover:text-white'
          }`}
        >
          Solo i miei
        </button>




      </div>

      <div className="flex flex-wrap items-center gap-1">
        {VIEWS.map(candidate => {
          const active = filters.view === candidate;
          const count = counts[candidate];
          const urgent = candidate === 'overdue' && count > 0;

          return (
            <button
              key={candidate}
              type="button"
              onClick={() => set({ view: candidate })}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors ${
                active ? 'bg-white/10 font-medium text-white' : 'text-[#858585] hover:bg-white/5 hover:text-white'
              }`}
            >
              {FOLLOWUP_VIEW_LABELS[candidate]}
              <span className={urgent ? 'text-[#EF4444]' : 'text-[#3F3F3F]'}>{count}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <p className="text-sm text-[#858585]">Caricamento…</p>
      ) : view.totalItems === 0 ? (
        <EmptyState
          title={`Niente in «${FOLLOWUP_VIEW_LABELS[filters.view]}»`}
          hint={filters.view === 'today' || filters.view === 'overdue'
            ? 'Non c’è nulla in scadenza: è una buona notizia'
            : 'Cambia vista, oppure creane uno nuovo'}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="overflow-visible rounded-2xl border border-[#1A1A1A]">
            <table className="w-full min-w-[820px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#1A1A1A] bg-black/30">
                  <th className="px-4 py-3" style={{ width: '40px' }}>
                    <input 
                      type="checkbox" 
                      className="appearance-none h-4 w-4 rounded-[4px] border border-[#2A2A2A] bg-[#0B0B0B] checked:bg-[#1A1A1A] checked:border-[#3F3F3F] cursor-pointer transition-all bg-no-repeat bg-center checked:bg-[url('data:image/svg+xml,%3Csvg%20viewBox=%220%200%2014%2014%22%20fill=%22none%22%20xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cpath%20d=%22M3%207.5L6%2010.5L11%204%22%20stroke=%22white%22%20stroke-width=%221.5%22%20stroke-linecap=%22round%22%20stroke-linejoin=%22round%22/%3E%3C/svg%3E')]"
                      checked={view.items.length > 0 && selectedIds.length === view.items.length}
                      onChange={e => {
                        if (e.target.checked) setSelectedIds(view.items.map(f => f.id));
                        else setSelectedIds([]);
                      }}
                    />
                  </th>
                  <SortableHeaders columns={COLUMNS} sort={sort} onSortChange={setSort} />
                  <th className="px-4 py-3 text-right text-[10px] font-medium uppercase tracking-wide text-[#5A5A5A]">
                    Assegnato a
                  </th>
                  <th className="w-10" />
                </tr>
              </thead>

              <tbody>
                {view.items.map(followup => {
                  const due = effectiveDue(followup);
                  const late = isOverdue(followup);
                  const link = linkOf(followup);

                  return (
                    <tr
                      key={followup.id}
                      className={`group border-b border-[#131313] transition-colors last:border-0 hover:bg-white/[0.03] ${
                        followup.archived ? 'opacity-50' : ''
                      }`}
                    >
                      <td className="px-4 py-3" style={{ width: '40px' }}>
                        <input 
                          type="checkbox" 
                          className="appearance-none h-4 w-4 rounded-[4px] border border-[#2A2A2A] bg-[#0B0B0B] checked:bg-[#1A1A1A] checked:border-[#3F3F3F] cursor-pointer transition-all bg-no-repeat bg-center checked:bg-[url('data:image/svg+xml,%3Csvg%20viewBox=%220%200%2014%2014%22%20fill=%22none%22%20xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cpath%20d=%22M3%207.5L6%2010.5L11%204%22%20stroke=%22white%22%20stroke-width=%221.5%22%20stroke-linecap=%22round%22%20stroke-linejoin=%22round%22/%3E%3C/svg%3E')]"
                          /* Rimosso opacity-0 per renderlo sempre visibile come in contatti */
                          checked={selectedIds.includes(followup.id)}
                          onChange={e => {
                            if (e.target.checked) setSelectedIds(prev => [...prev, followup.id]);
                            else setSelectedIds(prev => prev.filter(id => id !== followup.id));
                          }}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => { setEditing(followup); setFormOpen(true); }}
                          className="flex flex-col items-start text-left"
                        >
                          <span className="text-xs font-medium text-white group-hover:underline">
                            {followup.title}
                          </span>
                          <span className="flex items-center gap-2 text-[11px] text-[#5A5A5A]">
                            {FOLLOWUP_TYPE_LABELS[followup.type]}
                            {link && (
                              <span className="flex items-center gap-1">
                                <Link2 size={9} /> {link}
                              </span>
                            )}
                          </span>
                        </button>
                      </td>

                      <td className="px-4 py-3">
                        <span className={`flex items-center gap-1.5 text-xs ${late ? 'text-[#EF4444]' : 'text-[#858585]'}`}>
                          {due ? <CalendarClock size={11} /> : null}
                          {due ? formatDate(due) : <span className="text-[#3F3F3F]">Senza data</span>}
                        </span>
                        {followup.state === 'SNOOZED' && followup.snoozedUntil && (
                          <span className="text-[10px] text-[#F59E0B]">rimandato</span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className="rounded-full px-2 py-0.5 text-[11px]"
                          style={{
                            color: PRIORITY_COLORS[followup.priority],
                            backgroundColor: `${PRIORITY_COLORS[followup.priority]}1A`,
                          }}
                        >
                          {PRIORITY_LABELS[followup.priority]}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <FollowupStateBadge
                          state={followup.state}
                          disabled={followup.archived}
                          onChange={next => onChangeState(followup, next)}
                        />
                      </td>

                      <td className="px-4 py-3 text-right text-xs text-[#858585]">
                        {ownerName(followup.assigneeUid) || <span className="text-[#3F3F3F]">Nessuno</span>}
                      </td>

                      <td className="px-2 py-3">
                        {!followup.archived && (
                          <button
                            type="button"
                            onClick={() => onArchive(followup)}
                            title="Archivia"
                            className="rounded p-1 text-[#3F3F3F] opacity-0 transition-opacity hover:text-white group-hover:opacity-100"
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

          <Pagination
            page={view}
            onPageChange={p => { setPage(p); setSelectedIds([]); }}
            onPageSizeChange={size => { setPageSize(size); setPage(1); }}
          />
        </div>
      )}

      {formOpen && (
        <FollowupFormModal
          key={editing?.id || 'new-followup'}
          open
          followup={editing}
          owners={owners}
          leads={leads}
          customers={customers}
          accounts={accounts}
          opportunities={opportunities}
          defaultAssigneeUid={currentUid}
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
      <DeleteConfirmModal
        open={deleteConfirm}
        count={selectedIds.length}
        onClose={() => setDeleteConfirm(false)}
        onConfirm={() => {
          if (onDelete) onDelete(selectedIds);
          setSelectedIds([]);
          setDeleteConfirm(false);
        }}
      />
    </div>
  );
}


function DeleteConfirmModal({ 
  open, 
  count, 
  onClose, 
  onConfirm 
}: { 
  open: boolean; 
  count: number; 
  onClose: () => void; 
  onConfirm: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="relative flex w-full max-w-[340px] flex-col overflow-hidden rounded-[24px] border border-[#1A1A1A] bg-[#111111] animate-in fade-in zoom-in-95 duration-200">
        <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 w-48 h-32 bg-red-600/30 blur-[40px] rounded-full pointer-events-none" />
        
        <div className="flex flex-col items-center gap-4 p-8 pb-6 relative z-10 text-center">
          <div className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[#521414]">
            <Trash2 size={22} className="text-[#EF4444]" />
          </div>
          <h2 className="text-[17px] font-medium text-white">Elimina Follow-up</h2>
          <p className="text-[13px] text-[#A3A3A3] leading-relaxed">
            Sei sicuro di voler eliminare definitivamente <strong className="text-white font-medium">{count === 1 ? 'questo follow-up' : count + ' follow-up'}</strong>? L'operazione non può essere annullata.
          </p>
        </div>
        
        <footer className="flex items-center justify-between border-t border-[#1A1A1A] p-4 relative z-10 bg-transparent">
          <button
            onClick={onClose}
            className="flex h-10 flex-1 items-center justify-center rounded-xl bg-transparent text-[13px] font-medium text-[#A3A3A3] hover:text-white transition-colors"
          >
            Annulla
          </button>
          <button
            onClick={onConfirm}
            className="flex h-10 flex-1 items-center justify-center rounded-xl bg-[#EF4444] text-[13px] font-medium text-white hover:bg-red-600 transition-colors"
          >
            Sì, elimina
          </button>
        </footer>
      </div>
    </div>
  );
}
