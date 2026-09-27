'use client';

import { Building2, UserPlus, FileSearch, ArrowRight } from 'lucide-react';
import { SearchCandidate } from './types';

/**
 * I candidati di una ricerca per nome.
 *
 * Non si sceglie mai da soli. Una ricerca per nome che «trova» l'azienda
 * sbagliata e ci costruisce sopra un report è peggio di una che non trova
 * niente — e siccome il report sembra verificato, l'errore non si vede.
 *
 * Quindi: ogni riga porta scritto **perché somiglia** e **dove sta già**, e il
 * pulsante è uno solo per riga. Nessun candidato è preselezionato.
 */

const ICONE: Record<string, any> = {
  profile: FileSearch,
  account: Building2,
  lead: UserPlus,
  web: ArrowRight,
};

interface CandidateListProps {
  candidates: SearchCandidate[];
  onChoose: (candidate: SearchCandidate) => void;
  /** Il limite dichiarato: senza motore non si è guardato fuori. */
  limitNote: string;
  busy?: boolean;
}

export function CandidateList({ candidates, onChoose, limitNote, busy }: CandidateListProps) {
  return (
    <div className="space-y-2">
      {candidates.map(candidato => {
        const Icon = ICONE[candidato.source] || FileSearch;
        // Senza partita IVA né sito non c'è da dove ripartire, e il pulsante
        // lo dice invece di fallire dopo il clic.
        const ripartibile = Boolean(candidato.vatNumber || candidato.website);

        return (
          <div
            key={candidato.refId || candidato.name}
            className="flex items-start justify-between gap-3 rounded-lg border border-[#1A1A1A] bg-[#0F0F0F] p-3"
          >
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-xs text-white">
                <Icon size={12} className="shrink-0 text-[#585858]" />
                {candidato.name}
              </p>
              <p className="mt-0.5 text-[11px] text-[#858585]">{candidato.why}</p>
              {(candidato.vatNumber || candidato.website) && (
                <p className="mt-0.5 text-[10px] text-[#3F3F3F]">
                  {[candidato.vatNumber && `P.IVA ${candidato.vatNumber}`, candidato.website]
                    .filter(Boolean).join(' · ')}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => onChoose(candidato)}
              disabled={!ripartibile || busy}
              title={ripartibile
                ? 'Riparte da qui: partita IVA o sito'
                : 'Di questa azienda sappiamo solo il nome: senza partita IVA né sito non c’è da dove partire.'}
              className="shrink-0 rounded-lg border border-[#1A1A1A] px-3 py-1.5 text-[11px] text-[#C4C4C4] hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-30"
            >
              È questa
            </button>
          </div>
        );
      })}

      {limitNote && (
        <p className="rounded-lg border border-[#1A1A1A] bg-[#0F0F0F] p-3 text-[11px] text-[#858585]">
          {limitNote}
        </p>
      )}
    </div>
  );
}
