'use client';

import { useMemo, useState } from 'react';
import {
  X, ArrowLeft, ArrowRight, Check, Building2, Users, Handshake, Target,
  Link2, PlusCircle, MinusCircle, AlertTriangle, History,
} from 'lucide-react';
import { CrmLead, CrmAccount, CrmContact, CrmCustomer } from '@/components/crm/types';
import {
  ConversionProposal, ConversionResult, HistoryCounts, MatchCandidate, ChoiceMode,
  buildConversionProposal, canConvert, conversionBlockReason,
} from '@/lib/crm/conversion';
import { inputClass, formatEuro } from '../shared/TableUtils';
import { useCloseOnEscape } from '@/hooks/useCloseOnEscape';

type Step = 'azienda' | 'contatto' | 'cliente' | 'riepilogo' | 'esito';

const STEPS: { key: Step; label: string }[] = [
  { key: 'azienda',   label: 'Azienda' },
  { key: 'contatto',  label: 'Contatto' },
  { key: 'cliente',   label: 'Cliente' },
  { key: 'riepilogo', label: 'Riepilogo' },
];

interface ConversionModalProps {
  lead: CrmLead;
  accounts: CrmAccount[];
  contacts: CrmContact[];
  customers: CrmCustomer[];
  history: HistoryCounts;
  converting?: boolean;
  onClose: () => void;
  onConvert: (proposal: ConversionProposal) => Promise<ConversionResult>;
}

function Field({ label, children, hint, wide }: {
  label: string; children: React.ReactNode; hint?: string; wide?: boolean;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${wide ? 'sm:col-span-2' : ''}`}>
      <span className="text-[10px] uppercase tracking-wide text-[#5A5A5A]">{label}</span>
      {children}
      {hint && <span className="text-[10px] text-[#3F3F3F]">{hint}</span>}
    </label>
  );
}

/** Scelta fra collegare un record esistente e crearne uno nuovo. */
function ModeSwitch({ mode, onChange, allowSkip, candidates }: {
  mode: ChoiceMode;
  onChange: (mode: ChoiceMode) => void;
  allowSkip?: boolean;
  candidates: MatchCandidate[];
}) {
  const options: { key: ChoiceMode; label: string; Icon: any; disabled?: boolean }[] = [
    { key: 'link', label: 'Collega esistente', Icon: Link2, disabled: candidates.length === 0 },
    { key: 'create', label: 'Crea nuovo', Icon: PlusCircle },
  ];
  if (allowSkip) options.push({ key: 'skip', label: 'Nessuno', Icon: MinusCircle });

  return (
    <div className="flex flex-wrap gap-1">
      {options.map(({ key, label, Icon, disabled }) => (
        <button
          key={key}
          type="button"
          disabled={disabled}
          title={disabled ? 'Nessun record che combacia' : undefined}
          onClick={() => onChange(key)}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors ${
            mode === key ? 'bg-white/10 font-medium text-white' : 'text-[#858585] hover:bg-white/5 hover:text-white'
          } disabled:cursor-not-allowed disabled:text-[#3F3F3F] disabled:hover:bg-transparent`}
        >
          <Icon size={12} />
          {label}
        </button>
      ))}
    </div>
  );
}

function CandidateList({ candidates, selectedId, onSelect }: {
  candidates: MatchCandidate[]; selectedId: string; onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {candidates.map(candidate => (
        <button
          key={candidate.id}
          type="button"
          onClick={() => onSelect(candidate.id)}
          className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition-colors ${
            selectedId === candidate.id ? 'border-white/30 bg-white/5' : 'border-[#1A1A1A] bg-black/20 hover:border-[#2A2A2A]'
          }`}
        >
          <span className="text-xs text-white">{candidate.label}</span>
          <span className="text-[10px] text-[#5A5A5A]">combacia per {candidate.matchedOn.join(', ')}</span>
        </button>
      ))}
    </div>
  );
}

function SummaryRow({ Icon, title, detail, mode }: {
  Icon: any; title: string; detail: string; mode: 'create' | 'link' | 'skip';
}) {
  const label = mode === 'create' ? 'crea' : mode === 'link' ? 'collega' : 'nessuno';
  const color = mode === 'create' ? '#10B981' : mode === 'link' ? '#3B82F6' : '#5A5A5A';

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-[#1A1A1A] bg-black/20 px-3 py-2.5">
      <span className="flex items-center gap-2.5">
        <Icon size={14} className="text-[#858585]" />
        <span className="flex flex-col">
          <span className="text-xs text-white">{title}</span>
          <span className="text-[11px] text-[#5A5A5A]">{detail}</span>
        </span>
      </span>
      <span
        className="shrink-0 rounded-full px-2 py-0.5 text-[10px]"
        style={{ color, backgroundColor: `${color}1A` }}
      >
        {label}
      </span>
    </div>
  );
}

/**
 * Conversione guidata da lead a cliente: azienda, contatto, cliente,
 * opportunità, e lo storico che li segue. Mostra cosa farà prima di scriverlo.
 */
export function ConversionModal({
  lead, accounts, contacts, customers, history, converting, onClose, onConvert,
}: ConversionModalProps) {
  useCloseOnEscape(onClose, !converting);

  const initial = useMemo(
    () => buildConversionProposal(lead, accounts, contacts, customers),
    [lead, accounts, contacts, customers]
  );

  const [step, setStep] = useState<Step>('azienda');
  const [proposal, setProposal] = useState<ConversionProposal>(initial);
  const [result, setResult] = useState<ConversionResult | null>(null);

  const blocked = !canConvert(lead);
  const set = (patch: Partial<ConversionProposal>) => setProposal(p => ({ ...p, ...patch }));

  const accountName = (id: string) =>
    accounts.find(a => a.id === id)?.displayName || 'Azienda';

  const chosenAccountLabel = proposal.accountMode === 'link'
    ? accountName(proposal.accountId)
    : proposal.accountDraft.displayName || proposal.accountDraft.legalName || '—';

  const chosenContactLabel = proposal.contactMode === 'link'
    ? contacts.find(c => c.id === proposal.contactId)?.fullName || 'Contatto'
    : proposal.contactMode === 'create'
      ? `${proposal.contactDraft.firstName} ${proposal.contactDraft.lastName}`.trim() || '—'
      : 'Nessun contatto';

  const stepIndex = STEPS.findIndex(s => s.key === step);

  const canAdvance =
    step === 'azienda'
      ? proposal.accountMode === 'link' ? !!proposal.accountId : !!(proposal.accountDraft.legalName || proposal.accountDraft.displayName)
      : step === 'contatto'
        ? proposal.contactMode !== 'link' || !!proposal.contactId
        : true;

  const run = async () => {
    const outcome = await onConvert(proposal);
    setResult(outcome);
    setStep('esito');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-[#1A1A1A] bg-[#0B0B0B]">
        <header className="flex items-center justify-between border-b border-[#1A1A1A] px-6 py-4">
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-medium text-white">
              Converti {lead.fullName || lead.companyName || 'lead'}
            </h2>
            {!blocked && step !== 'esito' && (
              <div className="hidden items-center gap-1.5 sm:flex">
                {STEPS.map((s, i) => (
                  <span
                    key={s.key}
                    className={`rounded-full px-2 py-0.5 text-[10px] ${
                      i === stepIndex ? 'bg-white/10 text-white' : i < stepIndex ? 'text-[#10B981]' : 'text-[#3F3F3F]'
                    }`}
                  >
                    {i + 1}. {s.label}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button type="button" onClick={onClose} className="text-[#858585] hover:text-white">
            <X size={16} />
          </button>
        </header>

        <div className="overflow-y-auto px-6 py-5">
          {blocked ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-2 rounded-xl border border-[#F59E0B]/30 bg-[#F59E0B]/10 px-3 py-2.5">
                <AlertTriangle size={14} className="mt-0.5 shrink-0 text-[#F59E0B]" />
                <p className="text-xs text-[#F59E0B]">{conversionBlockReason(lead)}</p>
              </div>

              {lead.state === 'CONVERTED' && (
                <div className="flex flex-col gap-1.5">
                  {lead.convertedCustomerId && (
                    <SummaryRow Icon={Handshake} title="Cliente" detail={lead.convertedCustomerId} mode="link" />
                  )}
                  {lead.convertedAccountId && (
                    <SummaryRow Icon={Building2} title="Azienda" detail={accountName(lead.convertedAccountId)} mode="link" />
                  )}
                </div>
              )}
            </div>
          ) : step === 'azienda' ? (
            <div className="flex flex-col gap-4">
              <ModeSwitch
                mode={proposal.accountMode}
                onChange={mode => set({ accountMode: mode })}
                candidates={proposal.accountCandidates}
              />

              {proposal.accountMode === 'link' ? (
                proposal.accountCandidates.length > 0 ? (
                  <CandidateList
                    candidates={proposal.accountCandidates}
                    selectedId={proposal.accountId}
                    onSelect={id => set({ accountId: id })}
                  />
                ) : (
                  <p className="text-xs text-[#3F3F3F]">Nessuna azienda che combacia.</p>
                )
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Ragione sociale">
                    <input
                      value={proposal.accountDraft.legalName}
                      onChange={e => set({ accountDraft: { ...proposal.accountDraft, legalName: e.target.value } })}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Nome breve">
                    <input
                      value={proposal.accountDraft.displayName}
                      onChange={e => set({ accountDraft: { ...proposal.accountDraft, displayName: e.target.value } })}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Sito" hint="Da qui si ricava il dominio">
                    <input
                      value={proposal.accountDraft.website}
                      onChange={e => set({ accountDraft: { ...proposal.accountDraft, website: e.target.value } })}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Partita IVA">
                    <input
                      value={proposal.accountDraft.vatNumber}
                      onChange={e => set({ accountDraft: { ...proposal.accountDraft, vatNumber: e.target.value } })}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Settore">
                    <input
                      value={proposal.accountDraft.industry}
                      onChange={e => set({ accountDraft: { ...proposal.accountDraft, industry: e.target.value } })}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Città">
                    <input
                      value={proposal.accountDraft.city}
                      onChange={e => set({ accountDraft: { ...proposal.accountDraft, city: e.target.value } })}
                      className={inputClass}
                    />
                  </Field>
                </div>
              )}
            </div>
          ) : step === 'contatto' ? (
            <div className="flex flex-col gap-4">
              <ModeSwitch
                mode={proposal.contactMode}
                onChange={mode => set({ contactMode: mode })}
                allowSkip
                candidates={proposal.contactCandidates}
              />

              {proposal.contactMode === 'link' ? (
                <CandidateList
                  candidates={proposal.contactCandidates}
                  selectedId={proposal.contactId}
                  onSelect={id => set({ contactId: id })}
                />
              ) : proposal.contactMode === 'create' ? (
                <>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Nome">
                      <input
                        value={proposal.contactDraft.firstName}
                        onChange={e => set({ contactDraft: { ...proposal.contactDraft, firstName: e.target.value } })}
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Cognome">
                      <input
                        value={proposal.contactDraft.lastName}
                        onChange={e => set({ contactDraft: { ...proposal.contactDraft, lastName: e.target.value } })}
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Email">
                      <input
                        value={proposal.contactDraft.email}
                        onChange={e => set({ contactDraft: { ...proposal.contactDraft, email: e.target.value } })}
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Telefono">
                      <input
                        value={proposal.contactDraft.phone}
                        onChange={e => set({ contactDraft: { ...proposal.contactDraft, phone: e.target.value } })}
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Ruolo" wide>
                      <input
                        value={proposal.contactDraft.role}
                        onChange={e => set({ contactDraft: { ...proposal.contactDraft, role: e.target.value } })}
                        className={inputClass}
                      />
                    </Field>
                  </div>

                  <p className="rounded-xl border border-[#1A1A1A] bg-black/20 px-3 py-2 text-[11px] text-[#858585]">
                    I consensi del lead vengono portati sul contatto così come sono:
                    {lead.consents.email.granted
                      ? ` email concesso (${lead.consents.email.source || 'fonte non indicata'}).`
                      : ' email non concesso.'}
                    {' '}Non si inventa un consenso che non c’era.
                  </p>
                </>
              ) : (
                <p className="text-xs text-[#3F3F3F]">
                  Il cliente verrà creato senza referenti. Si possono aggiungere dopo dalla scheda.
                </p>
              )}
            </div>
          ) : step === 'cliente' ? (
            <div className="flex flex-col gap-4">
              {proposal.existingCustomerId ? (
                <div className="flex items-start gap-2 rounded-xl border border-[#3B82F6]/30 bg-[#3B82F6]/10 px-3 py-2.5">
                  <Link2 size={14} className="mt-0.5 shrink-0 text-[#3B82F6]" />
                  <p className="text-xs text-[#3B82F6]">
                    Questa azienda è già cliente: non ne verrà creato un secondo. Il contatto
                    scelto viene aggiunto ai suoi referenti.
                  </p>
                </div>
              ) : (
                <>
                  <p className="rounded-xl border border-[#1A1A1A] bg-black/20 px-3 py-2 text-[11px] text-[#858585]">
                    Verrà creato un cliente nuovo, collegato all’azienda scelta e con questo lead
                    come origine.
                  </p>
                  <div className="grid grid-cols-3 gap-4 mt-1">
                    <Field label="Mensile (€)">
                      <input type="number" min="0" step="0.01" value={proposal.monthlyAmount || ''} onChange={e => set({ monthlyAmount: parseFloat(e.target.value) || 0 })} className={inputClass} placeholder="0.00" />
                    </Field>
                    <Field label="Annuale (€)">
                      <input type="number" min="0" step="0.01" value={proposal.annualAmount || ''} onChange={e => set({ annualAmount: parseFloat(e.target.value) || 0 })} className={inputClass} placeholder="0.00" />
                    </Field>
                    <Field label="Una tantum (€)">
                      <input type="number" min="0" step="0.01" value={proposal.oneTimeAmount || ''} onChange={e => set({ oneTimeAmount: parseFloat(e.target.value) || 0 })} className={inputClass} placeholder="0.00" />
                    </Field>
                  </div>
                </>
              )}

              <label className="flex cursor-pointer items-center gap-2 text-xs text-[#C4C4C4]">
                <input
                  type="checkbox"
                  checked={proposal.createOpportunity}
                  onChange={e => set({ createOpportunity: e.target.checked })}
                  className="accent-white"
                />
                Apri anche un’opportunità
              </label>

              {proposal.createOpportunity && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Titolo" wide>
                    <input
                      value={proposal.opportunityTitle}
                      onChange={e => set({ opportunityTitle: e.target.value })}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Valore">
                    <input
                      type="number"
                      min={0}
                      value={proposal.opportunityValue}
                      onChange={e => set({ opportunityValue: Number(e.target.value) })}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Chiusura prevista">
                    <input
                      type="date"
                      value={proposal.opportunityCloseDate}
                      onChange={e => set({ opportunityCloseDate: e.target.value })}
                      className={inputClass}
                    />
                  </Field>
                  <p className="text-[10px] text-[#3F3F3F] sm:col-span-2">
                    Nasce già in negoziazione: il lead era arrivato lì, ricominciare dalla
                    qualificazione perderebbe il lavoro fatto.
                  </p>
                </div>
              )}
            </div>
          ) : step === 'riepilogo' ? (
            <div className="flex flex-col gap-3">
              <SummaryRow
                Icon={Building2}
                title={chosenAccountLabel}
                detail="Azienda"
                mode={proposal.accountMode === 'link' ? 'link' : 'create'}
              />
              <SummaryRow
                Icon={Users}
                title={chosenContactLabel}
                detail="Contatto"
                mode={proposal.contactMode}
              />
              <SummaryRow
                Icon={Handshake}
                title={proposal.existingCustomerId ? accountName(proposal.accountId) : chosenAccountLabel}
                detail="Cliente"
                mode={proposal.existingCustomerId ? 'link' : 'create'}
              />
              {proposal.createOpportunity && (
                <SummaryRow
                  Icon={Target}
                  title={proposal.opportunityTitle}
                  detail={`Opportunità in negoziazione · ${formatEuro(proposal.opportunityValue)}`}
                  mode="create"
                />
              )}

              <div className="flex items-start gap-2 rounded-xl border border-[#1A1A1A] bg-black/20 px-3 py-2.5">
                <History size={14} className="mt-0.5 shrink-0 text-[#858585]" />
                <p className="text-[11px] text-[#858585]">
                  {history.total === 0
                    ? 'Il lead non ha ancora storico da trasferire.'
                    : `${history.total} record di storico verranno agganciati alle nuove entità: ` +
                      [
                        history.interactions && `${history.interactions} interazioni`,
                        history.followups && `${history.followups} follow-up`,
                        history.documents && `${history.documents} documenti`,
                        history.communications && `${history.communications} comunicazioni`,
                      ].filter(Boolean).join(', ') + '.'}
                  {' '}Il collegamento al lead non viene tolto: la storia resta leggibile da
                  entrambe le parti, e nulla viene cancellato.
                </p>
              </div>

              <p className="text-[10px] text-[#3F3F3F]">
                Il lead passerà allo stato «Convertito», che è terminale.
              </p>
            </div>
          ) : (
            result && (
              <div className="flex flex-col gap-3">
                {result.errors.length > 0 ? (
                  <div className="flex items-start gap-2 rounded-xl border border-[#EF4444]/30 bg-[#EF4444]/10 px-3 py-2.5">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0 text-[#EF4444]" />
                    <div className="flex flex-col gap-1">
                      <p className="text-xs text-[#EF4444]">Conversione non completata.</p>
                      {result.errors.map(error => (
                        <p key={error} className="text-[11px] text-[#EF4444]/80">{error}</p>
                      ))}
                      <p className="text-[11px] text-[#858585]">
                        Il lead resta in negoziazione. Controlla cosa è stato creato prima di
                        riprovare, per non duplicare.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <Check size={18} className="text-[#10B981]" />
                    <p className="text-sm text-white">Lead convertito</p>
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  {result.accountId && <SummaryRow Icon={Building2} title={chosenAccountLabel} detail="Azienda" mode="link" />}
                  {result.contactId && <SummaryRow Icon={Users} title={chosenContactLabel} detail="Contatto" mode="link" />}
                  {result.customerId && <SummaryRow Icon={Handshake} title="Cliente creato" detail={result.customerId} mode="link" />}
                  {result.opportunityId && <SummaryRow Icon={Target} title={proposal.opportunityTitle} detail="Opportunità" mode="link" />}
                </div>

                <p className="text-[11px] text-[#858585]">
                  {result.historyMoved} record di storico agganciati.
                </p>
              </div>
            )
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-[#1A1A1A] px-6 py-4">
          {blocked || step === 'esito' ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-white px-4 py-2 text-xs font-medium text-black transition-opacity hover:opacity-90"
            >
              Chiudi
            </button>
          ) : (
            <>
              {stepIndex > 0 && (
                <button
                  type="button"
                  onClick={() => setStep(STEPS[stepIndex - 1].key)}
                  disabled={converting}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-[#858585] hover:text-white disabled:opacity-50"
                >
                  <ArrowLeft size={13} /> Indietro
                </button>
              )}

              {step === 'riepilogo' ? (
                <button
                  type="button"
                  onClick={run}
                  disabled={converting}
                  className="rounded-lg bg-white px-4 py-2 text-xs font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {converting ? 'Conversione…' : 'Converti'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setStep(STEPS[stepIndex + 1].key)}
                  disabled={!canAdvance}
                  className="flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-xs font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  Avanti <ArrowRight size={13} />
                </button>
              )}
            </>
          )}
        </footer>
      </div>
    </div>
  );
}
