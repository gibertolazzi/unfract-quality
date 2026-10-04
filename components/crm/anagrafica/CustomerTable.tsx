'use client';

import { it, enUS } from 'date-fns/locale';
import { useTranslation } from '@/contexts/TranslationContext';
import { getLeadStateLabel, getOppPhaseLabel, getFollowupStateLabel, getFollowupTypeLabel, getPriorityLabel, getInteractionTypeLabel, getEmailStateLabel, getCustomerStatusLabel } from '@/components/crm/shared/labels';
import { Archive, Users } from 'lucide-react';
import { CrmCustomer } from '@/components/crm/types';
import { Page } from '@/lib/crm/leadFilters';
import {
  CustomerSort, CustomerSortField, CUSTOMER_STATUS_LABELS, CUSTOMER_STATUS_COLORS,
} from '@/lib/crm/anagraficaFilters';
import { ColumnDef, SortableHeaders, Pagination, EmptyState, formatDate, Pill, formatEuro } from '../shared/TableUtils';

interface CustomerTableProps {
  page: Page<CrmCustomer>;
  sort: CustomerSort;
  accountNameById: Map<string, string>;
  onSortChange: (sort: CustomerSort) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onOpen: (customer: CrmCustomer) => void;
  onArchive: (customer: CrmCustomer) => void;
  onOpenAccount: (accountId: string) => void;
}



export function CustomerTable({
  page, sort, accountNameById,
  onSortChange, onPageChange, onPageSizeChange, onOpen, onArchive, onOpenAccount,
}: CustomerTableProps) {
  const { t } = useTranslation();

  const COLUMNS: ColumnDef<CustomerSortField>[] = [
    { field: 'account',       label: t.crm.colCustomer },
    { field: 'status',        label: t.crm.colStatus },
    { field: 'customerSince', label: t.crm.colCustomerSince, initial: 'desc' },
    { field: 'updatedAt',     label: t.crm.colUpdated,  initial: 'desc' },
  ];
  const dateLocale = t.settings.language === 'it' ? it : enUS;
  if (page.totalItems === 0) {
    return <EmptyState title={t.crm.noCustomerMatches} hint="I clienti nascono dalla conversione di un lead, oppure si creano da qui" />;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-2xl border border-[#1A1A1A]">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[#1A1A1A] bg-black/30">
              <SortableHeaders columns={COLUMNS} sort={sort} onSortChange={onSortChange} />
              <th className="px-4 py-3 text-right text-[10px] font-medium uppercase tracking-wide text-[#5A5A5A]">
                Referenti
              </th>
              <th className="px-4 py-3 text-right text-[10px] font-medium uppercase tracking-wide text-[#5A5A5A]">
                Valore
              </th>
              <th className="w-10" />
            </tr>
          </thead>

          <tbody>
            {page.items.map(customer => {
              const accountName = accountNameById.get(customer.accountId);
              return (
                <tr
                  key={customer.id} data-drag-id={customer.id} data-drag-type={'customer'} data-drag-name={accountName}
                  className={`group border-b border-[#131313] transition-colors last:border-0 hover:bg-white/[0.03] ${
                    customer.archived ? 'opacity-50' : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => onOpen(customer)} className="flex flex-col items-start text-left">
                      <span className="text-xs font-medium text-white group-hover:underline">
                        {accountName || t.crm.companyNotFound}
                      </span>
                      {customer.originLeadId && (
                        <span className="text-[11px] text-[#5A5A5A]">Da lead convertito</span>
                      )}
                    </button>
                    {!accountName && customer.accountId && (
                      <span className="text-[11px] text-[#EF4444]">
                        Riferimento azienda non risolto
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <Pill
                      color={CUSTOMER_STATUS_COLORS[customer.status]}
                      label={getCustomerStatusLabel(customer.status, t)}
                    />
                  </td>

                  <td className="px-4 py-3 text-xs text-[#C4C4C4]">{formatDate(customer.customerSince)}</td>
                  <td className="px-4 py-3 text-xs text-[#5A5A5A]">{formatDate(customer.updatedAt)}</td>

                  <td className="px-4 py-3 text-right">
                    <span className="inline-flex items-center gap-1.5 text-xs text-[#C4C4C4]">
                      <Users size={12} /> {customer.contactIds.length}
                    </span>
                  </td>

                  <td className="px-4 py-3 text-right text-xs text-[#C4C4C4]">
                    {formatEuro(((customer.monthlyAmount || 0) * 12) + (customer.annualAmount || 0) + (customer.oneTimeAmount || 0))}
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {customer.accountId && accountName && (
                        <button
                          type="button"
                          onClick={() => onOpenAccount(customer.accountId)}
                          title={t.crm.openCompanyCard}
                          className="rounded p-1 text-[#3F3F3F] opacity-0 transition-opacity hover:text-white group-hover:opacity-100"
                        >
                          <Users size={13} />
                        </button>
                      )}
                      {!customer.archived && (
                        <button
                          type="button"
                          onClick={() => onArchive(customer)}
                          title={t.crm.archive}
                          className="rounded p-1 text-[#3F3F3F] opacity-0 transition-opacity hover:text-[#EF4444] group-hover:opacity-100"
                        >
                          <Archive size={13} />
                        </button>
                      )}
                    </div>
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
