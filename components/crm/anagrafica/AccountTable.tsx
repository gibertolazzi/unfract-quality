'use client';

import { Archive, Globe, Users } from 'lucide-react';
import { CrmAccount } from '@/components/crm/types';
import { Page } from '@/lib/crm/leadFilters';
import { AccountSort, AccountSortField } from '@/lib/crm/anagraficaFilters';
import { ColumnDef, SortableHeaders, Pagination, EmptyState, formatDate } from '../shared/TableUtils';

interface AccountTableProps {
  page: Page<CrmAccount>;
  sort: AccountSort;
  contactCountByAccount: Map<string, number>;
  onSortChange: (sort: AccountSort) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onOpen: (account: CrmAccount) => void;
  onArchive: (account: CrmAccount) => void;
  /** Apre la scheda contatti già filtrata su questa azienda. */
  onShowContacts: (account: CrmAccount) => void;
}

const COLUMNS: ColumnDef<AccountSortField>[] = [
  { field: 'displayName', label: 'Azienda' },
  { field: 'industry',    label: 'Settore' },
  { field: 'city',        label: 'Sede' },
  { field: 'contacts',    label: 'Contatti', align: 'right', initial: 'desc' },
  { field: 'updatedAt',   label: 'Aggiornato', initial: 'desc' },
];

export function AccountTable({
  page, sort, contactCountByAccount,
  onSortChange, onPageChange, onPageSizeChange, onOpen, onArchive, onShowContacts,
}: AccountTableProps) {
  if (page.totalItems === 0) {
    return <EmptyState title="Nessuna azienda corrisponde ai filtri" hint="Azzera la ricerca, importa un elenco o creane una nuova" />;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-2xl border border-[#1A1A1A]">
        <table className="w-full min-w-[820px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[#1A1A1A] bg-black/30">
              <SortableHeaders columns={COLUMNS} sort={sort} onSortChange={onSortChange} />
              <th className="w-10" />
            </tr>
          </thead>

          <tbody>
            {page.items.map(account => {
              const contacts = contactCountByAccount.get(account.id) || 0;
              return (
                <tr
                  key={account.id} data-drag-id={account.id} data-drag-type={'account'} data-drag-name={account.displayName || account.legalName}
                  className={`group border-b border-[#131313] transition-colors last:border-0 hover:bg-white/[0.03] ${
                    account.archived ? 'opacity-50' : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => onOpen(account)} className="flex flex-col items-start text-left">
                      <span className="flex items-center gap-2 text-xs font-medium text-white group-hover:underline">
                        {account.displayName || account.legalName || '—'}
                        {account.duplicateCandidateIds.length > 0 && (
                          <span
                            title="Possibile duplicato segnalato"
                            className="rounded-full bg-[#F59E0B]/15 px-1.5 py-0.5 text-[9px] text-[#F59E0B]"
                          >
                            dup
                          </span>
                        )}
                      </span>
                      {account.legalName && account.legalName !== account.displayName && (
                        <span className="text-[11px] text-[#5A5A5A]">{account.legalName}</span>
                      )}
                      {account.vatNumber && (
                        <span className="text-[11px] text-[#5A5A5A]">P.IVA {account.vatNumber}</span>
                      )}
                    </button>
                  </td>

                  <td className="px-4 py-3">
                    <span className="text-xs text-[#C4C4C4]">{account.industry || '—'}</span>
                    {account.sizeRange && (
                      <span className="ml-2 text-[11px] text-[#5A5A5A]">{account.sizeRange} dip.</span>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <span className="text-xs text-[#C4C4C4]">
                      {account.city || '—'}{account.region ? ` (${account.region})` : ''}
                    </span>
                    {account.domain && (
                      <a
                        href={`https://${account.domain}`}
                        target="_blank"
                        rel="noreferrer noopener"
                        onClick={e => e.stopPropagation()}
                        className="mt-0.5 flex items-center gap-1 text-[11px] text-[#5A5A5A] hover:text-[#858585]"
                      >
                        <Globe size={10} /> {account.domain}
                      </a>
                    )}
                  </td>

                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => onShowContacts(account)}
                      disabled={contacts === 0}
                      title={contacts > 0 ? 'Vedi i contatti di questa azienda' : 'Nessun contatto collegato'}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs ${
                        contacts > 0
                          ? 'text-[#C4C4C4] hover:bg-white/5 hover:text-white'
                          : 'cursor-default text-[#3F3F3F]'
                      }`}
                    >
                      <Users size={12} /> {contacts}
                    </button>
                  </td>

                  <td className="px-4 py-3 text-xs text-[#5A5A5A]">{formatDate(account.updatedAt)}</td>

                  <td className="px-2 py-3">
                    {!account.archived && (
                      <button
                        type="button"
                        onClick={() => onArchive(account)}
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
