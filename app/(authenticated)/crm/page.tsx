'use client';

import { useMemo, useState, useEffect } from 'react';
import { PlusCircle, Upload } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useProject } from '@/contexts/ProjectContext';
import { useCrm } from '@/contexts/CrmContext';
import { CrmNav, CrmTab } from '@/components/crm/CrmNav';
import { CrmKpiBar } from '@/components/crm/CrmKpiBar';
import { OwnerOption } from '@/components/crm/leads/LeadFiltersBar';
import { useCrmHistory } from '@/hooks/useCrmHistory';

import {
  CrmContactsPage,
  CrmOpportunitiesPage,
  CrmFollowupsPage,
  CrmSummaryPage
} from '@/components/crm/pages';

import { LeadState } from '@/components/crm/constants';

const PRIVACY_POLICY_VERSION = '2026-09';
const OPT_OUT_ADDRESS = 'privacy@unfract.com';

export default function CrmPage() {
  const { user } = useAuth();
  const { organizations } = useOrganization();
  const { activeProject, activeProjectId } = useProject();
  
  const {
    leads, accounts, contacts, customers, opportunities, followups, loading, activate
  } = useCrm();

  useEffect(() => {
    activate();
  }, [activate]);

  const [tab, setTab] = useState<CrmTab>('contact');
  const [createModal, setCreateModal] = useState<'contact' | 'account' | 'lead' | 'customer' | 'opportunity' | 'followup' | 'file' | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [statesFilter, setStatesFilter] = useState<LeadState[]>([]);

  const { interactions, communications, documents } = useCrmHistory(activeProjectId);
  const history = useMemo(
    () => ({ interactions, followups, communications, documents }),
    [interactions, followups, communications, documents]
  );

  const owners: OwnerOption[] = useMemo(() => {
    const projectOrgIds = activeProject?.organizationIds || [];
    const map = new Map<string, OwnerOption>();
    organizations
      .filter(org => projectOrgIds.length === 0 || projectOrgIds.includes(org.id))
      .forEach(org => {
        (org.members || []).forEach(member => {
          map.set(member.uid, { uid: member.uid, name: member.displayName || member.email });
        });
      });
    if (user && !map.has(user.uid)) {
      map.set(user.uid, { uid: user.uid, name: user.displayName || user.email || 'Io' });
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'it'));
  }, [organizations, activeProject, user]);

  const sources = useMemo(
    () => Array.from(new Set(leads.map(l => l.source).filter(Boolean))).sort(),
    [leads]
  );

  const toggleState = (state: LeadState) => {
    setStatesFilter(prev => 
      prev.includes(state) ? prev.filter(s => s !== state) : [...prev, state]
    );
  };

  if (!activeProjectId) {
    return <p className="text-sm text-[#858585]">Seleziona un progetto per usare il CRM.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <CrmNav
          active={tab}
          onChange={setTab}
          counts={{
            contact: contacts.filter(c => !c.archived).length + 
                     leads.filter(l => !l.archived).length + 
                     accounts.filter(a => !a.archived).length + 
                     customers.filter(c => !c.archived).length,
            opportunity: opportunities.filter(o => !o.archived).length,
            followup: followups.filter(f => !f.archived).length,
          }}
        />
        
        <div className="flex items-center gap-3">
          {['contact', 'opportunity'].includes(tab) && (
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-white/10"
            >
              <Upload size={16} />
              Import
            </button>
          )}
          
          {tab === 'contact' && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setAddMenuOpen(!addMenuOpen)}
                className="flex items-center gap-2 px-4 py-2 bg-[#002451] border border-[#003B80] text-[#00A6FF] rounded-full font-medium transition-colors hover:bg-[#003B80]/80 text-sm"
              >
                <PlusCircle size={16} />
                New Contact
              </button>
              {addMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setAddMenuOpen(false)}></div>
                  <div className="absolute right-0 top-12 z-50 w-48 rounded-xl border border-[#1A1A1A] bg-[#0B0B0B] p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-200">
                    <button onClick={() => { setCreateModal('account'); setAddMenuOpen(false); }} className="flex w-full items-center px-3 py-2 text-[13px] text-[#E5E5E5] hover:bg-white/5 rounded-lg transition-colors">Azienda</button>
                    <button onClick={() => { setCreateModal('contact'); setAddMenuOpen(false); }} className="flex w-full items-center px-3 py-2 text-[13px] text-[#E5E5E5] hover:bg-white/5 rounded-lg transition-colors">Contatto</button>
                    <button onClick={() => { setCreateModal('lead'); setAddMenuOpen(false); }} className="flex w-full items-center px-3 py-2 text-[13px] text-[#E5E5E5] hover:bg-white/5 rounded-lg transition-colors">Lead</button>
                    <button onClick={() => { setCreateModal('customer'); setAddMenuOpen(false); }} className="flex w-full items-center px-3 py-2 text-[13px] text-[#E5E5E5] hover:bg-white/5 rounded-lg transition-colors">Cliente</button>
                  </div>
                </>
              )}
            </div>
          )}
          {tab === 'opportunity' && (
            <button
              type="button"
              onClick={() => setCreateModal('opportunity')}
              className="flex items-center gap-2 px-4 py-2 bg-[#002451] border border-[#003B80] text-[#00A6FF] rounded-full font-medium transition-colors hover:bg-[#003B80]/80 text-sm"
            >
              <PlusCircle size={16} />
              New Opportunity
            </button>
          )}
          {tab === 'followup' && (
            <button
              type="button"
              onClick={() => setCreateModal('followup')}
              className="flex items-center gap-2 px-4 py-2 bg-[#002451] border border-[#003B80] text-[#00A6FF] rounded-full font-medium transition-colors hover:bg-[#003B80]/80 text-sm"
            >
              <PlusCircle size={16} />
              New Follow up
            </button>
          )}
        </div>
      </header>

      <CrmKpiBar
        activeTab={tab}
        leads={leads}
        accounts={accounts}
        contacts={contacts}
        customers={customers}
        opportunities={opportunities}
        followups={followups}
        documents={documents}
        selectedStates={statesFilter}
        onToggleState={toggleState}
      />

      {tab === 'dashboard' && (
        <CrmSummaryPage
          leads={leads}
          accounts={accounts}
          contacts={contacts}
          customers={customers}
          opportunities={opportunities}
          documents={documents}
          owners={owners}
          loading={loading}
        />
      )}
      
      {tab === 'contact' && (
        <CrmContactsPage
          leads={leads}
          accounts={accounts}
          contacts={contacts}
          customers={customers}
          opportunities={opportunities}
          owners={owners}
          history={history}
          sources={sources}
          loading={loading}
          policyVersion={PRIVACY_POLICY_VERSION}
          optOutAddress={OPT_OUT_ADDRESS}
          senderName={user?.displayName || user?.email || ''}
          userUid={user?.uid || ''}
          createModal={['contact', 'account', 'lead', 'customer'].includes(createModal as string) ? (createModal as any) : null}
          onCloseModal={() => setCreateModal(null)}
          importOpen={importOpen}
          onCloseImport={() => setImportOpen(false)}
        />
      )}

      {tab === 'opportunity' && (
        <CrmOpportunitiesPage
          opportunities={opportunities}
          customers={customers}
          accounts={accounts}
          leads={leads}
          owners={owners}
          history={history}
          loading={loading}
          createModal={createModal === 'opportunity' ? 'opportunity' : null}
          onCloseModal={() => setCreateModal(null)}
        />
      )}

      {tab === 'followup' && (
        <CrmFollowupsPage
          followups={followups}
          leads={leads}
          customers={customers}
          accounts={accounts}
          opportunities={opportunities}
          owners={owners}
          currentUid={user?.uid || ''}
          loading={loading}
          createModal={createModal === 'followup' ? 'followup' : null}
          onCloseModal={() => setCreateModal(null)}
        />
      )}
    </div>
  );
}