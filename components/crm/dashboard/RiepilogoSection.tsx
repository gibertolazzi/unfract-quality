'use client';

import { getLeadStateLabel, getOppPhaseLabel, getFollowupStateLabel, getFollowupTypeLabel, getPriorityLabel, getInteractionTypeLabel, getEmailStateLabel, getCustomerStatusLabel } from '@/components/crm/shared/labels';
import { useTranslation } from '@/contexts/TranslationContext';
import { Folder, Folders, CheckCircle2, DollarSign } from 'lucide-react';
import { CrmAccount, CrmContact, CrmDocument, CrmLead, CrmOpportunity } from '@/components/crm/types';
import { Folder as FolderInteraction } from '@/components/ui/folder-components';
import { FileText } from 'lucide-react';
import { LEAD_STATES, OPPORTUNITY_PHASES } from '@/components/crm/constants';
import { formatEuro } from '../shared/TableUtils';

interface RiepilogoSectionProps {
  accounts: CrmAccount[];
  documents: CrmDocument[];
  leads: CrmLead[];
  opportunities: CrmOpportunity[];
  onFolderClick: (accountId: string) => void;
}

export function RiepilogoSection({
  accounts, documents, leads, opportunities, onFolderClick
}: RiepilogoSectionProps) {
  const { t } = useTranslation();

  const liveAccounts = accounts.filter(a => !a.archived);
  const liveDocs = documents.filter(d => !d.archived);
  const liveLeads = leads.filter(l => !l.archived);
  const liveOpps = opportunities.filter(o => !o.archived);

  // Group documents by account
  const docsByAccount = new Map<string, number>();
  liveDocs.forEach(d => {
    if (d.accountId) {
      docsByAccount.set(d.accountId, (docsByAccount.get(d.accountId) || 0) + 1);
    }
  });

  const folders = liveAccounts
    .filter(a => docsByAccount.get(a.id) || 0 > 0)
    .sort((a, b) => (docsByAccount.get(b.id) || 0) - (docsByAccount.get(a.id) || 0));

  // Lead per stato
  const leadStats = LEAD_STATES.map(state => ({
    state,
    label: getLeadStateLabel(state, t),
    count: liveLeads.filter(l => l.state === state).length
  }));

  // Opportunità per fase e valore
  const oppStats = OPPORTUNITY_PHASES.map(phase => {
    const oppsInPhase = liveOpps.filter(o => o.phase === phase);
    return {
      phase,
      label: getOppPhaseLabel(phase, t),
      count: oppsInPhase.length,
      value: oppsInPhase.reduce((sum, o) => sum + o.value, 0)
    };
  });

  return (
    <div className="flex flex-col gap-8">
      {/* Smart Folders Documentali */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-lg font-medium text-white">Documentazione</h2>
        </div>
        <div className="flex flex-wrap gap-4 overflow-x-auto pb-2">
          {folders.length === 0 ? (
            <p className="text-sm text-[#858585]">Nessun documento associato ad aziende.</p>
          ) : (
            folders.map(account => {
              const docCount = docsByAccount.get(account.id) || 0;
              return (
                <div key={account.id} className="shrink-0 flex flex-col items-center gap-3 cursor-pointer group" onClick={() => onFolderClick(account.id)}>
                  <FolderInteraction 
                    label={account.displayName || account.legalName || t.crm.unnamed}
                    color="blue"
                    size="lg"
                  />
                  <div className="flex flex-col items-center gap-1 opacity-60 transition-opacity group-hover:opacity-100">
                    <span className="text-white/50 text-[11px] flex items-center gap-1">
                      <FileText size={12} /> {docCount} {docCount === 1 ? "documento" : "documenti"}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Mini Widget Analitici */}
      <section>
        <h2 className="text-lg font-medium text-white mb-4">Analitiche</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Lead per stato */}
          <div className="rounded-2xl border border-[#1A1A1A] bg-[#0B0B0B] p-5">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 size={16} className="text-[#858585]" />
              <h3 className="text-[13px] font-medium text-white">{t.crm.leadsByStatus}</h3>
            </div>
            <div className="flex flex-col gap-2">
              {leadStats.map(stat => (
                <div key={stat.state} className="flex items-center justify-between border-b border-[#1A1A1A] pb-2 last:border-0 last:pb-0">
                  <span className="text-xs text-[#858585]">{stat.label}</span>
                  <span className="text-xs font-medium text-white">{stat.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Opportunità per fase e valore */}
          <div className="rounded-2xl border border-[#1A1A1A] bg-[#0B0B0B] p-5">
            <div className="flex items-center gap-2 mb-4">
              <DollarSign size={16} className="text-[#858585]" />
              <h3 className="text-[13px] font-medium text-white">Opportunità per fase</h3>
            </div>
            <div className="flex flex-col gap-2">
              {oppStats.map(stat => (
                <div key={stat.phase} className="flex items-center justify-between border-b border-[#1A1A1A] pb-2 last:border-0 last:pb-0">
                  <span className="text-xs text-[#858585]">{stat.label}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-[#5A5A5A]">{stat.count} deal</span>
                    <span className="text-xs font-medium text-white min-w-[70px] text-right">{formatEuro(stat.value)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
