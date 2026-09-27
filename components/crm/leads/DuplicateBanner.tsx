'use client';

import { AlertTriangle, X } from 'lucide-react';
import { DuplicateMatch } from '@/lib/crm/duplicates';

interface DuplicateBannerProps {
  duplicates: DuplicateMatch[];
  onDismiss: () => void;
  onOpen?: (match: DuplicateMatch) => void;
}

const COLLECTION_LABELS: Record<string, string> = {
  crm_leads: 'lead',
  crm_contacts: 'contatto',
  crm_accounts: 'azienda',
};

const MATCH_LABELS: Record<string, string> = {
  email: 'stessa email',
  phone: 'stesso telefono',
  domain: 'stesso dominio',
};

/**
 * Segnalazione di possibili duplicati.
 *
 * La specifica è esplicita: si rilevano «senza creare fusioni automatiche».
 * Questo riquadro informa e basta — il record è stato comunque creato, e la
 * fusione resta un'azione manuale.
 */
export function DuplicateBanner({ duplicates, onDismiss, onOpen }: DuplicateBannerProps) {
  if (duplicates.length === 0) return null;

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-[#F59E0B]/30 bg-[#F59E0B]/10 p-4">
      <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[#F59E0B]" />

      <div className="flex flex-1 flex-col gap-2">
        <p className="text-xs font-medium text-[#F59E0B]">
          {duplicates.length === 1
            ? 'Trovato un possibile duplicato'
            : `Trovati ${duplicates.length} possibili duplicati`}
        </p>

        <ul className="flex flex-col gap-1">
          {duplicates.map(match => (
            <li key={`${match.collection}:${match.id}`} className="flex flex-wrap items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => onOpen?.(match)}
                className="text-white underline-offset-2 hover:underline"
              >
                {match.label}
              </button>
              <span className="text-[#858585]">
                ({COLLECTION_LABELS[match.collection] || match.collection})
              </span>
              <span className="text-[10px] text-[#F59E0B]/80">
                {match.matchedOn.map(m => MATCH_LABELS[m] || m).join(', ')}
              </span>
            </li>
          ))}
        </ul>

        <p className="text-[10px] text-[#858585]">
          Il lead è stato creato lo stesso. La fusione è manuale e non viene mai fatta in automatico.
        </p>
      </div>

      <button type="button" onClick={onDismiss} className="shrink-0 text-[#858585] hover:text-white">
        <X size={14} />
      </button>
    </div>
  );
}
