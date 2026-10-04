'use client';

import { useTranslation } from '@/contexts/TranslationContext';
import { useState } from 'react';
import { Ban, RotateCcw, Plus } from 'lucide-react';
import { CrmProspectExclusion } from './types';
import {
  EXCLUSION_KINDS, EXCLUSION_KIND_LABELS, EXCLUSION_KIND_HINTS, ExclusionKind,
} from './constants';
import { formatDate } from '../shared/TableUtils';

/**
 * Chi non va più cercato.
 *
 * Esiste per il requisito 4 del piano (§8), e il motivo pratico viene prima di
 * quello normativo: senza un posto dove scrivere «questi hanno chiesto di
 * essere lasciati in pace», la stessa azienda viene ricercata di nuovo dal
 * collega che quel giorno non c'era.
 *
 * Due cose si vedono, e sono volute:
 *
 * - **le esclusioni revocate restano in elenco**, barrate, con chi le ha
 *   revocate e quando. Una lista da cui si cancella non dimostra niente;
 * - **il nome è dichiarato come chiave debole.** Partita IVA e dominio sono
 *   esatti; un nome può bloccare anche un'azienda che non aveva chiesto
 *   niente, e chi lo sceglie deve saperlo prima.
 */

interface ExclusionPanelProps {
  exclusions: CrmProspectExclusion[];
  onAdd: (input: { kind: ExclusionKind; value: string; reason: string; requestedBy: string }) => void;
  onLift: (id: string, why: string) => void;
  ownerName: (uid: string) => string;
  canManage: boolean;
  busy?: boolean;
}

export function ExclusionPanel({ exclusions, onAdd, onLift, ownerName, canManage, busy }: ExclusionPanelProps) {
  const { t } = useTranslation();
  const [kind, setKind] = useState<ExclusionKind>('vat');
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [requestedBy, setRequestedBy] = useState('');

  const attive = exclusions.filter(e => !e.archived);
  const revocate = exclusions.filter(e => e.archived);

  return (
    <div className="space-y-4">
      <p className="text-[11px] text-[#858585]">
        Chi è in questo elenco non viene cercato e non viene portato nel CRM. Il controllo avviene
        <span className="text-white"> prima</span> di interrogare qualunque servizio.
      </p>

      {canManage ? (
        <form
          onSubmit={event => {
            event.preventDefault();
            if (!value.trim() || busy) return;
            onAdd({ kind, value: value.trim(), reason: reason.trim(), requestedBy: requestedBy.trim() });
            setValue(''); setReason(''); setRequestedBy('');
          }}
          className="space-y-2 rounded-lg border border-[#1A1A1A] bg-[#0F0F0F] p-3"
        >
          <div className="flex flex-wrap gap-1">
            {EXCLUSION_KINDS.map(k => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`rounded px-2 py-1 text-[10px] transition-colors ${
                  kind === k ? 'bg-white/10 font-medium text-white' : 'text-[#585858] hover:text-[#C4C4C4]'
                }`}
              >
                {EXCLUSION_KIND_LABELS[k]}
              </button>
            ))}
          </div>

          <p className={`text-[10px] ${kind === 'name' ? 'text-[#F59E0B]' : 'text-[#585858]'}`}>
            {EXCLUSION_KIND_HINTS[kind]}
          </p>

          <div className="grid gap-2 sm:grid-cols-3">
            <input
              value={value} onChange={e => setValue(e.target.value)}
              placeholder={EXCLUSION_KIND_LABELS[kind]} aria-label={EXCLUSION_KIND_LABELS[kind]}
              className="rounded border border-[#1A1A1A] bg-[#0A0A0A] px-2 py-1.5 text-[11px] text-white placeholder:text-[#3F3F3F] focus:border-[#2A2A2A] focus:outline-none"
            />
            <input
              value={requestedBy} onChange={e => setRequestedBy(e.target.value)}
              placeholder="Chi l’ha chiesto, e come" aria-label="Chi l’ha chiesto"
              className="rounded border border-[#1A1A1A] bg-[#0A0A0A] px-2 py-1.5 text-[11px] text-white placeholder:text-[#3F3F3F] focus:border-[#2A2A2A] focus:outline-none"
            />
            <input
              value={reason} onChange={e => setReason(e.target.value)}
              placeholder="Motivo, con parole sue" aria-label="Motivo"
              className="rounded border border-[#1A1A1A] bg-[#0A0A0A] px-2 py-1.5 text-[11px] text-white placeholder:text-[#3F3F3F] focus:border-[#2A2A2A] focus:outline-none"
            />
          </div>

          <button
            type="submit" disabled={!value.trim() || busy}
            className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[11px] font-medium text-black disabled:opacity-30"
          >
            <Plus size={12} /> Aggiungi all’esclusione
          </button>
        </form>
      ) : (
        <p className="rounded-lg border border-[#1A1A1A] bg-[#0F0F0F] p-3 text-[11px] text-[#585858]">
          Solo chi amministra il progetto può aggiungere o revocare un’esclusione.
        </p>
      )}

      {attive.length === 0 && revocate.length === 0 && (
        <p className="rounded-lg border border-[#1A1A1A] bg-[#0F0F0F] p-4 text-[11px] text-[#585858]">
          Nessuna esclusione. Quando qualcuno chiede di non essere cercato, va scritto qui.
        </p>
      )}

      {[['In vigore', attive], ['Revocate', revocate]].map(([titolo, elenco]: any) => elenco.length > 0 && (
        <section key={titolo}>
          <h4 className="mb-2 text-[10px] uppercase tracking-wide text-[#585858]">{titolo}</h4>
          <div className="space-y-2">
            {elenco.map((voce: CrmProspectExclusion) => (
              <div key={voce.id} className="flex items-start justify-between gap-3 rounded-lg border border-[#1A1A1A] bg-[#0F0F0F] p-3">
                <div className="min-w-0">
                  <p className={`flex items-center gap-1.5 text-[11px] ${voce.archived ? 'text-[#585858] line-through' : 'text-white'}`}>
                    <Ban size={11} className="shrink-0" />
                    {EXCLUSION_KIND_LABELS[voce.kind]}: {voce.rawValue || voce.value}
                  </p>
                  {voce.requestedBy && (
                    <p className="mt-0.5 text-[10px] text-[#858585]">Richiesta da {voce.requestedBy}</p>
                  )}
                  {voce.reason && <p className="mt-0.5 text-[10px] text-[#858585]">{voce.reason}</p>}
                  <p className="mt-0.5 text-[10px] text-[#3F3F3F]">
                    Aggiunta {formatDate(voce.createdAt)} da {ownerName(voce.createdBy)}
                    {voce.archived && voce.liftedAt &&
                      ` · revocata ${formatDate(voce.liftedAt)} da ${ownerName(voce.liftedBy)}`}
                  </p>
                </div>

                {!voce.archived && canManage && (
                  <button
                    type="button"
                    onClick={() => {
                      const why = window.prompt('Perché si revoca questa esclusione? Resta scritto.');
                      if (why !== null) onLift(voce.id, why);
                    }}
                    disabled={busy}
                    title="Non cancella: archivia, con chi e quando."
                    className="flex shrink-0 items-center gap-1 rounded border border-[#1A1A1A] px-2 py-1 text-[10px] text-[#858585] hover:bg-white/5 disabled:opacity-30"
                  >
                    <RotateCcw size={11} /> Revoca
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
