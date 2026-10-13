'use client';

import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { Page, PAGE_SIZES } from '@/lib/crm/leadFilters';

/**
 * Parti comuni alle tabelle del CRM: intestazioni ordinabili, paginazione,
 * stato vuoto, formattazioni. Stanno qui perché lead, aziende, contatti e
 * clienti devono comportarsi allo stesso modo, non somigliarsi per caso.
 */

import { useTranslation } from '@/contexts/TranslationContext';

export const formatEuro = (n: number, lang: string = 'it') =>
  new Intl.NumberFormat(lang === 'it' ? 'it-IT' : 'en-US', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

import { parseSafeDate } from '@/lib/dateUtils';

/** Accetta sia stringhe ISO sia Timestamp Firestore sia oggetti Date. */
export function formatDate(value: any, lang: string = 'it'): string {
  if (!value) return '—';
  const date = parseSafeDate(value);
  if (!date) return '—';
  return date.toLocaleDateString(lang === 'it' ? 'it-IT' : 'en-US', { day: '2-digit', month: 'short', year: '2-digit' });
}

export interface SortState<F extends string> {
  field: F;
  direction: 'asc' | 'desc';
}

export interface ColumnDef<F extends string> {
  field: F;
  label: string;
  align?: 'right';
  /** Verso iniziale al primo clic: crescente per il testo, decrescente per date e numeri. */
  initial?: 'asc' | 'desc';
}

export function SortableHeaders<F extends string>({ columns, sort, onSortChange }: {
  columns: ColumnDef<F>[];
  sort: SortState<F>;
  onSortChange: (sort: SortState<F>) => void;
}) {
  const toggle = (column: ColumnDef<F>) => {
    if (sort.field === column.field) {
      onSortChange({ field: column.field, direction: sort.direction === 'asc' ? 'desc' : 'asc' });
    } else {
      onSortChange({ field: column.field, direction: column.initial || 'asc' });
    }
  };

  return (
    <>
      {columns.map(column => {
        const active = sort.field === column.field;
        return (
          <th
            key={column.field}
            className={`px-4 py-3 text-[10px] font-medium uppercase tracking-wide ${
              column.align === 'right' ? 'text-right' : ''
            }`}
          >
            <button
              type="button"
              onClick={() => toggle(column)}
              className={`inline-flex items-center gap-1 transition-colors ${
                active ? 'text-white' : 'text-[#5A5A5A] hover:text-[#858585]'
              }`}
            >
              {column.label}
              {active && (sort.direction === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
            </button>
          </th>
        );
      })}
    </>
  );
}

export function Pagination<T>({ page, onPageChange, onPageSizeChange }: {
  page: Page<T>;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-xs text-[#5A5A5A]">{t.crm.page.replace('{page}', String(page.page)).replace('{totalPages}', String(page.totalPages))}</span>

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
        {t.crm.perPage}
        <select
          value={page.pageSize}
          onChange={e => onPageSizeChange(Number(e.target.value))}
          className="rounded-lg border border-[#1A1A1A] bg-black/30 px-2 py-1 text-xs text-white focus:outline-none"
        >
          {PAGE_SIZES.map(size => <option key={size} value={size}>{size}</option>)}
        </select>
      </label>
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[#1A1A1A] py-16">
      <p className="text-sm text-[#858585]">{title}</p>
      <p className="text-xs text-[#5A5A5A]">{hint}</p>
    </div>
  );
}

/** Pastiglia con pallino colorato, usata per stati e conteggi. */
export function Pill({ color, label, muted }: { color: string; label: string; muted?: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px]"
      style={{ color: muted ? '#858585' : color, backgroundColor: `${color}1A` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

export const inputClass =
  'rounded-lg border border-[#1A1A1A] bg-black/30 px-3 py-2 text-xs text-white placeholder:text-[#5A5A5A] focus:border-[#2A2A2A] focus:outline-none';
