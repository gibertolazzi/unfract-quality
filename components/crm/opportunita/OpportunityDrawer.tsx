'use client';

import { useState } from 'react';
import { X, Pencil, CalendarClock, Archive, ArchiveRestore, ChevronDown, Sparkles, History } from 'lucide-react';
import { CrmOpportunity, CrmOpportunityChange } from '@/components/crm/types';
import {
  OpportunityPhase, OPPORTUNITY_PHASE_LABELS, OPPORTUNITY_PHASE_COLORS,
  OPPORTUNITY_TRANSITIONS, OPPORTUNITY_PHASE_PROBABILITY,
} from '@/components/crm/constants';
import {
  effectiveValue, effectiveProbabilityOf, weightedValueOf, itemsTotal,
} from '@/lib/crm/opportunityFilters';
import { formatDate, formatEuro, Pill, inputClass } from '../shared/TableUtils';
import { Timeline } from '../timeline/Timeline';
import { TimelineSources } from '@/lib/crm/timeline';
import { useCloseOnEscape } from '@/hooks/useCloseOnEscape';

interface OpportunityDrawerProps {
  opportunity: CrmOpportunity;
  counterpartyName: string;
  counterpartyKind: 'cliente' | 'lead' | '';
  history: TimelineSources;
  ownerName: (uid: string) => string;
  onClose: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onChangePhase: (to: OpportunityPhase, lostReason?: string) => void;
  onQuickFollowup?: (days: number) => void;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="shrink-0 text-[10px] uppercase tracking-wide text-[#5A5A5A]">{label}</span>
      <span className="text-right text-xs text-[#C4C4C4]">{children}</span>
    </div>
  );
}

const FIELD_LABELS: Record<string, string> = {
  phase: 'Fase',
  value: 'Valore',
  probability: 'Probabilità',
  expectedCloseDate: 'Chiusura prevista',
  ownerUid: 'Owner',
  title: 'Titolo',
  items: 'Voci',
};

/** Rende leggibile un valore della cronologia, qualunque cosa sia. */
function describe(field: string, value: any, ownerName: (uid: string) => string): string {
  if (value === null || value === undefined || value === '') return '—';
  if (field === 'phase') return OPPORTUNITY_PHASE_LABELS[value as OpportunityPhase] || String(value);
  if (field === 'value') return formatEuro(Number(value));
  if (field === 'probability') return `${value}%`;
  if (field === 'ownerUid') return ownerName(String(value)) || 'Non assegnata';
  if (field === 'items' && typeof value === 'object') {
    return `${value.count} ${value.count === 1 ? 'voce' : 'voci'} · ${formatEuro(value.total || 0)}`;
  }
  return String(value);
}

export function OpportunityDrawer({
  opportunity, counterpartyName, counterpartyKind, history, ownerName,
  onClose, onEdit, onArchive, onRestore, onChangePhase, onQuickFollowup,
}: OpportunityDrawerProps) {
  useCloseOnEscape(onClose);

  const [phaseOpen, setPhaseOpen] = useState(false);
  const [lostFor, setLostFor] = useState<OpportunityPhase | null>(null);
  const [lostReason, setLostReason] = useState('');

  const allowed = OPPORTUNITY_TRANSITIONS[opportunity.phase];
  const manual = opportunity.probability !== null;
  const computed = opportunity.items.length > 0;

  // Dalla più recente: la cronologia si legge dall'ultima cosa successa.
  const changes = [...opportunity.changeLog].reverse();

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="flex-1 bg-black/50" onClick={onClose} />

      <aside className="flex h-full w-full max-w-md flex-col overflow-hidden border-l border-[#1A1A1A] bg-[#0B0B0B]">
        <header className="flex items-start justify-between gap-3 border-b border-[#1A1A1A] px-5 py-4">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-sm font-medium text-white">{opportunity.title}</h2>
            <p className="text-[11px] text-[#5A5A5A]">
              {counterpartyName ? `${counterpartyKind}: ${counterpartyName}` : 'Controparte non risolta'}
            </p>
          </div>

          <div className="flex items-center gap-1">
            <button type="button" onClick={onEdit} title="Modifica" className="rounded-lg p-1.5 text-[#858585] hover:bg-white/5 hover:text-white">
              <Pencil size={14} />
            </button>
            {opportunity.archived ? (
              <button type="button" onClick={onRestore} title="Ripristina" className="rounded-lg p-1.5 text-[#858585] hover:bg-white/5 hover:text-white">
                <ArchiveRestore size={14} />
              </button>
            ) : (
              <button type="button" onClick={onArchive} title="Archivia" className="rounded-lg p-1.5 text-[#858585] hover:bg-white/5 hover:text-[#EF4444]">
                <Archive size={14} />
              </button>
            )}
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-[#858585] hover:bg-white/5 hover:text-white">
              <X size={15} />
            </button>
          </div>
        </header>

        <div className="flex flex-col gap-6 overflow-y-auto px-5 py-5">
          {onQuickFollowup && !opportunity.archived && (
            <div className="flex items-center gap-2 rounded-xl border border-dashed border-[#1A1A1A] bg-[#0F0F0F] px-4 py-3">
              <CalendarClock size={14} className="text-[#00A6FF]" />
              <span className="text-xs text-[#E5E5E5] mr-2">Prossimo follow-up:</span>
              <button type="button" onClick={() => onQuickFollowup(1)} className="px-3 py-1 rounded bg-[#1A1A1A] hover:bg-[#2A2A2A] text-[11px] text-white transition-colors">Domani</button>
              <button type="button" onClick={() => onQuickFollowup(3)} className="px-3 py-1 rounded bg-[#1A1A1A] hover:bg-[#2A2A2A] text-[11px] text-white transition-colors">Tra 3 giorni</button>
              <button type="button" onClick={() => onQuickFollowup(7)} className="px-3 py-1 rounded bg-[#1A1A1A] hover:bg-[#2A2A2A] text-[11px] text-white transition-colors">Tra 1 sett.</button>
              <button type="button" onClick={() => onQuickFollowup(30)} className="px-3 py-1 rounded bg-[#1A1A1A] hover:bg-[#2A2A2A] text-[11px] text-white transition-colors">Tra 1 mese</button>
            </div>
          )}
          {/* --------------------------------------------------- fase */}
          <section className="flex flex-col gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => allowed.length > 0 && setPhaseOpen(!phaseOpen)}
                disabled={allowed.length === 0 || opportunity.archived}
                className="flex w-full items-center justify-between gap-2 rounded-xl border border-[#1A1A1A] bg-black/20 px-3 py-2.5 disabled:cursor-default"
              >
                <Pill
                  color={OPPORTUNITY_PHASE_COLORS[opportunity.phase]}
                  label={OPPORTUNITY_PHASE_LABELS[opportunity.phase]}
                />
                {allowed.length > 0 && !opportunity.archived && <ChevronDown size={13} className="text-[#858585]" />}
              </button>

              {phaseOpen && (
                <div className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-xl border border-[#1A1A1A] bg-[#111111] py-1 shadow-xl">
                  {allowed.map(phase => (
                    <button
                      key={phase}
                      type="button"
                      onClick={() => {
                        setPhaseOpen(false);
                        if (phase === 'LOST') { setLostFor(phase); return; }
                        onChangePhase(phase);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-[#C4C4C4] hover:bg-white/5 hover:text-white"
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: OPPORTUNITY_PHASE_COLORS[phase] }} />
                      {OPPORTUNITY_PHASE_LABELS[phase]}
                      <span className="ml-auto text-[10px] text-[#3F3F3F]">
                        {OPPORTUNITY_PHASE_PROBABILITY[phase]}%
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {allowed.length === 0 && (
              <p className="text-[10px] text-[#3F3F3F]">
                Fase terminale: l’opportunità è chiusa e non cambia più stato.
              </p>
            )}

            {lostFor && (
              <div className="flex flex-col gap-2 rounded-xl border border-[#EF4444]/30 bg-[#EF4444]/5 p-3">
                <span className="text-[10px] uppercase tracking-wide text-[#5A5A5A]">Motivo della perdita</span>
                <input
                  value={lostReason}
                  onChange={e => setLostReason(e.target.value)}
                  placeholder="es. prezzo fuori budget"
                  className={inputClass}
                  autoFocus
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => { setLostFor(null); setLostReason(''); }}
                    className="rounded-lg px-2 py-1 text-[11px] text-[#858585] hover:text-white"
                  >
                    Annulla
                  </button>
                  <button
                    type="button"
                    onClick={() => { onChangePhase(lostFor, lostReason); setLostFor(null); setLostReason(''); }}
                    className="rounded-lg bg-white px-3 py-1 text-[11px] font-medium text-black hover:opacity-90"
                  >
                    Segna come persa
                  </button>
                </div>
              </div>
            )}
          </section>

          <div className="flex flex-col divide-y divide-[#131313]">
            <Row label="Valore">
              {formatEuro(effectiveValue(opportunity))}
              {computed && <span className="ml-2 text-[10px] text-[#3F3F3F]">calcolato</span>}
            </Row>
            <Row label="Probabilità">
              <span className="flex items-center justify-end gap-1">
                {manual && <Sparkles size={9} className="text-[#858585]" />}
                {effectiveProbabilityOf(opportunity)}%
                <span className="text-[10px] text-[#3F3F3F]">{manual ? 'a mano' : 'da fase'}</span>
              </span>
            </Row>
            <Row label="Ponderato">{formatEuro(weightedValueOf(opportunity))}</Row>
            <Row label="Chiusura prevista">
              {opportunity.expectedCloseDate ? formatDate(opportunity.expectedCloseDate) : '—'}
            </Row>
            {opportunity.closedAt && <Row label="Chiusa il">{formatDate(opportunity.closedAt)}</Row>}
            {opportunity.lostReason && <Row label="Motivo della perdita">{opportunity.lostReason}</Row>}
            <Row label="Owner">{ownerName(opportunity.ownerUid) || '—'}</Row>
            <Row label="Aggiornata">{formatDate(opportunity.updatedAt)}</Row>
          </div>

          {opportunity.items.length > 0 && (
            <section className="flex flex-col gap-2">
              <h3 className="text-[10px] uppercase tracking-wide text-[#5A5A5A]">
                Prodotti e servizi · {opportunity.items.length}
              </h3>
              <div className="flex flex-col gap-1">
                {opportunity.items.map((item, index) => (
                  <div key={index} className="flex items-center justify-between gap-2 rounded-xl border border-[#1A1A1A] bg-black/20 px-3 py-2">
                    <span className="flex flex-col">
                      <span className="text-xs text-white">{item.name || 'Voce senza nome'}</span>
                      <span className="text-[11px] text-[#5A5A5A]">
                        {item.quantity} × {formatEuro(item.unitPrice)}
                      </span>
                    </span>
                    <span className="text-xs text-[#C4C4C4]">
                      {formatEuro((item.quantity || 0) * (item.unitPrice || 0))}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-2 px-3 py-1">
                  <span className="text-[11px] text-[#5A5A5A]">Totale</span>
                  <span className="text-xs text-white">{formatEuro(itemsTotal(opportunity.items))}</span>
                </div>
              </div>
            </section>
          )}

          {(opportunity.description || opportunity.notes) && (
            <section className="flex flex-col gap-2">
              {opportunity.description && (
                <p className="whitespace-pre-wrap rounded-xl border border-[#1A1A1A] bg-black/20 px-3 py-2 text-xs text-[#C4C4C4]">
                  {opportunity.description}
                </p>
              )}
              {opportunity.notes && (
                <p className="whitespace-pre-wrap rounded-xl border border-[#1A1A1A] bg-black/20 px-3 py-2 text-xs text-[#858585]">
                  {opportunity.notes}
                </p>
              )}
            </section>
          )}

          <Timeline
            sources={history}
            reference={{
              opportunityId: opportunity.id,
              customerId: opportunity.customerId,
              leadId: opportunity.leadId,
            }}
            ownerName={ownerName}
            emptyHint="Nessuna attività collegata a questa opportunità."
          />

          {/* -------------------------------------------- cronologia */}
          <section className="flex flex-col gap-2">
            <h3 className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[#5A5A5A]">
              <History size={11} /> Cronologia delle modifiche · {changes.length}
            </h3>

            {changes.length === 0 ? (
              <p className="text-xs text-[#3F3F3F]">
                Nessuna modifica registrata dopo la creazione.
              </p>
            ) : (
              <ol className="flex flex-col gap-2">
                {changes.map((change: CrmOpportunityChange, index) => (
                  <li key={index} className="flex flex-col gap-0.5 border-l border-[#1A1A1A] pl-3">
                    <span className="text-[11px] text-white">
                      {FIELD_LABELS[change.field] || change.field}
                      <span className="text-[#5A5A5A]"> da </span>
                      {describe(change.field, change.from, ownerName)}
                      <span className="text-[#5A5A5A]"> a </span>
                      {describe(change.field, change.to, ownerName)}
                    </span>
                    <span className="text-[10px] text-[#3F3F3F]">
                      {formatDate(change.at)} · {ownerName(change.by) || 'utente sconosciuto'}
                    </span>
                  </li>
                ))}
              </ol>
            )}

            <p className="text-[10px] text-[#3F3F3F]">
              Scritta dal browser: utile a ricostruire cosa è successo, non è una prova.
              Vedi docs/DEROGHE.md.
            </p>
          </section>
        </div>
      </aside>
    </div>
  );
}
