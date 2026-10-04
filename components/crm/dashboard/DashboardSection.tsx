'use client';

import { getLeadStateLabel, getOppPhaseLabel, getFollowupStateLabel, getFollowupTypeLabel, getPriorityLabel, getInteractionTypeLabel, getEmailStateLabel, getCustomerStatusLabel } from '@/components/crm/shared/labels';
import { useTranslation } from '@/contexts/TranslationContext';
import { useMemo } from 'react';
import { Phone, Users, Mail, FileText, CalendarClock, Activity, StickyNote, MessageSquare } from 'lucide-react';
import {
  CrmLead, CrmAccount, CrmCustomer, CrmOpportunity, CrmFollowup,
  CrmInteraction, CrmCommunication, CrmDocument,
} from '@/components/crm/types';
import {
  LeadState,
  OPPORTUNITY_PHASE_COLORS,
  PRIORITY_COLORS,
} from '@/components/crm/constants';
import { buildDashboard, MISSING_WIDGETS, todayISO } from '@/lib/crm/dashboard';
import { TimelineKind, TIMELINE_KIND_COLORS } from '@/lib/crm/timeline';
import { FollowupView } from '@/lib/crm/followupFilters';
import { formatEuro, formatDate } from '../shared/TableUtils';
import { WidgetCard, MissingWidgetCard, EmptyLine } from './WidgetCard';

interface DashboardSectionProps {
  leads: CrmLead[];
  accounts: CrmAccount[];
  customers: CrmCustomer[];
  opportunities: CrmOpportunity[];
  followups: CrmFollowup[];
  interactions: CrmInteraction[];
  communications: CrmCommunication[];
  documents: CrmDocument[];
  ownerName: (uid: string) => string;
  loading?: boolean;

  /** Il riepilogo non è un vicolo cieco: ogni riquadro porta ai dati per esteso. */
  onShowLeads: (state?: LeadState) => void;
  onShowFollowups: (view?: FollowupView) => void;
  onShowOpportunities: () => void;
  onShowCustomers: () => void;
  onOpenRecord?: (target: { kind: "lead" | "account" | "contact" | "customer"; recordId: string }) => void;
}

const KIND_ICONS: Record<TimelineKind, any> = {
  interaction: Activity,
  followup: CalendarClock,
  communication: Mail,
  document: FileText,
};

const BADGE_ICONS: Record<string, any> = {
  Telefonata: Phone,
  Email: Mail,
  SMS: MessageSquare,
  Meeting: Users,
  Nota: StickyNote,
};

/** Barra orizzontale di una ripartizione. */
function Bar({ t, label, count, share, color, onClick }: {
  t: any; label: string; count: number; share: number; color: string; onClick?: () => void;
}) {
  const content = (
    <>
      <span className="flex w-full items-baseline justify-between gap-2">
        <span className="text-[11px] text-[#C4C4C4]">{label}</span>
        <span className="text-[11px] text-white">{count}</span>
      </span>
      <span className="h-1 w-full overflow-hidden rounded-full bg-[#131313]">
        <span
          className="block h-full rounded-full"
          style={{ width: `${Math.max(share * 100, count > 0 ? 2 : 0)}%`, backgroundColor: color }}
        />
      </span>
    </>
  );

  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      title={t?.crm?.openListFilteredByStatus}
      className="flex flex-col gap-1 rounded-lg px-1 py-0.5 text-left transition-colors hover:bg-white/5"
    >
      {content}
    </button>
  ) : (
    <div className="flex flex-col gap-1 px-1 py-0.5">{content}</div>
  );
}

function Count({ label, value, color, onClick }: {
  label: string; value: number; color?: string; onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="flex flex-1 flex-col items-start gap-0.5 rounded-xl px-3 py-2 text-left transition-colors enabled:hover:bg-white/5 disabled:cursor-default"
    >
      <span className="text-lg font-semibold leading-none" style={{ color: color || '#FFFFFF' }}>{value}</span>
      <span className="text-[10px] uppercase tracking-wide text-[#5A5A5A]">{label}</span>
    </button>
  );
}

export function DashboardSection(props: DashboardSectionProps) {
  const { t } = useTranslation();
const {
  leads, accounts, customers, opportunities, followups,
  interactions, communications, documents, ownerName, loading,
  onShowLeads, onShowFollowups, onShowOpportunities, onShowCustomers,
} = props;
  const dashboard = useMemo(
    () => buildDashboard({
      leads, accounts, customers, opportunities, followups,
      interactions, communications, documents,
    }),
    [leads, accounts, customers, opportunities, followups, interactions, communications, documents]
  );

  if (loading) return <p className="text-sm text-[#858585]">Caricamento del riepilogo…</p>;

  const { leadStates, pipeline, followups: board, contacts, conversions, activity } = dashboard;
  // Scala con un fondo a 3: una sola conversione non deve disegnare una barra
  // a tutta altezza, che a colpo d'occhio racconterebbe un mese pieno.
  const maxConversions = Math.max(3, ...conversions.data.map(month => month.count));

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <WidgetCard
        title={t.crm.leadsByStatus}
        subtitle={`${leadStates.data.reduce((sum, slice) => sum + slice.count, 0)} lead in totale`}
        notes={leadStates.notes}
        action={{ label: t.crm.viewLeads, onClick: () => onShowLeads() }}
      >
        <div className="flex flex-col gap-1.5">
          {leadStates.data.map(slice => (
            <Bar
              t={t}
              key={slice.state}
              label={slice.label}
              count={slice.count}
              share={slice.share}
              color={slice.color}
              onClick={() => onShowLeads(slice.state)}
            />
          ))}
        </div>
      </WidgetCard>

      <WidgetCard
        title="Opportunità per fase e valore"
        subtitle={`${formatEuro(pipeline.data.totals.openValue)} aperti · previsione ${formatEuro(pipeline.data.totals.forecast)}`}
        notes={pipeline.notes}
        action={{ label: t.crm.openPipeline, onClick: onShowOpportunities }}
      >
        <div className="flex flex-col gap-1.5">
          {pipeline.data.phases.map(phase => (
            <div key={phase.phase} className="flex flex-col gap-1 px-1 py-0.5">
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-[11px] text-[#C4C4C4]">{getOppPhaseLabel(phase.phase, t)}</span>
                <span className="flex items-baseline gap-2">
                  <span className="text-[11px] text-[#5A5A5A]">{phase.count}</span>
                  <span className="text-[11px] text-white">{formatEuro(phase.value)}</span>
                </span>
              </span>
              <span className="h-1 w-full overflow-hidden rounded-full bg-[#131313]">
                <span
                  className="block h-full rounded-full"
                  style={{
                    width: `${Math.max((phase.value / pipeline.data.maxValue) * 100, phase.count > 0 ? 2 : 0)}%`,
                    backgroundColor: OPPORTUNITY_PHASE_COLORS[phase.phase],
                  }}
                />
              </span>
            </div>
          ))}
        </div>
      </WidgetCard>

      <WidgetCard
        title="Follow-up"
        subtitle="Aperti, per scadenza"
        notes={board.notes}
        action={{ label: 'Apri i follow-up', onClick: () => onShowFollowups() }}
      >
        <div className="flex flex-wrap items-center divide-x divide-[#1A1A1A]">
          <Count label={t.crm.overdue} value={board.data.overdue.length} color="#EF4444" onClick={() => onShowFollowups('overdue')} />
          <Count label={t.crm.today} value={board.data.today.length} onClick={() => onShowFollowups('today')} />
          <Count label="Prossimi 7 giorni" value={board.data.next.length} color="#3B82F6" onClick={() => onShowFollowups('week')} />
          <Count label={t.crm.noOwner} value={board.data.unassigned.length} color="#F59E0B" onClick={() => onShowFollowups('all')} />
        </div>
      </WidgetCard>

      <WidgetCard
        title={t.crm.toDoToday}
        subtitle={t.crm.tasksOverdueOrDueToday}
        notes={['Lista unificata di tutti i follow-up che richiedono la tua attenzione oggi. Clicca su un task per aprire direttamente la scheda del contatto.']}
        action={{ label: t.crm.viewAll, onClick: () => onShowFollowups('today') }}
      >
        {(() => {
          const today = todayISO();
          const isLive = (f: any) => !f.archived && (f.state === 'OPEN' || f.state === 'IN_PROGRESS');
          
          const todoList = followups
            .filter(isLive)
            .filter(f => f.dueDate && f.dueDate <= today)
            .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));

          if (todoList.length === 0) {
            return <EmptyLine text="Nessun task per oggi! Ottimo lavoro." />;
          }

          return (
            <ul className="flex flex-col gap-1.5 overflow-y-auto max-h-[300px] pr-1 custom-scrollbar">
              {todoList.map((f) => {
                const isOverdue = f.dueDate && f.dueDate < today;
                const kind = f.leadId ? 'lead' : f.customerId ? 'customer' : f.contactId ? 'contact' : null;
                const targetId = f.leadId || f.customerId || f.contactId;

                return (
                  <li key={f.id}>
                    <button
                      type="button"
                      onClick={() => {
                         if (kind && targetId && props.onOpenRecord) {
                           props.onOpenRecord({ kind: kind as any, recordId: targetId });
                         } else {
                           onShowFollowups('today');
                         }
                      }}
                      className="w-full flex items-center justify-between gap-3 rounded-xl border border-[#1A1A1A] bg-[#0B0B0B] px-3 py-2.5 transition-all hover:border-white/20 hover:bg-white/5 text-left group"
                    >
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-[12px] font-medium text-white truncate">{f.title || t.crm.untitled}</span>
                        <span className="text-[10px] text-[#858585] truncate">
                          {kind === 'lead' ? t.crm.lead : kind === 'customer' ? t.crm.customer : kind === 'contact' ? t.crm.colContact : kind === 'account' ? t.crm.colCompany : t.crm.generic} 
                          {f.notes ? ` • ${f.notes}` : ''}
                        </span>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${isOverdue ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                          {isOverdue ? t.crm.overdue : t.crm.today}
                        </span>
                        <span className="text-[9px] text-[#5A5A5A] opacity-0 group-hover:opacity-100 transition-opacity">
                          Clicca per aprire →
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          );
        })()}
      </WidgetCard>

      <WidgetCard
        title="Conversioni lead → cliente"
        subtitle={`${conversions.data.reduce((sum, month) => sum + month.count, 0)} negli ultimi ${conversions.data.length} mesi`}
        notes={conversions.notes}
        action={{ label: t.crm.viewCustomers, onClick: onShowCustomers }}
      >
        <div className="flex h-24 items-end gap-2">
          {conversions.data.map(month => (
            <div key={month.month} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[10px] text-white">{month.count || ''}</span>
              <span
                className="w-full rounded-t bg-[#10B981]"
                style={{ height: `${Math.max((month.count / maxConversions) * 64, month.count ? 4 : 1)}px` }}
              />
              <span className="text-[9px] text-[#5A5A5A]">{month.label}</span>
            </div>
          ))}
        </div>
      </WidgetCard>

      <WidgetCard
        title={t.crm.communications}
        subtitle={t.crm.emailsRecordedInProject}
        notes={dashboard.communications.notes}
      >
        <div className="flex flex-wrap items-center divide-x divide-[#1A1A1A]">
          {dashboard.communications.data.map(row => (
            <Count
              key={row.state}
              label={row.label}
              value={row.count}
              color={row.state === 'FAILED' ? '#EF4444' : row.state === 'SENT' ? '#10B981' : undefined}
            />
          ))}
        </div>
      </WidgetCard>

      <WidgetCard
        title="Attività commerciali recenti"
        subtitle="Interazioni, follow-up, email e documenti"
        notes={activity.notes}
      >
        {activity.data.length === 0 ? (
          <EmptyLine text="Nessuna attività registrata nel progetto." />
        ) : (
          <ul className="flex flex-col gap-1.5">
            {activity.data.map(entry => {
              const Icon = BADGE_ICONS[entry.badge] || KIND_ICONS[entry.kind];
              const color = TIMELINE_KIND_COLORS[entry.kind];
              return (
                <li key={entry.id} className="flex items-start gap-2">
                  <span
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${color}1A`, color }}
                  >
                    <Icon size={10} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[11px] text-white">{entry.title || '—'}</span>
                    <span className="text-[10px] text-[#5A5A5A]">
                      {entry.badge} · {ownerName(entry.actorUid)} · {formatDate(new Date(entry.at).toISOString())}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </WidgetCard>

      <WidgetCard
        title="Opportunità senza una prossima azione"
        subtitle="Aperte e senza follow-up da fare"
        notes={dashboard.stale.notes}
        action={{ label: t.crm.openPipeline, onClick: onShowOpportunities }}
      >
        {dashboard.stale.data.length === 0 ? (
          <EmptyLine text="Ogni opportunità aperta ha un follow-up da fare." />
        ) : (
          <ul className="flex flex-col gap-1">
            {dashboard.stale.data.slice(0, 6).map(row => (
              <li key={row.opportunity.id} className="flex items-center gap-2 rounded-xl border border-[#1A1A1A] px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-[11px] text-white">{row.opportunity.title || '—'}</span>
                <span className="shrink-0 text-[10px] text-[#5A5A5A]">
                  {getOppPhaseLabel(row.opportunity.phase, t)}
                </span>
                <span className="shrink-0 text-[10px] text-[#858585]">
                  {row.idleDays === -1 ? 'mai' : row.idleDays === 0 ? 'oggi' : `${row.idleDays} g`}
                </span>
                <span className="shrink-0 text-[11px] text-white">{formatEuro(row.value)}</span>
              </li>
            ))}
          </ul>
        )}
      </WidgetCard>

      <WidgetCard
        title={t.crm.recentCustomers}
        subtitle="Dai più nuovi"
        notes={dashboard.customers.notes}
        action={{ label: t.crm.viewCustomers, onClick: onShowCustomers }}
      >
        {dashboard.customers.data.length === 0 ? (
          <EmptyLine text="Nessun cliente nel progetto." />
        ) : (
          <ul className="flex flex-col gap-1">
            {dashboard.customers.data.map(row => (
              <li key={row.customer.id} className="flex items-center gap-2 rounded-xl border border-[#1A1A1A] px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-[11px] text-white">{row.name}</span>
                <span className="shrink-0 text-[10px] text-[#5A5A5A]">
                  {row.customer.status === 'active' ? 'attivo'
                    : row.customer.status === 'suspended' ? 'sospeso' : 'inattivo'}
                </span>
                <span className="shrink-0 text-[10px] text-[#858585]">
                  {row.since ? formatDate(new Date(row.since).toISOString()) : '—'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </WidgetCard>

      {MISSING_WIDGETS.map(widget => (
        <MissingWidgetCard key={widget.title} title={widget.title} reason={widget.reason} />
      ))}
    </div>
  );
}
