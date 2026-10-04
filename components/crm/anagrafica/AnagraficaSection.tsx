'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { CrmAccount, CrmContact, CrmCustomer, CrmLead, CrmDocument } from '@/components/crm/types';
import {
  AnagraficaFilters, EMPTY_ANAGRAFICA_FILTERS, countAnagraficaFilters,
  AccountSort, ContactSort, CustomerSort,
  DEFAULT_ACCOUNT_SORT, DEFAULT_CONTACT_SORT, DEFAULT_CUSTOMER_SORT,
  buildAccountView, buildContactView, buildCustomerView, buildAnagraficaIndexes,
  CUSTOMER_STATUS_LABELS,
} from '@/lib/crm/anagraficaFilters';
import { OwnerOption } from '../leads/LeadFiltersBar';
import { TimelineSources } from '@/lib/crm/timeline';
import { inputClass } from '../shared/TableUtils';
import { AccountTable } from './AccountTable';
import { ContactTable } from './ContactTable';
import { CustomerTable } from './CustomerTable';
import { AccountFormModal, AccountFormValues } from './AccountFormModal';
import { ContactFormModal, ContactFormValues } from './ContactFormModal';
import { CustomerFormModal, CustomerFormValues } from './CustomerFormModal';
import { RecordDrawer, DrawerTarget } from './RecordDrawer';
import { UploadRunner } from '../documenti/UploadPanel';
import { DocumentTarget } from '@/lib/crm/documentUpload';
import { EmailComposer, ComposedEmail } from '../email/EmailComposer';
import { canEmailContact, SendEmailResult } from '@/lib/crm/emailSend';

import { useTranslation } from '@/contexts/TranslationContext';

export type AnagraficaEntity = 'account' | 'contact' | 'customer';

interface AnagraficaSectionProps {
  entity: AnagraficaEntity;
  accounts: CrmAccount[];
  contacts: CrmContact[];
  customers: CrmCustomer[];
  leads: CrmLead[];
  owners: OwnerOption[];
  history: TimelineSources;
  policyVersion: string;
  optOutAddress: string;
  senderName: string;
  saving?: boolean;
  loading?: boolean;

  onCreateAccount: (values: AccountFormValues) => void;
  onUpdateAccount: (id: string, values: AccountFormValues) => void;
  onArchiveAccount: (account: CrmAccount) => void;
  onRestoreAccount: (account: CrmAccount) => void;

  onCreateContact: (values: ContactFormValues) => void;
  onUpdateContact: (id: string, values: ContactFormValues) => void;
  onArchiveContact: (contact: CrmContact) => void;
  onRestoreContact: (contact: CrmContact) => void;

  onCreateCustomer: (values: CustomerFormValues) => void;
  onUpdateCustomer: (id: string, values: CustomerFormValues) => void;
  onArchiveCustomer: (customer: CrmCustomer) => void;
  onRestoreCustomer: (customer: CrmCustomer) => void;

  onEntityChange: (entity: AnagraficaEntity) => void;
  onSendEmail: (contact: CrmContact, email: ComposedEmail) => Promise<SendEmailResult>;
  onUploadDocument: (target: DocumentTarget) => UploadRunner;
  onDownloadDocument: (document: CrmDocument) => void;
}

export function AnagraficaSection({
  entity, accounts, contacts, customers, leads, owners, history, policyVersion,
  optOutAddress, senderName, saving, loading,
  onCreateAccount, onUpdateAccount, onArchiveAccount, onRestoreAccount,
  onCreateContact, onUpdateContact, onArchiveContact, onRestoreContact,
  onCreateCustomer, onUpdateCustomer, onArchiveCustomer, onRestoreCustomer,
  onEntityChange, onSendEmail, onUploadDocument, onDownloadDocument,
}: AnagraficaSectionProps) {
  const { t } = useTranslation();

  const NEW_LABELS: Record<AnagraficaEntity, string> = {
    account: t.crm.newAccount,
    contact: t.crm.newContact,
    customer: t.crm.newCustomer,
  };

  const SEARCH_PLACEHOLDERS: Record<AnagraficaEntity, string> = {
    account: t.crm.searchAccount,
    contact: t.crm.searchContact,
    customer: t.crm.searchCustomer,
  };

  const [filters, setFilters] = useState<AnagraficaFilters>({ ...EMPTY_ANAGRAFICA_FILTERS });
  const [accountSort, setAccountSort] = useState<AccountSort>({ ...DEFAULT_ACCOUNT_SORT });
  const [contactSort, setContactSort] = useState<ContactSort>({ ...DEFAULT_CONTACT_SORT });
  const [customerSort, setCustomerSort] = useState<CustomerSort>({ ...DEFAULT_CUSTOMER_SORT });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DrawerTarget | null>(null);
  const [defaultAccountId, setDefaultAccountId] = useState('');
  const [drawer, setDrawer] = useState<DrawerTarget | null>(null);
  const [composing, setComposing] = useState<CrmContact | null>(null);
  const [sending, setSending] = useState(false);

  // Cambiando scheda i filtri di un'entità non hanno senso sull'altra. Il
  // filtro per azienda si conserva solo dove viene davvero applicato — contatti
  // e clienti — altrimenti resterebbe a schermo un filtro che non filtra nulla.
  useEffect(() => {
    setFilters(prev => ({
      ...EMPTY_ANAGRAFICA_FILTERS,
      accountId: entity === 'account' ? '' : prev.accountId,
    }));
    setPage(1);
  }, [entity]);

  const indexes = useMemo(() => buildAnagraficaIndexes(accounts, contacts), [accounts, contacts]);

  const accountView = useMemo(
    () => buildAccountView(accounts, filters, accountSort, page, pageSize, {
      contactCountByAccount: indexes.contactCountByAccount,
    }),
    [accounts, filters, accountSort, page, pageSize, indexes]
  );

  const contactView = useMemo(
    () => buildContactView(contacts, filters, contactSort, page, pageSize, {
      accountNameById: indexes.accountNameById,
    }),
    [contacts, filters, contactSort, page, pageSize, indexes]
  );

  const customerView = useMemo(
    () => buildCustomerView(customers, filters, customerSort, page, pageSize, {
      accountNameById: indexes.accountNameById,
      contactNameById: indexes.contactNameById,
    }),
    [customers, filters, customerSort, page, pageSize, indexes]
  );

  const total =
    entity === 'account' ? accountView.totalItems
    : entity === 'contact' ? contactView.totalItems
    : customerView.totalItems;

  const source =
    entity === 'account' ? accounts.filter(a => !a.archived).length
    : entity === 'contact' ? contacts.filter(c => !c.archived).length
    : customers.filter(c => !c.archived).length;

  const industries = useMemo(
    () => Array.from(new Set(accounts.map(a => a.industry).filter(Boolean))).sort(),
    [accounts]
  );

  const ownerName = (uid: string) => owners.find(o => o.uid === uid)?.name || '';
  const activeFilters = countAnagraficaFilters(filters);

  // Il record aperto nella scheda deve seguire gli aggiornamenti della lista,
  // altrimenti dopo una modifica mostrerebbe i valori vecchi.
  const liveDrawer: DrawerTarget | null = useMemo(() => {
    if (!drawer) return null;
    if (drawer.kind === 'account') {
      const found = accounts.find(a => a.id === drawer.record.id);
      return found ? { kind: 'account', record: found } : null;
    }
    if (drawer.kind === 'contact') {
      const found = contacts.find(c => c.id === drawer.record.id);
      return found ? { kind: 'contact', record: found } : null;
    }
    const found = customers.find(c => c.id === drawer.record.id);
    return found ? { kind: 'customer', record: found } : null;
  }, [drawer, accounts, contacts, customers]);

  // Quale modulo aprire: quello del record in modifica, altrimenti quello
  // della scheda corrente. Una scheda aperta da un collegamento può essere di
  // un'entità diversa da quella elencata sotto.
  const formKind = editing?.kind || entity;

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
    setDefaultAccountId('');
  };

  const openNew = () => {
    setEditing(null);
    setDefaultAccountId('');
    setFormOpen(true);
  };

  const set = (patch: Partial<AnagraficaFilters>) => {
    setFilters(prev => ({ ...prev, ...patch }));
    setPage(1);
  };

  const filteredAccountName = filters.accountId && entity !== 'account'
    ? indexes.accountNameById.get(filters.accountId)
    : '';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[16rem] flex-1">
          <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5A5A]" />
          <input
            value={filters.search}
            onChange={e => set({ search: e.target.value })}
            placeholder={SEARCH_PLACEHOLDERS[entity]}
            className={`${inputClass} w-full pl-8`}
          />
        </div>

        {entity === 'contact' && (
          <>
            <button
              type="button"
              onClick={() => set({ onlyConsented: !filters.onlyConsented, onlySuppressed: false })}
              className={`rounded-lg border px-3 py-2 text-xs transition-colors ${
                filters.onlyConsented
                  ? 'border-white/30 bg-white/10 text-white'
                  : 'border-[#1A1A1A] text-[#858585] hover:text-white'
              }`}
            >
              {t.crm.withConsent}
            </button>
            <button
              type="button"
              onClick={() => set({ onlySuppressed: !filters.onlySuppressed, onlyConsented: false })}
              className={`rounded-lg border px-3 py-2 text-xs transition-colors ${
                filters.onlySuppressed
                  ? 'border-white/30 bg-white/10 text-white'
                  : 'border-[#1A1A1A] text-[#858585] hover:text-white'
              }`}
            >
              {t.crm.suppressed}
            </button>
          </>
        )}

        {(entity === 'account' || entity === 'contact') && (
          <button
            type="button"
            onClick={() => set({ onlyOrphans: !filters.onlyOrphans })}
            title={entity === 'account' ? t.crm.noContactsTooltip : t.crm.noAccountTooltip}
            className={`rounded-lg border px-3 py-2 text-xs transition-colors ${
              filters.onlyOrphans
                ? 'border-white/30 bg-white/10 text-white'
                : 'border-[#1A1A1A] text-[#858585] hover:text-white'
            }`}
          >
            {entity === 'account' ? t.crm.noContacts : t.crm.noAccount}
          </button>
        )}

        {entity === 'customer' && (
          <select
            value={filters.status}
            onChange={e => set({ status: e.target.value as AnagraficaFilters['status'] })}
            className={inputClass}
          >
            <option value="">{t.crm.allStatuses}</option>
            {(Object.keys(CUSTOMER_STATUS_LABELS) as CrmCustomer['status'][]).map(status => (
              <option key={status} value={status}>{
                status === 'active' ? t.crm.statusActive : status === 'inactive' ? t.crm.statusInactive : t.crm.statusSuspended
              }</option>
            ))}
          </select>
        )}

        <button
          type="button"
          onClick={() => set({ includeArchived: !filters.includeArchived })}
          className={`rounded-lg border px-3 py-2 text-xs transition-colors ${
            filters.includeArchived
              ? 'border-white/30 bg-white/10 text-white'
              : 'border-[#1A1A1A] text-[#858585] hover:text-white'
          }`}
        >
          {t.crm.archived}
        </button>

        <span className="text-xs text-[#5A5A5A]">
          {activeFilters > 0 ? t.crm.nOfM.replace('{n}', total.toString()).replace('{m}', source.toString()) : total}
        </span>

        <button
          type="button"
          onClick={openNew}
          className="ml-auto flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-medium text-black transition-opacity hover:opacity-90"
        >
          <Plus size={14} />
          {NEW_LABELS[entity]}
        </button>
      </div>

      {filteredAccountName && (
        <div className="flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1">
          <span className="text-[11px] text-white">{t.crm.companyLabel}{filteredAccountName}</span>
          <button type="button" onClick={() => set({ accountId: '' })} className="text-[#858585] hover:text-white">
            <X size={11} />
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-[#858585]">{t.crm.loading}</p>
      ) : entity === 'account' ? (
        <AccountTable
          page={accountView}
          sort={accountSort}
          contactCountByAccount={indexes.contactCountByAccount}
          onSortChange={setAccountSort}
          onPageChange={setPage}
          onPageSizeChange={size => { setPageSize(size); setPage(1); }}
          onOpen={account => setDrawer({ kind: 'account', record: account })}
          onArchive={onArchiveAccount}
          onShowContacts={account => {
            setFilters({ ...EMPTY_ANAGRAFICA_FILTERS, accountId: account.id });
            setPage(1);
            onEntityChange('contact');
          }}
        />
      ) : entity === 'contact' ? (
        <ContactTable
          page={contactView}
          sort={contactSort}
          accountNameById={indexes.accountNameById}
          onSortChange={setContactSort}
          onPageChange={setPage}
          onPageSizeChange={size => { setPageSize(size); setPage(1); }}
          onOpen={contact => setDrawer({ kind: 'contact', record: contact })}
          onArchive={onArchiveContact}
          onOpenAccount={id => {
            const account = accounts.find(a => a.id === id);
            if (account) setDrawer({ kind: 'account', record: account });
          }}
        />
      ) : (
        <CustomerTable
          page={customerView}
          sort={customerSort}
          accountNameById={indexes.accountNameById}
          onSortChange={setCustomerSort}
          onPageChange={setPage}
          onPageSizeChange={size => { setPageSize(size); setPage(1); }}
          onOpen={customer => setDrawer({ kind: 'customer', record: customer })}
          onArchive={onArchiveCustomer}
          onOpenAccount={id => {
            const account = accounts.find(a => a.id === id);
            if (account) setDrawer({ kind: 'account', record: account });
          }}
        />
      )}

      {liveDrawer && (
        <RecordDrawer
          target={liveDrawer}
          accounts={accounts}
          contacts={contacts}
          customers={customers}
          leads={leads}
          history={history}
          ownerName={ownerName}
          onClose={() => setDrawer(null)}
          onEdit={() => { setEditing(liveDrawer); setFormOpen(true); }}
          onArchive={() => {
            if (liveDrawer.kind === 'account') onArchiveAccount(liveDrawer.record);
            else if (liveDrawer.kind === 'contact') onArchiveContact(liveDrawer.record);
            else if (liveDrawer.kind === 'customer') onArchiveCustomer(liveDrawer.record);
          }}
          onRestore={() => {
            if (liveDrawer.kind === 'account') onRestoreAccount(liveDrawer.record);
            else if (liveDrawer.kind === 'contact') onRestoreContact(liveDrawer.record);
            else if (liveDrawer.kind === 'customer') onRestoreCustomer(liveDrawer.record);
          }}
          onOpen={setDrawer}
          onCompose={contact => setComposing(contact)}
          onUploadDocument={onUploadDocument}
          onDownloadDocument={onDownloadDocument}
          onAddContact={accountId => {
            setEditing(null);
            setDefaultAccountId(accountId);
            setDrawer(null);
            onEntityChange('contact');
            setFormOpen(true);
          }}
          onAddCustomer={accountId => {
            setEditing(null);
            setDefaultAccountId(accountId);
            setDrawer(null);
            onEntityChange('customer');
            setFormOpen(true);
          }}
          onRemoveCustomer={onArchiveCustomer}
        />
      )}

      {composing && (
        <EmailComposer
          key={composing.id}
          open
          toName={composing.fullName}
          toEmail={composing.email}
          eligibility={canEmailContact(composing)}
          context={{
            nome: composing.firstName || composing.fullName,
            cognome: composing.lastName,
            nome_completo: composing.fullName,
            azienda: indexes.accountNameById.get(composing.accountId) || '',
            ruolo: composing.role,
            email: composing.email,
            mittente: senderName,
          }}
          optOutAddress={optOutAddress}
          optOutReference={composing.id}
          sending={sending}
          onClose={() => setComposing(null)}
          onSend={async email => {
            setSending(true);
            try {
              return await onSendEmail(composing, email);
            } finally {
              setSending(false);
            }
          }}
        />
      )}

      {formOpen && formKind === 'account' && (
        <AccountFormModal
          key={editing?.kind === 'account' ? editing.record.id : 'new-account'}
          open
          account={editing?.kind === 'account' ? editing.record : null}
          industries={industries}
          saving={saving}
          onClose={closeForm}
          onSubmit={values => {
            if (editing?.kind === 'account') onUpdateAccount(editing.record.id, values);
            else onCreateAccount(values);
            closeForm();
          }}
        />
      )}

      {formOpen && formKind === 'contact' && (
        <ContactFormModal
          key={editing?.kind === 'contact' ? editing.record.id : `new-contact-${defaultAccountId}`}
          open
          contact={editing?.kind === 'contact' ? editing.record : null}
          accounts={accounts}
          defaultAccountId={defaultAccountId}
          policyVersion={policyVersion}
          saving={saving}
          onClose={closeForm}
          onSubmit={values => {
            if (editing?.kind === 'contact') onUpdateContact(editing.record.id, values);
            else onCreateContact(values);
            closeForm();
          }}
        />
      )}

      {formOpen && formKind === 'customer' && (
        <CustomerFormModal
          key={editing?.kind === 'customer' ? editing.record.id : 'new-customer'}
          open
          customer={editing?.kind === 'customer' ? editing.record : null}
          accounts={accounts}
          contacts={contacts}
          defaultAccountId={defaultAccountId}
          saving={saving}
          onClose={closeForm}
          onSubmit={values => {
            if (editing?.kind === 'customer') onUpdateCustomer(editing.record.id, values);
            else onCreateCustomer(values);
            closeForm();
          }}
        />
      )}

    </div>
  );
}
