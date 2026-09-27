'use client';

import { useState } from 'react';
import { X, ArrowRightLeft, Loader2, Info } from 'lucide-react';
import { BridgeProposal } from '@/lib/crm/prospect/bridge';
import { ChoiceMode } from '@/lib/crm/conversion';
import { useCloseOnEscape } from '@/hooks/useCloseOnEscape';

/**
 * La proposta del ponte, prima di premere.
 *
 * Il principio della fase 8 è «nessun automatismo a sorpresa», e qui si vede:
 * ogni riga dice cosa farà, e si può cambiare. Le note della proposta stanno
 * in testa, non in fondo — servono a decidere, non a giustificare dopo.
 *
 * Il contatto parte da «non creare» e lo dichiara: dalla scheda non arriva
 * nessuna persona, perché la lettura del sito raccoglie solo caselle
 * aziendali. Per crearne uno bisogna scrivere un nome, ed è un gesto
 * deliberato di chi sta guardando.
 */

interface BridgePanelProps {
  proposal: BridgeProposal;
  onChange: (proposal: BridgeProposal) => void;
  onConfirm: () => void;
  onClose: () => void;
  running: boolean;
}

const MODI: { key: ChoiceMode; label: string }[] = [
  { key: 'create', label: 'Crea' },
  { key: 'link', label: 'Collega' },
  { key: 'skip', label: 'Niente' },
];

function Scelta({ label, mode, onMode, disabledModes, children }: {
  label: string;
  mode: ChoiceMode;
  onMode: (mode: ChoiceMode) => void;
  disabledModes?: ChoiceMode[];
  children?: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[#1A1A1A] bg-[#0F0F0F] p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-white">{label}</span>
        <div className="flex gap-1">
          {MODI.map(modo => {
            const spento = disabledModes?.includes(modo.key);
            return (
              <button
                key={modo.key}
                type="button"
                disabled={spento}
                onClick={() => onMode(modo.key)}
                className={`rounded px-2 py-1 text-[10px] transition-colors ${
                  mode === modo.key
                    ? 'bg-white/10 font-medium text-white'
                    : 'text-[#585858] hover:text-[#C4C4C4] disabled:cursor-not-allowed disabled:opacity-30'
                }`}
              >
                {modo.label}
              </button>
            );
          })}
        </div>
      </div>
      {children}
    </section>
  );
}

export function BridgePanel({ proposal, onChange, onConfirm, onClose, running }: BridgePanelProps) {
  useCloseOnEscape(onClose, !running);
  const [nome, setNome] = useState({ firstName: '', lastName: '', role: '' });

  const aggiorna = (patch: Partial<BridgeProposal>) => onChange({ ...proposal, ...patch });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-6">
      <div className="w-full max-w-2xl space-y-3 rounded-xl border border-[#1A1A1A] bg-[#0A0A0A] p-5">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-white">Porta questa scheda nel CRM</h2>
            <p className="text-[11px] text-[#585858]">Niente viene scritto finché non confermi.</p>
          </div>
          <button type="button" onClick={onClose} disabled={running} aria-label="Chiudi"
            className="text-[#585858] hover:text-white disabled:opacity-30">
            <X size={16} />
          </button>
        </header>

        {proposal.notes.length > 0 && (
          <ul className="space-y-1 rounded-lg border border-[#1A1A1A] bg-[#0F0F0F] p-3">
            {proposal.notes.map((nota, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[11px] text-[#858585]">
                <Info size={11} className="mt-0.5 shrink-0 text-[#3F3F3F]" />
                {nota}
              </li>
            ))}
          </ul>
        )}

        <Scelta
          label="Azienda"
          mode={proposal.accountMode}
          onMode={accountMode => aggiorna({ accountMode })}
          disabledModes={proposal.accountCandidates.length === 0 ? ['link'] : []}
        >
          {proposal.accountMode === 'create' ? (
            <p className="text-[11px] text-[#C4C4C4]">
              {proposal.accountDraft.legalName}
              {proposal.accountDraft.vatNumber && ` · P.IVA ${proposal.accountDraft.vatNumber}`}
              {proposal.accountDraft.industry && (
                <span className="text-[#F59E0B]"> · settore stimato: {proposal.accountDraft.industry}</span>
              )}
            </p>
          ) : proposal.accountMode === 'link' ? (
            <p className="text-[11px] text-[#C4C4C4]">
              {proposal.accountCandidates[0]?.label} — combacia su {proposal.accountCandidates[0]?.matchedOn.join(', ')}
            </p>
          ) : null}
        </Scelta>

        <Scelta
          label="Lead"
          mode={proposal.leadMode}
          onMode={leadMode => aggiorna({ leadMode })}
          disabledModes={proposal.leadCandidates.length === 0 ? ['link'] : []}
        >
          {proposal.leadMode === 'create' && (
            <p className="text-[11px] text-[#C4C4C4]">
              {proposal.leadDraft.companyName}
              {proposal.leadDraft.email && ` · ${proposal.leadDraft.email}`}
              {proposal.leadDraft.phone && ` · ${proposal.leadDraft.phone}`}
            </p>
          )}
        </Scelta>

        <Scelta
          label="Contatto"
          mode={proposal.contactMode}
          onMode={contactMode => aggiorna({ contactMode })}
          disabledModes={proposal.contactCandidates.length === 0 ? ['link'] : []}
        >
          {proposal.contactMode === 'create' ? (
            <div className="space-y-2">
              <p className="text-[11px] text-[#F59E0B]">
                Dalla scheda non arriva nessuna persona: i recapiti trovati sono aziendali.
                Il nome lo scrivi tu, e diventa un dato personale nel CRM.
              </p>
              <div className="grid grid-cols-3 gap-2">
                {([['firstName', 'Nome'], ['lastName', 'Cognome'], ['role', 'Ruolo']] as const).map(([campo, etichetta]) => (
                  <input
                    key={campo}
                    value={(nome as any)[campo]}
                    onChange={event => {
                      const aggiornato = { ...nome, [campo]: event.target.value };
                      setNome(aggiornato);
                      aggiorna({ contactDraft: { ...proposal.contactDraft, ...aggiornato } });
                    }}
                    placeholder={etichetta}
                    aria-label={etichetta}
                    className="rounded border border-[#1A1A1A] bg-[#0A0A0A] px-2 py-1.5 text-[11px] text-white placeholder:text-[#3F3F3F] focus:border-[#2A2A2A] focus:outline-none"
                  />
                ))}
              </div>
            </div>
          ) : proposal.contactMode === 'skip' ? (
            <p className="text-[11px] text-[#585858]">
              Nessun contatto. È la scelta giusta finché non si sa con chi si parla.
            </p>
          ) : (
            <p className="text-[11px] text-[#C4C4C4]">{proposal.contactCandidates[0]?.label}</p>
          )}
        </Scelta>

        <footer className="flex items-center justify-between gap-3 pt-1">
          <p className="text-[10px] text-[#585858]">
            I consensi restano a «no»: un recapito pubblico non è un consenso.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} disabled={running}
              className="rounded-lg border border-[#1A1A1A] px-3 py-1.5 text-[11px] text-[#858585] hover:bg-white/5 disabled:opacity-30">
              Annulla
            </button>
            <button type="button" onClick={onConfirm} disabled={running}
              className="flex items-center gap-1.5 rounded-lg bg-white px-4 py-1.5 text-[11px] font-medium text-black disabled:opacity-40">
              {running ? <Loader2 size={12} className="animate-spin" /> : <ArrowRightLeft size={12} />}
              {running ? 'Scrivo…' : 'Conferma'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
