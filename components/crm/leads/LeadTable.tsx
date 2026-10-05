'use client';

import { useTranslation } from '@/contexts/TranslationContext';
import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, UserCircle2, Archive, Handshake } from 'lucide-react';
import { CrmLead } from '@/components/crm/types';
import { LeadState } from '@/components/crm/constants';
import { LeadSort, LeadSortField, Page, PAGE_SIZES } from '@/lib/crm/leadFilters';
import { LeadStateBadge } from './LeadStateBadge';
import { OwnerOption } from './LeadFiltersBar';

interface LeadTableProps {
  page: Page<CrmLead>;
  sort: LeadSort;
  owners: OwnerOption[];
  onSortChange: (sort: LeadSort) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onStateChange: (lead: CrmLead, next: LeadState) => void;
  onAssign: (lead: CrmLead, ownerUid: string) => void;
  onOpen: (lead: CrmLead) => void;
  onArchive: (lead: CrmLead) => void;
  /** Apre la conversione guidata. Il modulo spiega da sé quando non si può. */
  onConvert: (lead: CrmLead) => void;
}



const formatEuro = (n: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

function formatDate(value: any, locale: string): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : (value?.toMillis ? new Date(value.toMillis()) : null);
  if (!date || Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(locale === 'it' ? 'it-IT' : 'en-US', { day: '2-digit', month: 'short', year: '2-digit' });
}

function isOverdue(value: any): boolean {
  if (!value) return false;
  const iso = typeof value === 'string' ? value.slice(0, 10)
    : value?.toMillis ? new Date(value.toMillis()).toISOString().slice(0, 10) : '';
  return !!iso && iso < new Date().toISOString().slice(0, 10);
}

function OwnerCell({ lead, owners, onAssign }: {
  lead: CrmLead; owners: OwnerOption[]; onAssign: (lead: CrmLead, uid: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const owner = owners.find(o => o.uid === lead.ownerUid);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-xs text-[#858585] hover:bg-white/5 hover:text-white"
      >
        <UserCircle2 size={13} />
        {owner ? owner.name : <span className="text-[#5A5A5A]">Non assegnato</span>}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 min-w-[160px] overflow-hidden rounded-xl border border-[#1A1A1A] bg-[#111111] py-1 shadow-xl">
          <button
            type="button"
            onClick={() => { onAssign(lead, ''); setOpen(false); }}
            className="w-full px-3 py-1.5 text-left text-xs text-[#5A5A5A] hover:bg-white/5"
          >
            Non assegnato
          </button>
          {owners.map(o => (
            <button
              key={o.uid}
              type="button"
              onClick={() => { onAssign(lead, o.uid); setOpen(false); }}
              className="w-full px-3 py-1.5 text-left text-xs text-[#C4C4C4] hover:bg-white/5 hover:text-white"
            >
              {o.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function LeadTable({
  page, sort, owners, onSortChange, onPageChange, onPageSizeChange,
  onStateChange, onAssign, onOpen, onArchive, onConvert,
}: LeadTableProps) {
  const { t, locale } = useTranslation();

  const COLUMNS: { field: LeadSortField; label: string; align?: 'right' }[] = [
    { field: 'fullName',       label: t.crm.colName },
    { field: 'companyName',    label: t.crm.colCompanyLead },
    { field: 'state',          label: t.crm.colStateLead },
    { field: 'estimatedValue', label: t.crm.colValue, align: 'right' },
    { field: 'nextFollowupAt', label: t.crm.colNextAction },
    { field: 'updatedAt',      label: t.crm.colUpdatedLead },
  ];

  const toggleSort = (field: LeadSortField) => {
    if (sort.field === field) {
      onSortChange({ field, direction: sort.direction === 'asc' ? 'desc' : 'asc' });
    } else {
      onSortChange({ field, direction: field === 'fullName' || field === 'companyName' ? 'asc' : 'desc' });
    }
  };

  if (page.totalItems === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[#1A1A1A] py-16">
        <p className="text-sm text-[#858585]">Nessun lead corrisponde ai filtri</p>
        <p className="text-xs text-[#5A5A5A]">Prova ad azzerare i filtri o a crearne uno nuovo</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* La tabella scorre in orizzontale per conto suo: la pagina non si allarga mai. */}
      <div className="overflow-x-auto rounded-2xl border border-[#1A1A1A]">
        <table className="w-full min-w-[860px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[#1A1A1A] bg-black/30">
              {COLUMNS.map(col => {
                const active = sort.field === col.field;
                return (
                  <th
                    key={col.field}
                    className={`px-4 py-3 text-[10px] font-medium uppercase tracking-wide ${
                      col.align === 'right' ? 'text-right' : ''
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(col.field)}
                      className={`inline-flex items-center gap-1 transition-colors ${
                        active ? 'text-white' : 'text-[#5A5A5A] hover:text-[#858585]'
                      }`}
                    >
                      {col.label}
                      {active && (sort.direction === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
                    </button>
                  </th>
                );
              })}
              <th className="px-4 py-3 text-right text-[10px] font-medium uppercase tracking-wide text-[#5A5A5A]">
                Owner
              </th>
              <th className="w-16" />
            </tr>
          </thead>

          <tbody>
            {page.items.map(lead => (
              <tr
                key={lead.id} data-drag-id={lead.id} data-drag-type={'lead'} data-drag-name={lead.fullName || lead.companyName}
                className={`group border-b border-[#131313] transition-colors last:border-0 hover:bg-white/[0.03] ${
                  lead.archived ? 'opacity-50' : ''
                }`}
              >
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => onOpen(lead)}
                    className="flex flex-col items-start text-left"
                  >
                    <span className="text-xs font-medium text-white group-hover:underline">
                      {lead.fullName || '—'}
                    </span>
                    {lead.email && <span className="text-[11px] text-[#5A5A5A]">{lead.email}</span>}
                  </button>
                </td>

                <td className="px-4 py-3">
                  <span className="text-xs text-[#C4C4C4]">{lead.companyName || '—'}</span>
                  {lead.duplicateCandidateIds.length > 0 && (
                    <span
                      title="Possibile duplicato segnalato"
                      className="ml-2 rounded-full bg-[#F59E0B]/15 px-1.5 py-0.5 text-[9px] text-[#F59E0B]"
                    >
                      dup
                    </span>
                  )}
                </td>

                <td className="px-4 py-3">
                  <LeadStateBadge
                    state={lead.state}
                    onChange={next => onStateChange(lead, next)}
                    disabled={lead.archived}
                  />
                </td>

                <td className="px-4 py-3 text-right text-xs text-[#C4C4C4]">
                  {lead.estimatedValue > 0 ? formatEuro(lead.estimatedValue) : '—'}
                </td>

                <td className="px-4 py-3">
                  <span className={`text-xs ${isOverdue(lead.nextFollowupAt) ? 'text-[#EF4444]' : 'text-[#858585]'}`}>
                    {formatDate(lead.nextFollowupAt, locale)}
                  </span>
                </td>

                <td className="px-4 py-3 text-xs text-[#5A5A5A]">{formatDate(lead.updatedAt, locale)}</td>

                <td className="px-4 py-3 text-right">
                  <OwnerCell lead={lead} owners={owners} onAssign={onAssign} />
                </td>

                <td className="px-2 py-3">
                  <div className="flex items-center justify-end gap-1">
                    {!lead.archived && (
                      <button
                        type="button"
                        onClick={() => onConvert(lead)}
                        title={
                          lead.state === 'NEGOTIATION'
                            ? t.crm.convertToCustomer
                            : lead.state === 'CONVERTED'
                              ? 'Vedi cosa è diventato'
                              : 'Conversione: si parte dalla negoziazione'
                        }
                        className={`rounded p-1 transition-opacity group-hover:opacity-100 ${
                          lead.state === 'NEGOTIATION'
                            ? 'text-[#10B981] opacity-60 hover:text-[#10B981]'
                            : 'text-[#3F3F3F] opacity-0 hover:text-[#858585]'
                        }`}
                      >
                        <Handshake size={13} />
                      </button>
                    )}
                    {!lead.archived && (
                      <button
                        type="button"
                        onClick={() => onArchive(lead)}
                        title="Archivia"
                        className="rounded p-1 text-[#3F3F3F] opacity-0 transition-opacity hover:text-[#EF4444] group-hover:opacity-100"
                      >
                        <Archive size={13} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs text-[#5A5A5A]">
          Pagina {page.page} di {page.totalPages}
        </span>

        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={page.page <= 1}
            onClick={() => onPageChange(page.page - 1)}
            className="rounded-lg border border-[#1A1A1A] p-1.5 text-[#858585] transition-colors hover:text-white disabled:opacity-30 disabled:hover:text-[#858585]"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            disabled={page.page >= page.totalPages}
            onClick={() => onPageChange(page.page + 1)}
            className="rounded-lg border border-[#1A1A1A] p-1.5 text-[#858585] transition-colors hover:text-white disabled:opacity-30 disabled:hover:text-[#858585]"
          >
            <ChevronRight size={14} />
          </button>
        </div>

        <label className="ml-auto flex items-center gap-2 text-xs text-[#5A5A5A]">
          Per pagina
          <select
            value={page.pageSize}
            onChange={e => onPageSizeChange(Number(e.target.value))}
            className="rounded-lg border border-[#1A1A1A] bg-black/30 px-2 py-1 text-xs text-white focus:outline-none"
          >
            {PAGE_SIZES.map(size => <option key={size} value={size}>{size}</option>)}
          </select>
        </label>
      </div>
    </div>
  );
}
