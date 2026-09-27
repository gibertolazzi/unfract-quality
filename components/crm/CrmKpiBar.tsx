'use client';

import {
  CrmLead, CrmAccount, CrmContact, CrmCustomer, CrmOpportunity, CrmFollowup, CrmDocument
} from '@/components/crm/types';
import { LeadState } from '@/components/crm/constants';
import { CrmTab } from '@/components/crm/CrmNav';

interface CrmKpiBarProps {
  activeTab: CrmTab;
  leads: CrmLead[];
  accounts: CrmAccount[];
  contacts: CrmContact[];
  customers: CrmCustomer[];
  opportunities: CrmOpportunity[];
  followups: CrmFollowup[];
  documents?: CrmDocument[];
  selectedStates?: LeadState[];
  onToggleState?: (state: LeadState) => void;
}

const formatEuro = (n: number) =>
  new Intl.NumberFormat('it-IT', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0, notation: n >= 1_000_000 ? 'compact' : 'standard',
  }).format(n);

function getMillis(t: any) {
  if (!t) return 0;
  if (typeof t === 'string') return new Date(t).getTime();
  if (t.toMillis) return t.toMillis();
  if (t.seconds) return t.seconds * 1000;
  return 0;
}

function calculateIncrement(items: any[]): number {
  const now = Date.now();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  
  let currentMonthCount = 0;
  let lastMonthCount = 0;
  
  items.forEach(item => {
    const time = getMillis(item.createdAt);
    if (time === 0) return;
    
    if (now - time <= thirtyDays) {
      currentMonthCount++;
    } else if (now - time <= thirtyDays * 2) {
      lastMonthCount++;
    }
  });

  if (lastMonthCount === 0) return currentMonthCount === 0 ? 0 : 100;
  return Number((((currentMonthCount - lastMonthCount) / lastMonthCount) * 100).toFixed(1));
}

function Metric({ label, value, increment, title, neutralValue = false }: { label: string; value: string | number; increment?: number; title?: string; neutralValue?: boolean }) {
  const isPositive = increment !== undefined && increment > 0;
  const isNegative = increment !== undefined && increment < 0;
  const isZero = increment === 0;
  
  const glowColor = neutralValue ? 'transparent' : isPositive ? 'rgba(34, 197, 94, 0.15)' : isNegative ? 'rgba(239, 68, 68, 0.15)' : 'transparent';
  
  return (
    <div title={title} className="relative flex min-w-[160px] flex-1 flex-col gap-1.5 px-6 py-5 rounded-2xl border border-[#1A1A1A] bg-[#0B0B0B] overflow-hidden">
      <div 
        className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 blur-[40px] rounded-full pointer-events-none" 
        style={{ backgroundColor: glowColor }}
      />
      <span className="text-[10px] uppercase tracking-wide text-[#5A5A5A] z-10">{label}</span>
      <span className="text-2xl font-semibold leading-none text-white z-10">{value}</span>
      
      {increment !== undefined ? (
        <div className="flex items-center gap-1.5 mt-1 z-10">
          <span className={`flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium ${
            neutralValue ? 'bg-white/10 text-white/70' :
            isPositive ? 'bg-green-500/20 text-green-500' :
            isNegative ? 'bg-red-500/20 text-red-500' :
            'bg-white/10 text-white/70'
          }`}>
            {neutralValue ? '' : isPositive ? '↑' : isNegative ? '↓' : ''} {isZero ? 'NA' : `${Math.abs(increment)}%`}
          </span>
          <span className="text-[10px] text-[#5A5A5A]">from last month</span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 mt-1 z-10 opacity-0 pointer-events-none select-none">
          <span className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium">
            0%
          </span>
          <span className="text-[10px]">from last month</span>
        </div>
      )}
    </div>
  );
}

export function CrmKpiBar({
  activeTab, leads, accounts, contacts, customers, opportunities, followups, documents = [],
}: CrmKpiBarProps) {

  const live = <T extends { archived: boolean }>(records: T[]) => records.filter(r => !r.archived);

  // Common active counts
  const liveLeads = live(leads);
  const liveContacts = live(contacts);
  const liveAccounts = live(accounts);
  const liveCustomers = live(customers);
  const liveOpps = live(opportunities);
  const liveFollowups = live(followups);
  const liveDocs = live(documents);

  // Tab: Contatti & Aziende
  const leadsCount = liveLeads.length;
  
  // Tab: Opportunità & Pipeline
  const openOpps = liveOpps.filter(o => o.phase !== 'WON' && o.phase !== 'LOST');
  const pipelineValue = openOpps.reduce((sum, o) => sum + o.value, 0);
  const wonOpps = liveOpps.filter(o => o.phase === 'WON');
  const winRate = liveOpps.length > 0 ? (wonOpps.length / liveOpps.length) * 100 : 0;
  const inTrattativaOpps = liveOpps.filter(o => o.phase === 'NEGOTIATION'); 
  const inTrattativaValue = inTrattativaOpps.reduce((sum, o) => sum + o.value, 0);

  // Tab: Follow up
  const fattiCount = liveFollowups.filter(f => f.state === 'DONE').length;
  const daFareCount = liveFollowups.filter(f => f.state !== 'DONE' && f.state !== 'CANCELLED').length;
  
  // calculate avg response time (Tempo Follow up)
  const completedFollowups = liveFollowups.filter(f => f.state === 'DONE' && f.completedAt && f.createdAt);
  const totalResponseTimeMs = completedFollowups.reduce((acc, f) => {
    return acc + (getMillis(f.completedAt) - getMillis(f.createdAt));
  }, 0);
  const avgResponseTimeDays = completedFollowups.length > 0 
    ? (totalResponseTimeMs / completedFollowups.length) / (1000 * 60 * 60 * 24)
    : 0;
  
  // calculate Follow up per Close
  const followupsPerWon = wonOpps.length > 0 
    ? liveFollowups.filter(f => f.opportunityId && wonOpps.some(o => o.id === f.opportunityId)).length / wonOpps.length
    : 0;

  // Tab: Riepilogo
  const entityCount = liveContacts.length + liveAccounts.length;
  const entrateValue = wonOpps.reduce((sum, o) => sum + o.value, 0);

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center gap-4 w-full">
        {activeTab === 'contact' && (
          <>
            <Metric label="Contatti" value={String(liveContacts.length + liveLeads.length)} increment={calculateIncrement(liveContacts)} />
            <Metric label="Lead" value={String(leadsCount)} increment={calculateIncrement(liveLeads)} />
            <Metric label="Aziende" value={String(liveAccounts.length)} increment={calculateIncrement(liveAccounts)} />
            <Metric label="Clienti" value={String(liveCustomers.length)} increment={calculateIncrement(liveCustomers)} />
          </>
        )}

        {activeTab === 'opportunity' && (
          <>
            <Metric label="Opportunità" value={String(openOpps.length)} increment={calculateIncrement(openOpps)} />
            <Metric label="Pipeline" value={formatEuro(pipelineValue)} increment={calculateIncrement(openOpps)} />
            <Metric label="Tasso di Conversione" value={`${winRate.toFixed(1)}%`} neutralValue />
            <Metric label="In Trattativa" value={formatEuro(inTrattativaValue)} neutralValue />
          </>
        )}

        {activeTab === 'followup' && (
          <>
            <Metric label="Follow up Fatti" value={String(fattiCount)} increment={calculateIncrement(liveFollowups.filter(f => f.state === 'DONE'))} />
            <Metric label="Follow up Da Fare" value={String(daFareCount)} increment={calculateIncrement(liveFollowups.filter(f => f.state !== 'DONE'))} />
            <Metric label="Tempo Follow up" value={avgResponseTimeDays > 0 ? `${avgResponseTimeDays.toFixed(1)} gg` : '0 gg'} neutralValue />
            <Metric label="Follow up per Close" value={String(followupsPerWon.toFixed(1))} neutralValue />
          </>
        )}

        {activeTab === 'dashboard' && (
          <>
            <Metric label="Entità" value={String(entityCount)} increment={calculateIncrement([...liveContacts, ...liveAccounts])} />
            <Metric label="Entrate" value={formatEuro(entrateValue)} increment={calculateIncrement(wonOpps)} />
            <Metric label="Follow up Totali" value={String(liveFollowups.length)} neutralValue />
            <Metric label="Documenti" value={String(liveDocs.length)} neutralValue />
          </>
        )}
      </div>
    </div>
  );
}
