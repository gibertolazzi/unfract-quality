import { useTranslation } from '@/contexts/TranslationContext';
import { useState } from 'react';
import { useCrm } from '@/contexts/CrmContext';
import { useToast } from '@/contexts/ToastContext';
import { useProject } from '@/contexts/ProjectContext';
import { UnifiedContactsSection } from '@/components/crm/contatti/UnifiedContactsSection';
import { ConversionModal } from '@/components/crm/conversione/ConversionModal';
import { ContactFormModal } from '@/components/crm/anagrafica/ContactFormModal';
import { AccountFormModal } from '@/components/crm/anagrafica/AccountFormModal';
import { LeadFormModal } from '@/components/crm/leads/LeadFormModal';
import { CustomerFormModal } from '@/components/crm/anagrafica/CustomerFormModal';
import { ImportModal } from '@/components/crm/import/ImportModal';
import { CrmLead, CrmAccount, CrmContact, CrmCustomer, CrmOpportunity } from '@/components/crm/types';
import { OwnerOption } from '@/components/crm/leads/LeadFiltersBar';
import { createLead, updateLead, changeLeadState, assignLead, archiveLead, deleteLead, InvalidTransitionError } from '@/lib/crm/leads';
import { createAccount, updateAccount, archiveAccount, restoreAccount, deleteAccount } from '@/lib/crm/accounts';
import { createContact, updateContact, archiveContact, restoreContact, deleteContact } from '@/lib/crm/contacts';
import { createCustomer, updateCustomer, archiveCustomer, restoreCustomer, deleteCustomer } from '@/lib/crm/customers';
import { convertLead, countHistory, ConversionProposal } from '@/lib/crm/conversion';
import { getInteractions } from '@/lib/crm/interactions';
import { getFollowups, createFollowup } from '@/lib/crm/followups';
import { getDocuments, recordDocumentDownload } from '@/lib/crm/documents';
import { getCommunications } from '@/lib/crm/communications';
import { sendCrmEmail } from '@/lib/crm/emailSend';
import { runImport, rollbackImport } from '@/lib/crm/import/run';
import { uploadDocument, DocumentTarget } from '@/lib/crm/documentUpload';

export interface CrmContactsPageProps {
  leads: CrmLead[];
  accounts: CrmAccount[];
  contacts: CrmContact[];
  customers: CrmCustomer[];
  opportunities: CrmOpportunity[];
  owners: OwnerOption[];
  history: any;
  sources: string[];
  loading: boolean;
  policyVersion: string;
  optOutAddress: string;
  senderName: string;
  createModal: 'contact' | 'account' | 'lead' | 'customer' | null;
  onCloseModal: () => void;
  importOpen: boolean;
  onCloseImport: () => void;
  userUid: string;
}

export function CrmContactsPage({
  leads, accounts, contacts, customers, owners, history, sources,
  loading, policyVersion, optOutAddress, senderName,
  createModal, onCloseModal, importOpen, onCloseImport, userUid,
}: CrmContactsPageProps) {
  const { t } = useTranslation();
  const { ctx } = useCrm();
  const toast = useToast();
  const { activeProjectId } = useProject();

  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState<CrmLead | null>(null);
  const [conversionRunning, setConversionRunning] = useState(false);
  const [historyRecords, setHistoryRecords] = useState<{
    interactions: any[]; followups: any[]; documents: any[]; communications: any[];
  } | null>(null);

  const documentUploader = (target: DocumentTarget) =>
    async (file: File, onProgress: (percent: number) => void) => {
      const outcome = await uploadDocument(ctx!, file, { target }, onProgress);
      if (outcome.error) toast.error(`${outcome.fileName}: ${outcome.error}`);
      return outcome;
    };

  const handleDownloadDocument = (document: any, version?: any) => {
    const url = version?.downloadUrl || document.downloadUrl;
    if (!url) {
      toast.error(t.crm.noFileLinked);
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
    if (ctx) recordDocumentDownload(ctx, document.id);
  };

  const openConversion = async (lead: CrmLead) => {
    setConverting(lead);
    setHistoryRecords(null);
    if (!activeProjectId) return;
    const [interactions, followupRecords, documents, communications] = await Promise.all([
      getInteractions(activeProjectId),
      getFollowups(activeProjectId),
      getDocuments(activeProjectId),
      getCommunications(activeProjectId),
    ]);
    setHistoryRecords({ interactions, followups: followupRecords, documents, communications });
  };

  const handleConvert = async (lead: CrmLead, proposal: ConversionProposal) => {
    const records = historyRecords || { interactions: [], followups: [], documents: [], communications: [] };
    setConversionRunning(true);
    try {
      const outcome = await convertLead(ctx!, lead, proposal, records);
      if (outcome.errors.length === 0) toast.success(t.crm.leadConverted);
      else toast.error(t.crm.conversionFailed);
      return outcome;
    } finally {
      setConversionRunning(false);
    }
  };

  const emptyHistory = { interactions: 0, followups: 0, documents: 0, communications: 0, total: 0 };

  const handleStateChange = async (lead: CrmLead, next: any) => {
    if (!ctx) return;
    if (next === 'CONVERTED') {
      await openConversion(lead);
      return;
    }
    try {
      await changeLeadState(ctx, lead.id, next);
      toast.success(t.crm.statusUpdated);
    } catch (error) {
      if (error instanceof InvalidTransitionError) toast.error(error.message);
      else toast.error(t.crm.statusUpdateFailed);
    }
  };

  const handleCreateQuickFollowup = async (targetId: string, kind: string, days?: number) => {
    if (days === undefined) return;
    const d = new Date();
    d.setDate(d.getDate() + days);
    const dueDate = d.toISOString();

    let title = "Follow-up";
    if (kind === 'lead') {
      const l = leads.find(x => x.id === targetId);
      if (l) title = `Richiamare ${l.fullName || l.companyName || 'Lead'}`;
    } else if (kind === 'contact') {
      const c = contacts.find(x => x.id === targetId);
      if (c) title = `Richiamare ${c.fullName || 'Contatto'}`;
    } else if (kind === 'customer') {
      const c = customers.find(x => x.id === targetId);
      if (c) title = `Richiamare ${(c as any).companyName || 'Cliente'}`;
    } else if (kind === 'account') {
      const a = accounts.find(x => x.id === targetId);
      if (a) title = `Contattare ${a.displayName || a.legalName || 'Azienda'}`;
    }

    try {
      toast.success('Follow-up impostato correttamente');
      await createFollowup(ctx!, {
        type: 'call', title, notes: '', assigneeUid: userUid, priority: 'MEDIUM',
        dueDate, state: 'OPEN', leadId: kind === 'lead' ? targetId : '',
        contactId: kind === 'contact' ? targetId : '', customerId: kind === 'customer' ? targetId : '',
        opportunityId: '', createdFrom: 'manual',
      } as any);
    } catch (e: any) {
      toast.error('Errore creazione follow-up');
    }
  };

  return (
    <>
      <UnifiedContactsSection
        onCreateQuickFollowup={handleCreateQuickFollowup}
        accounts={accounts}
        contacts={contacts}
        customers={customers}
        leads={leads}
        owners={owners}
        history={history}
        sources={sources}
        policyVersion={policyVersion}
        optOutAddress={optOutAddress}
        senderName={senderName}
        loading={loading}
        saving={saving}
        onCreateAccount={async v => { if (ctx) { const r = await createAccount(ctx, v); toast.success(r.duplicates.length > 0 ? 'Azienda creata: possibili duplicati segnalati' : t.crm.accountCreated); } }}
        onUpdateAccount={(id, v) => updateAccount(ctx!, id, v)}
        onArchiveAccount={a => { archiveAccount(ctx!, a.id); toast.info(t.crm.accountArchived); }}
        onDeleteAccount={a => { deleteAccount(ctx!, a.id); toast.info(t.crm.accountDeleted); }}
        onRestoreAccount={a => { restoreAccount(ctx!, a.id); toast.info(t.crm.accountRestored); }}
        onCreateContact={async v => { if (ctx) { const r = await createContact(ctx, v); toast.success(r.duplicates.length > 0 ? 'Contatto creato: possibili duplicati segnalati' : t.crm.contactCreated); } }}
        onUpdateContact={(id, v) => updateContact(ctx!, id, v)}
        onArchiveContact={c => { archiveContact(ctx!, c.id); toast.info(t.crm.contactArchived); }}
        onDeleteContact={c => { deleteContact(ctx!, c.id); toast.info(t.crm.contactDeleted); }}
        onRestoreContact={c => { restoreContact(ctx!, c.id); toast.info(t.crm.contactRestored); }}
        onCreateCustomer={async v => { if (ctx) { const id = await createCustomer(ctx, v); if (id) toast.success(t.crm.customerCreated); else toast.error(t.crm.creationFailed); } }}
        onUpdateCustomer={(id, v) => updateCustomer(ctx!, id, v)}
        onArchiveCustomer={c => { archiveCustomer(ctx!, c.id); toast.info(t.crm.customerArchived); }}
        onDeleteCustomer={c => { deleteCustomer(ctx!, c.id); toast.info(t.crm.customerDeleted); }}
        onRestoreCustomer={c => { restoreCustomer(ctx!, c.id); toast.info(t.crm.customerRestored); }}
        onCreateLead={async v => { if (!ctx) return; setSaving(true); try { const r = await createLead(ctx, { ...v, ownerUid: v.ownerUid || ctx.uid }); if (r.id) { toast.success(r.duplicates.length > 0 ? 'Lead creato: duplicati' : t.crm.leadCreated); } else toast.error(t.crm.error); } finally { setSaving(false); } }}
        onUpdateLead={async (id, v) => { if (!ctx) return; setSaving(true); try { await updateLead(ctx, id, v as any); toast.success(t.crm.leadUpdated); } finally { setSaving(false); } }}
        onArchiveLead={l => { archiveLead(ctx!, l.id); toast.info(t.crm.leadArchived); }}
        onDeleteLead={l => { deleteLead(ctx!, l.id); toast.info(t.crm.leadDeleted); }}
        onRestoreLead={() => {}}
        onChangeLeadState={handleStateChange}
        onAssignLead={async (l, uid) => { if (!ctx) return; await assignLead(ctx, l.id, uid); toast.success(uid ? 'Assegnato' : 'Assegnazione rimossa'); }}
        onUploadDocument={documentUploader}
        onDownloadDocument={handleDownloadDocument}
        onSendEmail={async (c, e) => { const r = await sendCrmEmail(ctx!, { toEmail: c.email, toContactId: c.id, subject: e.subject, text: e.text, html: e.html, templateId: e.templateId, templateVars: e.templateVars }); if (r.sent) toast.success('Email inviata'); else toast.error(r.error || 'Errore invio'); return r; }}
      />
      
      {importOpen && ctx && (
        <ImportModal
          open={importOpen} owners={owners} defaultOwnerUid={userUid} existing={{ leads, accounts, contacts }}
          policyVersion={policyVersion} onClose={onCloseImport}
          onRun={(plan, options, onProgress) => runImport(ctx, plan, options, onProgress)}
          onRollback={(entity, outcome) => rollbackImport(ctx, entity, outcome)}
        />
      )}

      {converting && ctx && (
        <ConversionModal
          lead={converting} accounts={accounts} contacts={contacts} customers={customers}
          history={historyRecords ? countHistory(converting.id, historyRecords.interactions, historyRecords.followups, historyRecords.documents, historyRecords.communications) : emptyHistory}
          converting={conversionRunning} onClose={() => { setConverting(null); setHistoryRecords(null); }}
          onConvert={proposal => handleConvert(converting, proposal)}
        />
      )}

      {createModal === 'contact' && <ContactFormModal open contact={null} accounts={accounts} defaultAccountId="" policyVersion={policyVersion} saving={saving} onClose={onCloseModal} onSubmit={async v => { if (ctx) { const r = await createContact(ctx, v); toast.success(r.duplicates.length > 0 ? 'Contatto creato: duplicati' : t.crm.contactCreated); } onCloseModal(); }} />}
      {createModal === 'account' && <AccountFormModal open account={null} industries={[]} saving={saving} onClose={onCloseModal} onSubmit={async v => { if (ctx) { const r = await createAccount(ctx, v); toast.success(r.duplicates.length > 0 ? 'Azienda creata: duplicati' : t.crm.accountCreated); } onCloseModal(); }} />}
      {createModal === 'lead' && <LeadFormModal open lead={null} owners={owners} sources={sources} policyVersion={policyVersion} saving={saving} onClose={onCloseModal} onSubmit={async v => { if (ctx) { setSaving(true); try { await createLead(ctx, { ...v, ownerUid: v.ownerUid || ctx.uid }); toast.success(t.crm.leadCreated); } finally { setSaving(false); } } onCloseModal(); }} />}
      {createModal === 'customer' && <CustomerFormModal open customer={null} accounts={accounts} contacts={contacts} defaultAccountId="" saving={saving} onClose={onCloseModal} onSubmit={async v => { if (ctx) { await createCustomer(ctx, v); toast.success(t.crm.customerCreated); } onCloseModal(); }} />}
    </>
  );
}
