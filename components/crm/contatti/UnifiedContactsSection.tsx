'use client';

import { getLeadStateLabel, getOppPhaseLabel, getFollowupStateLabel, getFollowupTypeLabel, getPriorityLabel, getInteractionTypeLabel, getEmailStateLabel, getCustomerStatusLabel } from '@/components/crm/shared/labels';
import { useTranslation } from '@/contexts/TranslationContext';
import { useMemo, useState } from 'react';
import { useCrm } from '@/contexts/CrmContext';
import { createCustomList, updateCustomList } from '@/lib/crm/customLists';
import { Plus, Search, X, Trash2 } from 'lucide-react';
import { CrmAccount, CrmContact, CrmCustomer, CrmLead, CrmDocument } from '@/components/crm/types';
import {
  AnagraficaFilters, EMPTY_ANAGRAFICA_FILTERS,
  AccountSort, ContactSort, CustomerSort,
  DEFAULT_ACCOUNT_SORT, DEFAULT_CONTACT_SORT, DEFAULT_CUSTOMER_SORT,
  buildAccountView, buildContactView, buildCustomerView, buildAnagraficaIndexes,
  CUSTOMER_STATUS_LABELS,
} from '@/lib/crm/anagraficaFilters';
import { LeadFilters, LeadSort, EMPTY_FILTERS as EMPTY_LEAD_FILTERS, DEFAULT_SORT as DEFAULT_LEAD_SORT, buildLeadView } from '@/lib/crm/leadFilters';
import { OwnerOption } from '../leads/LeadFiltersBar';
import { TimelineSources } from '@/lib/crm/timeline';
import { inputClass } from '../shared/TableUtils';
import { Pagination } from '../shared/TableUtils';
import { UnifiedTable, UnifiedRecord, UnifiedEntity } from './UnifiedTable';
import { EntityDragDropProvider } from './EntityDragDropProvider';
import { AccountFormModal, AccountFormValues } from '../anagrafica/AccountFormModal';
import { ContactFormModal, ContactFormValues } from '../anagrafica/ContactFormModal';
import { CustomerFormModal, CustomerFormValues } from '../anagrafica/CustomerFormModal';
import { LeadFormModal, LeadFormValues } from '../leads/LeadFormModal';
import { RecordDrawer, DrawerTarget } from '../anagrafica/RecordDrawer';
import { UploadRunner } from '../documenti/UploadPanel';
import { DocumentTarget } from '@/lib/crm/documentUpload';
import { EmailComposer, ComposedEmail } from '../email/EmailComposer';
import { canEmailContact, SendEmailResult } from '@/lib/crm/emailSend';
import { LeadState } from '../constants';

type ViewFilter = 'all' | 'lead' | 'account' | 'contact' | 'customer' | string;

interface UnifiedContactsSectionProps {
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
  sources: string[];

  onCreateQuickFollowup?: (targetId: string, kind: string, days?: number) => void;
  onCreateAccount: (values: AccountFormValues) => void;
  onUpdateAccount: (id: string, values: AccountFormValues) => void;
  onArchiveAccount: (account: CrmAccount) => void;
  onDeleteAccount?: (account: CrmAccount) => void;
  onRestoreAccount: (account: CrmAccount) => void;

  onCreateContact: (values: ContactFormValues) => void;
  onUpdateContact: (id: string, values: ContactFormValues) => void;
  onArchiveContact: (contact: CrmContact) => void;
  onDeleteContact?: (contact: CrmContact) => void;
  onRestoreContact: (contact: CrmContact) => void;

  onCreateCustomer: (values: CustomerFormValues) => void;
  onUpdateCustomer: (id: string, values: CustomerFormValues) => void;
  onArchiveCustomer: (customer: CrmCustomer) => void;
  onDeleteCustomer?: (customer: CrmCustomer) => void;
  onRestoreCustomer: (customer: CrmCustomer) => void;

  onCreateLead: (values: LeadFormValues) => void;
  onUpdateLead: (id: string, values: LeadFormValues) => void;
  onArchiveLead: (lead: CrmLead) => void;
  onDeleteLead?: (lead: CrmLead) => void;
  onRestoreLead: (lead: CrmLead) => void;
  onChangeLeadState: (lead: CrmLead, state: LeadState) => void;
  onAssignLead: (lead: CrmLead, ownerUid: string) => void;

  onSendEmail: (contact: CrmContact, email: ComposedEmail) => Promise<SendEmailResult>;
  onUploadDocument: (target: DocumentTarget) => UploadRunner;
  onConvertLead?: (lead: CrmLead) => void;
  onDownloadDocument: (document: CrmDocument) => void;
  onDropConvert?: (id: string, type: string, targetType: string) => void;
}

const NEW_LABELS: Record<string, string> = {
  all: 'Nuovo',
  lead: 'Nuovo lead',
  account: 'Nuova azienda',
  contact: 'Nuovo contatto',
  customer: 'Nuovo cliente',
};

const VIEW_LABELS: Record<string, string> = {
  all: 'Tutti',
  lead: 'Lead',
  account: 'Aziende',
  contact: 'Contatti',
  customer: 'Clienti',
  archived: 'Archiviati',
};


export function UnifiedContactsSection(props: UnifiedContactsSectionProps) {
  const { t } = useTranslation();
  const [view, setView] = useState<ViewFilter>('all');
  const [search, setSearch] = useState('');

  const [leadFilters, setLeadFilters] = useState<LeadFilters>({ ...EMPTY_LEAD_FILTERS });
  const [leadSort, setLeadSort] = useState<LeadSort>({ ...DEFAULT_LEAD_SORT });

  const [anaFilters, setAnaFilters] = useState<AnagraficaFilters>({ ...EMPTY_ANAGRAFICA_FILTERS });
  const [accountSort, setAccountSort] = useState<AccountSort>({ ...DEFAULT_ACCOUNT_SORT });
  const [contactSort, setContactSort] = useState<ContactSort>({ ...DEFAULT_CONTACT_SORT });
  const [customerSort, setCustomerSort] = useState<CustomerSort>({ ...DEFAULT_CUSTOMER_SORT });

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DrawerTarget | { kind: 'lead', record: CrmLead } | null>(null);
  const [defaultAccountId, setDefaultAccountId] = useState('');
  const [drawer, setDrawer] = useState<DrawerTarget | { kind: 'lead', record: CrmLead } | null>(null);
  const [composing, setComposing] = useState<CrmContact | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean, targets: UnifiedRecord[] }>({ open: false, targets: [] });
  const [sending, setSending] = useState(false);

  // Custom list states
  const { customLists, ctx } = useCrm();
  const [creatingList, setCreatingList] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [addToListMenuOpen, setAddToListMenuOpen] = useState(false);

  const indexes = useMemo(() => buildAnagraficaIndexes(props.accounts, props.contacts), [props.accounts, props.contacts]);

  // Lead view
  const leadViewData = useMemo(() => buildLeadView(props.leads, { ...leadFilters, search }, leadSort, page, pageSize), [props.leads, leadFilters, search, leadSort, page, pageSize]);

  // Anagrafica views
  const accountViewData = useMemo(() => buildAccountView(props.accounts, { ...anaFilters, search }, accountSort, page, pageSize, { contactCountByAccount: indexes.contactCountByAccount }), [props.accounts, anaFilters, search, accountSort, page, pageSize, indexes]);
  const contactViewData = useMemo(() => buildContactView(props.contacts, { ...anaFilters, search }, contactSort, page, pageSize, { accountNameById: indexes.accountNameById }), [props.contacts, anaFilters, search, contactSort, page, pageSize, indexes]);
  const customerViewData = useMemo(() => buildCustomerView(props.customers, { ...anaFilters, search }, customerSort, page, pageSize, { accountNameById: indexes.accountNameById, contactNameById: indexes.contactNameById }), [props.customers, anaFilters, search, customerSort, page, pageSize, indexes]);

  // All view
  const allUnifiedRecords: UnifiedRecord[] = useMemo(() => {
    let all: UnifiedRecord[] = [];
    if (!props.loading) {
      const includeArchived = view === 'archived';
      all = [
        ...props.leads.filter(l => !!l.archived === includeArchived).map(l => ({ id: l.id, type: 'lead' as const, name: l.fullName || l.companyName, email: l.email, phone: l.phone, companyName: l.companyName, status: getLeadStateLabel(l.state, t) || l.state, raw: l })),
        ...props.accounts.filter(a => !!a.archived === includeArchived).map(a => ({ id: a.id, type: 'account' as const, name: a.displayName || a.legalName, email: '', phone: '', companyName: a.displayName || a.legalName, status: a.industry, raw: a })),
        ...props.contacts.filter(c => !!c.archived === includeArchived).map(c => ({ id: c.id, type: 'contact' as const, name: c.fullName, email: c.email, phone: c.phone, companyName: indexes.accountNameById.get(c.accountId) || '', status: c.role, raw: c })),
        ...props.customers.filter(c => !!c.archived === includeArchived).map(c => ({ id: c.id, type: 'customer' as const, name: indexes.accountNameById.get(c.accountId) || '', email: '', phone: '', companyName: indexes.accountNameById.get(c.accountId) || '', status: getCustomerStatusLabel(c.status, t) || c.status, value: ((c.monthlyAmount || 0) * 12) + (c.annualAmount || 0) + (c.oneTimeAmount || 0), raw: c })),
      ];
      if (search) {
        const s = search.toLowerCase();
        all = all.filter(r => r.name.toLowerCase().includes(s) || r.email.toLowerCase().includes(s) || r.companyName.toLowerCase().includes(s));
      }
      if (view !== 'all' && view !== 'archived') {
        if (['lead', 'account', 'contact', 'customer'].includes(view)) {
          all = all.filter(r => r.type === view);
        } else {
          // Custom list filter
          const list = customLists.find(l => l.id === view);
          if (list) {
            all = all.filter(r => list.entityIds.includes(r.id));
          } else {
            all = [];
          }
        }
      }
    }
    return all;
  }, [props.leads, props.accounts, props.contacts, props.customers, search, props.loading, indexes, view, customLists]);

  const unifiedPage = useMemo(() => {
    const totalItems = allUnifiedRecords.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    return {
      items: allUnifiedRecords.slice((page - 1) * pageSize, page * pageSize),
      totalItems,
      page,
      pageSize,
      totalPages,
    };
  }, [allUnifiedRecords, page, pageSize]);

  const unifiedRecords = useMemo(() => allUnifiedRecords.slice((page - 1) * pageSize, page * pageSize), [allUnifiedRecords, page, pageSize]);

  const industries = useMemo(() => Array.from(new Set(props.accounts.map(a => a.industry).filter(Boolean))).sort(), [props.accounts]);

  const ownerName = (uid: string) => props.owners.find(o => o.uid === uid)?.name || '';

  const liveDrawer = useMemo(() => {
    if (!drawer) return null;
    if (drawer.kind === 'lead') {
      const found = props.leads.find(l => l.id === drawer.record.id);
      return found ? { kind: 'lead' as const, record: found } : null;
    }
    if (drawer.kind === 'account') {
      const found = props.accounts.find(a => a.id === drawer.record.id);
      return found ? { kind: 'account' as const, record: found } : null;
    }
    if (drawer.kind === 'contact') {
      const found = props.contacts.find(c => c.id === drawer.record.id);
      return found ? { kind: 'contact' as const, record: found } : null;
    }
    const found = props.customers.find(c => c.id === drawer.record.id);
    return found ? { kind: 'customer' as const, record: found } : null;
  }, [drawer, props.leads, props.accounts, props.contacts, props.customers]);

  const closeForm = () => { setFormOpen(false); setEditing(null); setDefaultAccountId(''); };
  const formKind = editing ? editing.kind : view === 'all' ? 'contact' : view;

  
  const handleDrop = (id: string, type: string, targetTab: string) => {
    const targetType = targetTab.replace('tab-', '');
    if (type === targetType) return;
    
    // Trova il record originale per la conversione
    const record = allUnifiedRecords.find(r => r.id === id && r.type === type);
    if (!record) return;

    if (targetType === 'customer' || targetType === 'lead' || targetType === 'contact') {
       // Trigger conversion by setting drawer or a conversion state
       // UnfractMVP uses openConversion or similar. 
       // In UnifiedContactsSection we don't have openConversion, but we can set up a conversion
       // Actually, we can use the RecordDrawer which has "Trasforma in Cliente" or similar?
       // Wait, UnifiedContactsSection doesn't have a direct "convert" prop, but it has:
       // We can just open the RecordDrawer so the user can click "Trasforma in..."!
       // Or even better, we can open the Create Modal with pre-filled data!
       // But wait, the user wants to CONVERT them.
       // For now, let's open the drawer for that entity, since the drawer has the conversion buttons.
       setDrawer({ kind: type as any, record: record.raw });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <EntityDragDropProvider onDrop={handleDrop} />
      {/* Segmented control for Views */}
      <div className="flex gap-2 border-b border-[#1A1A1A] pb-3 mb-2 items-center overflow-x-auto">
        {(Object.keys(VIEW_LABELS) as string[]).map(v => (
          <button
            key={v}
            data-drop-zone={`tab-${v}`}
            onClick={() => { setView(v); setPage(1); setSelectedIds([]); }}
            className={`h-[32px] flex items-center px-3 text-sm rounded-lg transition-colors whitespace-nowrap ${view === v ? 'bg-white/10 text-white font-medium' : 'text-[#858585] hover:bg-white/5 hover:text-white'}`}
          >
            {VIEW_LABELS[v]}
          </button>
        ))}
        {customLists.map(list => (
          <button
            key={list.id}
            onClick={() => { setView(list.id); setPage(1); setSelectedIds([]); }}
            className={`h-[32px] px-3 text-sm rounded-lg transition-colors whitespace-nowrap flex items-center gap-2 ${view === list.id ? 'bg-white/10 text-white font-medium' : 'text-[#858585] hover:bg-white/5 hover:text-white'}`}
          >
            {list.name}
            <span className="flex items-center justify-center text-[11px] bg-black/40 px-1.5 h-[20px] rounded-md leading-none">{list.entityIds.length}</span>
          </button>
        ))}
        <div className="w-[1px] h-4 bg-[#1A1A1A] mx-1 shrink-0"></div>
        <button
          className="flex items-center justify-center h-[32px] gap-1.5 px-3 text-sm rounded-lg text-[#858585] hover:bg-white/5 hover:text-white transition-colors shrink-0"
          onClick={() => setCreatingList(true)}
          title="Crea Lista Custom"
        >
          <Plus size={16} />
          <span className="text-[13px] leading-none mt-0.5">Lista</span>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 relative">
      {selectedIds.length > 0 && (
        <div className="flex items-center bg-[#0B0B0B] border border-[#1A1A1A] rounded-lg px-2 py-1 mr-2 animate-in fade-in zoom-in-95 duration-200">
          <span className="text-xs text-[#858585] px-2">{selectedIds.length} selezionati</span>
          
          {customLists.length > 0 && (
            <>
              <div className="w-[1px] h-4 bg-[#1A1A1A] mx-1"></div>
              <div className="relative">
                <button
                  onClick={() => setAddToListMenuOpen(!addToListMenuOpen)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white hover:bg-white/5 rounded-md transition-colors"
                >
                  <Plus size={13} />
                  Aggiungi a Lista
                </button>
                {addToListMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setAddToListMenuOpen(false)}></div>
                    <div className="absolute left-0 top-full mt-1 z-50 w-48 rounded-xl border border-[#1A1A1A] bg-[#0B0B0B] p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-200">
                      {customLists.map(list => (
                        <button
                          key={list.id}
                          onClick={() => {
                            if (ctx) {
                              const newIds = Array.from(new Set([...list.entityIds, ...selectedIds]));
                              updateCustomList(ctx, list.id, { entityIds: newIds });
                            }
                            setAddToListMenuOpen(false);
                            setSelectedIds([]);
                          }}
                          className="flex w-full items-center px-3 py-2 text-[13px] text-[#E5E5E5] hover:bg-white/5 rounded-lg transition-colors text-left"
                        >
                          {list.name}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </>
          )}

          <div className="w-[1px] h-4 bg-[#1A1A1A] mx-1"></div>
          <button
            onClick={() => {
              const targets = allUnifiedRecords.filter(r => selectedIds.includes(r.id));
              setDeleteConfirm({ open: true, targets });
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#EF4444] hover:bg-white/5 rounded-md transition-colors"
          >
            <Trash2 size={13} />
            Elimina
          </button>
        </div>
      )}
        <div className="relative min-w-[16rem] flex-1">
          <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5A5A]" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); setSelectedIds([]); }}
            placeholder="Cerca contatti, lead, aziende..."
            className="w-full rounded-full border border-[#1A1A1A] bg-black/30 py-1.5 pl-8 pr-4 text-xs text-white placeholder:text-[#5A5A5A] focus:border-[#2A2A2A] focus:outline-none"
          />
        </div>

        
      </div>

      {props.loading ? (
        <p className="text-sm text-[#858585]">Caricamento…</p>
      ) : (
        <div className="flex flex-col gap-3">
          <UnifiedTable 
            records={unifiedPage.items}
            selectedIds={selectedIds}
            onSelect={(id, checked) => setSelectedIds(prev => checked ? [...prev, id] : prev.filter(x => x !== id))}
            onSelectAll={(checked) => setSelectedIds(checked ? allUnifiedRecords.map(r => r.id) : [])}
            onOpen={(r) => setDrawer({ kind: r.type, record: r.raw })} 
          />
          <Pagination
            page={unifiedPage}
            onPageChange={setPage}
            onPageSizeChange={size => { setPageSize(size); setPage(1); }}
          />
        </div>
      )}

      {liveDrawer && (
        <RecordDrawer
          target={liveDrawer}
          accounts={props.accounts}
          contacts={props.contacts}
          customers={props.customers}
          leads={props.leads}
          history={props.history}
          ownerName={ownerName}
          onClose={() => setDrawer(null)}
          onEdit={() => { setEditing(liveDrawer); setFormOpen(true); }}
          onDelete={() => {
            const targetRecord = allUnifiedRecords.find(u => u.id === liveDrawer.record.id && u.type === liveDrawer.kind);
            if (targetRecord) setDeleteConfirm({ open: true, targets: [targetRecord] });
          }}
          onArchive={() => {
            if (liveDrawer.kind === 'account') props.onArchiveAccount(liveDrawer.record);
            else if (liveDrawer.kind === 'contact') props.onArchiveContact(liveDrawer.record);
            else if (liveDrawer.kind === 'customer') props.onArchiveCustomer(liveDrawer.record);
          }}
          onRestore={() => {
            if (liveDrawer.kind === 'account') props.onRestoreAccount(liveDrawer.record);
            else if (liveDrawer.kind === 'contact') props.onRestoreContact(liveDrawer.record);
            else if (liveDrawer.kind === 'customer') props.onRestoreCustomer(liveDrawer.record);
          }}
          onOpen={target => setDrawer(target)}
          onCompose={contact => setComposing(contact)}
          onUploadDocument={props.onUploadDocument}
          onDownloadDocument={props.onDownloadDocument}
          onQuickFollowup={days => props.onCreateQuickFollowup && props.onCreateQuickFollowup(liveDrawer.record.id, liveDrawer.kind, days)}
          onRemoveCustomer={props.onArchiveCustomer}
          onAddCustomer={accountId => {
            setDefaultAccountId(accountId);
            setDrawer(null);
            setView('customer');
            setFormOpen(true);
          }}
          onConvertLead={lead => props.onConvertLead?.(lead)}
          onAddContact={accountId => {
            setEditing(null);
            setDefaultAccountId(accountId);
            setDrawer(null);
            setView('contact');
            setFormOpen(true);
          }}
        />
      )}

      {formOpen && formKind === 'lead' && (
        <LeadFormModal
          key={editing?.kind === 'lead' ? editing.record.id : 'new-lead'}
          open
          lead={editing?.kind === 'lead' ? editing.record : null}
          owners={props.owners}
          sources={props.sources}
          policyVersion={props.policyVersion}
          saving={props.saving}
          onClose={closeForm}
          onSubmit={values => {
            if (editing?.kind === 'lead') props.onUpdateLead(editing.record.id, values);
            else props.onCreateLead(values);
            closeForm();
          }}
        />
      )}

      {formOpen && formKind === 'account' && (
        <AccountFormModal
          key={editing?.kind === 'account' ? editing.record.id : 'new-account'}
          open
          account={editing?.kind === 'account' ? editing.record : null}
          industries={industries}
          saving={props.saving}
          onClose={closeForm}
          onSubmit={values => {
            if (editing?.kind === 'account') props.onUpdateAccount(editing.record.id, values);
            else props.onCreateAccount(values);
            closeForm();
          }}
        />
      )}

      {formOpen && formKind === 'contact' && (
        <ContactFormModal
          key={editing?.kind === 'contact' ? editing.record.id : `new-contact-${defaultAccountId}`}
          open
          contact={editing?.kind === 'contact' ? editing.record : null}
          accounts={props.accounts}
          defaultAccountId={defaultAccountId}
          policyVersion={props.policyVersion}
          saving={props.saving}
          onClose={closeForm}
          onSubmit={values => {
            if (editing?.kind === 'contact') props.onUpdateContact(editing.record.id, values);
            else props.onCreateContact(values);
            closeForm();
          }}
        />
      )}

      {formOpen && formKind === 'customer' && (
        <CustomerFormModal
          key={editing?.kind === 'customer' ? editing.record.id : 'new-customer'}
          open
          customer={editing?.kind === 'customer' ? editing.record : null}
          accounts={props.accounts}
          contacts={props.contacts}
          defaultAccountId={defaultAccountId}
          saving={props.saving}
          onClose={closeForm}
          onSubmit={values => {
            if (editing?.kind === 'customer') props.onUpdateCustomer(editing.record.id, values);
            else props.onCreateCustomer(values);
            closeForm();
          }}
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
            mittente: props.senderName,
          }}
          optOutAddress={props.optOutAddress}
          optOutReference={composing.id}
          sending={sending}
          onClose={() => setComposing(null)}
          onSend={async email => {
            setSending(true);
            try {
              return await props.onSendEmail(composing, email);
            } finally {
              setSending(false);
            }
          }}
        />
      )}

      {creatingList && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="relative flex w-full max-w-[400px] flex-col overflow-hidden rounded-[24px] border border-[#1A1A1A] bg-[#111111] animate-in fade-in zoom-in-95 duration-200">
            <header className="flex items-center justify-between border-b border-[#1A1A1A] px-6 py-5">
              <h2 className="text-[17px] font-medium text-white">Nuova Lista Custom</h2>
              <button onClick={() => setCreatingList(false)} className="rounded-lg p-1.5 text-[#858585] hover:bg-white/5 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </header>
            <div className="flex flex-col gap-4 p-6">
              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-medium text-white">Nome della lista</label>
                <input
                  autoFocus
                  type="text"
                  value={newListName}
                  onChange={e => setNewListName(e.target.value)}
                  onKeyDown={async e => {
                    if (e.key === 'Enter' && newListName.trim()) {
                      if (ctx) {
                        const id = await createCustomList(ctx, newListName.trim(), []);
                        if (id) setView(id);
                      }
                      setNewListName('');
                      setCreatingList(false);
                    }
                  }}
                  placeholder="Es. Contatti Fiera"
                  className="w-full bg-black border border-[#1A1A1A] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#2A2A2A]"
                />
              </div>
            </div>
            <footer className="flex items-center justify-end gap-3 border-t border-[#1A1A1A] p-4 bg-transparent">
              <button onClick={() => setCreatingList(false)} className="h-10 px-5 text-[14px] font-medium text-[#A3A3A3] hover:text-white transition-colors">
                Annulla
              </button>
              <button 
                disabled={!newListName.trim()}
                onClick={async () => {
                  if (ctx) {
                    const id = await createCustomList(ctx, newListName.trim(), []);
                    if (id) setView(id);
                  }
                  setNewListName('');
                  setCreatingList(false);
                }} 
                className="h-10 px-6 bg-[#006AFF] hover:bg-blue-600 rounded-xl text-[14px] font-medium text-white transition-colors disabled:opacity-50"
              >
                Crea
              </button>
            </footer>
          </div>
        </div>
      )}

      <DeleteConfirmModal
        open={deleteConfirm.open}
        targets={deleteConfirm.targets}
        onClose={() => setDeleteConfirm({ open: false, targets: [] })}
        onConfirm={() => {
          deleteConfirm.targets.forEach(t => {
            if (t.type === 'account') props.onDeleteAccount?.(t.raw);
            else if (t.type === 'contact') props.onDeleteContact?.(t.raw);
            else if (t.type === 'lead') props.onDeleteLead?.(t.raw);
            else props.onDeleteCustomer?.(t.raw);
          });
          setDeleteConfirm({ open: false, targets: [] });
          setSelectedIds([]);
          setDrawer(null);
        }}
      />
    </div>
  );
}

function DeleteConfirmModal({ 
  open, 
  targets, 
  onClose, 
  onConfirm 
}: { 
  open: boolean; 
  targets: UnifiedRecord[]; 
  onClose: () => void; 
  onConfirm: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="relative flex w-full max-w-[340px] flex-col overflow-hidden rounded-[24px] border border-[#1A1A1A] bg-[#111111] animate-in fade-in zoom-in-95 duration-200">
        {/* Motion gradient blob */}
        <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 w-48 h-32 bg-red-600/30 blur-[40px] rounded-full pointer-events-none" />
        
        <div className="flex flex-col items-center gap-4 p-8 pb-6 relative z-10 text-center">
          <div className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[#521414]">
            <Trash2 size={22} className="text-[#EF4444]" />
          </div>
          <h2 className="text-[17px] font-medium text-white">Confirm Deletion</h2>
          <p className="text-[13px] text-[#A3A3A3] leading-relaxed">
            Please confirm that you wish to remove <strong className="text-white font-medium">{targets.length === 1 ? targets[0].name : targets.length + ' contacts'}</strong>. Once deleted, this data cannot be recovered
          </p>
        </div>
        
        <footer className="flex items-center justify-between border-t border-[#1A1A1A] p-4 relative z-10 bg-transparent">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl px-4 py-3 text-[13px] font-medium text-[#858585] hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-[#521414] border border-[#EF4444] px-4 py-3 text-[13px] font-medium text-[#EF4444] hover:bg-[#6A1A1A] transition-colors"
          >
            Delete
          </button>
        </footer>
      </div>
    </div>
  );
}
