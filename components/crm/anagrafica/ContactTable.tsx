'use client';

import { it, enUS } from 'date-fns/locale';
import { useTranslation } from '@/contexts/TranslationContext';
import { Archive, Star, MailX, MailCheck } from 'lucide-react';
import { CrmContact } from '@/components/crm/types';
import { Page } from '@/lib/crm/leadFilters';
import { ContactSort, ContactSortField } from '@/lib/crm/anagraficaFilters';
import { ColumnDef, SortableHeaders, Pagination, EmptyState, formatDate } from '../shared/TableUtils';

interface ContactTableProps {
  page: Page<CrmContact>;
  sort: ContactSort;
  accountNameById: Map<string, string>;
  onSortChange: (sort: ContactSort) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onOpen: (contact: CrmContact) => void;
  onArchive: (contact: CrmContact) => void;
  /** Apre la scheda dell'azienda collegata. */
  onOpenAccount: (accountId: string) => void;
}



export function ContactTable({
  page, sort, accountNameById,
  onSortChange, onPageChange, onPageSizeChange, onOpen, onArchive, onOpenAccount,
}: ContactTableProps) {
  const { t, locale } = useTranslation();

  const COLUMNS: ColumnDef<ContactSortField>[] = [
    { field: 'fullName',  label: t.crm.colContact },
    { field: 'role',      label: t.crm.colRole },
    { field: 'account',   label: t.crm.colCompany },
    { field: 'updatedAt', label: t.crm.colUpdated, initial: 'desc' },
  ];
  const dateLocale = locale === 'it' ? it : enUS;
  if (page.totalItems === 0) {
    return <EmptyState title={t.crm.noContactMatches} hint="Azzera la ricerca, importa un elenco o creane uno nuovo" />;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-2xl border border-[#1A1A1A]">
        <table className="w-full min-w-[820px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[#1A1A1A] bg-black/30">
              <SortableHeaders columns={COLUMNS} sort={sort} onSortChange={onSortChange} />
              <th className="px-4 py-3 text-right text-[10px] font-medium uppercase tracking-wide text-[#5A5A5A]">
                Invii
              </th>
              <th className="w-10" />
            </tr>
          </thead>

          <tbody>
            {page.items.map(contact => {
              const accountName = accountNameById.get(contact.accountId) || '';
              return (
                <tr
                  key={contact.id} data-drag-id={contact.id} data-drag-type={'contact'} data-drag-name={contact.fullName}
                  className={`group border-b border-[#131313] transition-colors last:border-0 hover:bg-white/[0.03] ${
                    contact.archived ? 'opacity-50' : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => onOpen(contact)} className="flex flex-col items-start text-left">
                      <span className="flex items-center gap-1.5 text-xs font-medium text-white group-hover:underline">
                        {contact.fullName || '—'}
                        {contact.isPrimary && (
                          <Star size={11} className="text-[#F59E0B]" aria-label={t.crm.primaryContact} />
                        )}
                        {contact.duplicateCandidateIds.length > 0 && (
                          <span
                            title={t.crm.duplicateReported}
                            className="rounded-full bg-[#F59E0B]/15 px-1.5 py-0.5 text-[9px] text-[#F59E0B]"
                          >
                            dup
                          </span>
                        )}
                      </span>
                      {contact.email && <span className="text-[11px] text-[#5A5A5A]">{contact.email}</span>}
                      {!contact.email && contact.phone && (
                        <span className="text-[11px] text-[#5A5A5A]">{contact.phone}</span>
                      )}
                    </button>
                  </td>

                  <td className="px-4 py-3 text-xs text-[#C4C4C4]">{contact.role || '—'}</td>

                  <td className="px-4 py-3">
                    {accountName ? (
                      <button
                        type="button"
                        onClick={() => onOpenAccount(contact.accountId)}
                        className="text-xs text-[#C4C4C4] hover:text-white hover:underline"
                      >
                        {accountName}
                      </button>
                    ) : (
                      <span className="text-xs text-[#3F3F3F]">Senza azienda</span>
                    )}
                  </td>

                  <td className="px-4 py-3 text-xs text-[#5A5A5A]">{formatDate(contact.updatedAt)}</td>

                  <td className="px-4 py-3 text-right">
                    {contact.suppressed ? (
                      <span title={contact.suppressedReason || t.crm.emailSuppressed} className="inline-flex text-[#EF4444]">
                        <MailX size={13} />
                      </span>
                    ) : contact.consents.email.granted ? (
                      <span title={t.crm.emailConsented} className="inline-flex text-[#10B981]">
                        <MailCheck size={13} />
                      </span>
                    ) : (
                      <span title={t.crm.noEmailConsent} className="inline-flex text-[#3F3F3F]">
                        <MailX size={13} />
                      </span>
                    )}
                  </td>

                  <td className="px-2 py-3">
                    {!contact.archived && (
                      <button
                        type="button"
                        onClick={() => onArchive(contact)}
                        title={t.crm.archive}
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
