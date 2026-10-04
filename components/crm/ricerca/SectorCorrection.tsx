'use client';

import { useTranslation } from '@/contexts/TranslationContext';
import { useState } from 'react';
import { Pencil, Check, X, RotateCcw } from 'lucide-react';
import { SECTORS } from '@/lib/crm/prospect/estimate/ateco';
import { Evidenced } from './types';

/**
 * Correggere a mano il settore.
 *
 * La scheda mostra le parole che hanno deciso il settore, e chi legge può
 * vedere che sono sbagliate. Fargli vedere l'errore senza lasciarglielo
 * correggere è il modo più sicuro di farlo smettere di guardare.
 *
 * E non è una riga cosmetica: **competitor e cliente-tipo dipendono dal
 * settore**, quindi correggerlo risistema le altre due stime. Per questo, dopo
 * la correzione, le stime si ricalcolano da sole.
 *
 * Una correzione **non diventa una stima migliore**: resta un'altra cosa, e la
 * scheda lo dice — l'ha dichiarata una persona, quindi vale «dichiarato», come
 * ciò che un'azienda scrive di sé.
 */

interface SectorCorrectionProps {
  override: Evidenced<string> | undefined;
  onSave: (sectorCode: string, why: string) => void;
  onClear: () => void;
  busy?: boolean;
}

export function SectorCorrection({ override, onSave, onClear, busy }: SectorCorrectionProps) {
  const { t } = useTranslation();
  const corretto = typeof override?.value === 'string' && override.value !== '';
  const [aperto, setAperto] = useState(false);
  const [codice, setCodice] = useState(corretto ? (override!.value as string) : '');
  const [perche, setPerche] = useState('');

  if (corretto && !aperto) {
    const scelto = SECTORS.find(s => s.code === override!.value);
    return (
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#131313] pt-2">
        <p className="text-[11px] text-[#3B82F6]">
          Settore corretto a mano: {scelto ? `${scelto.code} — ${scelto.label}` : override!.value}.
          {override!.note && <span className="text-[#585858]"> {override!.note}</span>}
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={() => setAperto(true)} disabled={busy}
            className="flex items-center gap-1 rounded border border-[#1A1A1A] px-2 py-1 text-[10px] text-[#858585] hover:bg-white/5 disabled:opacity-30">
            <Pencil size={11} /> Cambia
          </button>
          <button type="button" onClick={onClear} disabled={busy}
            title="Torna alla stima automatica."
            className="flex items-center gap-1 rounded border border-[#1A1A1A] px-2 py-1 text-[10px] text-[#858585] hover:bg-white/5 disabled:opacity-30">
            <RotateCcw size={11} /> Torna alla stima
          </button>
        </div>
      </div>
    );
  }

  if (!aperto) {
    return (
      <div className="mt-3 border-t border-[#131313] pt-2">
        <button type="button" onClick={() => setAperto(true)} disabled={busy}
          className="flex items-center gap-1.5 text-[11px] text-[#858585] hover:text-white disabled:opacity-30">
          <Pencil size={11} />
          Il settore è sbagliato? Correggilo
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={event => {
        event.preventDefault();
        if (!codice || busy) return;
        onSave(codice, perche.trim());
        setAperto(false);
        setPerche('');
      }}
      className="mt-3 space-y-2 border-t border-[#131313] pt-2"
    >
      <p className="text-[11px] text-[#858585]">
        Correggendo il settore si ricalcolano anche competitor e cliente-tipo, che dipendono da
        quello.
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        <select
          value={codice}
          onChange={event => setCodice(event.target.value)}
          aria-label="Divisione ATECO"
          className="rounded border border-[#1A1A1A] bg-[#0A0A0A] px-2 py-1.5 text-[11px] text-white focus:border-[#2A2A2A] focus:outline-none"
        >
          <option value="">Scegli la divisione…</option>
          {SECTORS.map(settore => (
            <option key={settore.code} value={settore.code}>
              {settore.code} — {settore.label}
            </option>
          ))}
        </select>

        <input
          value={perche}
          onChange={event => setPerche(event.target.value)}
          placeholder="Perché (resta scritto)"
          aria-label="Perché"
          className="rounded border border-[#1A1A1A] bg-[#0A0A0A] px-2 py-1.5 text-[11px] text-white placeholder:text-[#3F3F3F] focus:border-[#2A2A2A] focus:outline-none"
        />
      </div>

      <div className="flex gap-2">
        <button type="submit" disabled={!codice || busy}
          className="flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-[10px] font-medium text-black disabled:opacity-30">
          <Check size={11} /> Salva la correzione
        </button>
        <button type="button" onClick={() => { setAperto(false); setPerche(''); }}
          className="flex items-center gap-1 rounded-lg border border-[#1A1A1A] px-3 py-1.5 text-[10px] text-[#858585] hover:bg-white/5">
          <X size={11} /> Annulla
        </button>
      </div>
    </form>
  );
}
