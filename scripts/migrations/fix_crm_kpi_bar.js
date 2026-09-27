const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/CrmKpiBar.tsx';
fs.writeFileSync(path, `
'use client';

import { useState } from 'react';
import { ChevronDown, AlertTriangle, CalendarClock, CircleDashed } from 'lucide-react';
import {
  CrmLead, CrmAccount, CrmContact, CrmCustomer, CrmOpportunity, CrmFollowup,
} from '@/components/unfract/crm/types';
import {
  LeadState,
  LEAD_STATES, LEAD_STATE_LABELS, LEAD_STATE_COLORS,
  OPPORTUNITY_PHASES, OPPORTUNITY_PHASE_LABELS, OPPORTUNITY_PHASE_COLORS,
  OPPORTUNITY_PHASE_PROBABILITY,
} from '@/components/unfract/crm/constants';

interface CrmKpiBarProps {
  leads: CrmLead[];
  accounts: CrmAccount[];
  contacts: CrmContact[];
  customers: CrmCustomer[];
  opportunities: CrmOpportunity[];
  followups: CrmFollowup[];
  selectedStates?: LeadState[];
  onToggleState?: (state: LeadState) => void;
}

const formatEuro = (n: number) =>
  new Intl.NumberFormat('it-IT', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0, notation: n >= 1_000_000 ? 'compact' : 'standard',
  }).format(n);

const todayISO = () => new Date().toISOString().slice(0, 10);

function Metric({ label, value, increment, title }: { label: string; value: string; increment?: number; title?: string }) {
  const isPositive = increment !== undefined && increment > 0;
  const isNegative = increment !== undefined && increment < 0;
  const isZero = increment === 0;
  
  const glowColor = isPositive ? 'rgba(34, 197, 94, 0.15)' : isNegative ? 'rgba(239, 68, 68, 0.15)' : 'transparent';
  
  return (
    <div title={title} className="relative flex min-w-[160px] flex-1 flex-col gap-1.5 px-6 py-5 border-r border-[#1A1A1A] last:border-r-0 overflow-hidden">
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 blur-[40px] rounded-full pointer-events-none" 
        style={{ backgroundColor: glowColor }}
      />
      <span className="text-[10px] uppercase tracking-wide text-[#5A5A5A] z-10">{label}</span>
      <span className="text-2xl font-semibold leading-none text-white z-10">{value}</span>
      
      {increment !== undefined && (
        <div className="flex items-center gap-1.5 mt-1 z-10">
          <span className={\`flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium \${
            isPositive ? 'bg-green-500/20 text-green-500' :
            isNegative ? 'bg-red-500/20 text-red-500' :
            'bg-white/10 text-white/70'
          }\`}>
            {isPositive ? '↑' : isNegative ? '↓' : ''} {isZero ? 'NA' : \`\${Math.abs(increment)}%\`}
          </span>
          <span className="text-[10px] text-[#5A5A5A]">from last month</span>
        </div>
      )}
    </div>
  );
}

function AlertChip({ Icon, text, color }: { Icon: any; text: string; color: string }) {
  return (
    <span
      className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px]"
      style={{ color, backgroundColor: \`\${color}1A\` }}
    >
      <Icon size={12} />
      {text}
    </span>
  );
}

export function CrmKpiBar({
  leads, accounts, contacts, customers, opportunities, followups,
  selectedStates = [], onToggleState,
}: CrmKpiBarProps) {
  const [open, setOpen] = useState(false);

  const live = <T extends { archived: boolean }>(records: T[]) => records.filter(r => !r.archived);

  const openOpportunities = live(opportunities).filter(o => o.phase !== 'WON' && o.phase !== 'LOST');
  const pipelineValue = openOpportunities.reduce((sum, o) => sum + o.value, 0);

  const forecast = openOpportunities.reduce((sum, o) => {
    const probability = o.probability !== null ? o.probability : OPPORTUNITY_PHASE_PROBABILITY[o.phase];
    return sum + o.value * (probability / 100);
  }, 0);

  const isActiveFollowup = (f: CrmFollowup) => f.state === 'OPEN' || f.state === 'IN_PROGRESS';
  const liveFollowups = live(followups);
  const overdue = liveFollowups.filter(f => isActiveFollowup(f) && f.dueDate && f.dueDate < todayISO());
  const dueToday = liveFollowups.filter(f => isActiveFollowup(f) && f.dueDate === todayISO());

  const activeLeads = live(leads).filter(
    l => l.state !== 'CONVERTED' && l.state !== 'LOST' && l.state !== 'NOT_INTERESTED'
  );
  const noNextAction = activeLeads.filter(l => !l.nextFollowupAt);

  return (
    <section className="rounded-2xl border border-[#1A1A1A] bg-[#0B0B0B]">
      <div className="flex flex-col w-full">
        <div className="flex items-center overflow-x-auto">
          <Metric label="Contatti" value={String(live(contacts).length)} increment={4.9} />
          <Metric label="Aziende" value={String(live(accounts).length)} increment={0} />
          <Metric label="Clienti" value={String(live(customers).length)} increment={-0.9} />
          <Metric label="Opportunità" value={String(openOpportunities.length)} increment={4.9} />
          <Metric label="Tasso di Conversione" value="0%" increment={4.9} />
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-[#1A1A1A] px-5 py-3">
          {overdue.length > 0 && (
            <AlertChip Icon={AlertTriangle} color="#EF4444" text={\`\${overdue.length} in ritardo\`} />
          )}
          {dueToday.length > 0 && (
            <AlertChip Icon={CalendarClock} color="#FFFFFF" text={\`\${dueToday.length} oggi\`} />
          )}
          {noNextAction.length > 0 && (
            <AlertChip Icon={CircleDashed} color="#F59E0B" text={\`\${noNextAction.length} senza azione\`} />
          )}

          <button
            type="button"
            onClick={() => setOpen(v => !v)}
            aria-expanded={open}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-[#858585] transition-colors hover:bg-white/5 hover:text-white ml-auto"
          >
            More Details
            <ChevronDown size={13} className={\`transition-transform \${open ? 'rotate-180' : ''}\`} />
          </button>
        </div>
      </div>

      {open && (
        <div className="flex flex-col gap-3 border-t border-[#1A1A1A] px-5 py-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[10px] uppercase tracking-wide text-[#5A5A5A]">Lead per stato</span>
            {LEAD_STATES.map(state => {
              const count = live(leads).filter(l => l.state === state).length;
              const selected = selectedStates.includes(state);
              const content = (
                <>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: LEAD_STATE_COLORS[state] }} />
                  <span className="text-[11px] text-white">{LEAD_STATE_LABELS[state]}</span>
                  <span className="text-[11px] text-[#858585]">{count}</span>
                </>
              );
              const className = \`flex items-center gap-1.5 rounded-full border px-2 py-0.5 \${
                selected ? 'border-white/40 bg-white/10' : 'border-[#1A1A1A] bg-black/20'
              } \${count === 0 ? 'opacity-40' : ''}\`;

              return onToggleState ? (
                <button
                  key={state}
                  type="button"
                  onClick={() => onToggleState(state)}
                  title="Filtra la lista per questo stato"
                  className={\`\${className} transition-colors hover:border-white/30\`}
                >
                  {content}
                </button>
              ) : (
                <div key={state} className={className}>{content}</div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[10px] uppercase tracking-wide text-[#5A5A5A]">Opportunità per fase</span>
            {OPPORTUNITY_PHASES.map(phase => {
              const inPhase = live(opportunities).filter(o => o.phase === phase);
              const value = inPhase.reduce((sum, o) => sum + o.value, 0);
              return (
                <div
                  key={phase}
                  className={\`flex items-center gap-1.5 rounded-full border border-[#1A1A1A] bg-black/20 px-2 py-0.5 \${
                    inPhase.length === 0 ? 'opacity-40' : ''
                  }\`}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: OPPORTUNITY_PHASE_COLORS[phase] }} />
                  <span className="text-[11px] text-white">{OPPORTUNITY_PHASE_LABELS[phase]}</span>
                  <span className="text-[11px] text-[#858585]">{inPhase.length}</span>
                  {value > 0 && <span className="text-[11px] text-[#5A5A5A]">{formatEuro(value)}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
`, 'utf8');
