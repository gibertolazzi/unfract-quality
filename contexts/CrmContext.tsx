'use client';

import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useProject } from './ProjectContext';
import { CrmContextRef } from '@/lib/crm/base';
import { subscribeToLeads } from '@/lib/crm/leads';
import { subscribeToAccounts } from '@/lib/crm/accounts';
import { subscribeToContacts } from '@/lib/crm/contacts';
import { subscribeToCustomers } from '@/lib/crm/customers';
import { subscribeToOpportunities } from '@/lib/crm/opportunities';
import { subscribeToFollowups } from '@/lib/crm/followups';
import { subscribeToCustomLists } from '@/lib/crm/customLists';
import {
  CrmLead, CrmAccount, CrmContact, CrmCustomer, CrmOpportunity, CrmFollowup, CrmCustomList
} from '@/types/crm';

interface CrmContextType {
  /** Contesto di scrittura da passare a tutte le funzioni di lib/crm. */
  ctx: CrmContextRef | null;

  leads: CrmLead[];
  accounts: CrmAccount[];
  contacts: CrmContact[];
  customers: CrmCustomer[];
  opportunities: CrmOpportunity[];
  followups: CrmFollowup[];
  customLists: CrmCustomList[];
  loading: boolean;

  getAccount: (id?: string) => CrmAccount | null;
  getContact: (id?: string) => CrmContact | null;
  getCustomer: (id?: string) => CrmCustomer | null;
  getLead: (id?: string) => CrmLead | null;
  activate: () => void;
}

const CrmContext = createContext<CrmContextType>({
  ctx: null,
  leads: [],
  accounts: [],
  contacts: [],
  customers: [],
  opportunities: [],
  followups: [],
  customLists: [],
  loading: true,
  getAccount: () => null,
  getContact: () => null,
  getCustomer: () => null,
  getLead: () => null,
  activate: () => {},
});

export const useCrm = () => useContext(CrmContext);

export function CrmProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { activeProject, activeProjectId, loading: projectLoading } = useProject();

  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [accounts, setAccounts] = useState<CrmAccount[]>([]);
  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const [customers, setCustomers] = useState<CrmCustomer[]>([]);
  const [opportunities, setOpportunities] = useState<CrmOpportunity[]>([]);
  const [followups, setFollowups] = useState<CrmFollowup[]>([]);
  const [customLists, setCustomLists] = useState<CrmCustomList[]>([]);
  const [loading, setLoading] = useState(true);
  const [isActive, setIsActive] = useState(false);

  // L'organizzazione viene registrata su ogni record ma non filtra le query
  // (deroga 1, vedi docs/DEROGHE.md).
  const organizationId = activeProject?.organizationIds?.[0] || '';

  const ctx: CrmContextRef | null = useMemo(() => {
    if (!user || !activeProjectId) return null;
    return { projectId: activeProjectId, organizationId, uid: user.uid };
  }, [user, activeProjectId, organizationId]);

  const activate = useCallback(() => setIsActive(true), []);

  useEffect(() => {
    if (!isActive) return;
    if (authLoading || projectLoading) return;

    if (!user || !activeProjectId) {
      setLeads([]);
      setAccounts([]);
      setContacts([]);
      setCustomers([]);
      setOpportunities([]);
      setFollowups([]);
      setCustomLists([]);
      setLoading(false);
      return;
    }

    const unsubscribers = [
      subscribeToLeads(activeProjectId, setLeads, true),
      subscribeToAccounts(activeProjectId, setAccounts, true),
      subscribeToContacts(activeProjectId, setContacts, true),
      subscribeToCustomers(activeProjectId, setCustomers, true),
      subscribeToOpportunities(activeProjectId, setOpportunities, true),
      subscribeToFollowups(activeProjectId, setFollowups, true),
      subscribeToCustomLists(activeProjectId, user.uid, setCustomLists),
    ];

    setLoading(false);

    return () => unsubscribers.forEach(unsubscribe => unsubscribe());
  }, [isActive, user, activeProjectId, authLoading, projectLoading]);

  const getAccount = (id?: string) => accounts.find(a => a.id === id) || null;
  const getContact = (id?: string) => contacts.find(c => c.id === id) || null;
  const getCustomer = (id?: string) => customers.find(c => c.id === id) || null;
  const getLead = (id?: string) => leads.find(l => l.id === id) || null;

  return (
    <CrmContext.Provider value={{
      ctx,
      leads,
      accounts,
      contacts,
      customers,
      opportunities,
      followups,
      customLists,
      loading,
      getAccount,
      getContact,
      getCustomer,
      getLead,
      activate,
    }}>
      {children}
    </CrmContext.Provider>
  );
}
